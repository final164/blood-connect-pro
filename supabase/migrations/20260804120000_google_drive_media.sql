-- Google Drive media + request post images
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS google_drive_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_settings
SET google_drive_settings = '{
  "enabled": false,
  "folder_id": "",
  "folder_requests": "",
  "folder_avatars": "",
  "folder_media": "",
  "make_public": true
}'::jsonb
WHERE id = 1
  AND (google_drive_settings IS NULL OR google_drive_settings = '{}'::jsonb OR NOT (google_drive_settings ? 'enabled'));

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS image_url TEXT;
