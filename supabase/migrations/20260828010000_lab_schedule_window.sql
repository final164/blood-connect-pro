-- Lab desk can set the sample collection date/time and the report delivery
-- time window (e.g. 2:00 PM - 3:00 PM), which the patient then sees on the invoice.
--
-- care_lab_calendars.slot_start/slot_end already exist but are never populated
-- (care_generate_lab_day always writes slot_key '00:00' with NULL times), and
-- they are per-calendar-day, not per-booking. Staff need to promise a window to
-- one patient, so these live on the booking row.

ALTER TABLE public.care_lab_bookings
  ADD COLUMN IF NOT EXISTS collection_date DATE,
  ADD COLUMN IF NOT EXISTS collection_start TIME,
  ADD COLUMN IF NOT EXISTS collection_end TIME,
  ADD COLUMN IF NOT EXISTS delivery_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_start TIME,
  ADD COLUMN IF NOT EXISTS delivery_end TIME;

COMMENT ON COLUMN public.care_lab_bookings.collection_date IS 'Sample collection date set by lab desk';
COMMENT ON COLUMN public.care_lab_bookings.delivery_start IS 'Report delivery window start set by lab desk';

-- ─── Set collection + delivery schedule ─────────────────────────────────────
-- Direct UPDATE is blocked by policy care_lab_book_no_upd, so this mirrors
-- care_set_lab_payment: permission check, group-wide write, audit.
CREATE OR REPLACE FUNCTION public.care_set_lab_schedule(
  _booking_id UUID,
  _collection_date DATE DEFAULT NULL,
  _collection_start TIME DEFAULT NULL,
  _collection_end TIME DEFAULT NULL,
  _delivery_date DATE DEFAULT NULL,
  _delivery_start TIME DEFAULT NULL,
  _delivery_end TIME DEFAULT NULL,
  _apply_group BOOLEAN DEFAULT true
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
  SELECT * INTO booking FROM public.care_lab_bookings WHERE id = _booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF NOT public.care_has_permission(booking.org_id, 'lab.checkin') AND NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF _collection_start IS NOT NULL AND _collection_end IS NOT NULL
     AND _collection_end <= _collection_start THEN
    RAISE EXCEPTION 'Collection end time must be after start time';
  END IF;

  IF _delivery_start IS NOT NULL AND _delivery_end IS NOT NULL
     AND _delivery_end <= _delivery_start THEN
    RAISE EXCEPTION 'Delivery end time must be after start time';
  END IF;

  IF (_collection_start IS NOT NULL OR _collection_end IS NOT NULL) AND _collection_date IS NULL THEN
    RAISE EXCEPTION 'Collection date is required when a time is given';
  END IF;

  IF (_delivery_start IS NOT NULL OR _delivery_end IS NOT NULL) AND _delivery_date IS NULL THEN
    RAISE EXCEPTION 'Delivery date is required when a time is given';
  END IF;

  gid := COALESCE(booking.invoice_group_id, booking.id);

  UPDATE public.care_lab_bookings
  SET collection_date = _collection_date,
      collection_start = _collection_start,
      collection_end = _collection_end,
      delivery_date = _delivery_date,
      delivery_start = _delivery_start,
      delivery_end = _delivery_end
  WHERE (_apply_group AND (COALESCE(invoice_group_id, id) = gid OR id = _booking_id))
     OR (NOT _apply_group AND id = _booking_id);

  SELECT * INTO booking FROM public.care_lab_bookings WHERE id = _booking_id;

  PERFORM public.care_write_audit(
    booking.org_id,
    'lab.schedule',
    'care_lab_bookings',
    booking.id,
    jsonb_build_object(
      'invoice_group_id', gid,
      'apply_group', _apply_group,
      'collection_date', _collection_date,
      'collection_start', _collection_start,
      'collection_end', _collection_end,
      'delivery_date', _delivery_date,
      'delivery_start', _delivery_start,
      'delivery_end', _delivery_end
    )
  );

  RETURN booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_set_lab_schedule(UUID, DATE, TIME, TIME, DATE, TIME, TIME, BOOLEAN) TO authenticated;
