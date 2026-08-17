-- Ambulance Service platform (catalog-driven, Care vendor integration)

-- ---------------------------------------------------------------------------
-- Global catalogs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ambulance_service_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Ambulance',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ambulance_equipment_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ambulance_request_statuses (
  slug TEXT PRIMARY KEY,
  label_bn TEXT NOT NULL,
  label_en TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#64748b',
  is_terminal BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.ambulance_status_transitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_status TEXT NOT NULL REFERENCES public.ambulance_request_statuses(slug) ON DELETE CASCADE,
  to_status TEXT NOT NULL REFERENCES public.ambulance_request_statuses(slug) ON DELETE CASCADE,
  actor_role TEXT NOT NULL DEFAULT 'dispatcher',
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (from_status, to_status, actor_role)
);

CREATE TABLE IF NOT EXISTS public.ambulance_priority_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  sla_minutes INT NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.ambulance_notif_templates (
  slug TEXT PRIMARY KEY,
  title_bn TEXT NOT NULL,
  title_en TEXT NOT NULL,
  body_bn TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'push',
  is_active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.ambulance_form_fields (
  field_key TEXT PRIMARY KEY,
  label_bn TEXT NOT NULL,
  label_en TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'text',
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_required BOOLEAN NOT NULL DEFAULT false,
  sort_order INT NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- Org-scoped fleet & pricing
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ambulance_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  service_type_id UUID REFERENCES public.ambulance_service_types(id) ON DELETE SET NULL,
  plate_no TEXT NOT NULL,
  label TEXT,
  equipment_ids UUID[] NOT NULL DEFAULT '{}',
  capacity INT NOT NULL DEFAULT 1,
  gps_phone TEXT,
  status TEXT NOT NULL DEFAULT 'available',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ambulance_vehicles_status_check CHECK (status IN ('available', 'busy', 'offline'))
);

CREATE TABLE IF NOT EXISTS public.ambulance_drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  license_no TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ambulance_vehicle_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  vehicle_id UUID NOT NULL REFERENCES public.ambulance_vehicles(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES public.ambulance_drivers(id) ON DELETE CASCADE,
  is_primary BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, driver_id)
);

CREATE TABLE IF NOT EXISTS public.ambulance_service_offerings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  service_type_id UUID NOT NULL REFERENCES public.ambulance_service_types(id) ON DELETE CASCADE,
  base_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  per_km_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  min_fare NUMERIC(12, 2) NOT NULL DEFAULT 0,
  home_pickup BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, service_type_id)
);

CREATE TABLE IF NOT EXISTS public.ambulance_coverage_areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE,
  district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  upazilas TEXT[] NOT NULL DEFAULT '{}',
  radius_km NUMERIC(8, 2),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ambulance_availability_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.care_orgs(id) ON DELETE CASCADE UNIQUE,
  is_24_7 BOOLEAN NOT NULL DEFAULT true,
  weekly_hours JSONB NOT NULL DEFAULT '{}'::jsonb,
  holiday_overrides JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Requests & audit
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ambulance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES public.care_orgs(id) ON DELETE SET NULL,
  patient_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_phone TEXT,
  mode TEXT NOT NULL DEFAULT 'emergency',
  scheduled_at TIMESTAMPTZ,
  service_type_id UUID REFERENCES public.ambulance_service_types(id) ON DELETE SET NULL,
  equipment_ids UUID[] NOT NULL DEFAULT '{}',
  priority_id UUID REFERENCES public.ambulance_priority_levels(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  assigned_vehicle_id UUID REFERENCES public.ambulance_vehicles(id) ON DELETE SET NULL,
  assigned_driver_id UUID REFERENCES public.ambulance_drivers(id) ON DELETE SET NULL,
  reference_code TEXT NOT NULL DEFAULT upper(substr(encode(gen_random_bytes(5), 'hex'), 1, 8)),
  invoice_no TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  estimated_fare NUMERIC(12, 2),
  final_fare NUMERIC(12, 2),
  distance_km NUMERIC(8, 2),
  source TEXT NOT NULL DEFAULT 'app',
  notes TEXT,
  patient_condition TEXT,
  pickup_address TEXT,
  pickup_district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  pickup_upazila TEXT,
  pickup_lat NUMERIC(10, 7),
  pickup_lng NUMERIC(10, 7),
  dropoff_address TEXT,
  dropoff_district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  dropoff_upazila TEXT,
  dropoff_lat NUMERIC(10, 7),
  dropoff_lng NUMERIC(10, 7),
  extra_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ambulance_requests_mode_check CHECK (mode IN ('emergency', 'scheduled')),
  CONSTRAINT ambulance_requests_source_check CHECK (source IN ('app', 'walk_in', 'phone')),
  CONSTRAINT ambulance_requests_payment_status_check CHECK (payment_status IN ('pending', 'paid', 'waived'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ambulance_requests_reference_code_idx ON public.ambulance_requests (reference_code);
CREATE UNIQUE INDEX IF NOT EXISTS ambulance_requests_invoice_no_idx ON public.ambulance_requests (invoice_no) WHERE invoice_no IS NOT NULL;
CREATE INDEX IF NOT EXISTS ambulance_requests_org_status_idx ON public.ambulance_requests (org_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ambulance_requests_patient_idx ON public.ambulance_requests (patient_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ambulance_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.ambulance_requests(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.care_orgs(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ambulance_request_events_request_idx ON public.ambulance_request_events (request_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- App settings
-- ---------------------------------------------------------------------------

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS ambulance_settings JSONB NOT NULL DEFAULT '{
    "features": {
      "emergency_enabled": true,
      "scheduled_enabled": true,
      "auto_assign": false,
      "require_quote_approval": false
    },
    "coverage": {
      "default_search_radius_km": 25,
      "allow_cross_district": true
    },
    "pricing": {
      "platform_commission_pct": 0,
      "min_fare_cap": 0,
      "max_fare_cap": 0
    },
    "labels": {
      "hub_title_bn": "অ্যাম্বুলেন্স",
      "hub_title_en": "Ambulance",
      "emergency_cta_bn": "জরুরি অ্যাম্বুলেন্স",
      "emergency_cta_en": "Emergency ambulance",
      "scheduled_cta_bn": "আগে থেকে বুক",
      "scheduled_cta_en": "Schedule booking"
    },
    "notifications": {
      "push_enabled": true,
      "sms_enabled": false
    },
    "webhook_url": null
  }'::jsonb;

-- ---------------------------------------------------------------------------
-- Care integration seeds
-- ---------------------------------------------------------------------------

INSERT INTO public.care_vendor_types (slug, name_bn, name_en, panels, sort_order) VALUES
  ('ambulance', 'অ্যাম্বুলেন্স সার্ভিস', 'Ambulance service', ARRAY['ambulance']::TEXT[], 15)
ON CONFLICT (slug) DO UPDATE SET
  name_bn = EXCLUDED.name_bn,
  name_en = EXCLUDED.name_en,
  panels = EXCLUDED.panels,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.care_hub_modules (slug, label_bn, label_en, icon, href, audience, sort_order) VALUES
  ('ambulance', 'অ্যাম্বুলেন্স', 'Ambulance', 'Ambulance', '/ambulance', 'patient', 25),
  ('ambulance_desk', 'অ্যাম্বুলেন্স ডেস্ক', 'Ambulance desk', 'Ambulance', '/care/portal/ambulance', 'staff', 55)
ON CONFLICT (slug) DO UPDATE SET
  label_bn = EXCLUDED.label_bn,
  label_en = EXCLUDED.label_en,
  icon = EXCLUDED.icon,
  href = EXCLUDED.href,
  audience = EXCLUDED.audience,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.care_permission_catalog (key, group_key, label_en, label_bn, sort_order) VALUES
  ('ambulance.dispatch.view', 'ambulance', 'View dispatch board', 'ডিসপ্যাচ বোর্ড দেখা', 80),
  ('ambulance.dispatch.manage', 'ambulance', 'Manage dispatch', 'ডিসপ্যাচ ম্যানেজ', 81),
  ('ambulance.fleet.manage', 'ambulance', 'Manage fleet', 'ফ্লিট ম্যানেজ', 82),
  ('ambulance.pricing.manage', 'ambulance', 'Manage pricing & coverage', 'প্রাইসিং ও কভারেজ', 83),
  ('ambulance.requests.view', 'ambulance', 'View request history', 'রিকোয়েস্ট হিস্ট্রি', 84)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.ambulance_service_types (slug, name_bn, name_en, icon, sort_order) VALUES
  ('basic', 'সাধারণ', 'Basic', 'Ambulance', 10),
  ('icu', 'আইসিইউ', 'ICU', 'HeartPulse', 20),
  ('freezer', 'ফ্রিজার', 'Freezer', 'Snowflake', 30),
  ('neonatal', 'নিওনেটাল', 'Neonatal', 'Baby', 40)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.ambulance_equipment_options (slug, name_bn, name_en, sort_order) VALUES
  ('oxygen', 'অক্সিজেন', 'Oxygen', 10),
  ('ventilator', 'ভেন্টিলেটর', 'Ventilator', 20),
  ('stretcher', 'স্ট্রেচার', 'Stretcher', 30),
  ('monitor', 'মনিটর', 'Patient monitor', 40)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.ambulance_priority_levels (slug, name_bn, name_en, sla_minutes, sort_order) VALUES
  ('emergency', 'জরুরি', 'Emergency', 15, 10),
  ('urgent', 'অতি জরুরি নয়', 'Urgent', 30, 20),
  ('normal', 'সাধারণ', 'Normal', 60, 30)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.ambulance_request_statuses (slug, label_bn, label_en, color, is_terminal, sort_order) VALUES
  ('requested', 'অনুরোধ', 'Requested', '#f59e0b', false, 10),
  ('quoted', 'কোট', 'Quoted', '#8b5cf6', false, 20),
  ('accepted', 'গৃহীত', 'Accepted', '#3b82f6', false, 30),
  ('assigned', 'অ্যাসাইন', 'Assigned', '#06b6d4', false, 40),
  ('dispatched', 'রওনা', 'Dispatched', '#0ea5e9', false, 50),
  ('on_scene', 'Pickup-এ', 'On scene', '#14b8a6', false, 60),
  ('transporting', 'ট্রান্সপোর্ট', 'Transporting', '#10b981', false, 70),
  ('completed', 'সম্পন্ন', 'Completed', '#22c55e', true, 80),
  ('cancelled', 'বাতিল', 'Cancelled', '#ef4444', true, 90),
  ('rejected', 'প্রত্যাখ্যাত', 'Rejected', '#64748b', true, 95)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.ambulance_status_transitions (from_status, to_status, actor_role) VALUES
  ('requested', 'quoted', 'dispatcher'),
  ('requested', 'accepted', 'dispatcher'),
  ('requested', 'rejected', 'dispatcher'),
  ('requested', 'cancelled', 'patient'),
  ('quoted', 'accepted', 'dispatcher'),
  ('quoted', 'cancelled', 'patient'),
  ('accepted', 'assigned', 'dispatcher'),
  ('accepted', 'cancelled', 'dispatcher'),
  ('assigned', 'dispatched', 'dispatcher'),
  ('assigned', 'cancelled', 'dispatcher'),
  ('dispatched', 'on_scene', 'driver'),
  ('on_scene', 'transporting', 'driver'),
  ('transporting', 'completed', 'driver')
ON CONFLICT DO NOTHING;

INSERT INTO public.ambulance_notif_templates (slug, title_bn, title_en, body_bn, body_en) VALUES
  ('ambulance_requested', 'অ্যাম্বুলেন্স অনুরোধ', 'Ambulance requested', 'রেফ {{reference_code}} — {{pickup_address}}', 'Ref {{reference_code}} — {{pickup_address}}'),
  ('ambulance_accepted', 'অ্যাম্বুলেন্স গৃহীত', 'Ambulance accepted', 'রেফ {{reference_code}} গৃহীত হয়েছে', 'Ref {{reference_code}} accepted'),
  ('ambulance_dispatched', 'অ্যাম্বুলেন্স রওনা', 'Ambulance dispatched', 'রেফ {{reference_code}} — গাড়ি রওনা দিয়েছে', 'Ref {{reference_code}} — vehicle dispatched'),
  ('ambulance_completed', 'ট্রিপ সম্পন্ন', 'Trip completed', 'রেফ {{reference_code}} সম্পন্ন', 'Ref {{reference_code}} completed')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.ambulance_form_fields (field_key, label_bn, label_en, field_type, is_enabled, is_required, sort_order) VALUES
  ('patient_name', 'রোগীর নাম', 'Patient name', 'text', true, true, 10),
  ('patient_phone', 'মোবাইল', 'Phone', 'phone', true, true, 20),
  ('patient_condition', 'অবস্থা', 'Condition', 'textarea', true, false, 30),
  ('notes', 'নোট', 'Notes', 'textarea', true, false, 40),
  ('pickup_address', 'Pickup ঠিকানা', 'Pickup address', 'text', true, true, 50),
  ('dropoff_address', 'Dropoff ঠিকানা', 'Dropoff address', 'text', true, false, 60)
ON CONFLICT (field_key) DO NOTHING;

-- Admin permissions
INSERT INTO public.admin_permissions (key, module, action, label_en, label_bn, sort_order) VALUES
  ('ambulance.view', 'ambulance', 'view', 'View Ambulance CMS', 'অ্যাম্বুলেন্স CMS দেখা', 130),
  ('ambulance.edit', 'ambulance', 'edit', 'Edit Ambulance catalogs', 'অ্যাম্বুলেন্স ক্যাটালগ এডিট', 131),
  ('ambulance.providers', 'ambulance', 'providers', 'Manage ambulance providers', 'অ্যাম্বুলেন্স প্রোভাইডার', 132),
  ('ambulance.audit', 'ambulance', 'audit', 'View ambulance audit', 'অ্যাম্বুলেন্স অডিট', 133)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.slug = 'super-admin' AND p.key LIKE 'ambulance.%'
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ambulance_write_event(
  _request_id UUID,
  _org_id UUID,
  _event_type TEXT,
  _from_status TEXT DEFAULT NULL,
  _to_status TEXT DEFAULT NULL,
  _meta JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ambulance_request_events (request_id, org_id, actor_id, event_type, from_status, to_status, meta)
  VALUES (_request_id, _org_id, auth.uid(), _event_type, _from_status, _to_status, COALESCE(_meta, '{}'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.ambulance_transition_allowed(
  _from TEXT,
  _to TEXT,
  _actor_role TEXT DEFAULT 'dispatcher'
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ambulance_status_transitions t
    WHERE t.from_status = _from AND t.to_status = _to
      AND t.is_active AND (t.actor_role = _actor_role OR t.actor_role = 'system')
  );
$$;

CREATE OR REPLACE FUNCTION public.ambulance_calculate_fare(
  _org_id UUID,
  _service_type_id UUID,
  _distance_km NUMERIC DEFAULT 5
)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  off public.ambulance_service_offerings%ROWTYPE;
  cfg JSONB;
  min_cap NUMERIC := 0;
  max_cap NUMERIC := 0;
  fare NUMERIC;
BEGIN
  SELECT * INTO off FROM public.ambulance_service_offerings
  WHERE org_id = _org_id AND service_type_id = _service_type_id AND is_active LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  fare := GREATEST(off.min_fare, off.base_price + (COALESCE(_distance_km, 0) * off.per_km_price));

  SELECT ambulance_settings INTO cfg FROM public.app_settings WHERE id = 1;
  IF cfg IS NOT NULL THEN
    min_cap := COALESCE((cfg->'pricing'->>'min_fare_cap')::NUMERIC, 0);
    max_cap := COALESCE((cfg->'pricing'->>'max_fare_cap')::NUMERIC, 0);
  END IF;
  IF min_cap > 0 THEN fare := GREATEST(fare, min_cap); END IF;
  IF max_cap > 0 THEN fare := LEAST(fare, max_cap); END IF;
  RETURN ROUND(fare, 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.ambulance_create_request(
  _payload JSONB
)
RETURNS public.ambulance_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.ambulance_requests%ROWTYPE;
  uid UUID := auth.uid();
  cfg JSONB;
  mode TEXT := COALESCE(NULLIF(_payload->>'mode', ''), 'emergency');
  org_id UUID := NULLIF(_payload->>'org_id', '')::UUID;
  svc UUID := NULLIF(_payload->>'service_type_id', '')::UUID;
  pri UUID;
  dist NUMERIC := COALESCE((_payload->>'distance_km')::NUMERIC, 5);
  est NUMERIC;
  inv_no TEXT;
  src TEXT := COALESCE(NULLIF(_payload->>'source', ''), 'app');
BEGIN
  IF src = 'walk_in' THEN
    IF org_id IS NULL OR NOT public.care_has_permission(org_id, 'ambulance.dispatch.manage', uid) THEN
      RAISE EXCEPTION 'Not allowed';
    END IF;
  ELSE
    IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  END IF;

  SELECT ambulance_settings INTO cfg FROM public.app_settings WHERE id = 1;
  IF mode = 'emergency' AND COALESCE((cfg->'features'->>'emergency_enabled')::BOOLEAN, true) = false THEN
    RAISE EXCEPTION 'Emergency booking disabled';
  END IF;
  IF mode = 'scheduled' AND COALESCE((cfg->'features'->>'scheduled_enabled')::BOOLEAN, true) = false THEN
    RAISE EXCEPTION 'Scheduled booking disabled';
  END IF;

  SELECT id INTO pri FROM public.ambulance_priority_levels
  WHERE slug = CASE WHEN mode = 'emergency' THEN 'emergency' ELSE 'normal' END AND is_active LIMIT 1;

  IF org_id IS NOT NULL AND svc IS NOT NULL THEN
    est := public.ambulance_calculate_fare(org_id, svc, dist);
  END IF;

  INSERT INTO public.ambulance_requests (
    org_id, patient_id, guest_name, guest_phone, mode, scheduled_at,
    service_type_id, equipment_ids, priority_id, status, source,
    notes, patient_condition, pickup_address, pickup_district_id, pickup_upazila,
    pickup_lat, pickup_lng, dropoff_address, dropoff_district_id, dropoff_upazila,
    dropoff_lat, dropoff_lng, distance_km, estimated_fare, extra_fields
  ) VALUES (
    org_id,
    CASE WHEN src = 'walk_in' THEN NULLIF(_payload->>'patient_id', '')::UUID ELSE uid END,
    NULLIF(_payload->>'guest_name', ''),
    NULLIF(_payload->>'guest_phone', ''),
    mode,
    NULLIF(_payload->>'scheduled_at', '')::TIMESTAMPTZ,
    svc,
    COALESCE(ARRAY(SELECT jsonb_array_elements_text(COALESCE(_payload->'equipment_ids', '[]'::jsonb)))::UUID[], '{}'),
    pri,
    'requested',
    src,
    NULLIF(_payload->>'notes', ''),
    NULLIF(_payload->>'patient_condition', ''),
    NULLIF(_payload->>'pickup_address', ''),
    NULLIF(_payload->>'pickup_district_id', '')::UUID,
    NULLIF(_payload->>'pickup_upazila', ''),
    NULLIF(_payload->>'pickup_lat', '')::NUMERIC,
    NULLIF(_payload->>'pickup_lng', '')::NUMERIC,
    NULLIF(_payload->>'dropoff_address', ''),
    NULLIF(_payload->>'dropoff_district_id', '')::UUID,
    NULLIF(_payload->>'dropoff_upazila', ''),
    NULLIF(_payload->>'dropoff_lat', '')::NUMERIC,
    NULLIF(_payload->>'dropoff_lng', '')::NUMERIC,
    dist,
    est,
    COALESCE(_payload->'extra_fields', '{}'::jsonb)
  ) RETURNING * INTO req;

  inv_no := 'BLA-' || to_char(req.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(req.id::text, '-', ''), 1, 8));
  UPDATE public.ambulance_requests SET invoice_no = inv_no WHERE id = req.id RETURNING * INTO req;

  PERFORM public.ambulance_write_event(req.id, req.org_id, 'created', NULL, 'requested',
    jsonb_build_object('mode', mode, 'reference_code', req.reference_code, 'invoice_no', inv_no));

  IF req.patient_id IS NOT NULL THEN
    PERFORM public.care_notify(req.patient_id, 'ambulance_requested', 'Ref ' || req.reference_code,
      jsonb_build_object('request_id', req.id, 'reference_code', req.reference_code));
  END IF;

  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.ambulance_set_request_status(
  _request_id UUID,
  _status TEXT,
  _meta JSONB DEFAULT '{}'::jsonb
)
RETURNS public.ambulance_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.ambulance_requests%ROWTYPE;
  uid UUID := auth.uid();
  actor TEXT := 'dispatcher';
  old_status TEXT;
BEGIN
  SELECT * INTO req FROM public.ambulance_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  old_status := req.status;

  IF req.patient_id = uid AND _status = 'cancelled' THEN
    actor := 'patient';
  ELSIF req.org_id IS NOT NULL AND public.care_has_permission(req.org_id, 'ambulance.dispatch.manage', uid) THEN
    actor := 'dispatcher';
  ELSIF req.org_id IS NOT NULL AND public.care_has_permission(req.org_id, 'ambulance.dispatch.view', uid) THEN
    actor := 'driver';
  ELSIF public.is_care_staff(uid) THEN
    actor := 'system';
  ELSE
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF NOT public.ambulance_transition_allowed(old_status, _status, actor)
     AND NOT (public.is_care_staff(uid) AND _status = 'cancelled') THEN
    RAISE EXCEPTION 'Invalid status transition';
  END IF;

  UPDATE public.ambulance_requests
  SET status = _status, updated_at = now(),
      final_fare = CASE WHEN _status = 'completed' AND final_fare IS NULL THEN COALESCE(estimated_fare, final_fare) ELSE final_fare END
  WHERE id = _request_id
  RETURNING * INTO req;

  PERFORM public.ambulance_write_event(_request_id, req.org_id, 'status_change', old_status, _status, _meta);

  IF req.patient_id IS NOT NULL AND _status IN ('accepted', 'dispatched', 'completed') THEN
    PERFORM public.care_notify(req.patient_id, 'ambulance_' || _status, 'Ref ' || req.reference_code,
      jsonb_build_object('request_id', req.id, 'status', _status));
  END IF;

  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.ambulance_accept_request(
  _request_id UUID,
  _org_id UUID
)
RETURNS public.ambulance_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.ambulance_requests%ROWTYPE;
BEGIN
  IF NOT public.care_has_permission(_org_id, 'ambulance.dispatch.manage') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO req FROM public.ambulance_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.org_id IS NOT NULL AND req.org_id <> _org_id THEN
    RAISE EXCEPTION 'Already assigned to another provider';
  END IF;

  UPDATE public.ambulance_requests
  SET org_id = _org_id, updated_at = now()
  WHERE id = _request_id
  RETURNING * INTO req;

  RETURN public.ambulance_set_request_status(_request_id, 'accepted', jsonb_build_object('org_id', _org_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.ambulance_assign_request(
  _request_id UUID,
  _vehicle_id UUID,
  _driver_id UUID
)
RETURNS public.ambulance_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.ambulance_requests%ROWTYPE;
  veh public.ambulance_vehicles%ROWTYPE;
BEGIN
  SELECT * INTO req FROM public.ambulance_requests WHERE id = _request_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.org_id IS NULL THEN RAISE EXCEPTION 'Accept request first'; END IF;
  IF NOT public.care_has_permission(req.org_id, 'ambulance.dispatch.manage') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT * INTO veh FROM public.ambulance_vehicles WHERE id = _vehicle_id AND org_id = req.org_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found'; END IF;

  UPDATE public.ambulance_requests
  SET assigned_vehicle_id = _vehicle_id, assigned_driver_id = _driver_id, updated_at = now()
  WHERE id = _request_id
  RETURNING * INTO req;

  UPDATE public.ambulance_vehicles SET status = 'busy', updated_at = now() WHERE id = _vehicle_id;

  PERFORM public.ambulance_write_event(_request_id, req.org_id, 'assigned', req.status, req.status,
    jsonb_build_object('vehicle_id', _vehicle_id, 'driver_id', _driver_id));

  IF req.status = 'accepted' THEN
    RETURN public.ambulance_set_request_status(_request_id, 'assigned', '{}'::jsonb);
  END IF;
  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.ambulance_set_vehicle_status(
  _vehicle_id UUID,
  _status TEXT
)
RETURNS public.ambulance_vehicles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  veh public.ambulance_vehicles%ROWTYPE;
BEGIN
  IF _status NOT IN ('available', 'busy', 'offline') THEN RAISE EXCEPTION 'Invalid status'; END IF;
  SELECT * INTO veh FROM public.ambulance_vehicles WHERE id = _vehicle_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Vehicle not found'; END IF;
  IF NOT public.care_has_permission(veh.org_id, 'ambulance.fleet.manage') AND NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  UPDATE public.ambulance_vehicles SET status = _status, updated_at = now() WHERE id = _vehicle_id RETURNING * INTO veh;
  RETURN veh;
END;
$$;

CREATE OR REPLACE FUNCTION public.ambulance_set_payment(
  _request_id UUID,
  _payment_status TEXT
)
RETURNS public.ambulance_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.ambulance_requests%ROWTYPE;
BEGIN
  IF _payment_status NOT IN ('pending', 'paid', 'waived') THEN RAISE EXCEPTION 'Invalid payment status'; END IF;
  SELECT * INTO req FROM public.ambulance_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.org_id IS NULL OR NOT public.care_has_permission(req.org_id, 'ambulance.dispatch.manage') THEN
    IF NOT public.is_care_staff() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  END IF;
  UPDATE public.ambulance_requests SET payment_status = _payment_status, updated_at = now()
  WHERE id = _request_id RETURNING * INTO req;
  RETURN req;
END;
$$;

CREATE OR REPLACE FUNCTION public.ambulance_auto_assign(_request_id UUID)
RETURNS public.ambulance_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.ambulance_requests%ROWTYPE;
  cfg JSONB;
  veh_id UUID;
  drv_id UUID;
  org UUID;
BEGIN
  SELECT ambulance_settings INTO cfg FROM public.app_settings WHERE id = 1;
  IF COALESCE((cfg->'features'->>'auto_assign')::BOOLEAN, false) = false THEN
    RETURN NULL;
  END IF;

  SELECT * INTO req FROM public.ambulance_requests WHERE id = _request_id;
  IF NOT FOUND OR req.org_id IS NULL OR req.status NOT IN ('accepted', 'assigned') THEN
    RETURN req;
  END IF;

  SELECT v.id, d.id, v.org_id INTO veh_id, drv_id, org
  FROM public.ambulance_vehicles v
  LEFT JOIN public.ambulance_vehicle_assignments va ON va.vehicle_id = v.id AND va.is_primary
  LEFT JOIN public.ambulance_drivers d ON d.id = va.driver_id AND d.is_active
  WHERE v.org_id = req.org_id AND v.is_active AND v.status = 'available'
  ORDER BY v.updated_at
  LIMIT 1;

  IF veh_id IS NULL THEN RETURN req; END IF;
  RETURN public.ambulance_assign_request(_request_id, veh_id, drv_id);
END;
$$;

-- Update default role permissions to include ambulance roles
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
    WHEN 'dispatcher' THEN ARRAY['overview.view','ambulance.dispatch.view','ambulance.dispatch.manage','ambulance.requests.view','ambulance.fleet.manage','ambulance.pricing.manage']::TEXT[]
    WHEN 'driver' THEN ARRAY['overview.view','ambulance.dispatch.view','ambulance.requests.view']::TEXT[]
    ELSE ARRAY['overview.view','queue.view']::TEXT[]
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
    (_org_id, 'lab_tech', 'Lab tech', 'ল্যাব টেক', true, public.care_default_role_permissions('lab_tech')),
    (_org_id, 'dispatcher', 'Dispatcher', 'ডিসপ্যাচার', true, public.care_default_role_permissions('dispatcher')),
    (_org_id, 'driver', 'Driver', 'ড্রাইভার', true, public.care_default_role_permissions('driver'))
  ON CONFLICT (org_id, slug) DO NOTHING;

  UPDATE public.care_org_members m
  SET role_id = r.id
  FROM public.care_org_roles r
  WHERE m.org_id = _org_id AND m.role_id IS NULL AND r.org_id = _org_id AND r.slug = m.role;
END;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.ambulance_service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_equipment_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_request_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_priority_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_notif_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_form_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_drivers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_vehicle_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_service_offerings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_coverage_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_availability_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambulance_request_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY ambulance_catalog_read ON public.ambulance_service_types FOR SELECT TO authenticated USING (true);
CREATE POLICY ambulance_equipment_read ON public.ambulance_equipment_options FOR SELECT TO authenticated USING (true);
CREATE POLICY ambulance_status_read ON public.ambulance_request_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY ambulance_transitions_read ON public.ambulance_status_transitions FOR SELECT TO authenticated USING (true);
CREATE POLICY ambulance_priority_read ON public.ambulance_priority_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY ambulance_form_read ON public.ambulance_form_fields FOR SELECT TO authenticated USING (is_enabled);

CREATE POLICY ambulance_vehicles_org ON public.ambulance_vehicles FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'ambulance.fleet.manage') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'ambulance.fleet.manage') OR public.is_care_staff());

CREATE POLICY ambulance_drivers_org ON public.ambulance_drivers FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'ambulance.fleet.manage') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'ambulance.fleet.manage') OR public.is_care_staff());

CREATE POLICY ambulance_assignments_org ON public.ambulance_vehicle_assignments FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'ambulance.fleet.manage') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'ambulance.fleet.manage') OR public.is_care_staff());

CREATE POLICY ambulance_offerings_org ON public.ambulance_service_offerings FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'ambulance.pricing.manage') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'ambulance.pricing.manage') OR public.is_care_staff());

CREATE POLICY ambulance_coverage_org ON public.ambulance_coverage_areas FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'ambulance.pricing.manage') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'ambulance.pricing.manage') OR public.is_care_staff());

CREATE POLICY ambulance_availability_org ON public.ambulance_availability_rules FOR ALL TO authenticated
  USING (public.care_has_permission(org_id, 'ambulance.pricing.manage') OR public.is_care_staff())
  WITH CHECK (public.care_has_permission(org_id, 'ambulance.pricing.manage') OR public.is_care_staff());

CREATE POLICY ambulance_requests_select ON public.ambulance_requests FOR SELECT TO authenticated
  USING (
    patient_id = auth.uid()
    OR (org_id IS NOT NULL AND public.care_has_permission(org_id, 'ambulance.requests.view'))
    OR (org_id IS NULL AND status = 'requested')
    OR public.is_care_staff()
  );

CREATE POLICY ambulance_events_select ON public.ambulance_request_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.ambulance_requests r
      WHERE r.id = request_id AND (
        r.patient_id = auth.uid()
        OR (r.org_id IS NOT NULL AND public.care_has_permission(r.org_id, 'ambulance.requests.view'))
        OR public.is_care_staff()
      )
    )
  );

GRANT EXECUTE ON FUNCTION public.ambulance_create_request(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambulance_set_request_status(UUID, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambulance_accept_request(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambulance_assign_request(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambulance_set_vehicle_status(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambulance_calculate_fare(UUID, UUID, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambulance_set_payment(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambulance_auto_assign(UUID) TO authenticated;
