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
