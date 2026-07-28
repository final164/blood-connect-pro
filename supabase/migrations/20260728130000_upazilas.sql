-- Upazilas (sub-districts) per district — admin-managed

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
CREATE INDEX IF NOT EXISTS upazilas_active_idx ON public.upazilas (district_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS upazilas_name_en_idx ON public.upazilas (name_en);
CREATE INDEX IF NOT EXISTS upazilas_name_bn_idx ON public.upazilas (name_bn);

GRANT SELECT ON public.upazilas TO authenticated, anon;
GRANT ALL ON public.upazilas TO service_role;
ALTER TABLE public.upazilas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upazilas_read" ON public.upazilas;
CREATE POLICY "upazilas_read" ON public.upazilas FOR SELECT USING (
  is_active = true OR public.has_role(auth.uid(), 'admin')
);

DROP POLICY IF EXISTS "upazilas_admin_all" ON public.upazilas;
CREATE POLICY "upazilas_admin_all" ON public.upazilas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_upazilas_updated ON public.upazilas;
CREATE TRIGGER trg_upazilas_updated BEFORE UPDATE ON public.upazilas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.upazilas;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
