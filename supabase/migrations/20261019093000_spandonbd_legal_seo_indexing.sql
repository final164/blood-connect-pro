-- Spandon (spandonbd.com) indexing readiness: legal contact + SEO index flags
-- Does not wipe custom admin legal section bodies; only patches contact / indexing essentials.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS legal_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_settings
SET
  legal_settings = COALESCE(legal_settings, '{}'::jsonb)
    || jsonb_build_object(
      'contact_email', 'support@spandonbd.com',
      'contact_address_bn', 'ঢাকা, বাংলাদেশ',
      'contact_address_en', 'Dhaka, Bangladesh',
      'privacy', COALESCE(legal_settings->'privacy', '{}'::jsonb)
        || jsonb_build_object('enabled', true, 'effective_date', '2026-10-19'),
      'terms', COALESCE(legal_settings->'terms', '{}'::jsonb)
        || jsonb_build_object('enabled', true, 'effective_date', '2026-10-19')
    ),
  seo_settings = COALESCE(seo_settings, '{}'::jsonb)
    || jsonb_build_object(
      'site_url', 'https://spandonbd.com',
      'robots_index', true,
      'robots_follow', true,
      'sitemap_enabled', true,
      'json_ld_enabled', true,
      'canonical_url', '/',
      'org_name', 'স্পন্দন (Spandon)',
      'org_logo_url', 'https://spandonbd.com/spandon-logo.jpg',
      'og_image_url', 'https://spandonbd.com/landing/hero.jpg',
      'twitter_image_url', 'https://spandonbd.com/landing/hero.jpg'
    )
WHERE id = 1;
