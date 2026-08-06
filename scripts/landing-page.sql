-- Landing page CMS (public frontpage before login)
-- Run in Supabase SQL Editor if migration is not applied.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS landing_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_settings
SET landing_settings = '{
  "enabled": true,
  "theme": "life_crimson",
  "colors": {
    "primary": "#C1121F",
    "background": "#F7F3F0",
    "foreground": "#1A1210",
    "muted": "#6B5E58",
    "glass": "rgba(255,255,255,0.55)"
  },
  "seo": {
    "title_bn": "BloodLink — রক্তদানে জীবন বাঁচান",
    "title_en": "BloodLink — Save lives with blood donation",
    "description_bn": "রিয়েলটাইম ব্লাড ডোনার নেটওয়ার্ক — রক্তদাতা খুঁজুন, রিকোয়েস্ট পাঠান।",
    "description_en": "Realtime blood donor network — find donors, post requests.",
    "og_image_url": ""
  },
  "nav": {
    "logo_url": "",
    "show_lang_toggle": true,
    "cta_login_bn": "লগইন",
    "cta_login_en": "Log in",
    "cta_signup_bn": "সাইন আপ",
    "cta_signup_en": "Sign up",
    "links": [
      {"id": "how", "label_bn": "কীভাবে কাজ করে", "label_en": "How it works", "href": "#how"},
      {"id": "campaigns", "label_bn": "ক্যাম্পেইন", "label_en": "Campaigns", "href": "#campaigns"},
      {"id": "faq", "label_bn": "প্রশ্নোত্তর", "label_en": "FAQ", "href": "#faq"}
    ]
  },
  "hero": {
    "brand_bn": "BloodLink",
    "brand_en": "BloodLink",
    "headline_bn": "রক্তদান করুন, জীবন বাঁচান",
    "headline_en": "Donate blood. Save lives.",
    "sub_bn": "আপনার এলাকার জরুরি রক্তের চাহিদা দেখুন এবং এক ক্লিকে সাহায্য করুন।",
    "sub_en": "See urgent blood needs near you and help with one tap.",
    "cta_primary_bn": "শুরু করুন",
    "cta_primary_en": "Get started",
    "cta_primary_href": "/auth",
    "cta_secondary_bn": "লগইন",
    "cta_secondary_en": "Log in",
    "cta_secondary_href": "/auth",
    "background_url": "/landing/hero.jpg",
    "background_images": ["/landing/hero.jpg", "/landing/arm-donate.jpg", "/landing/bags.jpg"],
    "slideshow": {
      "enabled": true,
      "interval_ms": 5500,
      "transition_ms": 900,
      "transition": "crossfade",
      "ken_burns": false,
      "overlay_opacity": 75,
      "pause_on_hover": false,
      "show_dots": true
    },
    "background_video_url": "",
    "youtube": {
      "enabled": true,
      "url": "https://www.youtube.com/watch?v=hjyZX-LIacM",
      "title_bn": "রক্তদানের গল্প দেখুন",
      "title_en": "Watch our donation story",
      "body_bn": "ক্লিক করুন — YouTube-এ না গিয়েই ভিডিও চলবে।",
      "body_en": "Click to play — watch without leaving this page.",
      "poster_url": "",
      "autoplay_on_click": true
    }
  },
  "community": {
    "title_bn": "আমাদের কমিউনিটি",
    "title_en": "Our community",
    "body_bn": "জেলাভিত্তিক সংস্থা ও স্বেচ্ছাসেবী রক্তদাতারা একসাথে কাজ করে।",
    "body_en": "District organizations and volunteer donors working together.",
    "background_url": "",
    "pull_orgs": true,
    "cta_bn": "রক্তদাতা খুঁজুন",
    "cta_en": "Find donors",
    "cta_href": "/auth"
  },
  "cta_band": {
    "title_bn": "আজই একজনের জীবন বদলান",
    "title_en": "Change a life today",
    "body_bn": "অ্যাকাউন্ট খুলুন এবং আপনার এলাকার রিকোয়েস্ট দেখুন।",
    "body_en": "Create an account and see requests in your area.",
    "background_url": "",
    "primary_bn": "সাইন আপ",
    "primary_en": "Sign up",
    "primary_href": "/auth",
    "secondary_bn": "আরও জানুন",
    "secondary_en": "Learn more",
    "secondary_href": "#how"
  },
  "footer": {
    "copyright_bn": "© BloodLink. সবাইকে রক্তদানের অধিকার।",
    "copyright_en": "© BloodLink. Blood donation for everyone.",
    "hotline": "",
    "columns": [
      {
        "title_bn": "লিংক",
        "title_en": "Links",
        "links": [
          {"label_bn": "লগইন", "label_en": "Log in", "href": "/auth"},
          {"label_bn": "প্রশ্নোত্তর", "label_en": "FAQ", "href": "#faq"}
        ]
      }
    ],
    "social": []
  },
  "section_order": ["nav","hero","stats","how_it_works","campaigns","community","gallery","stories_carousel","faq","cta_band","footer"],
  "sections_enabled": {
    "nav": true,
    "hero": true,
    "stats": true,
    "how_it_works": true,
    "campaigns": true,
    "community": true,
    "gallery": true,
    "stories_carousel": true,
    "faq": true,
    "cta_band": true,
    "footer": true
  }
}'::jsonb
WHERE id = 1
  AND (landing_settings IS NULL OR landing_settings = '{}'::jsonb OR NOT (landing_settings ? 'enabled'));

-- ============ TABLES ============

CREATE TABLE IF NOT EXISTS public.landing_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label_bn TEXT NOT NULL DEFAULT '',
  label_en TEXT NOT NULL DEFAULT '',
  value_text TEXT NOT NULL DEFAULT '0',
  icon_key TEXT NOT NULL DEFAULT 'droplet',
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','live_donors','live_requests')),
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landing_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'how' CHECK (kind IN ('how','feature')),
  title_bn TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  body_bn TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  icon_key TEXT NOT NULL DEFAULT 'heart',
  image_url TEXT,
  link_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landing_carousel_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL DEFAULT 'main' CHECK (kind IN ('main','stories')),
  image_url TEXT NOT NULL DEFAULT '',
  title_bn TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  body_bn TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landing_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_bn TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  body_bn TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  cover_url TEXT,
  starts_on DATE,
  ends_on DATE,
  cta_bn TEXT NOT NULL DEFAULT '',
  cta_en TEXT NOT NULL DEFAULT '',
  cta_href TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landing_gallery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL DEFAULT '',
  caption_bn TEXT NOT NULL DEFAULT '',
  caption_en TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landing_faqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_bn TEXT NOT NULL DEFAULT '',
  question_en TEXT NOT NULL DEFAULT '',
  answer_bn TEXT NOT NULL DEFAULT '',
  answer_en TEXT NOT NULL DEFAULT '',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.landing_community_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_bn TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  body_bn TEXT NOT NULL DEFAULT '',
  body_en TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  link_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS landing_stats_sort_idx ON public.landing_stats (sort_order);
CREATE INDEX IF NOT EXISTS landing_cards_sort_idx ON public.landing_cards (kind, sort_order);
CREATE INDEX IF NOT EXISTS landing_carousel_sort_idx ON public.landing_carousel_slides (kind, sort_order);
CREATE INDEX IF NOT EXISTS landing_campaigns_sort_idx ON public.landing_campaigns (sort_order);
CREATE INDEX IF NOT EXISTS landing_gallery_sort_idx ON public.landing_gallery (sort_order);
CREATE INDEX IF NOT EXISTS landing_faqs_sort_idx ON public.landing_faqs (sort_order);
CREATE INDEX IF NOT EXISTS landing_community_cards_sort_idx ON public.landing_community_cards (sort_order);

-- RLS
ALTER TABLE public.landing_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_carousel_slides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.landing_community_cards ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'landing_stats','landing_cards','landing_carousel_slides','landing_campaigns',
    'landing_gallery','landing_faqs','landing_community_cards'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I_public_read ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_public_read ON public.%I FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), ''admin''))',
      t, t
    );
    EXECUTE format('DROP POLICY IF EXISTS %I_admin_all ON public.%I', t, t);
    EXECUTE format(
      'CREATE POLICY %I_admin_all ON public.%I FOR ALL USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))',
      t, t
    );
  END LOOP;
END $$;

-- Seed content (only if empty)
INSERT INTO public.landing_stats (label_bn, label_en, value_text, icon_key, source, sort_order)
SELECT * FROM (VALUES
  ('সক্রিয় রক্তদাতা', 'Active donors', '1,200+', 'users', 'manual', 0),
  ('খোলা রিকোয়েস্ট', 'Open requests', '—', 'droplet', 'live_requests', 1),
  ('সংস্থা', 'Organizations', '40+', 'building', 'manual', 2)
) AS v(label_bn, label_en, value_text, icon_key, source, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.landing_stats LIMIT 1);

INSERT INTO public.landing_cards (kind, title_bn, title_en, body_bn, body_en, icon_key, sort_order)
SELECT * FROM (VALUES
  ('how', 'প্রোফাইল তৈরি করুন', 'Create your profile', 'মোবাইল ও PIN দিয়ে দ্রুত অ্যাকাউন্ট খুলুন।', 'Sign up quickly with mobile and PIN.', 'user', 0),
  ('how', 'রিকোয়েস্ট দেখুন', 'See requests', 'আপনার জেলার জরুরি রক্তের চাহিদা ফিডে আসবে।', 'Urgent needs in your district appear in the feed.', 'bell', 1),
  ('how', 'সাহায্য করুন', 'Help someone', 'কল, চ্যাট বা দান নিশ্চিত করে জীবন বাঁচান।', 'Call, chat, or confirm a donation to save a life.', 'heart', 2)
) AS v(kind, title_bn, title_en, body_bn, body_en, icon_key, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.landing_cards LIMIT 1);

INSERT INTO public.landing_faqs (question_bn, question_en, answer_bn, answer_en, sort_order)
SELECT * FROM (VALUES
  ('BloodLink কি?', 'What is BloodLink?', 'একটি রিয়েলটাইম রক্তদান নেটওয়ার্ক যেখানে রিকোয়েস্ট ও রক্তদাতারা এক জায়গায় মিলিত হয়।', 'A realtime blood donation network connecting requests and donors.', 0),
  ('কীভাবে রক্তদাতা হবো?', 'How do I become a donor?', 'সাইন আপ করে প্রোফাইলে রক্তের গ্রুপ ও লোকেশন দিন, তারপর ফিডে সাড়া দিন।', 'Sign up, set blood group and location on your profile, then respond on the feed.', 1),
  ('কমিউনিটি সংস্থা কী?', 'What are community organizations?', 'অ্যাডমিন-যাচাইকৃত স্থানীয় সংস্থা যারা রক্তদাতার তালিকা রাখে।', 'Admin-verified local orgs that maintain donor directories.', 2)
) AS v(question_bn, question_en, answer_bn, answer_en, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.landing_faqs LIMIT 1);

INSERT INTO public.landing_campaigns (title_bn, title_en, body_bn, body_en, cta_bn, cta_en, cta_href, sort_order)
SELECT * FROM (VALUES
  ('জরুরি ও নেগেটিভ ক্যাম্পেইন', 'Urgent O-negative drive', 'ও নেগেটিভ রক্তদাতাদের অগ্রাধিকার দিয়ে সাহায্য করুন।', 'Prioritize O-negative donors this week.', 'যোগ দিন', 'Join', '/auth', 0)
) AS v(title_bn, title_en, body_bn, body_en, cta_bn, cta_en, cta_href, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.landing_campaigns LIMIT 1);

INSERT INTO public.landing_community_cards (title_bn, title_en, body_bn, body_en, sort_order)
SELECT * FROM (VALUES
  ('জেলা সংস্থা', 'District orgs', 'স্থানীয় যাচাইকৃত সংস্থা।', 'Verified local organizations.', 0),
  ('স্বেচ্ছাসেবী', 'Volunteers', 'সক্রিয় রক্তদাতা নেটওয়ার্ক।', 'Active donor network.', 1),
  ('হাসপাতাল পার্টনার', 'Hospital partners', 'জরুরি চাহিদা দ্রুত পূরণ।', 'Faster urgent fulfillment.', 2)
) AS v(title_bn, title_en, body_bn, body_en, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.landing_community_cards LIMIT 1);

-- Public read of landing_settings for anon (frontpage)
DROP POLICY IF EXISTS app_settings_landing_public ON public.app_settings;
-- Keep existing authenticated select; allow anon select of landing row for frontpage
DROP POLICY IF EXISTS app_settings_anon_select ON public.app_settings;
CREATE POLICY app_settings_anon_select ON public.app_settings
  FOR SELECT TO anon, authenticated
  USING (id = 1);
