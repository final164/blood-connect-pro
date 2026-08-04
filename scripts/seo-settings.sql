-- Site-wide SEO settings (admin Settings → SEO)
-- Run in Supabase SQL Editor if migration is not applied.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS seo_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_settings
SET seo_settings = '{
  "site_url": "",
  "title_bn": "BloodLink — রক্তদানে জীবন বাঁচান",
  "title_en": "BloodLink — Save lives with blood donation",
  "title_template": "%s — BloodLink",
  "description_bn": "রিয়েলটাইম ব্লাড ডোনার নেটওয়ার্ক — রক্তদাতা খুঁজুন, জরুরি রক্তের রিকোয়েস্ট পাঠান, এন্ড-টু-এন্ড এনক্রিপ্টেড চ্যাট। বাংলাদেশ জুড়ে রক্তদানে সাহায্য করুন।",
  "description_en": "Realtime blood donor network — find donors, post urgent blood requests, and chat securely. Help save lives across Bangladesh.",
  "keywords_bn": "রক্তদান, রক্তদাতা, ব্লাড ডোনার, জরুরি রক্ত, বাংলাদেশ, BloodLink, রক্তের গ্রুপ, হাসপাতাল",
  "keywords_en": "blood donation, blood donor, Bangladesh, urgent blood, BloodLink, blood group, hospital, plasma",
  "og_title_bn": "BloodLink — রক্তদানে জীবন বাঁচান",
  "og_title_en": "BloodLink — Save lives with blood donation",
  "og_description_bn": "রিয়েলটাইম ব্লাড ডোনার নেটওয়ার্ক — রক্তদাতা খুঁজুন, রিকোয়েস্ট পাঠান, এন্ড-টু-এন্ড এনক্রিপ্টেড চ্যাট।",
  "og_description_en": "Realtime blood donor social network with E2EE chat and live map across Bangladesh.",
  "og_image_url": "/icon-512.png",
  "og_type": "website",
  "twitter_card": "summary_large_image",
  "twitter_title": "BloodLink — Save lives with blood donation",
  "twitter_description": "Find blood donors, post urgent requests, and connect securely across Bangladesh.",
  "twitter_image_url": "/icon-512.png",
  "robots_index": true,
  "robots_follow": true,
  "canonical_url": "",
  "hreflang_bn": "/",
  "hreflang_en": "/?lang=en",
  "google_site_verification": "",
  "bing_site_verification": "",
  "json_ld_enabled": true,
  "org_name": "BloodLink",
  "org_logo_url": "/icon-512.png",
  "org_phone": "",
  "org_same_as": [],
  "robots_txt": "",
  "sitemap_enabled": true,
  "sitemap_extra_paths": []
}'::jsonb
WHERE id = 1
  AND (seo_settings IS NULL OR seo_settings = '{}'::jsonb OR NOT (seo_settings ? 'title_bn'));
