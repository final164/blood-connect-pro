-- Profile field privacy (Facebook-style visibility per field)
-- Run in Supabase SQL Editor if migration is not applied.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_privacy_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Returns profile JSON with fields masked for non-owners based on profile_privacy_settings.
CREATE OR REPLACE FUNCTION public.fetch_profile_public(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_privacy jsonb;
  v_viewer uuid := auth.uid();
  v_is_owner boolean;
  v_vis text;
BEGIN
  SELECT to_jsonb(p.*) INTO v_row
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_row IS NULL THEN
    RETURN NULL;
  END IF;

  v_is_owner := v_viewer IS NOT NULL AND v_viewer = p_user_id;
  IF v_is_owner THEN
    RETURN v_row;
  END IF;

  v_privacy := COALESCE(v_row->'profile_privacy_settings', '{}'::jsonb);

  -- Helper: default phone/email/last_donation hidden; others public
  v_vis := COALESCE(v_privacy->>'phone', 'only_me');
  IF v_vis = 'only_me' THEN v_row := v_row - 'phone'; END IF;

  v_vis := COALESCE(v_privacy->>'blood_group', 'public');
  IF v_vis = 'only_me' THEN v_row := v_row - 'blood_group'; END IF;

  v_vis := COALESCE(v_privacy->>'bio', 'public');
  IF v_vis = 'only_me' THEN v_row := v_row - 'bio'; END IF;

  v_vis := COALESCE(v_privacy->>'gender', 'public');
  IF v_vis = 'only_me' THEN v_row := v_row - 'gender'; END IF;

  v_vis := COALESCE(v_privacy->>'age', 'public');
  IF v_vis = 'only_me' THEN v_row := v_row - 'date_of_birth'; END IF;

  v_vis := COALESCE(v_privacy->>'location', 'public');
  IF v_vis = 'only_me' THEN
    v_row := v_row - 'city' - 'area' - 'district_id' - 'latitude' - 'longitude';
  END IF;

  v_vis := COALESCE(v_privacy->>'last_donation', 'only_me');
  IF v_vis = 'only_me' THEN v_row := v_row - 'last_donation_date'; END IF;

  v_vis := COALESCE(v_privacy->>'availability', 'public');
  IF v_vis = 'only_me' THEN v_row := v_row - 'is_available'; END IF;

  v_vis := COALESCE(v_privacy->>'stats', 'public');
  IF v_vis = 'only_me' THEN
    v_row := v_row - 'total_donations' - 'lives_saved';
  END IF;

  -- Never expose encrypted medical data to others
  v_row := v_row - 'medical_conditions_encrypted' - 'e2ee_public_key';

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_profile_public(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_profile_public(uuid) TO anon;
