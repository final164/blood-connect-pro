-- Schedule slot booking: profile meta, settings flags, booking validation, demo schedules

ALTER TABLE public.tele_doctor_profiles
  ADD COLUMN IF NOT EXISTS slot_minutes INT NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS follow_up_fee NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS follow_up_days INT NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS avg_consult_minutes INT NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS doctor_code TEXT,
  ADD COLUMN IF NOT EXISTS patients_attended INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS joined_at DATE,
  ADD COLUMN IF NOT EXISTS specialty_tags_bn TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS specialty_tags_en TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notice_bn TEXT,
  ADD COLUMN IF NOT EXISTS notice_en TEXT,
  ADD COLUMN IF NOT EXISTS instructions_bn TEXT,
  ADD COLUMN IF NOT EXISTS instructions_en TEXT,
  ADD COLUMN IF NOT EXISTS helpline TEXT,
  ADD COLUMN IF NOT EXISTS chamber_address_bn TEXT,
  ADD COLUMN IF NOT EXISTS chamber_address_en TEXT,
  ADD COLUMN IF NOT EXISTS schedule_public BOOLEAN NOT NULL DEFAULT true;

UPDATE public.app_settings
SET tele_settings = COALESCE(tele_settings, '{}'::jsonb) || jsonb_build_object(
  'default_slot_minutes', COALESCE((tele_settings->>'default_slot_minutes')::int, 15),
  'slot_horizon_days', COALESCE((tele_settings->>'slot_horizon_days')::int, 14),
  'consultant_can_edit_schedule', COALESCE((tele_settings->>'consultant_can_edit_schedule')::boolean, true),
  'require_slot_for_named', COALESCE((tele_settings->>'require_slot_for_named')::boolean, true),
  'ui', COALESCE(tele_settings->'ui', '{}'::jsonb) || jsonb_build_object(
    'slot_modal_title_bn', COALESCE(tele_settings->'ui'->>'slot_modal_title_bn', 'উপলব্ধ সময় স্লট'),
    'slot_modal_title_en', COALESCE(tele_settings->'ui'->>'slot_modal_title_en', 'Available Time Slots'),
    'slot_select_hint_bn', COALESCE(tele_settings->'ui'->>'slot_select_hint_bn', 'আপনার অ্যাপয়েন্টমেন্ট সময় বেছে নিন'),
    'slot_select_hint_en', COALESCE(tele_settings->'ui'->>'slot_select_hint_en', 'Select your appointment time'),
    'slot_legend_available_bn', COALESCE(tele_settings->'ui'->>'slot_legend_available_bn', 'উপলব্ধ'),
    'slot_legend_available_en', COALESCE(tele_settings->'ui'->>'slot_legend_available_en', 'Available'),
    'slot_legend_unavailable_bn', COALESCE(tele_settings->'ui'->>'slot_legend_unavailable_bn', 'নাই'),
    'slot_legend_unavailable_en', COALESCE(tele_settings->'ui'->>'slot_legend_unavailable_en', 'Not available'),
    'slot_legend_selected_bn', COALESCE(tele_settings->'ui'->>'slot_legend_selected_bn', 'নির্বাচিত'),
    'slot_legend_selected_en', COALESCE(tele_settings->'ui'->>'slot_legend_selected_en', 'Selected')
  )
)
WHERE id = 1;

CREATE UNIQUE INDEX IF NOT EXISTS tele_bookings_doctor_slot_uidx
  ON public.tele_bookings (doctor_id, slot_start)
  WHERE doctor_id IS NOT NULL
    AND slot_start IS NOT NULL
    AND status NOT IN ('cancelled', 'no_show');

CREATE OR REPLACE FUNCTION public.tele_create_booking(
  _mode TEXT,
  _doctor_id UUID DEFAULT NULL,
  _specialty_id UUID DEFAULT NULL,
  _offer_card_id UUID DEFAULT NULL,
  _slot_start TIMESTAMPTZ DEFAULT NULL,
  _slot_end TIMESTAMPTZ DEFAULT NULL,
  _patient_phone TEXT DEFAULT NULL,
  _patient_name TEXT DEFAULT NULL
)
RETURNS public.tele_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  fee NUMERIC(12,2) := 0;
  vat_pct NUMERIC := 0;
  vat NUMERIC(12,2) := 0;
  net NUMERIC(12,2) := 0;
  settings JSONB;
  inv JSONB;
  row public.tele_bookings;
  prof public.tele_doctor_profiles%ROWTYPE;
  offer public.tele_offer_cards%ROWTYPE;
  prod public.tele_consult_products%ROWTYPE;
  require_slot BOOLEAN := true;
  wd INT;
  st TIME;
  en TIME;
  win_ok BOOLEAN := false;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _mode NOT IN ('named', 'instant') THEN RAISE EXCEPTION 'Invalid mode'; END IF;

  SELECT tele_settings INTO settings FROM public.app_settings WHERE id = 1;
  IF COALESCE((settings->>'tele_enabled')::boolean, true) IS NOT TRUE THEN
    RAISE EXCEPTION 'Video consultation disabled';
  END IF;
  IF _mode = 'instant' AND COALESCE((settings->>'instant_enabled')::boolean, true) IS NOT TRUE THEN
    RAISE EXCEPTION 'Instant consultation disabled';
  END IF;
  require_slot := COALESCE((settings->>'require_slot_for_named')::boolean, true);

  SELECT care_invoice_settings INTO inv FROM public.app_settings WHERE id = 1;
  vat_pct := COALESCE((settings->>'vat_percent')::numeric, (inv->>'vat_percent')::numeric, 0);

  IF _offer_card_id IS NOT NULL THEN
    SELECT * INTO offer FROM public.tele_offer_cards WHERE id = _offer_card_id AND is_active;
    IF FOUND THEN
      fee := COALESCE(offer.sale_price, offer.list_price, 0);
      _specialty_id := COALESCE(_specialty_id, offer.specialty_id);
    END IF;
  END IF;

  IF _mode = 'named' THEN
    IF _doctor_id IS NULL THEN RAISE EXCEPTION 'Doctor required'; END IF;
    SELECT * INTO prof FROM public.tele_doctor_profiles WHERE doctor_id = _doctor_id AND video_enabled;
    IF NOT FOUND THEN RAISE EXCEPTION 'Doctor not available for video'; END IF;
    IF COALESCE(prof.schedule_public, true) IS NOT TRUE THEN
      RAISE EXCEPTION 'Doctor is not accepting appointments';
    END IF;
    IF fee = 0 THEN fee := COALESCE(prof.fee_amount, 0); END IF;

    IF require_slot THEN
      IF _slot_start IS NULL OR _slot_end IS NULL THEN
        RAISE EXCEPTION 'Appointment slot required';
      END IF;
      IF _slot_end <= _slot_start THEN
        RAISE EXCEPTION 'Invalid slot range';
      END IF;
      IF _slot_start < now() - interval '2 minutes' THEN
        RAISE EXCEPTION 'Slot is in the past';
      END IF;

      wd := EXTRACT(DOW FROM _slot_start AT TIME ZONE 'Asia/Dhaka')::INT;
      st := (_slot_start AT TIME ZONE 'Asia/Dhaka')::time;
      en := (_slot_end AT TIME ZONE 'Asia/Dhaka')::time;

      SELECT EXISTS (
        SELECT 1 FROM public.tele_doctor_slots s
        WHERE s.doctor_id = _doctor_id AND s.is_active AND s.weekday = wd
          AND st >= s.start_time AND en <= s.end_time
      ) INTO win_ok;
      IF NOT win_ok THEN
        RAISE EXCEPTION 'Slot outside doctor schedule';
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.tele_bookings b
        WHERE b.doctor_id = _doctor_id
          AND b.slot_start = _slot_start
          AND b.status NOT IN ('cancelled', 'no_show')
      ) THEN
        RAISE EXCEPTION 'Slot already booked';
      END IF;
    END IF;
  ELSE
    IF fee = 0 AND _specialty_id IS NOT NULL THEN
      SELECT * INTO prod FROM public.tele_consult_products
      WHERE specialty_id = _specialty_id AND mode = 'instant' AND is_active LIMIT 1;
      IF FOUND THEN fee := prod.fee_amount; END IF;
    END IF;
  END IF;

  vat := ROUND(fee * vat_pct / 100.0, 2);
  net := fee + vat;

  INSERT INTO public.tele_bookings (
    patient_id, mode, doctor_id, specialty_id, offer_card_id,
    slot_start, slot_end, fee_amount, vat_amount, net_amount,
    payment_status, status, patient_phone, patient_name
  ) VALUES (
    uid, _mode, _doctor_id, _specialty_id, _offer_card_id,
    _slot_start, _slot_end, fee, vat, net,
    CASE WHEN net <= 0 THEN 'waived' ELSE 'pending' END,
    CASE WHEN net <= 0 THEN 'confirmed' ELSE 'pending_payment' END,
    _patient_phone, _patient_name
  )
  RETURNING * INTO row;

  RETURN row;
END;
$$;

-- Dense demo schedules for TELE-DEMO doctors
UPDATE public.tele_doctor_profiles p
SET
  slot_minutes = 15,
  schedule_public = true,
  follow_up_fee = ROUND(COALESCE(p.fee_amount, 500) * 0.6, 0),
  follow_up_days = 7,
  avg_consult_minutes = 15,
  doctor_code = COALESCE(p.doctor_code, 'TD' || RIGHT(REPLACE(d.bmdc_no, 'TELE-DEMO-', ''), 4)),
  patients_attended = GREATEST(p.patients_attended, COALESCE(p.rating_count, 0) * 8),
  joined_at = COALESCE(p.joined_at, CURRENT_DATE - 400),
  specialty_tags_en = CASE
    WHEN d.bmdc_no LIKE '%001' OR d.bmdc_no LIKE '%009' THEN ARRAY['Medicine Specialist', 'General Physician']
    WHEN d.bmdc_no LIKE '%002' OR d.bmdc_no LIKE '%010' THEN ARRAY['Cardiologist', 'Medicine Specialist']
    WHEN d.bmdc_no LIKE '%003' THEN ARRAY['Gynecologist', 'Women Health']
    WHEN d.bmdc_no LIKE '%004' THEN ARRAY['Pediatrician', 'Child Specialist']
    WHEN d.bmdc_no LIKE '%005' THEN ARRAY['ENT Specialist']
    WHEN d.bmdc_no LIKE '%006' THEN ARRAY['Orthopedic Surgeon']
    WHEN d.bmdc_no LIKE '%007' THEN ARRAY['Dermatologist', 'Skin Specialist']
    ELSE ARRAY['General Physician']
  END,
  specialty_tags_bn = CASE
    WHEN d.bmdc_no LIKE '%001' OR d.bmdc_no LIKE '%009' THEN ARRAY['মেডিসিন বিশেষজ্ঞ', 'জেনারেল ফিজিশিয়ান']
    WHEN d.bmdc_no LIKE '%002' OR d.bmdc_no LIKE '%010' THEN ARRAY['হৃদরোগ বিশেষজ্ঞ', 'মেডিসিন']
    WHEN d.bmdc_no LIKE '%003' THEN ARRAY['গাইনি বিশেষজ্ঞ']
    WHEN d.bmdc_no LIKE '%004' THEN ARRAY['শিশু বিশেষজ্ঞ']
    WHEN d.bmdc_no LIKE '%005' THEN ARRAY['ইএনটি বিশেষজ্ঞ']
    WHEN d.bmdc_no LIKE '%006' THEN ARRAY['অর্থোপেডিক সার্জন']
    WHEN d.bmdc_no LIKE '%007' THEN ARRAY['চর্মরোগ বিশেষজ্ঞ']
    ELSE ARRAY['জেনারেল ফিজিশিয়ান']
  END,
  notice_bn = COALESCE(p.notice_bn, 'জরুরি, অচেতন বা পুলিশ কেস রোগীর জন্য এই সেবা নয়।'),
  notice_en = COALESCE(p.notice_en, 'Not for emergency, unconscious, or police-case patients.'),
  instructions_bn = COALESCE(p.instructions_bn, E'ভিডিও কলে শান্ত পরিবেশ রাখুন।\nহেডফোন ব্যবহার করুন।\nলক্ষণ ও পুরনো রিপোর্ট প্রস্তুত রাখুন।\nসম্ভব হলে রক্তচাপ/সুগার আগে মাপুন।'),
  instructions_en = COALESCE(p.instructions_en, E'Keep a quiet room for the video call.\nUse headphones.\nPrepare symptoms and prior reports.\nMeasure BP/sugar beforehand if possible.'),
  helpline = COALESCE(p.helpline, '09612885599'),
  updated_at = now()
FROM public.care_doctors d
WHERE d.id = p.doctor_id AND d.bmdc_no LIKE 'TELE-DEMO-%';

DELETE FROM public.tele_doctor_slots s
USING public.care_doctors d
WHERE s.doctor_id = d.id AND d.bmdc_no LIKE 'TELE-DEMO-%';

-- Default dense afternoon/evening window every day for all demo doctors
INSERT INTO public.tele_doctor_slots (doctor_id, weekday, start_time, end_time, is_active)
SELECT d.id, w.weekday, '14:40'::time, '23:50'::time, true
FROM public.care_doctors d
CROSS JOIN generate_series(0, 6) AS w(weekday)
WHERE d.bmdc_no LIKE 'TELE-DEMO-%';

-- Extra morning window for pediatrics / dermatology demos
INSERT INTO public.tele_doctor_slots (doctor_id, weekday, start_time, end_time, is_active)
SELECT d.id, w.weekday, '09:00'::time, '12:00'::time, true
FROM public.care_doctors d
CROSS JOIN generate_series(0, 6) AS w(weekday)
WHERE d.bmdc_no IN ('TELE-DEMO-004', 'TELE-DEMO-007');

-- Cardiology: shorter evening window variance
DELETE FROM public.tele_doctor_slots s
USING public.care_doctors d
WHERE s.doctor_id = d.id AND d.bmdc_no IN ('TELE-DEMO-002', 'TELE-DEMO-010')
  AND s.start_time = '14:40'::time;

INSERT INTO public.tele_doctor_slots (doctor_id, weekday, start_time, end_time, is_active)
SELECT d.id, w.weekday, '16:00'::time, '21:00'::time, true
FROM public.care_doctors d
CROSS JOIN generate_series(0, 6) AS w(weekday)
WHERE d.bmdc_no IN ('TELE-DEMO-002', 'TELE-DEMO-010');
