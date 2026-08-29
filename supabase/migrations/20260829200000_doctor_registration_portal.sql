-- Doctor self-registration portal: extended care_doctors, CMS fields, link
-- approval requests, search by doctor_code, register/respond RPCs.

-- ─── Columns on care_doctors ─────────────────────────────────────────────────
ALTER TABLE public.care_doctors
  ADD COLUMN IF NOT EXISTS doctor_code TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nid_passport TEXT,
  ADD COLUMN IF NOT EXISTS doctor_type TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS registration_status TEXT NOT NULL DEFAULT 'active'
    CHECK (registration_status IN ('active', 'pending', 'suspended'));

CREATE UNIQUE INDEX IF NOT EXISTS care_doctors_doctor_code_uidx
  ON public.care_doctors (doctor_code)
  WHERE doctor_code IS NOT NULL AND TRIM(doctor_code) <> '';

CREATE INDEX IF NOT EXISTS care_doctors_user_idx ON public.care_doctors (user_id)
  WHERE user_id IS NOT NULL;

-- Backfill codes for existing active doctors (demo + live).
DO $$
DECLARE
  r RECORD;
  n INT := 100000;
  code TEXT;
BEGIN
  FOR r IN
    SELECT id FROM public.care_doctors
    WHERE doctor_code IS NULL OR TRIM(doctor_code) = ''
    ORDER BY created_at, id
  LOOP
    n := n + 1;
    code := 'DR-' || n::TEXT;
    WHILE EXISTS (SELECT 1 FROM public.care_doctors WHERE doctor_code = code) LOOP
      n := n + 1;
      code := 'DR-' || n::TEXT;
    END LOOP;
    UPDATE public.care_doctors SET doctor_code = code WHERE id = r.id;
  END LOOP;
END $$;

-- ─── Doctor onboarding CMS ───────────────────────────────────────────────────
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS care_doctor_onboarding JSONB NOT NULL DEFAULT '{
    "fields": {
      "title": {"enabled": true, "required": true, "label_bn": "উপাধি", "label_en": "Title"},
      "first_name": {"enabled": true, "required": true, "label_bn": "নামের প্রথম অংশ", "label_en": "First Name"},
      "last_name": {"enabled": true, "required": true, "label_bn": "নামের শেষ অংশ", "label_en": "Last Name"},
      "date_of_birth": {"enabled": true, "required": true, "label_bn": "জন্ম তারিখ", "label_en": "Date of birth"},
      "gender": {"enabled": true, "required": true, "label_bn": "লিঙ্গ", "label_en": "Gender"},
      "district": {"enabled": true, "required": true, "label_bn": "জেলা", "label_en": "District"},
      "nid_passport": {"enabled": true, "required": true, "label_bn": "জাতীয় পরিচয়পত্র / পাসপোর্ট", "label_en": "National ID / Passport Number"},
      "bmdc": {"enabled": true, "required": true, "label_bn": "রেজিস্ট্রেশন নম্বর (BMDC)", "label_en": "Registration Number (BMDC)"},
      "doctor_type": {"enabled": true, "required": true, "label_bn": "ডাক্তারের ধরন", "label_en": "Doctor Type"},
      "mobile": {"enabled": true, "required": true, "label_bn": "মোবাইল নম্বর", "label_en": "Mobile number"},
      "email": {"enabled": true, "required": true, "label_bn": "ইমেইল", "label_en": "Email"},
      "password": {"enabled": true, "required": true, "label_bn": "পাসওয়ার্ড", "label_en": "Password"},
      "specialty": {"enabled": true, "required": false, "label_bn": "স্পেশালিটি", "label_en": "Specialty"},
      "qualifications": {"enabled": true, "required": false, "label_bn": "যোগ্যতা", "label_en": "Qualifications"},
      "terms": {"enabled": true, "required": true, "label_bn": "শর্তাবলী", "label_en": "Terms & conditions"}
    }
  }'::jsonb;

-- ─── Link approval requests ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.care_doctor_link_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.care_doctors(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  kind TEXT NOT NULL CHECK (kind IN ('affiliation', 'operation')),
  location_id UUID REFERENCES public.care_locations(id) ON DELETE SET NULL,
  offering_id UUID,
  role TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_doctor_link_req_doctor_idx
  ON public.care_doctor_link_requests (doctor_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS care_doctor_link_req_org_idx
  ON public.care_doctor_link_requests (org_id, status, created_at DESC);

ALTER TABLE public.care_doctor_link_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS care_doctor_link_req_select ON public.care_doctor_link_requests;
CREATE POLICY care_doctor_link_req_select ON public.care_doctor_link_requests
  FOR SELECT TO authenticated
  USING (
    public.is_care_staff()
    OR EXISTS (
      SELECT 1 FROM public.care_doctors d
      WHERE d.id = doctor_id AND d.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.care_org_members m
      WHERE m.org_id = care_doctor_link_requests.org_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS care_doctor_link_req_insert ON public.care_doctor_link_requests;
CREATE POLICY care_doctor_link_req_insert ON public.care_doctor_link_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_care_staff()
    OR EXISTS (
      SELECT 1 FROM public.care_org_members m
      WHERE m.org_id = org_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS care_doctor_link_req_update ON public.care_doctor_link_requests;
CREATE POLICY care_doctor_link_req_update ON public.care_doctor_link_requests
  FOR UPDATE TO authenticated
  USING (
    public.is_care_staff()
    OR EXISTS (
      SELECT 1 FROM public.care_doctors d
      WHERE d.id = doctor_id AND d.user_id = auth.uid()
    )
  );

-- ─── Generate doctor code ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.care_generate_doctor_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT;
  code TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CASE
      WHEN doctor_code ~ '^DR-[0-9]+$' THEN SUBSTRING(doctor_code FROM 4)::INT
      ELSE 100000
    END
  ), 100000) INTO n
  FROM public.care_doctors
  WHERE doctor_code IS NOT NULL;

  LOOP
    n := n + 1;
    code := 'DR-' || n::TEXT;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.care_doctors WHERE doctor_code = code);
  END LOOP;
  RETURN code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_generate_doctor_code() TO authenticated;

-- ─── Register doctor (after email/password auth session) ─────────────────────
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
  _qualifications TEXT DEFAULT NULL
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
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.care_doctors WHERE user_id = uid) THEN
    RAISE EXCEPTION 'Doctor profile already linked to this account';
  END IF;

  full_n := TRIM(CONCAT_WS(' ',
    NULLIF(TRIM(COALESCE(_title, '')), ''),
    NULLIF(TRIM(COALESCE(_first_name, '')), ''),
    NULLIF(TRIM(COALESCE(_last_name, '')), '')
  ));
  IF full_n IS NULL OR full_n = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;

  -- Prefer matching existing catalog doctor by BMDC (claim).
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
        bmdc_no = COALESCE(NULLIF(TRIM(COALESCE(_bmdc_no, '')), ''), bmdc_no),
        doctor_type = COALESCE(NULLIF(TRIM(COALESCE(_doctor_type, '')), ''), doctor_type),
        phone = COALESCE(NULLIF(TRIM(COALESCE(_phone, '')), ''), phone),
        email = COALESCE(NULLIF(TRIM(COALESCE(_email, '')), ''), email),
        specialty_id = COALESCE(_specialty_id, specialty_id),
        qualifications = COALESCE(NULLIF(TRIM(COALESCE(_qualifications, '')), ''), qualifications),
        registration_status = 'active',
        is_active = true
    WHERE id = existing
    RETURNING * INTO row;
  ELSE
    INSERT INTO public.care_doctors (
      user_id, doctor_code, title, first_name, last_name, full_name,
      date_of_birth, gender, district_id, nid_passport, bmdc_no, doctor_type,
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
      NULLIF(TRIM(COALESCE(_bmdc_no, '')), ''),
      NULLIF(TRIM(COALESCE(_doctor_type, '')), ''),
      NULLIF(TRIM(COALESCE(_phone, '')), ''),
      NULLIF(TRIM(COALESCE(_email, '')), ''),
      _specialty_id,
      NULLIF(TRIM(COALESCE(_qualifications, '')), ''),
      'active',
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
  TEXT, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT
) TO authenticated;

-- ─── Request link (desk / ops) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.care_request_doctor_link(
  _doctor_id UUID,
  _org_id UUID,
  _kind TEXT,
  _location_id UUID DEFAULT NULL,
  _offering_id UUID DEFAULT NULL,
  _role TEXT DEFAULT NULL,
  _payload JSONB DEFAULT '{}'::jsonb
)
RETURNS public.care_doctor_link_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  row public.care_doctor_link_requests;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _kind NOT IN ('affiliation', 'operation') THEN
    RAISE EXCEPTION 'Invalid kind';
  END IF;
  IF NOT public.is_care_staff()
     AND NOT EXISTS (
       SELECT 1 FROM public.care_org_members m
       WHERE m.org_id = _org_id AND m.user_id = uid
     ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.care_doctors d WHERE d.id = _doctor_id AND d.is_active) THEN
    RAISE EXCEPTION 'Doctor not found';
  END IF;

  -- If doctor has no linked account, auto-approve legacy path by creating link immediately
  -- is handled by caller for custom doctors; registered doctors always go pending when user_id set.
  INSERT INTO public.care_doctor_link_requests (
    doctor_id, org_id, requested_by, kind, location_id, offering_id, role, payload, status
  ) VALUES (
    _doctor_id, _org_id, uid, _kind, _location_id, _offering_id, _role,
    COALESCE(_payload, '{}'::jsonb), 'pending'
  )
  RETURNING * INTO row;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_request_doctor_link(UUID, UUID, TEXT, UUID, UUID, TEXT, JSONB) TO authenticated;

-- ─── Doctor responds to link request ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.care_respond_doctor_link(
  _request_id UUID,
  _approve BOOLEAN
)
RETURNS public.care_doctor_link_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  req public.care_doctor_link_requests;
  fee NUMERIC;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO req FROM public.care_doctor_link_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.status <> 'pending' THEN RAISE EXCEPTION 'Request already resolved'; END IF;

  IF NOT public.is_care_staff()
     AND NOT EXISTS (
       SELECT 1 FROM public.care_doctors d
       WHERE d.id = req.doctor_id AND d.user_id = uid
     ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF NOT _approve THEN
    UPDATE public.care_doctor_link_requests
    SET status = 'rejected', responded_at = now()
    WHERE id = _request_id
    RETURNING * INTO req;
    RETURN req;
  END IF;

  IF req.kind = 'affiliation' THEN
    IF req.location_id IS NULL THEN
      RAISE EXCEPTION 'location_id required for affiliation';
    END IF;
    fee := NULLIF((req.payload->>'fee_amount')::NUMERIC, NULL);
    INSERT INTO public.care_affiliations (org_id, doctor_id, location_id, fee_amount, fee_note, is_active)
    VALUES (
      req.org_id, req.doctor_id, req.location_id, fee,
      NULLIF(TRIM(COALESCE(req.payload->>'fee_note', '')), ''),
      true
    )
    ON CONFLICT (org_id, doctor_id, location_id) DO UPDATE
      SET is_active = true,
          fee_amount = COALESCE(EXCLUDED.fee_amount, care_affiliations.fee_amount),
          fee_note = COALESCE(EXCLUDED.fee_note, care_affiliations.fee_note);
  ELSIF req.kind = 'operation' THEN
    IF req.offering_id IS NULL THEN
      RAISE EXCEPTION 'offering_id required for operation';
    END IF;
    INSERT INTO public.care_operation_offering_doctors (offering_id, doctor_id, role, sort_order)
    VALUES (
      req.offering_id,
      req.doctor_id,
      COALESCE(NULLIF(TRIM(COALESCE(req.role, '')), ''), 'lead_surgeon'),
      COALESCE((req.payload->>'sort_order')::INT, 0)
    )
    ON CONFLICT (offering_id, doctor_id) DO UPDATE
      SET role = EXCLUDED.role,
          sort_order = EXCLUDED.sort_order;
  END IF;

  UPDATE public.care_doctor_link_requests
  SET status = 'approved', responded_at = now()
  WHERE id = _request_id
  RETURNING * INTO req;

  RETURN req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_respond_doctor_link(UUID, BOOLEAN) TO authenticated;

-- ─── Search includes doctor_code ─────────────────────────────────────────────
-- OUT columns changed (doctor_code, registration_status, has_account) — must drop first.
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
  has_account BOOLEAN
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
         (d.user_id IS NOT NULL)
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




