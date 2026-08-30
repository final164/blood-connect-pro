-- Allow chamber/org staff to cancel a pending doctor link request they sent.

CREATE OR REPLACE FUNCTION public.care_cancel_org_doctor_link(_request_id UUID)
RETURNS public.care_doctor_link_requests
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  req public.care_doctor_link_requests;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO req
  FROM public.care_doctor_link_requests
  WHERE id = _request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF req.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already resolved';
  END IF;

  IF NOT public.is_care_staff()
     AND NOT public.care_has_permission(req.org_id, 'doctors.manage') THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  UPDATE public.care_doctor_link_requests
  SET status = 'rejected',
      responded_at = now()
  WHERE id = _request_id
  RETURNING * INTO req;

  RETURN req;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_cancel_org_doctor_link(UUID) TO authenticated;
