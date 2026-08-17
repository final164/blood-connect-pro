-- Care serial invoices: auto-generated when a serial is issued

ALTER TABLE public.care_serials
  ADD COLUMN IF NOT EXISTS invoice_no TEXT,
  ADD COLUMN IF NOT EXISTS fee_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'care_serials_payment_status_check'
  ) THEN
    ALTER TABLE public.care_serials
      ADD CONSTRAINT care_serials_payment_status_check
      CHECK (payment_status IN ('pending', 'paid', 'waived'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS care_serials_invoice_no_idx
  ON public.care_serials (invoice_no)
  WHERE invoice_no IS NOT NULL;

-- Backfill invoice numbers for existing serials
UPDATE public.care_serials s
SET
  invoice_no = COALESCE(
    s.invoice_no,
    'BLC-' || to_char(s.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(s.id::text, '-', ''), 1, 8))
  ),
  fee_amount = COALESCE(
    s.fee_amount,
    (
      SELECT aff.fee_amount
      FROM public.care_sessions sess
      JOIN public.care_affiliations aff
        ON aff.org_id = sess.org_id
       AND aff.doctor_id = sess.doctor_id
       AND aff.location_id = sess.location_id
       AND aff.is_active = true
      WHERE sess.id = s.session_id
      LIMIT 1
    ),
    0
  )
WHERE s.invoice_no IS NULL OR s.fee_amount IS NULL;

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
  fee NUMERIC(12, 2) := 0;
  inv_no TEXT;
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

  SELECT COALESCE(aff.fee_amount, 0) INTO fee
  FROM public.care_affiliations aff
  WHERE aff.org_id = sess.org_id
    AND aff.doctor_id = sess.doctor_id
    AND aff.location_id = sess.location_id
    AND aff.is_active = true
  LIMIT 1;

  UPDATE public.care_sessions
  SET last_issued = next_no
  WHERE id = sess.id;

  INSERT INTO public.care_serials (
    session_id, serial_no, patient_id, guest_name, guest_phone, source, status, fee_amount, payment_status
  )
  VALUES (
    sess.id, next_no, _patient_id, NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), src, 'booked', fee, 'pending'
  )
  RETURNING * INTO ticket;

  inv_no := 'BLC-' || to_char(ticket.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(ticket.id::text, '-', ''), 1, 8));

  UPDATE public.care_serials
  SET invoice_no = inv_no
  WHERE id = ticket.id
  RETURNING * INTO ticket;

  PERFORM public.care_write_audit(sess.org_id, 'serial.issue', 'care_serials', ticket.id,
    jsonb_build_object('serial_no', next_no, 'source', src, 'invoice_no', inv_no, 'fee_amount', fee));

  IF ticket.patient_id IS NOT NULL THEN
    PERFORM public.care_notify(
      ticket.patient_id,
      'care_serial_booked',
      'Serial ' || ticket.serial_no::text,
      jsonb_build_object(
        'serial_id', ticket.id,
        'serial', ticket.serial_no,
        'session_id', sess.id,
        'invoice_no', ticket.invoice_no
      )
    );
  END IF;

  RETURN ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_set_serial_payment(
  _serial_id UUID,
  _payment_status TEXT
)
RETURNS public.care_serials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket public.care_serials%ROWTYPE;
  sess public.care_sessions%ROWTYPE;
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

  UPDATE public.care_serials
  SET payment_status = _payment_status
  WHERE id = _serial_id
  RETURNING * INTO ticket;

  PERFORM public.care_write_audit(sess.org_id, 'serial.payment.' || _payment_status, 'care_serials', ticket.id,
    jsonb_build_object('payment_status', _payment_status));

  RETURN ticket;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_set_serial_payment(UUID, TEXT) TO authenticated;
