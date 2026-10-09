/*
  Be Alert — email-only sign-in (2026-10-10)
  ============================================================
  Phone/SMS login has been removed from the app. This migration:

   1. Shows each user's sign-in EMAIL in the Owner Console user directory
      (and lets the owner search by email). Only owner/admins can call it.
   2. Removes the old SMS rate-limit helper (request_otp_slot) and its
      table, which were callable without signing in and are now unused.

  Idempotent: safe to run more than once.
*/

-- ── 1. User directory with email ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_list_users(text, text);
CREATE FUNCTION public.admin_list_users(p_search text DEFAULT NULL, p_filter text DEFAULT 'all')
RETURNS TABLE (
  id uuid, display_name text, phone text, email text, is_business boolean, is_admin boolean, is_owner boolean,
  is_banned boolean, banned_reason text, verification_status text, verification_expiry timestamptz, trust_score int,
  created_at timestamptz, post_count bigint, reports_received bigint
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  PERFORM public.assert_admin();
  RETURN QUERY
    SELECT p.id, p.display_name, p.phone, u.email::text, p.is_business, p.is_admin, p.is_owner, p.is_banned, p.banned_reason,
           p.verification_status, p.verification_expiry, p.trust_score, p.created_at,
           (SELECT count(*) FROM posts x WHERE x.user_id = p.id),
           (SELECT count(*) FROM reports r JOIN posts x ON x.id = r.post_id WHERE x.user_id = p.id)
    FROM profiles p
    LEFT JOIN auth.users u ON u.id = p.id
    WHERE (p_search IS NULL OR p_search = ''
           OR p.display_name ILIKE '%' || p_search || '%'
           OR u.email ILIKE '%' || p_search || '%'
           OR p.phone ILIKE '%' || p_search || '%')
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
REVOKE ALL ON FUNCTION public.admin_list_users(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text) TO authenticated;

-- ── 2. Remove unused SMS rate limiting ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.request_otp_slot(text);
DROP TABLE IF EXISTS public.otp_rate_limit;
