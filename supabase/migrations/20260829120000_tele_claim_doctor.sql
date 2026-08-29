-- Allow consultant to claim an unlinked video doctor, or staff to link any user.

CREATE OR REPLACE FUNCTION public.tele_claim_doctor(_doctor_id UUID)
RETURNS public.care_doctors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  doc public.care_doctors%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO doc FROM public.care_doctors WHERE id = _doctor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Doctor not found'; END IF;

  IF doc.user_id IS NOT NULL AND doc.user_id <> uid THEN
    RAISE EXCEPTION 'Doctor already linked to another account';
  END IF;

  IF doc.user_id = uid THEN
    RETURN doc;
  END IF;

  -- Must be video-enabled (tele desk only)
  IF NOT EXISTS (
    SELECT 1 FROM public.tele_doctor_profiles p
    WHERE p.doctor_id = _doctor_id AND p.video_enabled
  ) THEN
    RAISE EXCEPTION 'Doctor is not enabled for video consult';
  END IF;

  -- One doctor per user: clear previous link for this user
  UPDATE public.care_doctors SET user_id = NULL WHERE user_id = uid AND id <> _doctor_id;

  UPDATE public.care_doctors
  SET user_id = uid
  WHERE id = _doctor_id
  RETURNING * INTO doc;

  RETURN doc;
END;
$$;

CREATE OR REPLACE FUNCTION public.tele_admin_link_doctor(_doctor_id UUID, _user_id UUID)
RETURNS public.care_doctors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  doc public.care_doctors%ROWTYPE;
BEGIN
  IF NOT public.is_care_staff() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _user_id IS NULL THEN RAISE EXCEPTION 'User required'; END IF;

  SELECT * INTO doc FROM public.care_doctors WHERE id = _doctor_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Doctor not found'; END IF;

  UPDATE public.care_doctors SET user_id = NULL WHERE user_id = _user_id AND id <> _doctor_id;

  UPDATE public.care_doctors
  SET user_id = _user_id
  WHERE id = _doctor_id
  RETURNING * INTO doc;

  RETURN doc;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tele_claim_doctor(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tele_admin_link_doctor(UUID, UUID) TO authenticated;
