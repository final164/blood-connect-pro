-- Doctor phone+PIN approvals: auto-approve flags, video claims, register status, admin RPCs.

-- ─── Merge auto-approve flags into care_doctor_onboarding ────────────────────
UPDATE public.app_settings
SET care_doctor_onboarding = COALESCE(care_doctor_onboarding, '{}'::jsonb)
  || jsonb_build_object(
    'auto_approve_registration', COALESCE((care_doctor_onboarding->>'auto_approve_registration')::boolean, false),
    'auto_approve_video_claim', COALESCE((care_doctor_onboarding->>'auto_approve_video_claim')::boolean, false)
  )
WHERE id = 1;

-- Ensure pin field exists in fields map (idempotent merge).
UPDATE public.app_settings
SET care_doctor_onboarding = jsonb_set(
  care_doctor_onboarding,
  '{fields,pin}',
  COALESCE(
    care_doctor_onboarding->'fields'->'pin',
    '{"enabled": true, "required": true, "label_bn": "পিন", "label_en": "PIN"}'::jsonb
  ),
  true
)
WHERE id = 1;

-- Soften defaults: email/password optional, mobile+pin required
UPDATE public.app_settings
SET care_doctor_onboarding = jsonb_set(
  jsonb_set(
    care_doctor_onboarding,
    '{fields,email,required}',
    'false'::jsonb,
    true
  ),
  '{fields,password,required}',
  'false'::jsonb,
  true
)
WHERE id = 1;

-- ─── Video claim requests ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.care_doctor_video_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.care_doctors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS care_doctor_video_claims_pending_doctor_uidx
  ON public.care_doctor_video_claims (doctor_id)
  WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS care_doctor_video_claims_pending_user_uidx
  ON public.care_doctor_video_claims (user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS care_doctor_video_claims_status_idx
  ON public.care_doctor_video_claims (status, requested_at DESC);

ALTER TABLE public.care_doctor_video_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS care_doctor_video_claims_select ON public.care_doctor_video_claims;
CREATE POLICY care_doctor_video_claims_select ON public.care_doctor_video_claims
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_care_staff()
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS care_doctor_video_claims_insert ON public.care_doctor_video_claims;
CREATE POLICY care_doctor_video_claims_insert ON public.care_doctor_video_claims
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS care_doctor_video_claims_update ON public.care_doctor_video_claims;
CREATE POLICY care_doctor_video_claims_update ON public.care_doctor_video_claims
  FOR UPDATE TO authenticated
  USING (public.is_care_staff() OR public.is_admin_staff(auth.uid()));

-- Helper: read auto-approve flags
CREATE OR REPLACE FUNCTION public.care_doctor_auto_approve_registration()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (care_doctor_onboarding->>'auto_approve_registration')::boolean
     FROM public.app_settings WHERE id = 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.care_doctor_auto_approve_video_claim()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (care_doctor_onboarding->>'auto_approve_video_claim')::boolean
     FROM public.app_settings WHERE id = 1),
    false
  );
$$;

-- ─── Bind user to video doctor (shared by claim approve / auto) ──────────────
CREATE OR REPLACE FUNCTION public.care_bind_doctor_user(_doctor_id UUID, _user_id UUID)
RETURNS public.care_doctors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.care_doctors;
  existing_uid UUID;
  video_ok BOOLEAN;
BEGIN
  SELECT user_id INTO existing_uid FROM public.care_doctors WHERE id = _doctor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Doctor not found'; END IF;
  IF existing_uid IS NOT NULL AND existing_uid <> _user_id THEN
    RAISE EXCEPTION 'Doctor already linked to another account';
  END IF;

  SELECT COALESCE(video_enabled, false) INTO video_ok
  FROM public.tele_doctor_profiles WHERE doctor_id = _doctor_id;
  IF NOT COALESCE(video_ok, false) THEN
    RAISE EXCEPTION 'Doctor is not enabled for video consult';
  END IF;

  UPDATE public.care_doctors SET user_id = NULL
  WHERE user_id = _user_id AND id <> _doctor_id;

  UPDATE public.care_doctors
  SET user_id = _user_id
  WHERE id = _doctor_id
  RETURNING * INTO row;

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_bind_doctor_user(UUID, UUID) TO authenticated;

-- ─── Register doctor: pending unless auto-approve ────────────────────────────
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
  status TEXT;
  auto_ok BOOLEAN;
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
  TEXT, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT
) TO authenticated;

-- ─── Admin create doctor (catalog / pending / active) ────────────────────────
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
  _registration_status TEXT DEFAULT 'active'
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
BEGIN
  IF NOT (public.is_care_staff() OR public.is_admin_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed';
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
    date_of_birth, gender, district_id, nid_passport, bmdc_no, doctor_type,
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

  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_admin_create_doctor(
  TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_admin_set_doctor_status(
  _doctor_id UUID,
  _status TEXT
)
RETURNS public.care_doctors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.care_doctors;
BEGIN
  IF NOT (public.is_care_staff() OR public.is_admin_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _status NOT IN ('active', 'pending', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  UPDATE public.care_doctors
  SET registration_status = _status,
      is_active = (_status = 'active')
  WHERE id = _doctor_id
  RETURNING * INTO row;

  IF NOT FOUND THEN RAISE EXCEPTION 'Doctor not found'; END IF;
  RETURN row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_admin_set_doctor_status(UUID, TEXT) TO authenticated;

-- ─── Request video claim ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.care_request_video_claim(_doctor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  claim public.care_doctor_video_claims;
  doc public.care_doctors;
  auto_ok BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO doc FROM public.care_doctors WHERE id = _doctor_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Doctor not found'; END IF;

  IF doc.user_id IS NOT NULL AND doc.user_id = uid THEN
    RETURN jsonb_build_object('status', 'already_linked', 'doctor_id', doc.id);
  END IF;
  IF doc.user_id IS NOT NULL AND doc.user_id <> uid THEN
    RAISE EXCEPTION 'Doctor already linked to another account';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.care_doctor_video_claims
    WHERE user_id = uid AND doctor_id = _doctor_id AND status = 'pending'
  ) THEN
    SELECT * INTO claim FROM public.care_doctor_video_claims
    WHERE user_id = uid AND doctor_id = _doctor_id AND status = 'pending'
    LIMIT 1;
    RETURN jsonb_build_object(
      'status', 'pending',
      'claim_id', claim.id,
      'doctor_id', _doctor_id
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.care_doctor_video_claims
    WHERE user_id = uid AND status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending video claim';
  END IF;

  auto_ok := public.care_doctor_auto_approve_video_claim();

  IF auto_ok THEN
    PERFORM public.care_bind_doctor_user(_doctor_id, uid);
    INSERT INTO public.care_doctor_video_claims (
      doctor_id, user_id, status, resolved_at, resolved_by
    ) VALUES (
      _doctor_id, uid, 'approved', now(), uid
    )
    RETURNING * INTO claim;
    RETURN jsonb_build_object(
      'status', 'approved',
      'claim_id', claim.id,
      'doctor_id', _doctor_id
    );
  END IF;

  INSERT INTO public.care_doctor_video_claims (doctor_id, user_id, status)
  VALUES (_doctor_id, uid, 'pending')
  RETURNING * INTO claim;

  RETURN jsonb_build_object(
    'status', 'pending',
    'claim_id', claim.id,
    'doctor_id', _doctor_id
  );
EXCEPTION
  WHEN unique_violation THEN
    SELECT * INTO claim FROM public.care_doctor_video_claims
    WHERE (doctor_id = _doctor_id OR user_id = uid) AND status = 'pending'
    LIMIT 1;
    IF claim.id IS NULL THEN
      RAISE EXCEPTION 'Could not create video claim';
    END IF;
    IF claim.user_id <> uid THEN
      RAISE EXCEPTION 'Another user already requested this doctor';
    END IF;
    RETURN jsonb_build_object(
      'status', 'pending',
      'claim_id', claim.id,
      'doctor_id', claim.doctor_id
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_request_video_claim(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_respond_video_claim(
  _claim_id UUID,
  _approve BOOLEAN
)
RETURNS public.care_doctor_video_claims
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  claim public.care_doctor_video_claims;
BEGIN
  IF NOT (public.is_care_staff() OR public.is_admin_staff(uid)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO claim FROM public.care_doctor_video_claims WHERE id = _claim_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Claim not found'; END IF;
  IF claim.status <> 'pending' THEN RAISE EXCEPTION 'Claim already resolved'; END IF;

  IF _approve THEN
    PERFORM public.care_bind_doctor_user(claim.doctor_id, claim.user_id);
    UPDATE public.care_doctor_video_claims
    SET status = 'approved', resolved_at = now(), resolved_by = uid
    WHERE id = _claim_id
    RETURNING * INTO claim;
  ELSE
    UPDATE public.care_doctor_video_claims
    SET status = 'rejected', resolved_at = now(), resolved_by = uid
    WHERE id = _claim_id
    RETURNING * INTO claim;
  END IF;

  RETURN claim;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_respond_video_claim(UUID, BOOLEAN) TO authenticated;
