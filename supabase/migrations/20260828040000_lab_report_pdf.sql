-- Lab desk uploads a PDF report after completion; patient views/downloads via signed URL.
-- One report per invoice group (mirrors care_set_lab_schedule apply-group behaviour).

ALTER TABLE public.care_lab_bookings
  ADD COLUMN IF NOT EXISTS report_url TEXT,
  ADD COLUMN IF NOT EXISTS report_path TEXT,
  ADD COLUMN IF NOT EXISTS report_file_name TEXT,
  ADD COLUMN IF NOT EXISTS report_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS report_uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.care_lab_bookings.report_path IS
  'Private storage path in care-lab-reports bucket (for signed URL regeneration)';

-- ─── Set / replace report metadata ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.care_set_lab_report(
  _booking_id UUID,
  _url TEXT,
  _path TEXT,
  _file_name TEXT DEFAULT NULL,
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

  IF _path IS NULL OR btrim(_path) = '' THEN
    RAISE EXCEPTION 'Report path is required';
  END IF;

  gid := COALESCE(booking.invoice_group_id, booking.id);

  UPDATE public.care_lab_bookings
  SET report_url = NULLIF(btrim(_url), ''),
      report_path = btrim(_path),
      report_file_name = NULLIF(btrim(COALESCE(_file_name, '')), ''),
      report_uploaded_at = now(),
      report_uploaded_by = auth.uid()
  WHERE (_apply_group AND (COALESCE(invoice_group_id, id) = gid OR id = _booking_id))
     OR (NOT _apply_group AND id = _booking_id);

  SELECT * INTO booking FROM public.care_lab_bookings WHERE id = _booking_id;

  PERFORM public.care_write_audit(
    booking.org_id,
    'lab.report_set',
    'care_lab_bookings',
    booking.id,
    jsonb_build_object(
      'invoice_group_id', gid,
      'apply_group', _apply_group,
      'report_path', booking.report_path,
      'report_file_name', booking.report_file_name
    )
  );

  RETURN booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_set_lab_report(UUID, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated;

-- ─── Clear report metadata (client deletes storage object separately) ────────
CREATE OR REPLACE FUNCTION public.care_clear_lab_report(
  _booking_id UUID,
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
  old_path TEXT;
BEGIN
  SELECT * INTO booking FROM public.care_lab_bookings WHERE id = _booking_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Booking not found'; END IF;

  IF NOT public.care_has_permission(booking.org_id, 'lab.checkin') AND NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  old_path := booking.report_path;
  gid := COALESCE(booking.invoice_group_id, booking.id);

  UPDATE public.care_lab_bookings
  SET report_url = NULL,
      report_path = NULL,
      report_file_name = NULL,
      report_uploaded_at = NULL,
      report_uploaded_by = NULL
  WHERE (_apply_group AND (COALESCE(invoice_group_id, id) = gid OR id = _booking_id))
     OR (NOT _apply_group AND id = _booking_id);

  SELECT * INTO booking FROM public.care_lab_bookings WHERE id = _booking_id;

  PERFORM public.care_write_audit(
    booking.org_id,
    'lab.report_clear',
    'care_lab_bookings',
    booking.id,
    jsonb_build_object(
      'invoice_group_id', gid,
      'apply_group', _apply_group,
      'cleared_path', old_path
    )
  );

  RETURN booking;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_clear_lab_report(UUID, BOOLEAN) TO authenticated;

-- ─── Private PDF bucket ──────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'care-lab-reports',
  'care-lab-reports',
  false,
  15728640,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path layout: {org_id}/{invoice_group_or_booking_id}/{filename}.pdf
DROP POLICY IF EXISTS care_lab_reports_select ON storage.objects;
CREATE POLICY care_lab_reports_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'care-lab-reports'
    AND (
      public.is_care_staff()
      OR (
        (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
        AND (
          public.care_has_permission(((storage.foldername(name))[1])::uuid, 'lab.checkin')
          OR public.is_care_member(((storage.foldername(name))[1])::uuid)
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.care_lab_bookings b
        WHERE b.patient_id = auth.uid()
          AND b.report_path IS NOT NULL
          AND b.report_path = name
      )
    )
  );

DROP POLICY IF EXISTS care_lab_reports_insert ON storage.objects;
CREATE POLICY care_lab_reports_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'care-lab-reports'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND (
      public.is_care_staff()
      OR public.care_has_permission(((storage.foldername(name))[1])::uuid, 'lab.checkin')
    )
  );

DROP POLICY IF EXISTS care_lab_reports_update ON storage.objects;
CREATE POLICY care_lab_reports_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'care-lab-reports'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND (
      public.is_care_staff()
      OR public.care_has_permission(((storage.foldername(name))[1])::uuid, 'lab.checkin')
    )
  )
  WITH CHECK (
    bucket_id = 'care-lab-reports'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND (
      public.is_care_staff()
      OR public.care_has_permission(((storage.foldername(name))[1])::uuid, 'lab.checkin')
    )
  );

DROP POLICY IF EXISTS care_lab_reports_delete ON storage.objects;
CREATE POLICY care_lab_reports_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'care-lab-reports'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND (
      public.is_care_staff()
      OR public.care_has_permission(((storage.foldername(name))[1])::uuid, 'lab.checkin')
    )
  );
