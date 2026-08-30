-- Allow linked doctors to update their own care_doctors public-profile fields.
CREATE OR REPLACE FUNCTION public.care_doctor_update_my_profile(_patch JSONB)
RETURNS public.care_doctors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  row public.care_doctors;
  p JSONB := COALESCE(_patch, '{}'::jsonb);
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO row FROM public.care_doctors WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Doctor profile not linked to this account';
  END IF;

  UPDATE public.care_doctors d
  SET
    full_name = CASE
      WHEN p ? 'full_name' THEN NULLIF(TRIM(p->>'full_name'), '')
      ELSE d.full_name
    END,
    full_name_bn = CASE
      WHEN p ? 'full_name_bn' THEN NULLIF(TRIM(p->>'full_name_bn'), '')
      ELSE d.full_name_bn
    END,
    qualifications = CASE
      WHEN p ? 'qualifications' THEN NULLIF(TRIM(p->>'qualifications'), '')
      ELSE d.qualifications
    END,
    photo_url = CASE
      WHEN p ? 'photo_url' THEN NULLIF(TRIM(p->>'photo_url'), '')
      ELSE d.photo_url
    END,
    bmdc_no = CASE
      WHEN p ? 'bmdc_no' THEN NULLIF(TRIM(p->>'bmdc_no'), '')
      ELSE d.bmdc_no
    END,
    specialty_id = CASE
      WHEN p ? 'specialty_id' THEN NULLIF(p->>'specialty_id', '')::uuid
      ELSE d.specialty_id
    END,
    bio = CASE
      WHEN p ? 'bio' THEN NULLIF(TRIM(p->>'bio'), '')
      ELSE d.bio
    END,
    bio_bn = CASE
      WHEN p ? 'bio_bn' THEN NULLIF(TRIM(p->>'bio_bn'), '')
      ELSE d.bio_bn
    END,
    phone = CASE
      WHEN p ? 'phone' THEN NULLIF(TRIM(p->>'phone'), '')
      ELSE d.phone
    END,
    email = CASE
      WHEN p ? 'email' THEN NULLIF(TRIM(p->>'email'), '')
      ELSE d.email
    END,
    updated_at = now()
  WHERE d.id = row.id
  RETURNING * INTO row;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_doctor_update_my_profile(JSONB) TO authenticated;

COMMENT ON FUNCTION public.care_doctor_update_my_profile(JSONB) IS
  'Doctor self-service update of safe care_doctors profile fields (name, photo, BMDC, specialty, bio, contact).';
