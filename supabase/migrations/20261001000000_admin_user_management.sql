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
