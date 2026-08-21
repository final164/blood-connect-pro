-- Per-session online booking order number (not BLC invoice id)

ALTER TABLE public.care_serials
  ADD COLUMN IF NOT EXISTS online_serial_no INT;

CREATE INDEX IF NOT EXISTS care_serials_session_online_serial_idx
  ON public.care_serials (session_id, online_serial_no)
  WHERE online_serial_no IS NOT NULL;

-- Backfill existing app bookings by created_at order within each session
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY created_at ASC, id ASC) AS rn
  FROM public.care_serials
  WHERE source = 'app'
    AND online_serial_no IS NULL
)
UPDATE public.care_serials s
SET online_serial_no = ranked.rn
FROM ranked
WHERE s.id = ranked.id;

CREATE OR REPLACE FUNCTION public.care_issue_serial(
  _session_id UUID,
  _patient_id UUID DEFAULT NULL,
  _guest_name TEXT DEFAULT NULL,
  _guest_phone TEXT DEFAULT NULL,
  _source TEXT DEFAULT 'app',
  _guest_age INT DEFAULT NULL,
  _guest_address TEXT DEFAULT NULL,
  _is_second_visit BOOLEAN DEFAULT false
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
  fee_base NUMERIC(12, 2) := 0;
  disc_type TEXT;
  disc_val NUMERIC(12, 2);
  inv_no TEXT;
  require_approval BOOLEAN := false;
  flags JSONB;
  org_settings JSONB;
  org_serial JSONB;
  g_age INT := CASE WHEN _guest_age IS NOT NULL AND _guest_age > 0 AND _guest_age < 150 THEN _guest_age ELSE NULL END;
  is_desk_issue BOOLEAN := false;
  second_visit BOOLEAN := COALESCE(_is_second_visit, false);
  online_no INT := NULL;
BEGIN
  SELECT * INTO sess FROM public.care_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  SELECT * INTO sch FROM public.care_schedules WHERE id = sess.schedule_id;

  SELECT care_feature_flags INTO flags FROM public.app_settings WHERE id = 1;
  SELECT o.settings INTO org_settings FROM public.care_orgs o WHERE o.id = sess.org_id;
  org_serial := COALESCE(org_settings -> 'serial', '{}'::jsonb);

  IF org_serial ? 'desk_serial_approval' THEN
    require_approval := COALESCE((org_serial ->> 'desk_serial_approval')::boolean, false);
  ELSE
    require_approval := COALESCE((flags ->> 'desk_serial_approval')::boolean, false);
  END IF;

  is_desk_issue := src IN ('walk_in', 'desk_manual');

  IF is_desk_issue THEN
    IF NOT public.care_has_permission(sess.org_id, 'serial.issue', uid) THEN
      RAISE EXCEPTION 'Not allowed to issue desk serial';
    END IF;
    IF src = 'desk_manual' THEN
      IF COALESCE((flags ->> 'desk_manual_patient_serial')::boolean, true) IS FALSE THEN
        RAISE EXCEPTION 'Manual patient serial disabled by admin';
      END IF;
      IF org_serial ? 'manual_patient_serial'
         AND COALESCE((org_serial ->> 'manual_patient_serial')::boolean, true) IS FALSE THEN
        RAISE EXCEPTION 'Manual patient serial disabled for this chamber';
      END IF;
    END IF;
    IF sch.allow_walk_in IS FALSE AND src = 'walk_in' THEN
      RAISE EXCEPTION 'Walk-in disabled';
    END IF;
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

  -- Online order for this chamber/doctor/session (app bookings only)
  IF src = 'app' THEN
    SELECT COALESCE(MAX(s.online_serial_no), 0) + 1 INTO online_no
    FROM public.care_serials s
    WHERE s.session_id = sess.id
      AND s.source = 'app';
  END IF;

  SELECT
    COALESCE(aff.fee_amount, 0),
    aff.second_visit_discount_type,
    aff.second_visit_discount_value
  INTO fee_base, disc_type, disc_val
  FROM public.care_affiliations aff
  WHERE aff.org_id = sess.org_id
    AND aff.doctor_id = sess.doctor_id
    AND aff.location_id = sess.location_id
    AND aff.is_active = true
  LIMIT 1;

  fee := fee_base;
  IF second_visit AND disc_val IS NOT NULL AND disc_val > 0 THEN
    IF disc_type = 'percent' THEN
      fee := GREATEST(0, ROUND(fee_base - (fee_base * LEAST(disc_val, 100) / 100.0), 2));
    ELSIF disc_type = 'fixed' THEN
      fee := GREATEST(0, ROUND(fee_base - disc_val, 2));
    END IF;
  ELSE
    second_visit := false;
  END IF;

  IF require_approval THEN
    INSERT INTO public.care_serials (
      session_id, serial_no, patient_id, guest_name, guest_phone, guest_age, guest_address,
      source, status, fee_amount, fee_original, is_second_visit, online_serial_no, payment_status
    )
    VALUES (
      sess.id, NULL, _patient_id, NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), g_age,
      NULLIF(_guest_address, ''), src, 'pending_approval', fee, fee_base, second_visit, online_no, 'pending'
    )
    RETURNING * INTO ticket;

    inv_no := 'BLC-' || to_char(ticket.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(ticket.id::text, '-', ''), 1, 8));

    UPDATE public.care_serials
    SET invoice_no = inv_no
    WHERE id = ticket.id
    RETURNING * INTO ticket;

    PERFORM public.care_write_audit(sess.org_id, 'serial.request', 'care_serials', ticket.id,
      jsonb_build_object(
        'source', src, 'invoice_no', inv_no, 'fee_amount', fee, 'fee_original', fee_base,
        'is_second_visit', second_visit, 'online_serial_no', online_no, 'status', 'pending_approval'
      ));

    IF ticket.patient_id IS NOT NULL THEN
      PERFORM public.care_notify(
        ticket.patient_id,
        'care_serial_pending',
        'Pending approval',
        jsonb_build_object(
          'serial_id', ticket.id,
          'session_id', sess.id,
          'invoice_no', ticket.invoice_no,
          'online_serial_no', online_no,
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
    source, status, fee_amount, fee_original, is_second_visit, online_serial_no, payment_status
  )
  VALUES (
    sess.id, next_no, _patient_id, NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), g_age,
    NULLIF(_guest_address, ''), src, 'booked', fee, fee_base, second_visit, online_no, 'pending'
  )
  RETURNING * INTO ticket;

  inv_no := 'BLC-' || to_char(ticket.created_at AT TIME ZONE 'Asia/Dhaka', 'YYYYMMDD') || '-' || upper(substr(replace(ticket.id::text, '-', ''), 1, 8));

  UPDATE public.care_serials
  SET invoice_no = inv_no
  WHERE id = ticket.id
  RETURNING * INTO ticket;

  PERFORM public.care_write_audit(sess.org_id, 'serial.issue', 'care_serials', ticket.id,
    jsonb_build_object(
      'serial_no', next_no, 'source', src, 'invoice_no', inv_no,
      'fee_amount', fee, 'fee_original', fee_base, 'is_second_visit', second_visit,
      'online_serial_no', online_no
    ));

  IF ticket.patient_id IS NOT NULL THEN
    PERFORM public.care_notify(
      ticket.patient_id,
      'care_serial_booked',
      'Serial ' || ticket.serial_no::text,
      jsonb_build_object(
        'serial_id', ticket.id,
        'serial', ticket.serial_no,
        'online_serial_no', online_no,
        'session_id', sess.id,
        'invoice_no', ticket.invoice_no
      )
    );
  END IF;

  RETURN ticket;
END;
$$;
