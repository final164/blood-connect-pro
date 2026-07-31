-- ============ DISTRICTS ============
CREATE TABLE IF NOT EXISTS public.districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS districts_active_idx ON public.districts (is_active, sort_order);
GRANT SELECT ON public.districts TO authenticated, anon;
GRANT ALL ON public.districts TO service_role;
ALTER TABLE public.districts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "districts_read" ON public.districts;
CREATE POLICY "districts_read" ON public.districts FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "districts_admin_all" ON public.districts;
CREATE POLICY "districts_admin_all" ON public.districts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_districts_updated ON public.districts;
CREATE TRIGGER trg_districts_updated BEFORE UPDATE ON public.districts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.districts (name_bn, name_en, slug, sort_order) VALUES
('ঢাকা','Dhaka','dhaka',1),('গাজীপুর','Gazipur','gazipur',2),('নারায়ণগঞ্জ','Narayanganj','narayanganj',3),
('টাঙ্গাইল','Tangail','tangail',4),('কিশোরগঞ্জ','Kishoreganj','kishoreganj',5),('মানিকগঞ্জ','Manikganj','manikganj',6),
('মুন্সিগঞ্জ','Munshiganj','munshiganj',7),('নরসিংদী','Narsingdi','narsingdi',8),('রাজবাড়ী','Rajbari','rajbari',9),
('ফরিদপুর','Faridpur','faridpur',10),('গোপালগঞ্জ','Gopalganj','gopalganj',11),('মাদারীপুর','Madaripur','madaripur',12),
('শরীয়তপুর','Shariatpur','shariatpur',13),('চট্টগ্রাম','Chattogram','chattogram',14),('কক্সবাজার','Cox''s Bazar','coxs-bazar',15),
('কুমিল্লা','Cumilla','cumilla',16),('ফেনী','Feni','feni',17),('নোয়াখালী','Noakhali','noakhali',18),
('লক্ষ্মীপুর','Lakshmipur','lakshmipur',19),('চাঁদপুর','Chandpur','chandpur',20),('ব্রাহ্মণবাড়িয়া','Brahmanbaria','brahmanbaria',21),
('রাঙ্গামাটি','Rangamati','rangamati',22),('খাগড়াছড়ি','Khagrachhari','khagrachhari',23),('বান্দরবান','Bandarban','bandarban',24),
('রাজশাহী','Rajshahi','rajshahi',25),('নাটোর','Natore','natore',26),('নওগাঁ','Naogaon','naogaon',27),
('চাঁপাইনবাবগঞ্জ','Chapainawabganj','chapainawabganj',28),('পাবনা','Pabna','pabna',29),('সিরাজগঞ্জ','Sirajganj','sirajganj',30),
('বগুড়া','Bogura','bogura',31),('জয়পুরহাট','Joypurhat','joypurhat',32),('খুলনা','Khulna','khulna',33),
('বাগেরহাট','Bagerhat','bagerhat',34),('সাতক্ষীরা','Satkhira','satkhira',35),('যশোর','Jashore','jashore',36),
('ঝিনাইদহ','Jhenaidah','jhenaidah',37),('মাগুরা','Magura','magura',38),('নড়াইল','Narail','narail',39),
('কুষ্টিয়া','Kushtia','kushtia',40),('চুয়াডাঙ্গা','Chuadanga','chuadanga',41),('মেহেরপুর','Meherpur','meherpur',42),
('বরিশাল','Barishal','barishal',43),('ভোলা','Bhola','bhola',44),('পটুয়াখালী','Patuakhali','patuakhali',45),
('পিরোজপুর','Pirojpur','pirojpur',46),('বরগুনা','Barguna','barguna',47),('ঝালকাঠি','Jhalokati','jhalokati',48),
('সিলেট','Sylhet','sylhet',49),('মৌলভীবাজার','Moulvibazar','moulvibazar',50),('হবিগঞ্জ','Habiganj','habiganj',51),
('সুনামগঞ্জ','Sunamganj','sunamganj',52),('রংপুর','Rangpur','rangpur',53),('দিনাজপুর','Dinajpur','dinajpur',54),
('নীলফামারী','Nilphamari','nilphamari',55),('গাইবান্ধা','Gaibandha','gaibandha',56),('কুড়িগ্রাম','Kurigram','kurigram',57),
('লালমনিরহাট','Lalmonirhat','lalmonirhat',58),('ঠাকুরগাঁও','Thakurgaon','thakurgaon',59),('পঞ্চগড়','Panchagarh','panchagarh',60),
('ময়মনসিংহ','Mymensingh','mymensingh',61),('জামালপুর','Jamalpur','jamalpur',62),('শেরপুর','Sherpur','sherpur',63),
('নেত্রকোণা','Netrokona','netrokona',64)
ON CONFLICT (slug) DO NOTHING;

-- ============ UPAZILAS ============
CREATE TABLE IF NOT EXISTS public.upazilas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (district_id, slug)
);
CREATE INDEX IF NOT EXISTS upazilas_district_idx ON public.upazilas (district_id, sort_order);
GRANT SELECT ON public.upazilas TO authenticated, anon;
GRANT ALL ON public.upazilas TO service_role;
ALTER TABLE public.upazilas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "upazilas_read" ON public.upazilas;
CREATE POLICY "upazilas_read" ON public.upazilas FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "upazilas_admin_all" ON public.upazilas;
CREATE POLICY "upazilas_admin_all" ON public.upazilas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_upazilas_updated ON public.upazilas;
CREATE TRIGGER trg_upazilas_updated BEFORE UPDATE ON public.upazilas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DISTRICT LINKS ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.blood_requests ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS posts_district_created_idx ON public.posts (district_id, created_at DESC);
CREATE INDEX IF NOT EXISTS requests_district_status_idx ON public.blood_requests (district_id, status);
ALTER TABLE public.blood_requests ALTER COLUMN city DROP NOT NULL;
ALTER TABLE public.blood_requests ALTER COLUMN city SET DEFAULT '';
ALTER TABLE public.blood_requests ALTER COLUMN contact_phone DROP NOT NULL;
ALTER TABLE public.blood_requests ADD COLUMN IF NOT EXISTS whatsapp_phone TEXT;
ALTER TABLE public.blood_requests ADD COLUMN IF NOT EXISTS need_reason_key TEXT;
ALTER TABLE public.blood_requests ADD COLUMN IF NOT EXISTS need_reason_label TEXT;

-- ============ CMS STRINGS ============
CREATE TABLE IF NOT EXISTS public.cms_strings (
  key TEXT PRIMARY KEY,
  value_bn TEXT NOT NULL DEFAULT '',
  value_en TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'ui',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cms_strings TO authenticated, anon;
GRANT ALL ON public.cms_strings TO service_role;
ALTER TABLE public.cms_strings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cms_read" ON public.cms_strings;
CREATE POLICY "cms_read" ON public.cms_strings FOR SELECT USING (true);
DROP POLICY IF EXISTS "cms_admin_write" ON public.cms_strings;
CREATE POLICY "cms_admin_write" ON public.cms_strings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.cms_strings (key, value_bn, value_en, category) VALUES
('appName','BloodLink','BloodLink','brand'),
('tagline','রক্তদানে জীবন বাঁচান','Save lives by donating blood','brand'),
('feed','ফিড','Feed','nav'),
('requests','রিকোয়েস্ট','Requests','nav'),
('community','কমিউনিটি','Community','nav'),
('chat','চ্যাট','Chat','nav'),
('profile','প্রোফাইল','Profile','nav'),
('district','জেলা','District','form'),
('searchDistrict','জেলা খুঁজুন…','Search district…','form'),
('share','শেয়ার','Share','feed'),
('comment','কমেন্ট','Comment','feed'),
('like','লাইক','Like','feed')
ON CONFLICT (key) DO NOTHING;

-- ============ COMMUNITY ORGS & DONORS ============
CREATE TABLE IF NOT EXISTS public.community_orgs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  name_bn TEXT,
  description TEXT,
  description_bn TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  logo_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.community_orgs TO authenticated, anon;
GRANT ALL ON public.community_orgs TO service_role;
ALTER TABLE public.community_orgs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "orgs_read" ON public.community_orgs;
CREATE POLICY "orgs_read" ON public.community_orgs FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "orgs_admin" ON public.community_orgs;
CREATE POLICY "orgs_admin" ON public.community_orgs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_orgs_updated ON public.community_orgs;
CREATE TRIGGER trg_orgs_updated BEFORE UPDATE ON public.community_orgs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.community_donors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES public.community_orgs(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  blood_group TEXT,
  district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  upazila TEXT,
  address TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS community_donors_org_idx ON public.community_donors (org_id);
CREATE INDEX IF NOT EXISTS community_donors_district_idx ON public.community_donors (district_id);
GRANT SELECT ON public.community_donors TO authenticated;
GRANT ALL ON public.community_donors TO service_role;
ALTER TABLE public.community_donors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "community_donors_read" ON public.community_donors;
CREATE POLICY "community_donors_read" ON public.community_donors FOR SELECT TO authenticated
  USING (
    (is_active = true AND EXISTS (SELECT 1 FROM public.community_orgs o WHERE o.id = org_id AND o.is_active = true))
    OR public.has_role(auth.uid(), 'admin')
  );
DROP POLICY IF EXISTS "community_donors_admin" ON public.community_donors;
CREATE POLICY "community_donors_admin" ON public.community_donors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============ APP SETTINGS EXPANSIONS ============
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS support_email TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS about_bn TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS about_en TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS require_auth BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS enable_guest BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS brand_primary TEXT DEFAULT '#C62828';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS architecture_md TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS user_menu_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS donation_flow_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS need_reason_catalog JSONB NOT NULL DEFAULT '{"categories":[]}'::jsonb;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS request_form_options JSONB NOT NULL DEFAULT '{
    "patient_name": false, "blood_group": false, "bags_needed": false, "district": false,
    "hospital": false, "contact_phone": true, "whatsapp": true, "needed_by": true,
    "urgency": false, "notes": true }'::jsonb;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{
    "retention_days": 1, "enable_managed_button": true, "enable_push": true,
    "push_new_request": true, "push_interactions": true,
    "match_district_for_alerts": true, "match_blood_group_for_alerts": true,
    "auto_feed_district": true, "auto_feed_blood_group": true, "web_push_hook_secret": "" }'::jsonb;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS urgency_animation JSONB NOT NULL DEFAULT '{
    "critical": { "enabled": true, "mode": "breathe", "duration_ms": 2200, "opacity_min": 0.06,
      "opacity_max": 0.2, "scale_min": 0.82, "scale_max": 1.18, "size_percent": 72,
      "droplet_count": 1, "easing": "ease-in-out", "color": "#C62828", "show_header_icon": true },
    "urgent": { "enabled": true, "mode": "pulse-glow", "duration_ms": 2800, "opacity_min": 0.04,
      "opacity_max": 0.14, "scale_min": 0.88, "scale_max": 1.1, "size_percent": 64,
      "droplet_count": 1, "easing": "ease-in-out", "color": "#E67E22", "show_header_icon": false } }'::jsonb;

UPDATE public.app_settings
SET donation_flow_settings = '{
  "max_assigned_donors": 5, "show_progress": true, "enable_assign": true,
  "enable_confirm": true, "enable_i_can_donate": true, "enable_i_donated": true,
  "require_complete_first": true }'::jsonb
WHERE id = 1 AND NOT (donation_flow_settings ? 'show_progress');

-- ============ REALTIME ============
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.districts; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.upazilas; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_strings; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.community_orgs; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.community_donors; EXCEPTION WHEN duplicate_object THEN NULL; END $$;