-- Run in Supabase SQL Editor if needed (column already exists; JSON shape is app-normalized).
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS donation_flow_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Optional: seed richer defaults when empty object
UPDATE public.app_settings
SET donation_flow_settings = '{
  "max_assigned_donors": 5,
  "show_progress": true,
  "enable_assign": true,
  "enable_confirm": true,
  "enable_i_can_donate": true,
  "enable_i_donated": true,
  "require_complete_first": true
}'::jsonb
WHERE id = 1
  AND (
    donation_flow_settings IS NULL
    OR donation_flow_settings = '{}'::jsonb
    OR NOT (donation_flow_settings ? 'show_progress')
  );
