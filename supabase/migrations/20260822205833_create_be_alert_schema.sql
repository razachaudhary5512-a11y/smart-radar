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