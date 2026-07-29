-- Need-reason / disease categories + note suggestions (admin JSON catalog)
-- Also stores selected reason on each blood request.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS need_reason_catalog JSONB NOT NULL DEFAULT '{"categories":[]}'::jsonb;

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS need_reason_key TEXT,
  ADD COLUMN IF NOT EXISTS need_reason_label TEXT;

COMMENT ON COLUMN public.app_settings.need_reason_catalog IS
  'JSON catalog of blood-need reasons/disease categories with bilingual note suggestions';
COMMENT ON COLUMN public.blood_requests.need_reason_key IS
  'Selected need-reason category id (or custom)';
COMMENT ON COLUMN public.blood_requests.need_reason_label IS
  'Display label for need reason at time of posting';

UPDATE public.app_settings
SET need_reason_catalog = COALESCE(need_reason_catalog, '{"categories":[]}'::jsonb)
WHERE id = 1;
