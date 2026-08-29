-- Demo: 10 video consultants with full profiles, slots, products, sample reviews
-- Idempotent via BMDC prefix TELE-DEMO-*

-- Ensure specialties exist
INSERT INTO public.care_specialties (slug, name_bn, name_en, sort_order) VALUES
  ('medicine', 'মেডিসিন', 'Medicine', 10),
  ('cardiology', 'কার্ডিওলজি', 'Cardiology', 20),
  ('gynecology', 'গাইনি', 'Gynecology', 30),
  ('pediatrics', 'শিশু', 'Pediatrics', 40),
  ('ent', 'নাক কান গলা', 'ENT', 50),
  ('orthopedics', 'অর্থোপেডিক্স', 'Orthopedics', 60),
  ('dermatology', 'ডার্মাটোলজি', 'Dermatology', 70),
  ('general', 'জেনারেল', 'General', 80)
ON CONFLICT (slug) DO NOTHING;

-- Remove previous tele demo doctors (cascade clears tele_* rows)
DELETE FROM public.care_doctors WHERE bmdc_no LIKE 'TELE-DEMO-%';

WITH specs AS (
  SELECT slug, id FROM public.care_specialties
),
seed AS (
  SELECT * FROM (VALUES
    (
      'a1000001-0000-4000-8000-000000000001'::uuid,
      'Dr. Rafiq Hasan', 'ডা. রফিক হাসান', 'TELE-DEMO-001', 'medicine',
      'MBBS, FCPS (Medicine)',
      'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop',
      '১৫+ বছর ধরে সাধারণ মেডিসিন ও দীর্ঘমেয়াদি রোগের ভিডিও পরামর্শ দিচ্ছেন।',
      '15+ years providing video consults for general medicine and chronic care.',
      15, 'ঢাকা মেডিকেল কলেজ হাসপাতাল', 'Dhaka Medical College Hospital',
      450::numeric, true, true, true, 4.85::numeric, 42, 10
    ),
    (
      'a1000001-0000-4000-8000-000000000002'::uuid,
      'Dr. Nusrat Jahan', 'ডা. নুসরাত জাহান', 'TELE-DEMO-002', 'cardiology',
      'MBBS, MD (Cardiology)',
      'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=400&h=400&fit=crop',
      'হৃদরোগ, উচ্চ রক্তচাপ ও কোলেস্টেরল নিয়ন্ত্রণে অনলাইন ফলো-আপ।',
      'Online follow-up for heart disease, hypertension and cholesterol control.',
      12, 'ন্যাশনাল হার্ট ফাউন্ডেশন', 'National Heart Foundation',
      850::numeric, true, false, true, 4.92::numeric, 68, 20
    ),
    (
      'a1000001-0000-4000-8000-000000000003'::uuid,
      'Dr. Farhana Akter', 'ডা. ফারহানা আক্তার', 'TELE-DEMO-003', 'gynecology',
      'MBBS, FCPS (Obs & Gynae)',
      'https://images.unsplash.com/photo-1594824476967-48c8b964273f?w=400&h=400&fit=crop',
      'গর্ভাবস্থা, মাসিক সমস্যা ও নারী স্বাস্থ্য বিষয়ে ভিডিও কনসালট।',
      'Video consults for pregnancy care, menstrual issues and women’s health.',
      14, 'স্কয়ার হাসপাতাল', 'Square Hospital',
      750::numeric, true, true, true, 4.78::numeric, 55, 30
    ),
    (
      'a1000001-0000-4000-8000-000000000004'::uuid,
      'Dr. Tanvir Ahmed', 'ডা. তানভীর আহমেদ', 'TELE-DEMO-004', 'pediatrics',
      'MBBS, DCH, FCPS (Pediatrics)',
      'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=400&h=400&fit=crop',
      'শিশু জ্বর, কাশি, খাদ্য ও টিকা পরামর্শ — বাবা-মায়ের জন্য সহজ ভিডিও সেশন।',
      'Child fever, cough, nutrition and vaccine advice via easy video sessions.',
      11, 'চাইল্ড কেয়ার সেন্টার', 'Child Care Center',
      550::numeric, true, true, true, 4.88::numeric, 91, 40
    ),
    (
      'a1000001-0000-4000-8000-000000000005'::uuid,
      'Dr. Sabina Yasmin', 'ডা. সাবিনা ইয়াসমিন', 'TELE-DEMO-005', 'ent',
      'MBBS, MS (ENT)',
      'https://images.unsplash.com/photo-1651008376811-b90baee60c1f?w=400&h=400&fit=crop',
      'সাইনাস, কানের ব্যথা, গলার ইনফেকশন ও অ্যালার্জি পরামর্শ।',
      'Consults for sinus, ear pain, throat infection and allergy.',
      10, 'বাংলাদেশ ইএনটি হাসপাতাল', 'Bangladesh ENT Hospital',
      600::numeric, true, false, false, 4.70::numeric, 33, 50
    ),
    (
      'a1000001-0000-4000-8000-000000000006'::uuid,
      'Dr. Imran Chowdhury', 'ডা. ইমরান চৌধুরী', 'TELE-DEMO-006', 'orthopedics',
      'MBBS, MS (Ortho)',
      'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=400&h=400&fit=crop',
      'কোমর ব্যথা, হাঁটু ব্যথা ও স্পোর্টস ইনজুরির প্রাথমিক অনলাইন মূল্যায়ন।',
      'Initial online assessment for back pain, knee pain and sports injury.',
      16, 'অ্যাপোলো হাসপাতাল', 'Apollo Hospital',
      800::numeric, true, false, true, 4.65::numeric, 47, 60
    ),
    (
      'a1000001-0000-4000-8000-000000000007'::uuid,
      'Dr. Mehnaz Rahman', 'ডা. মেহনাজ রহমান', 'TELE-DEMO-007', 'dermatology',
      'MBBS, DDV, FCPS (Dermatology)',
      'https://images.unsplash.com/photo-1527613426441-4da17471b66d?w=400&h=400&fit=crop',
      'ব্রণ, একজিমা, চুল পড়া ও ত্বকের অ্যালার্জির ভিডিও পরামর্শ।',
      'Video advice for acne, eczema, hair fall and skin allergy.',
      9, 'লেজার ও ডার্মা কেয়ার', 'Laser & Derma Care',
      650::numeric, true, true, true, 4.91::numeric, 112, 70
    ),
    (
      'a1000001-0000-4000-8000-000000000008'::uuid,
      'Dr. Karim Uddin', 'ডা. করিম উদ্দিন', 'TELE-DEMO-008', 'general',
      'MBBS, MPH',
      'https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=400&h=400&fit=crop',
      'সাধারণ অসুস্থতা, প্রেসক্রিপশন রিভিউ ও দ্রুত দ্বিতীয় মতামত।',
      'General illness, prescription review and quick second opinion.',
      8, 'মুক্তসেবা কেয়ার পার্টনার', 'Muktosheba Care Partner',
      350::numeric, true, true, false, 4.55::numeric, 28, 80
    ),
    (
      'a1000001-0000-4000-8000-000000000009'::uuid,
      'Dr. Anika Sultana', 'ডা. আনিকা সুলতানা', 'TELE-DEMO-009', 'medicine',
      'MBBS, MD (Internal Medicine)',
      'https://images.unsplash.com/photo-1614608682850-af0d6d4d1d52?w=400&h=400&fit=crop',
      'ডায়াবেটিস, থাইরয়েড ও গ্যাস্ট্রিক সমস্যার নিয়মিত ভিডিও ফলো-আপ।',
      'Regular video follow-up for diabetes, thyroid and gastric issues.',
      13, 'ইবনে সিনা হাসপাতাল', 'Ibn Sina Hospital',
      500::numeric, true, true, true, 4.80::numeric, 76, 90
    ),
    (
      'a1000001-0000-4000-8000-00000000000a'::uuid,
      'Dr. Shahriar Kabir', 'ডা. শাহরিয়ার কবির', 'TELE-DEMO-010', 'cardiology',
      'MBBS, MRCP, FACC',
      'https://images.unsplash.com/photo-1607990283143-e81e7a2c9349?w=400&h=400&fit=crop',
      'বুক ধড়ফড়, বুকে ব্যথা ও হার্ট ফেইলিউর ফলো-আপের জন্য বিশেষজ্ঞ ভিডিও কনসালট।',
      'Specialist video consult for palpitations, chest pain and heart-failure follow-up.',
      18, 'ইউনাইটেড হাসপাতাল', 'United Hospital',
      950::numeric, true, false, true, 4.95::numeric, 120, 100
    )
  ) AS t(
    id, full_name, full_name_bn, bmdc_no, spec_slug,
    qualifications, photo_url,
    about_bn, about_en, experience_years, workplace_bn, workplace_en,
    fee_amount, video_enabled, instant_enabled, is_popular,
    rating_avg, rating_count, sort_order
  )
),
ins_docs AS (
  INSERT INTO public.care_doctors (
    id, full_name, full_name_bn, bmdc_no, specialty_id,
    qualifications, photo_url, bio, bio_bn, is_active
  )
  SELECT
    s.id,
    s.full_name,
    s.full_name_bn,
    s.bmdc_no,
    sp.id,
    s.qualifications,
    s.photo_url,
    s.about_en,
    s.about_bn,
    true
  FROM seed s
  JOIN specs sp ON sp.slug = s.spec_slug
  RETURNING id
)
INSERT INTO public.tele_doctor_profiles (
  doctor_id, video_enabled, instant_enabled, is_online, is_popular,
  about_bn, about_en, experience_years, workplace_bn, workplace_en,
  hero_image_url, fee_amount, rating_avg, rating_count, sort_order
)
SELECT
  s.id,
  s.video_enabled,
  s.instant_enabled,
  s.instant_enabled, -- online if in instant pool
  s.is_popular,
  s.about_bn,
  s.about_en,
  s.experience_years,
  s.workplace_bn,
  s.workplace_en,
  s.photo_url,
  s.fee_amount,
  s.rating_avg,
  s.rating_count,
  s.sort_order
FROM seed s;

-- Weekly slots (Sun–Thu evenings + Sat morning) for every demo doctor
INSERT INTO public.tele_doctor_slots (doctor_id, weekday, start_time, end_time, is_active)
SELECT d.id, w.weekday, w.start_time::time, w.end_time::time, true
FROM public.care_doctors d
CROSS JOIN (VALUES
  (0, '18:00', '21:00'),
  (1, '18:00', '21:00'),
  (2, '18:00', '21:00'),
  (3, '18:00', '21:00'),
  (4, '18:00', '21:00'),
  (6, '09:00', '12:00'),
  (6, '16:00', '19:00')
) AS w(weekday, start_time, end_time)
WHERE d.bmdc_no LIKE 'TELE-DEMO-%'
ON CONFLICT (doctor_id, weekday, start_time, end_time) DO NOTHING;

-- Named + instant product fees per specialty (for pool pricing)
INSERT INTO public.tele_consult_products (specialty_id, mode, fee_amount, duration_minutes, is_active)
SELECT sp.id, m.mode, m.fee, 20, true
FROM public.care_specialties sp
CROSS JOIN (VALUES
  ('instant', 299::numeric),
  ('named', 650::numeric)
) AS m(mode, fee)
WHERE sp.slug IN ('medicine','cardiology','gynecology','pediatrics','ent','orthopedics','dermatology','general')
ON CONFLICT (specialty_id, mode) DO UPDATE SET
  fee_amount = EXCLUDED.fee_amount,
  is_active = true,
  duration_minutes = EXCLUDED.duration_minutes;

-- Refresh demo offer cards specialty links
UPDATE public.tele_offer_cards o
SET specialty_id = s.id
FROM public.care_specialties s
WHERE o.slug = 'instant-mbbs' AND s.slug = 'general' AND o.specialty_id IS NULL;

UPDATE public.tele_offer_cards o
SET specialty_id = s.id
FROM public.care_specialties s
WHERE o.slug = 'instant-child' AND s.slug = 'pediatrics' AND o.specialty_id IS NULL;

-- Ensure tele feature flags on
UPDATE public.app_settings
SET tele_settings = COALESCE(tele_settings, '{}'::jsonb) || jsonb_build_object(
  'tele_enabled', true,
  'instant_enabled', true
)
WHERE id = 1;
