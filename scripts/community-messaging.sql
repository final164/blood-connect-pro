-- Community org donor contact permissions + messaging templates / post icons
-- donor_contact_settings: settings[viewerGender][donorGender] = { call, sms, chat }

ALTER TABLE public.community_orgs
  ADD COLUMN IF NOT EXISTS donor_contact_settings JSONB NOT NULL DEFAULT '{
    "male": {
      "male": {"call": true, "sms": true, "chat": true},
      "female": {"call": false, "sms": false, "chat": true}
    },
    "female": {
      "male": {"call": true, "sms": true, "chat": true},
      "female": {"call": false, "sms": false, "chat": true}
    }
  }'::jsonb;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS messaging_settings JSONB;
