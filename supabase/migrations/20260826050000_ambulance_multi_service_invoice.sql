-- Multi-service ambulance booking → shared invoice_group_id + shared invoice_no (ICU, Freezer, etc.)

ALTER TABLE public.ambulance_requests
  ADD COLUMN IF NOT EXISTS invoice_group_id UUID;

CREATE INDEX IF NOT EXISTS ambulance_requests_invoice_group_idx
  ON public.ambulance_requests (invoice_group_id)
  WHERE invoice_group_id IS NOT NULL;

COMMENT ON COLUMN public.ambulance_requests.invoice_group_id IS
  'Groups multiple service-type rows under one cash memo invoice_no';

-- Allow shared invoice_no (lab pattern)
DROP INDEX IF EXISTS public.ambulance_requests_invoice_no_idx;

CREATE INDEX IF NOT EXISTS ambulance_requests_invoice_no_lookup_idx
  ON public.ambulance_requests (invoice_no)
  WHERE invoice_no IS NOT NULL;

UPDATE public.ambulance_requests
SET invoice_group_id = id
WHERE invoice_group_id IS NULL;

-- ─── Create request (single or multi service_type_ids) ───────────────────────
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
  v_org_id UUID := NULLIF(_payload->>'org_id', '')::UUID;
  svc UUID;
  svc_ids UUID[];
  pri UUID;
  dist NUMERIC := COALESCE((_payload->>'distance_km')::NUMERIC, 5);
  list_fare NUMERIC;
  sale_fare NUMERIC;
  disc NUMERIC := 0;
  inv_no TEXT;
  src TEXT := COALESCE(NULLIF(_payload->>'source', ''), 'app');
  group_id UUID;
  primary_id UUID;
  n INT := 0;
  sorted UUID[];
BEGIN
  IF src = 'walk_in' OR src = 'phone' THEN
    IF v_org_id IS NULL OR NOT public.care_has_permission(v_org_id, 'ambulance.dispatch.manage', uid) THEN
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

  IF _payload ? 'service_type_ids' AND jsonb_typeof(_payload->'service_type_ids') = 'array'
     AND jsonb_array_length(_payload->'service_type_ids') > 0 THEN
    SELECT COALESCE(array_agg(DISTINCT x ORDER BY x), '{}')
      INTO svc_ids
    FROM (
      SELECT NULLIF(jsonb_array_elements_text(_payload->'service_type_ids'), '')::UUID AS x
    ) s
    WHERE x IS NOT NULL;
  END IF;

  IF svc_ids IS NULL OR cardinality(svc_ids) < 1 THEN
    svc := NULLIF(_payload->>'service_type_id', '')::UUID;
    IF svc IS NOT NULL THEN
      svc_ids := ARRAY[svc];
    ELSE
      svc_ids := ARRAY[]::UUID[];
    END IF;
  END IF;

  IF cardinality(svc_ids) > 8 THEN
    RAISE EXCEPTION 'Too many services (max 8)';
  END IF;

  IF cardinality(svc_ids) > 1 THEN
    group_id := gen_random_uuid();
  END IF;

  IF cardinality(svc_ids) < 1 THEN
    INSERT INTO public.ambulance_requests (
      org_id, patient_id, guest_name, guest_phone, mode, scheduled_at,
      service_type_id, equipment_ids, priority_id, status, source,
      notes, patient_condition, pickup_address, pickup_district_id, pickup_upazila,
      pickup_lat, pickup_lng, dropoff_address, dropoff_district_id, dropoff_upazila,
      dropoff_lat, dropoff_lng, distance_km, estimated_fare, fare_original, discount_percent, extra_fields
    ) VALUES (
      v_org_id,
      CASE WHEN src IN ('walk_in', 'phone') THEN NULLIF(_payload->>'patient_id', '')::UUID ELSE uid END,
      NULLIF(_payload->>'guest_name', ''),
      NULLIF(_payload->>'guest_phone', ''),
      mode,
      NULLIF(_payload->>'scheduled_at', '')::TIMESTAMPTZ,
      NULL,
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
      NULL,
      NULL,
      NULL,
      COALESCE(_payload->'extra_fields', '{}'::jsonb)
    ) RETURNING * INTO req;

    inv_no := 'BLA-' || to_char(req.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(req.id::text, '-', ''), 1, 8));
    UPDATE public.ambulance_requests
    SET invoice_no = inv_no,
        invoice_group_id = req.id
    WHERE id = req.id
    RETURNING * INTO req;
  ELSE
    sorted := svc_ids;
    FOREACH svc IN ARRAY sorted LOOP
      list_fare := NULL;
      sale_fare := NULL;
      disc := 0;

      IF v_org_id IS NOT NULL AND svc IS NOT NULL THEN
        list_fare := public.ambulance_list_fare(v_org_id, svc, dist);
        SELECT LEAST(100, GREATEST(0, COALESCE(o.discount_percent, 0)))
          INTO disc
        FROM public.ambulance_service_offerings o
        WHERE o.org_id = v_org_id AND o.service_type_id = svc AND o.is_active
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
        dropoff_lat, dropoff_lng, distance_km, estimated_fare, fare_original, discount_percent,
        extra_fields, invoice_group_id
      ) VALUES (
        v_org_id,
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
        COALESCE(_payload->'extra_fields', '{}'::jsonb),
        COALESCE(group_id, NULL)
      ) RETURNING * INTO req;

      n := n + 1;
      IF primary_id IS NULL THEN
        primary_id := req.id;
        IF group_id IS NOT NULL THEN
          inv_no := 'BLA-' || to_char(req.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD')
            || '-' || upper(substr(replace(group_id::text, '-', ''), 1, 8));
        ELSE
          inv_no := 'BLA-' || to_char(req.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD')
            || '-' || upper(substr(replace(req.id::text, '-', ''), 1, 8));
        END IF;
      END IF;

      UPDATE public.ambulance_requests
      SET invoice_no = inv_no,
          invoice_group_id = COALESCE(group_id, req.id)
      WHERE id = req.id
      RETURNING * INTO req;
    END LOOP;

    SELECT * INTO req FROM public.ambulance_requests WHERE id = primary_id;
  END IF;

  PERFORM public.ambulance_write_event(req.id, req.org_id, 'created', NULL, 'requested',
    jsonb_build_object(
      'mode', mode,
      'reference_code', req.reference_code,
      'invoice_no', req.invoice_no,
      'invoice_group_id', req.invoice_group_id,
      'estimated_fare', req.estimated_fare,
      'fare_original', req.fare_original,
      'discount_percent', req.discount_percent,
      'service_count', GREATEST(1, cardinality(svc_ids))
    ));

  IF req.patient_id IS NOT NULL THEN
    PERFORM public.care_notify(req.patient_id, 'ambulance_requested', 'Ref ' || req.reference_code,
      jsonb_build_object(
        'request_id', req.id,
        'reference_code', req.reference_code,
        'invoice_no', req.invoice_no,
        'invoice_group_id', req.invoice_group_id
      ));
  END IF;

  RETURN req;
END;
$$;

-- ─── Payment applies to whole invoice group ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.ambulance_set_payment(
  _request_id UUID,
  _payment_status TEXT,
  _amount_received NUMERIC DEFAULT NULL
)
RETURNS public.ambulance_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.ambulance_requests%ROWTYPE;
  gid UUID;
  recv NUMERIC(12, 2);
BEGIN
  IF _payment_status NOT IN ('pending', 'paid', 'waived') THEN RAISE EXCEPTION 'Invalid payment status'; END IF;
  SELECT * INTO req FROM public.ambulance_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.org_id IS NULL OR NOT public.care_has_permission(req.org_id, 'ambulance.dispatch.manage') THEN
    IF NOT public.is_care_staff() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  END IF;

  gid := COALESCE(req.invoice_group_id, req.id);

  IF _payment_status = 'waived' THEN
    recv := 0;
  ELSIF _payment_status = 'pending' THEN
    recv := NULL;
  ELSIF _amount_received IS NOT NULL THEN
    recv := GREATEST(0, _amount_received);
  ELSE
    recv := NULL;
  END IF;

  UPDATE public.ambulance_requests
  SET payment_status = _payment_status,
      amount_received = recv,
      updated_at = now()
  WHERE COALESCE(invoice_group_id, id) = gid
     OR id = _request_id;

  SELECT * INTO req FROM public.ambulance_requests WHERE id = _request_id;
  RETURN req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ambulance_create_request(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ambulance_set_payment(UUID, TEXT, NUMERIC) TO authenticated;
