-- Admin ACL: org roles & members permissions + catalog sync RPC

INSERT INTO public.admin_permissions (key, module, action, label_en, label_bn, sort_order)
VALUES
  ('community.roles_manage', 'community', 'roles_manage', 'Edit org roles & permissions', 'অর্গ রোল ও পারমিশন এডিট', 78),
  ('community.members_manage', 'community', 'members_manage', 'Assign org members', 'অর্গ মেম্বার অ্যাসাইন', 79)
ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  label_en = EXCLUDED.label_en,
  label_bn = EXCLUDED.label_bn,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.slug = 'super-admin'
  AND p.key IN ('community.roles_manage', 'community.members_manage')
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_admin_permission_catalog(payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_access(auth.uid()) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  INSERT INTO public.admin_permissions (key, module, action, label_en, label_bn, sort_order)
  SELECT
    r.key,
    r.module,
    r.action,
    r.label_en,
    r.label_bn,
    r.sort_order
  FROM jsonb_to_recordset(payload) AS r(
    key text,
    module text,
    action text,
    label_en text,
    label_bn text,
    sort_order int
  )
  ON CONFLICT (key) DO UPDATE SET
    module = EXCLUDED.module,
    action = EXCLUDED.action,
    label_en = EXCLUDED.label_en,
    label_bn = EXCLUDED.label_bn,
    sort_order = EXCLUDED.sort_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_admin_permission_catalog(jsonb) TO authenticated;
