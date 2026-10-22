-- Google still ranks the old name Muktosheba. Point titles and stored copy at Spandon / spandonbd.

UPDATE public.app_settings
SET seo_settings = (
  replace(
    replace(
      replace(COALESCE(seo_settings, '{}'::jsonb)::text, 'Muktosheba', 'Spandon'),
      'muktosheba',
      'spandonbd'
    ),
    'মুক্তসেবা',
    'স্পন্দন'
  )
)::jsonb
WHERE id = 1;

UPDATE public.app_settings
SET landing_settings = (
  replace(
    replace(
      replace(landing_settings::text, 'Muktosheba', 'Spandon'),
      'muktosheba',
      'spandonbd'
    ),
    'মুক্তসেবা',
    'স্পন্দন'
  )
)::jsonb
WHERE id = 1
  AND landing_settings IS NOT NULL;

UPDATE public.app_settings
SET seo_settings = COALESCE(seo_settings, '{}'::jsonb) || jsonb_build_object(
  'site_url', 'https://spandonbd.com',
  'org_name', 'স্পন্দন (Spandon)',
  'title_bn', 'স্পন্দন (Spandon) — spandonbd.com | বাংলাদেশে রক্তদাতা খুঁজুন',
  'title_en', 'Spandon (spandonbd.com) — Find blood donors in Bangladesh',
  'title_template', '%s — স্পন্দন',
  'description_bn', 'জরুরি রক্ত লাগবে? বাংলাদেশে জেলাভিত্তিক রক্তদাতা খুঁজুন, ব্লাড ডোনার দেখুন এবং রিকোয়েস্ট দিন। ঢাকা, চট্টগ্রামসহ A+ B+ O+ AB+ ও O- ডোনার — বিনামূল্যে, স্পন্দন (spandonbd.com)।',
  'description_en', 'Urgent blood needed in Bangladesh? Find a blood donor by district, see A+ B+ O+ AB+ and O- donors, and post a request free on Spandon (spandonbd.com).',
  'keywords_bn', 'স্পন্দন, Spandon, spandonbd, spandonbd.com, রক্তদাতা খুঁজুন, জরুরি রক্ত লাগবে, ব্লাড ডোনার বাংলাদেশ, রক্তদান বাংলাদেশ, ঢাকায় রক্তদাতা, চট্টগ্রাম রক্তদাতা',
  'keywords_en', 'Spandon, spandon, spandonbd, spandonbd.com, find blood donor Bangladesh, blood donation Bangladesh, blood donor Dhaka',
  'og_title_bn', 'স্পন্দন (Spandon) — spandonbd.com',
  'og_title_en', 'Spandon — spandonbd.com',
  'twitter_title', 'Spandon (spandonbd.com) — Find blood donors in Bangladesh'
)
WHERE id = 1;

UPDATE public.app_settings
SET landing_settings = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        landing_settings,
        '{hero,brand_bn}',
        to_jsonb('স্পন্দন'::text)
      ),
      '{hero,brand_en}',
      to_jsonb('Spandon'::text)
    ),
    '{seo,title_bn}',
    to_jsonb('স্পন্দন (Spandon) — spandonbd.com | বাংলাদেশে রক্তদাতা খুঁজুন'::text)
  ),
  '{seo,title_en}',
  to_jsonb('Spandon (spandonbd.com) — Find blood donors in Bangladesh'::text)
)
WHERE id = 1
  AND landing_settings IS NOT NULL;
