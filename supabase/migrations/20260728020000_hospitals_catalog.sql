-- Hospitals catalog (admin-managed) + FK on blood_requests
CREATE TABLE IF NOT EXISTS public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_bn TEXT NOT NULL,
  name_en TEXT NOT NULL,
  slug TEXT NOT NULL,
  district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  hospital_type TEXT NOT NULL DEFAULT 'government' CHECK (hospital_type IN ('government','private','ngo','clinic','diagnostic')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (district_id, slug)
);
CREATE INDEX IF NOT EXISTS hospitals_name_en_idx ON public.hospitals (name_en);
CREATE INDEX IF NOT EXISTS hospitals_name_bn_idx ON public.hospitals (name_bn);
CREATE INDEX IF NOT EXISTS hospitals_district_idx ON public.hospitals (district_id, is_active);
GRANT SELECT ON public.hospitals TO authenticated, anon;
GRANT ALL ON public.hospitals TO service_role;
ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hospitals_read" ON public.hospitals;
CREATE POLICY "hospitals_read" ON public.hospitals FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "hospitals_admin" ON public.hospitals;
CREATE POLICY "hospitals_admin" ON public.hospitals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_hospitals_updated ON public.hospitals;
CREATE TRIGGER trg_hospitals_updated BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.blood_requests ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.hospitals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO public.cms_strings (key, value_bn, value_en, category) VALUES
('searchHospital', 'হাসপাতাল খুঁজুন…', 'Search hospital…', 'form'),
('hospital', 'হাসপাতাল', 'Hospital', 'form'),
('hospitals', 'হাসপাতালসমূহ', 'Hospitals', 'admin'),
('government', 'সরকারি', 'Government', 'form'),
('private', 'বেসরকারি', 'Private', 'form')
ON CONFLICT (key) DO NOTHING;
