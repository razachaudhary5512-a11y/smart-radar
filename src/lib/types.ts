export interface VerificationAuditItem {
  id: string;
  date: string;
  cnic_masked: string;
  status: 'valid' | 'due_soon' | 'expired';
  valid_until: string;
  notes: string;
}

export interface WatchedArea {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  radius_km: number;
  notify: boolean;
  notes?: string;
  created_at: string;
}

export interface Profile {
  id: string;
  phone: string;
  display_name: string;
  avatar_url: string | null;
  is_business: boolean;
  /** Set server-side only — never writable from client code */
  is_admin?: boolean;
  cnic_number: string | null;
  verification_status: 'pending' | 'approved' | 'rejected' | null;
  verification_date?: string;
  verification_expiry?: string;
  verification_history?: VerificationAuditItem[];
  trust_score: number;
  radius_km: number;
  saved_locations: SavedLocation[];
  watched_areas?: WatchedArea[];
  pinned_categories: string[];
  muted_categories: string[];
  digest_categories?: string[];
  digest_enabled?: boolean;
  digest_time?: string;
  blocked_users: string[];
  theme: 'light' | 'dark';
  created_at: string;
}

export interface SavedLocation {
  label: string;
  lat: number;
  lng: number;
}

export interface Post {
  id: string;
  user_id: string;
  category: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  image_urls: string[];
  lat: number;
  lng: number;
  location_label: string | null;
  status: 'active' | 'resolved' | 'expired';
  is_featured: boolean;
  women_only: boolean;
  expires_at: string | null;
  scheduled_for?: string | null;
  reposted_from_id?: string | null;
  confirm_count: number;
  resolve_count: number;
  report_count: number;
  upvotes: number;
  downvotes: number;
  created_at: string;
  updated_at: string;
}

export interface Vote {
  id: string;
  post_id: string;
  user_id: string;
  vote_type: 'up' | 'down';
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name?: string;
  author_avatar?: string | null;
}

export interface Bookmark {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
}

export interface Report {
  id: string;
  post_id: string;
  user_id: string;
  reason: string | null;
  created_at: string;
}

export interface Confirmation {
  id: string;
  post_id: string;
  user_id: string;
  confirmation_type: 'confirm' | 'resolve';
  created_at: string;
}

export interface PollOption {
  id: string;
  post_id: string;
  option_text: string;
  vote_count: number;
}

export interface PollVote {
  id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  type: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
}

export interface TrustedContact {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  created_at: string;
}

export interface EventRsvp {
  id: string;
  post_id: string;
  user_id: string;
  status: 'going' | 'interested';
  user_name: string;
  user_avatar?: string | null;
  created_at: string;
}

export interface PostWithRelations extends Post {
  author_name?: string;
  author_avatar?: string | null;
  author_is_verified?: boolean;
  author_verification_status?: 'valid' | 'due_soon' | 'expired';
  author_verification_expiry?: string;
  is_bookmarked?: boolean;
  user_vote?: 'up' | 'down' | null;
  poll_options?: PollOption[];
  user_poll_vote?: string | null;
  rsvp_count?: { going: number; interested: number };
  user_rsvp?: 'going' | 'interested' | null;
}

// ─── Admin types ──────────────────────────────────────────────────────────────

export interface AdminAuditLog {
  id: string;
  admin_id: string;
  action: string;
  target_type: 'post' | 'listing' | 'profile' | 'report';
  target_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface ProviderListing {
  id: string;
  user_id: string;
  business_name: string;
  category: string;
  description: string | null;
  phone: string | null;
  lat: number | null;
  lng: number | null;
  location_label: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface OtpRateLimit {
  id: string;
  phone: string;
  attempts: number;
  window_start: string;
  created_at: string;
}

