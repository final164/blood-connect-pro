-- Dhaka metro areas as upazilas (Dhanmondi, Mirpur, Uttara, …)
-- Mirrors scripts/dhaka-metro-upazilas.sql

WITH dhaka AS (
  SELECT id FROM public.districts WHERE slug = 'dhaka' LIMIT 1
),
areas(name_en, name_bn, sort_order) AS (
  VALUES
    ('Dhaka Sadar', 'ঢাকা সদর', 0),
    ('Dhamrai', 'ধামরাই', 1),
    ('Dohar', 'দোহার', 2),
    ('Keraniganj', 'কেরানীগঞ্জ', 3),
    ('Nawabganj', 'নবাবগঞ্জ', 4),
    ('Savar', 'সাভার', 5),
    ('Adabor', 'আদাবর', 10),
    ('Agargaon', 'আগারগাঁও', 11),
    ('Airport', 'বিমানবন্দর', 12),
    ('Azimpur', 'আজিমপুর', 13),
    ('Badda', 'বাড্ডা', 13),
    ('Banani', 'বনানী', 14),
    ('Bangshal', 'বংশাল', 15),
    ('Baridhara', 'বারিধারা', 16),
    ('Bashundhara', 'বসুন্ধরা', 17),
    ('Cantonment', 'ক্যান্টনমেন্ট', 18),
    ('Dakshinkhan', 'দক্ষিণখান', 19),
    ('Demra', 'ডেমরা', 20),
    ('Dhanmondi', 'ধানমন্ডি', 21),
    ('Elephant Road', 'এলিফ্যান্ট রোড', 22),
    ('Eskaton', 'ইস্কাটন', 23),
    ('Farmgate', 'ফার্মগেট', 24),
    ('Gendaria', 'গেন্ডারিয়া', 25),
    ('Gulshan', 'গুলশান', 26),
    ('Hatirjheel', 'হাতিরঝিল', 27),
    ('Hazaribagh', 'হাজারীবাগ', 28),
    ('Jatrabari', 'যাত্রাবাড়ী', 29),
    ('Kafrul', 'কাফরুল', 30),
    ('Kakrail', 'কাকরাইল', 31),
    ('Kalabagan', 'কালাবাগান', 32),
    ('Kamrangirchar', 'কামরাঙ্গীরচর', 33),
    ('Khilgaon', 'খিলগাঁও', 34),
    ('Khilkhet', 'খিলক্ষেত', 35),
    ('Kotwali', 'কোতোয়ালী', 36),
    ('Lalbagh', 'লালবাগ', 37),
    ('Lalmatia', 'লালমাটিয়া', 38),
    ('Malibagh', 'মালিবাগ', 39),
    ('Mirpur', 'মিরপুর', 40),
    ('Moghbazar', 'মগবাজার', 41),
    ('Mohakhali', 'মহাখালী', 42),
    ('Mohammadpur', 'মোহাম্মদপুর', 43),
    ('Motijheel', 'মতিঝিল', 44),
    ('Mugda', 'মুগদা', 45),
    ('New Market', 'নিউ মার্কেট', 46),
    ('Pallabi', 'পল্লবী', 47),
    ('Paltan', 'পল্টন', 48),
    ('Panthapath', 'পান্থপথ', 49),
    ('Rajarbagh', 'রাজারবাগ', 50),
    ('Rampura', 'রামপুরা', 51),
    ('Sabujbagh', 'সবুজবাগ', 52),
    ('Shahbag', 'শাহবাগ', 53),
    ('Shantinagar', 'শান্তিনগর', 54),
    ('Sher-e-Bangla Nagar', 'শেরেবাংলা নগর', 55),
    ('Sutrapur', 'সূত্রাপুর', 56),
    ('Tejgaon', 'তেজগাঁও', 57),
    ('Turag', 'তুরাগ', 58),
    ('Uttara', 'উত্তরা', 59),
    ('Wari', 'ওয়ারী', 60)
)
INSERT INTO public.upazilas (district_id, name_bn, name_en, slug, sort_order, is_active)
SELECT
  dhaka.id,
  a.name_bn,
  a.name_en,
  trim(both '-' from regexp_replace(lower(a.name_en), '[^a-z0-9]+', '-', 'g')),
  a.sort_order,
  true
FROM areas a
CROSS JOIN dhaka
ON CONFLICT (district_id, slug) DO UPDATE SET
  name_bn = EXCLUDED.name_bn,
  name_en = EXCLUDED.name_en,
  sort_order = EXCLUDED.sort_order,
  is_active = true,
  updated_at = now();
