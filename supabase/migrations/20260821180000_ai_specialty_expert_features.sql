-- Enable AI specialty suggestions + expert analysis defaults in gemini_settings

UPDATE public.app_settings
SET gemini_settings = COALESCE(gemini_settings, '{}'::jsonb)
  || jsonb_build_object(
    'max_specialties', COALESCE((gemini_settings ->> 'max_specialties')::int, 3),
    'features', COALESCE(gemini_settings -> 'features', '{}'::jsonb) || jsonb_build_object(
      'specialty_suggestions', COALESCE((gemini_settings -> 'features' ->> 'specialty_suggestions')::boolean, true),
      'expert_analysis', COALESCE((gemini_settings -> 'features' ->> 'expert_analysis')::boolean, true)
    ),
    'ui', COALESCE(gemini_settings -> 'ui', '{}'::jsonb) || jsonb_build_object(
      'specialty_heading_bn', COALESCE(gemini_settings -> 'ui' ->> 'specialty_heading_bn', 'কোন বিশেষজ্ঞ দেখাবেন'),
      'specialty_heading_en', COALESCE(gemini_settings -> 'ui' ->> 'specialty_heading_en', 'Which specialist to see'),
      'expert_heading_bn', COALESCE(gemini_settings -> 'ui' ->> 'expert_heading_bn', 'বিশেষজ্ঞ-পর্যায়ের বিশ্লেষণ'),
      'expert_heading_en', COALESCE(gemini_settings -> 'ui' ->> 'expert_heading_en', 'Expert-level analysis'),
      'specialty_cta_bn', COALESCE(gemini_settings -> 'ui' ->> 'specialty_cta_bn', 'ডাক্তার খুঁজুন'),
      'specialty_cta_en', COALESCE(gemini_settings -> 'ui' ->> 'specialty_cta_en', 'Find doctors')
    )
  )
WHERE id = 1;
