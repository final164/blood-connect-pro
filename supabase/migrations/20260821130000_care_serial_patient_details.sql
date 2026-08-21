-- Capture patient name/phone/age/address on serial booking for chamber desk

ALTER TABLE public.care_serials
  ADD COLUMN IF NOT EXISTS guest_age INT,
  ADD COLUMN IF NOT EXISTS guest_address TEXT;

CREATE OR REPLACE FUNCTION public.care_issue_serial(
  _session_id UUID,
  _patient_id UUID DEFAULT NULL,
  _guest_name TEXT DEFAULT NULL,
  _guest_phone TEXT DEFAULT NULL,
  _source TEXT DEFAULT 'app',
  _guest_age INT DEFAULT NULL,
  _guest_address TEXT DEFAULT NULL
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
  require_approval BOOLEAN := false;
  flags JSONB;
  g_age INT := CASE WHEN _guest_age IS NOT NULL AND _guest_age > 0 AND _guest_age < 150 THEN _guest_age ELSE NULL END;
BEGIN
  SELECT * INTO sess FROM public.care_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  SELECT * INTO sch FROM public.care_schedules WHERE id = sess.schedule_id;

  SELECT care_feature_flags INTO flags FROM public.app_settings WHERE id = 1;
  require_approval := COALESCE((flags ->> 'desk_serial_approval')::boolean, false);

  IF src = 'walk_in' THEN
    IF NOT public.care_has_permission(sess.org_id, 'serial.issue', uid) THEN
      RAISE EXCEPTION 'Not allowed to issue walk-in serial';
    END IF;
    IF sch.allow_walk_in IS FALSE THEN RAISE EXCEPTION 'Walk-in disabled'; END IF;
    IF sess.status NOT IN ('open', 'paused') THEN RAISE EXCEPTION 'Session is not open'; END IF;
    require_approval := false;
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

  SELECT COALESCE(aff.fee_amount, 0) INTO fee
  FROM public.care_affiliations aff
  WHERE aff.org_id = sess.org_id
    AND aff.doctor_id = sess.doctor_id
    AND aff.location_id = sess.location_id
    AND aff.is_active = true
  LIMIT 1;

  IF require_approval THEN
    INSERT INTO public.care_serials (
      session_id, serial_no, patient_id, guest_name, guest_phone, guest_age, guest_address,
      source, status, fee_amount, payment_status
    )
    VALUES (
      sess.id, NULL, _patient_id, NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), g_age,
      NULLIF(_guest_address, ''), src, 'pending_approval', fee, 'pending'
    )
    RETURNING * INTO ticket;

    inv_no := 'BLC-' || to_char(ticket.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(ticket.id::text, '-', ''), 1, 8));

    UPDATE public.care_serials
    SET invoice_no = inv_no
    WHERE id = ticket.id
    RETURNING * INTO ticket;

    PERFORM public.care_write_audit(sess.org_id, 'serial.request', 'care_serials', ticket.id,
      jsonb_build_object('source', src, 'invoice_no', inv_no, 'fee_amount', fee, 'status', 'pending_approval'));

    IF ticket.patient_id IS NOT NULL THEN
      PERFORM public.care_notify(
        ticket.patient_id,
        'care_serial_pending',
        'Pending approval',
        jsonb_build_object(
          'serial_id', ticket.id,
          'session_id', sess.id,
          'invoice_no', ticket.invoice_no,
          'status', 'pending_approval'
        )
      );
    END IF;

    RETURN ticket;
  END IF;

  next_no := sess.last_issued + 1;
  IF next_no > sess.max_serial THEN RAISE EXCEPTION 'Serial full'; END IF;

  UPDATE public.care_sessions
  SET last_issued = next_no
  WHERE id = sess.id;

  INSERT INTO public.care_serials (
    session_id, serial_no, patient_id, guest_name, guest_phone, guest_age, guest_address,
    source, status, fee_amount, payment_status
  )
  VALUES (
    sess.id, next_no, _patient_id, NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), g_age,
    NULLIF(_guest_address, ''), src, 'booked', fee, 'pending'
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
