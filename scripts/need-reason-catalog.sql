-- Run in Supabase SQL Editor if migrations are not applied automatically.
-- Need-reason categories + notes suggestions catalog; columns on blood_requests.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS need_reason_catalog JSONB NOT NULL DEFAULT '{"categories":[]}'::jsonb;

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS need_reason_key TEXT,
  ADD COLUMN IF NOT EXISTS need_reason_label TEXT;

UPDATE public.app_settings
SET need_reason_catalog = COALESCE(need_reason_catalog, '{"categories":[]}'::jsonb)
WHERE id = 1;
