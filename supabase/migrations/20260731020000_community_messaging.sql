-- Community org donor contact permissions + messaging templates / post icons

ALTER TABLE public.community_orgs
  ADD COLUMN IF NOT EXISTS donor_contact_settings JSONB NOT NULL DEFAULT '{
    "female": {"call": false, "sms": false, "chat": true},
    "male": {"call": true, "sms": true, "chat": true}
  }'::jsonb;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS messaging_settings JSONB;
