-- Full-width feed banner slider (one image at a time)
-- Run in Supabase SQL Editor if migration is not applied.

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS feed_banner_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_settings
SET feed_banner_settings = '{
  "enabled": true,
  "insert_after_posts": 4,
  "title_bn": "স্পটলাইট",
  "title_en": "Spotlight",
  "show_header": false,
  "show_nav_arrows": true,
  "show_dots": true,
  "show_captions": true,
  "loop": true,
  "autoplay": true,
  "autoplay_ms": 5000,
  "aspect_ratio": "16/9",
  "max_height_px": 280,
  "radius_px": 16,
  "open_links_new_tab": true
}'::jsonb
WHERE id = 1
  AND (
    feed_banner_settings IS NULL
    OR feed_banner_settings = '{}'::jsonb
    OR NOT (feed_banner_settings ? 'enabled')
  );

CREATE TABLE IF NOT EXISTS public.feed_banner_slides (
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

CREATE INDEX IF NOT EXISTS feed_banner_slides_active_order_idx
  ON public.feed_banner_slides (is_active, sort_order ASC, created_at DESC);

ALTER TABLE public.feed_banner_slides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "feed_banner_slides_public_read" ON public.feed_banner_slides;
CREATE POLICY "feed_banner_slides_public_read" ON public.feed_banner_slides
  FOR SELECT
  USING (is_active = true OR public.has_role(auth.uid(), 'admin') OR public.is_admin_staff(auth.uid()));

DROP POLICY IF EXISTS "feed_banner_slides_admin_write" ON public.feed_banner_slides;
CREATE POLICY "feed_banner_slides_admin_write" ON public.feed_banner_slides
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  );

-- Reuse feed-carousel bucket (created by feed-carousel.sql); ensure it exists
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
