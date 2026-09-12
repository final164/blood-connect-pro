-- Success stories carousel: settings + slides + auto-snapshot on fulfill.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS success_carousel_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_settings
SET success_carousel_settings = '{
  "enabled": true,
  "insert_after_every": 3,
  "title_bn": "সফল রক্তদান",
  "title_en": "Successful donations",
  "show_header": true,
  "show_nav_arrows": true,
  "show_item_menu": false,
  "loop": true,
  "autoplay": true,
  "autoplay_ms": 5000,
  "card_aspect": "3/4",
  "card_basis_px": 160,
  "gap_px": 12,
  "radius_px": 16,
  "open_links_new_tab": false
}'::jsonb
WHERE id = 1
  AND (
    success_carousel_settings IS NULL
    OR success_carousel_settings = '{}'::jsonb
    OR NOT (success_carousel_settings ? 'enabled')
  );

CREATE TABLE IF NOT EXISTS public.success_story_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID UNIQUE REFERENCES public.blood_requests(id) ON DELETE SET NULL,
  district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL,
  blood_group TEXT NOT NULL DEFAULT '',
  patient_name TEXT NOT NULL DEFAULT '',
  hospital TEXT NOT NULL DEFAULT '',
  bags_needed INT NOT NULL DEFAULT 1,
  location_label TEXT NOT NULL DEFAULT '',
  notes_excerpt TEXT NOT NULL DEFAULT '',
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  title_bn TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  link_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS success_story_slides_active_order_idx
  ON public.success_story_slides (is_active, sort_order ASC, completed_at DESC);

CREATE INDEX IF NOT EXISTS success_story_slides_district_idx
  ON public.success_story_slides (district_id);

ALTER TABLE public.success_story_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "success_story_slides_public_read" ON public.success_story_slides;
CREATE POLICY "success_story_slides_public_read" ON public.success_story_slides
  FOR SELECT
  USING (
    is_active = true
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS "success_story_slides_admin_write" ON public.success_story_slides;
CREATE POLICY "success_story_slides_admin_write" ON public.success_story_slides
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  );

GRANT SELECT ON public.success_story_slides TO authenticated, anon;
GRANT ALL ON public.success_story_slides TO service_role;

DROP TRIGGER IF EXISTS trg_success_story_slides_updated ON public.success_story_slides;
CREATE TRIGGER trg_success_story_slides_updated
  BEFORE UPDATE ON public.success_story_slides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'success-carousel',
  'success-carousel',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "success_carousel_storage_read" ON storage.objects;
CREATE POLICY "success_carousel_storage_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'success-carousel');

DROP POLICY IF EXISTS "success_carousel_storage_insert" ON storage.objects;
CREATE POLICY "success_carousel_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'success-carousel'
    AND (public.has_role(auth.uid(), 'admin') OR public.is_admin_staff(auth.uid()))
  );

DROP POLICY IF EXISTS "success_carousel_storage_update" ON storage.objects;
CREATE POLICY "success_carousel_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'success-carousel'
    AND (public.has_role(auth.uid(), 'admin') OR public.is_admin_staff(auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'success-carousel'
    AND (public.has_role(auth.uid(), 'admin') OR public.is_admin_staff(auth.uid()))
  );

DROP POLICY IF EXISTS "success_carousel_storage_delete" ON storage.objects;
CREATE POLICY "success_carousel_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'success-carousel'
    AND (public.has_role(auth.uid(), 'admin') OR public.is_admin_staff(auth.uid()))
  );

CREATE OR REPLACE FUNCTION public.snapshot_success_story_from_request(p_request_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  dist_bn TEXT;
  dist_en TEXT;
  loc TEXT;
  notes_clean TEXT;
  next_order INT;
  slide_id UUID;
  hosp TEXT;
BEGIN
  SELECT
    br.id,
    br.blood_group,
    COALESCE(br.patient_name, '') AS patient_name,
    COALESCE(br.hospital_name, '') AS hospital_name,
    COALESCE(br.bags_needed, 1) AS bags_needed,
    br.district_id,
    COALESCE(br.area, '') AS area,
    COALESCE(br.city, '') AS city,
    COALESCE(br.notes, '') AS notes,
    br.image_url,
    br.status
  INTO r
  FROM public.blood_requests br
  WHERE br.id = p_request_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  IF r.status IS DISTINCT FROM 'fulfilled' THEN
    RETURN NULL;
  END IF;

  SELECT id INTO slide_id FROM public.success_story_slides WHERE request_id = p_request_id;
  IF slide_id IS NOT NULL THEN
    RETURN slide_id;
  END IF;

  SELECT d.name_bn, d.name_en INTO dist_bn, dist_en
  FROM public.districts d
  WHERE d.id = r.district_id;

  hosp := COALESCE(nullif(trim(r.hospital_name), ''), '');
  loc := trim(both ' · ' FROM concat_ws(
    ' · ',
    nullif(hosp, ''),
    nullif(trim(r.area), ''),
    COALESCE(nullif(trim(dist_bn), ''), nullif(trim(dist_en), ''), nullif(trim(r.city), ''))
  ));

  notes_clean := left(trim(regexp_replace(COALESCE(r.notes, ''), '\[PostStyle:[^\]]*\]', '', 'g')), 160);

  SELECT COALESCE(MAX(sort_order), 0) + 10 INTO next_order FROM public.success_story_slides;

  INSERT INTO public.success_story_slides (
    request_id,
    district_id,
    blood_group,
    patient_name,
    hospital,
    bags_needed,
    location_label,
    notes_excerpt,
    completed_at,
    title_bn,
    title_en,
    image_url,
    link_url,
    sort_order,
    is_active
  )
  VALUES (
    p_request_id,
    r.district_id,
    COALESCE(r.blood_group, ''),
    COALESCE(r.patient_name, ''),
    hosp,
    GREATEST(1, COALESCE(r.bags_needed, 1)),
    COALESCE(loc, ''),
    COALESCE(notes_clean, ''),
    now(),
    CASE
      WHEN nullif(trim(COALESCE(r.blood_group, '')), '') IS NOT NULL
        THEN r.blood_group || ' রক্তদান সম্পন্ন'
      ELSE 'রক্তদান সম্পন্ন'
    END,
    CASE
      WHEN nullif(trim(COALESCE(r.blood_group, '')), '') IS NOT NULL
        THEN r.blood_group || ' donation completed'
      ELSE 'Donation completed'
    END,
    nullif(trim(COALESCE(r.image_url, '')), ''),
    '/home?requestId=' || p_request_id::text,
    next_order,
    true
  )
  RETURNING id INTO slide_id;

  RETURN slide_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_blood_requests_success_story()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'fulfilled' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'fulfilled') THEN
    PERFORM public.snapshot_success_story_from_request(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blood_requests_success_story ON public.blood_requests;
CREATE TRIGGER blood_requests_success_story
  AFTER INSERT OR UPDATE OF status ON public.blood_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_blood_requests_success_story();

GRANT EXECUTE ON FUNCTION public.snapshot_success_story_from_request(UUID) TO authenticated, service_role;
