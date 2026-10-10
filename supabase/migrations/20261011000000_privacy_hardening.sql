/*
  Be Alert — privacy & integrity hardening (audit fixes M-1, M-5, L-2, L-3) — 2026-10-11
  =====================================================================================
  Safe to run more than once.

  M-1  Public post locations are approximate (~200 m grid) except urgent blood,
       utility outages and traffic alerts, where the exact spot matters.
       Existing posts are rounded too.
  M-5  Signed-out visitors can no longer read contact phone numbers. They read
       posts.public_metadata (metadata minus phone/contact/contact_number);
       signed-in users still see everything.
  L-2  Expired posts are hidden by the database, not just the app, and expiry is
       capped per category on the server so a modified client can't post forever.
  L-3  Admins can no longer write audit-log rows directly; emergency-contact
       changes are logged by a trigger (admin RPCs already log themselves).
*/

-- ── M-1. Approximate locations ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approximate_post_location()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.category NOT IN ('urgent_blood', 'utility_outage', 'traffic_alert') THEN
    NEW.lat := round(NEW.lat::numeric / 0.002) * 0.002;
    NEW.lng := round(NEW.lng::numeric / 0.002) * 0.002;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_approximate_location ON public.posts;
CREATE TRIGGER posts_approximate_location
  BEFORE INSERT OR UPDATE OF lat, lng, category ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.approximate_post_location();

UPDATE public.posts
   SET lat = round(lat::numeric / 0.002) * 0.002,
       lng = round(lng::numeric / 0.002) * 0.002
 WHERE category NOT IN ('urgent_blood', 'utility_outage', 'traffic_alert')
   AND (lat <> round(lat::numeric / 0.002) * 0.002 OR lng <> round(lng::numeric / 0.002) * 0.002);

-- ── M-5. Phone numbers only for signed-in users ─────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS public_metadata jsonb
  GENERATED ALWAYS AS (metadata - ARRAY['phone', 'contact', 'contact_number']) STORED;

REVOKE SELECT ON public.posts FROM anon;
GRANT SELECT (
  id, user_id, category, title, description, public_metadata, image_urls, lat, lng, location_label,
  status, is_featured, women_only, expires_at, confirm_count, resolve_count, report_count,
  upvotes, downvotes, created_at, updated_at, scheduled_for, reposted_from_id
) ON public.posts TO anon;

-- ── L-2. Expiry enforced by the server ──────────────────────────────────────
DROP POLICY IF EXISTS "public_can_read_active_posts" ON public.posts;
CREATE POLICY "public_can_read_active_posts"
  ON public.posts FOR SELECT TO anon, authenticated
  USING (
    status IN ('active', 'resolved')
    AND (scheduled_for IS NULL OR scheduled_for <= now())
    AND (expires_at IS NULL OR expires_at > now())
  );

CREATE OR REPLACE FUNCTION public.cap_post_expiry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  lim int;
  latest timestamptz;
BEGIN
  -- Mirrors autoExpireMinutes in src/lib/categories.ts (NULL = stays up until removed).
  lim := CASE NEW.category
    WHEN 'traffic_alert'    THEN 180
    WHEN 'urgent_blood'     THEN 360
    WHEN 'utility_outage'   THEN 360
    WHEN 'ride_share'       THEN 1440
    WHEN 'community_poll'   THEN 4320
    WHEN 'local_event'      THEN 10080
    WHEN 'local_deals'      THEN 10080
    WHEN 'jobs_internships' THEN 43200
  END;
  IF lim IS NOT NULL THEN
    latest := coalesce(NEW.scheduled_for, CASE WHEN TG_OP = 'INSERT' THEN now() ELSE OLD.created_at END)
              + make_interval(mins => lim);
    IF NEW.expires_at IS NULL OR NEW.expires_at > latest THEN
      NEW.expires_at := latest;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_cap_expiry ON public.posts;
CREATE TRIGGER posts_cap_expiry
  BEFORE INSERT OR UPDATE OF expires_at, category, scheduled_for ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.cap_post_expiry();

-- ── L-3. Audit log written only by the database ─────────────────────────────
DROP POLICY IF EXISTS "admin_only_insert_audit_log" ON public.admin_audit_log;
REVOKE INSERT, UPDATE, DELETE ON public.admin_audit_log FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.log_emergency_contact_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE r public.emergency_contacts%ROWTYPE;
BEGIN
  IF TG_OP = 'DELETE' THEN r := OLD; ELSE r := NEW; END IF;
  -- Changes made in the SQL editor have no signed-in admin; nothing to attribute.
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  INSERT INTO public.admin_audit_log (admin_id, action, target_type, target_id, details)
  VALUES (
    auth.uid(),
    CASE TG_OP WHEN 'INSERT' THEN 'add_emergency_contact' WHEN 'UPDATE' THEN 'update_emergency_contact' ELSE 'delete_emergency_contact' END,
    'emergency_contact',
    r.id,
    jsonb_build_object('name', r.name, 'phone', r.phone)
  );
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.log_emergency_contact_change() FROM public, anon, authenticated;

DROP TRIGGER IF EXISTS emergency_contacts_audit ON public.emergency_contacts;
CREATE TRIGGER emergency_contacts_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION public.log_emergency_contact_change();

-- ── Result ──────────────────────────────────────────────────────────────────
SELECT
  '✅ BE ALERT PRIVACY UPDATE OK' AS result,
  (SELECT count(*) FROM pg_trigger WHERE tgname IN ('posts_approximate_location', 'posts_cap_expiry', 'emergency_contacts_audit')) AS triggers_installed,
  (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'posts' AND column_name = 'public_metadata') AS phone_filter_installed,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'admin_audit_log' AND policyname = 'admin_only_insert_audit_log') AS audit_insert_policy_left;
