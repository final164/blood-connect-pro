-- Legal pages (Privacy Policy + Terms of Service) CMS
-- Stored as JSONB on the singleton public.app_settings row (id = 1),
-- same pattern as seo_settings / landing_settings. Public read is already
-- granted by the app_settings_anon_select policy; writes stay admin-only.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS legal_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Seed only when empty so re-running the migration never clobbers admin edits.
-- Content bodies are intentionally left to the app defaults in
-- src/lib/legal-settings.ts; this seed just marks both docs as enabled.
UPDATE public.app_settings
SET legal_settings = jsonb_build_object(
  'privacy', jsonb_build_object('enabled', true, 'effective_date', '2026-08-27'),
  'terms', jsonb_build_object('enabled', true, 'effective_date', '2026-08-27'),
  'contact_email', 'support@muktosheba.com',
  'contact_phone', '',
  'contact_address_bn', 'ঢাকা, বাংলাদেশ',
  'contact_address_en', 'Dhaka, Bangladesh'
)
WHERE id = 1
  AND (legal_settings IS NULL OR legal_settings = '{}'::jsonb OR NOT (legal_settings ? 'privacy'));
