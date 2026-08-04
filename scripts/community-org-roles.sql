-- Per-org roles with configurable permissions.
-- Run in Supabase SQL Editor after community-org-members.sql.

CREATE TABLE IF NOT EXISTS public.community_org_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.community_orgs(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  name TEXT NOT NULL,
  name_bn TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  permissions TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, slug)
);

CREATE INDEX IF NOT EXISTS community_org_roles_org_idx
  ON public.community_org_roles (org_id);

ALTER TABLE public.community_org_members
  ADD COLUMN IF NOT EXISTS role_id UUID REFERENCES public.community_org_roles(id) ON DELETE SET NULL;

-- Allow custom role slugs on members.role (was owner|editor|viewer only)
ALTER TABLE public.community_org_members DROP CONSTRAINT IF EXISTS community_org_members_role_check;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.community_org_roles TO authenticated;
GRANT ALL ON public.community_org_roles TO service_role;
ALTER TABLE public.community_org_roles ENABLE ROW LEVEL SECURITY;

-- Default permission sets
CREATE OR REPLACE FUNCTION public.org_default_role_permissions(_slug TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(_slug)
    WHEN 'owner' THEN ARRAY[
      'overview.view',
      'donors.view','donors.add','donors.edit','donors.delete','donors.import',
      'settings.view','settings.edit',
      'requests.view','requests.edit',
      'contact.send',
      'members.view','members.manage',
      'roles.manage'
    ]::TEXT[]
    WHEN 'editor' THEN ARRAY[
      'overview.view',
      'donors.view','donors.add','donors.edit','donors.delete','donors.import',
      'settings.view','settings.edit',
      'requests.view','requests.edit',
      'contact.send',
      'members.view'
    ]::TEXT[]
    WHEN 'viewer' THEN ARRAY[
      'overview.view',
      'donors.view',
      'settings.view',
      'requests.view',
      'members.view'
    ]::TEXT[]
    ELSE ARRAY['overview.view','donors.view','requests.view']::TEXT[]
  END;
$$;

CREATE OR REPLACE FUNCTION public.ensure_org_default_roles(_org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.community_org_roles (org_id, slug, name, name_bn, is_system, permissions)
  VALUES
    (_org_id, 'owner', 'Owner', 'মালিক', true, public.org_default_role_permissions('owner')),
    (_org_id, 'editor', 'Editor', 'এডিটর', true, public.org_default_role_permissions('editor')),
    (_org_id, 'viewer', 'Viewer', 'ভিউয়ার', true, public.org_default_role_permissions('viewer'))
  ON CONFLICT (org_id, slug) DO NOTHING;

  UPDATE public.community_org_members m
  SET role_id = r.id
  FROM public.community_org_roles r
  WHERE m.org_id = _org_id
    AND m.role_id IS NULL
    AND r.org_id = _org_id
    AND r.slug = m.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_org_default_roles(UUID) TO authenticated;

-- Seed roles for existing orgs + link members
DO $$
DECLARE
  o RECORD;
BEGIN
  FOR o IN SELECT id FROM public.community_orgs LOOP
    PERFORM public.ensure_org_default_roles(o.id);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.trg_community_orgs_seed_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_org_default_roles(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS community_orgs_seed_roles ON public.community_orgs;
CREATE TRIGGER community_orgs_seed_roles
  AFTER INSERT ON public.community_orgs
  FOR EACH ROW EXECUTE FUNCTION public.trg_community_orgs_seed_roles();

CREATE OR REPLACE FUNCTION public.org_has_permission(
  _org_id UUID,
  _perm TEXT,
  _uid UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.community_org_members m
    LEFT JOIN public.community_org_roles r ON r.id = m.role_id
    WHERE m.org_id = _org_id
      AND m.user_id = _uid
      AND (
        (r.id IS NOT NULL AND _perm = ANY (r.permissions))
        OR (
          r.id IS NULL AND (
            (_perm LIKE '%.view' AND m.role IN ('owner', 'editor', 'viewer'))
            OR (m.role IN ('owner', 'editor') AND _perm NOT IN ('roles.manage'))
            OR (m.role = 'owner')
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.org_has_permission(UUID, TEXT, UUID) TO authenticated;

-- Broad write helper used by some policies
CREATE OR REPLACE FUNCTION public.is_org_editor(_org_id UUID, _uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.org_has_permission(_org_id, 'donors.edit', _uid)
      OR public.org_has_permission(_org_id, 'donors.add', _uid)
      OR public.org_has_permission(_org_id, 'settings.edit', _uid)
      OR public.org_has_permission(_org_id, 'requests.edit', _uid)
      OR public.org_has_permission(_org_id, 'contact.send', _uid);
$$;

-- Roles RLS
DROP POLICY IF EXISTS "org_roles_select" ON public.community_org_roles;
CREATE POLICY "org_roles_select" ON public.community_org_roles
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS "org_roles_write" ON public.community_org_roles;
CREATE POLICY "org_roles_write" ON public.community_org_roles
  FOR ALL TO authenticated
  USING (
    public.org_has_permission(org_id, 'roles.manage')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
  )
  WITH CHECK (
    public.org_has_permission(org_id, 'roles.manage')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
  );

-- Members: allow org owners/managers to assign (not only platform admin)
DROP POLICY IF EXISTS "org_members_admin_write" ON public.community_org_members;
DROP POLICY IF EXISTS "org_members_write" ON public.community_org_members;
CREATE POLICY "org_members_write" ON public.community_org_members
  FOR ALL TO authenticated
  USING (
    public.org_has_permission(org_id, 'members.manage')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
  )
  WITH CHECK (
    public.org_has_permission(org_id, 'members.manage')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
  );

-- Also let members see all members of their org (not only self)
DROP POLICY IF EXISTS "org_members_select" ON public.community_org_members;
CREATE POLICY "org_members_select" ON public.community_org_members
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_org_member(org_id)
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
  );

-- Fine-grained donor policies
DROP POLICY IF EXISTS "community_donors_org_insert" ON public.community_donors;
CREATE POLICY "community_donors_org_insert" ON public.community_donors
  FOR INSERT TO authenticated
  WITH CHECK (public.org_has_permission(org_id, 'donors.add') OR public.org_has_permission(org_id, 'donors.import'));

DROP POLICY IF EXISTS "community_donors_org_update" ON public.community_donors;
CREATE POLICY "community_donors_org_update" ON public.community_donors
  FOR UPDATE TO authenticated
  USING (public.org_has_permission(org_id, 'donors.edit'))
  WITH CHECK (public.org_has_permission(org_id, 'donors.edit'));

DROP POLICY IF EXISTS "community_donors_org_delete" ON public.community_donors;
CREATE POLICY "community_donors_org_delete" ON public.community_donors
  FOR DELETE TO authenticated
  USING (public.org_has_permission(org_id, 'donors.delete'));

DROP POLICY IF EXISTS "orgs_member_update" ON public.community_orgs;
CREATE POLICY "orgs_member_update" ON public.community_orgs
  FOR UPDATE TO authenticated
  USING (public.org_has_permission(id, 'settings.edit'))
  WITH CHECK (public.org_has_permission(id, 'settings.edit'));

DROP POLICY IF EXISTS "req_update_org_editor" ON public.blood_requests;
CREATE POLICY "req_update_org_editor" ON public.blood_requests
  FOR UPDATE TO authenticated
  USING (org_id IS NOT NULL AND public.org_has_permission(org_id, 'requests.edit'))
  WITH CHECK (org_id IS NOT NULL AND public.org_has_permission(org_id, 'requests.edit'));
