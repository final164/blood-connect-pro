-- Feed image carousel (horizontal slides between posts)
-- Run in Supabase SQL Editor, or rely on matching migration.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS feed_carousel_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_settings
SET feed_carousel_settings = '{
  "enabled": true,
  "insert_after_every": 2,
  "title_bn": "হাইলাইটস",
  "title_en": "Highlights",
  "show_header": true,
  "show_nav_arrows": true,
  "show_item_menu": false,
  "loop": true,
  "autoplay": false,
  "autoplay_ms": 4500,
  "card_aspect": "2/3",
  "card_basis_px": 128,
  "gap_px": 10,
  "radius_px": 14,
  "open_links_new_tab": true
}'::jsonb
WHERE id = 1
  AND (
    feed_carousel_settings IS NULL
    OR feed_carousel_settings = '{}'::jsonb
    OR NOT (feed_carousel_settings ? 'enabled')
  );

CREATE TABLE IF NOT EXISTS public.feed_carousel_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url TEXT NOT NULL,
  title_bn TEXT NOT NULL DEFAULT '',
  title_en TEXT NOT NULL DEFAULT '',
  link_url TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS feed_carousel_slides_active_order_idx
  ON public.feed_carousel_slides (is_active, sort_order ASC, created_at DESC);

ALTER TABLE public.feed_carousel_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_carousel_slides_public_read" ON public.feed_carousel_slides;
CREATE POLICY "feed_carousel_slides_public_read" ON public.feed_carousel_slides
  FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin') OR public.is_admin_staff(auth.uid()));

DROP POLICY IF EXISTS "feed_carousel_slides_admin_write" ON public.feed_carousel_slides;
CREATE POLICY "feed_carousel_slides_admin_write" ON public.feed_carousel_slides
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  );

-- Public storage bucket for carousel images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feed-carousel',
  'feed-carousel',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "feed_carousel_storage_read" ON storage.objects;
CREATE POLICY "feed_carousel_storage_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'feed-carousel');

DROP POLICY IF EXISTS "feed_carousel_storage_insert" ON storage.objects;
CREATE POLICY "feed_carousel_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feed-carousel'
    AND (public.has_role(auth.uid(), 'admin') OR public.is_admin_staff(auth.uid()))
  );

DROP POLICY IF EXISTS "feed_carousel_storage_update" ON storage.objects;
CREATE POLICY "feed_carousel_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'feed-carousel'
    AND (public.has_role(auth.uid(), 'admin') OR public.is_admin_staff(auth.uid()))
  )
  WITH CHECK (
    bucket_id = 'feed-carousel'
    AND (public.has_role(auth.uid(), 'admin') OR public.is_admin_staff(auth.uid()))
  );

DROP POLICY IF EXISTS "feed_carousel_storage_delete" ON storage.objects;
CREATE POLICY "feed_carousel_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'feed-carousel'
    AND (public.has_role(auth.uid(), 'admin') OR public.is_admin_staff(auth.uid()))
  );
