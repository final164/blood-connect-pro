-- Optional: refresh landing_settings media + seed gallery/carousel when empty.
-- Safe to re-run. Does not wipe admin-customized non-empty URLs in content tables
-- (only inserts when those tables have zero rows).

-- Merge curated media into landing_settings when image fields are blank
UPDATE public.app_settings
SET landing_settings = landing_settings
  || jsonb_build_object(
    'seo', COALESCE(landing_settings->'seo', '{}'::jsonb) || jsonb_build_object(
      'og_image_url', CASE
        WHEN COALESCE(landing_settings#>>'{seo,og_image_url}', '') = ''
        THEN 'https://images.unsplash.com/photo-1615461066159-fea0960485d5?auto=format&fit=crop&w=1200&h=630&q=80'
        ELSE landing_settings#>>'{seo,og_image_url}'
      END
    ),
    'nav', COALESCE(landing_settings->'nav', '{}'::jsonb) || jsonb_build_object(
      'logo_url', CASE
        WHEN COALESCE(landing_settings#>>'{nav,logo_url}', '') = ''
        THEN '/icon-512.png'
        ELSE landing_settings#>>'{nav,logo_url}'
      END
    ),
    'hero', COALESCE(landing_settings->'hero', '{}'::jsonb) || jsonb_build_object(
      'background_url', CASE
        WHEN COALESCE(landing_settings#>>'{hero,background_url}', '') = ''
        THEN 'https://images.unsplash.com/photo-1615461066159-fea0960485d5?auto=format&fit=crop&w=1920&q=80'
        ELSE landing_settings#>>'{hero,background_url}'
      END,
      'cta_secondary_href', COALESCE(NULLIF(landing_settings#>>'{hero,cta_secondary_href}', ''), '#how')
    ),
    'community', COALESCE(landing_settings->'community', '{}'::jsonb) || jsonb_build_object(
      'background_url', CASE
        WHEN COALESCE(landing_settings#>>'{community,background_url}', '') = ''
        THEN 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=1920&q=80'
        ELSE landing_settings#>>'{community,background_url}'
      END
    ),
    'cta_band', COALESCE(landing_settings->'cta_band', '{}'::jsonb) || jsonb_build_object(
      'background_url', CASE
        WHEN COALESCE(landing_settings#>>'{cta_band,background_url}', '') = ''
        THEN 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1920&q=80'
        ELSE landing_settings#>>'{cta_band,background_url}'
      END
    ),
    'footer', COALESCE(landing_settings->'footer', '{}'::jsonb) || jsonb_build_object(
      'hotline', COALESCE(NULLIF(landing_settings#>>'{footer,hotline}', ''), '16263')
    )
  )
WHERE id = 1;

-- Carousel (main) — only if empty
INSERT INTO public.landing_carousel_slides (kind, image_url, title_bn, title_en, body_bn, body_en, link_url, sort_order)
SELECT * FROM (VALUES
  ('main'::text,
   'https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?auto=format&fit=crop&w=1600&q=80',
   'প্রতিটি ব্যাগ একটি জীবন', 'Every bag is a life',
   'নিয়মিত রক্তদান হাসপাতালের স্টক স্থিতিশীল রাখে।', 'Regular donation keeps hospital stocks steady.',
   '/auth', 0),
  ('main',
   'https://images.unsplash.com/photo-1579154204601-01588f351e67?auto=format&fit=crop&w=1600&q=80',
   'হাসপাতাল ও কমিউনিটি একসাথে', 'Hospitals and community, together',
   'পার্টনার হাসপাতাল ও স্থানীয় সংস্থা এক নেটওয়ার্কে।', 'Partner hospitals and local orgs on one network.',
   '#community', 1),
  ('main',
   'https://images.unsplash.com/photo-1551190822-a9333d79a5c3?auto=format&fit=crop&w=1600&q=80',
   'জরুরি মুহূর্তে দ্রুত ম্যাচ', 'Fast match when it matters',
   'গ্রুপ ও লোকেশন মিলিয়ে কাছের ডোনার খুঁজুন।', 'Match by group and location to find nearby donors.',
   '/auth', 2)
) AS v(kind, image_url, title_bn, title_en, body_bn, body_en, link_url, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.landing_carousel_slides WHERE kind = 'main');

-- Stories — only if empty
INSERT INTO public.landing_carousel_slides (kind, image_url, title_bn, title_en, body_bn, body_en, link_url, sort_order)
SELECT * FROM (VALUES
  ('stories'::text,
   'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1600&q=80',
   'প্রথমবার রক্তদান', 'My first donation',
   'ভয় পেয়েছিলাম — কিন্তু কেউ একজন বাঁচলো।', 'I was nervous — then someone lived.',
   '/auth', 0),
  ('stories',
   'https://images.unsplash.com/photo-1582750433449-648ed127bb54?auto=format&fit=crop&w=1600&q=80',
   'মধ্যরাতে রিকোয়েস্ট', 'A midnight request',
   'BloodLink নোটিফিকেশনে দেখে হাসপাতালে পৌঁছেছি।', 'A BloodLink alert got me to the hospital in time.',
   '#faq', 1)
) AS v(kind, image_url, title_bn, title_en, body_bn, body_en, link_url, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.landing_carousel_slides WHERE kind = 'stories');

-- Gallery — only if empty
INSERT INTO public.landing_gallery (image_url, caption_bn, caption_en, sort_order)
SELECT * FROM (VALUES
  ('https://images.unsplash.com/photo-1615461066159-fea0960485d5?auto=format&fit=crop&w=900&q=80', 'রক্তদান ক্যাম্প', 'Donation camp', 0),
  ('https://images.unsplash.com/photo-1581594693702-fbdc51b2763b?auto=format&fit=crop&w=900&q=80', 'স্বেচ্ছাসেবী দল', 'Volunteer team', 1),
  ('https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=900&q=80', 'হাসপাতাল পার্টনারশিপ', 'Hospital partnership', 2),
  ('https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?auto=format&fit=crop&w=900&q=80', 'রক্তদান ক্যাম্প', 'Donation camp', 3),
  ('https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&w=900&q=80', 'স্বেচ্ছাসেবী দল', 'Volunteer team', 4),
  ('https://images.unsplash.com/photo-1551190822-a9333d79a5c3?auto=format&fit=crop&w=900&q=80', 'হাসপাতাল পার্টনারশিপ', 'Hospital partnership', 5)
) AS v(image_url, caption_bn, caption_en, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.landing_gallery LIMIT 1);

-- Fill blank campaign covers
UPDATE public.landing_campaigns
SET cover_url = 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=900&q=80',
    cta_href = COALESCE(NULLIF(cta_href, ''), '/auth')
WHERE cover_url IS NULL OR cover_url = '';

-- Fill how-card images
UPDATE public.landing_cards c
SET image_url = v.url,
    link_url = COALESCE(NULLIF(c.link_url, ''), '/auth')
FROM (VALUES
  (0, 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80'),
  (1, 'https://images.unsplash.com/photo-1576091160550-2173dba07efd?auto=format&fit=crop&w=800&q=80'),
  (2, 'https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?auto=format&fit=crop&w=800&q=80')
) AS v(ord, url)
WHERE c.kind = 'how' AND c.sort_order = v.ord AND (c.image_url IS NULL OR c.image_url = '');

-- Community card images
UPDATE public.landing_community_cards c
SET image_url = v.url,
    link_url = COALESCE(NULLIF(c.link_url, ''), '/auth')
FROM (VALUES
  (0, 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=800&q=80'),
  (1, 'https://images.unsplash.com/photo-1469571486292-0ba58a3f068b?auto=format&fit=crop&w=800&q=80'),
  (2, 'https://images.unsplash.com/photo-1516574187841-cb9cc2ca948b?auto=format&fit=crop&w=800&q=80')
) AS v(ord, url)
WHERE c.sort_order = v.ord AND (c.image_url IS NULL OR c.image_url = '');
