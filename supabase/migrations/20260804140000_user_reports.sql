-- User complain / report → Admin Reports inbox

CREATE TABLE IF NOT EXISTS public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('bug', 'abuse', 'spam', 'complaint', 'suggestion', 'other')),
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved', 'dismissed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_reports_created_idx
  ON public.user_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS user_reports_status_idx
  ON public.user_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS user_reports_user_idx
  ON public.user_reports (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.set_user_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS user_reports_set_updated_at ON public.user_reports;
CREATE TRIGGER user_reports_set_updated_at
  BEFORE UPDATE ON public.user_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_reports_updated_at();

GRANT SELECT, INSERT ON public.user_reports TO authenticated;
GRANT UPDATE, DELETE ON public.user_reports TO authenticated;
GRANT ALL ON public.user_reports TO service_role;

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_reports_select" ON public.user_reports;
CREATE POLICY "user_reports_select" ON public.user_reports
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS "user_reports_insert" ON public.user_reports;
CREATE POLICY "user_reports_insert" ON public.user_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_reports_update" ON public.user_reports;
CREATE POLICY "user_reports_update" ON public.user_reports
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS "user_reports_delete" ON public.user_reports;
CREATE POLICY "user_reports_delete" ON public.user_reports
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  );

ALTER TABLE public.user_reports REPLICA IDENTITY FULL;

INSERT INTO public.admin_permissions (key, module, action, label_en, label_bn, sort_order) VALUES
  ('reports.view', 'reports', 'view', 'View reports', 'রিপোর্ট দেখা', 85),
  ('reports.edit', 'reports', 'edit', 'Update report status', 'রিপোর্ট স্ট্যাটাস', 86),
  ('reports.delete', 'reports', 'delete', 'Delete reports', 'রিপোর্ট ডিলিট', 87)
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
  AND p.key LIKE 'reports.%'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.slug = 'moderator'
  AND p.key LIKE 'reports.%'
ON CONFLICT DO NOTHING;

INSERT INTO public.admin_role_permissions (role_id, permission_key)
SELECT r.id, p.key
FROM public.admin_roles r
CROSS JOIN public.admin_permissions p
WHERE r.slug = 'support'
  AND p.key LIKE 'reports.%'
ON CONFLICT DO NOTHING;
