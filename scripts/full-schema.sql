
-- ============ ENUMS ============
CREATE TYPE public.blood_group AS ENUM ('A+','A-','B+','B-','AB+','AB-','O+','O-');
CREATE TYPE public.urgency AS ENUM ('normal','urgent','critical');
CREATE TYPE public.request_status AS ENUM ('open','fulfilled','cancelled','expired');
CREATE TYPE public.app_role AS ENUM ('admin','moderator','user');
CREATE TYPE public.notif_type AS ENUM ('request_match','new_message','post_like','post_comment','follow','donation_confirmed','system');

-- ============ UPDATED_AT HELPER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  bio TEXT,
  phone TEXT,
  blood_group public.blood_group,
  is_donor BOOLEAN NOT NULL DEFAULT false,
  is_recipient BOOLEAN NOT NULL DEFAULT false,
  city TEXT,
  area TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  last_donation_date DATE,
  date_of_birth DATE,
  gender TEXT,
  weight_kg NUMERIC,
  medical_conditions_encrypted TEXT,
  e2ee_public_key TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_available BOOLEAN NOT NULL DEFAULT true,
  total_donations INT NOT NULL DEFAULT 0,
  lives_saved INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.raw_user_meta_data->>'avatar_url');
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END; $$;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_self" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$$;

-- ============ USER SETTINGS ============
CREATE TABLE public.user_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  language TEXT NOT NULL DEFAULT 'bn',
  theme TEXT NOT NULL DEFAULT 'light',
  notif_push BOOLEAN NOT NULL DEFAULT true,
  notif_email BOOLEAN NOT NULL DEFAULT true,
  notif_new_request BOOLEAN NOT NULL DEFAULT true,
  share_location BOOLEAN NOT NULL DEFAULT false,
  google_maps_api_key TEXT,
  e2ee_enabled BOOLEAN NOT NULL DEFAULT true,
  e2ee_private_key_encrypted TEXT,
  radius_km INT NOT NULL DEFAULT 25,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.user_settings TO authenticated;
GRANT ALL ON public.user_settings TO service_role;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_self" ON public.user_settings FOR ALL TO authenticated USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON public.user_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ APP SETTINGS (single row) ============
CREATE TABLE public.app_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id=1),
  app_name TEXT NOT NULL DEFAULT 'BloodLink',
  default_language TEXT NOT NULL DEFAULT 'bn',
  google_maps_api_key TEXT,
  emergency_hotline TEXT,
  allow_anon_read BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "app_settings_read" ON public.app_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "app_settings_admin_write" ON public.app_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============ BLOOD REQUESTS ============
CREATE TABLE public.blood_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  blood_group public.blood_group NOT NULL,
  bags_needed INT NOT NULL DEFAULT 1 CHECK (bags_needed > 0),
  hospital_name TEXT NOT NULL,
  city TEXT NOT NULL,
  area TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  contact_phone TEXT NOT NULL,
  needed_by TIMESTAMPTZ NOT NULL,
  urgency public.urgency NOT NULL DEFAULT 'normal',
  notes TEXT,
  status public.request_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.blood_requests(status, needed_by);
CREATE INDEX ON public.blood_requests(blood_group, city);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blood_requests TO authenticated;
GRANT ALL ON public.blood_requests TO service_role;
ALTER TABLE public.blood_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "req_read_all_auth" ON public.blood_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "req_insert_self" ON public.blood_requests FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "req_update_owner" ON public.blood_requests FOR UPDATE TO authenticated USING (auth.uid() = requester_id);
CREATE POLICY "req_delete_owner" ON public.blood_requests FOR DELETE TO authenticated USING (auth.uid() = requester_id);
CREATE TRIGGER trg_req_updated BEFORE UPDATE ON public.blood_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ DONATIONS ============
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.blood_requests(id) ON DELETE SET NULL,
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  donation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bags INT NOT NULL DEFAULT 1,
  confirmed BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "don_read_involved" ON public.donations FOR SELECT TO authenticated USING (auth.uid() IN (donor_id, recipient_id));
CREATE POLICY "don_insert_donor" ON public.donations FOR INSERT TO authenticated WITH CHECK (auth.uid() = donor_id);
CREATE POLICY "don_update_involved" ON public.donations FOR UPDATE TO authenticated USING (auth.uid() IN (donor_id, recipient_id));

-- ============ SOCIAL POSTS ============
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  image_url TEXT,
  post_type TEXT NOT NULL DEFAULT 'story',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.posts(created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.posts TO authenticated;
GRANT ALL ON public.posts TO service_role;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "post_read_all_auth" ON public.posts FOR SELECT TO authenticated USING (true);
CREATE POLICY "post_insert_self" ON public.posts FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "post_update_self" ON public.posts FOR UPDATE TO authenticated USING (auth.uid() = author_id);
CREATE POLICY "post_delete_self" ON public.posts FOR DELETE TO authenticated USING (auth.uid() = author_id);
CREATE TRIGGER trg_posts_updated BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.post_likes (
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(post_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.post_likes TO authenticated;
GRANT ALL ON public.post_likes TO service_role;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "like_read_all" ON public.post_likes FOR SELECT TO authenticated USING (true);
CREATE POLICY "like_insert_self" ON public.post_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "like_delete_self" ON public.post_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE public.post_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.post_comments(post_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.post_comments TO authenticated;
GRANT ALL ON public.post_comments TO service_role;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cmt_read_all" ON public.post_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "cmt_insert_self" ON public.post_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cmt_delete_self" ON public.post_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============ FOLLOWS ============
CREATE TABLE public.follows (
  follower_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);
GRANT SELECT, INSERT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "follow_read_all" ON public.follows FOR SELECT TO authenticated USING (true);
CREATE POLICY "follow_insert_self" ON public.follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "follow_delete_self" ON public.follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

-- ============ CONVERSATIONS & E2EE MESSAGES ============
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a < user_b),
  UNIQUE (user_a, user_b)
);
GRANT SELECT, INSERT, UPDATE ON public.conversations TO authenticated;
GRANT ALL ON public.conversations TO service_role;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "conv_read_participant" ON public.conversations FOR SELECT TO authenticated USING (auth.uid() IN (user_a, user_b));
CREATE POLICY "conv_insert_participant" ON public.conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (user_a, user_b));
CREATE POLICY "conv_update_participant" ON public.conversations FOR UPDATE TO authenticated USING (auth.uid() IN (user_a, user_b));

CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL,
  iv TEXT,
  is_encrypted BOOLEAN NOT NULL DEFAULT true,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.messages(conversation_id, created_at);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "msg_read_participant" ON public.messages FOR SELECT TO authenticated USING (auth.uid() IN (sender_id, recipient_id));
CREATE POLICY "msg_insert_sender" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "msg_update_participant" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() IN (sender_id, recipient_id));

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notif_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data JSONB,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.notifications(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notif_read_self" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_update_self" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_delete_self" ON public.notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "notif_insert_any" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- ============ TRIGGERS ============
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Bump conversation last_message_at
CREATE OR REPLACE FUNCTION public.bump_conversation() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_bump_conv AFTER INSERT ON public.messages FOR EACH ROW EXECUTE FUNCTION public.bump_conversation();

-- ============ REALTIME ============
ALTER PUBLICATION supabase_realtime ADD TABLE public.blood_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bump_conversation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;
CREATE POLICY "notif_insert_self_only" ON public.notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
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
('à¦¢à¦¾à¦•à¦¾','Dhaka','dhaka',1),('à¦—à¦¾à¦œà§€à¦ªà§à¦°','Gazipur','gazipur',2),('à¦¨à¦¾à¦°à¦¾à¦¯à¦¼à¦£à¦—à¦žà§à¦œ','Narayanganj','narayanganj',3),
('à¦Ÿà¦¾à¦™à§à¦—à¦¾à¦‡à¦²','Tangail','tangail',4),('à¦•à¦¿à¦¶à§‹à¦°à¦—à¦žà§à¦œ','Kishoreganj','kishoreganj',5),('à¦®à¦¾à¦¨à¦¿à¦•à¦—à¦žà§à¦œ','Manikganj','manikganj',6),
('à¦®à§à¦¨à§à¦¸à¦¿à¦—à¦žà§à¦œ','Munshiganj','munshiganj',7),('à¦¨à¦°à¦¸à¦¿à¦‚à¦¦à§€','Narsingdi','narsingdi',8),('à¦°à¦¾à¦œà¦¬à¦¾à¦¡à¦¼à§€','Rajbari','rajbari',9),
('à¦«à¦°à¦¿à¦¦à¦ªà§à¦°','Faridpur','faridpur',10),('à¦—à§‹à¦ªà¦¾à¦²à¦—à¦žà§à¦œ','Gopalganj','gopalganj',11),('à¦®à¦¾à¦¦à¦¾à¦°à§€à¦ªà§à¦°','Madaripur','madaripur',12),
('à¦¶à¦°à§€à¦¯à¦¼à¦¤à¦ªà§à¦°','Shariatpur','shariatpur',13),('à¦šà¦Ÿà§à¦Ÿà¦—à§à¦°à¦¾à¦®','Chattogram','chattogram',14),('à¦•à¦•à§à¦¸à¦¬à¦¾à¦œà¦¾à¦°','Cox''s Bazar','coxs-bazar',15),
('à¦•à§à¦®à¦¿à¦²à§à¦²à¦¾','Cumilla','cumilla',16),('à¦«à§‡à¦¨à§€','Feni','feni',17),('à¦¨à§‹à¦¯à¦¼à¦¾à¦–à¦¾à¦²à§€','Noakhali','noakhali',18),
('à¦²à¦•à§à¦·à§à¦®à§€à¦ªà§à¦°','Lakshmipur','lakshmipur',19),('à¦šà¦¾à¦à¦¦à¦ªà§à¦°','Chandpur','chandpur',20),('à¦¬à§à¦°à¦¾à¦¹à§à¦®à¦£à¦¬à¦¾à¦¡à¦¼à¦¿à¦¯à¦¼à¦¾','Brahmanbaria','brahmanbaria',21),
('à¦°à¦¾à¦™à§à¦—à¦¾à¦®à¦¾à¦Ÿà¦¿','Rangamati','rangamati',22),('à¦–à¦¾à¦—à¦¡à¦¼à¦¾à¦›à¦¡à¦¼à¦¿','Khagrachhari','khagrachhari',23),('à¦¬à¦¾à¦¨à§à¦¦à¦°à¦¬à¦¾à¦¨','Bandarban','bandarban',24),
('à¦°à¦¾à¦œà¦¶à¦¾à¦¹à§€','Rajshahi','rajshahi',25),('à¦¨à¦¾à¦Ÿà§‹à¦°','Natore','natore',26),('à¦¨à¦“à¦—à¦¾à¦','Naogaon','naogaon',27),
('à¦šà¦¾à¦à¦ªà¦¾à¦‡à¦¨à¦¬à¦¾à¦¬à¦—à¦žà§à¦œ','Chapainawabganj','chapainawabganj',28),('à¦ªà¦¾à¦¬à¦¨à¦¾','Pabna','pabna',29),('à¦¸à¦¿à¦°à¦¾à¦œà¦—à¦žà§à¦œ','Sirajganj','sirajganj',30),
('à¦¬à¦—à§à¦¡à¦¼à¦¾','Bogura','bogura',31),('à¦œà¦¯à¦¼à¦ªà§à¦°à¦¹à¦¾à¦Ÿ','Joypurhat','joypurhat',32),('à¦–à§à¦²à¦¨à¦¾','Khulna','khulna',33),
('à¦¬à¦¾à¦—à§‡à¦°à¦¹à¦¾à¦Ÿ','Bagerhat','bagerhat',34),('à¦¸à¦¾à¦¤à¦•à§à¦·à§€à¦°à¦¾','Satkhira','satkhira',35),('à¦¯à¦¶à§‹à¦°','Jashore','jashore',36),
('à¦à¦¿à¦¨à¦¾à¦‡à¦¦à¦¹','Jhenaidah','jhenaidah',37),('à¦®à¦¾à¦—à§à¦°à¦¾','Magura','magura',38),('à¦¨à¦¡à¦¼à¦¾à¦‡à¦²','Narail','narail',39),
('à¦•à§à¦·à§à¦Ÿà¦¿à¦¯à¦¼à¦¾','Kushtia','kushtia',40),('à¦šà§à¦¯à¦¼à¦¾à¦¡à¦¾à¦™à§à¦—à¦¾','Chuadanga','chuadanga',41),('à¦®à§‡à¦¹à§‡à¦°à¦ªà§à¦°','Meherpur','meherpur',42),
('à¦¬à¦°à¦¿à¦¶à¦¾à¦²','Barishal','barishal',43),('à¦­à§‹à¦²à¦¾','Bhola','bhola',44),('à¦ªà¦Ÿà§à¦¯à¦¼à¦¾à¦–à¦¾à¦²à§€','Patuakhali','patuakhali',45),
('à¦ªà¦¿à¦°à§‹à¦œà¦ªà§à¦°','Pirojpur','pirojpur',46),('à¦¬à¦°à¦—à§à¦¨à¦¾','Barguna','barguna',47),('à¦à¦¾à¦²à¦•à¦¾à¦ à¦¿','Jhalokati','jhalokati',48),
('à¦¸à¦¿à¦²à§‡à¦Ÿ','Sylhet','sylhet',49),('à¦®à§Œà¦²à¦­à§€à¦¬à¦¾à¦œà¦¾à¦°','Moulvibazar','moulvibazar',50),('à¦¹à¦¬à¦¿à¦—à¦žà§à¦œ','Habiganj','habiganj',51),
('à¦¸à§à¦¨à¦¾à¦®à¦—à¦žà§à¦œ','Sunamganj','sunamganj',52),('à¦°à¦‚à¦ªà§à¦°','Rangpur','rangpur',53),('à¦¦à¦¿à¦¨à¦¾à¦œà¦ªà§à¦°','Dinajpur','dinajpur',54),
('à¦¨à§€à¦²à¦«à¦¾à¦®à¦¾à¦°à§€','Nilphamari','nilphamari',55),('à¦—à¦¾à¦‡à¦¬à¦¾à¦¨à§à¦§à¦¾','Gaibandha','gaibandha',56),('à¦•à§à¦¡à¦¼à¦¿à¦—à§à¦°à¦¾à¦®','Kurigram','kurigram',57),
('à¦²à¦¾à¦²à¦®à¦¨à¦¿à¦°à¦¹à¦¾à¦Ÿ','Lalmonirhat','lalmonirhat',58),('à¦ à¦¾à¦•à§à¦°à¦—à¦¾à¦à¦“','Thakurgaon','thakurgaon',59),('à¦ªà¦žà§à¦šà¦—à¦¡à¦¼','Panchagarh','panchagarh',60),
('à¦®à¦¯à¦¼à¦®à¦¨à¦¸à¦¿à¦‚à¦¹','Mymensingh','mymensingh',61),('à¦œà¦¾à¦®à¦¾à¦²à¦ªà§à¦°','Jamalpur','jamalpur',62),('à¦¶à§‡à¦°à¦ªà§à¦°','Sherpur','sherpur',63),
('à¦¨à§‡à¦¤à§à¦°à¦•à§‹à¦£à¦¾','Netrokona','netrokona',64)
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
('tagline','à¦°à¦•à§à¦¤à¦¦à¦¾à¦¨à§‡ à¦œà§€à¦¬à¦¨ à¦¬à¦¾à¦à¦šà¦¾à¦¨','Save lives by donating blood','brand'),
('feed','à¦«à¦¿à¦¡','Feed','nav'),
('requests','à¦°à¦¿à¦•à§‹à¦¯à¦¼à§‡à¦¸à§à¦Ÿ','Requests','nav'),
('community','à¦•à¦®à¦¿à¦‰à¦¨à¦¿à¦Ÿà¦¿','Community','nav'),
('chat','à¦šà§à¦¯à¦¾à¦Ÿ','Chat','nav'),
('profile','à¦ªà§à¦°à§‹à¦«à¦¾à¦‡à¦²','Profile','nav'),
('district','à¦œà§‡à¦²à¦¾','District','form'),
('searchDistrict','à¦œà§‡à¦²à¦¾ à¦–à§à¦à¦œà§à¦¨â€¦','Search districtâ€¦','form'),
('confirmPassword','à¦ªà¦¾à¦¸à¦“à¦¯à¦¼à¦¾à¦°à§à¦¡ à¦¨à¦¿à¦¶à§à¦šà¦¿à¦¤ à¦•à¦°à§à¦¨','Confirm password','auth'),
('adminLogin','à¦…à§à¦¯à¦¾à¦¡à¦®à¦¿à¦¨ à¦²à¦—à¦‡à¦¨','Admin login','auth'),
('share','à¦¶à§‡à¦¯à¦¼à¦¾à¦°','Share','feed'),
('comment','à¦•à¦®à§‡à¦¨à§à¦Ÿ','Comment','feed'),
('like','à¦²à¦¾à¦‡à¦•','Like','feed'),
('writeComment','à¦•à¦®à§‡à¦¨à§à¦Ÿ à¦²à¦¿à¦–à§à¦¨â€¦','Write a commentâ€¦','feed'),
('offlineMode','à¦…à¦«à¦²à¦¾à¦‡à¦¨ à¦®à§‹à¦¡','Offline mode','system'),
('architecture','à¦†à¦°à§à¦•à¦¿à¦Ÿà§‡à¦•à¦šà¦¾à¦° à¦ªà§à¦²à§à¦¯à¦¾à¦¨','Architecture plan','admin')
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
2. Feed (posts, likes, comments, shares) â€” realtime
3. Blood Requests (inline composer, district filter) â€” realtime
4. Encrypted Chat â€” realtime
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
-- Likes & comments on blood request feed posts
CREATE TABLE IF NOT EXISTS public.request_likes (
  request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.request_likes TO authenticated;
GRANT ALL ON public.request_likes TO service_role;
ALTER TABLE public.request_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "req_like_read" ON public.request_likes;
CREATE POLICY "req_like_read" ON public.request_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "req_like_insert" ON public.request_likes;
CREATE POLICY "req_like_insert" ON public.request_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "req_like_delete" ON public.request_likes;
CREATE POLICY "req_like_delete" ON public.request_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_comments_req_idx ON public.request_comments (request_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.request_comments TO authenticated;
GRANT ALL ON public.request_comments TO service_role;
ALTER TABLE public.request_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "req_cmt_read" ON public.request_comments;
CREATE POLICY "req_cmt_read" ON public.request_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "req_cmt_insert" ON public.request_comments;
CREATE POLICY "req_cmt_insert" ON public.request_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "req_cmt_delete" ON public.request_comments;
CREATE POLICY "req_cmt_delete" ON public.request_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.request_likes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.request_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- Same as supabase/migrations/20260728050000_notifications.sql
-- Run once in Supabase â†’ SQL Editor

CREATE TABLE IF NOT EXISTS public.request_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);
GRANT SELECT, INSERT ON public.request_shares TO authenticated;
GRANT ALL ON public.request_shares TO service_role;
ALTER TABLE public.request_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "req_share_read" ON public.request_shares;
CREATE POLICY "req_share_read" ON public.request_shares FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "req_share_insert" ON public.request_shares;
CREATE POLICY "req_share_insert" ON public.request_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'share', 'system')),
  request_id UUID REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  body TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id) WHERE is_read = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "notif_insert_admin" ON public.notifications;
CREATE POLICY "notif_insert_admin" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_request_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
  ntype TEXT := TG_ARGV[0];
  preview TEXT := NULL;
BEGIN
  SELECT requester_id INTO owner_id FROM public.blood_requests WHERE id = NEW.request_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'request_comments' THEN
    preview := left(NEW.content, 200);
  END IF;

  INSERT INTO public.notifications (user_id, actor_id, type, request_id, title, body)
  VALUES (owner_id, NEW.user_id, ntype, NEW.request_id, ntype, preview);

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF to_regclass('public.request_likes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_like ON public.request_likes;
    CREATE TRIGGER trg_notify_like
      AFTER INSERT ON public.request_likes
      FOR EACH ROW EXECUTE FUNCTION public.notify_request_owner('like');
  END IF;
  IF to_regclass('public.request_comments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_comment ON public.request_comments;
    CREATE TRIGGER trg_notify_comment
      AFTER INSERT ON public.request_comments
      FOR EACH ROW EXECUTE FUNCTION public.notify_request_owner('comment');
  END IF;
  IF to_regclass('public.request_shares') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_share ON public.request_shares;
    CREATE TRIGGER trg_notify_share
      AFTER INSERT ON public.request_shares
      FOR EACH ROW EXECUTE FUNCTION public.notify_request_owner('share');
  END IF;
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
