-- Create Serial tab ON by default (platform + org)

UPDATE public.app_settings
SET care_feature_flags = COALESCE(care_feature_flags, '{}'::jsonb)
  || jsonb_build_object(
    'desk_manual_patient_serial', true,
    'desk_allow_org_serial_settings', true,
    'desk_booking_field_name', true,
    'desk_booking_field_phone', true,
    'desk_booking_field_age', true,
    'desk_booking_field_address', true
  )
WHERE id = 1;

ALTER TABLE public.care_orgs
  ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.care_orgs
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{serial}',
  COALESCE(settings -> 'serial', '{}'::jsonb) || '{"manual_patient_serial": true}'::jsonb,
  true
);
