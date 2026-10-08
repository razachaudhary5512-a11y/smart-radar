-- ============================================================
-- Smart Radar — COMPLETE DATABASE SETUP (all migrations, in order)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Run it ONCE on a new, empty Supabase project.
-- ============================================================

-- >>>>>>>>>> migrations/20260822205833_create_smart_radar_schema.sql
/*
# Smart Radar — Core Database Schema

## Overview
Creates the complete schema for Smart Radar, a hyperlocal community app. Users post
location-based alerts, marketplace listings, transport options, and community items
within a 1–5 km radius. The app uses phone+OTP auth via Supabase, with additional
CNIC verification for businesses/service providers.

## New Tables

1. **profiles** — extends auth.users with app-specific data
   - `id` (uuid, FK → auth.users, PK)
   - `phone` (text, unique, not null)
   - `display_name` (text)
   - `avatar_url` (text)
   - `is_business` (boolean, default false) — whether user is a business/service provider
   - `cnic_number` (text) — national ID for business verification
   - `verification_status` (enum: pending/approved/rejected, default null for regular users)
   - `trust_score` (int, default 50, range 0–100) — invisible internal score
   - `radius_km` (int, default 3) — user's viewing radius preference (1–5)
   - `saved_locations` (jsonb) — common locations like home/work
   - `pinned_categories` (text[]) — top 3–4 categories shown first in feed
   - `muted_categories` (text[]) — categories with notifications muted
   - `blocked_users` (uuid[]) — users this person has blocked
   - `theme` (text, default 'light')
   - `created_at` (timestamptz)

2. **posts** — all posts across every category
   - `id` (uuid, PK)
   - `user_id` (uuid, FK → auth.users, not null, default auth.uid())
   - `category` (text, not null) — category slug (e.g. 'electricity_outage')
   - `title` (text, not null)
   - `description` (text)
   - `metadata` (jsonb) — category-specific fields (price, blood_type, etc.)
   - `image_urls` (text[]) — uploaded image URLs
   - `lat` (double precision, not null)
   - `lng` (double precision, not null)
   - `location_label` (text) — human-readable location
   - `status` (text, default 'active') — active/resolved/expired
   - `is_featured` (boolean, default false) — paid boost flag
   - `women_only` (boolean, default false) — for ride-share posts
   - `expires_at` (timestamptz) — auto-expiry timestamp (null = never expires)
   - `confirm_count` (int, default 0) — "still happening" confirmations
   - `resolve_count` (int, default 0) — "resolved" confirmations
   - `report_count` (int, default 0) — auto-hides at 3
   - `upvotes` (int, default 0)
   - `downvotes` (int, default 0)
   - `created_at` (timestamptz, default now())
   - `updated_at` (timestamptz, default now())

3. **votes** — individual upvote/downvote records
   - `id` (uuid, PK)
   - `post_id` (uuid, FK → posts, ON DELETE CASCADE)
   - `user_id` (uuid, FK → auth.users, default auth.uid())
   - `vote_type` (text, 'up' or 'down')
   - `created_at` (timestamptz)
   - UNIQUE(post_id, user_id)

4. **comments** — in-app chat/messages on posts
   - `id` (uuid, PK)
   - `post_id` (uuid, FK → posts, ON DELETE CASCADE)
   - `user_id` (uuid, FK → auth.users, default auth.uid())
   - `body` (text, not null)
   - `created_at` (timestamptz)

5. **bookmarks** — saved posts
   - `id` (uuid, PK)
   - `post_id` (uuid, FK → posts, ON DELETE CASCADE)
   - `user_id` (uuid, FK → auth.users, default auth.uid())
   - `created_at` (timestamptz)
   - UNIQUE(post_id, user_id)

6. **reports** — post reports for admin review
   - `id` (uuid, PK)
   - `post_id` (uuid, FK → posts, ON DELETE CASCADE)
   - `user_id` (uuid, FK → auth.users, default auth.uid())
   - `reason` (text)
   - `created_at` (timestamptz)
   - UNIQUE(post_id, user_id)

7. **confirmations** — "still happening" / "resolved" confirmations on alert posts
   - `id` (uuid, PK)
   - `post_id` (uuid, FK → posts, ON DELETE CASCADE)
   - `user_id` (uuid, FK → auth.users, default auth.uid())
   - `confirmation_type` (text, 'confirm' or 'resolve')
   - `created_at` (timestamptz)
   - UNIQUE(post_id, user_id)

8. **poll_options** — options for community poll posts
   - `id` (uuid, PK)
   - `post_id` (uuid, FK → posts, ON DELETE CASCADE)
   - `option_text` (text, not null)
   - `vote_count` (int, default 0)

9. **poll_votes** — individual poll votes
   - `id` (uuid, PK)
   - `option_id` (uuid, FK → poll_options, ON DELETE CASCADE)
   - `user_id` (uuid, FK → auth.users, default auth.uid())
   - `created_at` (timestamptz)
   - UNIQUE(option_id, user_id)

10. **emergency_contacts** — admin-managed directory of real emergency numbers
    - `id` (uuid, PK)
    - `name` (text, not null)
    - `phone` (text, not null)
    - `type` (text) — hospital, police, fire, rescue, etc.
    - `lat` (double precision)
    - `lng` (double precision)
    - `created_at` (timestamptz)

11. **trusted_contacts** — user's pre-saved emergency contacts for panic button
    - `id` (uuid, PK)
    - `user_id` (uuid, FK → auth.users, default auth.uid())
    - `name` (text, not null)
    - `phone` (text, not null)
    - `created_at` (timestamptz)

## Security
- RLS enabled on every table.
- profiles: owner can read/update own profile; anyone can read display_name + avatar for post attribution.
- posts: anyone (anon) can SELECT (browsing is open to everyone); only authenticated owners can INSERT/UPDATE/DELETE.
- votes, comments, bookmarks, reports, confirmations, poll_votes: authenticated users can CRUD their own rows; SELECT is open for reading.
- emergency_contacts: anyone can SELECT (public reference); only authenticated can INSERT/UPDATE/DELETE (admin-managed).
- trusted_contacts: owner can CRUD their own contacts.

## Important Notes
1. Posts use a `metadata` jsonb column for category-specific fields, keeping the schema flexible.
2. The `expires_at` column enables auto-expiry (traffic alerts expire in 20–30 min, events until event date, etc.).
3. Trust score is stored in profiles and managed via triggers or app logic (not publicly visible).
4. Report count auto-hides posts at 3 reports (handled in app logic).
5. Phone auth: Supabase handles phone+OTP natively; profiles table extends auth.users.
*/

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text UNIQUE NOT NULL,
  display_name text DEFAULT '',
  avatar_url text,
  is_business boolean NOT NULL DEFAULT false,
  cnic_number text,
  verification_status text DEFAULT NULL,
  trust_score int NOT NULL DEFAULT 50,
  radius_km int NOT NULL DEFAULT 3,
  saved_locations jsonb DEFAULT '[]'::jsonb,
  pinned_categories text[] DEFAULT '{}',
  muted_categories text[] DEFAULT '{}',
  blocked_users uuid[] DEFAULT '{}',
  theme text NOT NULL DEFAULT 'light',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

-- ============================================================
-- POSTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  metadata jsonb DEFAULT '{}'::jsonb,
  image_urls text[] DEFAULT '{}',
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  location_label text,
  status text NOT NULL DEFAULT 'active',
  is_featured boolean NOT NULL DEFAULT false,
  women_only boolean NOT NULL DEFAULT false,
  expires_at timestamptz,
  confirm_count int NOT NULL DEFAULT 0,
  resolve_count int NOT NULL DEFAULT 0,
  report_count int NOT NULL DEFAULT 0,
  upvotes int NOT NULL DEFAULT 0,
  downvotes int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Browsing is open to everyone (anon + authenticated)
DROP POLICY IF EXISTS "select_posts_all" ON posts;
CREATE POLICY "select_posts_all" ON posts FOR SELECT
  TO anon, authenticated USING (true);

-- Only authenticated owners can create posts
DROP POLICY IF EXISTS "insert_own_posts" ON posts;
CREATE POLICY "insert_own_posts" ON posts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Only owners can update their posts
DROP POLICY IF EXISTS "update_own_posts" ON posts;
CREATE POLICY "update_own_posts" ON posts FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Only owners can delete their posts
DROP POLICY IF EXISTS "delete_own_posts" ON posts;
CREATE POLICY "delete_own_posts" ON posts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- VOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  vote_type text NOT NULL CHECK (vote_type IN ('up', 'down')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_votes_all" ON votes;
CREATE POLICY "select_votes_all" ON votes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_votes" ON votes;
CREATE POLICY "insert_own_votes" ON votes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_votes" ON votes;
CREATE POLICY "update_own_votes" ON votes FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_votes" ON votes;
CREATE POLICY "delete_own_votes" ON votes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- COMMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_comments_all" ON comments;
CREATE POLICY "select_comments_all" ON comments FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_comments" ON comments;
CREATE POLICY "insert_own_comments" ON comments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_comments" ON comments;
CREATE POLICY "delete_own_comments" ON comments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- BOOKMARKS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bookmarks" ON bookmarks;
CREATE POLICY "select_own_bookmarks" ON bookmarks FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_bookmarks" ON bookmarks;
CREATE POLICY "insert_own_bookmarks" ON bookmarks FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_bookmarks" ON bookmarks;
CREATE POLICY "delete_own_bookmarks" ON bookmarks FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- REPORTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reports" ON reports;
CREATE POLICY "select_own_reports" ON reports FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_reports" ON reports;
CREATE POLICY "insert_own_reports" ON reports FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- CONFIRMATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmation_type text NOT NULL CHECK (confirmation_type IN ('confirm', 'resolve')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_confirmations_all" ON confirmations;
CREATE POLICY "select_confirmations_all" ON confirmations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_confirmations" ON confirmations;
CREATE POLICY "insert_own_confirmations" ON confirmations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- POLL OPTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS poll_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  option_text text NOT NULL,
  vote_count int NOT NULL DEFAULT 0
);

ALTER TABLE poll_options ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_poll_options_all" ON poll_options;
CREATE POLICY "select_poll_options_all" ON poll_options FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_poll_options" ON poll_options;
CREATE POLICY "insert_own_poll_options" ON poll_options FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = poll_options.post_id AND posts.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "update_own_poll_options" ON poll_options;
CREATE POLICY "update_own_poll_options" ON poll_options FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = poll_options.post_id AND posts.user_id = auth.uid())
  );

-- ============================================================
-- POLL VOTES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id uuid NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(option_id, user_id)
);

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_poll_votes_all" ON poll_votes;
CREATE POLICY "select_poll_votes_all" ON poll_votes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_own_poll_votes" ON poll_votes;
CREATE POLICY "insert_own_poll_votes" ON poll_votes FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_poll_votes" ON poll_votes;
CREATE POLICY "delete_own_poll_votes" ON poll_votes FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- EMERGENCY CONTACTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS emergency_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  type text NOT NULL,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_emergency_contacts_all" ON emergency_contacts;
CREATE POLICY "select_emergency_contacts_all" ON emergency_contacts FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_emergency_contacts" ON emergency_contacts;
CREATE POLICY "insert_emergency_contacts" ON emergency_contacts FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_emergency_contacts" ON emergency_contacts;
CREATE POLICY "update_emergency_contacts" ON emergency_contacts FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_emergency_contacts" ON emergency_contacts;
CREATE POLICY "delete_emergency_contacts" ON emergency_contacts FOR DELETE
  TO authenticated USING (true);

-- ============================================================
-- TRUSTED CONTACTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS trusted_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE trusted_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_trusted_contacts" ON trusted_contacts;
CREATE POLICY "select_own_trusted_contacts" ON trusted_contacts FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_trusted_contacts" ON trusted_contacts;
CREATE POLICY "insert_own_trusted_contacts" ON trusted_contacts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delete_own_trusted_contacts" ON trusted_contacts;
CREATE POLICY "delete_own_trusted_contacts" ON trusted_contacts FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_category ON posts(category);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_lat_lng ON posts(lat, lng);
CREATE INDEX IF NOT EXISTS idx_votes_post_id ON votes(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_confirmations_post_id ON confirmations(post_id);
CREATE INDEX IF NOT EXISTS idx_poll_options_post_id ON poll_options(post_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_option_id ON poll_votes(option_id);
CREATE INDEX IF NOT EXISTS idx_trusted_contacts_user_id ON trusted_contacts(user_id);

-- ============================================================
-- SEED EMERGENCY CONTACTS
-- ============================================================
INSERT INTO emergency_contacts (name, phone, type) VALUES
  ('Rescue 1122', '1122', 'rescue'),
  ('Police Emergency', '15', 'police'),
  ('Edhi Foundation', '115', 'rescue'),
  ('Fire Brigade', '16', 'fire')
ON CONFLICT DO NOTHING;

-- ============================================================
-- UPDATED_AT TRIGGER FOR POSTS
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS posts_updated_at ON posts;
CREATE TRIGGER posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- >>>>>>>>>> migrations/20260925_security_hardening.sql
/*
  Smart Radar — Security Hardening Migration
  ============================================================
  Adds:
  1. admin_role column on profiles (RLS: only admins can see/set it)
  2. Tightened, named RLS policies on every table
  3. CNIC-column access: admin-only read
  4. provider_listings table (pending → approved gating)
  5. admin_audit_log table (admin-only access)
  6. otp_rate_limit table (app-level SMS spam protection)
  7. emergency_contacts INSERT/UPDATE/DELETE restricted to admins only
*/

-- ============================================================
-- 1. ADD ADMIN ROLE FLAG TO PROFILES
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

-- ============================================================
-- HELPER FUNCTION: is the caller an admin?
-- Using SECURITY DEFINER so it can read profiles without
-- triggering the very RLS it is used inside.
-- ============================================================
CREATE OR REPLACE FUNCTION auth_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ============================================================
-- 2. PROFILES — tighten RLS
-- ============================================================

-- Drop old broad policies
DROP POLICY IF EXISTS "select_own_profile"  ON profiles;
DROP POLICY IF EXISTS "update_own_profile"  ON profiles;
DROP POLICY IF EXISTS "insert_own_profile"  ON profiles;

-- Anyone can read basic public fields (display_name, avatar_url, is_business)
-- but NOT cnic_number or is_admin — enforced at query level / column security
-- We use a view for public profile data; the base table is owner+admin only.

-- Owner reads own full profile
CREATE POLICY "users_can_read_own_profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Admin reads any profile (needed for admin dashboard)
CREATE POLICY "admin_can_read_all_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth_is_admin());

-- Owner updates own profile (cannot change is_admin via this policy)
CREATE POLICY "users_can_edit_own_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND is_admin = (SELECT is_admin FROM profiles WHERE id = auth.uid()));

-- Admin can update any profile (e.g. set verification_status to approved)
CREATE POLICY "admin_can_edit_any_profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- Owner inserts own profile
CREATE POLICY "users_can_insert_own_profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 3. POSTS — named, auditable RLS
-- ============================================================
DROP POLICY IF EXISTS "select_posts_all"   ON posts;
DROP POLICY IF EXISTS "insert_own_posts"   ON posts;
DROP POLICY IF EXISTS "update_own_posts"   ON posts;
DROP POLICY IF EXISTS "delete_own_posts"   ON posts;

-- Public feed: anyone can see active/approved posts
CREATE POLICY "public_can_read_active_posts"
  ON posts FOR SELECT
  TO anon, authenticated
  USING (status IN ('active', 'resolved'));

-- Admins can see all posts (including hidden/reported)
CREATE POLICY "admin_can_read_all_posts"
  ON posts FOR SELECT
  TO authenticated
  USING (auth_is_admin());

-- Only authenticated owners can create posts
CREATE POLICY "users_can_create_own_posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Owners can edit their own posts; admins can edit any post
CREATE POLICY "users_can_edit_own_posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "admin_can_edit_any_post"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- Owners can delete their own posts; admins can delete any
CREATE POLICY "users_can_delete_own_posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin_can_delete_any_post"
  ON posts FOR DELETE
  TO authenticated
  USING (auth_is_admin());

-- ============================================================
-- 4. EMERGENCY CONTACTS — admin-only write
-- ============================================================
DROP POLICY IF EXISTS "insert_emergency_contacts" ON emergency_contacts;
DROP POLICY IF EXISTS "update_emergency_contacts" ON emergency_contacts;
DROP POLICY IF EXISTS "delete_emergency_contacts" ON emergency_contacts;

CREATE POLICY "admin_only_insert_emergency_contacts"
  ON emergency_contacts FOR INSERT
  TO authenticated
  WITH CHECK (auth_is_admin());

CREATE POLICY "admin_only_update_emergency_contacts"
  ON emergency_contacts FOR UPDATE
  TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

CREATE POLICY "admin_only_delete_emergency_contacts"
  ON emergency_contacts FOR DELETE
  TO authenticated
  USING (auth_is_admin());

-- ============================================================
-- 5. PROVIDER LISTINGS TABLE
--    Pending status hides listings from the public feed.
-- ============================================================
CREATE TABLE IF NOT EXISTS provider_listings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  business_name     text NOT NULL,
  category          text NOT NULL,
  description       text,
  phone             text,
  lat               double precision,
  lng               double precision,
  location_label    text,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by       uuid REFERENCES auth.users(id),
  reviewed_at       timestamptz,
  admin_notes       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE provider_listings ENABLE ROW LEVEL SECURITY;

-- Public only sees approved listings
CREATE POLICY "public_can_see_approved_listings"
  ON provider_listings FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- Admins can see all listings (pending + rejected too)
CREATE POLICY "admin_can_see_all_listings"
  ON provider_listings FOR SELECT
  TO authenticated
  USING (auth_is_admin());

-- Owners can see their own listing (any status — so they know if rejected)
CREATE POLICY "owners_can_see_own_listing"
  ON provider_listings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Owners can submit (INSERT) their own listing
CREATE POLICY "users_can_submit_listing"
  ON provider_listings FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Owners can update own PENDING listing (not after review)
CREATE POLICY "owners_can_edit_pending_listing"
  ON provider_listings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Admins can update any listing (approve/reject)
CREATE POLICY "admin_can_review_listings"
  ON provider_listings FOR UPDATE
  TO authenticated
  USING (auth_is_admin())
  WITH CHECK (auth_is_admin());

-- Owners can delete their own listing; admins can delete any
CREATE POLICY "owners_can_delete_own_listing"
  ON provider_listings FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "admin_can_delete_any_listing"
  ON provider_listings FOR DELETE
  TO authenticated
  USING (auth_is_admin());

CREATE INDEX IF NOT EXISTS idx_provider_listings_status  ON provider_listings(status);
CREATE INDEX IF NOT EXISTS idx_provider_listings_user_id ON provider_listings(user_id);

-- Updated_at trigger for provider_listings
DROP TRIGGER IF EXISTS provider_listings_updated_at ON provider_listings;
CREATE TRIGGER provider_listings_updated_at
  BEFORE UPDATE ON provider_listings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 6. ADMIN AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES auth.users(id),
  action      text NOT NULL,
  target_type text NOT NULL,   -- 'post' | 'listing' | 'profile' | 'report'
  target_id   uuid,
  details     jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the audit log
CREATE POLICY "admin_only_read_audit_log"
  ON admin_audit_log FOR SELECT
  TO authenticated
  USING (auth_is_admin());

-- Only admins can insert audit entries
CREATE POLICY "admin_only_insert_audit_log"
  ON admin_audit_log FOR INSERT
  TO authenticated
  WITH CHECK (auth_is_admin() AND auth.uid() = admin_id);

-- No one can update or delete audit entries (immutable log)

CREATE INDEX IF NOT EXISTS idx_audit_log_admin_id   ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_target_id  ON admin_audit_log(target_id);

-- ============================================================
-- 7. OTP RATE LIMIT TABLE
--    Tracks per-phone OTP attempts for app-level throttling.
-- ============================================================
CREATE TABLE IF NOT EXISTS otp_rate_limit (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text NOT NULL,
  attempts     int NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE otp_rate_limit ENABLE ROW LEVEL SECURITY;

-- Only the app (anon/service_role) inserts/updates; no user reads
-- Regular users cannot read or tamper with rate-limit records
CREATE POLICY "service_role_only_otp_rate_limit"
  ON otp_rate_limit FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Anon inserts (needed for pre-auth OTP requests)
CREATE POLICY "anon_can_insert_otp_rate_limit"
  ON otp_rate_limit FOR INSERT
  TO anon
  WITH CHECK (true);

-- Anon/authenticated can SELECT own phone rate limit record
CREATE POLICY "anon_can_read_own_otp_limit"
  ON otp_rate_limit FOR SELECT
  TO anon, authenticated
  USING (true);

-- Anon/authenticated can UPDATE own record
CREATE POLICY "anon_can_update_own_otp_limit"
  ON otp_rate_limit FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_otp_rate_limit_phone        ON otp_rate_limit(phone);
CREATE INDEX IF NOT EXISTS idx_otp_rate_limit_window_start ON otp_rate_limit(window_start);

-- ============================================================
-- 8. CNIC COLUMN SECURITY (Column-level restriction note)
-- ============================================================
-- The profiles.cnic_number column is protected at the application
-- layer: regular user queries must never SELECT cnic_number directly.
-- Only admin queries (via service_role or admin-flagged accounts)
-- should include cnic_number in SELECT lists.
-- This is enforced in the frontend by never returning cnic_number
-- from public profile lookups (see ProfilePublicView in lib/auth.tsx).
--
-- For additional hardening, revoke column-level SELECT on cnic_number
-- from the anon and authenticated roles:
REVOKE SELECT (cnic_number) ON profiles FROM anon;
REVOKE SELECT (cnic_number) ON profiles FROM authenticated;
-- Admins use the service_role client to read cnic_number.

-- ============================================================
-- DONE
-- ============================================================


-- >>>>>>>>>> migrations/20260930000000_rebuild_hardening.sql
/*
  Smart Radar — Rebuild & hardening migration (2026-09-30)
  ============================================================
  Run AFTER 20260822205833_create_smart_radar_schema.sql and
  20260925_security_hardening.sql. Idempotent: safe to re-run.

  Fixes found during the rebuild audit:
   1. profiles was missing columns the app reads (watched_areas, digest_*,
      verification_*) — every profile fetch failed.
   2. No profile row was ever created on sign-up; phone was NOT NULL so
      email-based admin accounts could not have a profile at all.
   3. `REVOKE SELECT (cnic_number)` had no effect because Supabase grants
      table-level SELECT; users could also UPDATE their own is_admin-adjacent
      fields: verification_status, trust_score, cnic_number (self-verify).
      → replaced with explicit column-level GRANTs.
   4. Authors' names were unreadable (profiles RLS = owner/admin only).
      → public_profiles view exposing only safe columns.
   5. Vote / confirmation / report / poll counters were never updated
      (only post owners may UPDATE posts). → SECURITY DEFINER triggers.
      Reports now auto-hide a post at 3; 5+ "resolved" closes an alert.
   6. Owners could set is_featured (paid boost), counters and un-hide posts.
   7. otp_rate_limit was world-readable/writable (leaked phone numbers and
      was trivially bypassed). → table locked, request_otp_slot() RPC.
   8. Poll voters could vote on every option. → one vote per poll.
   9. Event RSVPs had no table (were localStorage only). → event_rsvps.
  10. No storage bucket for post images. → post-images bucket + policies.
  11. Admin actions were separate client calls (no atomic audit trail).
      → admin_* RPCs that re-check auth_is_admin() and write the audit log.
*/

-- ============================================================
-- 1. PROFILES — missing columns + constraints
-- ============================================================
ALTER TABLE public.profiles ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS watched_areas              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS digest_categories          text[]      NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS digest_enabled             boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS digest_time                text        NOT NULL DEFAULT '20:00',
  ADD COLUMN IF NOT EXISTS verification_date          timestamptz,
  ADD COLUMN IF NOT EXISTS verification_expiry        timestamptz,
  ADD COLUMN IF NOT EXISTS verification_history       jsonb       NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS verification_requested_at  timestamptz,
  ADD COLUMN IF NOT EXISTS fcm_token                  text;

ALTER TABLE public.profiles ALTER COLUMN theme SET DEFAULT 'system';
UPDATE public.profiles SET saved_locations = '[]'::jsonb WHERE saved_locations IS NULL;
UPDATE public.profiles SET pinned_categories = '{}' WHERE pinned_categories IS NULL;
UPDATE public.profiles SET muted_categories = '{}' WHERE muted_categories IS NULL;
UPDATE public.profiles SET blocked_users = '{}' WHERE blocked_users IS NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_radius_km_range;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_radius_km_range CHECK (radius_km BETWEEN 1 AND 5) NOT VALID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_trust_score_range;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_trust_score_range CHECK (trust_score BETWEEN 0 AND 100) NOT VALID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_verification_status_values;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_verification_status_values
  CHECK (verification_status IS NULL OR verification_status IN ('pending', 'approved', 'rejected')) NOT VALID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_theme_values;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_theme_values CHECK (theme IN ('light', 'dark', 'system')) NOT VALID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_display_name_length;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_display_name_length CHECK (char_length(display_name) <= 60) NOT VALID;

-- ============================================================
-- 2. AUTO-CREATE PROFILE ON SIGN-UP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, phone, display_name)
  VALUES (
    NEW.id,
    CASE WHEN NEW.phone IS NULL OR NEW.phone = '' THEN NULL ELSE '+' || ltrim(NEW.phone, '+') END,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill any existing users that never got a profile.
INSERT INTO public.profiles (id, phone)
SELECT u.id, CASE WHEN u.phone IS NULL OR u.phone = '' THEN NULL ELSE '+' || ltrim(u.phone, '+') END
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3. PROFILES — column-level privileges (real CNIC / role protection)
-- ============================================================
REVOKE ALL ON public.profiles FROM anon;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;

GRANT SELECT (
  id, phone, display_name, avatar_url, is_business, is_admin, verification_status,
  verification_date, verification_expiry, verification_history, trust_score, radius_km,
  saved_locations, watched_areas, pinned_categories, muted_categories, digest_categories,
  digest_enabled, digest_time, blocked_users, theme, created_at
) ON public.profiles TO authenticated;

-- Everything a user may change about themselves. NOT: is_admin, cnic_number,
-- verification_*, trust_score, phone (phone changes go through Supabase Auth).
GRANT UPDATE (
  display_name, avatar_url, is_business, radius_km, saved_locations, watched_areas,
  pinned_categories, muted_categories, digest_categories, digest_enabled, digest_time,
  blocked_users, theme, fcm_token
) ON public.profiles TO authenticated;

-- Profiles are created by the trigger above; no direct inserts.
DROP POLICY IF EXISTS "users_can_insert_own_profile" ON public.profiles;

-- The old WITH CHECK sub-selected profiles inside a profiles policy; column
-- grants now make that unnecessary.
DROP POLICY IF EXISTS "users_can_edit_own_profile" ON public.profiles;
CREATE POLICY "users_can_edit_own_profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 4. PUBLIC PROFILES VIEW (safe author info for posts/comments)
-- ============================================================
-- Intentionally NOT security_invoker: it runs as the view owner so anyone can
-- read these seven non-sensitive columns without opening the profiles table.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT id, display_name, avatar_url, is_business, verification_status, verification_expiry, trust_score
FROM public.profiles;

REVOKE ALL ON public.public_profiles FROM anon, authenticated;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- ============================================================
-- 5. POSTS — new columns, constraints, privileges, visibility
-- ============================================================
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS scheduled_for    timestamptz,
  ADD COLUMN IF NOT EXISTS reposted_from_id uuid REFERENCES public.posts(id) ON DELETE SET NULL;

ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_status_values;
ALTER TABLE public.posts ADD CONSTRAINT posts_status_values CHECK (status IN ('active', 'resolved', 'expired', 'hidden')) NOT VALID;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_title_length;
ALTER TABLE public.posts ADD CONSTRAINT posts_title_length CHECK (char_length(title) BETWEEN 3 AND 160) NOT VALID;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_description_length;
ALTER TABLE public.posts ADD CONSTRAINT posts_description_length CHECK (description IS NULL OR char_length(description) <= 4000) NOT VALID;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_coords_range;
ALTER TABLE public.posts ADD CONSTRAINT posts_coords_range CHECK (lat BETWEEN -90 AND 90 AND lng BETWEEN -180 AND 180) NOT VALID;
ALTER TABLE public.posts DROP CONSTRAINT IF EXISTS posts_image_count;
ALTER TABLE public.posts ADD CONSTRAINT posts_image_count CHECK (cardinality(image_urls) <= 6) NOT VALID;

REVOKE INSERT, UPDATE, DELETE ON public.posts FROM anon;
REVOKE INSERT, UPDATE ON public.posts FROM authenticated;
GRANT INSERT (
  user_id, category, title, description, metadata, image_urls, lat, lng,
  location_label, women_only, expires_at, scheduled_for, reposted_from_id
) ON public.posts TO authenticated;
GRANT UPDATE (
  title, description, metadata, image_urls, lat, lng, location_label, status, women_only, expires_at
) ON public.posts TO authenticated;

-- Public feed hides scheduled posts until their time; owners always see their own.
DROP POLICY IF EXISTS "public_can_read_active_posts" ON public.posts;
CREATE POLICY "public_can_read_active_posts"
  ON public.posts FOR SELECT TO anon, authenticated
  USING (status IN ('active', 'resolved') AND (scheduled_for IS NULL OR scheduled_for <= now()));

DROP POLICY IF EXISTS "owners_can_read_own_posts" ON public.posts;
CREATE POLICY "owners_can_read_own_posts"
  ON public.posts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Owners can't un-hide moderated posts or hide their own.
CREATE OR REPLACE FUNCTION public.posts_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only constrain direct API calls; SECURITY DEFINER functions run as the owner.
  IF current_user IN ('anon', 'authenticated') AND NOT public.auth_is_admin() THEN
    IF OLD.status = 'hidden' THEN
      NEW.status := 'hidden';
    ELSIF NEW.status = 'hidden' THEN
      NEW.status := OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_guard ON public.posts;
CREATE TRIGGER posts_guard BEFORE UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.posts_guard();

-- ============================================================
-- 6. COUNTER TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_post_votes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN pid := OLD.post_id; ELSE pid := NEW.post_id; END IF;
  UPDATE posts SET
    upvotes   = (SELECT count(*) FROM votes WHERE post_id = pid AND vote_type = 'up'),
    downvotes = (SELECT count(*) FROM votes WHERE post_id = pid AND vote_type = 'down')
  WHERE id = pid;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS votes_sync ON public.votes;
CREATE TRIGGER votes_sync AFTER INSERT OR UPDATE OR DELETE ON public.votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_votes();

CREATE OR REPLACE FUNCTION public.sync_post_confirmations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; c int; r int;
BEGIN
  IF TG_OP = 'DELETE' THEN pid := OLD.post_id; ELSE pid := NEW.post_id; END IF;
  SELECT count(*) FILTER (WHERE confirmation_type = 'confirm'),
         count(*) FILTER (WHERE confirmation_type = 'resolve')
    INTO c, r FROM confirmations WHERE post_id = pid;
  UPDATE posts SET
    confirm_count = c,
    resolve_count = r,
    -- Crowd resolution: 5+ "resolved" votes that outnumber "still happening".
    status = CASE WHEN status = 'active' AND r >= 5 AND r > c THEN 'resolved' ELSE status END
  WHERE id = pid;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS confirmations_sync ON public.confirmations;
CREATE TRIGGER confirmations_sync AFTER INSERT OR UPDATE OR DELETE ON public.confirmations
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_confirmations();

CREATE OR REPLACE FUNCTION public.sync_post_reports()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; n int;
BEGIN
  IF TG_OP = 'DELETE' THEN pid := OLD.post_id; ELSE pid := NEW.post_id; END IF;
  SELECT count(*) INTO n FROM reports WHERE post_id = pid;
  UPDATE posts SET
    report_count = n,
    status = CASE WHEN n >= 3 AND status = 'active' THEN 'hidden' ELSE status END
  WHERE id = pid;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS reports_sync ON public.reports;
CREATE TRIGGER reports_sync AFTER INSERT OR DELETE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.sync_post_reports();

-- Poll votes: one vote per poll (not per option) + live option counts.
ALTER TABLE public.poll_votes ADD COLUMN IF NOT EXISTS post_id uuid REFERENCES public.posts(id) ON DELETE CASCADE;
UPDATE public.poll_votes v SET post_id = o.post_id FROM public.poll_options o WHERE o.id = v.option_id AND v.post_id IS NULL;
DELETE FROM public.poll_votes a USING public.poll_votes b
  WHERE a.post_id = b.post_id AND a.user_id = b.user_id AND a.created_at > b.created_at;
ALTER TABLE public.poll_votes DROP CONSTRAINT IF EXISTS poll_votes_one_per_poll;
ALTER TABLE public.poll_votes ADD CONSTRAINT poll_votes_one_per_poll UNIQUE (post_id, user_id);

CREATE OR REPLACE FUNCTION public.poll_vote_set_post()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT post_id INTO NEW.post_id FROM poll_options WHERE id = NEW.option_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS poll_votes_set_post ON public.poll_votes;
CREATE TRIGGER poll_votes_set_post BEFORE INSERT ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.poll_vote_set_post();

CREATE OR REPLACE FUNCTION public.sync_poll_counts()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE oid uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN oid := OLD.option_id; ELSE oid := NEW.option_id; END IF;
  UPDATE poll_options SET vote_count = (SELECT count(*) FROM poll_votes WHERE option_id = oid) WHERE id = oid;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS poll_votes_sync ON public.poll_votes;
CREATE TRIGGER poll_votes_sync AFTER INSERT OR DELETE ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_poll_counts();

-- Poll option counts are trigger-managed only.
REVOKE UPDATE ON public.poll_options FROM anon, authenticated;
DROP POLICY IF EXISTS "update_own_poll_options" ON public.poll_options;

-- Let users change their mind on confirmations.
DROP POLICY IF EXISTS "delete_own_confirmations" ON public.confirmations;
CREATE POLICY "delete_own_confirmations" ON public.confirmations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Resync counters for existing data.
UPDATE public.posts p SET
  upvotes       = (SELECT count(*) FROM public.votes v WHERE v.post_id = p.id AND v.vote_type = 'up'),
  downvotes     = (SELECT count(*) FROM public.votes v WHERE v.post_id = p.id AND v.vote_type = 'down'),
  confirm_count = (SELECT count(*) FROM public.confirmations c WHERE c.post_id = p.id AND c.confirmation_type = 'confirm'),
  resolve_count = (SELECT count(*) FROM public.confirmations c WHERE c.post_id = p.id AND c.confirmation_type = 'resolve'),
  report_count  = (SELECT count(*) FROM public.reports r WHERE r.post_id = p.id);
UPDATE public.poll_options o SET vote_count = (SELECT count(*) FROM public.poll_votes v WHERE v.option_id = o.id);

-- ============================================================
-- 7. COMMENTS — length limit + admin removal
-- ============================================================
ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_body_length;
ALTER TABLE public.comments ADD CONSTRAINT comments_body_length CHECK (char_length(body) BETWEEN 1 AND 1000) NOT VALID;
DROP POLICY IF EXISTS "admin_can_delete_comments" ON public.comments;
CREATE POLICY "admin_can_delete_comments" ON public.comments FOR DELETE TO authenticated USING (public.auth_is_admin());

-- ============================================================
-- 8. EVENT RSVPS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_rsvps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  status     text NOT NULL CHECK (status IN ('going', 'interested')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rsvps_read_all" ON public.event_rsvps;
CREATE POLICY "rsvps_read_all" ON public.event_rsvps FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "rsvps_insert_own" ON public.event_rsvps;
CREATE POLICY "rsvps_insert_own" ON public.event_rsvps FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "rsvps_update_own" ON public.event_rsvps;
CREATE POLICY "rsvps_update_own" ON public.event_rsvps FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "rsvps_delete_own" ON public.event_rsvps;
CREATE POLICY "rsvps_delete_own" ON public.event_rsvps FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- 9. OTP RATE LIMIT — lock the table, expose one RPC
-- ============================================================
DROP POLICY IF EXISTS "anon_can_insert_otp_rate_limit" ON public.otp_rate_limit;
DROP POLICY IF EXISTS "anon_can_read_own_otp_limit"    ON public.otp_rate_limit;
DROP POLICY IF EXISTS "anon_can_update_own_otp_limit"  ON public.otp_rate_limit;
REVOKE ALL ON public.otp_rate_limit FROM anon, authenticated;

-- Advisory app-level limit (5 codes / number / hour). Also configure Supabase
-- Auth → Rate Limits → "SMS sent per hour", which is enforced server-side.
CREATE OR REPLACE FUNCTION public.request_otp_slot(p_phone text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r public.otp_rate_limit;
BEGIN
  IF p_phone IS NULL OR p_phone !~ '^\+[0-9]{10,15}$' THEN
    RETURN false;
  END IF;
  SELECT * INTO r FROM public.otp_rate_limit
   WHERE phone = p_phone AND window_start > now() - interval '1 hour'
   ORDER BY window_start DESC LIMIT 1
   FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO public.otp_rate_limit (phone, attempts, window_start) VALUES (p_phone, 1, now());
    DELETE FROM public.otp_rate_limit WHERE window_start < now() - interval '1 day';
    RETURN true;
  END IF;
  IF r.attempts >= 5 THEN
    RETURN false;
  END IF;
  UPDATE public.otp_rate_limit SET attempts = attempts + 1 WHERE id = r.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.request_otp_slot(text) FROM public;
GRANT EXECUTE ON FUNCTION public.request_otp_slot(text) TO anon, authenticated;

-- ============================================================
-- 10. VERIFICATION SUBMISSION (user)
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_verification(p_cnic text, p_is_business boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p public.profiles;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501'; END IF;
  IF p_cnic IS NULL OR p_cnic !~ '^[0-9]{13}$' THEN RAISE EXCEPTION 'CNIC must be 13 digits'; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = auth.uid();
  IF p.verification_status = 'pending' THEN RAISE EXCEPTION 'A verification request is already under review'; END IF;
  IF p.verification_status = 'approved' AND (p.verification_expiry IS NULL OR p.verification_expiry > now()) THEN
    RAISE EXCEPTION 'You are already verified';
  END IF;
  UPDATE public.profiles SET
    cnic_number = p_cnic,
    is_business = COALESCE(p_is_business, false),
    verification_status = 'pending',
    verification_requested_at = now()
  WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.submit_verification(text, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.submit_verification(text, boolean) TO authenticated;

-- ============================================================
-- 11. ADMIN RPCs — each re-checks auth_is_admin() and audits
-- ============================================================
CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.auth_is_admin() THEN RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.assert_admin();
  SELECT jsonb_build_object(
    'totalPosts',           (SELECT count(*) FROM posts),
    'activePosts',          (SELECT count(*) FROM posts WHERE status = 'active' AND (expires_at IS NULL OR expires_at > now())),
    'hiddenPosts',          (SELECT count(*) FROM posts WHERE status = 'hidden'),
    'reportedPosts',        (SELECT count(*) FROM posts WHERE report_count > 0 AND status <> 'hidden'),
    'totalUsers',           (SELECT count(*) FROM profiles),
    'pendingVerifications', (SELECT count(*) FROM profiles WHERE verification_status = 'pending'),
    'pendingListings',      (SELECT count(*) FROM provider_listings WHERE status = 'pending'),
    'postsByDay', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'count', COALESCE(c.n, 0)) ORDER BY d), '[]'::jsonb)
      FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d
      LEFT JOIN (SELECT date_trunc('day', created_at) AS day, count(*) AS n FROM posts GROUP BY 1) c ON c.day = d
    ),
    'postsByCategory', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category, 'count', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT category, count(*) AS n FROM posts GROUP BY category) x
    )
  ) INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_moderate_post(p_post_id uuid, p_action text, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE t text;
BEGIN
  PERFORM public.assert_admin();
  SELECT title INTO t FROM posts WHERE id = p_post_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Post not found'; END IF;

  CASE p_action
    WHEN 'approve' THEN
      DELETE FROM reports WHERE post_id = p_post_id;   -- trigger resets report_count
      UPDATE posts SET status = 'active', report_count = 0 WHERE id = p_post_id;
    WHEN 'hide'      THEN UPDATE posts SET status = 'hidden' WHERE id = p_post_id;
    WHEN 'feature'   THEN UPDATE posts SET is_featured = true WHERE id = p_post_id;
    WHEN 'unfeature' THEN UPDATE posts SET is_featured = false WHERE id = p_post_id;
    WHEN 'delete'    THEN DELETE FROM posts WHERE id = p_post_id;
    ELSE RAISE EXCEPTION 'Unknown action %', p_action;
  END CASE;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action || '_post', 'post', p_post_id, jsonb_build_object('title', t, 'reason', p_reason));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_verification_queue()
RETURNS TABLE (user_id uuid, display_name text, phone text, cnic_number text, is_business boolean, trust_score int, requested_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
    SELECT p.id, COALESCE(NULLIF(p.display_name, ''), 'Unnamed user'), p.phone, p.cnic_number, p.is_business, p.trust_score,
           COALESCE(p.verification_requested_at, p.created_at)
    FROM profiles p
    WHERE p.verification_status = 'pending'
    ORDER BY COALESCE(p.verification_requested_at, p.created_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_verification(p_user_id uuid, p_decision text, p_notes text DEFAULT '', p_expiry timestamptz DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE p profiles; masked text;
BEGIN
  PERFORM public.assert_admin();
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Decision must be approved or rejected'; END IF;
  SELECT * INTO p FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  masked := CASE WHEN p.cnic_number ~ '^[0-9]{13}$' THEN substr(p.cnic_number, 1, 5) || '-•••••••-' || substr(p.cnic_number, 13, 1) ELSE '—' END;

  UPDATE profiles SET
    verification_status  = p_decision,
    verification_date    = now(),
    verification_expiry  = CASE WHEN p_decision = 'approved' THEN COALESCE(p_expiry, now() + interval '1 year') ELSE NULL END,
    trust_score          = CASE WHEN p_decision = 'approved' THEN LEAST(100, trust_score + 15) ELSE trust_score END,
    verification_history = jsonb_build_array(jsonb_build_object(
                             'id', gen_random_uuid(), 'date', now(), 'cnic_masked', masked, 'status', p_decision,
                             'valid_until', CASE WHEN p_decision = 'approved' THEN COALESCE(p_expiry, now() + interval '1 year') END,
                             'notes', COALESCE(p_notes, ''))) || COALESCE(verification_history, '[]'::jsonb)
  WHERE id = p_user_id;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), CASE WHEN p_decision = 'approved' THEN 'approve_verification' ELSE 'reject_verification' END,
          'profile', p_user_id, jsonb_build_object('name', p.display_name, 'notes', p_notes, 'valid_until', p_expiry));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_review_listing(p_listing_id uuid, p_decision text, p_notes text DEFAULT '')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE name text;
BEGIN
  PERFORM public.assert_admin();
  IF p_decision NOT IN ('approved', 'rejected') THEN RAISE EXCEPTION 'Decision must be approved or rejected'; END IF;
  UPDATE provider_listings SET
    status = p_decision, admin_notes = NULLIF(p_notes, ''), reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_listing_id
  RETURNING business_name INTO name;
  IF NOT FOUND THEN RAISE EXCEPTION 'Listing not found'; END IF;
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), CASE WHEN p_decision = 'approved' THEN 'approve_listing' ELSE 'reject_listing' END,
          'listing', p_listing_id, jsonb_build_object('business', name, 'notes', p_notes));
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.assert_admin()',
    'public.admin_overview()',
    'public.admin_moderate_post(uuid, text, text)',
    'public.admin_verification_queue()',
    'public.admin_review_verification(uuid, text, text, timestamptz)',
    'public.admin_review_listing(uuid, text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;

-- Internal trigger helpers must not be callable through the API.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM public, anon, authenticated;

-- ============================================================
-- 12. STORAGE — post images (public read, owner-folder writes)
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('post-images', 'post-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "post_images_public_read"  ON storage.objects;
DROP POLICY IF EXISTS "post_images_owner_insert" ON storage.objects;
DROP POLICY IF EXISTS "post_images_owner_delete" ON storage.objects;
CREATE POLICY "post_images_public_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'post-images');
CREATE POLICY "post_images_owner_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "post_images_owner_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- 13. SEED — additional nationwide emergency numbers
-- ============================================================
INSERT INTO public.emergency_contacts (name, phone, type)
SELECT v.name, v.phone, v.type
FROM (VALUES ('Chhipa Ambulance', '1020', 'ambulance'), ('Motorway Police', '130', 'police')) AS v(name, phone, type)
WHERE NOT EXISTS (SELECT 1 FROM public.emergency_contacts e WHERE e.phone = v.phone);

-- ============================================================
-- 14. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_scheduled_for   ON public.posts(scheduled_for) WHERE scheduled_for IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_status_created  ON public.posts(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_report_count    ON public.posts(report_count) WHERE report_count > 0;
CREATE INDEX IF NOT EXISTS idx_event_rsvps_post_id   ON public.event_rsvps(post_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_post_user  ON public.poll_votes(post_id, user_id);
CREATE INDEX IF NOT EXISTS idx_reports_post_id       ON public.reports(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_user_id      ON public.comments(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_verification ON public.profiles(verification_status) WHERE verification_status = 'pending';


-- >>>>>>>>>> migrations/20261001000000_admin_user_management.sql
/*
  Smart Radar — Admin user management (2026-10-01)
  ============================================================
  Run after 20260930000000_rebuild_hardening.sql. Idempotent.

  Adds:
   1. Account suspension (profiles.is_banned) — suspended users can still
      browse but cannot post, comment, vote, report or RSVP.
   2. Admin can read report reasons (reports were owner-only).
   3. admin_list_users()   — searchable user directory with activity stats.
   4. admin_update_user()  — suspend / restore / revoke verification /
      set trust score, all audited.
*/

-- ============================================================
-- 1. SUSPENSION
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_reason text,
  ADD COLUMN IF NOT EXISTS banned_at     timestamptz;

-- Users can see their own suspension status (never change it).
GRANT SELECT (is_banned, banned_reason) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.auth_is_banned()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_banned FROM profiles WHERE id = auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.auth_is_banned() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_banned() TO authenticated;

-- Re-create write policies with the suspension check.
DROP POLICY IF EXISTS "users_can_create_own_posts" ON public.posts;
CREATE POLICY "users_can_create_own_posts" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.auth_is_banned());

DROP POLICY IF EXISTS "insert_own_comments" ON public.comments;
CREATE POLICY "insert_own_comments" ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.auth_is_banned());

DROP POLICY IF EXISTS "insert_own_votes" ON public.votes;
CREATE POLICY "insert_own_votes" ON public.votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.auth_is_banned());

DROP POLICY IF EXISTS "insert_own_reports" ON public.reports;
CREATE POLICY "insert_own_reports" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.auth_is_banned());

DROP POLICY IF EXISTS "insert_own_confirmations" ON public.confirmations;
CREATE POLICY "insert_own_confirmations" ON public.confirmations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.auth_is_banned());

DROP POLICY IF EXISTS "rsvps_insert_own" ON public.event_rsvps;
CREATE POLICY "rsvps_insert_own" ON public.event_rsvps FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.auth_is_banned());

DROP POLICY IF EXISTS "users_can_submit_listing" ON public.provider_listings;
CREATE POLICY "users_can_submit_listing" ON public.provider_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending' AND NOT public.auth_is_banned());

-- Hide a suspended user's posts from the public feed (owner & admins still see them).
CREATE OR REPLACE FUNCTION public.is_user_banned(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_banned FROM profiles WHERE id = p_user_id), false);
$$;
REVOKE ALL ON FUNCTION public.is_user_banned(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_user_banned(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "public_can_read_active_posts" ON public.posts;
CREATE POLICY "public_can_read_active_posts"
  ON public.posts FOR SELECT TO anon, authenticated
  USING (
    status IN ('active', 'resolved')
    AND (scheduled_for IS NULL OR scheduled_for <= now())
    AND NOT public.is_user_banned(user_id)
  );

-- ============================================================
-- 2. ADMIN CAN READ REPORT REASONS
-- ============================================================
DROP POLICY IF EXISTS "admin_can_read_reports" ON public.reports;
CREATE POLICY "admin_can_read_reports" ON public.reports FOR SELECT TO authenticated USING (public.auth_is_admin());

-- ============================================================
-- 3. USER DIRECTORY
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_list_users(p_search text DEFAULT NULL, p_filter text DEFAULT 'all')
RETURNS TABLE (
  id uuid, display_name text, phone text, is_business boolean, is_admin boolean, is_banned boolean,
  banned_reason text, verification_status text, verification_expiry timestamptz, trust_score int,
  created_at timestamptz, post_count bigint, reports_received bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
    SELECT p.id, p.display_name, p.phone, p.is_business, p.is_admin, p.is_banned, p.banned_reason,
           p.verification_status, p.verification_expiry, p.trust_score, p.created_at,
           (SELECT count(*) FROM posts x WHERE x.user_id = p.id),
           (SELECT count(*) FROM reports r JOIN posts x ON x.id = r.post_id WHERE x.user_id = p.id)
    FROM profiles p
    WHERE (p_search IS NULL OR p_search = '' OR p.display_name ILIKE '%' || p_search || '%' OR p.phone ILIKE '%' || p_search || '%')
      AND CASE COALESCE(p_filter, 'all')
            WHEN 'verified'  THEN p.verification_status = 'approved'
            WHEN 'business'  THEN p.is_business
            WHEN 'suspended' THEN p.is_banned
            WHEN 'admins'    THEN p.is_admin
            ELSE true
          END
    ORDER BY p.created_at DESC
    LIMIT 500;
END;
$$;

-- ============================================================
-- 4. USER ACTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_update_user(p_user_id uuid, p_action text, p_value int DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE name text;
BEGIN
  PERFORM public.assert_admin();
  IF p_user_id = auth.uid() AND p_action = 'ban' THEN RAISE EXCEPTION 'You cannot suspend your own account'; END IF;
  SELECT display_name INTO name FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;

  CASE p_action
    WHEN 'ban' THEN
      IF (SELECT is_admin FROM profiles WHERE id = p_user_id) THEN RAISE EXCEPTION 'Admins cannot be suspended'; END IF;
      UPDATE profiles SET is_banned = true, banned_reason = NULLIF(p_reason, ''), banned_at = now() WHERE id = p_user_id;
    WHEN 'unban' THEN
      UPDATE profiles SET is_banned = false, banned_reason = NULL, banned_at = NULL WHERE id = p_user_id;
    WHEN 'revoke_verification' THEN
      UPDATE profiles SET verification_status = NULL, verification_expiry = NULL,
        trust_score = GREATEST(0, trust_score - 15) WHERE id = p_user_id;
    WHEN 'set_trust' THEN
      IF p_value IS NULL OR p_value NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Trust score must be 0–100'; END IF;
      UPDATE profiles SET trust_score = p_value WHERE id = p_user_id;
    ELSE RAISE EXCEPTION 'Unknown action %', p_action;
  END CASE;

  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action || '_user', 'profile', p_user_id,
          jsonb_build_object('name', name, 'reason', p_reason, 'value', p_value));
END;
$$;

-- ============================================================
-- 5. OVERVIEW — add suspended users count
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.assert_admin();
  SELECT jsonb_build_object(
    'totalPosts',           (SELECT count(*) FROM posts),
    'activePosts',          (SELECT count(*) FROM posts WHERE status = 'active' AND (expires_at IS NULL OR expires_at > now())),
    'hiddenPosts',          (SELECT count(*) FROM posts WHERE status = 'hidden'),
    'reportedPosts',        (SELECT count(*) FROM posts WHERE report_count > 0 AND status <> 'hidden'),
    'totalUsers',           (SELECT count(*) FROM profiles),
    'suspendedUsers',       (SELECT count(*) FROM profiles WHERE is_banned),
    'pendingVerifications', (SELECT count(*) FROM profiles WHERE verification_status = 'pending'),
    'pendingListings',      (SELECT count(*) FROM provider_listings WHERE status = 'pending'),
    'postsByDay', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('date', to_char(d, 'YYYY-MM-DD'), 'count', COALESCE(c.n, 0)) ORDER BY d), '[]'::jsonb)
      FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') d
      LEFT JOIN (SELECT date_trunc('day', created_at) AS day, count(*) AS n FROM posts GROUP BY 1) c ON c.day = d
    ),
    'postsByCategory', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('category', category, 'count', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT category, count(*) AS n FROM posts GROUP BY category) x
    )
  ) INTO result;
  RETURN result;
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY['public.admin_list_users(text, text)', 'public.admin_update_user(uuid, text, int, text)', 'public.admin_overview()'] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;


-- >>>>>>>>>> migrations/20261002000000_owner_and_settings.sql
/*
  Smart Radar — Owner role & app settings (2026-10-02)
  ============================================================
  Run after 20261001000000_admin_user_management.sql. Idempotent.

  Roles:  owner  >  admin  >  user
   • Owner — everything admins can do, plus: appoint/remove admins and
     change app-wide settings. Make yourself owner once, in the SQL editor:
       UPDATE profiles SET is_owner = true, is_admin = true WHERE id = '<your-user-id>';
   • Admin — moderation, verification, listings, users, emergency contacts.

  App settings (single row, public read, owner-only write):
   • announcement (+ tone)          — banner shown to everyone
   • posting_enabled                — pause all new posts (admins exempt)
   • disabled_categories            — categories nobody can post in
   • verified_only_categories       — only CNIC-verified users may post here
   • default_radius_km
  Enforced in the posts INSERT policy, not just the UI.
*/

-- ============================================================
-- 1. OWNER ROLE
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_owner boolean NOT NULL DEFAULT false;
GRANT SELECT (is_owner) ON public.profiles TO authenticated;

CREATE OR REPLACE FUNCTION public.auth_is_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_owner FROM profiles WHERE id = auth.uid()), false);
$$;
REVOKE ALL ON FUNCTION public.auth_is_owner() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.auth_is_owner() TO authenticated;

-- Owners are always admins.
CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin OR is_owner FROM profiles WHERE id = auth.uid()), false);
$$;

CREATE OR REPLACE FUNCTION public.assert_owner()
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.auth_is_owner() THEN RAISE EXCEPTION 'Owner access required' USING ERRCODE = '42501'; END IF;
END;
$$;

-- ============================================================
-- 2. APP SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id                        int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  announcement              text,
  announcement_tone         text NOT NULL DEFAULT 'info' CHECK (announcement_tone IN ('info', 'warning', 'success')),
  posting_enabled           boolean NOT NULL DEFAULT true,
  disabled_categories       text[] NOT NULL DEFAULT '{}',
  verified_only_categories  text[] NOT NULL DEFAULT '{}',
  default_radius_km         int NOT NULL DEFAULT 3 CHECK (default_radius_km BETWEEN 1 AND 5),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  updated_by                uuid REFERENCES auth.users(id)
);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_settings FROM anon, authenticated;
GRANT SELECT ON public.app_settings TO anon, authenticated;
DROP POLICY IF EXISTS "settings_public_read" ON public.app_settings;
CREATE POLICY "settings_public_read" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);

-- Can the current user post in this category right now?
CREATE OR REPLACE FUNCTION public.can_post_category(p_category text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.auth_is_admin() OR (
    s.posting_enabled
    AND NOT (p_category = ANY (s.disabled_categories))
    AND (
      NOT (p_category = ANY (s.verified_only_categories))
      OR EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid() AND p.verification_status = 'approved'
          AND (p.verification_expiry IS NULL OR p.verification_expiry > now())
      )
    )
  )
  FROM app_settings s WHERE s.id = 1;
$$;
REVOKE ALL ON FUNCTION public.can_post_category(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_post_category(text) TO authenticated;

DROP POLICY IF EXISTS "users_can_create_own_posts" ON public.posts;
CREATE POLICY "users_can_create_own_posts" ON public.posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.auth_is_banned() AND public.can_post_category(category));

-- ============================================================
-- 3. OWNER RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.owner_update_settings(p_patch jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_owner();
  UPDATE app_settings SET
    announcement             = CASE WHEN p_patch ? 'announcement' THEN NULLIF(trim(p_patch->>'announcement'), '') ELSE announcement END,
    announcement_tone        = COALESCE(p_patch->>'announcement_tone', announcement_tone),
    posting_enabled          = COALESCE((p_patch->>'posting_enabled')::boolean, posting_enabled),
    disabled_categories      = CASE WHEN p_patch ? 'disabled_categories'
                                    THEN ARRAY(SELECT jsonb_array_elements_text(p_patch->'disabled_categories')) ELSE disabled_categories END,
    verified_only_categories = CASE WHEN p_patch ? 'verified_only_categories'
                                    THEN ARRAY(SELECT jsonb_array_elements_text(p_patch->'verified_only_categories')) ELSE verified_only_categories END,
    default_radius_km        = COALESCE((p_patch->>'default_radius_km')::int, default_radius_km),
    updated_at               = now(),
    updated_by               = auth.uid()
  WHERE id = 1;
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), 'update_settings', 'settings', NULL, p_patch);
END;
$$;

CREATE OR REPLACE FUNCTION public.owner_set_admin(p_user_id uuid, p_is_admin boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE name text;
BEGIN
  PERFORM public.assert_owner();
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'You cannot change your own role'; END IF;
  SELECT display_name INTO name FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  IF (SELECT is_owner FROM profiles WHERE id = p_user_id) THEN RAISE EXCEPTION 'Owners cannot be changed here'; END IF;
  UPDATE profiles SET is_admin = p_is_admin,
    is_banned = CASE WHEN p_is_admin THEN false ELSE is_banned END
  WHERE id = p_user_id;
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), CASE WHEN p_is_admin THEN 'grant_admin' ELSE 'revoke_admin' END, 'profile', p_user_id, jsonb_build_object('name', name));
END;
$$;

-- Admins may not suspend owners.
CREATE OR REPLACE FUNCTION public.admin_update_user(p_user_id uuid, p_action text, p_value int DEFAULT NULL, p_reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE name text;
BEGIN
  PERFORM public.assert_admin();
  IF p_user_id = auth.uid() AND p_action = 'ban' THEN RAISE EXCEPTION 'You cannot suspend your own account'; END IF;
  SELECT display_name INTO name FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'User not found'; END IF;
  CASE p_action
    WHEN 'ban' THEN
      IF (SELECT is_admin OR is_owner FROM profiles WHERE id = p_user_id) THEN RAISE EXCEPTION 'Admins cannot be suspended'; END IF;
      UPDATE profiles SET is_banned = true, banned_reason = NULLIF(p_reason, ''), banned_at = now() WHERE id = p_user_id;
    WHEN 'unban' THEN
      UPDATE profiles SET is_banned = false, banned_reason = NULL, banned_at = NULL WHERE id = p_user_id;
    WHEN 'revoke_verification' THEN
      UPDATE profiles SET verification_status = NULL, verification_expiry = NULL, trust_score = GREATEST(0, trust_score - 15) WHERE id = p_user_id;
    WHEN 'set_trust' THEN
      IF p_value IS NULL OR p_value NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Trust score must be 0–100'; END IF;
      UPDATE profiles SET trust_score = p_value WHERE id = p_user_id;
    ELSE RAISE EXCEPTION 'Unknown action %', p_action;
  END CASE;
  INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (auth.uid(), p_action || '_user', 'profile', p_user_id, jsonb_build_object('name', name, 'reason', p_reason, 'value', p_value));
END;
$$;

-- User directory now reports owners too.
DROP FUNCTION IF EXISTS public.admin_list_users(text, text);
CREATE FUNCTION public.admin_list_users(p_search text DEFAULT NULL, p_filter text DEFAULT 'all')
RETURNS TABLE (
  id uuid, display_name text, phone text, is_business boolean, is_admin boolean, is_owner boolean, is_banned boolean,
  banned_reason text, verification_status text, verification_expiry timestamptz, trust_score int,
  created_at timestamptz, post_count bigint, reports_received bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
    SELECT p.id, p.display_name, p.phone, p.is_business, p.is_admin, p.is_owner, p.is_banned, p.banned_reason,
           p.verification_status, p.verification_expiry, p.trust_score, p.created_at,
           (SELECT count(*) FROM posts x WHERE x.user_id = p.id),
           (SELECT count(*) FROM reports r JOIN posts x ON x.id = r.post_id WHERE x.user_id = p.id)
    FROM profiles p
    WHERE (p_search IS NULL OR p_search = '' OR p.display_name ILIKE '%' || p_search || '%' OR p.phone ILIKE '%' || p_search || '%')
      AND CASE COALESCE(p_filter, 'all')
            WHEN 'verified'  THEN p.verification_status = 'approved'
            WHEN 'business'  THEN p.is_business
            WHEN 'suspended' THEN p.is_banned
            WHEN 'admins'    THEN p.is_admin OR p.is_owner
            ELSE true
          END
    ORDER BY p.is_owner DESC, p.is_admin DESC, p.created_at DESC
    LIMIT 500;
END;
$$;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.assert_owner()', 'public.owner_update_settings(jsonb)', 'public.owner_set_admin(uuid, boolean)',
    'public.admin_update_user(uuid, text, int, text)', 'public.admin_list_users(text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM public, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', f);
  END LOOP;
END $$;


-- >>>>>>>>>> migrations/20261006000000_radius_50km.sql
/*
  Smart Radar — radius up to 50 km (2026-10-06)
  ============================================================
  Users can now choose any city/country and scan 1–50 km.
  Widens the radius limits that were 1–5 km. Idempotent.
*/

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_radius_km_range;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_radius_km_range CHECK (radius_km BETWEEN 1 AND 50) NOT VALID;

ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_default_radius_km_check;
ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_default_radius_range;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_default_radius_range CHECK (default_radius_km BETWEEN 1 AND 50);


/*
  Smart Radar — "Delete my account" (2026-10-08)
  ============================================================
  Google Play requires apps with sign-up to let users delete their account
  from inside the app. This adds public.delete_my_account():

    - only deletes the CALLER's own account (auth.uid()), nobody else's
    - the owner account is protected (cannot be deleted from the app)
    - posts, comments, votes, bookmarks, listings etc. are removed by the
      existing ON DELETE CASCADE foreign keys
    - admin audit history is kept, with the admin reference set to NULL

  Post photos in storage are removed by the app (storage API) before this
  function is called. Idempotent — safe to run more than once.
*/

-- Keep audit history when an admin's account is deleted.
ALTER TABLE public.admin_audit_log ALTER COLUMN admin_id DROP NOT NULL;
ALTER TABLE public.admin_audit_log DROP CONSTRAINT IF EXISTS admin_audit_log_admin_id_fkey;
ALTER TABLE public.admin_audit_log
  ADD CONSTRAINT admin_audit_log_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Other "who did it" columns: clear instead of blocking the delete.
ALTER TABLE public.provider_listings DROP CONSTRAINT IF EXISTS provider_listings_reviewed_by_fkey;
ALTER TABLE public.provider_listings
  ADD CONSTRAINT provider_listings_reviewed_by_fkey
  FOREIGN KEY (reviewed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_updated_by_fkey;
ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_updated_by_fkey
  FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND is_owner) THEN
    RAISE EXCEPTION 'The owner account cannot be deleted from the app' USING ERRCODE = '42501';
  END IF;

  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
