-- Admin Access Control (Hybrid RBAC)
-- Run in Supabase SQL Editor or apply as migration

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  key TEXT PRIMARY KEY,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  label_en TEXT NOT NULL,
  label_bn TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.admin_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_bn TEXT,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role_id UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.admin_permissions(key) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS public.admin_user_roles (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES public.admin_roles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS public.admin_user_permission_overrides (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.admin_permissions(key) ON DELETE CASCADE,
  effect TEXT NOT NULL CHECK (effect IN ('grant', 'deny')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, permission_key)
);

CREATE INDEX IF NOT EXISTS admin_user_roles_user_idx ON public.admin_user_roles (user_id);
CREATE INDEX IF NOT EXISTS admin_user_roles_role_idx ON public.admin_user_roles (role_id);
CREATE INDEX IF NOT EXISTS admin_overrides_user_idx ON public.admin_user_permission_overrides (user_id);
CREATE INDEX IF NOT EXISTS admin_role_perms_role_idx ON public.admin_role_permissions (role_id);

INSERT INTO public.admin_permissions (key, module, action, label_en, label_bn, sort_order) VALUES
  ('overview.view', 'overview', 'view', 'View overview', 'ওভারভিউ দেখা', 10),
  ('users.view', 'users', 'view', 'View users', 'ইউজার দেখা', 20),
  ('users.edit', 'users', 'edit', 'Edit users', 'ইউজার এডিট', 21),
  ('users.set_role', 'users', 'set_role', 'Set staff roles', 'স্টাফ রোল সেট', 22),
  ('users.toggle_available', 'users', 'toggle_available', 'Toggle availability', 'উপলব্ধ টগল', 23),
  ('requests.view', 'requests', 'view', 'View requests', 'রিকোয়েস্ট দেখা', 30),
  ('requests.edit', 'requests', 'edit', 'Edit request status', 'রিকোয়েস্ট স্ট্যাটাস', 31),
  ('requests.delete', 'requests', 'delete', 'Delete requests', 'রিকোয়েস্ট ডিলিট', 32),
  ('districts.view', 'districts', 'view', 'View districts', 'জেলা দেখা', 40),
  ('districts.add', 'districts', 'add', 'Add districts', 'জেলা যোগ', 41),
  ('districts.edit', 'districts', 'edit', 'Edit districts', 'জেলা এডিট', 42),
  ('districts.delete', 'districts', 'delete', 'Delete districts', 'জেলা ডিলিট', 43),
  ('districts.toggle', 'districts', 'toggle', 'Toggle district active', 'জেলা অন/অফ', 44),
  ('hospitals.view', 'hospitals', 'view', 'View hospitals', 'হাসপাতাল দেখা', 50),
  ('hospitals.add', 'hospitals', 'add', 'Add hospitals', 'হাসপাতাল যোগ', 51),
  ('hospitals.edit', 'hospitals', 'edit', 'Edit hospitals', 'হাসপাতাল এডিট', 52),
  ('hospitals.delete', 'hospitals', 'delete', 'Delete hospitals', 'হাসপাতাল ডিলিট', 53),
  ('hospitals.toggle', 'hospitals', 'toggle', 'Toggle hospital active', 'হাসপাতাল অন/অফ', 54),
  ('hospitals.seed', 'hospitals', 'seed', 'Seed hospitals', 'হাসপাতাল সিড', 55),
  ('cms.view', 'cms', 'view', 'View CMS', 'CMS দেখা', 60),
  ('cms.edit', 'cms', 'edit', 'Edit CMS strings', 'CMS এডিট', 61),
  ('cms.seed', 'cms', 'seed', 'Seed CMS', 'CMS সিড', 62),
  ('community.view', 'community', 'view', 'View community', 'কমিউনিটি দেখা', 70),
  ('community.add', 'community', 'add', 'Add organizations', 'সংস্থা যোগ', 71),
  ('community.edit', 'community', 'edit', 'Edit organizations', 'সংস্থা এডিট', 72),
  ('community.delete', 'community', 'delete', 'Delete organizations', 'সংস্থা ডিলিট', 73),
  ('community.toggle', 'community', 'toggle', 'Toggle org active', 'সংস্থা অন/অফ', 74),
  ('community.import', 'community', 'import', 'Bulk import donors', 'বাল্ক ইমপোর্ট', 75),
  ('community.donors_edit', 'community', 'donors_edit', 'Edit donors', 'রক্তদাতা এডিট', 76),
  ('community.donors_delete', 'community', 'donors_delete', 'Delete donors', 'রক্তদাতা ডিলিট', 77),
  ('notifications.view', 'notifications', 'view', 'View notifications', 'নোটিফিকেশন দেখা', 80),
  ('notifications.broadcast', 'notifications', 'broadcast', 'Broadcast', 'ব্রডকাস্ট', 81),
  ('notifications.delete', 'notifications', 'delete', 'Delete notifications', 'নোটিফিকেশন ডিলিট', 82),
  ('notifications.settings', 'notifications', 'settings', 'Notification settings', 'নোটিফিকেশন সেটিংস', 83),
  ('notifications.purge', 'notifications', 'purge', 'Purge expired', 'পুরানো মুছা', 84),
  ('settings.view', 'settings', 'view', 'View settings', 'সেটিংস দেখা', 90),
  ('settings.edit', 'settings', 'edit', 'Edit settings', 'সেটিংস এডিট', 91),
  ('architecture.view', 'architecture', 'view', 'View architecture', 'আর্কিটেকচার দেখা', 100),
  ('access.view', 'access', 'view', 'View access control', 'অ্যাক্সেস দেখা', 110),
  ('access.manage', 'access', 'manage', 'Manage roles & ACL', 'রোল ও ACL ম্যানেজ', 111)
ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  label_en = EXCLUDED.label_en,
  label_bn = EXCLUDED.label_bn,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.admin_roles (slug, name, name_bn, description, is_system, is_active)
VALUES
  ('super-admin', 'Super Admin', 'সুপার অ্যাডমিন', 'Full access to every page and action', true, true),
  ('moderator', 'Moderator', 'মডারেটর', 'Users & blood requests management', true, true),
  ('content-editor', 'Content Editor', 'কন্টেন্ট এডিটর', 'CMS, community, hospitals', true, true),
  ('support', 'Support', 'সাপোর্ট', 'Overview, view requests & notifications', true, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  name_bn = EXCLUDED.name_bn,
  description = EXCLUDED.description,
  is_system = true,
  is_active = true;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.slug = 'super-admin'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.slug = 'moderator'
  AND p.key IN (
    'overview.view',
    'users.view', 'users.edit', 'users.toggle_available',
    'requests.view', 'requests.edit', 'requests.delete',
    'notifications.view'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.slug = 'content-editor'
  AND p.key IN (
    'overview.view',
    'cms.view', 'cms.edit', 'cms.seed',
    'community.view', 'community.add', 'community.edit', 'community.delete', 'community.toggle',
    'community.import', 'community.donors_edit', 'community.donors_delete',
    'hospitals.view', 'hospitals.add', 'hospitals.edit', 'hospitals.delete', 'hospitals.toggle',
    'districts.view', 'districts.add', 'districts.edit', 'districts.toggle'
  )
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.slug = 'support'
  AND p.key IN ('overview.view', 'requests.view', 'notifications.view')
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_user_roles (user_id, role_id)
SELECT u.id, r.id
FROM auth.users u
CROSS JOIN public.admin_roles r
WHERE r.slug = 'super-admin'
  AND (
    lower(u.email) = '01700000000@phone.bloodlink.local'
    OR lower(u.email) = 'blood@gmail.com'
  )
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_super_admin_user(_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _uid
      AND (
        lower(u.email) = '01700000000@phone.bloodlink.local'
        OR lower(u.email) = 'blood@gmail.com'
      )
  )
  OR public.has_role(_uid, 'admin');
$$;

CREATE OR REPLACE FUNCTION public.has_admin_permission(_uid UUID, _key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  denied BOOLEAN;
  granted BOOLEAN;
BEGIN
  IF _uid IS NULL THEN RETURN false; END IF;
  IF public.is_super_admin_user(_uid) THEN RETURN true; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_user_permission_overrides o
    WHERE o.user_id = _uid AND o.permission_key = _key AND o.effect = 'deny'
  ) INTO denied;
  IF denied THEN RETURN false; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.admin_user_permission_overrides o
    WHERE o.user_id = _uid AND o.permission_key = _key AND o.effect = 'grant'
  ) INTO granted;
  IF granted THEN RETURN true; END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.admin_user_roles ur
    JOIN public.admin_roles r ON r.id = ur.role_id AND r.is_active = true
    JOIN public.admin_role_permissions rp ON rp.role_id = r.id
    WHERE ur.user_id = _uid AND rp.permission_key = _key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_my_admin_permissions()
RETURNS TEXT[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  keys TEXT[];
BEGIN
  IF uid IS NULL THEN RETURN ARRAY[]::TEXT[]; END IF;

  IF public.is_super_admin_user(uid) THEN
    RETURN ARRAY['*']::TEXT[];
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x.key), ARRAY[]::TEXT[])
  INTO keys
  FROM (
    SELECT rp.permission_key AS key
    FROM public.admin_user_roles ur
    JOIN public.admin_roles r ON r.id = ur.role_id AND r.is_active = true
    JOIN public.admin_role_permissions rp ON rp.role_id = r.id
    WHERE ur.user_id = uid
    UNION
    SELECT o.permission_key
    FROM public.admin_user_permission_overrides o
    WHERE o.user_id = uid AND o.effect = 'grant'
  ) x
  WHERE NOT EXISTS (
    SELECT 1 FROM public.admin_user_permission_overrides d
    WHERE d.user_id = uid AND d.permission_key = x.key AND d.effect = 'deny'
  );

  RETURN keys;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin_staff(_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.is_super_admin_user(_uid)
    OR EXISTS (SELECT 1 FROM public.admin_user_roles WHERE user_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.admin_user_permission_overrides
      WHERE user_id = _uid AND effect = 'grant'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_access(_uid UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin_user(_uid)
    OR public.has_admin_permission(_uid, 'access.manage');
$$;

CREATE OR REPLACE FUNCTION public.sync_staff_app_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID;
  has_write BOOLEAN;
BEGIN
  uid := COALESCE(NEW.user_id, OLD.user_id);
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_user_roles ur
    JOIN public.admin_role_permissions rp ON rp.role_id = ur.role_id
    WHERE ur.user_id = uid
      AND split_part(rp.permission_key, '.', 2) NOT IN ('view')
  ) OR EXISTS (
    SELECT 1 FROM public.admin_user_permission_overrides o
    WHERE o.user_id = uid AND o.effect = 'grant'
      AND split_part(o.permission_key, '.', 2) NOT IN ('view')
  ) INTO has_write;

  IF has_write AND NOT public.has_role(uid, 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, 'moderator')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_staff_role_assign ON public.admin_user_roles;
CREATE TRIGGER trg_sync_staff_role_assign
  AFTER INSERT OR DELETE ON public.admin_user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_staff_app_role();

DROP TRIGGER IF EXISTS trg_sync_staff_override ON public.admin_user_permission_overrides;
CREATE TRIGGER trg_sync_staff_override
  AFTER INSERT OR DELETE ON public.admin_user_permission_overrides
  FOR EACH ROW EXECUTE FUNCTION public.sync_staff_app_role();

ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_user_permission_overrides ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.admin_permissions TO authenticated;
GRANT SELECT ON public.admin_roles TO authenticated;
GRANT SELECT ON public.admin_role_permissions TO authenticated;
GRANT SELECT ON public.admin_user_roles TO authenticated;
GRANT SELECT ON public.admin_user_permission_overrides TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;
GRANT ALL ON public.admin_roles TO service_role;
GRANT ALL ON public.admin_role_permissions TO service_role;
GRANT ALL ON public.admin_user_roles TO service_role;
GRANT ALL ON public.admin_user_permission_overrides TO service_role;

DROP POLICY IF EXISTS "admin_permissions_read" ON public.admin_permissions;
CREATE POLICY "admin_permissions_read" ON public.admin_permissions
  FOR SELECT TO authenticated USING (public.is_admin_staff(auth.uid()));

DROP POLICY IF EXISTS "admin_roles_read" ON public.admin_roles;
CREATE POLICY "admin_roles_read" ON public.admin_roles
  FOR SELECT TO authenticated USING (public.is_admin_staff(auth.uid()));

DROP POLICY IF EXISTS "admin_roles_write" ON public.admin_roles;
CREATE POLICY "admin_roles_write" ON public.admin_roles
  FOR ALL TO authenticated
  USING (public.can_manage_access(auth.uid()))
  WITH CHECK (public.can_manage_access(auth.uid()));

DROP POLICY IF EXISTS "admin_role_perms_read" ON public.admin_role_permissions;
CREATE POLICY "admin_role_perms_read" ON public.admin_role_permissions
  FOR SELECT TO authenticated USING (public.is_admin_staff(auth.uid()));

DROP POLICY IF EXISTS "admin_role_perms_write" ON public.admin_role_permissions;
CREATE POLICY "admin_role_perms_write" ON public.admin_role_permissions
  FOR ALL TO authenticated
  USING (public.can_manage_access(auth.uid()))
  WITH CHECK (public.can_manage_access(auth.uid()));

DROP POLICY IF EXISTS "admin_user_roles_read" ON public.admin_user_roles;
CREATE POLICY "admin_user_roles_read" ON public.admin_user_roles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.can_manage_access(auth.uid())
    OR public.has_admin_permission(auth.uid(), 'users.set_role')
  );

DROP POLICY IF EXISTS "admin_user_roles_write" ON public.admin_user_roles;
CREATE POLICY "admin_user_roles_write" ON public.admin_user_roles
  FOR ALL TO authenticated
  USING (public.can_manage_access(auth.uid()) OR public.has_admin_permission(auth.uid(), 'users.set_role'))
  WITH CHECK (public.can_manage_access(auth.uid()) OR public.has_admin_permission(auth.uid(), 'users.set_role'));

DROP POLICY IF EXISTS "admin_overrides_read" ON public.admin_user_permission_overrides;
CREATE POLICY "admin_overrides_read" ON public.admin_user_permission_overrides
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.can_manage_access(auth.uid()));

DROP POLICY IF EXISTS "admin_overrides_write" ON public.admin_user_permission_overrides;
CREATE POLICY "admin_overrides_write" ON public.admin_user_permission_overrides
  FOR ALL TO authenticated
  USING (public.can_manage_access(auth.uid()))
  WITH CHECK (public.can_manage_access(auth.uid()));

-- Interim: admin OR moderator for common write tables
DROP POLICY IF EXISTS "districts_admin_all" ON public.districts;
CREATE POLICY "districts_admin_all" ON public.districts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "orgs_admin_all" ON public.community_orgs;
DROP POLICY IF EXISTS "community_orgs_admin" ON public.community_orgs;
CREATE POLICY "orgs_admin_all" ON public.community_orgs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

DROP POLICY IF EXISTS "community_donors_admin" ON public.community_donors;
CREATE POLICY "community_donors_admin" ON public.community_donors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator'));

GRANT EXECUTE ON FUNCTION public.get_my_admin_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_admin_permission(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_access(UUID) TO authenticated;
