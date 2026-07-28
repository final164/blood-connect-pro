-- Run in Supabase SQL Editor (community blood donors)

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
CREATE INDEX IF NOT EXISTS community_donors_blood_idx ON public.community_donors (blood_group);
CREATE INDEX IF NOT EXISTS community_donors_district_idx ON public.community_donors (district_id);

GRANT SELECT ON public.community_donors TO authenticated;
GRANT ALL ON public.community_donors TO service_role;
ALTER TABLE public.community_donors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "community_donors_read" ON public.community_donors;
CREATE POLICY "community_donors_read" ON public.community_donors FOR SELECT TO authenticated
  USING (
    is_active = true
    AND EXISTS (SELECT 1 FROM community_orgs o WHERE o.id = org_id AND o.is_active = true)
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "community_donors_admin" ON public.community_donors;
CREATE POLICY "community_donors_admin" ON public.community_donors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
