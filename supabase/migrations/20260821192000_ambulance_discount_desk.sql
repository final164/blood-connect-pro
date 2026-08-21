-- Ambulance offering discount % + fare snapshot on requests (mirror lab pattern)

ALTER TABLE public.ambulance_service_offerings
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ambulance_offerings_discount_percent_check'
  ) THEN
    ALTER TABLE public.ambulance_service_offerings
      ADD CONSTRAINT ambulance_offerings_discount_percent_check
      CHECK (discount_percent >= 0 AND discount_percent <= 100);
  END IF;
END $$;

ALTER TABLE public.ambulance_requests
  ADD COLUMN IF NOT EXISTS fare_original NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2);

COMMENT ON COLUMN public.ambulance_service_offerings.discount_percent IS
  'Percent off computed list fare (base+km / min); sale charged on booking';
COMMENT ON COLUMN public.ambulance_requests.fare_original IS
  'List fare before discount at booking time';
COMMENT ON COLUMN public.ambulance_requests.discount_percent IS
  'Discount % applied at booking time';

-- Demo discounts by service type slug (only where still 0)
UPDATE public.ambulance_service_offerings o
SET discount_percent = v.pct
FROM public.ambulance_service_types t,
LATERAL (
  SELECT CASE lower(t.slug)
    WHEN 'basic' THEN 10::numeric
    WHEN 'icu' THEN 15::numeric
    WHEN 'freezer' THEN 12::numeric
    WHEN 'neonatal' THEN 18::numeric
    WHEN 'ac' THEN 10::numeric
    ELSE 8::numeric
  END AS pct
) v
WHERE o.service_type_id = t.id
  AND COALESCE(o.discount_percent, 0) = 0
  AND o.is_active = true;

-- Listed providers: authenticated patients can read active offerings (for provider page)
DROP POLICY IF EXISTS amb_off_listed_read ON public.ambulance_service_offerings;
CREATE POLICY amb_off_listed_read ON public.ambulance_service_offerings
FOR SELECT TO authenticated
USING (
  is_active
  AND EXISTS (
    SELECT 1
    FROM public.care_orgs o
    WHERE o.id = ambulance_service_offerings.org_id
      AND o.is_active
      AND o.is_listed
      AND o.is_verified
  )
);

CREATE OR REPLACE FUNCTION public.ambulance_list_fare(
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
  list_fare NUMERIC;
  disc NUMERIC;
BEGIN
  SELECT * INTO off FROM public.ambulance_service_offerings
  WHERE org_id = _org_id AND service_type_id = _service_type_id AND is_active LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  list_fare := public.ambulance_list_fare(_org_id, _service_type_id, _distance_km);
  IF list_fare IS NULL THEN RETURN NULL; END IF;

  disc := LEAST(100, GREATEST(0, COALESCE(off.discount_percent, 0)));
  RETURN ROUND(list_fare * (1 - disc / 100.0), 2);
END;
$$;

CREATE OR REPLACE FUNCTION public.ambulance_fare_breakdown(
  _org_id UUID,
  _service_type_id UUID,
  _distance_km NUMERIC DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  off public.ambulance_service_offerings%ROWTYPE;
  list_fare NUMERIC;
  sale_fare NUMERIC;
  disc NUMERIC;
BEGIN
  SELECT * INTO off FROM public.ambulance_service_offerings
  WHERE org_id = _org_id AND service_type_id = _service_type_id AND is_active LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  list_fare := public.ambulance_list_fare(_org_id, _service_type_id, _distance_km);
  disc := LEAST(100, GREATEST(0, COALESCE(off.discount_percent, 0)));
  sale_fare := ROUND(list_fare * (1 - disc / 100.0), 2);

  RETURN jsonb_build_object(
    'base_price', off.base_price,
    'per_km_price', off.per_km_price,
    'min_fare', off.min_fare,
    'distance_km', COALESCE(_distance_km, 0),
    'discount_percent', disc,
    'list_fare', list_fare,
    'sale_fare', sale_fare,
    'saved', GREATEST(0, list_fare - sale_fare)
  );
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
  list_fare NUMERIC;
  sale_fare NUMERIC;
  disc NUMERIC := 0;
  inv_no TEXT;
  src TEXT := COALESCE(NULLIF(_payload->>'source', ''), 'app');
BEGIN
  IF src = 'walk_in' OR src = 'phone' THEN
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
    list_fare := public.ambulance_list_fare(org_id, svc, dist);
    SELECT LEAST(100, GREATEST(0, COALESCE(o.discount_percent, 0)))
      INTO disc
    FROM public.ambulance_service_offerings o
    WHERE o.org_id = org_id AND o.service_type_id = svc AND o.is_active
    LIMIT 1;
    disc := COALESCE(disc, 0);
    IF list_fare IS NOT NULL THEN
      sale_fare := ROUND(list_fare * (1 - disc / 100.0), 2);
    END IF;
  END IF;

  INSERT INTO public.ambulance_requests (
    org_id, patient_id, guest_name, guest_phone, mode, scheduled_at,
    service_type_id, equipment_ids, priority_id, status, source,
    notes, patient_condition, pickup_address, pickup_district_id, pickup_upazila,
    pickup_lat, pickup_lng, dropoff_address, dropoff_district_id, dropoff_upazila,
    dropoff_lat, dropoff_lng, distance_km, estimated_fare, fare_original, discount_percent, extra_fields
  ) VALUES (
    org_id,
    CASE WHEN src IN ('walk_in', 'phone') THEN NULLIF(_payload->>'patient_id', '')::UUID ELSE uid END,
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
    sale_fare,
    CASE WHEN disc > 0 THEN list_fare ELSE NULL END,
    CASE WHEN disc > 0 THEN disc ELSE NULL END,
    COALESCE(_payload->'extra_fields', '{}'::jsonb)
  ) RETURNING * INTO req;

  inv_no := 'BLA-' || to_char(req.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(req.id::text, '-', ''), 1, 8));
  UPDATE public.ambulance_requests SET invoice_no = inv_no WHERE id = req.id RETURNING * INTO req;

  PERFORM public.ambulance_write_event(req.id, req.org_id, 'created', NULL, 'requested',
    jsonb_build_object(
      'mode', mode,
      'reference_code', req.reference_code,
      'invoice_no', inv_no,
      'estimated_fare', sale_fare,
      'fare_original', CASE WHEN disc > 0 THEN list_fare ELSE NULL END,
      'discount_percent', CASE WHEN disc > 0 THEN disc ELSE NULL END
    ));

  IF req.patient_id IS NOT NULL THEN
    PERFORM public.care_notify(req.patient_id, 'ambulance_requested', 'Ref ' || req.reference_code,
      jsonb_build_object('request_id', req.id, 'reference_code', req.reference_code));
  END IF;

  RETURN req;
END;
$$;
