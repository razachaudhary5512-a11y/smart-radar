/**
 * The contract every backend implements. Screens only ever talk to this
 * interface (via `useApi()`), so switching between demo data and Supabase
 * never touches UI code.
 */
import type {
  AdminAuditLog,
  AdminOverview,
  AdminUser,
  AdminUserAction,
  AdminUserFilter,
  AppSettings,
  PostReport,
  Comment,
  EmergencyContact,
  EventRsvp,
  FeedQuery,
  NewPostInput,
  PostStatus,
  PostWithRelations,
  Profile,
  ProfilePatch,
  ProviderListing,
  TrustedContact,
  VerificationRequest,
} from '@/lib/types';

export type BackendMode = 'demo' | 'live';

export interface SessionUser {
  id: string;
  phone: string | null;
  email: string | null;
}

export interface AuthApi {
  getSession(): Promise<SessionUser | null>;
  onChange(cb: (user: SessionUser | null) => void): () => void;
  /** `devCode` is only returned in demo mode so the flow can be tried without SMS. */
  sendOtp(phoneE164: string, captchaToken?: string): Promise<{ error: string | null; devCode?: string }>;
  verifyOtp(phoneE164: string, code: string): Promise<{ error: string | null }>;
  /** Email one-time code (free alternative to SMS). */
  sendEmailOtp(email: string, captchaToken?: string): Promise<{ error: string | null; devCode?: string }>;
  verifyEmailOtp(email: string, code: string): Promise<{ error: string | null }>;
  adminSignIn(email: string, password: string, captchaToken?: string): Promise<{ error: string | null }>;
  signOut(): Promise<void>;
  /** Permanently deletes the signed-in user's account and everything they posted. */
  deleteMyAccount(): Promise<{ error: string | null }>;
  getProfile(userId: string): Promise<Profile | null>;
  updateProfile(userId: string, patch: ProfilePatch): Promise<void>;
  submitVerification(userId: string, cnic: string, isBusiness: boolean): Promise<void>;
}

export interface ListingInput {
  business_name: string;
  category: string;
  description: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  location_label: string;
}

export type ModerationAction = 'approve' | 'hide' | 'delete' | 'feature' | 'unfeature';

export interface AdminApi {
  overview(): Promise<AdminOverview>;
  listPosts(filter: 'reported' | 'hidden' | 'all', search?: string): Promise<PostWithRelations[]>;
  moderatePost(adminId: string, postId: string, action: ModerationAction, reason?: string): Promise<void>;
  verificationQueue(): Promise<VerificationRequest[]>;
  reviewVerification(adminId: string, userId: string, decision: 'approved' | 'rejected', notes: string, expiry: string | null): Promise<void>;
  listListings(status?: ProviderListing['status']): Promise<ProviderListing[]>;
  reviewListing(adminId: string, id: string, decision: 'approved' | 'rejected', notes: string): Promise<void>;
  upsertEmergencyContact(adminId: string, c: Omit<EmergencyContact, 'id' | 'created_at'> & { id?: string }): Promise<void>;
  deleteEmergencyContact(adminId: string, id: string): Promise<void>;
  auditLog(): Promise<AdminAuditLog[]>;
  listUsers(search: string, filter: AdminUserFilter): Promise<AdminUser[]>;
  updateUser(adminId: string, userId: string, action: AdminUserAction, value?: number, reason?: string): Promise<void>;
  postReports(postId: string): Promise<PostReport[]>;
  /** Owner only. */
  updateSettings(ownerId: string, patch: Partial<AppSettings>): Promise<void>;
  /** Owner only — appoint or remove an admin. */
  setAdmin(ownerId: string, userId: string, isAdmin: boolean): Promise<void>;
}

export interface DataApi {
  mode: BackendMode;
  auth: AuthApi;
  admin: AdminApi;

  listPosts(q: FeedQuery, viewerId?: string | null): Promise<PostWithRelations[]>;
  getPost(id: string, viewerId?: string | null): Promise<PostWithRelations | null>;
  listUserPosts(userId: string): Promise<PostWithRelations[]>;
  listBookmarks(userId: string): Promise<PostWithRelations[]>;
  createPost(userId: string, input: NewPostInput): Promise<PostWithRelations>;
  updatePost(userId: string, id: string, patch: Partial<NewPostInput> & { status?: PostStatus }): Promise<void>;
  deletePost(userId: string, id: string): Promise<void>;

  setVote(userId: string, postId: string, vote: 'up' | 'down' | null): Promise<void>;
  toggleBookmark(userId: string, postId: string): Promise<boolean>;
  setConfirmation(userId: string, postId: string, type: 'confirm' | 'resolve'): Promise<void>;
  reportPost(userId: string, postId: string, reason: string): Promise<void>;

  listComments(postId: string): Promise<Comment[]>;
  addComment(userId: string, postId: string, body: string): Promise<Comment>;
  deleteComment(userId: string, commentId: string): Promise<void>;

  votePoll(userId: string, postId: string, optionId: string): Promise<void>;
  setRsvp(userId: string, postId: string, status: 'going' | 'interested' | null): Promise<void>;
  listRsvps(postId: string): Promise<EventRsvp[]>;

  uploadImages(userId: string, files: File[]): Promise<string[]>;

  listEmergencyContacts(): Promise<EmergencyContact[]>;
  listTrustedContacts(userId: string): Promise<TrustedContact[]>;
  addTrustedContact(userId: string, name: string, phone: string): Promise<void>;
  removeTrustedContact(userId: string, id: string): Promise<void>;

  submitListing(userId: string, input: ListingInput): Promise<void>;
  listMyListings(userId: string): Promise<ProviderListing[]>;
  /** Approved, admin-reviewed business listings (public directory). */
  listProviders(): Promise<ProviderListing[]>;
  /** App-wide settings (public read). */
  getSettings(): Promise<AppSettings>;
}

/** Shared post-processing: distance, radius filter, expiry, sorting. */
export { finalizeFeed } from './feed';
