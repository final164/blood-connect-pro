-- Global profile lock: user toggles profile_locked; admin defines which fields hide via app_settings.profile_lock_settings

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_locked BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS profile_lock_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_settings
SET profile_lock_settings = '{
  "phone": true,
  "blood_group": true,
  "bio": true,
  "gender": true,
  "age": true,
  "location": true,
  "last_donation": true,
  "availability": true,
  "stats": true
}'::jsonb
WHERE id = 1
  AND (
    profile_lock_settings IS NULL
    OR profile_lock_settings = '{}'::jsonb
    OR NOT (profile_lock_settings ? 'phone')
  );

CREATE OR REPLACE FUNCTION public.fetch_profile_public(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row jsonb;
  v_viewer uuid := auth.uid();
  v_is_owner boolean;
  v_locked boolean;
  v_cfg jsonb;
BEGIN
  SELECT to_jsonb(p.*) INTO v_row
  FROM public.profiles p
  WHERE p.id = p_user_id;

  IF v_row IS NULL THEN
    RETURN NULL;
  END IF;

  v_is_owner := v_viewer IS NOT NULL AND v_viewer = p_user_id;
  v_locked := COALESCE((v_row->>'profile_locked')::boolean, false);

  v_row := v_row
    - 'medical_conditions_encrypted'
    - 'e2ee_public_key'
    - 'profile_privacy_settings';

  IF v_is_owner OR NOT v_locked THEN
    RETURN v_row;
  END IF;

  SELECT COALESCE(a.profile_lock_settings, '{}'::jsonb) INTO v_cfg
  FROM public.app_settings a
  WHERE a.id = 1;

  IF COALESCE((v_cfg->>'phone')::boolean, true) THEN v_row := v_row - 'phone'; END IF;
  IF COALESCE((v_cfg->>'blood_group')::boolean, true) THEN v_row := v_row - 'blood_group'; END IF;
  IF COALESCE((v_cfg->>'bio')::boolean, true) THEN v_row := v_row - 'bio'; END IF;
  IF COALESCE((v_cfg->>'gender')::boolean, true) THEN v_row := v_row - 'gender'; END IF;
  IF COALESCE((v_cfg->>'age')::boolean, true) THEN v_row := v_row - 'date_of_birth'; END IF;
  IF COALESCE((v_cfg->>'location')::boolean, true) THEN
    v_row := v_row - 'city' - 'area' - 'district_id' - 'latitude' - 'longitude';
  END IF;
  IF COALESCE((v_cfg->>'last_donation')::boolean, true) THEN v_row := v_row - 'last_donation_date'; END IF;
  IF COALESCE((v_cfg->>'availability')::boolean, true) THEN v_row := v_row - 'is_available'; END IF;
  IF COALESCE((v_cfg->>'stats')::boolean, true) THEN
    v_row := v_row - 'total_donations' - 'lives_saved';
  END IF;

  RETURN v_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_profile_public(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_profile_public(uuid) TO anon;
