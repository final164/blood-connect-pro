-- Enable guest Care/Video browse by default (matches soft-gate + anon SELECT migrations).
-- Admin can turn off via Settings → App or Care → Policies (app_settings.enable_guest).

ALTER TABLE public.app_settings
  ALTER COLUMN enable_guest SET DEFAULT true;

UPDATE public.app_settings
SET enable_guest = true
WHERE id = 1;
