-- Doctor serial desk approval: app bookings can wait for chamber to assign serial_no

INSERT INTO public.care_serial_statuses (slug, label_bn, label_en, is_terminal, sort_order)
VALUES ('pending_approval', 'অনুমোদন বাকি', 'Pending approval', false, 5)
ON CONFLICT (slug) DO UPDATE SET
  label_bn = EXCLUDED.label_bn,
  label_en = EXCLUDED.label_en,
  is_terminal = EXCLUDED.is_terminal,
  sort_order = EXCLUDED.sort_order;

-- Allow deferred serial numbers until desk assigns one
ALTER TABLE public.care_serials ALTER COLUMN serial_no DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'care_serials_session_id_serial_no_key'
  ) THEN
    ALTER TABLE public.care_serials DROP CONSTRAINT care_serials_session_id_serial_no_key;
  END IF;
END $$;

DROP INDEX IF EXISTS care_serials_session_serial_unique;
CREATE UNIQUE INDEX IF NOT EXISTS care_serials_session_serial_unique
  ON public.care_serials (session_id, serial_no)
  WHERE serial_no IS NOT NULL;

CREATE INDEX IF NOT EXISTS care_serials_session_pending_idx
  ON public.care_serials (session_id, created_at)
  WHERE status = 'pending_approval';

-- Feature flag (default off = instant serial as today)
UPDATE public.app_settings
SET care_feature_flags = COALESCE(care_feature_flags, '{}'::jsonb) || '{"desk_serial_approval": false}'::jsonb
WHERE id = 1;

INSERT INTO public.care_notif_templates (slug, title_bn, title_en, body_bn, body_en, is_active)
VALUES
  (
    'care_serial_pending',
    'সিরিয়াল অনুরোধ গৃহীত',
    'Serial request received',
    'আপনার সিরিয়াল অনুরোধ চেম্বারে পাঠানো হয়েছে। অনুমোদনের পর নম্বর দেখা যাবে।',
    'Your serial request was sent to the chamber. The number will appear after approval.',
    true
  ),
  (
    'care_serial_approved',
    'সিরিয়াল অনুমোদিত',
    'Serial approved',
    'আপনার সিরিয়াল নম্বর বরাদ্দ হয়েছে।',
    'Your serial number has been assigned.',
    true
  )
ON CONFLICT (slug) DO NOTHING;

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
  require_approval BOOLEAN := false;
  flags JSONB;
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
      session_id, serial_no, patient_id, guest_name, guest_phone, source, status, fee_amount, payment_status
    )
    VALUES (
      sess.id, NULL, _patient_id, NULLIF(_guest_name, ''), NULLIF(_guest_phone, ''), src,
      'pending_approval', fee, 'pending'
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
  ELSE
    assigned := sess.last_issued + 1;
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

GRANT EXECUTE ON FUNCTION public.care_approve_serial(UUID, INT) TO authenticated;

-- Call-next should only pick assigned serials
CREATE OR REPLACE FUNCTION public.care_call_next(_session_id UUID)
RETURNS public.care_serials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sess public.care_sessions%ROWTYPE;
  ticket public.care_serials%ROWTYPE;
  ahead INT;
BEGIN
  SELECT * INTO sess FROM public.care_sessions WHERE id = _session_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Session not found'; END IF;
  IF NOT public.care_has_permission(sess.org_id, 'queue.manage') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF sess.status <> 'open' THEN RAISE EXCEPTION 'Session is not open'; END IF;

  SELECT * INTO ticket
  FROM public.care_serials
  WHERE session_id = sess.id
    AND status IN ('booked', 'checked_in')
    AND serial_no IS NOT NULL
  ORDER BY serial_no
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'No waiting patients'; END IF;

  UPDATE public.care_serials
  SET status = 'called', called_at = now()
  WHERE id = ticket.id
  RETURNING * INTO ticket;

  UPDATE public.care_sessions SET now_serving = ticket.serial_no WHERE id = sess.id;

  PERFORM public.care_write_audit(sess.org_id, 'serial.call', 'care_serials', ticket.id,
    jsonb_build_object('serial_no', ticket.serial_no));

  IF ticket.patient_id IS NOT NULL THEN
    PERFORM public.care_notify(
      ticket.patient_id, 'care_serial_called',
      'Serial ' || ticket.serial_no::text,
      jsonb_build_object('serial_id', ticket.id, 'serial', ticket.serial_no, 'session_id', sess.id)
    );
  END IF;

  FOR ticket IN
    SELECT * FROM public.care_serials
    WHERE session_id = sess.id
      AND status IN ('booked', 'checked_in')
      AND patient_id IS NOT NULL
      AND serial_no IS NOT NULL
      AND serial_no > (SELECT now_serving FROM public.care_sessions WHERE id = sess.id)
    ORDER BY serial_no
    LIMIT 8
  LOOP
    SELECT count(*) INTO ahead
    FROM public.care_serials
    WHERE session_id = sess.id
      AND status IN ('booked', 'checked_in')
      AND serial_no IS NOT NULL
      AND serial_no < ticket.serial_no;
    IF ahead BETWEEN 1 AND 3 THEN
      PERFORM public.care_notify(
        ticket.patient_id, 'care_serial_ahead',
        ahead::text || ' ahead',
        jsonb_build_object('serial_id', ticket.id, 'ahead', ahead, 'now', sess.now_serving, 'session_id', sess.id)
      );
    END IF;
  END LOOP;

  SELECT * INTO ticket FROM public.care_serials WHERE id = (
    SELECT id FROM public.care_serials WHERE session_id = sess.id AND status = 'called' ORDER BY called_at DESC NULLS LAST LIMIT 1
  );
  RETURN ticket;
END;
$$;
