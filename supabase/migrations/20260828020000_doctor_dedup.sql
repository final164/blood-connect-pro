-- care_doctors is a global table (no org_id); per-clinic fees live in
-- care_affiliations. But the desk UI inserted a fresh care_doctors row every
-- time, so the same physician exists once per clinic and "which clinics does
-- this doctor operate at" cannot be answered. These RPCs let the UI reuse an
-- existing record on search, and let platform staff merge the duplicates that
-- already accumulated.

-- ─── Search by any substring of name or BMDC ─────────────────────────────────
-- Replaces the client-side pattern of pulling 80 rows and filtering in JS.
CREATE OR REPLACE FUNCTION public.care_doctors_search(
  _q TEXT DEFAULT NULL,
  _limit INT DEFAULT 20,
  _org_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  full_name_bn TEXT,
  bmdc_no TEXT,
  qualifications TEXT,
  photo_url TEXT,
  specialty_id UUID,
  specialty_name_bn TEXT,
  specialty_name_en TEXT,
  org_count INT,
  in_org BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id,
         d.full_name,
         d.full_name_bn,
         d.bmdc_no,
         d.qualifications,
         d.photo_url,
         d.specialty_id,
         s.name_bn,
         s.name_en,
         (SELECT COUNT(DISTINCT a.org_id)::INT FROM public.care_affiliations a WHERE a.doctor_id = d.id),
         (
           _org_id IS NOT NULL AND EXISTS (
             SELECT 1 FROM public.care_affiliations a
             WHERE a.doctor_id = d.id AND a.org_id = _org_id
           )
         )
  FROM public.care_doctors d
  LEFT JOIN public.care_specialties s ON s.id = d.specialty_id
  WHERE d.is_active
    AND (
      _q IS NULL OR TRIM(_q) = ''
      OR d.full_name ILIKE '%' || TRIM(_q) || '%'
      OR COALESCE(d.full_name_bn, '') ILIKE '%' || TRIM(_q) || '%'
      OR COALESCE(d.bmdc_no, '') ILIKE '%' || TRIM(_q) || '%'
    )
  ORDER BY
    -- doctors already at the caller's clinic first, then prefix matches
    (_org_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.care_affiliations a
      WHERE a.doctor_id = d.id AND a.org_id = _org_id
    )) DESC,
    (_q IS NOT NULL AND d.full_name ILIKE TRIM(_q) || '%') DESC,
    d.full_name
  LIMIT GREATEST(1, LEAST(100, COALESCE(_limit, 20)));
$$;

GRANT EXECUTE ON FUNCTION public.care_doctors_search(TEXT, INT, UUID) TO authenticated, anon;

-- ─── Reuse an existing doctor, or create one ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.care_find_or_create_doctor(
  _full_name TEXT,
  _bmdc_no TEXT DEFAULT NULL,
  _specialty_id UUID DEFAULT NULL,
  _qualifications TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  name_clean TEXT := NULLIF(TRIM(COALESCE(_full_name, '')), '');
  bmdc_clean TEXT := NULLIF(TRIM(COALESCE(_bmdc_no, '')), '');
  found_id UUID;
BEGIN
  IF name_clean IS NULL THEN
    RAISE EXCEPTION 'Doctor name is required';
  END IF;

  -- Mirrors care_doctors_insert: any care org member may add a doctor.
  IF NOT public.is_care_staff()
     AND NOT EXISTS (SELECT 1 FROM public.care_org_members m WHERE m.user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  -- BMDC is the strongest identity signal, so try it first.
  IF bmdc_clean IS NOT NULL THEN
    SELECT id INTO found_id
    FROM public.care_doctors
    WHERE LOWER(TRIM(COALESCE(bmdc_no, ''))) = LOWER(bmdc_clean)
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF found_id IS NULL THEN
    SELECT id INTO found_id
    FROM public.care_doctors
    WHERE LOWER(TRIM(full_name)) = LOWER(name_clean)
       OR LOWER(TRIM(COALESCE(full_name_bn, ''))) = LOWER(name_clean)
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF found_id IS NOT NULL THEN
    -- Fill blanks on the existing record without overwriting curated values.
    UPDATE public.care_doctors
    SET bmdc_no = COALESCE(NULLIF(TRIM(COALESCE(bmdc_no, '')), ''), bmdc_clean),
        specialty_id = COALESCE(specialty_id, _specialty_id),
        qualifications = COALESCE(
          NULLIF(TRIM(COALESCE(qualifications, '')), ''),
          NULLIF(TRIM(COALESCE(_qualifications, '')), '')
        )
    WHERE id = found_id;
    RETURN found_id;
  END IF;

  INSERT INTO public.care_doctors (full_name, bmdc_no, specialty_id, qualifications)
  VALUES (name_clean, bmdc_clean, _specialty_id, NULLIF(TRIM(COALESCE(_qualifications, '')), ''))
  RETURNING id INTO found_id;

  PERFORM public.care_write_audit(NULL::UUID, 'doctor.create', 'care_doctors', found_id,
    jsonb_build_object('full_name', name_clean, 'bmdc_no', bmdc_clean));

  RETURN found_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_find_or_create_doctor(TEXT, TEXT, UUID, TEXT) TO authenticated;

-- ─── Merge duplicates (platform staff only, destructive) ─────────────────────
CREATE OR REPLACE FUNCTION public.care_merge_doctors(_keep_id UUID, _drop_id UUID)
RETURNS public.care_doctors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  keep public.care_doctors%ROWTYPE;
  drop_row public.care_doctors%ROWTYPE;
  moved_affiliations INT := 0;
BEGIN
  IF NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _keep_id = _drop_id THEN
    RAISE EXCEPTION 'Cannot merge a doctor into itself';
  END IF;

  SELECT * INTO keep FROM public.care_doctors WHERE id = _keep_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Doctor to keep not found'; END IF;
  SELECT * INTO drop_row FROM public.care_doctors WHERE id = _drop_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Doctor to merge not found'; END IF;

  -- Repoint affiliations. care_schedules hangs off affiliation_id, so moving
  -- the affiliation carries the schedules and sessions with it.
  UPDATE public.care_affiliations a
  SET doctor_id = _keep_id
  WHERE a.doctor_id = _drop_id
    AND NOT EXISTS (
      SELECT 1 FROM public.care_affiliations b
      WHERE b.doctor_id = _keep_id AND b.org_id = a.org_id AND b.location_id = a.location_id
    );
  GET DIAGNOSTICS moved_affiliations = ROW_COUNT;

  -- Any left over would violate UNIQUE(org_id, doctor_id, location_id).
  DELETE FROM public.care_affiliations WHERE doctor_id = _drop_id;

  UPDATE public.care_sessions SET doctor_id = _keep_id WHERE doctor_id = _drop_id;

  -- Fill gaps on the surviving row from the one being removed.
  UPDATE public.care_doctors
  SET bmdc_no = COALESCE(NULLIF(TRIM(COALESCE(bmdc_no, '')), ''), NULLIF(TRIM(COALESCE(drop_row.bmdc_no, '')), '')),
      full_name_bn = COALESCE(full_name_bn, drop_row.full_name_bn),
      qualifications = COALESCE(NULLIF(TRIM(COALESCE(qualifications, '')), ''), drop_row.qualifications),
      photo_url = COALESCE(photo_url, drop_row.photo_url),
      bio = COALESCE(bio, drop_row.bio),
      specialty_id = COALESCE(specialty_id, drop_row.specialty_id),
      user_id = COALESCE(user_id, drop_row.user_id)
  WHERE id = _keep_id;

  DELETE FROM public.care_doctors WHERE id = _drop_id;

  SELECT * INTO keep FROM public.care_doctors WHERE id = _keep_id;

  PERFORM public.care_write_audit(NULL::UUID, 'doctor.merge', 'care_doctors', _keep_id,
    jsonb_build_object(
      'kept', to_jsonb(keep),
      'dropped', to_jsonb(drop_row),
      'moved_affiliations', moved_affiliations
    ));

  RETURN keep;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_merge_doctors(UUID, UUID) TO authenticated;

-- ─── Duplicate suggestions for the admin merge tool ──────────────────────────
CREATE OR REPLACE FUNCTION public.care_doctor_duplicates(_limit INT DEFAULT 50)
RETURNS TABLE (
  match_key TEXT,
  doctor_ids UUID[],
  full_names TEXT[],
  n INT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT key, ids, names, n
  FROM (
    SELECT LOWER(TRIM(full_name)) AS key,
           ARRAY_AGG(id ORDER BY created_at) AS ids,
           ARRAY_AGG(full_name ORDER BY created_at) AS names,
           COUNT(*)::INT AS n
    FROM public.care_doctors
    WHERE public.is_care_staff()
    GROUP BY LOWER(TRIM(full_name))

    UNION ALL

    SELECT LOWER(TRIM(bmdc_no)) AS key,
           ARRAY_AGG(id ORDER BY created_at) AS ids,
           ARRAY_AGG(full_name ORDER BY created_at) AS names,
           COUNT(*)::INT AS n
    FROM public.care_doctors
    WHERE public.is_care_staff() AND NULLIF(TRIM(COALESCE(bmdc_no, '')), '') IS NOT NULL
    GROUP BY LOWER(TRIM(bmdc_no))
  ) grouped
  WHERE n > 1
  ORDER BY n DESC, key
  LIMIT GREATEST(1, LEAST(200, COALESCE(_limit, 50)));
$$;

GRANT EXECUTE ON FUNCTION public.care_doctor_duplicates(INT) TO authenticated;

CREATE INDEX IF NOT EXISTS care_doctors_name_lower_idx ON public.care_doctors (LOWER(TRIM(full_name)));
CREATE INDEX IF NOT EXISTS care_doctors_bmdc_lower_idx ON public.care_doctors (LOWER(TRIM(bmdc_no)));
