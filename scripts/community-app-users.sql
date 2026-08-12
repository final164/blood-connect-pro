-- App users in Community (district/upazila) + per-user discoverability toggle.
-- Run in Supabase SQL Editor if migration is not applied.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_in_community BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS profiles_community_discover_idx
  ON public.profiles (district_id, area)
  WHERE show_in_community = true AND COALESCE(is_blocked, false) = false;
