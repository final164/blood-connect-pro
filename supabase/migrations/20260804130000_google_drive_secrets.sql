-- Admin-managed Google Drive service account secrets
CREATE TABLE IF NOT EXISTS public.google_drive_secrets (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  service_account_json TEXT NOT NULL DEFAULT '',
  client_email TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.google_drive_secrets (id, service_account_json, client_email)
VALUES (1, '', '')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.google_drive_secrets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS google_drive_secrets_admin_all ON public.google_drive_secrets;
CREATE POLICY google_drive_secrets_admin_all ON public.google_drive_secrets
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

REVOKE ALL ON public.google_drive_secrets FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_drive_secrets TO authenticated;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS google_drive_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS image_url TEXT;
