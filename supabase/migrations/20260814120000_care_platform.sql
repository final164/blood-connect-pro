-- BloodLink Care: chamber serials + clinic/lab capacity (sister product, not blood orgs)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Catalogs (admin CMS — seed is install-only, not frozen in app code)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.care_vendor_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  panels TEXT[] NOT NULL DEFAULT ARRAY['desk']::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_hub_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label_bn TEXT NOT NULL,
  label_en TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Stethoscope',
  href TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'patient',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_specialties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_permission_catalog (
  key TEXT PRIMARY KEY,
  group_key TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_bn TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.care_serial_statuses (
  slug TEXT PRIMARY KEY,
  label_bn TEXT NOT NULL,
  label_en TEXT NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.care_lab_booking_statuses (
  slug TEXT PRIMARY KEY,
  label_bn TEXT NOT NULL,
  label_en TEXT NOT NULL,
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.care_booking_modes (
  slug TEXT PRIMARY KEY,
  label_bn TEXT NOT NULL,
  label_en TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.care_notif_templates (
  slug TEXT PRIMARY KEY,
  title_bn TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_bn TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.care_test_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.care_test_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES public.care_test_categories(id) ON DELETE SET NULL,
  code TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sample_type TEXT,
  fasting_notes_bn TEXT,
  fasting_notes_en TEXT,
  prep_bn TEXT,
  prep_en TEXT,
  default_tat_hours INT,
  is_package BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Tenants (Care orgs — never mix with community_orgs)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.care_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_kind_id UUID REFERENCES public.care_vendor_types(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  name_bn TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  description TEXT,
  description_bn TEXT,
  district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  upazila TEXT,
  address TEXT,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_listed BOOLEAN NOT NULL DEFAULT false,
  kyc_status TEXT NOT NULL DEFAULT 'pending',
  kyc_notes TEXT,
  featured BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_org_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  name_bn TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS public.care_org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'reception',
  role_id UUID REFERENCES public.care_org_roles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.care_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  name_bn TEXT,
  district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  upazila TEXT,
  address TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_doctors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  full_name_bn TEXT,
  bmdc_no TEXT,
  specialty_id UUID REFERENCES public.care_specialties(id) ON DELETE SET NULL,
  qualifications TEXT,
  photo_url TEXT,
  bio TEXT,
  bio_bn TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_affiliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.care_doctors(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.care_locations(id) ON DELETE CASCADE,
  fee_amount NUMERIC(12, 2),
  fee_note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, doctor_id, location_id)
);

CREATE TABLE IF NOT EXISTS public.care_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliation_id UUID NOT NULL REFERENCES public.care_affiliations(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_serial INT NOT NULL DEFAULT 40,
  start_number INT NOT NULL DEFAULT 1,
  break_after INT,
  allow_app_booking BOOLEAN NOT NULL DEFAULT true,
  allow_walk_in BOOLEAN NOT NULL DEFAULT true,
  booking_window_hours INT NOT NULL DEFAULT 12,
  slot_minutes INT NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID NOT NULL REFERENCES public.care_schedules(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.care_locations(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES public.care_doctors(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  max_serial INT NOT NULL DEFAULT 40,
  start_number INT NOT NULL DEFAULT 1,
  last_issued INT NOT NULL DEFAULT 0,
  now_serving INT,
  opened_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, session_date)
);

CREATE TABLE IF NOT EXISTS public.care_serials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.care_sessions(id) ON DELETE CASCADE,
  serial_no INT NOT NULL,
  patient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_phone TEXT,
  source TEXT NOT NULL DEFAULT 'app',
  status TEXT NOT NULL DEFAULT 'booked',
  claim_code TEXT NOT NULL DEFAULT encode(gen_random_bytes(6), 'hex'),
  called_at TIMESTAMPTZ,
  done_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (session_id, serial_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS care_serials_one_active_patient
  ON public.care_serials (session_id, patient_id)
  WHERE patient_id IS NOT NULL AND status NOT IN ('cancelled', 'done', 'no_show');

-- Lab
CREATE TABLE IF NOT EXISTS public.care_test_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.care_locations(id) ON DELETE CASCADE,
  catalog_id UUID NOT NULL REFERENCES public.care_test_catalog(id) ON DELETE RESTRICT,
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  booking_mode TEXT NOT NULL DEFAULT 'day_quota',
  default_capacity INT NOT NULL DEFAULT 40,
  home_collection BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, location_id, catalog_id)
);

CREATE TABLE IF NOT EXISTS public.care_lab_calendars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offering_id UUID NOT NULL REFERENCES public.care_test_offerings(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.care_locations(id) ON DELETE CASCADE,
  cal_date DATE NOT NULL,
  slot_start TIME,
  slot_end TIME,
  slot_key TIME NOT NULL DEFAULT '00:00',
  capacity INT NOT NULL DEFAULT 40,
  reserved_count INT NOT NULL DEFAULT 0,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (offering_id, cal_date, slot_key)
);

CREATE TABLE IF NOT EXISTS public.care_lab_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  calendar_id UUID NOT NULL REFERENCES public.care_lab_calendars(id) ON DELETE RESTRICT,
  offering_id UUID NOT NULL REFERENCES public.care_test_offerings(id) ON DELETE RESTRICT,
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.care_locations(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_phone TEXT,
  source TEXT NOT NULL DEFAULT 'app',
  status TEXT NOT NULL DEFAULT 'reserved',
  reference_code TEXT NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8)),
  price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.care_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.care_orgs(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS care_orgs_listed_idx ON public.care_orgs (is_verified, is_active, is_listed);
CREATE INDEX IF NOT EXISTS care_locations_org_idx ON public.care_locations (org_id);
CREATE INDEX IF NOT EXISTS care_affiliations_doc_idx ON public.care_affiliations (doctor_id);
CREATE INDEX IF NOT EXISTS care_sessions_date_idx ON public.care_sessions (session_date, org_id);
CREATE INDEX IF NOT EXISTS care_serials_session_idx ON public.care_serials (session_id, serial_no);
CREATE INDEX IF NOT EXISTS care_serials_patient_idx ON public.care_serials (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS care_lab_cal_date_idx ON public.care_lab_calendars (offering_id, cal_date);
CREATE INDEX IF NOT EXISTS care_lab_bookings_patient_idx ON public.care_lab_bookings (patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS care_org_members_user_idx ON public.care_org_members (user_id);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS care_booking_policies JSONB NOT NULL DEFAULT '{
    "booking_window_hours": 12,
    "cancel_cutoff_hours": 2,
    "allow_cash": true,
    "allow_online": false,
    "allow_multi_test_cart": true,
    "allow_vendor_price": true,
    "no_show_requeue": true
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS care_feature_flags JSONB NOT NULL DEFAULT '{
    "home_collection": false,
    "reviews": false,
    "payment": false,
    "report_vault": false
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS care_labels JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- Seeds (editable from admin after install)
-- ---------------------------------------------------------------------------

INSERT INTO public.care_vendor_types (slug, name_bn, name_en, panels, sort_order) VALUES
  ('chamber', 'চেম্বার', 'Chamber', ARRAY['desk']::TEXT[], 10),
  ('clinic', 'প্রাইভেট ক্লিনিক', 'Private clinic', ARRAY['lab']::TEXT[], 20),
  ('diagnostic', 'ডায়াগনস্টিক', 'Diagnostic', ARRAY['lab']::TEXT[], 30),
  ('hospital_lab', 'হাসপাতাল ল্যাব', 'Hospital lab', ARRAY['lab']::TEXT[], 40),
  ('mixed', 'মিক্সড', 'Mixed', ARRAY['desk','lab']::TEXT[], 50)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.care_hub_modules (slug, label_bn, label_en, icon, href, audience, sort_order) VALUES
  ('doctors', 'ডাক্তার সিরিয়াল', 'Doctor serial', 'Stethoscope', '/care?tab=doctors', 'patient', 10),
  ('tests', 'ল্যাব টেস্ট', 'Lab tests', 'FlaskConical', '/care?tab=tests', 'patient', 20),
  ('bookings', 'আমার বুকিং', 'My bookings', 'Ticket', '/care?tab=bookings', 'patient', 30),
  ('desk', 'চেম্বার ডেস্ক', 'Chamber desk', 'ClipboardList', '/care/desk', 'staff', 40),
  ('lab', 'ল্যাব ডেস্ক', 'Lab desk', 'Microscope', '/care/lab', 'staff', 50)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.care_specialties (slug, name_bn, name_en, sort_order) VALUES
  ('medicine', 'মেডিসিন', 'Medicine', 10),
  ('cardiology', 'কার্ডিওলজি', 'Cardiology', 20),
  ('gynecology', 'গাইনি', 'Gynecology', 30),
  ('pediatrics', 'শিশু', 'Pediatrics', 40),
  ('ent', 'নাক কান গলা', 'ENT', 50),
  ('orthopedics', 'অর্থোপেডিক্স', 'Orthopedics', 60),
  ('dermatology', 'ডার্মাটোলজি', 'Dermatology', 70),
  ('general', 'জেনারেল', 'General', 80)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.care_permission_catalog (key, group_key, label_en, label_bn, sort_order) VALUES
  ('overview.view', 'overview', 'View overview', 'ওভারভিউ দেখা', 10),
  ('queue.view', 'queue', 'View queue', 'কিউ দেখা', 20),
  ('queue.manage', 'queue', 'Open / pause / close session', 'সেশন খোলা/পজ/বন্ধ', 21),
  ('serial.issue', 'queue', 'Issue walk-in serial', 'ওয়াক-ইন সিরিয়াল', 22),
  ('doctors.manage', 'doctors', 'Manage doctors', 'ডাক্তার ম্যানেজ', 30),
  ('schedule.manage', 'schedule', 'Manage schedules', 'শিডিউল ম্যানেজ', 40),
  ('lab.offerings', 'lab', 'Manage test offerings', 'টেস্ট অফার', 50),
  ('lab.calendar', 'lab', 'Manage lab calendar', 'ল্যাব ক্যালেন্ডার', 51),
  ('lab.checkin', 'lab', 'Lab check-in / status', 'ল্যাব চেক-ইন', 52),
  ('staff.manage', 'staff', 'Manage staff', 'স্টাফ ম্যানেজ', 60),
  ('roles.manage', 'staff', 'Manage roles', 'রোল ম্যানেজ', 61),
  ('settings.edit', 'settings', 'Edit org settings', 'অর্গ সেটিংস', 70)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.care_serial_statuses (slug, label_bn, label_en, is_terminal, sort_order) VALUES
  ('booked', 'বুকড', 'Booked', false, 10),
  ('checked_in', 'চেক-ইন', 'Checked in', false, 20),
  ('called', 'কল করা হয়েছে', 'Called', false, 30),
  ('in_consult', 'পরামর্শ চলছে', 'In consult', false, 40),
  ('done', 'শেষ', 'Done', true, 50),
  ('no_show', 'আসেননি', 'No-show', true, 60),
  ('cancelled', 'বাতিল', 'Cancelled', true, 70)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.care_lab_booking_statuses (slug, label_bn, label_en, is_terminal, sort_order) VALUES
  ('reserved', 'রিজার্ভড', 'Reserved', false, 10),
  ('confirmed', 'কনফার্মড', 'Confirmed', false, 20),
  ('checked_in', 'চেক-ইন', 'Checked in', false, 30),
  ('sample_taken', 'নমুনা নেওয়া', 'Sample taken', false, 40),
  ('completed', 'সম্পন্ন', 'Completed', true, 50),
  ('cancelled', 'বাতিল', 'Cancelled', true, 60),
  ('no_show', 'আসেননি', 'No-show', true, 70)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.care_booking_modes (slug, label_bn, label_en, sort_order) VALUES
  ('slot', 'সময় স্লট', 'Time slot', 10),
  ('day_quota', 'দৈনিক কোটা', 'Day quota', 20)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.care_notif_templates (slug, title_bn, title_en, body_bn, body_en) VALUES
  ('care_serial_booked', 'সিরিয়াল নিশ্চিত', 'Serial confirmed', 'আপনার সিরিয়াল নম্বর {{serial}}', 'Your serial is {{serial}}'),
  ('care_serial_called', 'আপনার নম্বর কল', 'Your number is called', 'সিরিয়াল {{serial}} — ভিতরে যান', 'Serial {{serial}} — please enter'),
  ('care_serial_ahead', 'আপনার আগে {{ahead}} জন', '{{ahead}} ahead of you', 'এখন চলছে {{now}}', 'Now serving {{now}}'),
  ('care_session_paused', 'সেশন পজ', 'Session paused', 'চেম্বার সেশন সাময়িক বন্ধ', 'Chamber session is paused'),
  ('care_lab_reserved', 'টেস্ট বুকিং নিশ্চিত', 'Test booking confirmed', 'রেফারেন্স {{code}}', 'Reference {{code}}'),
  ('care_lab_cancelled', 'টেস্ট বুকিং বাতিল', 'Test booking cancelled', 'রেফারেন্স {{code}}', 'Reference {{code}}')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.care_test_categories (slug, name_bn, name_en, sort_order) VALUES
  ('hematology', 'হেমাটোলজি', 'Hematology', 10),
  ('imaging', 'ইমেজিং', 'Imaging', 20),
  ('cardiology', 'কার্ডিয়াক', 'Cardiac', 30),
  ('pathology', 'প্যাথলজি', 'Pathology', 40)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.care_test_catalog (category_id, code, name_bn, name_en, sample_type, fasting_notes_bn, fasting_notes_en, prep_bn, prep_en, default_tat_hours, sort_order)
SELECT c.id, v.code, v.name_bn, v.name_en, v.sample_type, v.fasting_bn, v.fasting_en, v.prep_bn, v.prep_en, v.tat, v.sort_order
FROM (VALUES
  ('hematology', 'CBC', 'সিবিসি', 'CBC', 'blood', 'রোজার প্রয়োজন নেই', 'No fasting required', '', '', 6, 10),
  ('cardiology', 'ECG', 'ইসিজি', 'ECG', NULL, '', '', '', '', 1, 20),
  ('imaging', 'USG', 'আলট্রাসনোগ্রাফি', 'USG', NULL, 'পেটের USG-এ রোজা', 'Fasting for abdominal USG', 'পানি পান করতে পারেন', 'You may drink water', 4, 30),
  ('imaging', 'XRAY', 'এক্স-রে', 'X-ray', NULL, '', '', '', '', 2, 40)
) AS v(cat, code, name_bn, name_en, sample_type, fasting_bn, fasting_en, prep_bn, prep_en, tat, sort_order)
JOIN public.care_test_categories c ON c.slug = v.cat
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_care_staff(_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_role(_uid, 'admin')
    OR public.has_role(_uid, 'moderator')
    OR public.is_admin_staff(_uid)
  );
$$;

CREATE OR REPLACE FUNCTION public.is_care_member(_org_id UUID, _uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.care_org_members m
    WHERE m.org_id = _org_id AND m.user_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.care_org_ids(_uid UUID DEFAULT auth.uid())
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.org_id FROM public.care_org_members m WHERE m.user_id = _uid;
$$;

CREATE OR REPLACE FUNCTION public.care_default_role_permissions(_slug TEXT)
RETURNS TEXT[]
LANGUAGE sql
STABLE
AS $$
  SELECT CASE lower(_slug)
    WHEN 'owner' THEN ARRAY(SELECT key FROM public.care_permission_catalog ORDER BY sort_order)
    WHEN 'reception' THEN ARRAY['overview.view','queue.view','queue.manage','serial.issue','lab.checkin']::TEXT[]
    WHEN 'doctor' THEN ARRAY['overview.view','queue.view']::TEXT[]
    WHEN 'lab_tech' THEN ARRAY['overview.view','lab.checkin','lab.calendar']::TEXT[]
    ELSE ARRAY['overview.view','queue.view']::TEXT[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.care_has_permission(_org_id UUID, _key TEXT, _uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  perms TEXT[];
  slug TEXT;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF public.is_care_staff(_uid) THEN RETURN true; END IF;
  SELECT r.permissions, COALESCE(r.slug, m.role)
    INTO perms, slug
  FROM public.care_org_members m
  LEFT JOIN public.care_org_roles r ON r.id = m.role_id
  WHERE m.org_id = _org_id AND m.user_id = _uid
  LIMIT 1;
  IF slug IS NULL THEN RETURN false; END IF;
  IF perms IS NULL OR cardinality(perms) = 0 THEN
    perms := public.care_default_role_permissions(slug);
  END IF;
  RETURN _key = ANY (perms);
END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_care_default_roles(_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.care_org_roles (org_id, slug, name, name_bn, is_system, permissions)
  VALUES
    (_org_id, 'owner', 'Owner', 'মালিক', true, public.care_default_role_permissions('owner')),
    (_org_id, 'reception', 'Reception', 'রিসেপশন', true, public.care_default_role_permissions('reception')),
    (_org_id, 'doctor', 'Doctor', 'ডাক্তার', true, public.care_default_role_permissions('doctor')),
    (_org_id, 'lab_tech', 'Lab tech', 'ল্যাব টেক', true, public.care_default_role_permissions('lab_tech'))
  ON CONFLICT (org_id, slug) DO NOTHING;

  UPDATE public.care_org_members m
  SET role_id = r.id
  FROM public.care_org_roles r
  WHERE m.org_id = _org_id
    AND m.role_id IS NULL
    AND r.org_id = _org_id
    AND r.slug = m.role;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_write_audit(
  _org_id UUID,
  _action TEXT,
  _entity TEXT,
  _entity_id UUID,
  _meta JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.care_audit_log (org_id, actor_id, action, entity, entity_id, meta)
  VALUES (_org_id, auth.uid(), _action, _entity, _entity_id, COALESCE(_meta, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.care_notify(
  _user_id UUID,
  _slug TEXT,
  _body TEXT,
  _data JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tpl public.care_notif_templates%ROWTYPE;
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  SELECT * INTO tpl FROM public.care_notif_templates WHERE slug = _slug AND is_active LIMIT 1;
  INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
  VALUES (
    _user_id,
    'system',
    COALESCE(tpl.slug, _slug),
    COALESCE(_body, tpl.body_en, ''),
    jsonb_build_object('kind', COALESCE(tpl.slug, _slug)) || COALESCE(_data, '{}'::jsonb),
    false
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Chamber RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.care_ensure_session(_schedule_id UUID, _date DATE)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid UUID;
  sch public.care_schedules%ROWTYPE;
  aff public.care_affiliations%ROWTYPE;
BEGIN
  SELECT * INTO sch FROM public.care_schedules WHERE id = _schedule_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Schedule not found'; END IF;
  IF EXTRACT(DOW FROM _date)::INT <> sch.weekday THEN
    RAISE EXCEPTION 'Date does not match schedule weekday';
  END IF;
  SELECT * INTO aff FROM public.care_affiliations WHERE id = sch.affiliation_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Affiliation not found'; END IF;

  INSERT INTO public.care_sessions (
    schedule_id, org_id, location_id, doctor_id, session_date,
    status, max_serial, start_number, last_issued
  )
  VALUES (
    sch.id, aff.org_id, aff.location_id, aff.doctor_id, _date,
    'scheduled', sch.max_serial, sch.start_number, sch.start_number - 1
  )
  ON CONFLICT (schedule_id, session_date) DO NOTHING
  RETURNING id INTO sid;

  IF sid IS NULL THEN
    SELECT id INTO sid FROM public.care_sessions
    WHERE schedule_id = _schedule_id AND session_date = _date;
  END IF;
  RETURN sid;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_issue_serial(
  _session_id UUID,
  _patient_id UUID DEFAULT NULL,
  _guest_name TEXT DEFAULT NULL,
  _guest_phone TEXT DEFAULT NULL,
  _source TEXT DEFAULT 'app'
)
RETURNS public.care_serials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess public.care_sessions%ROWTYPE;
  sch public.care_schedules%ROWTYPE;
  ticket public.care_serials%ROWTYPE;
  next_no INT;
  uid UUID := auth.uid();
  src TEXT := COALESCE(NULLIF(_source, ''), 'app');
BEGIN
  SELECT * INTO sess FROM public.care_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  SELECT * INTO sch FROM public.care_schedules WHERE id = sess.schedule_id;

  IF src = 'walk_in' THEN
    IF NOT public.care_has_permission(sess.org_id, 'serial.issue', uid) THEN
      RAISE EXCEPTION 'Not allowed to issue walk-in serial';
    END IF;
    IF sch.allow_walk_in IS FALSE THEN RAISE EXCEPTION 'Walk-in disabled'; END IF;
    IF sess.status NOT IN ('open', 'paused') THEN RAISE EXCEPTION 'Session is not open'; END IF;
  ELSE
    IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
    _patient_id := uid;
    IF sch.allow_app_booking IS FALSE THEN RAISE EXCEPTION 'App booking disabled'; END IF;
    IF sess.status NOT IN ('scheduled', 'open') THEN RAISE EXCEPTION 'Session not bookable'; END IF;
    IF sess.status <> 'open' THEN
      IF now() > ((sess.session_date + sch.start_time) - make_interval(hours => COALESCE(sch.booking_window_hours, 12))) THEN
        RAISE EXCEPTION 'Booking window closed';
      END IF;
    END IF;
  END IF;

  IF _patient_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.care_serials s
    WHERE s.session_id = sess.id
      AND s.patient_id = _patient_id
      AND s.status NOT IN ('cancelled', 'done', 'no_show')
  ) THEN
    RAISE EXCEPTION 'You already have a serial for this session';
  END IF;

  next_no := sess.last_issued + 1;
  IF next_no > sess.max_serial THEN RAISE EXCEPTION 'Serial full'; END IF;

  UPDATE public.care_sessions
  SET last_issued = next_no
  WHERE id = sess.id;

  INSERT INTO public.care_serials (
    session_id, serial_no, patient_id, guest_name, guest_phone, source, status
  )
  VALUES (
    sess.id, next_no, _patient_id, NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), src, 'booked'
  )
  RETURNING * INTO ticket;

  PERFORM public.care_write_audit(sess.org_id, 'serial.issue', 'care_serials', ticket.id,
    jsonb_build_object('serial_no', next_no, 'source', src));

  IF ticket.patient_id IS NOT NULL THEN
    PERFORM public.care_notify(
      ticket.patient_id,
      'care_serial_booked',
      'Serial ' || ticket.serial_no::text,
      jsonb_build_object('serial_id', ticket.id, 'serial', ticket.serial_no, 'session_id', sess.id)
    );
  END IF;

  RETURN ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_set_session_status(_session_id UUID, _status TEXT)
RETURNS public.care_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess public.care_sessions%ROWTYPE;
BEGIN
  SELECT * INTO sess FROM public.care_sessions WHERE id = _session_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF NOT public.care_has_permission(sess.org_id, 'queue.manage') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _status NOT IN ('scheduled', 'open', 'paused', 'closed') THEN
    RAISE EXCEPTION 'Invalid session status';
  END IF;
  UPDATE public.care_sessions
  SET status = _status,
      opened_at = CASE WHEN _status = 'open' THEN COALESCE(opened_at, now()) ELSE opened_at END,
      closed_at = CASE WHEN _status = 'closed' THEN now() ELSE closed_at END
  WHERE id = _session_id
  RETURNING * INTO sess;
  PERFORM public.care_write_audit(sess.org_id, 'session.' || _status, 'care_sessions', sess.id, '{}'::jsonb);
  IF _status IN ('paused', 'closed') THEN
    INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
    SELECT s.patient_id, 'system', 'care_session_paused',
           'Session updated',
           jsonb_build_object('kind', 'care_session_paused', 'session_id', sess.id, 'status', _status),
           false
    FROM public.care_serials s
    WHERE s.session_id = sess.id
      AND s.patient_id IS NOT NULL
      AND s.status NOT IN ('cancelled', 'done', 'no_show');
  END IF;
  RETURN sess;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_call_next(_session_id UUID)
RETURNS public.care_serials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess public.care_sessions%ROWTYPE;
  ticket public.care_serials%ROWTYPE;
  ahead INT;
BEGIN
  SELECT * INTO sess FROM public.care_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF NOT public.care_has_permission(sess.org_id, 'queue.manage') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF sess.status <> 'open' THEN RAISE EXCEPTION 'Session is not open'; END IF;

  SELECT * INTO ticket
  FROM public.care_serials
  WHERE session_id = sess.id
    AND status IN ('booked', 'checked_in')
  ORDER BY serial_no
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'No waiting patients'; END IF;

  UPDATE public.care_serials
  SET status = 'called', called_at = now()
  WHERE id = ticket.id
  RETURNING * INTO ticket;

  UPDATE public.care_sessions SET now_serving = ticket.serial_no WHERE id = sess.id;

  PERFORM public.care_write_audit(sess.org_id, 'serial.call', 'care_serials', ticket.id,
    jsonb_build_object('serial_no', ticket.serial_no));

  IF ticket.patient_id IS NOT NULL THEN
    PERFORM public.care_notify(
      ticket.patient_id, 'care_serial_called',
      'Serial ' || ticket.serial_no::text,
      jsonb_build_object('serial_id', ticket.id, 'serial', ticket.serial_no, 'session_id', sess.id)
    );
  END IF;

  -- notify patients 3 ahead
  FOR ticket IN
    SELECT * FROM public.care_serials
    WHERE session_id = sess.id
      AND status IN ('booked', 'checked_in')
      AND patient_id IS NOT NULL
      AND serial_no > (SELECT now_serving FROM public.care_sessions WHERE id = sess.id)
    ORDER BY serial_no
    LIMIT 8
  LOOP
    SELECT count(*) INTO ahead
    FROM public.care_serials
    WHERE session_id = sess.id
      AND status IN ('booked', 'checked_in')
      AND serial_no < ticket.serial_no;
    IF ahead BETWEEN 1 AND 3 THEN
      PERFORM public.care_notify(
        ticket.patient_id, 'care_serial_ahead',
        ahead::text || ' ahead',
        jsonb_build_object('serial_id', ticket.id, 'ahead', ahead, 'now', sess.now_serving, 'session_id', sess.id)
      );
    END IF;
  END LOOP;

  SELECT * INTO ticket FROM public.care_serials WHERE id = (
    SELECT id FROM public.care_serials WHERE session_id = sess.id AND status = 'called' ORDER BY called_at DESC NULLS LAST LIMIT 1
  );
  RETURN ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_set_serial_status(_serial_id UUID, _status TEXT)
RETURNS public.care_serials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket public.care_serials%ROWTYPE;
  sess public.care_sessions%ROWTYPE;
BEGIN
  SELECT * INTO ticket FROM public.care_serials WHERE id = _serial_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serial not found'; END IF;
  SELECT * INTO sess FROM public.care_sessions WHERE id = ticket.session_id;
  IF auth.uid() = ticket.patient_id AND _status = 'cancelled' THEN
    NULL;
  ELSIF NOT public.care_has_permission(sess.org_id, 'queue.manage') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.care_serial_statuses WHERE slug = _status AND is_active) THEN
    RAISE EXCEPTION 'Invalid serial status';
  END IF;
  UPDATE public.care_serials
  SET status = _status,
      done_at = CASE WHEN _status IN ('done', 'no_show', 'cancelled') THEN now() ELSE done_at END
  WHERE id = _serial_id
  RETURNING * INTO ticket;
  PERFORM public.care_write_audit(sess.org_id, 'serial.' || _status, 'care_serials', ticket.id, '{}'::jsonb);
  RETURN ticket;
END;
$$;

-- ---------------------------------------------------------------------------
-- Lab RPCs
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.care_reserve_lab(
  _calendar_id UUID,
  _patient_id UUID DEFAULT NULL,
  _guest_name TEXT DEFAULT NULL,
  _guest_phone TEXT DEFAULT NULL,
  _source TEXT DEFAULT 'app'
)
RETURNS public.care_lab_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cal public.care_lab_calendars%ROWTYPE;
  off public.care_test_offerings%ROWTYPE;
  booking public.care_lab_bookings%ROWTYPE;
  uid UUID := auth.uid();
  src TEXT := COALESCE(NULLIF(_source, ''), 'app');
BEGIN
  SELECT * INTO cal FROM public.care_lab_calendars WHERE id = _calendar_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slot not found'; END IF;
  IF NOT cal.is_open THEN RAISE EXCEPTION 'Slot closed'; END IF;
  SELECT * INTO off FROM public.care_test_offerings WHERE id = cal.offering_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offering not found'; END IF;

  IF src = 'walk_in' THEN
    IF NOT public.care_has_permission(off.org_id, 'lab.checkin', uid) THEN
      RAISE EXCEPTION 'Not allowed';
    END IF;
  ELSE
    IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
    _patient_id := uid;
  END IF;

  IF cal.reserved_count >= cal.capacity THEN
    RAISE EXCEPTION 'Slot full';
  END IF;

  UPDATE public.care_lab_calendars
  SET reserved_count = reserved_count + 1
  WHERE id = cal.id
    AND reserved_count < capacity
    AND is_open
  RETURNING * INTO cal;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slot full'; END IF;

  INSERT INTO public.care_lab_bookings (
    calendar_id, offering_id, org_id, location_id, patient_id,
    guest_name, guest_phone, source, status, price
  )
  VALUES (
    cal.id, off.id, off.org_id, cal.location_id, _patient_id,
    NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), src, 'reserved', off.price
  )
  RETURNING * INTO booking;

  PERFORM public.care_write_audit(off.org_id, 'lab.reserve', 'care_lab_bookings', booking.id,
    jsonb_build_object('calendar_id', cal.id));

  IF booking.patient_id IS NOT NULL THEN
    PERFORM public.care_notify(
      booking.patient_id, 'care_lab_reserved',
      'Ref ' || booking.reference_code,
      jsonb_build_object('booking_id', booking.id, 'code', booking.reference_code)
    );
  END IF;

  RETURN booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_set_lab_booking_status(_booking_id UUID, _status TEXT)
RETURNS public.care_lab_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking public.care_lab_bookings%ROWTYPE;
  old_status TEXT;
BEGIN
  SELECT * INTO booking FROM public.care_lab_bookings WHERE id = _booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;
  old_status := booking.status;
  IF auth.uid() = booking.patient_id AND _status = 'cancelled' THEN
    NULL;
  ELSIF NOT public.care_has_permission(booking.org_id, 'lab.checkin') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.care_lab_booking_statuses WHERE slug = _status AND is_active) THEN
    RAISE EXCEPTION 'Invalid booking status';
  END IF;
  UPDATE public.care_lab_bookings SET status = _status WHERE id = _booking_id RETURNING * INTO booking;
  IF old_status NOT IN ('cancelled', 'no_show') AND _status IN ('cancelled', 'no_show') THEN
    UPDATE public.care_lab_calendars
    SET reserved_count = GREATEST(reserved_count - 1, 0)
    WHERE id = booking.calendar_id;
    IF booking.patient_id IS NOT NULL THEN
      PERFORM public.care_notify(
        booking.patient_id, 'care_lab_cancelled',
        'Ref ' || booking.reference_code,
        jsonb_build_object('booking_id', booking.id, 'code', booking.reference_code)
      );
    END IF;
  END IF;
  PERFORM public.care_write_audit(booking.org_id, 'lab.' || _status, 'care_lab_bookings', booking.id, '{}'::jsonb);
  RETURN booking;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_generate_lab_day(
  _offering_id UUID,
  _date DATE,
  _capacity INT DEFAULT NULL
)
RETURNS public.care_lab_calendars
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  off public.care_test_offerings%ROWTYPE;
  cal public.care_lab_calendars%ROWTYPE;
  cap INT;
BEGIN
  SELECT * INTO off FROM public.care_test_offerings WHERE id = _offering_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offering not found'; END IF;
  IF NOT public.care_has_permission(off.org_id, 'lab.calendar') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  cap := COALESCE(_capacity, off.default_capacity, 40);
  INSERT INTO public.care_lab_calendars (offering_id, location_id, cal_date, slot_key, capacity, reserved_count, is_open)
  VALUES (off.id, off.location_id, _date, '00:00', cap, 0, true)
  ON CONFLICT (offering_id, cal_date, slot_key)
  DO UPDATE SET capacity = EXCLUDED.capacity, is_open = true
  RETURNING * INTO cal;
  RETURN cal;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'care_vendor_types','care_hub_modules','care_specialties','care_permission_catalog',
    'care_serial_statuses','care_lab_booking_statuses','care_booking_modes','care_notif_templates',
    'care_test_categories','care_test_catalog','care_orgs','care_org_roles','care_org_members',
    'care_locations','care_doctors','care_affiliations','care_schedules','care_sessions','care_serials',
    'care_test_offerings','care_lab_calendars','care_lab_bookings','care_audit_log'
  ]
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.is_care_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_care_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_org_ids(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_has_permission(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ensure_care_default_roles(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_ensure_session(UUID, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_issue_serial(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_set_session_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_call_next(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_set_serial_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_reserve_lab(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_set_lab_booking_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.care_generate_lab_day(UUID, DATE, INT) TO authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

-- Catalogs: public read, staff write
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'care_vendor_types','care_hub_modules','care_specialties','care_permission_catalog',
    'care_serial_statuses','care_lab_booking_statuses','care_booking_modes','care_notif_templates',
    'care_test_categories','care_test_catalog'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_read', t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_staff', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_care_staff()) WITH CHECK (public.is_care_staff())',
      t || '_staff', t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS care_orgs_public_read ON public.care_orgs;
CREATE POLICY care_orgs_public_read ON public.care_orgs FOR SELECT TO authenticated
  USING (
    (is_active AND is_verified AND is_listed)
    OR public.is_care_member(id)
    OR public.is_care_staff()
  );

CREATE OR REPLACE FUNCTION public.care_protect_kyc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_care_staff() THEN
    RETURN NEW;
  END IF;
  NEW.is_verified := OLD.is_verified;
  NEW.is_listed := OLD.is_listed;
  NEW.kyc_status := OLD.kyc_status;
  NEW.kyc_notes := OLD.kyc_notes;
  NEW.featured := OLD.featured;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS care_orgs_protect_kyc ON public.care_orgs;
CREATE TRIGGER care_orgs_protect_kyc
  BEFORE UPDATE ON public.care_orgs
  FOR EACH ROW
  EXECUTE FUNCTION public.care_protect_kyc();

DROP POLICY IF EXISTS care_orgs_staff_write ON public.care_orgs;
CREATE POLICY care_orgs_staff_write ON public.care_orgs FOR ALL TO authenticated
  USING (public.is_care_staff() OR public.care_has_permission(id, 'settings.edit'))
  WITH CHECK (public.is_care_staff() OR public.care_has_permission(id, 'settings.edit'));

DROP POLICY IF EXISTS care_org_roles_read ON public.care_org_roles;
CREATE POLICY care_org_roles_read ON public.care_org_roles FOR SELECT TO authenticated
  USING (public.is_care_member(org_id) OR public.is_care_staff());
DROP POLICY IF EXISTS care_org_roles_write ON public.care_org_roles;
CREATE POLICY care_org_roles_write ON public.care_org_roles FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'roles.manage') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'roles.manage') OR public.is_care_staff());

DROP POLICY IF EXISTS care_org_members_read ON public.care_org_members;
CREATE POLICY care_org_members_read ON public.care_org_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_care_member(org_id) OR public.is_care_staff());
DROP POLICY IF EXISTS care_org_members_write ON public.care_org_members;
CREATE POLICY care_org_members_write ON public.care_org_members FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'staff.manage') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'staff.manage') OR public.is_care_staff());

DROP POLICY IF EXISTS care_locations_read ON public.care_locations;
CREATE POLICY care_locations_read ON public.care_locations FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.care_orgs o WHERE o.id = org_id AND o.is_active AND o.is_verified AND o.is_listed)
    OR public.is_care_member(org_id) OR public.is_care_staff()
  );
DROP POLICY IF EXISTS care_locations_write ON public.care_locations;
CREATE POLICY care_locations_write ON public.care_locations FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'settings.edit') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'settings.edit') OR public.is_care_staff());

DROP POLICY IF EXISTS care_doctors_read ON public.care_doctors;
CREATE POLICY care_doctors_read ON public.care_doctors FOR SELECT TO authenticated
  USING (
    is_active AND EXISTS (
      SELECT 1 FROM public.care_affiliations a
      JOIN public.care_orgs o ON o.id = a.org_id
      WHERE a.doctor_id = care_doctors.id AND a.is_active AND o.is_verified AND o.is_listed AND o.is_active
    )
    OR user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.care_affiliations a WHERE a.doctor_id = care_doctors.id AND public.is_care_member(a.org_id))
    OR public.is_care_staff()
  );
DROP POLICY IF EXISTS care_doctors_write ON public.care_doctors;
CREATE POLICY care_doctors_write ON public.care_doctors FOR ALL TO authenticated
  USING (
    public.is_care_staff()
    OR EXISTS (
      SELECT 1 FROM public.care_affiliations a
      WHERE a.doctor_id = care_doctors.id AND public.care_has_permission(a.org_id, 'doctors.manage')
    )
  )
  WITH CHECK (
    public.is_care_staff()
    OR EXISTS (
      SELECT 1 FROM public.care_affiliations a
      WHERE a.doctor_id = care_doctors.id AND public.care_has_permission(a.org_id, 'doctors.manage')
    )
  );

DROP POLICY IF EXISTS care_aff_read ON public.care_affiliations;
CREATE POLICY care_aff_read ON public.care_affiliations FOR SELECT TO authenticated
  USING (
    is_active AND EXISTS (SELECT 1 FROM public.care_orgs o WHERE o.id = org_id AND o.is_verified AND o.is_listed AND o.is_active)
    OR public.is_care_member(org_id) OR public.is_care_staff()
  );
DROP POLICY IF EXISTS care_aff_write ON public.care_affiliations;
CREATE POLICY care_aff_write ON public.care_affiliations FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'doctors.manage') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'doctors.manage') OR public.is_care_staff());

DROP POLICY IF EXISTS care_sched_read ON public.care_schedules;
CREATE POLICY care_sched_read ON public.care_schedules FOR SELECT TO authenticated
  USING (
    is_active AND EXISTS (
      SELECT 1 FROM public.care_affiliations a
      JOIN public.care_orgs o ON o.id = a.org_id
      WHERE a.id = affiliation_id AND o.is_verified AND o.is_listed AND o.is_active
    )
    OR EXISTS (
      SELECT 1 FROM public.care_affiliations a
      WHERE a.id = affiliation_id AND public.is_care_member(a.org_id)
    )
    OR public.is_care_staff()
  );
DROP POLICY IF EXISTS care_sched_write ON public.care_schedules;
CREATE POLICY care_sched_write ON public.care_schedules FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.care_affiliations a
      WHERE a.id = affiliation_id AND public.care_has_permission(a.org_id, 'schedule.manage')
    ) OR public.is_care_staff()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.care_affiliations a
      WHERE a.id = affiliation_id AND public.care_has_permission(a.org_id, 'schedule.manage')
    ) OR public.is_care_staff()
  );

DROP POLICY IF EXISTS care_sess_read ON public.care_sessions;
CREATE POLICY care_sess_read ON public.care_sessions FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.care_orgs o WHERE o.id = org_id AND o.is_verified AND o.is_listed AND o.is_active)
    OR public.is_care_member(org_id) OR public.is_care_staff()
  );
DROP POLICY IF EXISTS care_sess_write ON public.care_sessions;
CREATE POLICY care_sess_write ON public.care_sessions FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'queue.manage') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'queue.manage') OR public.is_care_staff());

DROP POLICY IF EXISTS care_serials_read ON public.care_serials;
CREATE POLICY care_serials_read ON public.care_serials FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.care_sessions s
      WHERE s.id = session_id AND (public.is_care_member(s.org_id) OR public.is_care_staff())
    )
  );
-- no direct client insert/update of serial_no — RPCs only
DROP POLICY IF EXISTS care_serials_no_client_write ON public.care_serials;
CREATE POLICY care_serials_no_client_write ON public.care_serials FOR INSERT TO authenticated
  WITH CHECK (false);
DROP POLICY IF EXISTS care_serials_no_client_upd ON public.care_serials;
CREATE POLICY care_serials_no_client_upd ON public.care_serials FOR UPDATE TO authenticated
  USING (false);

DROP POLICY IF EXISTS care_off_read ON public.care_test_offerings;
CREATE POLICY care_off_read ON public.care_test_offerings FOR SELECT TO authenticated
  USING (
    is_active AND EXISTS (SELECT 1 FROM public.care_orgs o WHERE o.id = org_id AND o.is_verified AND o.is_listed AND o.is_active)
    OR public.is_care_member(org_id) OR public.is_care_staff()
  );
DROP POLICY IF EXISTS care_off_write ON public.care_test_offerings;
CREATE POLICY care_off_write ON public.care_test_offerings FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'lab.offerings') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'lab.offerings') OR public.is_care_staff());

DROP POLICY IF EXISTS care_cal_read ON public.care_lab_calendars;
CREATE POLICY care_cal_read ON public.care_lab_calendars FOR SELECT TO authenticated
  USING (
    is_open OR EXISTS (
      SELECT 1 FROM public.care_test_offerings o
      WHERE o.id = offering_id AND public.is_care_member(o.org_id)
    ) OR public.is_care_staff()
  );
DROP POLICY IF EXISTS care_cal_write ON public.care_lab_calendars;
CREATE POLICY care_cal_write ON public.care_lab_calendars FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.care_test_offerings o
      WHERE o.id = offering_id AND public.care_has_permission(o.org_id, 'lab.calendar')
    ) OR public.is_care_staff()
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.care_test_offerings o
      WHERE o.id = offering_id AND public.care_has_permission(o.org_id, 'lab.calendar')
    ) OR public.is_care_staff()
  );

DROP POLICY IF EXISTS care_lab_book_read ON public.care_lab_bookings;
CREATE POLICY care_lab_book_read ON public.care_lab_bookings FOR SELECT TO authenticated
  USING (patient_id = auth.uid() OR public.is_care_member(org_id) OR public.is_care_staff());
DROP POLICY IF EXISTS care_lab_book_no_ins ON public.care_lab_bookings;
CREATE POLICY care_lab_book_no_ins ON public.care_lab_bookings FOR INSERT TO authenticated WITH CHECK (false);
DROP POLICY IF EXISTS care_lab_book_no_upd ON public.care_lab_bookings;
CREATE POLICY care_lab_book_no_upd ON public.care_lab_bookings FOR UPDATE TO authenticated USING (false);

DROP POLICY IF EXISTS care_audit_read ON public.care_audit_log;
CREATE POLICY care_audit_read ON public.care_audit_log FOR SELECT TO authenticated
  USING (public.is_care_staff() OR (org_id IS NOT NULL AND public.care_has_permission(org_id, 'overview.view')));

-- Doctors insert: staff or org with doctors.manage (new doctor has no affiliation yet)
DROP POLICY IF EXISTS care_doctors_insert ON public.care_doctors;
CREATE POLICY care_doctors_insert ON public.care_doctors FOR INSERT TO authenticated
  WITH CHECK (public.is_care_staff() OR EXISTS (
    SELECT 1 FROM public.care_org_members m WHERE m.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- Admin ACL
-- ---------------------------------------------------------------------------

INSERT INTO public.admin_permissions (key, module, action, label_en, label_bn, sort_order) VALUES
  ('care.view', 'care', 'view', 'View Care CMS', 'কেয়ার CMS দেখা', 120),
  ('care.edit', 'care', 'edit', 'Edit Care catalogs', 'কেয়ার ক্যাটালগ এডিট', 121),
  ('care.kyc', 'care', 'kyc', 'Verify Care vendors', 'কেয়ার KYC', 122),
  ('care.orgs', 'care', 'orgs', 'Manage Care organizations', 'কেয়ার অর্গ ম্যানেজ', 123)
ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  label_en = EXCLUDED.label_en,
  label_bn = EXCLUDED.label_bn,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.slug = 'super-admin'
  AND p.key LIKE 'care.%'
ON CONFLICT DO NOTHING;

-- Realtime
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.care_sessions; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.care_serials; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.care_lab_calendars; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.care_lab_bookings; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
