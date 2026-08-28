-- Operation (surgery) booking module. Mirrors the lab module's
-- catalog -> offering -> booking shape so the desk, invoice and RLS patterns
-- carry over: an admin-owned procedure catalog, per-clinic package pricing with
-- an optional breakdown, several doctors per offering, and bookings that the
-- patient requests and the desk confirms with a final date and time.

-- ─── Categories ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.care_operation_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

-- ─── Admin-controlled procedure catalog ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.care_operation_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  category_id UUID REFERENCES public.care_operation_categories(id) ON DELETE SET NULL,
  specialty_id UUID REFERENCES public.care_specialties(id) ON DELETE SET NULL,
  description_bn TEXT,
  description_en TEXT,
  prep_bn TEXT,
  prep_en TEXT,
  typical_duration_minutes INT,
  typical_stay_days INT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Per-clinic package price ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.care_operation_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.care_locations(id) ON DELETE CASCADE,
  catalog_id UUID NOT NULL REFERENCES public.care_operation_catalog(id) ON DELETE CASCADE,
  package_price NUMERIC(12, 2) NOT NULL,
  price_original NUMERIC(12, 2),
  discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  price_note TEXT,
  includes_bn TEXT,
  includes_en TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, location_id, catalog_id)
);

-- ─── Optional package breakdown shown on the invoice ────────────────────────
CREATE TABLE IF NOT EXISTS public.care_operation_price_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID NOT NULL REFERENCES public.care_operation_offerings(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('surgeon', 'ot', 'anesthesia', 'bed', 'investigation', 'medicine', 'other')),
  label_bn TEXT,
  label_en TEXT,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

-- ─── Surgical team per offering ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.care_operation_offering_doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID NOT NULL REFERENCES public.care_operation_offerings(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.care_doctors(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'lead_surgeon'
    CHECK (role IN ('lead_surgeon', 'assistant', 'anesthetist', 'consultant')),
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (offering_id, doctor_id)
);

-- ─── Statuses ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.care_operation_statuses (
  slug TEXT PRIMARY KEY,
  label_bn TEXT NOT NULL,
  label_en TEXT NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO public.care_operation_statuses (slug, label_bn, label_en, is_terminal, sort_order) VALUES
  ('requested', 'অনুরোধ', 'Requested', false, 10),
  ('confirmed', 'নিশ্চিত', 'Confirmed', false, 20),
  ('in_progress', 'চলছে', 'In progress', false, 30),
  ('completed', 'সম্পন্ন', 'Completed', true, 40),
  ('cancelled', 'বাতিল', 'Cancelled', true, 50),
  ('no_show', 'আসেননি', 'No-show', true, 60)
ON CONFLICT (slug) DO NOTHING;

-- ─── Bookings ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.care_operation_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID NOT NULL REFERENCES public.care_operation_offerings(id) ON DELETE RESTRICT,
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.care_locations(id) ON DELETE CASCADE,
  catalog_id UUID NOT NULL REFERENCES public.care_operation_catalog(id) ON DELETE RESTRICT,
  patient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_phone TEXT,
  guest_age TEXT,
  guest_sex TEXT,
  guest_address TEXT,
  referred_by TEXT,
  source TEXT NOT NULL DEFAULT 'online',
  status TEXT NOT NULL DEFAULT 'requested' REFERENCES public.care_operation_statuses(slug),
  requested_date DATE,
  scheduled_date DATE,
  scheduled_start TIME,
  scheduled_end TIME,
  admission_date DATE,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  price_original NUMERIC(12, 2),
  discount_percent NUMERIC(5, 2),
  invoice_no TEXT,
  reference_code TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'waived')),
  amount_received NUMERIC(12, 2),
  patient_note TEXT,
  desk_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team snapshot at booking time, so later staff changes do not rewrite history.
CREATE TABLE IF NOT EXISTS public.care_operation_booking_doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.care_operation_bookings(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.care_doctors(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'lead_surgeon',
  doctor_name_snapshot TEXT,
  UNIQUE (booking_id, doctor_id)
);

CREATE INDEX IF NOT EXISTS care_op_offerings_org_idx ON public.care_operation_offerings (org_id, is_active);
CREATE INDEX IF NOT EXISTS care_op_offerings_catalog_idx ON public.care_operation_offerings (catalog_id);
CREATE INDEX IF NOT EXISTS care_op_off_doctors_doc_idx ON public.care_operation_offering_doctors (doctor_id);
CREATE INDEX IF NOT EXISTS care_op_bookings_org_idx ON public.care_operation_bookings (org_id, status, scheduled_date);
CREATE INDEX IF NOT EXISTS care_op_bookings_patient_idx ON public.care_operation_bookings (patient_id, created_at DESC);

-- ─── Permissions ────────────────────────────────────────────────────────────
INSERT INTO public.care_permission_catalog (key, group_key, label_en, label_bn, sort_order) VALUES
  ('operation.view', 'operation', 'View operation bookings', 'অপারেশন বুকিং দেখা', 90),
  ('operation.manage', 'operation', 'Manage operation pricing & team', 'অপারেশন মূল্য ও টিম', 91),
  ('operation.schedule', 'operation', 'Confirm operation date & time', 'অপারেশন তারিখ নির্ধারণ', 92)
ON CONFLICT (key) DO NOTHING;

-- care_org_roles.permissions is a frozen TEXT[], so existing owners would never
-- receive the new keys without recomputing the array.
UPDATE public.care_org_roles
SET permissions = ARRAY(SELECT key FROM public.care_permission_catalog ORDER BY sort_order)
WHERE slug = 'owner' AND permissions IS NOT NULL;

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.care_operation_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_operation_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_operation_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_operation_price_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_operation_offering_doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_operation_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_operation_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.care_operation_booking_doctors ENABLE ROW LEVEL SECURITY;

-- Reference data: public read, staff write.
DROP POLICY IF EXISTS care_op_cat_read ON public.care_operation_categories;
CREATE POLICY care_op_cat_read ON public.care_operation_categories FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS care_op_cat_write ON public.care_operation_categories;
CREATE POLICY care_op_cat_write ON public.care_operation_categories FOR ALL TO authenticated
  USING (public.is_care_staff()) WITH CHECK (public.is_care_staff());

DROP POLICY IF EXISTS care_op_catalog_read ON public.care_operation_catalog;
CREATE POLICY care_op_catalog_read ON public.care_operation_catalog FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS care_op_catalog_write ON public.care_operation_catalog;
CREATE POLICY care_op_catalog_write ON public.care_operation_catalog FOR ALL TO authenticated
  USING (public.is_care_staff()) WITH CHECK (public.is_care_staff());

DROP POLICY IF EXISTS care_op_status_read ON public.care_operation_statuses;
CREATE POLICY care_op_status_read ON public.care_operation_statuses FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS care_op_status_write ON public.care_operation_statuses;
CREATE POLICY care_op_status_write ON public.care_operation_statuses FOR ALL TO authenticated
  USING (public.is_care_staff()) WITH CHECK (public.is_care_staff());

-- Offerings: patients see listed clinics; desks manage their own.
DROP POLICY IF EXISTS care_op_off_read ON public.care_operation_offerings;
CREATE POLICY care_op_off_read ON public.care_operation_offerings FOR SELECT TO authenticated, anon
  USING (
    (is_active AND EXISTS (
      SELECT 1 FROM public.care_orgs o
      WHERE o.id = org_id AND o.is_verified AND o.is_listed AND o.is_active
    ))
    OR public.is_care_member(org_id)
    OR public.is_care_staff()
  );
DROP POLICY IF EXISTS care_op_off_write ON public.care_operation_offerings;
CREATE POLICY care_op_off_write ON public.care_operation_offerings FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'operation.manage') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'operation.manage') OR public.is_care_staff());

DROP POLICY IF EXISTS care_op_items_read ON public.care_operation_price_items;
CREATE POLICY care_op_items_read ON public.care_operation_price_items FOR SELECT TO authenticated, anon
  USING (EXISTS (SELECT 1 FROM public.care_operation_offerings f WHERE f.id = offering_id));
DROP POLICY IF EXISTS care_op_items_write ON public.care_operation_price_items;
CREATE POLICY care_op_items_write ON public.care_operation_price_items FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.care_operation_offerings f
    WHERE f.id = offering_id
      AND (public.care_has_permission(f.org_id, 'operation.manage') OR public.is_care_staff())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.care_operation_offerings f
    WHERE f.id = offering_id
      AND (public.care_has_permission(f.org_id, 'operation.manage') OR public.is_care_staff())
  ));

DROP POLICY IF EXISTS care_op_offdoc_read ON public.care_operation_offering_doctors;
CREATE POLICY care_op_offdoc_read ON public.care_operation_offering_doctors FOR SELECT TO authenticated, anon
  USING (EXISTS (SELECT 1 FROM public.care_operation_offerings f WHERE f.id = offering_id));
DROP POLICY IF EXISTS care_op_offdoc_write ON public.care_operation_offering_doctors;
CREATE POLICY care_op_offdoc_write ON public.care_operation_offering_doctors FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.care_operation_offerings f
    WHERE f.id = offering_id
      AND (public.care_has_permission(f.org_id, 'operation.manage') OR public.is_care_staff())
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.care_operation_offerings f
    WHERE f.id = offering_id
      AND (public.care_has_permission(f.org_id, 'operation.manage') OR public.is_care_staff())
  ));

-- Bookings: read by owner / desk; all writes go through RPCs, like the lab.
DROP POLICY IF EXISTS care_op_book_read ON public.care_operation_bookings;
CREATE POLICY care_op_book_read ON public.care_operation_bookings FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.care_has_permission(org_id, 'operation.view')
    OR public.care_has_permission(org_id, 'operation.manage')
    OR public.is_care_staff()
  );
DROP POLICY IF EXISTS care_op_book_no_ins ON public.care_operation_bookings;
CREATE POLICY care_op_book_no_ins ON public.care_operation_bookings FOR INSERT TO authenticated
  WITH CHECK (false);
DROP POLICY IF EXISTS care_op_book_no_upd ON public.care_operation_bookings;
CREATE POLICY care_op_book_no_upd ON public.care_operation_bookings FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS care_op_bookdoc_read ON public.care_operation_booking_doctors;
CREATE POLICY care_op_bookdoc_read ON public.care_operation_booking_doctors FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.care_operation_bookings b
    WHERE b.id = booking_id
      AND (
        b.patient_id = auth.uid()
        OR public.care_has_permission(b.org_id, 'operation.view')
        OR public.care_has_permission(b.org_id, 'operation.manage')
        OR public.is_care_staff()
      )
  ));

-- ─── RPC: patient requests an operation ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.care_request_operation(
  _offering_id UUID,
  _requested_date DATE DEFAULT NULL,
  _guest_name TEXT DEFAULT NULL,
  _guest_phone TEXT DEFAULT NULL,
  _guest_age TEXT DEFAULT NULL,
  _guest_sex TEXT DEFAULT NULL,
  _guest_address TEXT DEFAULT NULL,
  _referred_by TEXT DEFAULT NULL,
  _patient_note TEXT DEFAULT NULL,
  _source TEXT DEFAULT 'online',
  _doctor_ids UUID[] DEFAULT NULL
)
RETURNS public.care_operation_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  off public.care_operation_offerings%ROWTYPE;
  booking public.care_operation_bookings%ROWTYPE;
  inv_no TEXT;
  ids UUID[];
BEGIN
  SELECT * INTO off FROM public.care_operation_offerings WHERE id = _offering_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operation offering not found'; END IF;

  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF _requested_date IS NOT NULL AND _requested_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Requested date cannot be in the past';
  END IF;

  INSERT INTO public.care_operation_bookings (
    offering_id, org_id, location_id, catalog_id, patient_id,
    guest_name, guest_phone, guest_age, guest_sex, guest_address, referred_by,
    source, status, requested_date, price, price_original, discount_percent,
    reference_code, patient_note
  ) VALUES (
    off.id, off.org_id, off.location_id, off.catalog_id, auth.uid(),
    NULLIF(TRIM(COALESCE(_guest_name, '')), ''),
    NULLIF(TRIM(COALESCE(_guest_phone, '')), ''),
    NULLIF(TRIM(COALESCE(_guest_age, '')), ''),
    NULLIF(TRIM(COALESCE(_guest_sex, '')), ''),
    NULLIF(TRIM(COALESCE(_guest_address, '')), ''),
    NULLIF(TRIM(COALESCE(_referred_by, '')), ''),
    COALESCE(NULLIF(TRIM(COALESCE(_source, '')), ''), 'online'),
    'requested',
    _requested_date,
    off.package_price,
    off.price_original,
    off.discount_percent,
    'OP' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)),
    NULLIF(TRIM(COALESCE(_patient_note, '')), '')
  )
  RETURNING * INTO booking;

  inv_no := 'BLO-' || to_char(booking.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD')
    || '-' || upper(substr(replace(booking.id::text, '-', ''), 1, 8));

  UPDATE public.care_operation_bookings SET invoice_no = inv_no WHERE id = booking.id
  RETURNING * INTO booking;

  -- Snapshot the requested surgeons, defaulting to the offering's whole team.
  ids := COALESCE(
    _doctor_ids,
    ARRAY(SELECT doctor_id FROM public.care_operation_offering_doctors WHERE offering_id = off.id)
  );

  INSERT INTO public.care_operation_booking_doctors (booking_id, doctor_id, role, doctor_name_snapshot)
  SELECT booking.id, d.id, COALESCE(od.role, 'lead_surgeon'), d.full_name
  FROM public.care_doctors d
  LEFT JOIN public.care_operation_offering_doctors od
    ON od.doctor_id = d.id AND od.offering_id = off.id
  WHERE d.id = ANY(ids)
  ON CONFLICT (booking_id, doctor_id) DO NOTHING;

  PERFORM public.care_write_audit(booking.org_id, 'operation.request', 'care_operation_bookings', booking.id,
    jsonb_build_object('offering_id', off.id, 'requested_date', _requested_date, 'invoice_no', inv_no));

  RETURN booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_request_operation(UUID, DATE, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID[]) TO authenticated;

-- ─── RPC: desk confirms the final date and time ─────────────────────────────
CREATE OR REPLACE FUNCTION public.care_set_operation_schedule(
  _booking_id UUID,
  _scheduled_date DATE,
  _scheduled_start TIME DEFAULT NULL,
  _scheduled_end TIME DEFAULT NULL,
  _admission_date DATE DEFAULT NULL,
  _desk_note TEXT DEFAULT NULL
)
RETURNS public.care_operation_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking public.care_operation_bookings%ROWTYPE;
BEGIN
  SELECT * INTO booking FROM public.care_operation_bookings WHERE id = _booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF NOT public.care_has_permission(booking.org_id, 'operation.schedule') AND NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _scheduled_date IS NULL THEN RAISE EXCEPTION 'Scheduled date is required'; END IF;
  IF _scheduled_start IS NOT NULL AND _scheduled_end IS NOT NULL AND _scheduled_end <= _scheduled_start THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;

  UPDATE public.care_operation_bookings
  SET scheduled_date = _scheduled_date,
      scheduled_start = _scheduled_start,
      scheduled_end = _scheduled_end,
      admission_date = _admission_date,
      desk_note = COALESCE(NULLIF(TRIM(COALESCE(_desk_note, '')), ''), desk_note),
      status = CASE WHEN status = 'requested' THEN 'confirmed' ELSE status END
  WHERE id = _booking_id
  RETURNING * INTO booking;

  PERFORM public.care_write_audit(booking.org_id, 'operation.schedule', 'care_operation_bookings', booking.id,
    jsonb_build_object(
      'scheduled_date', _scheduled_date,
      'scheduled_start', _scheduled_start,
      'scheduled_end', _scheduled_end,
      'admission_date', _admission_date
    ));

  RETURN booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_set_operation_schedule(UUID, DATE, TIME, TIME, DATE, TEXT) TO authenticated;

-- ─── RPC: status ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.care_set_operation_status(_booking_id UUID, _status TEXT)
RETURNS public.care_operation_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking public.care_operation_bookings%ROWTYPE;
  is_owner BOOLEAN;
BEGIN
  SELECT * INTO booking FROM public.care_operation_bookings WHERE id = _booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.care_operation_statuses WHERE slug = _status) THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;

  is_owner := booking.patient_id = auth.uid();

  -- The patient may only withdraw a booking that has not started.
  IF is_owner AND _status = 'cancelled' AND booking.status IN ('requested', 'confirmed') THEN
    NULL;
  ELSIF NOT public.care_has_permission(booking.org_id, 'operation.view')
    AND NOT public.care_has_permission(booking.org_id, 'operation.schedule')
    AND NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.care_operation_bookings SET status = _status WHERE id = _booking_id
  RETURNING * INTO booking;

  PERFORM public.care_write_audit(booking.org_id, 'operation.status.' || _status,
    'care_operation_bookings', booking.id, jsonb_build_object('status', _status));

  RETURN booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_set_operation_status(UUID, TEXT) TO authenticated;

-- ─── RPC: payment ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.care_set_operation_payment(
  _booking_id UUID,
  _payment_status TEXT,
  _amount_received NUMERIC DEFAULT NULL
)
RETURNS public.care_operation_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking public.care_operation_bookings%ROWTYPE;
  recv NUMERIC(12, 2);
BEGIN
  IF _payment_status NOT IN ('pending', 'paid', 'waived') THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  SELECT * INTO booking FROM public.care_operation_bookings WHERE id = _booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF NOT public.care_has_permission(booking.org_id, 'operation.view')
     AND NOT public.care_has_permission(booking.org_id, 'operation.schedule')
     AND NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF _payment_status = 'waived' THEN
    recv := 0;
  ELSIF _payment_status = 'pending' THEN
    recv := NULL;
  ELSIF _amount_received IS NOT NULL THEN
    recv := GREATEST(0, _amount_received);
  ELSE
    recv := NULL; -- view-model treats paid + null as full payable
  END IF;

  UPDATE public.care_operation_bookings
  SET payment_status = _payment_status, amount_received = recv
  WHERE id = _booking_id
  RETURNING * INTO booking;

  PERFORM public.care_write_audit(booking.org_id, 'operation.payment.' || _payment_status,
    'care_operation_bookings', booking.id,
    jsonb_build_object('payment_status', _payment_status, 'amount_received', recv));

  RETURN booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_set_operation_payment(UUID, TEXT, NUMERIC) TO authenticated;

-- ─── Catalog seed ───────────────────────────────────────────────────────────
-- Surgical specialties the original seed did not include.
INSERT INTO public.care_specialties (slug, name_bn, name_en, sort_order) VALUES
  ('surgery', 'সার্জারি', 'Surgery', 85),
  ('ophthalmology', 'চক্ষু', 'Ophthalmology', 90),
  ('urology', 'ইউরোলজি', 'Urology', 95)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.care_operation_categories (slug, name_bn, name_en, sort_order) VALUES
  ('general', 'জেনারেল সার্জারি', 'General surgery', 10),
  ('obgyn', 'গাইনি ও প্রসূতি', 'Obstetrics & gynaecology', 20),
  ('ortho', 'অর্থোপেডিক', 'Orthopaedics', 30),
  ('eye', 'চক্ষু', 'Eye', 40),
  ('ent', 'নাক-কান-গলা', 'ENT', 50),
  ('uro', 'ইউরোলজি', 'Urology', 60),
  ('cardio', 'কার্ডিয়াক', 'Cardiac', 70),
  ('paeds', 'শিশু সার্জারি', 'Paediatric surgery', 80)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.care_operation_catalog
  (code, name_bn, name_en, category_id, specialty_id, prep_bn, prep_en, typical_duration_minutes, typical_stay_days, sort_order)
SELECT v.code, v.name_bn, v.name_en,
       (SELECT id FROM public.care_operation_categories WHERE slug = v.cat),
       (SELECT id FROM public.care_specialties WHERE slug = v.spec),
       v.prep_bn, v.prep_en, v.mins, v.days, v.sort_order
FROM (VALUES
  ('OP-APPEN', 'অ্যাপেন্ডিক্স অপারেশন', 'Appendectomy', 'general', 'surgery', '৬ ঘণ্টা খালি পেটে থাকতে হবে', 'Fast for 6 hours before surgery', 60, 2, 10),
  ('OP-HERNIA', 'হার্নিয়া অপারেশন', 'Hernia repair', 'general', 'surgery', '৬ ঘণ্টা খালি পেটে', 'Fast for 6 hours', 90, 2, 20),
  ('OP-GALL', 'পিত্তথলির পাথর অপারেশন', 'Cholecystectomy (gallbladder)', 'general', 'surgery', 'আগের রাত থেকে খালি পেটে', 'Nil by mouth from the night before', 90, 2, 30),
  ('OP-PILES', 'পাইলস অপারেশন', 'Haemorrhoidectomy', 'general', 'surgery', NULL, NULL, 45, 1, 40),
  ('OP-THYROID', 'থাইরয়েড অপারেশন', 'Thyroidectomy', 'general', 'surgery', NULL, NULL, 150, 3, 50),
  ('OP-CS', 'সিজারিয়ান অপারেশন', 'Caesarean section', 'obgyn', 'gynecology', 'ভর্তির আগে রক্তের গ্রুপ ও CBC', 'Blood group and CBC before admission', 60, 3, 60),
  ('OP-HYST', 'জরায়ু অপসারণ', 'Hysterectomy', 'obgyn', 'gynecology', NULL, NULL, 150, 4, 70),
  ('OP-DNC', 'ডি অ্যান্ড সি', 'Dilatation & curettage', 'obgyn', 'gynecology', NULL, NULL, 30, 1, 80),
  ('OP-FRACT', 'হাড় জোড়া লাগানো', 'Fracture fixation', 'ortho', 'orthopedics', 'এক্স-রে সঙ্গে আনুন', 'Bring your X-ray films', 120, 3, 90),
  ('OP-KNEE', 'হাঁটু প্রতিস্থাপন', 'Total knee replacement', 'ortho', 'orthopedics', NULL, NULL, 180, 5, 100),
  ('OP-ARTHRO', 'আর্থ্রোস্কোপি', 'Knee arthroscopy', 'ortho', 'orthopedics', NULL, NULL, 60, 1, 110),
  ('OP-CATARACT', 'চোখের ছানি অপারেশন', 'Cataract surgery', 'eye', 'ophthalmology', 'চোখের ড্রপ নিয়ম মেনে দিন', 'Use the prescribed eye drops on schedule', 30, 1, 120),
  ('OP-PTERY', 'নেত্রনালি অপারেশন', 'Pterygium excision', 'eye', 'ophthalmology', NULL, NULL, 30, 1, 130),
  ('OP-TONSIL', 'টনসিল অপারেশন', 'Tonsillectomy', 'ent', 'ent', '৬ ঘণ্টা খালি পেটে', 'Fast for 6 hours', 45, 2, 140),
  ('OP-SEPTO', 'নাকের হাড় সোজা করা', 'Septoplasty', 'ent', 'ent', NULL, NULL, 60, 1, 150),
  ('OP-FESS', 'সাইনাস অপারেশন', 'Endoscopic sinus surgery', 'ent', 'ent', NULL, NULL, 90, 2, 160),
  ('OP-KIDSTONE', 'কিডনির পাথর অপসারণ', 'Kidney stone removal (PCNL)', 'uro', 'urology', 'ইউরিন কালচার রিপোর্ট লাগবে', 'Urine culture report required', 120, 3, 170),
  ('OP-TURP', 'প্রোস্টেট অপারেশন', 'TURP (prostate)', 'uro', 'urology', NULL, NULL, 90, 3, 180),
  ('OP-HYDRO', 'হাইড্রোসিল অপারেশন', 'Hydrocelectomy', 'uro', 'urology', NULL, NULL, 45, 1, 190),
  ('OP-CABG', 'হার্টের বাইপাস সার্জারি', 'Coronary artery bypass (CABG)', 'cardio', 'cardiology', 'ভর্তির আগে সম্পূর্ণ কার্ডিয়াক মূল্যায়ন', 'Full cardiac work-up before admission', 300, 8, 200),
  ('OP-PACE', 'পেসমেকার স্থাপন', 'Pacemaker implantation', 'cardio', 'cardiology', NULL, NULL, 90, 2, 210),
  ('OP-CIRCUM', 'শিশুর মুসলমানি', 'Circumcision', 'paeds', 'pediatrics', NULL, NULL, 30, 1, 220)
) AS v(code, name_bn, name_en, cat, spec, prep_bn, prep_en, mins, days, sort_order)
ON CONFLICT (code) DO NOTHING;

-- ─── Care hub module entry (patient browse tab) ──────────────────────────────
INSERT INTO public.care_hub_modules (slug, label_bn, label_en, icon, href, audience, sort_order)
VALUES ('operations', 'অপারেশন', 'Operations', 'Scissors', '/care?tab=operations', 'patient', 35)
ON CONFLICT (slug) DO UPDATE SET
  label_bn = EXCLUDED.label_bn,
  label_en = EXCLUDED.label_en,
  icon = EXCLUDED.icon,
  href = EXCLUDED.href,
  audience = EXCLUDED.audience,
  sort_order = EXCLUDED.sort_order;
