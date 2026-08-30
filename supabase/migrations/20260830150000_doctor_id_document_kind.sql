-- ID document kind for doctors (NID / passport / driving licence).

ALTER TABLE public.care_doctors
  ADD COLUMN IF NOT EXISTS id_document_kind TEXT;

ALTER TABLE public.care_doctors
  DROP CONSTRAINT IF EXISTS care_doctors_id_document_kind_chk;

ALTER TABLE public.care_doctors
  ADD CONSTRAINT care_doctors_id_document_kind_chk
  CHECK (
    id_document_kind IS NULL
    OR id_document_kind IN ('nid', 'passport', 'driving_license')
  );

COMMENT ON COLUMN public.care_doctors.id_document_kind IS
  'Which ID number is stored in nid_passport: nid | passport | driving_license';

-- Patch CMS default label (merge-friendly jsonb).
UPDATE public.app_settings
SET care_doctor_onboarding = jsonb_set(
  COALESCE(care_doctor_onboarding, '{}'::jsonb),
  '{fields,nid_passport}',
  COALESCE(care_doctor_onboarding->'fields'->'nid_passport', '{}'::jsonb)
    || jsonb_build_object(
      'label_bn', 'পরিচয়পত্র নম্বর',
      'label_en', 'ID document number'
    ),
  true
)
WHERE id = 1;

-- Enrich search with id_document_kind
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
  bio_bn TEXT,
  id_document_kind TEXT
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
         d.bio_bn,
         d.id_document_kind
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

-- Expand find-or-create with id_document_kind
DROP FUNCTION IF EXISTS public.care_find_or_create_doctor(
  TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
);

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
  _photo_url TEXT DEFAULT NULL,
  _id_document_kind TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  name_clean TEXT := NULLIF(TRIM(COALESCE(_full_name, '')), '');
  bmdc_clean TEXT := NULLIF(TRIM(COALESCE(_bmdc_no, '')), '');
  kind_clean TEXT := NULLIF(TRIM(COALESCE(_id_document_kind, '')), '');
  found_id UUID;
BEGIN
  IF name_clean IS NULL THEN
    RAISE EXCEPTION 'Doctor name is required';
  END IF;

  IF NOT public.is_care_staff()
     AND NOT EXISTS (SELECT 1 FROM public.care_org_members m WHERE m.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF kind_clean IS NOT NULL AND kind_clean NOT IN ('nid', 'passport', 'driving_license') THEN
    RAISE EXCEPTION 'Invalid ID document kind';
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
        id_document_kind = COALESCE(NULLIF(TRIM(COALESCE(id_document_kind, '')), ''), kind_clean),
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
    nid_passport, id_document_kind, doctor_type, phone, email, photo_url
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
    kind_clean,
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
  TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

-- Patch care_register_doctor + care_admin_create_doctor for id_document_kind
DROP FUNCTION IF EXISTS public.care_register_doctor(TEXT, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.care_register_doctor(
  _title TEXT DEFAULT NULL,
  _first_name TEXT DEFAULT NULL,
  _last_name TEXT DEFAULT NULL,
  _date_of_birth DATE DEFAULT NULL,
  _gender TEXT DEFAULT NULL,
  _district_id UUID DEFAULT NULL,
  _nid_passport TEXT DEFAULT NULL,
  _bmdc_no TEXT DEFAULT NULL,
  _doctor_type TEXT DEFAULT NULL,
  _phone TEXT DEFAULT NULL,
  _email TEXT DEFAULT NULL,
  _specialty_id UUID DEFAULT NULL,
  _qualifications TEXT DEFAULT NULL,
  _id_document_kind TEXT DEFAULT NULL
)
RETURNS public.care_doctors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  full_n TEXT;
  code TEXT;
  row public.care_doctors;
  existing UUID;
  status TEXT;
  auto_ok BOOLEAN;
  kind_clean TEXT := NULLIF(TRIM(COALESCE(_id_document_kind, '')), '');
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.care_doctors WHERE user_id = uid) THEN
    RAISE EXCEPTION 'Doctor profile already linked to this account';
  END IF;

  IF kind_clean IS NOT NULL AND kind_clean NOT IN ('nid', 'passport', 'driving_license') THEN
    RAISE EXCEPTION 'Invalid ID document kind';
  END IF;

  full_n := TRIM(CONCAT_WS(' ',
    NULLIF(TRIM(COALESCE(_title, '')), ''),
    NULLIF(TRIM(COALESCE(_first_name, '')), ''),
    NULLIF(TRIM(COALESCE(_last_name, '')), '')
  ));
  IF full_n IS NULL OR full_n = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  auto_ok := public.care_doctor_auto_approve_registration();
  status := CASE WHEN auto_ok THEN 'active' ELSE 'pending' END;

  IF NULLIF(TRIM(COALESCE(_bmdc_no, '')), '') IS NOT NULL THEN
    SELECT id INTO existing
    FROM public.care_doctors
    WHERE LOWER(TRIM(COALESCE(bmdc_no, ''))) = LOWER(TRIM(_bmdc_no))
      AND user_id IS NULL
    ORDER BY created_at
    LIMIT 1;
  END IF;

  code := public.care_generate_doctor_code();

  IF existing IS NOT NULL THEN
    UPDATE public.care_doctors
    SET user_id = uid,
        doctor_code = COALESCE(NULLIF(TRIM(COALESCE(doctor_code, '')), ''), code),
        title = COALESCE(NULLIF(TRIM(COALESCE(_title, '')), ''), title),
        first_name = COALESCE(NULLIF(TRIM(COALESCE(_first_name, '')), ''), first_name),
        last_name = COALESCE(NULLIF(TRIM(COALESCE(_last_name, '')), ''), last_name),
        full_name = full_n,
        date_of_birth = COALESCE(_date_of_birth, date_of_birth),
        gender = COALESCE(NULLIF(TRIM(COALESCE(_gender, '')), ''), gender),
        district_id = COALESCE(_district_id, district_id),
        nid_passport = COALESCE(NULLIF(TRIM(COALESCE(_nid_passport, '')), ''), nid_passport),
        id_document_kind = COALESCE(kind_clean, id_document_kind),
        bmdc_no = COALESCE(NULLIF(TRIM(COALESCE(_bmdc_no, '')), ''), bmdc_no),
        doctor_type = COALESCE(NULLIF(TRIM(COALESCE(_doctor_type, '')), ''), doctor_type),
        phone = COALESCE(NULLIF(TRIM(COALESCE(_phone, '')), ''), phone),
        email = COALESCE(NULLIF(TRIM(COALESCE(_email, '')), ''), email),
        specialty_id = COALESCE(_specialty_id, specialty_id),
        qualifications = COALESCE(NULLIF(TRIM(COALESCE(_qualifications, '')), ''), qualifications),
        registration_status = status,
        is_active = true
    WHERE id = existing
    RETURNING * INTO row;
  ELSE
    INSERT INTO public.care_doctors (
      user_id, doctor_code, title, first_name, last_name, full_name,
      date_of_birth, gender, district_id, nid_passport, id_document_kind, bmdc_no, doctor_type,
      phone, email, specialty_id, qualifications, registration_status, is_active
    ) VALUES (
      uid, code,
      NULLIF(TRIM(COALESCE(_title, '')), ''),
      NULLIF(TRIM(COALESCE(_first_name, '')), ''),
      NULLIF(TRIM(COALESCE(_last_name, '')), ''),
      full_n,
      _date_of_birth,
      NULLIF(TRIM(COALESCE(_gender, '')), ''),
      _district_id,
      NULLIF(TRIM(COALESCE(_nid_passport, '')), ''),
      kind_clean,
      NULLIF(TRIM(COALESCE(_bmdc_no, '')), ''),
      NULLIF(TRIM(COALESCE(_doctor_type, '')), ''),
      NULLIF(TRIM(COALESCE(_phone, '')), ''),
      NULLIF(TRIM(COALESCE(_email, '')), ''),
      _specialty_id,
      NULLIF(TRIM(COALESCE(_qualifications, '')), ''),
      status,
      true
    )
    RETURNING * INTO row;
  END IF;

  UPDATE public.profiles
  SET full_name = COALESCE(NULLIF(TRIM(COALESCE(full_name, '')), ''), full_n),
      phone = COALESCE(NULLIF(TRIM(COALESCE(phone, '')), ''), NULLIF(TRIM(COALESCE(_phone, '')), ''))
  WHERE id = uid;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_register_doctor(
  TEXT, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT
) TO authenticated;

DROP FUNCTION IF EXISTS public.care_admin_create_doctor(
  TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
);

CREATE OR REPLACE FUNCTION public.care_admin_create_doctor(
  _full_name TEXT,
  _full_name_bn TEXT DEFAULT NULL,
  _title TEXT DEFAULT NULL,
  _first_name TEXT DEFAULT NULL,
  _last_name TEXT DEFAULT NULL,
  _date_of_birth DATE DEFAULT NULL,
  _gender TEXT DEFAULT NULL,
  _district_id UUID DEFAULT NULL,
  _nid_passport TEXT DEFAULT NULL,
  _bmdc_no TEXT DEFAULT NULL,
  _doctor_type TEXT DEFAULT NULL,
  _phone TEXT DEFAULT NULL,
  _email TEXT DEFAULT NULL,
  _specialty_id UUID DEFAULT NULL,
  _qualifications TEXT DEFAULT NULL,
  _photo_url TEXT DEFAULT NULL,
  _bio TEXT DEFAULT NULL,
  _bio_bn TEXT DEFAULT NULL,
  _registration_status TEXT DEFAULT 'active',
  _id_document_kind TEXT DEFAULT NULL
)
RETURNS public.care_doctors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.care_doctors;
  code TEXT;
  status TEXT;
  name TEXT;
  kind_clean TEXT := NULLIF(TRIM(COALESCE(_id_document_kind, '')), '');
BEGIN
  IF NOT (public.is_care_staff() OR public.is_admin_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF kind_clean IS NOT NULL AND kind_clean NOT IN ('nid', 'passport', 'driving_license') THEN
    RAISE EXCEPTION 'Invalid ID document kind';
  END IF;

  name := NULLIF(TRIM(COALESCE(_full_name, '')), '');
  IF name IS NULL THEN
    name := TRIM(CONCAT_WS(' ',
      NULLIF(TRIM(COALESCE(_title, '')), ''),
      NULLIF(TRIM(COALESCE(_first_name, '')), ''),
      NULLIF(TRIM(COALESCE(_last_name, '')), '')
    ));
  END IF;
  IF name IS NULL OR name = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  status := COALESCE(NULLIF(TRIM(COALESCE(_registration_status, '')), ''), 'active');
  IF status NOT IN ('active', 'pending', 'suspended') THEN
    status := 'active';
  END IF;

  code := public.care_generate_doctor_code();

  INSERT INTO public.care_doctors (
    doctor_code, title, first_name, last_name, full_name, full_name_bn,
    date_of_birth, gender, district_id, nid_passport, id_document_kind, bmdc_no, doctor_type,
    phone, email, specialty_id, qualifications, photo_url, bio, bio_bn,
    registration_status, is_active
  ) VALUES (
    code,
    NULLIF(TRIM(COALESCE(_title, '')), ''),
    NULLIF(TRIM(COALESCE(_first_name, '')), ''),
    NULLIF(TRIM(COALESCE(_last_name, '')), ''),
    name,
    NULLIF(TRIM(COALESCE(_full_name_bn, '')), ''),
    _date_of_birth,
    NULLIF(TRIM(COALESCE(_gender, '')), ''),
    _district_id,
    NULLIF(TRIM(COALESCE(_nid_passport, '')), ''),
    kind_clean,
    NULLIF(TRIM(COALESCE(_bmdc_no, '')), ''),
    NULLIF(TRIM(COALESCE(_doctor_type, '')), ''),
    NULLIF(TRIM(COALESCE(_phone, '')), ''),
    NULLIF(TRIM(COALESCE(_email, '')), ''),
    _specialty_id,
    NULLIF(TRIM(COALESCE(_qualifications, '')), ''),
    NULLIF(TRIM(COALESCE(_photo_url, '')), ''),
    NULLIF(TRIM(COALESCE(_bio, '')), ''),
    NULLIF(TRIM(COALESCE(_bio_bn, '')), ''),
    status,
    status <> 'suspended'
  )
  RETURNING * INTO row;

  PERFORM public.care_write_audit(NULL::UUID, 'doctor.admin_create', 'care_doctors', row.id,
    jsonb_build_object('full_name', name, 'status', status));

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_admin_create_doctor(
  TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;
