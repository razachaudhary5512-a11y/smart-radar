/**
 * Live backend — Supabase. Requires the migrations in supabase/migrations,
 * including 20260930000000_rebuild_hardening.sql (public_profiles view,
 * counter triggers, event_rsvps, admin RPCs, storage bucket).
 */
import type { AdminApi, AuthApi, DataApi, SessionUser } from './api';
import { finalizeFeed } from './feed';
import { emitChange } from './events';
import { compressImage } from './images';
import { requireSupabase } from '@/lib/supabase';
import { appUrl } from '@/config/env';
import { APP_AUTH_CALLBACK, isNative } from '@/lib/native';
import { boundingBox } from '@/lib/location';
import { uid } from '@/lib/format';
import { DEFAULT_SETTINGS, type AppSettings } from '@/lib/types';
import type {
  AdminUser,
  PostReport,
  AdminOverview,
  Comment,
  EventRsvp,
  Post,
  PostWithRelations,
  Profile,
  PublicProfile,
  VerificationRequest,
} from '@/lib/types';

const PROFILE_COLUMNS =
  'id, phone, display_name, avatar_url, is_business, is_admin, verification_status, verification_date, ' +
  'verification_expiry, verification_history, trust_score, radius_km, saved_locations, watched_areas, ' +
  'pinned_categories, muted_categories, digest_categories, digest_enabled, digest_time, blocked_users, theme, created_at, ' +
  'is_banned, banned_reason, is_owner';

const sb = () => requireSupabase();

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

type PostRow = Post & { poll_options?: PostWithRelations['poll_options']; comments?: { count: number }[] };

async function authorsFor(ids: string[]): Promise<Map<string, PublicProfile>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return new Map();
  const { data, error } = await sb().from('public_profiles').select('*').in('id', unique);
  fail(error);
  return new Map((data as PublicProfile[]).map((p) => [p.id, p]));
}

async function hydrate(rows: PostRow[], viewer?: string | null): Promise<PostWithRelations[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const eventIds = rows.filter((r) => r.category === 'local_event').map((r) => r.id);

  const [authors, votes, marks, confirms, pollVotes, rsvps] = await Promise.all([
    authorsFor(rows.map((r) => r.user_id)),
    viewer ? sb().from('votes').select('post_id, vote_type').eq('user_id', viewer).in('post_id', ids) : null,
    viewer ? sb().from('bookmarks').select('post_id').eq('user_id', viewer).in('post_id', ids) : null,
    viewer ? sb().from('confirmations').select('post_id, confirmation_type').eq('user_id', viewer).in('post_id', ids) : null,
    viewer ? sb().from('poll_votes').select('post_id, option_id').eq('user_id', viewer).in('post_id', ids) : null,
    eventIds.length ? sb().from('event_rsvps').select('post_id, user_id, status').in('post_id', eventIds) : null,
  ]);

  const voteMap = new Map((votes?.data ?? []).map((v: { post_id: string; vote_type: 'up' | 'down' }) => [v.post_id, v.vote_type]));
  const markSet = new Set((marks?.data ?? []).map((b: { post_id: string }) => b.post_id));
  const confMap = new Map(
    (confirms?.data ?? []).map((c: { post_id: string; confirmation_type: 'confirm' | 'resolve' }) => [c.post_id, c.confirmation_type])
  );
  const pollMap = new Map((pollVotes?.data ?? []).map((p: { post_id: string; option_id: string }) => [p.post_id, p.option_id]));
  const rsvpRows = (rsvps?.data ?? []) as { post_id: string; user_id: string; status: 'going' | 'interested' }[];

  return rows.map(({ comments, poll_options, ...p }) => {
    const rs = rsvpRows.filter((r) => r.post_id === p.id);
    return {
      ...p,
      metadata: p.metadata ?? {},
      image_urls: p.image_urls ?? [],
      author: authors.get(p.user_id) ?? null,
      comment_count: comments?.[0]?.count ?? 0,
      poll_options: poll_options?.length ? poll_options : undefined,
      is_bookmarked: markSet.has(p.id),
      user_vote: voteMap.get(p.id) ?? null,
      user_confirmation: confMap.get(p.id) ?? null,
      user_poll_vote: pollMap.get(p.id) ?? null,
      rsvp_count:
        p.category === 'local_event'
          ? { going: rs.filter((r) => r.status === 'going').length, interested: rs.filter((r) => r.status === 'interested').length }
          : undefined,
      user_rsvp: viewer ? rs.find((r) => r.user_id === viewer)?.status ?? null : null,
    };
  });
}

const POST_SELECT = '*, poll_options(*), comments(count)';

// ── auth ────────────────────────────────────────────────────────────────────

const toSession = (u: { id: string; phone?: string | null; email?: string | null } | null | undefined): SessionUser | null =>
  u ? { id: u.id, phone: u.phone ? `+${u.phone.replace(/^\+/, '')}` : null, email: u.email ?? null } : null;

const auth: AuthApi = {
  async getSession() {
    const { data } = await sb().auth.getSession();
    return toSession(data.session?.user);
  },
  onChange(cb) {
    const { data } = sb().auth.onAuthStateChange((_e, s) => cb(toSession(s?.user)));
    return () => data.subscription.unsubscribe();
  },
  async sendOtp(phone, captchaToken) {
    // Server-side rate limit (5 / hour / number). Fails open if the RPC is missing.
    const { data: allowed, error: rlError } = await sb().rpc('request_otp_slot', { p_phone: phone });
    if (!rlError && allowed === false) {
      return { error: 'Too many code requests for this number. Please try again in an hour.' };
    }
    const { error } = await sb().auth.signInWithOtp({ phone, options: { captchaToken } });
    return { error: error?.message ?? null };
  },
  async verifyOtp(phone, code) {
    const { error } = await sb().auth.verifyOtp({ phone, token: code, type: 'sms' });
    return { error: error?.message ?? null };
  },
  async sendEmailOtp(email, captchaToken) {
    // Supabase emails a sign-in link (and a 6-digit code if the template includes {{ .Token }}).
    // The link brings the user back to the app, where the session is picked up automatically.
    const { error } = await sb().auth.signInWithOtp({
      email: email.trim(),
      // In the Android app the link must reopen the app, not the phone's browser.
      options: { shouldCreateUser: true, emailRedirectTo: isNative ? APP_AUTH_CALLBACK : appUrl(''), captchaToken },
    });
    return { error: error?.message ?? null };
  },
  async verifyEmailOtp(email, code) {
    const { error } = await sb().auth.verifyOtp({ email: email.trim(), token: code, type: 'email' });
    return { error: error?.message ?? null };
  },
  async adminSignIn(email, password, captchaToken) {
    const { data, error } = await sb().auth.signInWithPassword({ email, password, options: { captchaToken } });
    if (error) return { error: error.message };
    const { data: p } = await sb().from('profiles').select('is_admin').eq('id', data.user.id).maybeSingle();
    if (!p?.is_admin) {
      await sb().auth.signOut();
      return { error: 'This account does not have admin access.' };
    }
    return { error: null };
  },
  async signOut() {
    await sb().auth.signOut();
  },
  async deleteMyAccount() {
    const { data } = await sb().auth.getUser();
    const userId = data.user?.id;
    if (!userId) return { error: 'Please sign in again.' };
    // Photos live in storage under "<userId>/…"; remove them first (storage is not covered by SQL cascades).
    const bucket = sb().storage.from('post-images');
    for (;;) {
      const { data: files } = await bucket.list(userId, { limit: 100 });
      if (!files?.length) break;
      const { error } = await bucket.remove(files.map((f) => `${userId}/${f.name}`));
      if (error) break;
    }
    const { error } = await sb().rpc('delete_my_account');
    if (error) return { error: error.message };
    await sb().auth.signOut();
    return { error: null };
  },
  async getProfile(userId) {
    const { data, error } = await sb().from('profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle();
    fail(error);
    if (!data) return null;
    const p = data as unknown as Profile;
    return {
      ...p,
      saved_locations: p.saved_locations ?? [],
      watched_areas: p.watched_areas ?? [],
      pinned_categories: p.pinned_categories ?? [],
      muted_categories: p.muted_categories ?? [],
      digest_categories: p.digest_categories ?? [],
      blocked_users: p.blocked_users ?? [],
      theme: p.theme ?? 'system',
    };
  },
  async updateProfile(userId, patch) {
    const { error } = await sb().from('profiles').update(patch).eq('id', userId);
    fail(error);
    emitChange('profile');
  },
  async submitVerification(_userId, cnic, isBusiness) {
    const { error } = await sb().rpc('submit_verification', { p_cnic: cnic.replace(/\D/g, ''), p_is_business: isBusiness });
    fail(error);
    emitChange('profile');
  },
};

/**
 * Finish an email-link sign-in that reopened the Android app.
 * Handles both PKCE (?code=…) and implicit (#access_token=…) redirects.
 */
export async function completeAuthFromUrl(url: string): Promise<{ error: string | null }> {
  if (!url.startsWith(APP_AUTH_CALLBACK)) return { error: null };
  const u = new URL(url.replace(APP_AUTH_CALLBACK, 'https://callback.local/'));
  const hash = new URLSearchParams(u.hash.replace(/^#/, ''));
  const err = u.searchParams.get('error_description') ?? hash.get('error_description');
  if (err) return { error: err.replace(/\+/g, ' ') };
  // Only the PKCE code is accepted. Raw tokens in a link are ignored: they could
  // belong to someone else's account (login-CSRF / session swap).
  const code = u.searchParams.get('code');
  if (code) {
    const { error } = await sb().auth.exchangeCodeForSession(code);
    if (error && /verifier/i.test(error.message)) {
      return { error: 'Please open the sign-in link on the same phone where you requested it.' };
    }
    return { error: error?.message ?? null };
  }
  return { error: null };
}

// ── admin ───────────────────────────────────────────────────────────────────

const admin: AdminApi = {
  async overview() {
    const { data, error } = await sb().rpc('admin_overview');
    fail(error);
    return data as AdminOverview;
  },
  async listPosts(filter, search) {
    let q = sb().from('posts').select(POST_SELECT).order('report_count', { ascending: false }).order('created_at', { ascending: false }).limit(200);
    if (filter === 'reported') q = q.gt('report_count', 0).neq('status', 'hidden');
    if (filter === 'hidden') q = q.eq('status', 'hidden');
    if (search?.trim()) q = q.ilike('title', `%${search.trim()}%`);
    const { data, error } = await q;
    fail(error);
    return hydrate((data ?? []) as PostRow[]);
  },
  async moderatePost(_adminId, postId, action, reason) {
    const { error } = await sb().rpc('admin_moderate_post', { p_post_id: postId, p_action: action, p_reason: reason ?? null });
    fail(error);
    emitChange('posts');
  },
  async verificationQueue() {
    const { data, error } = await sb().rpc('admin_verification_queue');
    fail(error);
    return (data ?? []) as VerificationRequest[];
  },
  async reviewVerification(_adminId, userId, decision, notes, expiry) {
    const { error } = await sb().rpc('admin_review_verification', {
      p_user_id: userId,
      p_decision: decision,
      p_notes: notes,
      p_expiry: expiry,
    });
    fail(error);
    emitChange('admin');
  },
  async listListings(status) {
    let q = sb().from('provider_listings').select('*').order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    fail(error);
    return data ?? [];
  },
  async reviewListing(_adminId, id, decision, notes) {
    const { error } = await sb().rpc('admin_review_listing', { p_listing_id: id, p_decision: decision, p_notes: notes });
    fail(error);
    emitChange('admin');
  },
  async upsertEmergencyContact(adminId, c) {
    const { id, ...rest } = c;
    const { error } = id
      ? await sb().from('emergency_contacts').update(rest).eq('id', id)
      : await sb().from('emergency_contacts').insert(rest);
    fail(error);
    await sb().from('admin_audit_log').insert({
      admin_id: adminId,
      action: id ? 'update_emergency_contact' : 'add_emergency_contact',
      target_type: 'emergency_contact',
      target_id: id ?? null,
      details: { name: c.name, phone: c.phone },
    });
    emitChange('emergency');
  },
  async deleteEmergencyContact(adminId, id) {
    const { error } = await sb().from('emergency_contacts').delete().eq('id', id);
    fail(error);
    await sb().from('admin_audit_log').insert({ admin_id: adminId, action: 'delete_emergency_contact', target_type: 'emergency_contact', target_id: id, details: {} });
    emitChange('emergency');
  },
  async auditLog() {
    const { data, error } = await sb().from('admin_audit_log').select('*').order('created_at', { ascending: false }).limit(200);
    fail(error);
    const rows = data ?? [];
    const names = await authorsFor(rows.map((r) => r.admin_id));
    return rows.map((r) => ({ ...r, admin_name: names.get(r.admin_id)?.display_name }));
  },
  async listUsers(search, filter) {
    const { data, error } = await sb().rpc('admin_list_users', { p_search: search.trim() || null, p_filter: filter });
    fail(error);
    return ((data ?? []) as AdminUser[]).map((u) => ({ ...u, post_count: Number(u.post_count), reports_received: Number(u.reports_received) }));
  },
  async updateUser(_adminId, userId, action, value, reason) {
    const { error } = await sb().rpc('admin_update_user', { p_user_id: userId, p_action: action, p_value: value ?? null, p_reason: reason ?? null });
    fail(error);
    emitChange('admin');
    emitChange('posts');
  },
  async postReports(postId) {
    const { data, error } = await sb().from('reports').select('*').eq('post_id', postId).order('created_at', { ascending: false });
    fail(error);
    return (data ?? []) as PostReport[];
  },
  async updateSettings(_ownerId, patch) {
    const { error } = await sb().rpc('owner_update_settings', { p_patch: patch });
    fail(error);
    emitChange('settings');
    emitChange('admin');
  },
  async setAdmin(_ownerId, userId, isAdmin) {
    const { error } = await sb().rpc('owner_set_admin', { p_user_id: userId, p_is_admin: isAdmin });
    fail(error);
    emitChange('admin');
  },
};

// ── data ────────────────────────────────────────────────────────────────────

export const liveApi: DataApi = {
  mode: 'live',
  auth,
  admin,

  async listPosts(q, viewer) {
    const bb = boundingBox(q.center, q.radiusKm);
    let query = sb()
      .from('posts')
      .select(POST_SELECT)
      .gte('lat', bb.minLat)
      .lte('lat', bb.maxLat)
      .gte('lng', bb.minLng)
      .lte('lng', bb.maxLng)
      .in('status', q.includeResolved ? ['active', 'resolved'] : ['active'])
      .order('created_at', { ascending: false })
      .limit(400);
    if (q.category) query = query.eq('category', q.category);
    if (q.search?.trim()) {
      const s = q.search.trim().replace(/[%,()]/g, ' ');
      query = query.or(`title.ilike.%${s}%,description.ilike.%${s}%,location_label.ilike.%${s}%`);
    }
    const { data, error } = await query;
    fail(error);
    const posts = await hydrate((data ?? []) as PostRow[], viewer);
    return finalizeFeed(posts, q);
  },
  async getPost(id, viewer) {
    const { data, error } = await sb().from('posts').select(POST_SELECT).eq('id', id).maybeSingle();
    fail(error);
    if (!data) return null;
    const [p] = await hydrate([data as PostRow], viewer);
    return p;
  },
  async listUserPosts(userId) {
    const { data, error } = await sb().from('posts').select(POST_SELECT).eq('user_id', userId).order('created_at', { ascending: false });
    fail(error);
    return hydrate((data ?? []) as PostRow[], userId);
  },
  async listBookmarks(userId) {
    const { data, error } = await sb()
      .from('bookmarks')
      .select(`created_at, post:posts(${POST_SELECT})`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    fail(error);
    const rows = ((data ?? []) as unknown as { post: PostRow | null }[]).map((b) => b.post).filter((p): p is PostRow => Boolean(p));
    return hydrate(rows, userId);
  },
  async createPost(userId, input) {
    const { poll_options, ...row } = input;
    const { data, error } = await sb().from('posts').insert({ ...row, user_id: userId }).select('*').single();
    fail(error);
    if (poll_options?.length) {
      const { error: pe } = await sb().from('poll_options').insert(poll_options.map((t) => ({ post_id: data.id, option_text: t })));
      fail(pe);
    }
    emitChange('posts');
    const created = await liveApi.getPost(data.id, userId);
    return created ?? ({ ...data, author: null } as PostWithRelations);
  },
  async updatePost(_userId, id, patch) {
    const { poll_options, ...row } = patch;
    void poll_options;
    const { error } = await sb().from('posts').update(row).eq('id', id);
    fail(error);
    emitChange('posts');
  },
  async deletePost(_userId, id) {
    const { error } = await sb().from('posts').delete().eq('id', id);
    fail(error);
    emitChange('posts');
  },

  async setVote(userId, postId, vote) {
    if (!vote) {
      const { error } = await sb().from('votes').delete().eq('post_id', postId).eq('user_id', userId);
      return fail(error);
    }
    const { error } = await sb().from('votes').upsert({ post_id: postId, user_id: userId, vote_type: vote }, { onConflict: 'post_id,user_id' });
    fail(error);
  },
  async toggleBookmark(userId, postId) {
    const { data } = await sb().from('bookmarks').select('id').eq('post_id', postId).eq('user_id', userId).maybeSingle();
    if (data) {
      const { error } = await sb().from('bookmarks').delete().eq('id', data.id);
      fail(error);
      emitChange('bookmarks');
      return false;
    }
    const { error } = await sb().from('bookmarks').insert({ post_id: postId, user_id: userId });
    fail(error);
    emitChange('bookmarks');
    return true;
  },
  async setConfirmation(userId, postId, type) {
    const { data } = await sb().from('confirmations').select('id, confirmation_type').eq('post_id', postId).eq('user_id', userId).maybeSingle();
    if (data) {
      const { error } = await sb().from('confirmations').delete().eq('id', data.id);
      fail(error);
      if (data.confirmation_type === type) return emitChange('posts');
    }
    const { error } = await sb().from('confirmations').insert({ post_id: postId, user_id: userId, confirmation_type: type });
    fail(error);
    emitChange('posts');
  },
  async reportPost(userId, postId, reason) {
    const { error } = await sb().from('reports').insert({ post_id: postId, user_id: userId, reason });
    if (error?.code === '23505') throw new Error('You have already reported this post.');
    fail(error);
    emitChange('posts');
  },

  async listComments(postId) {
    const { data, error } = await sb().from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
    fail(error);
    const rows = (data ?? []) as Comment[];
    const authors = await authorsFor(rows.map((c) => c.user_id));
    return rows.map((c) => ({ ...c, author: authors.get(c.user_id) ?? null }));
  },
  async addComment(userId, postId, body) {
    const { data, error } = await sb().from('comments').insert({ post_id: postId, user_id: userId, body: body.trim() }).select('*').single();
    fail(error);
    const authors = await authorsFor([userId]);
    emitChange('comments');
    return { ...(data as Comment), author: authors.get(userId) ?? null };
  },
  async deleteComment(_userId, commentId) {
    const { error } = await sb().from('comments').delete().eq('id', commentId);
    fail(error);
    emitChange('comments');
  },

  async votePoll(userId, postId, optionId) {
    const { data: prev } = await sb().from('poll_votes').select('id, option_id').eq('post_id', postId).eq('user_id', userId).maybeSingle();
    if (prev) {
      const { error } = await sb().from('poll_votes').delete().eq('id', prev.id);
      fail(error);
      if (prev.option_id === optionId) return;
    }
    const { error } = await sb().from('poll_votes').insert({ option_id: optionId, user_id: userId });
    fail(error);
  },
  async setRsvp(userId, postId, status) {
    if (!status) {
      const { error } = await sb().from('event_rsvps').delete().eq('post_id', postId).eq('user_id', userId);
      fail(error);
    } else {
      const { error } = await sb().from('event_rsvps').upsert({ post_id: postId, user_id: userId, status }, { onConflict: 'post_id,user_id' });
      fail(error);
    }
    emitChange('rsvps');
  },
  async listRsvps(postId) {
    const { data, error } = await sb().from('event_rsvps').select('*').eq('post_id', postId).order('created_at', { ascending: false });
    fail(error);
    const rows = (data ?? []) as EventRsvp[];
    const authors = await authorsFor(rows.map((r) => r.user_id));
    return rows.map((r) => ({ ...r, author: authors.get(r.user_id) ?? null }));
  },

  async uploadImages(userId, files) {
    const urls: string[] = [];
    for (const f of files) {
      const blob = await compressImage(f);
      const path = `${userId}/${uid()}.jpg`;
      const { error } = await sb().storage.from('post-images').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      fail(error);
      urls.push(sb().storage.from('post-images').getPublicUrl(path).data.publicUrl);
    }
    return urls;
  },

  async listEmergencyContacts() {
    const { data, error } = await sb().from('emergency_contacts').select('*').order('name');
    fail(error);
    return data ?? [];
  },
  async listTrustedContacts(userId) {
    const { data, error } = await sb().from('trusted_contacts').select('*').eq('user_id', userId).order('created_at');
    fail(error);
    return data ?? [];
  },
  async addTrustedContact(userId, name, phone) {
    const { error } = await sb().from('trusted_contacts').insert({ user_id: userId, name, phone });
    fail(error);
    emitChange('trusted');
  },
  async removeTrustedContact(_userId, id) {
    const { error } = await sb().from('trusted_contacts').delete().eq('id', id);
    fail(error);
    emitChange('trusted');
  },

  async submitListing(userId, input) {
    const { error } = await sb().from('provider_listings').insert({ ...input, user_id: userId, status: 'pending' });
    fail(error);
    emitChange('listings');
  },
  async listMyListings(userId) {
    const { data, error } = await sb().from('provider_listings').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    fail(error);
    return data ?? [];
  },
  async getSettings() {
    const { data, error } = await sb().from('app_settings').select('*').eq('id', 1).maybeSingle();
    if (error || !data) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(data as Partial<AppSettings>) };
  },
  async listProviders() {
    // RLS returns only approved listings to the public.
    const { data, error } = await sb().from('provider_listings').select('*').eq('status', 'approved').order('updated_at', { ascending: false }).limit(100);
    fail(error);
    return data ?? [];
  },
};
