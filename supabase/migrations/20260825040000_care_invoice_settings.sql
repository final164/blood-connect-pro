-- Platform Cash Memo / invoice template CMS
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS care_invoice_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.app_settings.care_invoice_settings IS
  'Care Cash Memo invoice template: labels, style, defaults (platform). Org overrides in care_orgs.settings.invoice';

UPDATE public.app_settings
SET care_invoice_settings = COALESCE(care_invoice_settings, '{}'::jsonb)
WHERE id = 1;
