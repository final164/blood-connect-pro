-- Ensure every district has a "{District} Sadar" / "{জেলা} সদর" upazila.
-- Safe to re-run (skips existing district_id + slug pairs).

INSERT INTO public.upazilas (district_id, name_bn, name_en, slug, sort_order, is_active)
SELECT
  d.id,
  d.name_bn || ' সদর',
  d.name_en || ' Sadar',
  regexp_replace(lower(replace(replace(d.name_en, '''', ''), '’', '')), '[^a-z0-9]+', '-', 'g')
    || '-sadar',
  0,
  true
FROM public.districts d
WHERE d.is_active = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.upazilas u
    WHERE u.district_id = d.id
      AND (
        lower(u.name_en) = lower(d.name_en || ' Sadar')
        OR lower(u.name_en) = 'sadar'
        OR u.slug = regexp_replace(lower(replace(replace(d.name_en, '''', ''), '’', '')), '[^a-z0-9]+', '-', 'g') || '-sadar'
        OR lower(u.name_en) LIKE '%city corporation%'
      )
  )
ON CONFLICT (district_id, slug) DO NOTHING;
