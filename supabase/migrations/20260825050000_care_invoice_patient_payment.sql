-- Cash Memo extras: patient meta on lab bookings + amount_received for Due/Received

ALTER TABLE public.care_lab_bookings
  ADD COLUMN IF NOT EXISTS guest_age INT,
  ADD COLUMN IF NOT EXISTS guest_sex TEXT,
  ADD COLUMN IF NOT EXISTS guest_address TEXT,
  ADD COLUMN IF NOT EXISTS referred_by TEXT,
  ADD COLUMN IF NOT EXISTS amount_received NUMERIC(12, 2);

ALTER TABLE public.care_serials
  ADD COLUMN IF NOT EXISTS guest_sex TEXT,
  ADD COLUMN IF NOT EXISTS referred_by TEXT,
  ADD COLUMN IF NOT EXISTS amount_received NUMERIC(12, 2);

ALTER TABLE public.ambulance_requests
  ADD COLUMN IF NOT EXISTS guest_age INT,
  ADD COLUMN IF NOT EXISTS guest_sex TEXT,
  ADD COLUMN IF NOT EXISTS guest_address TEXT,
  ADD COLUMN IF NOT EXISTS referred_by TEXT,
  ADD COLUMN IF NOT EXISTS amount_received NUMERIC(12, 2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'care_lab_bookings_guest_sex_check'
  ) THEN
    ALTER TABLE public.care_lab_bookings
      ADD CONSTRAINT care_lab_bookings_guest_sex_check
      CHECK (guest_sex IS NULL OR guest_sex IN ('M', 'F', 'O'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'care_serials_guest_sex_check'
  ) THEN
    ALTER TABLE public.care_serials
      ADD CONSTRAINT care_serials_guest_sex_check
      CHECK (guest_sex IS NULL OR guest_sex IN ('M', 'F', 'O'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ambulance_requests_guest_sex_check'
  ) THEN
    ALTER TABLE public.ambulance_requests
      ADD CONSTRAINT ambulance_requests_guest_sex_check
      CHECK (guest_sex IS NULL OR guest_sex IN ('M', 'F', 'O'));
  END IF;
END $$;

-- ─── Lab reserve (single) ───────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.care_reserve_lab(UUID, UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.care_reserve_lab(
  _calendar_id UUID,
  _patient_id UUID DEFAULT NULL,
  _guest_name TEXT DEFAULT NULL,
  _guest_phone TEXT DEFAULT NULL,
  _source TEXT DEFAULT 'app',
  _guest_age INT DEFAULT NULL,
  _guest_sex TEXT DEFAULT NULL,
  _guest_address TEXT DEFAULT NULL,
  _referred_by TEXT DEFAULT NULL
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
  g_age INT := CASE WHEN _guest_age IS NOT NULL AND _guest_age > 0 AND _guest_age < 150 THEN _guest_age ELSE NULL END;
  g_sex TEXT := CASE WHEN upper(COALESCE(_guest_sex, '')) IN ('M', 'F', 'O') THEN upper(_guest_sex) ELSE NULL END;
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
    guest_name, guest_phone, guest_age, guest_sex, guest_address, referred_by,
    source, status, price, payment_status, price_original, discount_percent
  )
  VALUES (
    cal.id, off.id, off.org_id, cal.location_id, _patient_id,
    NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), g_age, g_sex,
    NULLIF(_guest_address, ''), NULLIF(_referred_by, ''),
    src, 'reserved', sale_price, 'pending',
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
      'price', sale_price
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

GRANT EXECUTE ON FUNCTION public.care_reserve_lab(UUID, UUID, TEXT, TEXT, TEXT, INT, TEXT, TEXT, TEXT) TO authenticated;

-- ─── Lab reserve (bundle) ───────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.care_reserve_lab_bundle(UUID[], TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.care_reserve_lab_bundle(
  _calendar_ids UUID[],
  _guest_name TEXT DEFAULT NULL,
  _guest_phone TEXT DEFAULT NULL,
  _source TEXT DEFAULT 'app',
  _guest_age INT DEFAULT NULL,
  _guest_sex TEXT DEFAULT NULL,
  _guest_address TEXT DEFAULT NULL,
  _referred_by TEXT DEFAULT NULL
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
  g_age INT := CASE WHEN _guest_age IS NOT NULL AND _guest_age > 0 AND _guest_age < 150 THEN _guest_age ELSE NULL END;
  g_sex TEXT := CASE WHEN upper(COALESCE(_guest_sex, '')) IN ('M', 'F', 'O') THEN upper(_guest_sex) ELSE NULL END;
BEGIN
  IF _calendar_ids IS NULL OR cardinality(_calendar_ids) < 1 THEN
    RAISE EXCEPTION 'Select at least one test';
  END IF;
  IF cardinality(_calendar_ids) > 20 THEN
    RAISE EXCEPTION 'Too many tests (max 20)';
  END IF;

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
      guest_name, guest_phone, guest_age, guest_sex, guest_address, referred_by,
      source, status, price, payment_status, price_original, discount_percent, invoice_group_id
    )
    VALUES (
      cal.id, off.id, off.org_id, cal.location_id,
      CASE WHEN src = 'walk_in' THEN NULL ELSE uid END,
      NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), g_age, g_sex,
      NULLIF(_guest_address, ''), NULLIF(_referred_by, ''),
      src, 'reserved', sale_price, 'pending',
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

GRANT EXECUTE ON FUNCTION public.care_reserve_lab_bundle(UUID[], TEXT, TEXT, TEXT, INT, TEXT, TEXT, TEXT) TO authenticated;

-- ─── Lab payment (+ optional amount_received) ───────────────────────────────
DROP FUNCTION IF EXISTS public.care_set_lab_payment(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.care_set_lab_payment(
  _booking_id UUID,
  _payment_status TEXT,
  _amount_received NUMERIC DEFAULT NULL
)
RETURNS public.care_lab_bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  booking public.care_lab_bookings%ROWTYPE;
  gid UUID;
  recv NUMERIC(12, 2);
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

  IF _payment_status = 'waived' THEN
    recv := 0;
  ELSIF _payment_status = 'pending' THEN
    recv := NULL;
  ELSIF _amount_received IS NOT NULL THEN
    recv := GREATEST(0, _amount_received);
  ELSE
    recv := NULL; -- view-model treats paid + null as full payable
  END IF;

  UPDATE public.care_lab_bookings
  SET payment_status = _payment_status,
      amount_received = recv
  WHERE COALESCE(invoice_group_id, id) = gid
     OR id = _booking_id;

  SELECT * INTO booking FROM public.care_lab_bookings WHERE id = _booking_id;

  PERFORM public.care_write_audit(booking.org_id, 'lab.payment.' || _payment_status, 'care_lab_bookings', booking.id,
    jsonb_build_object('payment_status', _payment_status, 'invoice_group_id', gid, 'amount_received', recv));

  RETURN booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_set_lab_payment(UUID, TEXT, NUMERIC) TO authenticated;

-- ─── Serial payment ─────────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.care_set_serial_payment(UUID, TEXT);

CREATE OR REPLACE FUNCTION public.care_set_serial_payment(
  _serial_id UUID,
  _payment_status TEXT,
  _amount_received NUMERIC DEFAULT NULL
)
RETURNS public.care_serials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket public.care_serials%ROWTYPE;
  sess public.care_sessions%ROWTYPE;
  recv NUMERIC(12, 2);
BEGIN
  IF _payment_status NOT IN ('pending', 'paid', 'waived') THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  SELECT * INTO ticket FROM public.care_serials WHERE id = _serial_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serial not found'; END IF;
  SELECT * INTO sess FROM public.care_sessions WHERE id = ticket.session_id;

  IF NOT public.care_has_permission(sess.org_id, 'queue.manage') AND NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF _payment_status = 'waived' THEN
    recv := 0;
  ELSIF _payment_status = 'pending' THEN
    recv := NULL;
  ELSIF _amount_received IS NOT NULL THEN
    recv := GREATEST(0, _amount_received);
  ELSE
    recv := NULL;
  END IF;

  UPDATE public.care_serials
  SET payment_status = _payment_status,
      amount_received = recv
  WHERE id = _serial_id
  RETURNING * INTO ticket;

  PERFORM public.care_write_audit(sess.org_id, 'serial.payment.' || _payment_status, 'care_serials', ticket.id,
    jsonb_build_object('payment_status', _payment_status, 'amount_received', recv));

  RETURN ticket;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_set_serial_payment(UUID, TEXT, NUMERIC) TO authenticated;

-- ─── Ambulance payment ──────────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.ambulance_set_payment(UUID, TEXT);

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
  recv NUMERIC(12, 2);
BEGIN
  IF _payment_status NOT IN ('pending', 'paid', 'waived') THEN RAISE EXCEPTION 'Invalid payment status'; END IF;
  SELECT * INTO req FROM public.ambulance_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF req.org_id IS NULL OR NOT public.care_has_permission(req.org_id, 'ambulance.dispatch.manage') THEN
    IF NOT public.is_care_staff() THEN RAISE EXCEPTION 'Not allowed'; END IF;
  END IF;

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
  WHERE id = _request_id
  RETURNING * INTO req;
  RETURN req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ambulance_set_payment(UUID, TEXT, NUMERIC) TO authenticated;
