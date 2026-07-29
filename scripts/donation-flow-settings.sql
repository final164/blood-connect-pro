-- Run in Supabase SQL Editor if needed.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS donation_flow_settings JSONB NOT NULL DEFAULT '{
    "max_assigned_donors": 5,
    "enable_i_can_donate": true
  }'::jsonb;

UPDATE public.app_settings
SET donation_flow_settings = COALESCE(
  donation_flow_settings,
  '{"max_assigned_donors": 5, "enable_i_can_donate": true}'::jsonb
)
WHERE id = 1;
