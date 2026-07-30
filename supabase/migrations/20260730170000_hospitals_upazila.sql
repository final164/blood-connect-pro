-- Add upazila column to hospitals + backfill from catalog slug patterns
ALTER TABLE public.hospitals
  ADD COLUMN IF NOT EXISTS upazila TEXT;

CREATE INDEX IF NOT EXISTS hospitals_district_upazila_idx
  ON public.hospitals (district_id, upazila);

COMMENT ON COLUMN public.hospitals.upazila IS
  'English upazila name (matches blood_requests.area / profiles.area)';

-- Backfill: sadar slug / name
UPDATE public.hospitals h
SET upazila = d.name_en || ' Sadar'
FROM public.districts d
WHERE h.district_id = d.id
  AND h.upazila IS NULL
  AND (
    h.slug LIKE '%-sadar'
    OR h.slug LIKE '%-sadar-%'
    OR h.slug LIKE '%-mcwc'
    OR h.slug LIKE '%-district-dx'
    OR h.slug LIKE '%-central-clinic'
    OR h.slug LIKE '%-sadar-pathology'
    OR h.slug LIKE '%-blood-bank-clinic'
    OR h.slug LIKE '%-community-clinic-sadar'
    OR h.slug LIKE '%-mch%'
    OR h.name_en ILIKE '%(Sadar)%'
    OR h.name_en ILIKE '% Sadar %'
  );

-- Named district HQ / chains without upazila suffix → Sadar
UPDATE public.hospitals h
SET upazila = d.name_en || ' Sadar'
FROM public.districts d
WHERE h.district_id = d.id
  AND h.upazila IS NULL
  AND h.slug !~ '(uhc|cc|dx|clinic|dental|private)-[a-z0-9-]+$';

-- Backfill from slug suffix: {district}-(uhc|cc|dx|clinic|dental|private)-{upazila-slug}
UPDATE public.hospitals h
SET upazila = initcap(replace(
  (regexp_match(h.slug, '(?:uhc|cc|dx|clinic|dental|private)-(.+)$'))[1],
  '-',
  ' '
))
WHERE h.upazila IS NULL
  AND h.slug ~ '(uhc|cc|dx|clinic|dental|private)-.+$';
