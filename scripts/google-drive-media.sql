-- Google Drive media + request post images + admin-managed service account
-- Run in Supabase SQL Editor if migration is not applied.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS google_drive_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_settings
SET google_drive_settings = '{
  "enabled": false,
  "folder_id": "",
  "folder_requests": "",
  "folder_avatars": "",
  "folder_media": "",
  "make_public": true,
  "image_input_mode": "both",
  "allow_profile_image": true,
  "allow_post_image": true
}'::jsonb
WHERE id = 1
  AND (google_drive_settings IS NULL OR google_drive_settings = '{}'::jsonb OR NOT (google_drive_settings ? 'enabled'));


ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Secrets table: NEVER expose to anon. Admin-only via has_role.
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

-- Ensure anon cannot read secrets even if misconfigured later
REVOKE ALL ON public.google_drive_secrets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.google_drive_secrets TO authenticated;
