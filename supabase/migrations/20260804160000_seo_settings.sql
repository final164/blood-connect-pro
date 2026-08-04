-- Site-wide SEO settings
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS seo_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_settings
SET seo_settings = '{
  "site_url": "https://blood.pgdiary.cloud",
  "title_bn": "BloodLink — রক্তদাতা খুঁজুন, রক্তদান করুন, জীবন বাঁচান",
  "title_en": "BloodLink — Find blood donors and save lives in Bangladesh",
  "title_template": "%s — BloodLink",
  "description_bn": "BloodLink বাংলাদেশজুড়ে রিয়েলটাইম ব্লাড ডোনার নেটওয়ার্ক। রক্তদাতা খুঁজুন, জরুরি রক্তের রিকোয়েস্ট দিন, হাসপাতাল ও জেলা অনুযায়ী রক্তদান সহায়তা পান।",
  "description_en": "BloodLink is a Bangladesh-wide realtime blood donor network. Find blood donors, post urgent blood requests, and connect by district and hospital to save lives faster.",
  "keywords_bn": "রক্তদান, রক্তদাতা, ব্লাড ডোনার, জরুরি রক্ত, বাংলাদেশ, BloodLink, রক্তের গ্রুপ, হাসপাতাল, জেলা ভিত্তিক রক্তদাতা, রক্ত খুঁজুন",
  "keywords_en": "blood donation, blood donor, Bangladesh, urgent blood, BloodLink, blood group, hospital, district donor, find blood donor",
  "og_title_bn": "BloodLink — রক্তদাতা খুঁজুন, রক্তদান করুন",
  "og_title_en": "BloodLink — Find blood donors in Bangladesh",
  "og_description_bn": "রিয়েলটাইম ব্লাড ডোনার নেটওয়ার্ক — রক্তদাতা খুঁজুন, রিকোয়েস্ট পাঠান, এন্ড-টু-এন্ড এনক্রিপ্টেড চ্যাট।",
  "og_description_en": "Realtime blood donor social network with E2EE chat and live map across Bangladesh.",
  "og_image_url": "https://blood.pgdiary.cloud/icon-512.png",
  "og_type": "website",
  "twitter_card": "summary_large_image",
  "twitter_title": "BloodLink — Find blood donors and save lives in Bangladesh",
  "twitter_description": "Find blood donors, post urgent requests, and get district and hospital based blood support across Bangladesh.",
  "twitter_image_url": "https://blood.pgdiary.cloud/icon-512.png",
  "robots_index": true,
  "robots_follow": true,
  "canonical_url": "/",
  "hreflang_bn": "/",
  "hreflang_en": "/?lang=en",
  "google_site_verification": "",
  "bing_site_verification": "",
  "json_ld_enabled": true,
  "org_name": "BloodLink",
  "org_logo_url": "https://blood.pgdiary.cloud/icon-512.png",
  "org_phone": "",
  "org_same_as": [],
  "robots_txt": "",
  "sitemap_enabled": true,
  "sitemap_extra_paths": []
}'::jsonb
WHERE id = 1
  AND (seo_settings IS NULL OR seo_settings = '{}'::jsonb OR NOT (seo_settings ? 'title_bn'));
