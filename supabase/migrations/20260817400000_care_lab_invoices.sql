-- Lab test booking invoices

ALTER TABLE public.care_lab_bookings
  ADD COLUMN IF NOT EXISTS invoice_no TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'care_lab_bookings_payment_status_check'
  ) THEN
    ALTER TABLE public.care_lab_bookings
      ADD CONSTRAINT care_lab_bookings_payment_status_check
      CHECK (payment_status IN ('pending', 'paid', 'waived'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS care_lab_bookings_invoice_no_idx
  ON public.care_lab_bookings (invoice_no)
  WHERE invoice_no IS NOT NULL;

UPDATE public.care_lab_bookings b
SET
  invoice_no = COALESCE(
    b.invoice_no,
    'BLT-' || to_char(b.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(b.id::text, '-', ''), 1, 8))
  )
WHERE b.invoice_no IS NULL;

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
    guest_name, guest_phone, source, status, price, payment_status
  )
  VALUES (
    cal.id, off.id, off.org_id, cal.location_id, _patient_id,
    NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), src, 'reserved', off.price, 'pending'
  )
  RETURNING * INTO booking;

  inv_no := 'BLT-' || to_char(booking.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(booking.id::text, '-', ''), 1, 8));

  UPDATE public.care_lab_bookings
  SET invoice_no = inv_no
  WHERE id = booking.id
  RETURNING * INTO booking;

  PERFORM public.care_write_audit(off.org_id, 'lab.reserve', 'care_lab_bookings', booking.id,
    jsonb_build_object('calendar_id', cal.id, 'invoice_no', inv_no, 'price', off.price));

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
BEGIN
  IF _payment_status NOT IN ('pending', 'paid', 'waived') THEN
    RAISE EXCEPTION 'Invalid payment status';
  END IF;

  SELECT * INTO booking FROM public.care_lab_bookings WHERE id = _booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF NOT public.care_has_permission(booking.org_id, 'lab.checkin') AND NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.care_lab_bookings
  SET payment_status = _payment_status
  WHERE id = _booking_id
  RETURNING * INTO booking;

  PERFORM public.care_write_audit(booking.org_id, 'lab.payment.' || _payment_status, 'care_lab_bookings', booking.id,
    jsonb_build_object('payment_status', _payment_status));

  RETURN booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_set_lab_payment(UUID, TEXT) TO authenticated;
