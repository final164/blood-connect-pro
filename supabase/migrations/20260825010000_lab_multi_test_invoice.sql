-- Multi-test lab booking → one shared invoice (invoice_group_id + shared invoice_no)

ALTER TABLE public.care_lab_bookings
  ADD COLUMN IF NOT EXISTS invoice_group_id UUID;

CREATE INDEX IF NOT EXISTS care_lab_bookings_invoice_group_idx
  ON public.care_lab_bookings (invoice_group_id)
  WHERE invoice_group_id IS NOT NULL;

COMMENT ON COLUMN public.care_lab_bookings.invoice_group_id IS
  'Shared UUID for multi-test bookings that share one invoice_no';

-- Backfill: single bookings treat themselves as their own group
UPDATE public.care_lab_bookings
SET invoice_group_id = id
WHERE invoice_group_id IS NULL;

-- Keep single-reserve compatible: stamp invoice_group_id = booking.id
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
  inv_no TEXT;
  list_price NUMERIC(12, 2);
  disc NUMERIC(5, 2);
  sale_price NUMERIC(12, 2);
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

  list_price := COALESCE(off.price, 0);
  disc := LEAST(100, GREATEST(0, COALESCE(off.discount_percent, 0)));
  sale_price := public.care_offering_sale_price(list_price, disc);

  INSERT INTO public.care_lab_bookings (
    calendar_id, offering_id, org_id, location_id, patient_id,
    guest_name, guest_phone, source, status, price, payment_status,
    price_original, discount_percent
  )
  VALUES (
    cal.id, off.id, off.org_id, cal.location_id, _patient_id,
    NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), src, 'reserved', sale_price, 'pending',
    CASE WHEN disc > 0 THEN list_price ELSE NULL END,
    CASE WHEN disc > 0 THEN disc ELSE NULL END
  )
  RETURNING * INTO booking;

  inv_no := 'BLT-' || to_char(booking.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(booking.id::text, '-', ''), 1, 8));

  UPDATE public.care_lab_bookings
  SET invoice_no = inv_no,
      invoice_group_id = booking.id
  WHERE id = booking.id
  RETURNING * INTO booking;

  PERFORM public.care_write_audit(off.org_id, 'lab.reserve', 'care_lab_bookings', booking.id,
    jsonb_build_object(
      'calendar_id', cal.id,
      'invoice_no', inv_no,
      'invoice_group_id', booking.invoice_group_id,
      'price', sale_price,
      'price_original', CASE WHEN disc > 0 THEN list_price ELSE NULL END,
      'discount_percent', CASE WHEN disc > 0 THEN disc ELSE NULL END
    ));

  IF booking.patient_id IS NOT NULL THEN
    PERFORM public.care_notify(
      booking.patient_id, 'care_lab_reserved',
      'Ref ' || booking.reference_code,
      jsonb_build_object('booking_id', booking.id, 'code', booking.reference_code, 'invoice_no', inv_no)
    );
  END IF;

  RETURN booking;
END;
$$;

-- Atomic multi-test reserve → one invoice_no + shared invoice_group_id
CREATE OR REPLACE FUNCTION public.care_reserve_lab_bundle(
  _calendar_ids UUID[],
  _guest_name TEXT DEFAULT NULL,
  _guest_phone TEXT DEFAULT NULL,
  _source TEXT DEFAULT 'app'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  src TEXT := COALESCE(NULLIF(_source, ''), 'app');
  cal_id UUID;
  cal public.care_lab_calendars%ROWTYPE;
  off public.care_test_offerings%ROWTYPE;
  booking public.care_lab_bookings%ROWTYPE;
  org_id UUID;
  group_id UUID := gen_random_uuid();
  inv_no TEXT;
  list_price NUMERIC(12, 2);
  disc NUMERIC(5, 2);
  sale_price NUMERIC(12, 2);
  bookings JSONB := '[]'::jsonb;
  primary_id UUID;
  n INT := 0;
  sorted UUID[];
BEGIN
  IF _calendar_ids IS NULL OR cardinality(_calendar_ids) < 1 THEN
    RAISE EXCEPTION 'Select at least one test';
  END IF;
  IF cardinality(_calendar_ids) > 20 THEN
    RAISE EXCEPTION 'Too many tests (max 20)';
  END IF;

  -- Stable lock order
  SELECT array_agg(x ORDER BY x) INTO sorted
  FROM (SELECT DISTINCT unnest(_calendar_ids) AS x) s;

  IF cardinality(sorted) <> cardinality(_calendar_ids) THEN
    RAISE EXCEPTION 'Duplicate slots are not allowed';
  END IF;

  FOREACH cal_id IN ARRAY sorted LOOP
    SELECT * INTO cal FROM public.care_lab_calendars WHERE id = cal_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Slot not found'; END IF;
    IF NOT cal.is_open THEN RAISE EXCEPTION 'Slot closed'; END IF;

    SELECT * INTO off FROM public.care_test_offerings WHERE id = cal.offering_id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Offering not found'; END IF;

    IF org_id IS NULL THEN
      org_id := off.org_id;
    ELSIF org_id <> off.org_id THEN
      RAISE EXCEPTION 'All tests must be from the same clinic';
    END IF;

    IF src = 'walk_in' THEN
      IF NOT public.care_has_permission(off.org_id, 'lab.checkin', uid) THEN
        RAISE EXCEPTION 'Not allowed';
      END IF;
    ELSE
      IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
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

    list_price := COALESCE(off.price, 0);
    disc := LEAST(100, GREATEST(0, COALESCE(off.discount_percent, 0)));
    sale_price := public.care_offering_sale_price(list_price, disc);

    INSERT INTO public.care_lab_bookings (
      calendar_id, offering_id, org_id, location_id, patient_id,
      guest_name, guest_phone, source, status, price, payment_status,
      price_original, discount_percent, invoice_group_id
    )
    VALUES (
      cal.id, off.id, off.org_id, cal.location_id,
      CASE WHEN src = 'walk_in' THEN NULL ELSE uid END,
      NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), src, 'reserved', sale_price, 'pending',
      CASE WHEN disc > 0 THEN list_price ELSE NULL END,
      CASE WHEN disc > 0 THEN disc ELSE NULL END,
      group_id
    )
    RETURNING * INTO booking;

    n := n + 1;
    IF primary_id IS NULL THEN
      primary_id := booking.id;
      inv_no := 'BLT-' || to_char(booking.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD')
        || '-' || upper(substr(replace(group_id::text, '-', ''), 1, 8));
    END IF;

    UPDATE public.care_lab_bookings
    SET invoice_no = inv_no
    WHERE id = booking.id
    RETURNING * INTO booking;

    bookings := bookings || jsonb_build_array(to_jsonb(booking));

    PERFORM public.care_write_audit(off.org_id, 'lab.reserve.bundle', 'care_lab_bookings', booking.id,
      jsonb_build_object(
        'calendar_id', cal.id,
        'invoice_no', inv_no,
        'invoice_group_id', group_id,
        'price', sale_price,
        'bundle_size', cardinality(sorted)
      ));
  END LOOP;

  IF uid IS NOT NULL AND src <> 'walk_in' THEN
    PERFORM public.care_notify(
      uid, 'care_lab_reserved',
      'Invoice ' || inv_no || ' · ' || n || ' tests',
      jsonb_build_object(
        'booking_id', primary_id,
        'invoice_no', inv_no,
        'invoice_group_id', group_id,
        'count', n
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'invoice_group_id', group_id,
    'invoice_no', inv_no,
    'primary_booking_id', primary_id,
    'count', n,
    'bookings', bookings
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_reserve_lab_bundle(UUID[], TEXT, TEXT, TEXT) TO authenticated;

-- Payment status applies to the whole invoice group
CREATE OR REPLACE FUNCTION public.care_set_lab_payment(
  _booking_id UUID,
  _payment_status TEXT
)
RETURNS public.care_lab_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking public.care_lab_bookings%ROWTYPE;
  gid UUID;
BEGIN
  IF _payment_status NOT IN ('pending', 'paid', 'waived') THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  SELECT * INTO booking FROM public.care_lab_bookings WHERE id = _booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF NOT public.care_has_permission(booking.org_id, 'lab.checkin') AND NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  gid := COALESCE(booking.invoice_group_id, booking.id);

  UPDATE public.care_lab_bookings
  SET payment_status = _payment_status
  WHERE COALESCE(invoice_group_id, id) = gid
     OR id = _booking_id;

  SELECT * INTO booking FROM public.care_lab_bookings WHERE id = _booking_id;

  PERFORM public.care_write_audit(booking.org_id, 'lab.payment.' || _payment_status, 'care_lab_bookings', booking.id,
    jsonb_build_object('payment_status', _payment_status, 'invoice_group_id', gid));

  RETURN booking;
END;
$$;
