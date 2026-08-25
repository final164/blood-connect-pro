-- Resolve which staff profile receives patient chat for a care org.
-- Patients cannot SELECT care_org_members (RLS), so this is SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.care_org_chat_peer(_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  peer UUID;
  allowed BOOLEAN;
BEGIN
  IF _org_id IS NULL OR auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  -- Listed/active org, or caller is a member / has a booking with this org
  SELECT
    EXISTS (
      SELECT 1 FROM public.care_orgs o
      WHERE o.id = _org_id
        AND o.is_active
        AND o.is_verified
        AND COALESCE(o.is_listed, true)
    )
    OR public.is_care_member(_org_id)
    OR public.is_care_staff()
    OR EXISTS (
      SELECT 1 FROM public.care_lab_bookings b
      WHERE b.org_id = _org_id AND b.patient_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.care_serials s
      JOIN public.care_sessions sess ON sess.id = s.session_id
      WHERE sess.org_id = _org_id AND s.patient_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.ambulance_requests a
      WHERE a.org_id = _org_id AND a.patient_id = auth.uid()
    )
  INTO allowed;

  IF NOT COALESCE THEN
    RETURN NULL;
  END IF;

  -- Prefer owner
  SELECT m.user_id INTO peer
  FROM public.care_org_members m
  WHERE m.org_id = _org_id AND lower(m.role) = 'owner'
  ORDER BY m.created_at ASC
  LIMIT 1;

  IF peer IS NOT NULL THEN
    RETURN peer;
  END IF;

  -- Prefer reception / desk roles
  SELECT m.user_id INTO peer
  FROM public.care_org_members m
  WHERE m.org_id = _org_id
    AND lower(m.role) IN ('reception', 'lab_tech', 'dispatcher')
  ORDER BY m.created_at ASC
  LIMIT 1;

  IF peer IS NOT NULL THEN
    RETURN peer;
  END IF;

  -- Any member
  SELECT m.user_id INTO peer
  FROM public.care_org_members m
  WHERE m.org_id = _org_id
  ORDER BY m.created_at ASC
  LIMIT 1;

  RETURN peer;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_org_chat_peer(UUID) TO authenticated;

COMMENT ON FUNCTION public.care_org_chat_peer(UUID) IS
  'Returns the staff profile id patients should message for a care hospital/clinic/lab.';
