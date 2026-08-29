-- Tele / online video doctor consultation (parallel to chamber serials)

-- ---------------------------------------------------------------------------
-- Settings (CMS — nothing hardcoded in app)
-- ---------------------------------------------------------------------------

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS tele_settings JSONB NOT NULL DEFAULT '{
    "tele_enabled": true,
    "instant_enabled": true,
    "require_payment_before_join": true,
    "ai_summary_enabled": true,
    "join_window_minutes": 15,
    "default_duration_minutes": 20,
    "cancel_cutoff_hours": 1,
    "vat_percent": null,
    "trust_bullets_bn": ["সকল ডাক্তার BMDC সনদপ্রাপ্ত","অভিজ্ঞ কনসালট্যান্ট"],
    "trust_bullets_en": ["All doctors are BMDC certified","Experienced consultants"],
    "ui": {
      "hub_title_bn": "ভিডিও কনসালটেশন",
      "hub_title_en": "Video Consultation",
      "search_placeholder_bn": "স্পেশালিটি বা নাম দিয়ে খুঁজুন",
      "search_placeholder_en": "Search doctor by specialty or name",
      "instant_section_bn": "তাৎক্ষণিক ভিডিও কনসালটেশন",
      "instant_section_en": "Get instant video consultation",
      "specialist_section_bn": "বিশেষজ্ঞ কনসালট করুন",
      "specialist_section_en": "Consult a specialist",
      "dept_section_bn": "বিভাগ বা লক্ষণ বেছে নিন",
      "dept_section_en": "Choose a department or symptom",
      "summary_disclaimer_bn": "AI সহায়ক সারসংক্ষেপ — চিকিৎসকের প্রেসক্রিপশনই চূড়ান্ত",
      "summary_disclaimer_en": "AI helper summary — the doctor prescription is final"
    },
    "instant_assign": {
      "prefer_online": true,
      "prefer_rating": true,
      "max_wait_minutes": 30
    },
    "zoom": {
      "waiting_room": true,
      "auto_recording": true,
      "auto_transcript": true,
      "configured": false
    },
    "transcript_retention_days": 90
  }'::jsonb;

-- Extend gemini_settings with tele summary prompts (merge, don't wipe)
UPDATE public.app_settings
SET gemini_settings = COALESCE(gemini_settings, '{}'::jsonb) || jsonb_build_object(
  'prompt_tele_summary_bn', COALESCE(
    gemini_settings->>'prompt_tele_summary_bn',
    'আপনি Muktosheba Care ভিডিও কনসালটেশন সারাংশকারী। নিচের Zoom মিটিং ট্রান্সক্রিপ্ট থেকে রোগীর বোঝার মতো বাংলায় সংক্ষিপ্ত সারসংক্ষেপ দিন।
নিয়ম:
- রোগ নির্ণয় বা ওষুধের ডোজ উদ্ভাবন করবেন না।
- আলোচিত লক্ষণ, পরামর্শ, ফলোআপ — শুধু ট্রান্সক্রিপ্টে যা আছে।
- ৫–১০ বুলেট বা ছোট অনুচ্ছেদ।
- শুধু JSON: {"summary_bn":"...","summary_en":"...","key_points_bn":["..."]}

TRANSCRIPT:
{{transcript}}'
  ),
  'prompt_tele_summary_en', COALESCE(
    gemini_settings->>'prompt_tele_summary_en',
    'You summarize a Zoom tele-consult transcript for Muktosheba Care patients.
Rules:
- Do not invent diagnoses or drug doses.
- Only what appears in the transcript: symptoms discussed, advice, follow-up.
- Short JSON only: {"summary_bn":"...","summary_en":"...","key_points_bn":["..."]}

TRANSCRIPT:
{{transcript}}'
  )
)
WHERE id = 1;

-- ---------------------------------------------------------------------------
-- Catalog / CMS tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tele_offer_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  title_bn TEXT NOT NULL,
  title_en TEXT NOT NULL,
  subtitle_bn TEXT,
  subtitle_en TEXT,
  image_url TEXT,
  specialty_id UUID REFERENCES public.care_specialties(id) ON DELETE SET NULL,
  list_price NUMERIC(12, 2),
  sale_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  mode TEXT NOT NULL DEFAULT 'instant' CHECK (mode IN ('instant', 'named', 'link')),
  href TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tele_doctor_profiles (
  doctor_id UUID PRIMARY KEY REFERENCES public.care_doctors(id) ON DELETE CASCADE,
  video_enabled BOOLEAN NOT NULL DEFAULT false,
  instant_enabled BOOLEAN NOT NULL DEFAULT false,
  is_online BOOLEAN NOT NULL DEFAULT false,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  about_bn TEXT,
  about_en TEXT,
  experience_years INT,
  workplace_bn TEXT,
  workplace_en TEXT,
  hero_image_url TEXT,
  fee_amount NUMERIC(12, 2),
  rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 0,
  rating_count INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tele_doctor_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id UUID NOT NULL REFERENCES public.care_doctors(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (doctor_id, weekday, start_time, end_time)
);

CREATE TABLE IF NOT EXISTS public.tele_consult_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialty_id UUID REFERENCES public.care_specialties(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('instant', 'named')),
  fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  duration_minutes INT NOT NULL DEFAULT 20,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (specialty_id, mode)
);

CREATE TABLE IF NOT EXISTS public.tele_formulary (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'medicine' CHECK (kind IN ('medicine', 'test', 'advice')),
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  default_dose TEXT,
  default_frequency TEXT,
  default_duration TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tele_booking_statuses (
  slug TEXT PRIMARY KEY,
  label_bn TEXT NOT NULL,
  label_en TEXT NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

INSERT INTO public.tele_booking_statuses (slug, label_bn, label_en, is_terminal, sort_order) VALUES
  ('pending_payment', 'পেমেন্ট বাকি', 'Pending payment', false, 10),
  ('confirmed', 'নিশ্চিত', 'Confirmed', false, 20),
  ('ready', 'যোগদানের জন্য প্রস্তুত', 'Ready to join', false, 30),
  ('in_call', 'কল চলছে', 'In call', false, 40),
  ('completed', 'সম্পন্ন', 'Completed', true, 50),
  ('cancelled', 'বাতিল', 'Cancelled', true, 60),
  ('no_show', 'আসেননি', 'No-show', true, 70)
ON CONFLICT (slug) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Bookings + Zoom + AI + Rx
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tele_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mode TEXT NOT NULL CHECK (mode IN ('named', 'instant')),
  doctor_id UUID REFERENCES public.care_doctors(id) ON DELETE SET NULL,
  specialty_id UUID REFERENCES public.care_specialties(id) ON DELETE SET NULL,
  offer_card_id UUID REFERENCES public.tele_offer_cards(id) ON DELETE SET NULL,
  slot_start TIMESTAMPTZ,
  slot_end TIMESTAMPTZ,
  fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  vat_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'waived', 'refunded')),
  status TEXT NOT NULL DEFAULT 'pending_payment' REFERENCES public.tele_booking_statuses(slug),
  patient_phone TEXT,
  patient_name TEXT,
  notes TEXT,
  assigned_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tele_bookings_patient_idx ON public.tele_bookings (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS tele_bookings_doctor_idx ON public.tele_bookings (doctor_id, slot_start);
CREATE INDEX IF NOT EXISTS tele_bookings_status_idx ON public.tele_bookings (status);

CREATE TABLE IF NOT EXISTS public.tele_zoom_meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.tele_bookings(id) ON DELETE CASCADE,
  zoom_meeting_id TEXT,
  zoom_uuid TEXT,
  join_url TEXT,
  start_url TEXT,
  password TEXT,
  host_email TEXT,
  recording_id TEXT,
  transcript_file_id TEXT,
  raw_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tele_transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.tele_bookings(id) ON DELETE CASCADE,
  source_url TEXT,
  raw_text TEXT,
  language TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tele_transcripts_booking_uidx ON public.tele_transcripts (booking_id);

CREATE TABLE IF NOT EXISTS public.tele_ai_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.tele_bookings(id) ON DELETE CASCADE,
  summary_bn TEXT,
  summary_en TEXT,
  key_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT,
  prompt_version TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tele_ai_summaries_booking_uidx ON public.tele_ai_summaries (booking_id);

CREATE TABLE IF NOT EXISTS public.tele_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.tele_bookings(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.care_doctors(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed')),
  advice_bn TEXT,
  advice_en TEXT,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tele_prescriptions_booking_uidx ON public.tele_prescriptions (booking_id);

CREATE TABLE IF NOT EXISTS public.tele_prescription_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id UUID NOT NULL REFERENCES public.tele_prescriptions(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('medicine', 'test', 'advice')),
  name TEXT NOT NULL,
  strength TEXT,
  dose TEXT,
  route TEXT,
  frequency TEXT,
  duration TEXT,
  notes TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tele_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL UNIQUE REFERENCES public.tele_bookings(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.care_doctors(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_tele_doctor(_doctor_id UUID, _uid UUID DEFAULT auth.uid())
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

CREATE OR REPLACE FUNCTION public.tele_touch_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tele_bookings_touch ON public.tele_bookings;
CREATE TRIGGER tele_bookings_touch
  BEFORE UPDATE ON public.tele_bookings
  FOR EACH ROW EXECUTE FUNCTION public.tele_touch_booking();

-- Recalc doctor rating cache
CREATE OR REPLACE FUNCTION public.tele_refresh_doctor_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  did UUID;
BEGIN
  did := COALESCE(NEW.doctor_id, OLD.doctor_id);
  UPDATE public.tele_doctor_profiles p
  SET
    rating_avg = COALESCE((SELECT ROUND(AVG(rating)::numeric, 2) FROM public.tele_reviews WHERE doctor_id = did), 0),
    rating_count = COALESCE((SELECT COUNT(*)::int FROM public.tele_reviews WHERE doctor_id = did), 0),
    updated_at = now()
  WHERE p.doctor_id = did;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS tele_reviews_rating ON public.tele_reviews;
CREATE TRIGGER tele_reviews_rating
  AFTER INSERT OR UPDATE OR DELETE ON public.tele_reviews
  FOR EACH ROW EXECUTE FUNCTION public.tele_refresh_doctor_rating();

-- Book named / instant
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
    IF fee = 0 THEN fee := COALESCE(prof.fee_amount, 0); END IF;
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

CREATE OR REPLACE FUNCTION public.tele_set_payment(_booking_id UUID, _status TEXT)
RETURNS public.tele_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.tele_bookings;
BEGIN
  IF _status NOT IN ('pending', 'paid', 'waived', 'refunded') THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;
  SELECT * INTO row FROM public.tele_bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF row.patient_id <> auth.uid() AND NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.tele_bookings
  SET
    payment_status = _status,
    status = CASE
      WHEN _status IN ('paid', 'waived') AND status = 'pending_payment' THEN 'confirmed'
      ELSE status
    END,
    updated_at = now()
  WHERE id = _booking_id
  RETURNING * INTO row;

  IF _status IN ('paid', 'waived') THEN
    PERFORM public.care_notify(
      row.patient_id,
      'tele_booking_confirmed',
      NULL,
      jsonb_build_object('booking_id', row.id, 'kind', 'tele_booking_confirmed')
    );
  END IF;

  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.tele_set_status(_booking_id UUID, _status TEXT)
RETURNS public.tele_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.tele_bookings;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tele_booking_statuses WHERE slug = _status AND is_active) THEN
    RAISE EXCEPTION 'Invalid status';
  END IF;
  SELECT * INTO row FROM public.tele_bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF NOT (
    public.is_care_staff()
    OR public.is_tele_doctor(row.doctor_id)
    OR row.patient_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.tele_bookings
  SET
    status = _status,
    completed_at = CASE WHEN _status IN ('completed', 'cancelled', 'no_show') THEN now() ELSE completed_at END,
    updated_at = now()
  WHERE id = _booking_id
  RETURNING * INTO row;

  IF _status = 'ready' THEN
    PERFORM public.care_notify(
      row.patient_id,
      'tele_ready_to_join',
      NULL,
      jsonb_build_object('booking_id', row.id, 'kind', 'tele_ready_to_join')
    );
  END IF;

  RETURN row;
END;
$$;

-- Instant: assign next online doctor for specialty (respects tele_settings.instant_assign)
CREATE OR REPLACE FUNCTION public.tele_assign_instant_doctor(_booking_id UUID)
RETURNS public.tele_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  row public.tele_bookings;
  did UUID;
  settings JSONB;
  prefer_online BOOLEAN := true;
  prefer_rating BOOLEAN := true;
BEGIN
  SELECT * INTO row FROM public.tele_bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  IF row.mode <> 'instant' THEN RAISE EXCEPTION 'Not an instant booking'; END IF;
  IF row.doctor_id IS NOT NULL THEN RETURN row; END IF;

  SELECT tele_settings INTO settings FROM public.app_settings WHERE id = 1;
  IF COALESCE((settings->>'instant_enabled')::boolean, true) IS NOT TRUE THEN
    RAISE EXCEPTION 'Instant consultations disabled';
  END IF;
  prefer_online := COALESCE((settings->'instant_assign'->>'prefer_online')::boolean, true);
  prefer_rating := COALESCE((settings->'instant_assign'->>'prefer_rating')::boolean, true);

  SELECT p.doctor_id INTO did
  FROM public.tele_doctor_profiles p
  JOIN public.care_doctors d ON d.id = p.doctor_id
  WHERE p.video_enabled AND p.instant_enabled AND d.is_active
    AND (NOT prefer_online OR p.is_online)
    AND (row.specialty_id IS NULL OR d.specialty_id = row.specialty_id)
  ORDER BY
    CASE WHEN prefer_online THEN (NOT p.is_online)::int ELSE 0 END ASC,
    CASE WHEN prefer_rating THEN p.rating_avg ELSE 0 END DESC NULLS LAST,
    p.sort_order ASC,
    p.updated_at DESC
  LIMIT 1;

  IF did IS NULL THEN
    RAISE EXCEPTION 'No online doctor available';
  END IF;

  UPDATE public.tele_bookings
  SET doctor_id = did, assigned_at = now(), updated_at = now()
  WHERE id = _booking_id
  RETURNING * INTO row;

  PERFORM public.care_notify(
    row.patient_id,
    'tele_doctor_assigned',
    NULL,
    jsonb_build_object('booking_id', row.id, 'doctor_id', did, 'kind', 'tele_doctor_assigned')
  );

  RETURN row;
END;
$$;

CREATE OR REPLACE FUNCTION public.tele_sign_prescription(_prescription_id UUID)
RETURNS public.tele_prescriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rx public.tele_prescriptions;
  booking public.tele_bookings;
BEGIN
  SELECT * INTO rx FROM public.tele_prescriptions WHERE id = _prescription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Prescription not found'; END IF;
  IF rx.status = 'signed' THEN RETURN rx; END IF;

  SELECT * INTO booking FROM public.tele_bookings WHERE id = rx.booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF NOT (public.is_care_staff() OR public.is_tele_doctor(rx.doctor_id)) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.tele_prescriptions
  SET status = 'signed', signed_at = now(), updated_at = now()
  WHERE id = _prescription_id
  RETURNING * INTO rx;

  PERFORM public.care_notify(
    booking.patient_id,
    'tele_rx_signed',
    NULL,
    jsonb_build_object('booking_id', booking.id, 'prescription_id', rx.id, 'kind', 'tele_rx_signed')
  );

  RETURN rx;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_tele_doctor(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_create_booking(TEXT, UUID, UUID, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_set_payment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_set_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_assign_instant_doctor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_sign_prescription(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.tele_offer_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tele_doctor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tele_doctor_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tele_consult_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tele_formulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tele_booking_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tele_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tele_zoom_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tele_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tele_ai_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tele_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tele_prescription_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tele_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tele_offer_read ON public.tele_offer_cards;
CREATE POLICY tele_offer_read ON public.tele_offer_cards FOR SELECT TO authenticated, anon
  USING (is_active OR public.is_care_staff());
DROP POLICY IF EXISTS tele_offer_write ON public.tele_offer_cards;
CREATE POLICY tele_offer_write ON public.tele_offer_cards FOR ALL TO authenticated
  USING (public.is_care_staff()) WITH CHECK (public.is_care_staff());

DROP POLICY IF EXISTS tele_prof_read ON public.tele_doctor_profiles;
CREATE POLICY tele_prof_read ON public.tele_doctor_profiles FOR SELECT TO authenticated, anon
  USING (video_enabled OR public.is_care_staff() OR public.is_tele_doctor(doctor_id));
DROP POLICY IF EXISTS tele_prof_write ON public.tele_doctor_profiles;
CREATE POLICY tele_prof_write ON public.tele_doctor_profiles FOR ALL TO authenticated
  USING (public.is_care_staff() OR public.is_tele_doctor(doctor_id))
  WITH CHECK (public.is_care_staff() OR public.is_tele_doctor(doctor_id));

DROP POLICY IF EXISTS tele_slots_read ON public.tele_doctor_slots;
CREATE POLICY tele_slots_read ON public.tele_doctor_slots FOR SELECT TO authenticated, anon
  USING (is_active OR public.is_care_staff() OR public.is_tele_doctor(doctor_id));
DROP POLICY IF EXISTS tele_slots_write ON public.tele_doctor_slots;
CREATE POLICY tele_slots_write ON public.tele_doctor_slots FOR ALL TO authenticated
  USING (public.is_care_staff() OR public.is_tele_doctor(doctor_id))
  WITH CHECK (public.is_care_staff() OR public.is_tele_doctor(doctor_id));

DROP POLICY IF EXISTS tele_prod_read ON public.tele_consult_products;
CREATE POLICY tele_prod_read ON public.tele_consult_products FOR SELECT TO authenticated, anon
  USING (is_active OR public.is_care_staff());
DROP POLICY IF EXISTS tele_prod_write ON public.tele_consult_products;
CREATE POLICY tele_prod_write ON public.tele_consult_products FOR ALL TO authenticated
  USING (public.is_care_staff()) WITH CHECK (public.is_care_staff());

DROP POLICY IF EXISTS tele_form_read ON public.tele_formulary;
CREATE POLICY tele_form_read ON public.tele_formulary FOR SELECT TO authenticated
  USING (is_active OR public.is_care_staff());
DROP POLICY IF EXISTS tele_form_write ON public.tele_formulary;
CREATE POLICY tele_form_write ON public.tele_formulary FOR ALL TO authenticated
  USING (public.is_care_staff()) WITH CHECK (public.is_care_staff());

DROP POLICY IF EXISTS tele_status_read ON public.tele_booking_statuses;
CREATE POLICY tele_status_read ON public.tele_booking_statuses FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS tele_status_write ON public.tele_booking_statuses;
CREATE POLICY tele_status_write ON public.tele_booking_statuses FOR ALL TO authenticated
  USING (public.is_care_staff()) WITH CHECK (public.is_care_staff());

DROP POLICY IF EXISTS tele_book_read ON public.tele_bookings;
CREATE POLICY tele_book_read ON public.tele_bookings FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_tele_doctor(doctor_id)
    OR public.is_care_staff()
  );
DROP POLICY IF EXISTS tele_book_insert ON public.tele_bookings;
CREATE POLICY tele_book_insert ON public.tele_bookings FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid() OR public.is_care_staff());
DROP POLICY IF EXISTS tele_book_update ON public.tele_bookings;
CREATE POLICY tele_book_update ON public.tele_bookings FOR UPDATE TO authenticated
  USING (
    patient_id = auth.uid()
    OR public.is_tele_doctor(doctor_id)
    OR public.is_care_staff()
  );

DROP POLICY IF EXISTS tele_zoom_read ON public.tele_zoom_meetings;
CREATE POLICY tele_zoom_read ON public.tele_zoom_meetings FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tele_bookings b
      WHERE b.id = booking_id
        AND (b.patient_id = auth.uid() OR public.is_tele_doctor(b.doctor_id) OR public.is_care_staff())
    )
  );
DROP POLICY IF EXISTS tele_zoom_write ON public.tele_zoom_meetings;
CREATE POLICY tele_zoom_write ON public.tele_zoom_meetings FOR ALL TO authenticated
  USING (public.is_care_staff() OR EXISTS (
    SELECT 1 FROM public.tele_bookings b WHERE b.id = booking_id AND public.is_tele_doctor(b.doctor_id)
  ))
  WITH CHECK (public.is_care_staff() OR EXISTS (
    SELECT 1 FROM public.tele_bookings b WHERE b.id = booking_id AND public.is_tele_doctor(b.doctor_id)
  ));

DROP POLICY IF EXISTS tele_tr_read ON public.tele_transcripts;
CREATE POLICY tele_tr_read ON public.tele_transcripts FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tele_bookings b
      WHERE b.id = booking_id
        AND (b.patient_id = auth.uid() OR public.is_tele_doctor(b.doctor_id) OR public.is_care_staff())
    )
  );
DROP POLICY IF EXISTS tele_tr_write ON public.tele_transcripts;
CREATE POLICY tele_tr_write ON public.tele_transcripts FOR ALL TO authenticated
  USING (public.is_care_staff()) WITH CHECK (public.is_care_staff());

DROP POLICY IF EXISTS tele_sum_read ON public.tele_ai_summaries;
CREATE POLICY tele_sum_read ON public.tele_ai_summaries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tele_bookings b
      WHERE b.id = booking_id
        AND (b.patient_id = auth.uid() OR public.is_tele_doctor(b.doctor_id) OR public.is_care_staff())
    )
  );
DROP POLICY IF EXISTS tele_sum_write ON public.tele_ai_summaries;
CREATE POLICY tele_sum_write ON public.tele_ai_summaries FOR ALL TO authenticated
  USING (public.is_care_staff()) WITH CHECK (public.is_care_staff());

DROP POLICY IF EXISTS tele_rx_read ON public.tele_prescriptions;
CREATE POLICY tele_rx_read ON public.tele_prescriptions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tele_bookings b
      WHERE b.id = booking_id
        AND (b.patient_id = auth.uid() OR public.is_tele_doctor(b.doctor_id) OR public.is_care_staff())
    )
  );
DROP POLICY IF EXISTS tele_rx_write ON public.tele_prescriptions;
CREATE POLICY tele_rx_write ON public.tele_prescriptions FOR ALL TO authenticated
  USING (public.is_care_staff() OR public.is_tele_doctor(doctor_id))
  WITH CHECK (public.is_care_staff() OR public.is_tele_doctor(doctor_id));

DROP POLICY IF EXISTS tele_rxi_read ON public.tele_prescription_items;
CREATE POLICY tele_rxi_read ON public.tele_prescription_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tele_prescriptions p
      JOIN public.tele_bookings b ON b.id = p.booking_id
      WHERE p.id = prescription_id
        AND (b.patient_id = auth.uid() OR public.is_tele_doctor(p.doctor_id) OR public.is_care_staff())
    )
  );
DROP POLICY IF EXISTS tele_rxi_write ON public.tele_prescription_items;
CREATE POLICY tele_rxi_write ON public.tele_prescription_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tele_prescriptions p
      WHERE p.id = prescription_id AND (public.is_care_staff() OR public.is_tele_doctor(p.doctor_id))
        AND p.status = 'draft'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tele_prescriptions p
      WHERE p.id = prescription_id AND (public.is_care_staff() OR public.is_tele_doctor(p.doctor_id))
        AND p.status = 'draft'
    )
  );

DROP POLICY IF EXISTS tele_rev_read ON public.tele_reviews;
CREATE POLICY tele_rev_read ON public.tele_reviews FOR SELECT TO authenticated, anon USING (true);
DROP POLICY IF EXISTS tele_rev_write ON public.tele_reviews;
CREATE POLICY tele_rev_write ON public.tele_reviews FOR INSERT TO authenticated
  WITH CHECK (patient_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Seeds
-- ---------------------------------------------------------------------------

INSERT INTO public.care_hub_modules (slug, label_bn, label_en, icon, href, audience, is_enabled, sort_order)
VALUES ('video', 'ভিডিও কনসালট', 'Video consult', 'Video', '/care/video', 'patient', true, 15)
ON CONFLICT (slug) DO UPDATE SET
  label_bn = EXCLUDED.label_bn,
  label_en = EXCLUDED.label_en,
  icon = EXCLUDED.icon,
  href = EXCLUDED.href,
  is_enabled = EXCLUDED.is_enabled;

INSERT INTO public.care_hub_modules (slug, label_bn, label_en, icon, href, audience, is_enabled, sort_order)
VALUES ('tele_desk', 'ভিডিও ডেস্ক', 'Video desk', 'Video', '/care/portal/tele', 'staff', true, 25)
ON CONFLICT (slug) DO UPDATE SET
  href = EXCLUDED.href,
  audience = EXCLUDED.audience;

INSERT INTO public.care_notif_templates (slug, title_bn, title_en, body_bn, body_en, is_active) VALUES
  ('tele_booking_confirmed', 'ভিডিও বুকিং নিশ্চিত', 'Video booking confirmed', 'আপনার ভিডিও কনসালটেশন নিশ্চিত হয়েছে।', 'Your video consultation is confirmed.', true),
  ('tele_doctor_assigned', 'ডাক্তার বরাদ্দ', 'Doctor assigned', 'আপনার কনসালটেশনের জন্য ডাক্তার বরাদ্দ হয়েছে।', 'A doctor has been assigned to your consultation.', true),
  ('tele_ready_to_join', 'কল যোগ দিন', 'Ready to join', 'ভিডিও কলে যোগ দেওয়ার সময় হয়েছে।', 'It is time to join your video call.', true),
  ('tele_summary_ready', 'সারসংক্ষেপ প্রস্তুত', 'Summary ready', 'কনসালটেশনের বাংলা সারসংক্ষেপ প্রস্তুত।', 'Your Bangla consultation summary is ready.', true),
  ('tele_rx_signed', 'প্রেসক্রিপশন', 'Prescription ready', 'ডাক্তার প্রেসক্রিপশন সাইন করেছেন।', 'Your doctor signed the prescription.', true)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tele_offer_cards (slug, title_bn, title_en, subtitle_bn, subtitle_en, sale_price, list_price, mode, sort_order) VALUES
  ('instant-mbbs', 'অভিজ্ঞ MBBS ডাক্তার', 'Experienced MBBS Doctor', 'তাৎক্ষণিক ভিডিও', 'Instant video', 197, 299, 'instant', 10),
  ('instant-child', 'অভিজ্ঞ শিশু রোগ বিশেষজ্ঞ', 'Experienced Child Doctor', 'তাৎক্ষণিক ভিডিও', 'Instant video', 297, 399, 'instant', 20)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.tele_formulary (kind, name_bn, name_en, default_dose, default_frequency, default_duration, sort_order)
SELECT * FROM (VALUES
  ('medicine', 'প্যারাসিটামল', 'Paracetamol', '500 mg', '১+১+১', '৫ দিন', 10),
  ('medicine', 'ওমিপ্রাজল', 'Omeprazole', '20 mg', '১+০+০', '১৪ দিন', 20),
  ('advice', 'প্রচুর পানি পান করুন', 'Drink plenty of water', NULL, NULL, NULL, 30),
  ('test', 'সিবিসি', 'CBC', NULL, NULL, NULL, 40)
) AS v(kind, name_bn, name_en, default_dose, default_frequency, default_duration, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.tele_formulary LIMIT 1);
