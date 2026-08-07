-- District-scoped feed carousel slides + community display settings

ALTER TABLE public.feed_carousel_slides
  ADD COLUMN IF NOT EXISTS district_id UUID REFERENCES public.districts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS feed_carousel_slides_district_idx
  ON public.feed_carousel_slides (district_id, is_active, sort_order);

UPDATE public.app_settings
SET feed_carousel_settings =
  COALESCE(feed_carousel_settings, '{}'::jsonb)
  || jsonb_build_object(
    'show_on_community', COALESCE((feed_carousel_settings->>'show_on_community')::boolean, true),
    'community_district_filter', COALESCE((feed_carousel_settings->>'community_district_filter')::boolean, true)
  )
WHERE id = 1;
