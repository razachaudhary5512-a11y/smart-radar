import type { PostWithRelations, Comment, PollOption, WatchedArea, EventRsvp, Profile } from './types';
import type { Coords } from './location';

const LOCAL_STORAGE_KEY = 'smart_radar_local_posts_v4';
const LOCAL_COMMENTS_KEY = 'smart_radar_local_comments_v4';
const LOCAL_MESSAGES_KEY = 'smart_radar_local_messages_v4';
const LOCAL_RSVPS_KEY = 'smart_radar_local_rsvps_v4';
const LOCAL_WATCHED_AREAS_KEY = 'smart_radar_watched_areas_v4';

export const POPULAR_NEIGHBORHOODS: Omit<WatchedArea, 'id' | 'notify' | 'created_at'>[] = [
  {
    name: 'DHA Phase 5',
    city: 'Karachi',
    lat: 24.8015,
    lng: 67.0425,
    radius_km: 4,
    notes: 'Prime residential area with upscale rentals, cafes, and business hubs',
  },
  {
    name: 'Clifton Block 2 & 4',
    city: 'Karachi',
    lat: 24.8198,
    lng: 67.0298,
    radius_km: 3.5,
    notes: 'Coastal commercial zone with apartments, shopping centers, and medical clinics',
  },
  {
    name: 'Gulberg III (Main Boulevard)',
    city: 'Lahore',
    lat: 31.5204,
    lng: 74.3587,
    radius_km: 4,
    notes: 'Heart of Lahore, excellent for corporate jobs, boutique shops, and events',
  },
  {
    name: 'F-7 & F-8 Markaz',
    city: 'Islamabad',
    lat: 33.7215,
    lng: 73.0558,
    radius_km: 3,
    notes: 'Key diplomatic & dining enclave, active community events and tech offices',
  },
  {
    name: 'Bahria Town (Safari Valley)',
    city: 'Rawalpindi',
    lat: 33.5186,
    lng: 73.1258,
    radius_km: 5,
    notes: 'Master-planned community with family homes, security radar, and parks',
  },
];

export const INITIAL_WATCHED_AREAS: WatchedArea[] = [
  {
    id: 'watched-dha-5',
    name: 'DHA Phase 5',
    city: 'Karachi',
    lat: 24.8015,
    lng: 67.0425,
    radius_km: 4,
    notify: true,
    notes: 'Target area for moving next quarter — tracking 2-bed rentals & local services',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'watched-gulberg-3',
    name: 'Gulberg III',
    city: 'Lahore',
    lat: 31.5204,
    lng: 74.3587,
    radius_km: 4,
    notify: true,
    notes: 'Tracking tech coworking spaces & weekend neighborhood events',
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
];

const SEED_POSTS: PostWithRelations[] = [
  {
    id: 'post-seed-event-1',
    user_id: 'user-community-org',
    category: 'local_event',
    title: 'Weekend Neighborhood Farmers Market & Art Fair',
    description: 'Fresh organic produce, handmade goods by local artisans, live acoustic music, and food stalls. Family-friendly and open to all neighbors!',
    metadata: {
      event_date: 'This Saturday, 10:00 AM - 6:00 PM',
      venue: 'Community Central Park Ground',
      entry_fee: 'Free Entry',
    },
    image_urls: [
      'https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1533900298318-6b8da08a523e?w=600&auto=format&fit=crop&q=80',
    ],
    lat: 24.8610,
    lng: 67.0015,
    location_label: 'Saddar / Central Park, Karachi',
    status: 'active',
    is_featured: true,
    women_only: false,
    expires_at: null,
    confirm_count: 14,
    resolve_count: 0,
    report_count: 0,
    upvotes: 42,
    downvotes: 0,
    created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
    updated_at: new Date().toISOString(),
    author_name: 'Karachi Green Society',
    author_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&auto=format&fit=crop&q=80',
    author_is_verified: true,
    author_verification_status: 'valid',
    author_verification_expiry: new Date(Date.now() + 180 * 86400000).toISOString(),
    rsvp_count: { going: 28, interested: 45 },
  },
  {
    id: 'post-seed-watched-prop-1',
    user_id: 'user-dha-agent',
    category: 'property_rent',
    title: 'Modern 2-Bed Luxury Flat with Generator & Lift (DHA Phase 5)',
    description: 'Spacious 2-bed apartment with open American kitchen, dedicated basement parking, 24/7 CCTV security, and standby generator power backup.',
    metadata: {
      rent: 'Rs. 95,000 / month',
      bedrooms: '2 Bed DD',
      advance: '3 Months Deposit',
      furnishing: 'Semi-Furnished',
    },
    image_urls: [
      'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&auto=format&fit=crop&q=80',
      'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600&auto=format&fit=crop&q=80',
    ],
    lat: 24.8020,
    lng: 67.0430,
    location_label: 'DHA Phase 5, Khayaban-e-Badar',
    status: 'active',
    is_featured: true,
    women_only: false,
    expires_at: null,
    confirm_count: 9,
    resolve_count: 0,
    report_count: 0,
    upvotes: 21,
    downvotes: 0,
    created_at: new Date(Date.now() - 6 * 3600000).toISOString(),
    updated_at: new Date().toISOString(),
    author_name: 'Al-Madina Estates (DHA)',
    author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    author_is_verified: true,
    author_verification_status: 'valid',
    author_verification_expiry: new Date(Date.now() + 210 * 86400000).toISOString(),
  },
  {
    id: 'post-seed-watched-deal-1',
    user_id: 'user-gulberg-store',
    category: 'local_deals',
    title: '40% Grand Opening Neighborhood Discount on Organic Bakery (Gulberg III)',
    description: 'Sourdough breads, gluten-free pastries, and hand-roasted espresso. Show this Smart Radar post to claim 40% off on all items this week!',
    metadata: {
      discount: '40% OFF',
      valid_till: 'Valid until Sunday',
      code: 'RADAR40',
    },
    image_urls: [
      'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=600&auto=format&fit=crop&q=80',
    ],
    lat: 31.5210,
    lng: 74.3590,
    location_label: 'Gulberg III, Near Hussain Chowk, Lahore',
    status: 'active',
    is_featured: false,
    women_only: false,
    expires_at: null,
    confirm_count: 16,
    resolve_count: 0,
    report_count: 0,
    upvotes: 35,
    downvotes: 0,
    created_at: new Date(Date.now() - 10 * 3600000).toISOString(),
    updated_at: new Date().toISOString(),
    author_name: 'Artisan Oven Gulberg',
    author_avatar: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=150&auto=format&fit=crop&q=80',
    author_is_verified: true,
    author_verification_status: 'valid',
    author_verification_expiry: new Date(Date.now() + 120 * 86400000).toISOString(),
  },
];

export function getStoredLocalPosts(): PostWithRelations[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    // Seed initial demo posts if empty
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(SEED_POSTS));
    return SEED_POSTS;
  } catch {
    return SEED_POSTS;
  }
}

export function saveLocalPost(post: PostWithRelations): void {
  try {
    const list = getStoredLocalPosts();
    const filtered = list.filter((p) => p.id !== post.id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify([post, ...filtered]));
    window.dispatchEvent(new Event('smart_radar_posts_updated'));
  } catch (e) {
    console.error('Failed to save post locally:', e);
  }
}

export function deleteLocalPost(postId: string): void {
  try {
    const list = getStoredLocalPosts();
    const filtered = list.filter((p) => p.id !== postId);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event('smart_radar_posts_updated'));
  } catch (e) {
    console.error('Failed to delete post locally:', e);
  }
}

export function getStoredLocalComments(postId: string): Comment[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_COMMENTS_KEY}_${postId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalComment(postId: string, comment: Comment): void {
  try {
    const list = getStoredLocalComments(postId);
    localStorage.setItem(`${LOCAL_COMMENTS_KEY}_${postId}`, JSON.stringify([...list, comment]));
    window.dispatchEvent(new Event('smart_radar_posts_updated'));
  } catch (e) {
    console.error('Failed to save comment locally:', e);
  }
}

/* =========================================================
   WATCHED AREAS STORAGE & MANAGEMENT
========================================================= */

export function getStoredWatchedAreas(): WatchedArea[] {
  try {
    const raw = localStorage.getItem(LOCAL_WATCHED_AREAS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
    localStorage.setItem(LOCAL_WATCHED_AREAS_KEY, JSON.stringify(INITIAL_WATCHED_AREAS));
    return INITIAL_WATCHED_AREAS;
  } catch {
    return INITIAL_WATCHED_AREAS;
  }
}

export function saveWatchedArea(area: WatchedArea): void {
  try {
    const current = getStoredWatchedAreas();
    const filtered = current.filter((a) => a.id !== area.id);
    const updated = [area, ...filtered];
    localStorage.setItem(LOCAL_WATCHED_AREAS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event('smart_radar_watched_areas_updated'));
  } catch (e) {
    console.error('Failed to save watched area:', e);
  }
}

export function deleteWatchedArea(id: string): void {
  try {
    const current = getStoredWatchedAreas();
    const filtered = current.filter((a) => a.id !== id);
    localStorage.setItem(LOCAL_WATCHED_AREAS_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event('smart_radar_watched_areas_updated'));
  } catch (e) {
    console.error('Failed to delete watched area:', e);
  }
}

/* =========================================================
   EVENT RSVP & ATTENDEE MANAGEMENT
========================================================= */

export function getStoredEventRsvps(postId: string): EventRsvp[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_RSVPS_KEY}_${postId}`);
    if (raw) return JSON.parse(raw);
    // Initial mock RSVPs for demo events
    if (postId === 'post-seed-event-1') {
      const defaultMock: EventRsvp[] = [
        {
          id: 'rsvp-1',
          post_id: postId,
          user_id: 'user-neighbor-1',
          status: 'going',
          user_name: 'Ayesha Khan',
          user_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80',
          created_at: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'rsvp-2',
          post_id: postId,
          user_id: 'user-neighbor-2',
          status: 'going',
          user_name: 'Bilal Tariq',
          user_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80',
          created_at: new Date(Date.now() - 7200000).toISOString(),
        },
        {
          id: 'rsvp-3',
          post_id: postId,
          user_id: 'user-neighbor-3',
          status: 'interested',
          user_name: 'Dr. Maria Siddiqui',
          user_avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=100&auto=format&fit=crop&q=80',
          created_at: new Date(Date.now() - 10800000).toISOString(),
        },
      ];
      localStorage.setItem(`${LOCAL_RSVPS_KEY}_${postId}`, JSON.stringify(defaultMock));
      return defaultMock;
    }
    return [];
  } catch {
    return [];
  }
}

export function toggleEventRsvp(
  postId: string,
  user: { id: string; name: string; avatar?: string | null },
  targetStatus: 'going' | 'interested'
): { rsvps: EventRsvp[]; userStatus: 'going' | 'interested' | null } {
  try {
    const list = getStoredEventRsvps(postId);
    const existingIdx = list.findIndex((r) => r.user_id === user.id);

    let updatedList: EventRsvp[];
    let newStatus: 'going' | 'interested' | null = null;

    if (existingIdx >= 0) {
      if (list[existingIdx].status === targetStatus) {
        // Un-RSVP
        updatedList = list.filter((_, i) => i !== existingIdx);
        newStatus = null;
      } else {
        // Switch status
        updatedList = [...list];
        updatedList[existingIdx] = {
          ...updatedList[existingIdx],
          status: targetStatus,
          created_at: new Date().toISOString(),
        };
        newStatus = targetStatus;
      }
    } else {
      // Add new RSVP
      const newRsvp: EventRsvp = {
        id: `rsvp-${Date.now()}`,
        post_id: postId,
        user_id: user.id,
        status: targetStatus,
        user_name: user.name,
        user_avatar: user.avatar,
        created_at: new Date().toISOString(),
      };
      updatedList = [newRsvp, ...list];
      newStatus = targetStatus;
    }

    localStorage.setItem(`${LOCAL_RSVPS_KEY}_${postId}`, JSON.stringify(updatedList));

    // Update post counts in local posts
    const allPosts = getStoredLocalPosts();
    const postIdx = allPosts.findIndex((p) => p.id === postId);
    if (postIdx >= 0) {
      const goingCount = updatedList.filter((r) => r.status === 'going').length;
      const interestedCount = updatedList.filter((r) => r.status === 'interested').length;
      allPosts[postIdx].rsvp_count = { going: goingCount, interested: interestedCount };
      allPosts[postIdx].user_rsvp = newStatus;
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(allPosts));
    }

    window.dispatchEvent(new Event('smart_radar_posts_updated'));
    window.dispatchEvent(new CustomEvent('smart_radar_rsvp_updated', { detail: { postId } }));
    return { rsvps: updatedList, userStatus: newStatus };
  } catch (e) {
    console.error('Failed to toggle RSVP:', e);
    return { rsvps: [], userStatus: null };
  }
}

/* =========================================================
   ONE-TAP QUICK-POST GENERATOR (PHONE WIDGET)
========================================================= */

export function createQuickUrgentPost(params: {
  category: 'utility_outage' | 'traffic_alert' | 'urgent_blood';
  title: string;
  description: string;
  coords: Coords;
  locationLabel?: string;
  authorName: string;
  authorAvatar?: string | null;
  metadata?: Record<string, unknown>;
}): PostWithRelations {
  const newPost: PostWithRelations = {
    id: `quick-${Date.now()}`,
    user_id: 'local-user',
    category: params.category,
    title: params.title,
    description: params.description,
    metadata: params.metadata || { urgent: true, reported_via: 'Quick Widget' },
    image_urls: [],
    lat: params.coords.lat,
    lng: params.coords.lng,
    location_label: params.locationLabel || 'Near Current Location',
    status: 'active',
    is_featured: true,
    women_only: false,
    expires_at: new Date(Date.now() + 6 * 3600000).toISOString(), // 6-hour auto expiry for urgent alerts
    confirm_count: 1,
    resolve_count: 0,
    report_count: 0,
    upvotes: 1,
    downvotes: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    author_name: params.authorName,
    author_avatar: params.authorAvatar,
    author_is_verified: true,
    author_verification_status: 'valid',
  };

  saveLocalPost(newPost);
  return newPost;
}

/* =========================================================
   GDPR / PRIVACY COMPLIANCE: EXPORT DATA & ACCOUNT WIPEOUT
========================================================= */

export function exportAccountDataPackage(profile: Profile, currentPosts: PostWithRelations[]): void {
  try {
    const userPosts = currentPosts.filter((p) => p.user_id === profile.id || p.user_id === 'local-user');
    const watchedAreas = getStoredWatchedAreas();

    const dataPackage = {
      meta: {
        app_name: 'Smart Radar (Hyper-Local Community Platform)',
        export_timestamp: new Date().toISOString(),
        compliance: 'GDPR / PECA Compliance & FYP Privacy Standards',
        data_controller: 'Smart Radar Core Engine',
      },
      user_profile: {
        id: profile.id,
        phone: profile.phone || 'Anonymous / Local Session',
        display_name: profile.display_name,
        trust_score: profile.trust_score,
        verification_status: profile.verification_status,
        verification_date: profile.verification_date,
        verification_expiry: profile.verification_expiry,
        cnic_record: profile.cnic_number
          ? `${profile.cnic_number.substring(0, 5)}-XXXXXXX-${profile.cnic_number.slice(-1)} (Encrypted on Device)`
          : 'None',
        created_at: profile.created_at,
      },
      verification_audit_trail: profile.verification_history || [],
      saved_locations: profile.saved_locations || [],
      watched_areas: watchedAreas,
      preferences: {
        radius_km: profile.radius_km,
        pinned_categories: profile.pinned_categories,
        muted_categories: profile.muted_categories,
        digest_categories: profile.digest_categories,
        theme: profile.theme,
      },
      user_published_posts: userPosts.map((p) => ({
        id: p.id,
        category: p.category,
        title: p.title,
        description: p.description,
        lat: p.lat,
        lng: p.lng,
        location_label: p.location_label,
        upvotes: p.upvotes,
        confirm_count: p.confirm_count,
        created_at: p.created_at,
      })),
    };

    const blob = new Blob([JSON.stringify(dataPackage, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `smart-radar-data-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to export account data:', err);
    throw err;
  }
}

export function wipeAllAccountData(userId: string): void {
  try {
    // 1. Remove all posts authored by this user from local storage
    const allPosts = getStoredLocalPosts();
    const remaining = allPosts.filter((p) => p.user_id !== userId && p.user_id !== 'local-user');
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(remaining));

    // 2. Remove user profile
    localStorage.removeItem('smart_radar_user_profile_v4');

    // 3. Clear watched areas & preferences
    localStorage.removeItem(LOCAL_WATCHED_AREAS_KEY);

    // 4. Dispatch events so UI refreshes cleanly
    window.dispatchEvent(new Event('smart_radar_posts_updated'));
    window.dispatchEvent(new Event('smart_radar_watched_areas_updated'));
  } catch (e) {
    console.error('Failed to wipe account data:', e);
  }
}

export interface ChatMessage {
  id: string;
  postId?: string;
  senderId: string;
  senderName: string;
  receiverId: string;
  text: string;
  timestamp: string;
}

export function getStoredLocalMessages(conversationKey: string): ChatMessage[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_MESSAGES_KEY}_${conversationKey}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalMessage(conversationKey: string, message: ChatMessage): void {
  try {
    const list = getStoredLocalMessages(conversationKey);
    localStorage.setItem(`${LOCAL_MESSAGES_KEY}_${conversationKey}`, JSON.stringify([...list, message]));
    window.dispatchEvent(new Event('smart_radar_messages_updated'));
  } catch (e) {
    console.error('Failed to save message locally:', e);
  }
}

