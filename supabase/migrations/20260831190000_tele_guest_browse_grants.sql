-- Tele / video guest browse: table grants + care_doctors readable for video-enabled profiles.
-- Tele RLS already allows anon; without GRANT (and without care_doctors join access)
-- the hub maps zero doctors and looks empty.

GRANT SELECT ON public.tele_offer_cards TO anon;
GRANT SELECT ON public.tele_doctor_profiles TO anon;
GRANT SELECT ON public.tele_doctor_slots TO anon;
GRANT SELECT ON public.tele_consult_products TO anon;
GRANT SELECT ON public.tele_booking_statuses TO anon;
GRANT SELECT ON public.tele_reviews TO anon;

GRANT EXECUTE ON FUNCTION public.is_tele_doctor(UUID, UUID) TO anon;

-- Doctors with an active video profile must be readable for public tele browse,
-- even when they have no listed chamber affiliation.
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
    OR (
      is_active AND EXISTS (
        SELECT 1 FROM public.tele_doctor_profiles p
        WHERE p.doctor_id = care_doctors.id AND p.video_enabled
      )
    )
    OR (
      is_active AND EXISTS (
        SELECT 1 FROM public.care_home_doctor_profiles hp
        WHERE hp.doctor_id = care_doctors.id AND hp.is_active
      )
    )
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.care_affiliations a
      WHERE a.doctor_id = care_doctors.id AND public.is_care_member(a.org_id)
    )
    OR public.is_care_staff()
  );
