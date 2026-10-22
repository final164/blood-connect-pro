-- Users request to join an existing blood-donation organization.
-- Org owners/editors (or members.manage) approve or reject.

CREATE TABLE IF NOT EXISTS public.community_org_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.community_orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  requester_name TEXT,
  requester_phone TEXT,
  requester_blood_group TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID
);

CREATE INDEX IF NOT EXISTS community_org_join_requests_org_idx
  ON public.community_org_join_requests (org_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS community_org_join_requests_one_pending
  ON public.community_org_join_requests (org_id, user_id)
  WHERE status = 'pending';

GRANT SELECT ON public.community_org_join_requests TO authenticated;
GRANT ALL ON public.community_org_join_requests TO service_role;
ALTER TABLE public.community_org_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_join_select" ON public.community_org_join_requests;
CREATE POLICY "org_join_select" ON public.community_org_join_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
    OR public.is_org_editor(org_id, auth.uid())
  );

CREATE OR REPLACE FUNCTION public.can_review_org_join(_org_id UUID, _uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.has_role(_uid, 'admin')
    OR public.is_admin_staff(_uid)
    OR EXISTS (
      SELECT 1
      FROM public.community_org_members m
      LEFT JOIN public.community_org_roles r ON r.id = m.role_id
      WHERE m.org_id = _org_id
        AND m.user_id = _uid
        AND (
          m.role IN ('owner', 'editor')
          OR COALESCE(r.permissions, '{}'::text[]) @> ARRAY['members.manage']::text[]
        )
    )
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_review_org_join(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.request_join_community_org(
  p_org_id UUID,
  p_message TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_msg TEXT := left(btrim(COALESCE(p_message, '')), 300);
  v_name TEXT;
  v_phone TEXT;
  v_blood TEXT;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.community_orgs o
    WHERE o.id = p_org_id AND o.is_active IS DISTINCT FROM false
  ) THEN
    RAISE EXCEPTION 'org_not_found';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.community_org_members m
    WHERE m.org_id = p_org_id AND m.user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('status', 'member', 'already_member', true);
  END IF;

  SELECT r.id INTO v_id
  FROM public.community_org_join_requests r
  WHERE r.org_id = p_org_id AND r.user_id = v_uid AND r.status = 'pending'
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'pending', 'already_pending', true, 'request_id', v_id);
  END IF;

  SELECT p.full_name, p.phone, p.blood_group::text
    INTO v_name, v_phone, v_blood
  FROM public.profiles p
  WHERE p.id = v_uid;

  INSERT INTO public.community_org_join_requests (
    org_id, user_id, message, status, requester_name, requester_phone, requester_blood_group
  ) VALUES (
    p_org_id,
    v_uid,
    NULLIF(v_msg, ''),
    'pending',
    v_name,
    v_phone,
    v_blood
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('status', 'pending', 'already_pending', false, 'request_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_join_community_org(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.my_org_join_state(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_status TEXT;
  v_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('member', false, 'status', NULL);
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.community_org_members m
    WHERE m.org_id = p_org_id AND m.user_id = v_uid
  ) THEN
    RETURN jsonb_build_object('member', true, 'status', 'member');
  END IF;

  SELECT r.status, r.id INTO v_status, v_id
  FROM public.community_org_join_requests r
  WHERE r.org_id = p_org_id AND r.user_id = v_uid
  ORDER BY r.created_at DESC
  LIMIT 1;

  RETURN jsonb_build_object('member', false, 'status', v_status, 'request_id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.my_org_join_state(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_org_join_requests(p_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  IF NOT public.can_review_org_join(p_org_id, auth.uid()) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC)
    FROM (
      SELECT
        r.id,
        r.org_id,
        r.user_id,
        r.message,
        r.status,
        r.requester_name,
        r.requester_phone,
        r.requester_blood_group,
        r.created_at
      FROM public.community_org_join_requests r
      WHERE r.org_id = p_org_id AND r.status = 'pending'
      ORDER BY r.created_at DESC
      LIMIT 50
    ) x
  ), '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_org_join_requests(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.review_community_org_join_request(
  p_request_id UUID,
  p_approve BOOLEAN
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_org UUID;
  v_user UUID;
  v_status TEXT;
  v_role_id UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT r.org_id, r.user_id, r.status
    INTO v_org, v_user, v_status
  FROM public.community_org_join_requests r
  WHERE r.id = p_request_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'request_not_pending';
  END IF;
  IF NOT public.can_review_org_join(v_org, v_uid) THEN
    RAISE EXCEPTION 'not_allowed';
  END IF;

  IF p_approve THEN
    PERFORM public.ensure_org_default_roles(v_org);
    SELECT id INTO v_role_id
    FROM public.community_org_roles
    WHERE org_id = v_org AND slug = 'viewer'
    LIMIT 1;

    INSERT INTO public.community_org_members (org_id, user_id, role, role_id)
    VALUES (v_org, v_user, 'viewer', v_role_id)
    ON CONFLICT (org_id, user_id) DO NOTHING;

    UPDATE public.community_org_join_requests
    SET status = 'approved', reviewed_at = now(), reviewed_by = v_uid
    WHERE id = p_request_id;

    RETURN jsonb_build_object('status', 'approved');
  END IF;

  UPDATE public.community_org_join_requests
  SET status = 'rejected', reviewed_at = now(), reviewed_by = v_uid
  WHERE id = p_request_id;

  RETURN jsonb_build_object('status', 'rejected');
END;
$$;

GRANT EXECUTE ON FUNCTION public.review_community_org_join_request(UUID, BOOLEAN) TO authenticated;
