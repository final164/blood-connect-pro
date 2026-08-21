-- AI: first_aid feature + admin-controlled chat persist days (client localStorage only)

UPDATE public.app_settings
SET gemini_settings = COALESCE(gemini_settings, '{}'::jsonb)
  || jsonb_build_object(
    'chat_persist_days', COALESCE((gemini_settings ->> 'chat_persist_days')::int, 7),
    'features', COALESCE(gemini_settings -> 'features', '{}'::jsonb) || jsonb_build_object(
      'first_aid', COALESCE((gemini_settings -> 'features' ->> 'first_aid')::boolean, true)
    ),
    'ui', COALESCE(gemini_settings -> 'ui', '{}'::jsonb) || jsonb_build_object(
      'first_aid_heading_bn', COALESCE(gemini_settings -> 'ui' ->> 'first_aid_heading_bn', 'প্রাথমিক চিকিৎসা'),
      'first_aid_heading_en', COALESCE(gemini_settings -> 'ui' ->> 'first_aid_heading_en', 'Primary first aid'),
      'first_aid_button_bn', COALESCE(gemini_settings -> 'ui' ->> 'first_aid_button_bn', 'প্রাথমিক চিকিৎসা'),
      'first_aid_button_en', COALESCE(gemini_settings -> 'ui' ->> 'first_aid_button_en', 'Primary first aid')
    )
  )
WHERE id = 1;







