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
