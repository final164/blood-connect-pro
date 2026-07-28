-- Request form options + WhatsApp + nullable contact
-- Run in Supabase SQL Editor

ALTER TABLE public.blood_requests
  ALTER COLUMN contact_phone DROP NOT NULL;

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS request_form_options JSONB NOT NULL DEFAULT '{
    "patient_name": false,
    "blood_group": false,
    "bags_needed": false,
    "district": false,
    "hospital": false,
    "contact_phone": true,
    "whatsapp": true,
    "needed_by": true,
    "urgency": false,
    "notes": true
  }'::jsonb;

UPDATE public.app_settings
SET request_form_options = COALESCE(request_form_options, '{
  "patient_name": false,
  "blood_group": false,
  "bags_needed": false,
  "district": false,
  "hospital": false,
  "contact_phone": true,
  "whatsapp": true,
  "needed_by": true,
  "urgency": false,
  "notes": true
}'::jsonb)
WHERE id = 1;
