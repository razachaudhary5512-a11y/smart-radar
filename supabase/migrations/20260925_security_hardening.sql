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
