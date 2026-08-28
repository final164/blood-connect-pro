-- Unified chamber serial_no: reserve on booking (pending or booked); shared counter with desk.

UPDATE public.care_notif_templates
SET
  title_bn = 'সিরিয়াল অনুরোধ গৃহীত',
  title_en = 'Serial request received',
  body_bn = 'আপনার সিরিয়াল #{{serial}} — চেম্বার অনুমোদনের অপেক্ষায়।',
  body_en = 'Your serial is #{{serial}} — awaiting chamber approval.',
  is_active = true
WHERE slug = 'care_serial_pending';

UPDATE public.care_notif_templates
SET
  title_bn = 'সিরিয়াল অনুমোদিত',
  title_en = 'Serial approved',
  body_bn = 'আপনার সিরিয়াল #{{serial}} অনুমোদিত হয়েছে।',
  body_en = 'Your serial #{{serial}} has been approved.',
  is_active = true
WHERE slug = 'care_serial_approved';

UPDATE public.care_notif_templates
SET
  body_bn = 'আপনার সিরিয়াল নম্বর {{serial}}',
  body_en = 'Your serial is {{serial}}'
WHERE slug = 'care_serial_booked';

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
  max_existing INT;
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

  -- Shared chamber queue: last_issued and any reserved serial_no (incl. pending)
  SELECT COALESCE(MAX(s.serial_no), sess.start_number - 1) INTO max_existing
  FROM public.care_serials s
  WHERE s.session_id = sess.id
    AND s.serial_no IS NOT NULL;

  next_no := GREATEST(sess.last_issued, max_existing) + 1;
  IF next_no > sess.max_serial THEN RAISE EXCEPTION 'Serial full'; END IF;

  UPDATE public.care_sessions
  SET last_issued = next_no
  WHERE id = sess.id;

  IF require_approval THEN
    INSERT INTO public.care_serials (
      session_id, serial_no, patient_id, guest_name, guest_phone, guest_age, guest_address,
      source, status, fee_amount, fee_original, is_second_visit, online_serial_no, payment_status
    )
    VALUES (
      sess.id, next_no, _patient_id, NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), g_age,
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
        'is_second_visit', second_visit, 'online_serial_no', online_no,
        'serial_no', next_no, 'status', 'pending_approval'
      ));

    IF ticket.patient_id IS NOT NULL THEN
      PERFORM public.care_notify(
        ticket.patient_id,
        'care_serial_pending',
        'Serial ' || next_no::text || ' — awaiting approval',
        jsonb_build_object(
          'serial_id', ticket.id,
          'serial', next_no,
          'serial_no', next_no,
          'session_id', sess.id,
          'invoice_no', ticket.invoice_no,
          'online_serial_no', online_no,
          'status', 'pending_approval'
        )
      );
    END IF;

    RETURN ticket;
  END IF;

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
        'serial_no', ticket.serial_no,
        'online_serial_no', online_no,
        'session_id', sess.id,
        'invoice_no', ticket.invoice_no
      )
    );
  END IF;

  RETURN ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.care_approve_serial(
  _serial_id UUID,
  _serial_no INT DEFAULT NULL
)
RETURNS public.care_serials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ticket public.care_serials%ROWTYPE;
  sess public.care_sessions%ROWTYPE;
  assigned INT;
  max_existing INT;
BEGIN
  SELECT * INTO ticket FROM public.care_serials WHERE id = _serial_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Serial not found'; END IF;
  IF ticket.status <> 'pending_approval' THEN
    RAISE EXCEPTION 'Serial is not awaiting approval';
  END IF;

  SELECT * INTO sess FROM public.care_sessions WHERE id = ticket.session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;

  IF NOT public.care_has_permission(sess.org_id, 'serial.issue')
     AND NOT public.care_has_permission(sess.org_id, 'queue.manage')
     AND NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  IF _serial_no IS NOT NULL THEN
    assigned := _serial_no;
    IF assigned < COALESCE(sess.start_number, 1) THEN
      RAISE EXCEPTION 'Serial number too low';
    END IF;
    IF assigned > sess.max_serial THEN
      RAISE EXCEPTION 'Serial number exceeds capacity';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.care_serials
      WHERE session_id = sess.id
        AND serial_no = assigned
        AND id <> ticket.id
    ) THEN
      RAISE EXCEPTION 'Serial number already taken';
    END IF;
  ELSIF ticket.serial_no IS NOT NULL THEN
    -- Keep reserved chamber number from booking
    assigned := ticket.serial_no;
  ELSE
    -- Legacy pending rows with NULL serial_no
    SELECT COALESCE(MAX(s.serial_no), sess.start_number - 1) INTO max_existing
    FROM public.care_serials s
    WHERE s.session_id = sess.id
      AND s.serial_no IS NOT NULL;
    assigned := GREATEST(sess.last_issued, max_existing) + 1;
    IF assigned > sess.max_serial THEN RAISE EXCEPTION 'Serial full'; END IF;
  END IF;

  UPDATE public.care_sessions
  SET last_issued = GREATEST(last_issued, assigned)
  WHERE id = sess.id;

  UPDATE public.care_serials
  SET serial_no = assigned,
      status = 'booked'
  WHERE id = ticket.id
  RETURNING * INTO ticket;

  PERFORM public.care_write_audit(sess.org_id, 'serial.approve', 'care_serials', ticket.id,
    jsonb_build_object('serial_no', assigned));

  IF ticket.patient_id IS NOT NULL THEN
    PERFORM public.care_notify(
      ticket.patient_id,
      'care_serial_approved',
      'Serial ' || ticket.serial_no::text || ' approved',
      jsonb_build_object(
        'serial_id', ticket.id,
        'serial', ticket.serial_no,
        'serial_no', ticket.serial_no,
        'online_serial_no', ticket.online_serial_no,
        'session_id', sess.id,
        'invoice_no', ticket.invoice_no
      )
    );
  END IF;

  RETURN ticket;
END;
$$;
