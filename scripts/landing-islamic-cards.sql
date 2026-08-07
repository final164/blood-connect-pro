-- Optional: enable islamic_carousel section flag in landing_settings.
-- Islamic cards are managed in Admin → Landing → Islamic (saved in landing_settings.islamic.cards).
-- No separate table required.

UPDATE public.app_settings
SET landing_settings =
  jsonb_set(
    jsonb_set(
      COALESCE(landing_settings, '{}'::jsonb),
      '{islamic}',
      COALESCE(
        landing_settings->'islamic',
        '{
          "title_bn": "ইসলামে জীবন রক্ষা ও সাহায্য",
          "title_en": "Saving lives in Islam",
          "body_bn": "রক্তদান একটি মানবিক ইবাদতের মতো — একজনের জীবন বাঁচানো মানেই মানবতার সেবা।",
          "body_en": "Blood donation is an act of mercy — saving one life serves humanity.",
          "cards": []
        }'::jsonb
      ),
      true
    ),
    '{sections_enabled,islamic_carousel}',
    'true'::jsonb,
    true
  )
WHERE id = 1;
