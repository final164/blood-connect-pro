-- Blood Donor AI settings (separate from Care Gemini features)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS blood_donor_ai_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.app_settings.blood_donor_ai_settings IS
  'Blood Donor AI chat: intents, slots, filters, prompts, entry points';

UPDATE public.app_settings
SET blood_donor_ai_settings = COALESCE(blood_donor_ai_settings, '{}'::jsonb)
WHERE id = 1;
