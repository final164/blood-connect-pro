-- App users discoverable in Community by district/upazila.
-- Admin can hide a user via profiles.show_in_community;
-- global on/off lives in app_settings.messaging_settings.community_include_app_users.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_in_community BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS profiles_community_discover_idx
  ON public.profiles (district_id, area)
  WHERE show_in_community = true AND COALESCE(is_blocked, false) = false;
