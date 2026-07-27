-- BloodLink v2: districts, CMS, community, shares, district-scoped content
-- Safe to run on projects that already have the base schema.

-- ============ DISTRICTS (admin-managed) ============
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
CREATE INDEX IF NOT EXISTS districts_name_en_idx ON public.districts (name_en);
CREATE INDEX IF NOT EXISTS districts_name_bn_idx ON public.districts (name_bn);
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

-- Seed Bangladesh districts (idempotent by slug)
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

-- ============ PROFILE / REQUEST / POST district FKs ============
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.blood_requests ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS posts_district_created_idx ON public.posts (district_id, created_at DESC);
CREATE INDEX IF NOT EXISTS requests_district_status_idx ON public.blood_requests (district_id, status);

-- Keep city as optional legacy; prefer district_id going forward
ALTER TABLE public.blood_requests ALTER COLUMN city DROP NOT NULL;
ALTER TABLE public.blood_requests ALTER COLUMN city SET DEFAULT '';

-- ============ POST SHARES ============
CREATE TABLE IF NOT EXISTS public.post_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'app',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS post_shares_post_idx ON public.post_shares (post_id);
GRANT SELECT, INSERT ON public.post_shares TO authenticated;
GRANT ALL ON public.post_shares TO service_role;
ALTER TABLE public.post_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "share_read_all" ON public.post_shares;
CREATE POLICY "share_read_all" ON public.post_shares FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "share_insert_self" ON public.post_shares;
CREATE POLICY "share_insert_self" ON public.post_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- ============ CMS STRINGS (no hardcoded product copy in admin-managed keys) ============
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
('confirmPassword','পাসওয়ার্ড নিশ্চিত করুন','Confirm password','auth'),
('adminLogin','অ্যাডমিন লগইন','Admin login','auth'),
('share','শেয়ার','Share','feed'),
('comment','কমেন্ট','Comment','feed'),
('like','লাইক','Like','feed'),
('writeComment','কমেন্ট লিখুন…','Write a comment…','feed'),
('offlineMode','অফলাইন মোড','Offline mode','system'),
('architecture','আর্কিটেকচার প্ল্যান','Architecture plan','admin')
ON CONFLICT (key) DO NOTHING;

-- ============ APP SETTINGS expansions ============
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS support_email TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS about_bn TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS about_en TEXT;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS require_auth BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS enable_guest BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS maintenance_mode BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS brand_primary TEXT DEFAULT '#C62828';
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS architecture_md TEXT;

UPDATE public.app_settings SET architecture_md = COALESCE(architecture_md, $ARCH$
# BloodLink Platform Architecture

## Product
Blood donation social + request platform (web-first, native-ready API layer).

## Stack
- Frontend: TanStack Start + React 19 + Vite + Tailwind
- Backend: Supabase (Auth, Postgres, Realtime, Storage-ready)
- Offline: Service Worker + IndexedDB cache queue
- Chat: AES-GCM E2EE ciphertext stored server-side

## District Search Pattern
**Typeahead Autocomplete** + **District-scoped feed filtering** (administrative geo-fencing without maps).

## Modules
1. Auth (email/password, admin role)
2. Feed (posts, likes, comments, shares) — realtime
3. Blood Requests (inline composer, district filter) — realtime
4. Encrypted Chat — realtime
5. Admin CMS (strings, districts, community orgs, users, settings)
6. Community partners directory

## Native Path
Reuse `src/lib/api/*` against same Supabase project from React Native / Flutter.
$ARCH$)
WHERE id = 1;

-- ============ COMMUNITY ORGANIZATIONS ============
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

-- ============ OFFLINE SYNC QUEUE (optional client mirror) ============
CREATE TABLE IF NOT EXISTS public.sync_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.sync_events TO authenticated;
GRANT ALL ON public.sync_events TO service_role;
ALTER TABLE public.sync_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sync_self" ON public.sync_events;
CREATE POLICY "sync_self" ON public.sync_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============ REALTIME for new tables ============
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.post_shares;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.districts;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.cms_strings;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.community_orgs;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow admins to manage roles & profiles
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles;
CREATE POLICY "user_roles_admin_all" ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'));

-- Comments update policy already exists; ensure realtime comments work with shares
GRANT UPDATE ON public.post_comments TO authenticated;
