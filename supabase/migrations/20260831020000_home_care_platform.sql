-- Home Doctor + Home Diagnostic platform
-- Profiles, service areas, weekly slots, visit bookings; lab home-collection fields; flags & hub modules.

-- ---------------------------------------------------------------------------
-- Feature flags + hub modules
-- ---------------------------------------------------------------------------

UPDATE public.app_settings
SET care_feature_flags = COALESCE(care_feature_flags, '{}'::jsonb)
  || '{"home_doctor": false, "home_diagnostic": false}'::jsonb
WHERE id = 1;

INSERT INTO public.care_hub_modules (slug, label_bn, label_en, icon, href, audience, is_enabled, sort_order)
VALUES
  ('home_doctor', 'হোম ডাক্তার', 'Home Doctor', 'HousePlus', '/care/home-doctor', 'patient', true, 18),
  ('home_diagnostic', 'হোম ডায়াগনস্টিক', 'Home Diagnostic', 'Home', '/care/home-diagnostic', 'patient', true, 19)
ON CONFLICT (slug) DO UPDATE SET
  label_bn = EXCLUDED.label_bn,
  label_en = EXCLUDED.label_en,
  icon = EXCLUDED.icon,
  href = EXCLUDED.href,
  audience = EXCLUDED.audience,
  sort_order = EXCLUDED.sort_order;

-- ---------------------------------------------------------------------------
-- Home visit status catalog
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.care_home_visit_statuses (
  slug TEXT PRIMARY KEY,
  label_bn TEXT NOT NULL,
  label_en TEXT NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO public.care_home_visit_statuses (slug, label_bn, label_en, is_terminal, sort_order) VALUES
  ('requested', 'অনুরোধ', 'Requested', false, 10),
  ('confirmed', 'নিশ্চিত', 'Confirmed', false, 20),
  ('en_route', 'পথে', 'En route', false, 30),
  ('completed', 'সম্পন্ন', 'Completed', true, 40),
  ('cancelled', 'বাতিল', 'Cancelled', true, 50),
  ('no_show', 'আসেননি', 'No-show', true, 60)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Home Doctor tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.care_home_doctor_profiles (
  doctor_id UUID PRIMARY KEY REFERENCES public.care_doctors(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_online BOOLEAN NOT NULL DEFAULT false,
  fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  about_bn TEXT,
  about_en TEXT,
  visit_minutes INT NOT NULL DEFAULT 30 CHECK (visit_minutes BETWEEN 10 AND 180),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_home_doctor_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.care_doctors(id) ON DELETE CASCADE,
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  upazila TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, district_id, upazila)
);

CREATE INDEX IF NOT EXISTS care_home_doctor_areas_district_idx
  ON public.care_home_doctor_areas (district_id, upazila);

CREATE TABLE IF NOT EXISTS public.care_home_doctor_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.care_doctors(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, weekday, start_time, end_time),
  CHECK (end_time > start_time)
);

CREATE TABLE IF NOT EXISTS public.care_home_visit_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.care_doctors(id) ON DELETE RESTRICT,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'requested' REFERENCES public.care_home_visit_statuses(slug),
  visit_district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  visit_upazila TEXT,
  visit_address TEXT NOT NULL,
  visit_lat DOUBLE PRECISION,
  visit_lng DOUBLE PRECISION,
  patient_name TEXT,
  patient_phone TEXT,
  notes TEXT,
  reference_code TEXT NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8)),
  confirmed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_home_visits_patient_idx
  ON public.care_home_visit_bookings (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS care_home_visits_doctor_idx
  ON public.care_home_visit_bookings (doctor_id, slot_start);
CREATE INDEX IF NOT EXISTS care_home_visits_status_idx
  ON public.care_home_visit_bookings (status);

CREATE UNIQUE INDEX IF NOT EXISTS care_home_visits_slot_uniq
  ON public.care_home_visit_bookings (doctor_id, slot_start)
  WHERE status NOT IN ('cancelled', 'no_show');

CREATE OR REPLACE FUNCTION public.care_home_visit_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS care_home_visit_bookings_touch ON public.care_home_visit_bookings;
CREATE TRIGGER care_home_visit_bookings_touch
  BEFORE UPDATE ON public.care_home_visit_bookings
  FOR EACH ROW EXECUTE FUNCTION public.care_home_visit_touch();

-- ---------------------------------------------------------------------------
-- Lab home collection fields
-- ---------------------------------------------------------------------------

ALTER TABLE public.care_lab_bookings
  ADD COLUMN IF NOT EXISTS collection_mode TEXT,
  ADD COLUMN IF NOT EXISTS collection_district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS collection_upazila TEXT,
  ADD COLUMN IF NOT EXISTS collection_address TEXT,
  ADD COLUMN IF NOT EXISTS collection_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS collection_lng DOUBLE PRECISION;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'care_lab_bookings_collection_mode_check'
  ) THEN
    ALTER TABLE public.care_lab_bookings
      ADD CONSTRAINT care_lab_bookings_collection_mode_check
      CHECK (collection_mode IS NULL OR collection_mode IN ('facility', 'home'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.care_home_flag_on(_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT (care_feature_flags ->> _key)::boolean FROM public.app_settings WHERE id = 1),
    false
  );
$$;

CREATE OR REPLACE FUNCTION public.is_home_doctor(_doctor_id UUID, _uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.care_doctors d
    WHERE d.id = _doctor_id AND d.user_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.care_home_area_matches(
  _doctor_id UUID,
  _district_id UUID,
  _upazila TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.care_home_doctor_areas a
    WHERE a.doctor_id = _doctor_id
      AND a.district_id = _district_id
      AND (
        a.upazila IS NULL
        OR NULLIF(trim(a.upazila), '') IS NULL
        OR lower(trim(a.upazila)) = lower(trim(COALESCE(_upazila, '')))
      )
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.care_home_doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_home_doctor_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_home_doctor_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_home_visit_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_home_visit_statuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS care_home_profiles_select ON public.care_home_doctor_profiles;
CREATE POLICY care_home_profiles_select ON public.care_home_doctor_profiles
  FOR SELECT TO authenticated, anon
  USING (
    is_active = true
    OR public.is_home_doctor(doctor_id)
    OR public.is_care_staff()
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS care_home_profiles_doctor_write ON public.care_home_doctor_profiles;
CREATE POLICY care_home_profiles_doctor_write ON public.care_home_doctor_profiles
  FOR ALL TO authenticated
  USING (
    public.is_home_doctor(doctor_id)
    OR public.is_care_staff()
    OR public.is_admin_staff(auth.uid())
  )
  WITH CHECK (
    public.is_home_doctor(doctor_id)
    OR public.is_care_staff()
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS care_home_areas_select ON public.care_home_doctor_areas;
CREATE POLICY care_home_areas_select ON public.care_home_doctor_areas
  FOR SELECT TO authenticated, anon
  USING (true);

DROP POLICY IF EXISTS care_home_areas_doctor_write ON public.care_home_doctor_areas;
CREATE POLICY care_home_areas_doctor_write ON public.care_home_doctor_areas
  FOR ALL TO authenticated
  USING (
    public.is_home_doctor(doctor_id)
    OR public.is_care_staff()
    OR public.is_admin_staff(auth.uid())
  )
  WITH CHECK (
    public.is_home_doctor(doctor_id)
    OR public.is_care_staff()
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS care_home_slots_select ON public.care_home_doctor_slots;
CREATE POLICY care_home_slots_select ON public.care_home_doctor_slots
  FOR SELECT TO authenticated, anon
  USING (is_active = true OR public.is_home_doctor(doctor_id) OR public.is_care_staff());

DROP POLICY IF EXISTS care_home_slots_doctor_write ON public.care_home_doctor_slots;
CREATE POLICY care_home_slots_doctor_write ON public.care_home_doctor_slots
  FOR ALL TO authenticated
  USING (
    public.is_home_doctor(doctor_id)
    OR public.is_care_staff()
    OR public.is_admin_staff(auth.uid())
  )
  WITH CHECK (
    public.is_home_doctor(doctor_id)
    OR public.is_care_staff()
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS care_home_visits_select ON public.care_home_visit_bookings;
CREATE POLICY care_home_visits_select ON public.care_home_visit_bookings
  FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_home_doctor(doctor_id)
    OR public.is_care_staff()
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS care_home_visits_insert ON public.care_home_visit_bookings;
CREATE POLICY care_home_visits_insert ON public.care_home_visit_bookings
  FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());

DROP POLICY IF EXISTS care_home_visits_update ON public.care_home_visit_bookings;
CREATE POLICY care_home_visits_update ON public.care_home_visit_bookings
  FOR UPDATE TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_home_doctor(doctor_id)
    OR public.is_care_staff()
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS care_home_statuses_select ON public.care_home_visit_statuses;
CREATE POLICY care_home_statuses_select ON public.care_home_visit_statuses
  FOR SELECT TO authenticated, anon
  USING (is_active = true);

-- ---------------------------------------------------------------------------
-- RPCs: join / areas / slots
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.care_home_doctor_join(
  _areas JSONB,
  _fee_amount NUMERIC DEFAULT 0,
  _about_bn TEXT DEFAULT NULL,
  _about_en TEXT DEFAULT NULL,
  _visit_minutes INT DEFAULT 30
)
RETURNS public.care_home_doctor_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  doc public.care_doctors%ROWTYPE;
  prof public.care_home_doctor_profiles%ROWTYPE;
  area JSONB;
  dist UUID;
  upz TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.care_home_flag_on('home_doctor') THEN
    RAISE EXCEPTION 'FLAG_OFF: Home Doctor is disabled';
  END IF;

  SELECT * INTO doc FROM public.care_doctors WHERE user_id = uid LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Doctor profile required'; END IF;
  IF COALESCE(doc.registration_status, 'active') = 'suspended' THEN
    RAISE EXCEPTION 'Doctor account suspended';
  END IF;

  IF _areas IS NULL OR jsonb_typeof(_areas) <> 'array' OR jsonb_array_length(_areas) < 1 THEN
    RAISE EXCEPTION 'Select at least one service area';
  END IF;

  INSERT INTO public.care_home_doctor_profiles (
    doctor_id, is_active, is_online, fee_amount, about_bn, about_en, visit_minutes, joined_at, updated_at
  ) VALUES (
    doc.id, true, false,
    GREATEST(0, COALESCE(_fee_amount, 0)),
    NULLIF(trim(COALESCE(_about_bn, '')), ''),
    NULLIF(trim(COALESCE(_about_en, '')), ''),
    LEAST(180, GREATEST(10, COALESCE(_visit_minutes, 30))),
    now(), now()
  )
  ON CONFLICT (doctor_id) DO UPDATE SET
    is_active = true,
    fee_amount = EXCLUDED.fee_amount,
    about_bn = COALESCE(EXCLUDED.about_bn, care_home_doctor_profiles.about_bn),
    about_en = COALESCE(EXCLUDED.about_en, care_home_doctor_profiles.about_en),
    visit_minutes = EXCLUDED.visit_minutes,
    updated_at = now()
  RETURNING * INTO prof;

  DELETE FROM public.care_home_doctor_areas WHERE doctor_id = doc.id;

  FOR area IN SELECT * FROM jsonb_array_elements(_areas)
  LOOP
    dist := NULLIF(area->>'district_id', '')::UUID;
    upz := NULLIF(trim(COALESCE(area->>'upazila', '')), '');
    IF dist IS NULL THEN
      RAISE EXCEPTION 'district_id required in areas';
    END IF;
    INSERT INTO public.care_home_doctor_areas (doctor_id, district_id, upazila)
    VALUES (doc.id, dist, upz)
    ON CONFLICT (doctor_id, district_id, upazila) DO NOTHING;
  END LOOP;

  RETURN prof;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_home_doctor_join(JSONB, NUMERIC, TEXT, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_home_doctor_set_areas(_areas JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  doc_id UUID;
  area JSONB;
  dist UUID;
  upz TEXT;
  n INT := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO doc_id FROM public.care_doctors WHERE user_id = uid LIMIT 1;
  IF doc_id IS NULL THEN RAISE EXCEPTION 'Doctor profile required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.care_home_doctor_profiles WHERE doctor_id = doc_id) THEN
    RAISE EXCEPTION 'Join Home Doctor first';
  END IF;
  IF _areas IS NULL OR jsonb_typeof(_areas) <> 'array' OR jsonb_array_length(_areas) < 1 THEN
    RAISE EXCEPTION 'Select at least one service area';
  END IF;

  DELETE FROM public.care_home_doctor_areas WHERE doctor_id = doc_id;
  FOR area IN SELECT * FROM jsonb_array_elements(_areas)
  LOOP
    dist := NULLIF(area->>'district_id', '')::UUID;
    upz := NULLIF(trim(COALESCE(area->>'upazila', '')), '');
    IF dist IS NULL THEN CONTINUE; END IF;
    INSERT INTO public.care_home_doctor_areas (doctor_id, district_id, upazila)
    VALUES (doc_id, dist, upz)
    ON CONFLICT DO NOTHING;
    n := n + 1;
  END LOOP;
  UPDATE public.care_home_doctor_profiles SET updated_at = now() WHERE doctor_id = doc_id;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_home_doctor_set_areas(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_home_doctor_replace_slots(_slots JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  doc_id UUID;
  s JSONB;
  n INT := 0;
  wd INT;
  st TIME;
  et TIME;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO doc_id FROM public.care_doctors WHERE user_id = uid LIMIT 1;
  IF doc_id IS NULL THEN RAISE EXCEPTION 'Doctor profile required'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.care_home_doctor_profiles WHERE doctor_id = doc_id) THEN
    RAISE EXCEPTION 'Join Home Doctor first';
  END IF;

  DELETE FROM public.care_home_doctor_slots WHERE doctor_id = doc_id;

  IF _slots IS NULL OR jsonb_typeof(_slots) <> 'array' THEN
    RETURN 0;
  END IF;

  FOR s IN SELECT * FROM jsonb_array_elements(_slots)
  LOOP
    wd := (s->>'weekday')::INT;
    st := (s->>'start_time')::TIME;
    et := (s->>'end_time')::TIME;
    IF wd IS NULL OR wd < 0 OR wd > 6 OR st IS NULL OR et IS NULL OR et <= st THEN
      CONTINUE;
    END IF;
    INSERT INTO public.care_home_doctor_slots (doctor_id, weekday, start_time, end_time, is_active)
    VALUES (doc_id, wd, st, et, true)
    ON CONFLICT DO NOTHING;
    n := n + 1;
  END LOOP;

  UPDATE public.care_home_doctor_profiles SET updated_at = now() WHERE doctor_id = doc_id;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_home_doctor_replace_slots(JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_home_doctor_set_online(_online BOOLEAN)
RETURNS public.care_home_doctor_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  doc_id UUID;
  prof public.care_home_doctor_profiles%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO doc_id FROM public.care_doctors WHERE user_id = uid LIMIT 1;
  IF doc_id IS NULL THEN RAISE EXCEPTION 'Doctor profile required'; END IF;

  UPDATE public.care_home_doctor_profiles
  SET is_online = COALESCE(_online, false), updated_at = now()
  WHERE doctor_id = doc_id AND is_active = true
  RETURNING * INTO prof;

  IF NOT FOUND THEN RAISE EXCEPTION 'Home Doctor profile not found'; END IF;
  RETURN prof;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_home_doctor_set_online(BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_home_doctor_update_profile(
  _fee_amount NUMERIC DEFAULT NULL,
  _about_bn TEXT DEFAULT NULL,
  _about_en TEXT DEFAULT NULL,
  _visit_minutes INT DEFAULT NULL,
  _is_active BOOLEAN DEFAULT NULL
)
RETURNS public.care_home_doctor_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  doc_id UUID;
  prof public.care_home_doctor_profiles%ROWTYPE;
  staff BOOLEAN;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  staff := public.is_care_staff() OR public.is_admin_staff(uid);

  IF staff AND _is_active IS NOT NULL THEN
    -- staff can suspend any via separate admin path; here doctor self only unless staff passes doctor via...
    NULL;
  END IF;

  SELECT id INTO doc_id FROM public.care_doctors WHERE user_id = uid LIMIT 1;
  IF doc_id IS NULL AND NOT staff THEN RAISE EXCEPTION 'Doctor profile required'; END IF;
  IF doc_id IS NULL THEN RAISE EXCEPTION 'Doctor profile required'; END IF;

  UPDATE public.care_home_doctor_profiles
  SET
    fee_amount = COALESCE(_fee_amount, fee_amount),
    about_bn = CASE WHEN _about_bn IS NULL THEN about_bn ELSE NULLIF(trim(_about_bn), '') END,
    about_en = CASE WHEN _about_en IS NULL THEN about_en ELSE NULLIF(trim(_about_en), '') END,
    visit_minutes = COALESCE(
      CASE WHEN _visit_minutes IS NOT NULL THEN LEAST(180, GREATEST(10, _visit_minutes)) ELSE NULL END,
      visit_minutes
    ),
    is_active = COALESCE(_is_active, is_active),
    updated_at = now()
  WHERE doctor_id = doc_id
  RETURNING * INTO prof;

  IF NOT FOUND THEN RAISE EXCEPTION 'Home Doctor profile not found'; END IF;
  RETURN prof;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_home_doctor_update_profile(NUMERIC, TEXT, TEXT, INT, BOOLEAN) TO authenticated;

-- Admin suspend
CREATE OR REPLACE FUNCTION public.care_home_doctor_set_active(_doctor_id UUID, _active BOOLEAN)
RETURNS public.care_home_doctor_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prof public.care_home_doctor_profiles%ROWTYPE;
BEGIN
  IF NOT (public.is_care_staff() OR public.is_admin_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.care_home_doctor_profiles
  SET is_active = COALESCE(_active, false),
      is_online = CASE WHEN COALESCE(_active, false) THEN is_online ELSE false END,
      updated_at = now()
  WHERE doctor_id = _doctor_id
  RETURNING * INTO prof;
  IF NOT FOUND THEN RAISE EXCEPTION 'Home Doctor profile not found'; END IF;
  RETURN prof;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_home_doctor_set_active(UUID, BOOLEAN) TO authenticated;

-- ---------------------------------------------------------------------------
-- Book + status
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.care_home_visit_book(
  _doctor_id UUID,
  _slot_start TIMESTAMPTZ,
  _slot_end TIMESTAMPTZ,
  _visit_district_id UUID,
  _visit_upazila TEXT,
  _visit_address TEXT,
  _visit_lat DOUBLE PRECISION DEFAULT NULL,
  _visit_lng DOUBLE PRECISION DEFAULT NULL,
  _patient_name TEXT DEFAULT NULL,
  _patient_phone TEXT DEFAULT NULL,
  _notes TEXT DEFAULT NULL
)
RETURNS public.care_home_visit_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  prof public.care_home_doctor_profiles%ROWTYPE;
  booking public.care_home_visit_bookings%ROWTYPE;
  addr TEXT := NULLIF(trim(COALESCE(_visit_address, '')), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT public.care_home_flag_on('home_doctor') THEN
    RAISE EXCEPTION 'FLAG_OFF: Home Doctor is disabled';
  END IF;
  IF addr IS NULL THEN RAISE EXCEPTION 'Visit address required'; END IF;
  IF _visit_district_id IS NULL THEN RAISE EXCEPTION 'District required'; END IF;
  IF _slot_start IS NULL OR _slot_end IS NULL OR _slot_end <= _slot_start THEN
    RAISE EXCEPTION 'Invalid slot';
  END IF;
  IF _slot_start < now() - interval '2 minutes' THEN
    RAISE EXCEPTION 'Slot is in the past';
  END IF;

  SELECT * INTO prof
  FROM public.care_home_doctor_profiles
  WHERE doctor_id = _doctor_id AND is_active = true;
  IF NOT FOUND THEN RAISE EXCEPTION 'Doctor not available for home visits'; END IF;

  IF NOT public.care_home_area_matches(_doctor_id, _visit_district_id, _visit_upazila) THEN
    RAISE EXCEPTION 'OUT_OF_AREA: Doctor does not serve this area';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.care_home_visit_bookings b
    WHERE b.doctor_id = _doctor_id
      AND b.slot_start = _slot_start
      AND b.status NOT IN ('cancelled', 'no_show')
  ) THEN
    RAISE EXCEPTION 'SLOT_TAKEN: Slot already booked';
  END IF;

  INSERT INTO public.care_home_visit_bookings (
    patient_id, doctor_id, slot_start, slot_end, fee_amount, status,
    visit_district_id, visit_upazila, visit_address, visit_lat, visit_lng,
    patient_name, patient_phone, notes
  ) VALUES (
    uid, _doctor_id, _slot_start, _slot_end, COALESCE(prof.fee_amount, 0), 'requested',
    _visit_district_id,
    NULLIF(trim(COALESCE(_visit_upazila, '')), ''),
    addr, _visit_lat, _visit_lng,
    NULLIF(trim(COALESCE(_patient_name, '')), ''),
    NULLIF(trim(COALESCE(_patient_phone, '')), ''),
    NULLIF(trim(COALESCE(_notes, '')), '')
  )
  RETURNING * INTO booking;

  RETURN booking;
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'SLOT_TAKEN: Slot already booked';
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_home_visit_book(
  UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION, TEXT, TEXT, TEXT
) TO authenticated;

CREATE OR REPLACE FUNCTION public.care_home_visit_set_status(
  _booking_id UUID,
  _status TEXT
)
RETURNS public.care_home_visit_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  booking public.care_home_visit_bookings%ROWTYPE;
  allowed TEXT[] := ARRAY['requested', 'confirmed', 'en_route', 'completed', 'cancelled', 'no_show'];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _status IS NULL OR NOT (_status = ANY (allowed)) THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  SELECT * INTO booking FROM public.care_home_visit_bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF NOT (
    booking.patient_id = uid
    OR public.is_home_doctor(booking.doctor_id, uid)
    OR public.is_care_staff()
    OR public.is_admin_staff(uid)
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- Patients may only cancel their own pending/confirmed
  IF booking.patient_id = uid
     AND NOT public.is_home_doctor(booking.doctor_id, uid)
     AND NOT public.is_care_staff()
     AND NOT public.is_admin_staff(uid)
  THEN
    IF _status <> 'cancelled' THEN
      RAISE EXCEPTION 'Patients may only cancel';
    END IF;
    IF booking.status IN ('completed', 'cancelled', 'no_show', 'en_route') THEN
      RAISE EXCEPTION 'Cannot cancel this booking';
    END IF;
  END IF;

  UPDATE public.care_home_visit_bookings
  SET
    status = _status,
    confirmed_at = CASE WHEN _status = 'confirmed' THEN COALESCE(confirmed_at, now()) ELSE confirmed_at END,
    completed_at = CASE WHEN _status = 'completed' THEN now() ELSE completed_at END,
    cancelled_at = CASE WHEN _status IN ('cancelled', 'no_show') THEN now() ELSE cancelled_at END,
    updated_at = now()
  WHERE id = _booking_id
  RETURNING * INTO booking;

  RETURN booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_home_visit_set_status(UUID, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Lab: set home collection on booking after reserve
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.care_lab_set_home_collection(
  _booking_id UUID,
  _district_id UUID,
  _upazila TEXT,
  _address TEXT,
  _lat DOUBLE PRECISION DEFAULT NULL,
  _lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS public.care_lab_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  booking public.care_lab_bookings%ROWTYPE;
  off public.care_test_offerings%ROWTYPE;
  addr TEXT := NULLIF(trim(COALESCE(_address, '')), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT public.care_home_flag_on('home_diagnostic') AND NOT public.care_home_flag_on('home_collection') THEN
    RAISE EXCEPTION 'FLAG_OFF: Home Diagnostic is disabled';
  END IF;
  IF addr IS NULL THEN RAISE EXCEPTION 'Collection address required'; END IF;
  IF _district_id IS NULL THEN RAISE EXCEPTION 'District required'; END IF;

  SELECT * INTO booking FROM public.care_lab_bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF booking.patient_id IS DISTINCT FROM uid
     AND NOT public.care_has_permission(booking.org_id, 'lab.checkin', uid)
     AND NOT public.is_care_staff()
  THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO off FROM public.care_test_offerings WHERE id = booking.offering_id;
  IF NOT FOUND OR off.home_collection IS NOT TRUE THEN
    RAISE EXCEPTION 'Offering does not support home collection';
  END IF;

  UPDATE public.care_lab_bookings
  SET
    collection_mode = 'home',
    collection_district_id = _district_id,
    collection_upazila = NULLIF(trim(COALESCE(_upazila, '')), ''),
    collection_address = addr,
    collection_lat = _lat,
    collection_lng = _lng,
    guest_address = COALESCE(guest_address, addr)
  WHERE id = _booking_id
     OR (invoice_group_id IS NOT NULL AND invoice_group_id = booking.invoice_group_id)
  RETURNING * INTO booking;

  -- Prefer returning the primary row
  SELECT * INTO booking FROM public.care_lab_bookings WHERE id = _booking_id;
  RETURN booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_lab_set_home_collection(
  UUID, UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION
) TO authenticated;

-- Apply collection to whole invoice group
CREATE OR REPLACE FUNCTION public.care_lab_set_home_collection_group(
  _invoice_group_id UUID,
  _district_id UUID,
  _upazila TEXT,
  _address TEXT,
  _lat DOUBLE PRECISION DEFAULT NULL,
  _lng DOUBLE PRECISION DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  first_id UUID;
  n INT := 0;
  addr TEXT := NULLIF(trim(COALESCE(_address, '')), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT public.care_home_flag_on('home_diagnostic') AND NOT public.care_home_flag_on('home_collection') THEN
    RAISE EXCEPTION 'FLAG_OFF: Home Diagnostic is disabled';
  END IF;
  IF addr IS NULL OR _district_id IS NULL THEN RAISE EXCEPTION 'Location required'; END IF;

  SELECT id INTO first_id
  FROM public.care_lab_bookings
  WHERE invoice_group_id = _invoice_group_id OR id = _invoice_group_id
  LIMIT 1;
  IF first_id IS NULL THEN RAISE EXCEPTION 'Booking not found'; END IF;

  PERFORM public.care_lab_set_home_collection(
    first_id, _district_id, _upazila, _address, _lat, _lng
  );

  GET DIAGNOSTICS n = ROW_COUNT;
  SELECT count(*)::INT INTO n
  FROM public.care_lab_bookings
  WHERE (invoice_group_id = _invoice_group_id OR id = _invoice_group_id)
    AND collection_mode = 'home';
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_lab_set_home_collection_group(
  UUID, UUID, TEXT, TEXT, DOUBLE PRECISION, DOUBLE PRECISION
) TO authenticated;
