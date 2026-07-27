-- Expand hospital_type to include clinic & diagnostic (safe if already applied)
ALTER TABLE public.hospitals DROP CONSTRAINT IF EXISTS hospitals_hospital_type_check;
ALTER TABLE public.hospitals ADD CONSTRAINT hospitals_hospital_type_check
  CHECK (hospital_type IN ('government','private','ngo','clinic','diagnostic'));

INSERT INTO public.cms_strings (key, value_bn, value_en, category) VALUES
('clinic', 'ক্লিনিক', 'Clinic', 'form'),
('diagnostic', 'ডায়াগনস্টিক', 'Diagnostic', 'form'),
('searchHospital', 'হাসপাতাল / ক্লিনিক / ডায়াগনস্টিক খুঁজুন…', 'Search hospital / clinic / diagnostic…', 'form')
ON CONFLICT (key) DO UPDATE SET
  value_bn = EXCLUDED.value_bn,
  value_en = EXCLUDED.value_en;
