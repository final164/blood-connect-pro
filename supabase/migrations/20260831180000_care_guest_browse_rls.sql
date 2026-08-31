-- Guest Care browse: allow anon SELECT on public catalog / listed-org tables.
-- Writes, bookings, serials, members stay authenticated-only.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT SELECT ON public.care_vendor_types TO anon;
GRANT SELECT ON public.care_hub_modules TO anon;
GRANT SELECT ON public.care_specialties TO anon;
GRANT SELECT ON public.care_serial_statuses TO anon;
GRANT SELECT ON public.care_lab_booking_statuses TO anon;
GRANT SELECT ON public.care_booking_modes TO anon;
GRANT SELECT ON public.care_test_categories TO anon;
GRANT SELECT ON public.care_test_catalog TO anon;
GRANT SELECT ON public.care_orgs TO anon;
GRANT SELECT ON public.care_locations TO anon;
GRANT SELECT ON public.care_doctors TO anon;
GRANT SELECT ON public.care_affiliations TO anon;
GRANT SELECT ON public.care_schedules TO anon;
GRANT SELECT ON public.care_sessions TO anon;
GRANT SELECT ON public.care_test_offerings TO anon;
GRANT SELECT ON public.care_lab_calendars TO anon;

-- Helpers used inside SELECT policies (SECURITY DEFINER; safe for null uid)
GRANT EXECUTE ON FUNCTION public.is_care_staff(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.is_care_member(UUID, UUID) TO anon;

-- ---------------------------------------------------------------------------
-- CMS / reference catalogs
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'care_vendor_types','care_hub_modules','care_specialties',
    'care_serial_statuses','care_lab_booking_statuses','care_booking_modes',
    'care_test_categories','care_test_catalog'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_read', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated, anon USING (true)',
      t || '_read', t
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Orgs / locations / doctors / affiliations / schedules / sessions / offerings
-- Same public USING as before; anon simply cannot match member/staff branches.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS care_orgs_public_read ON public.care_orgs;
CREATE POLICY care_orgs_public_read ON public.care_orgs FOR SELECT TO authenticated, anon
  USING (
    (is_active AND is_verified AND is_listed)
    OR public.is_care_member(id)
    OR public.is_care_staff()
  );

DROP POLICY IF EXISTS care_locations_read ON public.care_locations;
CREATE POLICY care_locations_read ON public.care_locations FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.care_orgs o
      WHERE o.id = org_id AND o.is_active AND o.is_verified AND o.is_listed
    )
    OR public.is_care_member(org_id)
    OR public.is_care_staff()
  );

DROP POLICY IF EXISTS care_doctors_read ON public.care_doctors;
CREATE POLICY care_doctors_read ON public.care_doctors FOR SELECT TO authenticated, anon
  USING (
    (
      is_active AND EXISTS (
        SELECT 1 FROM public.care_affiliations a
        JOIN public.care_orgs o ON o.id = a.org_id
        WHERE a.doctor_id = care_doctors.id
          AND a.is_active
          AND o.is_verified AND o.is_listed AND o.is_active
      )
    )
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.care_affiliations a
      WHERE a.doctor_id = care_doctors.id AND public.is_care_member(a.org_id)
    )
    OR public.is_care_staff()
  );

DROP POLICY IF EXISTS care_aff_read ON public.care_affiliations;
CREATE POLICY care_aff_read ON public.care_affiliations FOR SELECT TO authenticated, anon
  USING (
    (
      is_active AND EXISTS (
        SELECT 1 FROM public.care_orgs o
        WHERE o.id = org_id AND o.is_verified AND o.is_listed AND o.is_active
      )
    )
    OR public.is_care_member(org_id)
    OR public.is_care_staff()
  );

DROP POLICY IF EXISTS care_sched_read ON public.care_schedules;
CREATE POLICY care_sched_read ON public.care_schedules FOR SELECT TO authenticated, anon
  USING (
    (
      is_active AND EXISTS (
        SELECT 1 FROM public.care_affiliations a
        JOIN public.care_orgs o ON o.id = a.org_id
        WHERE a.id = affiliation_id
          AND o.is_verified AND o.is_listed AND o.is_active
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.care_affiliations a
      WHERE a.id = affiliation_id AND public.is_care_member(a.org_id)
    )
    OR public.is_care_staff()
  );

DROP POLICY IF EXISTS care_sess_read ON public.care_sessions;
CREATE POLICY care_sess_read ON public.care_sessions FOR SELECT TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM public.care_orgs o
      WHERE o.id = org_id AND o.is_verified AND o.is_listed AND o.is_active
    )
    OR public.is_care_member(org_id)
    OR public.is_care_staff()
  );

DROP POLICY IF EXISTS care_off_read ON public.care_test_offerings;
CREATE POLICY care_off_read ON public.care_test_offerings FOR SELECT TO authenticated, anon
  USING (
    (
      is_active AND EXISTS (
        SELECT 1 FROM public.care_orgs o
        WHERE o.id = org_id AND o.is_verified AND o.is_listed AND o.is_active
      )
    )
    OR public.is_care_member(org_id)
    OR public.is_care_staff()
  );

DROP POLICY IF EXISTS care_cal_read ON public.care_lab_calendars;
CREATE POLICY care_cal_read ON public.care_lab_calendars FOR SELECT TO authenticated, anon
  USING (
    (
      is_open AND EXISTS (
        SELECT 1 FROM public.care_test_offerings off
        JOIN public.care_orgs o ON o.id = off.org_id
        WHERE off.id = offering_id
          AND o.is_verified AND o.is_listed AND o.is_active
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.care_test_offerings o
      WHERE o.id = offering_id AND public.is_care_member(o.org_id)
    )
    OR public.is_care_staff()
  );
