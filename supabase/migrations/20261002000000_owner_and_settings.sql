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
