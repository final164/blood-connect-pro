-- Revert SEO site URL back to blood.pgdiary.cloud

UPDATE public.app_settings
SET seo_settings = COALESCE(seo_settings, '{}'::jsonb)
  || jsonb_build_object(
    'site_url', 'https://blood.pgdiary.cloud',
    'og_image_url', replace(COALESCE(seo_settings ->> 'og_image_url', ''), 'https://deltasheba.pgdiary.cloud', 'https://blood.pgdiary.cloud'),
    'twitter_image_url', replace(COALESCE(seo_settings ->> 'twitter_image_url', ''), 'https://deltasheba.pgdiary.cloud', 'https://blood.pgdiary.cloud'),
    'org_logo_url', replace(COALESCE(seo_settings ->> 'org_logo_url', ''), 'https://deltasheba.pgdiary.cloud', 'https://blood.pgdiary.cloud')
  )
WHERE id = 1;
