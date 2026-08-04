-- Organization members + org-scoped RLS + blood_requests.org_id
-- Run in Supabase SQL Editor if migrations are applied manually.

CREATE TABLE IF NOT EXISTS public.community_org_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.community_orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'editor'
    CHECK (role IN ('owner', 'editor', 'viewer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS community_org_members_user_idx
  ON public.community_org_members (user_id);
CREATE INDEX IF NOT EXISTS community_org_members_org_idx
  ON public.community_org_members (org_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_org_members TO authenticated;
GRANT ALL ON public.community_org_members TO service_role;
ALTER TABLE public.community_org_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_org_member(_org_id UUID, _uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.community_org_members m
    WHERE m.org_id = _org_id AND m.user_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_editor(_org_id UUID, _uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.community_org_members m
    WHERE m.org_id = _org_id
      AND m.user_id = _uid
      AND m.role IN ('owner', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.user_org_ids(_uid UUID DEFAULT auth.uid())
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.org_id FROM public.community_org_members m WHERE m.user_id = _uid;
$$;

GRANT EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_org_editor(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_org_ids(UUID) TO authenticated;

DROP POLICY IF EXISTS "org_members_select" ON public.community_org_members;
CREATE POLICY "org_members_select" ON public.community_org_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS "org_members_admin_write" ON public.community_org_members;
CREATE POLICY "org_members_admin_write" ON public.community_org_members
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS "orgs_member_update" ON public.community_orgs;
CREATE POLICY "orgs_member_update" ON public.community_orgs
  FOR UPDATE TO authenticated
  USING (public.is_org_editor(id))
  WITH CHECK (public.is_org_editor(id));

DROP POLICY IF EXISTS "orgs_member_read" ON public.community_orgs;
CREATE POLICY "orgs_member_read" ON public.community_orgs
  FOR SELECT TO authenticated
  USING (public.is_org_member(id));

DROP POLICY IF EXISTS "community_donors_org_select" ON public.community_donors;
CREATE POLICY "community_donors_org_select" ON public.community_donors
  FOR SELECT TO authenticated
  USING (public.is_org_member(org_id));

DROP POLICY IF EXISTS "community_donors_org_insert" ON public.community_donors;
CREATE POLICY "community_donors_org_insert" ON public.community_donors
  FOR INSERT TO authenticated
  WITH CHECK (public.is_org_editor(org_id));

DROP POLICY IF EXISTS "community_donors_org_update" ON public.community_donors;
CREATE POLICY "community_donors_org_update" ON public.community_donors
  FOR UPDATE TO authenticated
  USING (public.is_org_editor(org_id))
  WITH CHECK (public.is_org_editor(org_id));

DROP POLICY IF EXISTS "community_donors_org_delete" ON public.community_donors;
CREATE POLICY "community_donors_org_delete" ON public.community_donors
  FOR DELETE TO authenticated
  USING (public.is_org_editor(org_id));

GRANT INSERT, UPDATE, DELETE ON public.community_donors TO authenticated;

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS org_id UUID REFERENCES public.community_orgs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS blood_requests_org_idx
  ON public.blood_requests (org_id, created_at DESC)
  WHERE org_id IS NOT NULL;

DROP POLICY IF EXISTS "req_select_org_member" ON public.blood_requests;
CREATE POLICY "req_select_org_member" ON public.blood_requests
  FOR SELECT TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_member(org_id));

DROP POLICY IF EXISTS "req_update_org_editor" ON public.blood_requests;
CREATE POLICY "req_update_org_editor" ON public.blood_requests
  FOR UPDATE TO authenticated
  USING (org_id IS NOT NULL AND public.is_org_editor(org_id))
  WITH CHECK (org_id IS NOT NULL AND public.is_org_editor(org_id));
