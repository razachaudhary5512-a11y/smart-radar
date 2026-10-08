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
