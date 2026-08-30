-- Enrich care_doctors_search for chamber desk autofill, and expand
-- care_find_or_create_doctor so custom desk entries can store full profile fields.

DROP FUNCTION IF EXISTS public.care_doctors_search(TEXT, INT, UUID);

CREATE OR REPLACE FUNCTION public.care_doctors_search(
  _q TEXT DEFAULT NULL,
  _limit INT DEFAULT 20,
  _org_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  full_name_bn TEXT,
  bmdc_no TEXT,
  doctor_code TEXT,
  qualifications TEXT,
  photo_url TEXT,
  specialty_id UUID,
  specialty_name_bn TEXT,
  specialty_name_en TEXT,
  org_count INT,
  in_org BOOLEAN,
  registration_status TEXT,
  has_account BOOLEAN,
  title TEXT,
  first_name TEXT,
  last_name TEXT,
  date_of_birth DATE,
  gender TEXT,
  district_id UUID,
  nid_passport TEXT,
  doctor_type TEXT,
  phone TEXT,
  email TEXT,
  bio TEXT,
  bio_bn TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id,
         d.full_name,
         d.full_name_bn,
         d.bmdc_no,
         d.doctor_code,
         d.qualifications,
         d.photo_url,
         d.specialty_id,
         s.name_bn,
         s.name_en,
         (SELECT COUNT(DISTINCT a.org_id)::INT FROM public.care_affiliations a WHERE a.doctor_id = d.id),
         (
           _org_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.care_affiliations a
             WHERE a.doctor_id = d.id AND a.org_id = _org_id
           )
         ),
         d.registration_status,
         (d.user_id IS NOT NULL),
         d.title,
         d.first_name,
         d.last_name,
         d.date_of_birth,
         d.gender,
         d.district_id,
         d.nid_passport,
         d.doctor_type,
         d.phone,
         d.email,
         d.bio,
         d.bio_bn
  FROM public.care_doctors d
  LEFT JOIN public.care_specialties s ON s.id = d.specialty_id
  WHERE d.is_active
    AND COALESCE(d.registration_status, 'active') <> 'suspended'
    AND (
      _q IS NULL OR TRIM(_q) = ''
      OR d.full_name ILIKE '%' || TRIM(_q) || '%'
      OR COALESCE(d.full_name_bn, '') ILIKE '%' || TRIM(_q) || '%'
      OR COALESCE(d.bmdc_no, '') ILIKE '%' || TRIM(_q) || '%'
      OR COALESCE(d.doctor_code, '') ILIKE '%' || TRIM(_q) || '%'
      OR COALESCE(d.first_name, '') ILIKE '%' || TRIM(_q) || '%'
      OR COALESCE(d.last_name, '') ILIKE '%' || TRIM(_q) || '%'
      OR COALESCE(d.phone, '') ILIKE '%' || TRIM(_q) || '%'
    )
  ORDER BY
    (_org_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.care_affiliations a
      WHERE a.doctor_id = d.id AND a.org_id = _org_id
    )) DESC,
    (COALESCE(d.doctor_code, '') ILIKE TRIM(COALESCE(_q, '')) || '%') DESC,
    (_q IS NOT NULL AND d.full_name ILIKE TRIM(_q) || '%') DESC,
    d.full_name
  LIMIT GREATEST(1, LEAST(100, COALESCE(_limit, 20)));
$$;

GRANT EXECUTE ON FUNCTION public.care_doctors_search(TEXT, INT, UUID) TO authenticated, anon;

-- Expand find-or-create with optional profile columns (replace prior 4-arg signature).
DROP FUNCTION IF EXISTS public.care_find_or_create_doctor(TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.care_find_or_create_doctor(
  _full_name TEXT,
  _bmdc_no TEXT DEFAULT NULL,
  _specialty_id UUID DEFAULT NULL,
  _qualifications TEXT DEFAULT NULL,
  _full_name_bn TEXT DEFAULT NULL,
  _title TEXT DEFAULT NULL,
  _first_name TEXT DEFAULT NULL,
  _last_name TEXT DEFAULT NULL,
  _date_of_birth DATE DEFAULT NULL,
  _gender TEXT DEFAULT NULL,
  _district_id UUID DEFAULT NULL,
  _nid_passport TEXT DEFAULT NULL,
  _doctor_type TEXT DEFAULT NULL,
  _phone TEXT DEFAULT NULL,
  _email TEXT DEFAULT NULL,
  _photo_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  name_clean TEXT := NULLIF(TRIM(COALESCE(_full_name, '')), '');
  bmdc_clean TEXT := NULLIF(TRIM(COALESCE(_bmdc_no, '')), '');
  found_id UUID;
BEGIN
  IF name_clean IS NULL THEN
    RAISE EXCEPTION 'Doctor name is required';
  END IF;

  IF NOT public.is_care_staff()
     AND NOT EXISTS (SELECT 1 FROM public.care_org_members m WHERE m.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF bmdc_clean IS NOT NULL THEN
    SELECT id INTO found_id
    FROM public.care_doctors
    WHERE LOWER(TRIM(COALESCE(bmdc_no, ''))) = LOWER(bmdc_clean)
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF found_id IS NULL THEN
    SELECT id INTO found_id
    FROM public.care_doctors
    WHERE LOWER(TRIM(full_name)) = LOWER(name_clean)
       OR LOWER(TRIM(COALESCE(full_name_bn, ''))) = LOWER(name_clean)
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF found_id IS NOT NULL THEN
    UPDATE public.care_doctors
    SET bmdc_no = COALESCE(NULLIF(TRIM(COALESCE(bmdc_no, '')), ''), bmdc_clean),
        specialty_id = COALESCE(specialty_id, _specialty_id),
        qualifications = COALESCE(
          NULLIF(TRIM(COALESCE(qualifications, '')), ''),
          NULLIF(TRIM(COALESCE(_qualifications, '')), '')
        ),
        full_name_bn = COALESCE(NULLIF(TRIM(COALESCE(full_name_bn, '')), ''), NULLIF(TRIM(COALESCE(_full_name_bn, '')), '')),
        title = COALESCE(NULLIF(TRIM(COALESCE(title, '')), ''), NULLIF(TRIM(COALESCE(_title, '')), '')),
        first_name = COALESCE(NULLIF(TRIM(COALESCE(first_name, '')), ''), NULLIF(TRIM(COALESCE(_first_name, '')), '')),
        last_name = COALESCE(NULLIF(TRIM(COALESCE(last_name, '')), ''), NULLIF(TRIM(COALESCE(_last_name, '')), '')),
        date_of_birth = COALESCE(date_of_birth, _date_of_birth),
        gender = COALESCE(NULLIF(TRIM(COALESCE(gender, '')), ''), NULLIF(TRIM(COALESCE(_gender, '')), '')),
        district_id = COALESCE(district_id, _district_id),
        nid_passport = COALESCE(NULLIF(TRIM(COALESCE(nid_passport, '')), ''), NULLIF(TRIM(COALESCE(_nid_passport, '')), '')),
        doctor_type = COALESCE(NULLIF(TRIM(COALESCE(doctor_type, '')), ''), NULLIF(TRIM(COALESCE(_doctor_type, '')), '')),
        phone = COALESCE(NULLIF(TRIM(COALESCE(phone, '')), ''), NULLIF(TRIM(COALESCE(_phone, '')), '')),
        email = COALESCE(NULLIF(TRIM(COALESCE(email, '')), ''), NULLIF(TRIM(COALESCE(_email, '')), '')),
        photo_url = COALESCE(NULLIF(TRIM(COALESCE(photo_url, '')), ''), NULLIF(TRIM(COALESCE(_photo_url, '')), ''))
    WHERE id = found_id;
    RETURN found_id;
  END IF;

  INSERT INTO public.care_doctors (
    full_name, full_name_bn, bmdc_no, specialty_id, qualifications,
    title, first_name, last_name, date_of_birth, gender, district_id,
    nid_passport, doctor_type, phone, email, photo_url
  )
  VALUES (
    name_clean,
    NULLIF(TRIM(COALESCE(_full_name_bn, '')), ''),
    bmdc_clean,
    _specialty_id,
    NULLIF(TRIM(COALESCE(_qualifications, '')), ''),
    NULLIF(TRIM(COALESCE(_title, '')), ''),
    NULLIF(TRIM(COALESCE(_first_name, '')), ''),
    NULLIF(TRIM(COALESCE(_last_name, '')), ''),
    _date_of_birth,
    NULLIF(TRIM(COALESCE(_gender, '')), ''),
    _district_id,
    NULLIF(TRIM(COALESCE(_nid_passport, '')), ''),
    NULLIF(TRIM(COALESCE(_doctor_type, '')), ''),
    NULLIF(TRIM(COALESCE(_phone, '')), ''),
    NULLIF(TRIM(COALESCE(_email, '')), ''),
    NULLIF(TRIM(COALESCE(_photo_url, '')), '')
  )
  RETURNING id INTO found_id;

  PERFORM public.care_write_audit(NULL::UUID, 'doctor.create', 'care_doctors', found_id,
    jsonb_build_object('full_name', name_clean, 'bmdc_no', bmdc_clean));

  RETURN found_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_find_or_create_doctor(
  TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
