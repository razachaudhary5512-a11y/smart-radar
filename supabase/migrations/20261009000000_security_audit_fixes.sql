/*
  Smart Radar — security audit fixes (2026-10-09)
  ============================================================
  Pre-Play-Store hardening. Idempotent: safe to run more than once.

   1. Least-privilege table grants (anon can only read; no TRUNCATE/TRIGGER/REFERENCES)
   2. Images & avatars must come from this project's own storage
      (blocks tracking pixels / offensive images hot-linked from other sites)
   3. Size limits on every free-text / JSON field users can write
   4. Anti-spam rate limits (posts, comments, reports, listings, contacts)
   5. Auto-hide by reports only counts reporters whose account is 1+ day old
      (3 brand-new throwaway accounts can no longer hide any post)
   6. Suspended users can't vote in polls
   7. Storage: nobody can list other users' files (public image links still work)
   8. Function hygiene: fixed search_path, trigger functions not callable via API
*/

-- ── 1. Least-privilege grants ───────────────────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT format('%I.%I', schemaname, tablename) FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('REVOKE TRUNCATE, TRIGGER, REFERENCES ON %s FROM anon, authenticated', t);
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON %s FROM anon', t);
  END LOOP;
END $$;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;

-- ── 2. Images only from our own storage ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_app_storage_url(p_url text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_url IS NULL
      OR p_url LIKE 'https://jccsjbwbwhuywmbvlpnm.supabase.co/storage/v1/object/public/post-images/%';
$$;

CREATE OR REPLACE FUNCTION public.guard_media_urls()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE u text;
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'posts' THEN
    IF TG_OP = 'INSERT' OR NEW.image_urls IS DISTINCT FROM OLD.image_urls THEN
      FOREACH u IN ARRAY coalesce(NEW.image_urls, '{}') LOOP
        IF NOT public.is_app_storage_url(u) THEN
          RAISE EXCEPTION 'Images must be uploaded through the app' USING ERRCODE = '22023';
        END IF;
      END LOOP;
    END IF;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    IF (TG_OP = 'INSERT' OR NEW.avatar_url IS DISTINCT FROM OLD.avatar_url) AND NOT public.is_app_storage_url(NEW.avatar_url) THEN
      RAISE EXCEPTION 'Profile photos must be uploaded through the app' USING ERRCODE = '22023';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS posts_guard_media ON public.posts;
CREATE TRIGGER posts_guard_media BEFORE INSERT OR UPDATE ON public.posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_media_urls();
DROP TRIGGER IF EXISTS profiles_guard_media ON public.profiles;
CREATE TRIGGER profiles_guard_media BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_media_urls();

-- ── 3. Size limits (NOT VALID = only checked for new/changed rows) ──────────
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT * FROM (VALUES
    ('posts',             'posts_metadata_size',            'pg_column_size(metadata) <= 8192'),
    ('posts',             'posts_location_label_length',    'location_label IS NULL OR char_length(location_label) <= 200'),
    ('reports',           'reports_reason_length',          'reason IS NULL OR char_length(reason) <= 500'),
    ('provider_listings', 'listings_business_name_length',  'char_length(business_name) BETWEEN 2 AND 100'),
    ('provider_listings', 'listings_description_length',    'description IS NULL OR char_length(description) <= 2000'),
    ('provider_listings', 'listings_phone_length',          'phone IS NULL OR char_length(phone) <= 20'),
    ('provider_listings', 'listings_location_label_length', 'location_label IS NULL OR char_length(location_label) <= 200'),
    ('trusted_contacts',  'trusted_name_length',            'char_length(name) BETWEEN 1 AND 60'),
    ('trusted_contacts',  'trusted_phone_length',           'char_length(phone) BETWEEN 3 AND 20'),
    ('profiles',          'profiles_lists_size',            'pg_column_size(saved_locations) + pg_column_size(watched_areas) + pg_column_size(blocked_users) + pg_column_size(muted_categories) + pg_column_size(pinned_categories) + pg_column_size(digest_categories) <= 32768')
  ) AS v(tbl, name, expr) LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = c.name) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID', c.tbl, c.name, c.expr);
    END IF;
  END LOOP;
END $$;

-- ── 4. Anti-spam rate limits ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_posts_user_created    ON public.posts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_user_created ON public.comments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_user_created  ON public.reports (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.enforce_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_hour int;
  v_day int;
  v_max_hour int;
  v_max_day int;
  v_what text;
BEGIN
  -- Applies to signed-in users; admins are exempt.
  IF v_uid IS NULL OR public.auth_is_admin() THEN
    RETURN NEW;
  END IF;

  CASE TG_TABLE_NAME
    WHEN 'posts'             THEN v_max_hour := 10; v_max_day := 30;  v_what := 'posts';
    WHEN 'comments'          THEN v_max_hour := 60; v_max_day := 300; v_what := 'comments';
    WHEN 'reports'           THEN v_max_hour := 20; v_max_day := 50;  v_what := 'reports';
    WHEN 'provider_listings' THEN v_max_hour := 3;  v_max_day := 5;   v_what := 'listings';
    WHEN 'trusted_contacts'  THEN v_max_hour := 20; v_max_day := 30;  v_what := 'contacts';
    ELSE RETURN NEW;
  END CASE;

  EXECUTE format(
    'SELECT count(*) FILTER (WHERE created_at > now() - interval ''1 hour''), count(*)
       FROM public.%I WHERE user_id = $1 AND created_at > now() - interval ''1 day''', TG_TABLE_NAME)
    INTO v_hour, v_day USING v_uid;

  IF v_hour >= v_max_hour OR v_day >= v_max_day THEN
    RAISE EXCEPTION 'You''re adding % too quickly. Please try again later.', v_what USING ERRCODE = '54000';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.enforce_rate_limit() FROM public, anon, authenticated;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['posts', 'comments', 'reports', 'provider_listings', 'trusted_contacts'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', t || '_rate_limit', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_rate_limit()', t || '_rate_limit', t);
  END LOOP;
END $$;

-- ── 5. Report auto-hide ignores brand-new / suspended accounts ──────────────
CREATE OR REPLACE FUNCTION public.sync_post_reports()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE pid uuid; n int; n_trusted int;
BEGIN
  IF TG_OP = 'DELETE' THEN pid := OLD.post_id; ELSE pid := NEW.post_id; END IF;
  SELECT count(*),
         count(*) FILTER (WHERE p.created_at < now() - interval '1 day' AND NOT coalesce(p.is_banned, false))
    INTO n, n_trusted
    FROM reports r LEFT JOIN profiles p ON p.id = r.user_id
   WHERE r.post_id = pid;
  UPDATE posts SET
    report_count = n,
    status = CASE WHEN n_trusted >= 3 AND status = 'active' THEN 'hidden' ELSE status END
  WHERE id = pid;
  RETURN NULL;
END;
$$;

-- ── 6. Suspended users can't vote in polls ──────────────────────────────────
DROP POLICY IF EXISTS "insert_own_poll_votes" ON public.poll_votes;
CREATE POLICY "insert_own_poll_votes" ON public.poll_votes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.auth_is_banned());

-- ── 7. Storage: no listing of other people's files ──────────────────────────
-- The bucket is public, so image links work without any SELECT policy.
-- Users may only list their own folder (needed for "Delete my account").
DROP POLICY IF EXISTS "post_images_public_read" ON storage.objects;
DROP POLICY IF EXISTS "post_images_owner_list" ON storage.objects;
CREATE POLICY "post_images_owner_list" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'post-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ── 8. Function hygiene ─────────────────────────────────────────────────────
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.sync_post_votes()', 'public.sync_post_confirmations()', 'public.sync_post_reports()',
    'public.sync_poll_counts()', 'public.poll_vote_set_post()', 'public.posts_guard()',
    'public.update_updated_at_column()', 'public.guard_media_urls()', 'public.handle_new_user()'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM public, anon, authenticated', f);
  END LOOP;
END $$;
