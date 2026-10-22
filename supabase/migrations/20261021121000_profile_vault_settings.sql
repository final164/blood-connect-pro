-- Admin-controlled profile life-network vault (JSON on app_settings).
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS profile_vault_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_settings
SET profile_vault_settings = '{
  "enabled": true,
  "show_on_own": true,
  "show_on_public": true,
  "use_avatar": true,
  "use_post_photos": true,
  "use_requests": true,
  "use_people": true,
  "use_stats": true,
  "show_waveform": true,
  "show_circuit": true,
  "animate": true,
  "max_photos": 8,
  "badge_bn": "লাইফ নেটওয়ার্ক",
  "badge_en": "LIFE NETWORK",
  "title_bn": "{name}",
  "title_en": "{name}",
  "subtitle_bn": "{photos} ছবি · {people} সংযোগ · {donations} দান",
  "subtitle_en": "{photos} photos · {people} links · {donations} donations"
}'::jsonb
WHERE id = 1
  AND (
    profile_vault_settings IS NULL
    OR profile_vault_settings = '{}'::jsonb
    OR NOT (profile_vault_settings ? 'enabled')
  );

UPDATE public.app_settings
SET profile_vault_settings = profile_vault_settings || '{
  "use_requests": true,
  "use_people": true,
  "use_stats": true
}'::jsonb
WHERE id = 1
  AND NOT (profile_vault_settings ? 'use_requests');

UPDATE public.app_settings
SET profile_vault_settings = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        profile_vault_settings,
        '{subtitle_bn}',
        to_jsonb('{photos} ছবি · {people} সংযোগ · {donations} দান'::text)
      ),
      '{subtitle_en}',
      to_jsonb('{photos} photos · {people} links · {donations} donations'::text)
    ),
    '{title_bn}',
    to_jsonb('{name}'::text)
  ),
  '{title_en}',
  to_jsonb('{name}'::text)
)
WHERE id = 1
  AND profile_vault_settings->>'subtitle_bn' = 'প্রোফাইল ও পোস্টের ছবি এক ভল্টে';
