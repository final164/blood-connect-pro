-- Proximity ranking: district/upazila neighbor graphs + hop precompute + fetch_ranked_feed rewrite
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS public.district_neighbors (
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  neighbor_district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  PRIMARY KEY (district_id, neighbor_district_id),
  CONSTRAINT district_neighbors_ordered CHECK (district_id < neighbor_district_id)
);

CREATE TABLE IF NOT EXISTS public.upazila_neighbors (
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  upazila_slug_a TEXT NOT NULL,
  upazila_slug_b TEXT NOT NULL,
  weight REAL NOT NULL DEFAULT 1.0,
  PRIMARY KEY (district_id, upazila_slug_a, upazila_slug_b),
  CONSTRAINT upazila_neighbors_ordered CHECK (upazila_slug_a < upazila_slug_b)
);

CREATE TABLE IF NOT EXISTS public.upazila_geo_distance (
  district_id UUID NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
  upazila_slug_a TEXT NOT NULL,
  upazila_slug_b TEXT NOT NULL,
  hops INT NOT NULL CHECK (hops BETWEEN 1 AND 2),
  PRIMARY KEY (district_id, upazila_slug_a, upazila_slug_b),
  CONSTRAINT upazila_geo_distance_ordered CHECK (upazila_slug_a < upazila_slug_b)
);

CREATE INDEX IF NOT EXISTS district_neighbors_nbr_idx
  ON public.district_neighbors (neighbor_district_id, district_id);
CREATE INDEX IF NOT EXISTS upazila_geo_distance_lookup_idx
  ON public.upazila_geo_distance (district_id, upazila_slug_a, upazila_slug_b, hops);

ALTER TABLE public.district_neighbors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upazila_neighbors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upazila_geo_distance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS district_neighbors_read ON public.district_neighbors;
CREATE POLICY district_neighbors_read ON public.district_neighbors
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS upazila_neighbors_read ON public.upazila_neighbors;
CREATE POLICY upazila_neighbors_read ON public.upazila_neighbors
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS upazila_geo_distance_read ON public.upazila_geo_distance;
CREATE POLICY upazila_geo_distance_read ON public.upazila_geo_distance
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS district_neighbors_admin ON public.district_neighbors;
CREATE POLICY district_neighbors_admin ON public.district_neighbors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS upazila_neighbors_admin ON public.upazila_neighbors;
CREATE POLICY upazila_neighbors_admin ON public.upazila_neighbors
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS upazila_geo_distance_admin ON public.upazila_geo_distance;
CREATE POLICY upazila_geo_distance_admin ON public.upazila_geo_distance
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.district_neighbors TO authenticated, anon;
GRANT SELECT ON public.upazila_neighbors TO authenticated, anon;
GRANT SELECT ON public.upazila_geo_distance TO authenticated, anon;
GRANT ALL ON public.district_neighbors TO service_role;
GRANT ALL ON public.upazila_neighbors TO service_role;
GRANT ALL ON public.upazila_geo_distance TO service_role;

-- Resolve free-text area → upazila slug within a district (EN / BN / slug)
CREATE OR REPLACE FUNCTION public.resolve_upazila_slug(
  p_district UUID,
  p_area TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT u.slug
      FROM public.upazilas u
      WHERE p_district IS NOT NULL
        AND u.district_id = p_district
        AND u.is_active = true
        AND (
          lower(trim(u.name_en)) = lower(trim(p_area))
          OR lower(trim(u.name_bn)) = lower(trim(p_area))
          OR u.slug = lower(trim(regexp_replace(p_area, '[^a-zA-Z0-9]+', '-', 'g')))
        )
      ORDER BY u.sort_order
      LIMIT 1
    ),
    NULLIF(
      trim(both '-' from lower(regexp_replace(COALESCE(p_area, ''), '[^a-zA-Z0-9]+', '-', 'g'))),
      ''
    )
  );
$$;

-- Precompute hop-1 and hop-2 upazila distances (undirected, a < b)
CREATE OR REPLACE FUNCTION public.refresh_upazila_geo_distance()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT := 0;
BEGIN
  TRUNCATE public.upazila_geo_distance;

  INSERT INTO public.upazila_geo_distance (district_id, upazila_slug_a, upazila_slug_b, hops)
  SELECT district_id, upazila_slug_a, upazila_slug_b, 1
  FROM public.upazila_neighbors
  WHERE upazila_slug_a < upazila_slug_b
  ON CONFLICT DO NOTHING;

  INSERT INTO public.upazila_geo_distance (district_id, upazila_slug_a, upazila_slug_b, hops)
  SELECT DISTINCT
    e1.district_id,
    LEAST(e1.a, e2.b),
    GREATEST(e1.a, e2.b),
    2
  FROM (
    SELECT district_id, upazila_slug_a AS a, upazila_slug_b AS b FROM public.upazila_neighbors
    UNION ALL
    SELECT district_id, upazila_slug_b AS a, upazila_slug_a AS b FROM public.upazila_neighbors
  ) e1
  JOIN (
    SELECT district_id, upazila_slug_a AS a, upazila_slug_b AS b FROM public.upazila_neighbors
    UNION ALL
    SELECT district_id, upazila_slug_b AS a, upazila_slug_a AS b FROM public.upazila_neighbors
  ) e2
    ON e1.district_id = e2.district_id
   AND e1.b = e2.a
   AND e1.a <> e2.b
  WHERE LEAST(e1.a, e2.b) < GREATEST(e1.a, e2.b)
    AND NOT EXISTS (
      SELECT 1 FROM public.upazila_geo_distance d
      WHERE d.district_id = e1.district_id
        AND d.upazila_slug_a = LEAST(e1.a, e2.b)
        AND d.upazila_slug_b = GREATEST(e1.a, e2.b)
    )
  ON CONFLICT DO NOTHING;

  SELECT COUNT(*)::INT INTO n FROM public.upazila_geo_distance;
  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.refresh_upazila_geo_distance() TO authenticated;
GRANT EXECUTE ON FUNCTION public.refresh_upazila_geo_distance() TO service_role;
GRANT EXECUTE ON FUNCTION public.resolve_upazila_slug(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_upazila_slug(UUID, TEXT) TO service_role;

-- Seed district neighbors from slug pairs
INSERT INTO public.district_neighbors (district_id, neighbor_district_id)
SELECT LEAST(a.id, b.id), GREATEST(a.id, b.id)
FROM (VALUES
  ('dhaka', 'gazipur'),
  ('dhaka', 'narayanganj'),
  ('dhaka', 'manikganj'),
  ('dhaka', 'munshiganj'),
  ('dhaka', 'narsingdi'),
  ('dhaka', 'rajbari'),
  ('gazipur', 'tangail'),
  ('gazipur', 'mymensingh'),
  ('gazipur', 'narsingdi'),
  ('gazipur', 'kishoreganj'),
  ('narayanganj', 'munshiganj'),
  ('narayanganj', 'narsingdi'),
  ('narayanganj', 'brahmanbaria'),
  ('manikganj', 'tangail'),
  ('manikganj', 'rajbari'),
  ('munshiganj', 'madaripur'),
  ('munshiganj', 'shariatpur'),
  ('narsingdi', 'kishoreganj'),
  ('narsingdi', 'brahmanbaria'),
  ('tangail', 'jamalpur'),
  ('tangail', 'sirajganj'),
  ('kishoreganj', 'netrokona'),
  ('kishoreganj', 'mymensingh'),
  ('kishoreganj', 'brahmanbaria'),
  ('kishoreganj', 'habiganj'),
  ('faridpur', 'rajbari'),
  ('faridpur', 'madaripur'),
  ('faridpur', 'gopalganj'),
  ('faridpur', 'magura'),
  ('gopalganj', 'madaripur'),
  ('gopalganj', 'barishal'),
  ('gopalganj', 'pirojpur'),
  ('madaripur', 'shariatpur'),
  ('madaripur', 'barishal'),
  ('shariatpur', 'chandpur'),
  ('shariatpur', 'barishal'),
  ('rajbari', 'kushtia'),
  ('rajbari', 'jhenaidah'),
  ('chattogram', 'coxs-bazar'),
  ('chattogram', 'rangamati'),
  ('chattogram', 'bandarban'),
  ('chattogram', 'khagrachhari'),
  ('chattogram', 'feni'),
  ('chattogram', 'noakhali'),
  ('coxs-bazar', 'bandarban'),
  ('cumilla', 'brahmanbaria'),
  ('cumilla', 'chandpur'),
  ('cumilla', 'feni'),
  ('cumilla', 'noakhali'),
  ('feni', 'noakhali'),
  ('noakhali', 'lakshmipur'),
  ('noakhali', 'chandpur'),
  ('lakshmipur', 'chandpur'),
  ('chandpur', 'barishal'),
  ('brahmanbaria', 'habiganj'),
  ('rangamati', 'khagrachhari'),
  ('rangamati', 'bandarban'),
  ('khagrachhari', 'bandarban'),
  ('rajshahi', 'natore'),
  ('rajshahi', 'naogaon'),
  ('rajshahi', 'chapainawabganj'),
  ('natore', 'pabna'),
  ('natore', 'sirajganj'),
  ('natore', 'bogura'),
  ('natore', 'naogaon'),
  ('naogaon', 'joypurhat'),
  ('naogaon', 'chapainawabganj'),
  ('pabna', 'sirajganj'),
  ('pabna', 'kushtia'),
  ('sirajganj', 'bogura'),
  ('sirajganj', 'tangail'),
  ('bogura', 'joypurhat'),
  ('bogura', 'gaibandha'),
  ('joypurhat', 'dinajpur'),
  ('joypurhat', 'gaibandha'),
  ('khulna', 'bagerhat'),
  ('khulna', 'satkhira'),
  ('khulna', 'jashore'),
  ('bagerhat', 'pirojpur'),
  ('bagerhat', 'gopalganj'),
  ('satkhira', 'jashore'),
  ('jashore', 'jhenaidah'),
  ('jashore', 'narail'),
  ('jashore', 'magura'),
  ('jhenaidah', 'magura'),
  ('jhenaidah', 'kushtia'),
  ('jhenaidah', 'chuadanga'),
  ('magura', 'narail'),
  ('narail', 'gopalganj'),
  ('kushtia', 'chuadanga'),
  ('kushtia', 'meherpur'),
  ('chuadanga', 'meherpur'),
  ('barishal', 'bhola'),
  ('barishal', 'patuakhali'),
  ('barishal', 'jhalokati'),
  ('barishal', 'pirojpur'),
  ('bhola', 'patuakhali'),
  ('patuakhali', 'barguna'),
  ('pirojpur', 'jhalokati'),
  ('pirojpur', 'barguna'),
  ('jhalokati', 'patuakhali'),
  ('barguna', 'pirojpur'),
  ('sylhet', 'moulvibazar'),
  ('sylhet', 'habiganj'),
  ('sylhet', 'sunamganj'),
  ('moulvibazar', 'habiganj'),
  ('habiganj', 'sunamganj'),
  ('habiganj', 'netrokona'),
  ('sunamganj', 'netrokona'),
  ('rangpur', 'dinajpur'),
  ('rangpur', 'nilphamari'),
  ('rangpur', 'lalmonirhat'),
  ('rangpur', 'kurigram'),
  ('rangpur', 'gaibandha'),
  ('dinajpur', 'thakurgaon'),
  ('dinajpur', 'nilphamari'),
  ('dinajpur', 'gaibandha'),
  ('nilphamari', 'lalmonirhat'),
  ('nilphamari', 'panchagarh'),
  ('gaibandha', 'kurigram'),
  ('gaibandha', 'jamalpur'),
  ('kurigram', 'lalmonirhat'),
  ('thakurgaon', 'panchagarh'),
  ('thakurgaon', 'dinajpur'),
  ('panchagarh', 'nilphamari'),
  ('mymensingh', 'jamalpur'),
  ('mymensingh', 'sherpur'),
  ('mymensingh', 'netrokona'),
  ('jamalpur', 'sherpur'),
  ('netrokona', 'sunamganj')
) AS v(slug_a, slug_b)
JOIN public.districts a ON a.slug = v.slug_a
JOIN public.districts b ON b.slug = v.slug_b
WHERE a.id <> b.id
ON CONFLICT DO NOTHING;

-- Sadar-star: connect every upazila to its district Sadar
INSERT INTO public.upazila_neighbors (district_id, upazila_slug_a, upazila_slug_b, weight)
SELECT
  s.district_id,
  LEAST(s.slug, u.slug),
  GREATEST(s.slug, u.slug),
  1.0
FROM public.upazilas s
JOIN public.upazilas u
  ON u.district_id = s.district_id
 AND u.slug <> s.slug
WHERE s.is_active = true
  AND u.is_active = true
  AND (
    lower(s.name_en) LIKE '% sadar'
    OR lower(s.name_en) = 'sadar'
    OR s.slug LIKE '%-sadar'
    OR s.slug = 'sadar'
  )
ON CONFLICT DO NOTHING;

-- Dhaka metro dense edges
INSERT INTO public.upazila_neighbors (district_id, upazila_slug_a, upazila_slug_b, weight)
SELECT d.id, v.slug_a, v.slug_b, 1.0
FROM (VALUES
  ('dhaka', 'mirpur', 'pallabi'),
  ('dhaka', 'kafrul', 'mirpur'),
  ('dhaka', 'cantonment', 'mirpur'),
  ('dhaka', 'mirpur', 'mohammadpur'),
  ('dhaka', 'adabor', 'mirpur'),
  ('dhaka', 'pallabi', 'turag'),
  ('dhaka', 'airport', 'pallabi'),
  ('dhaka', 'cantonment', 'kafrul'),
  ('dhaka', 'agargaon', 'kafrul'),
  ('dhaka', 'airport', 'cantonment'),
  ('dhaka', 'banani', 'cantonment'),
  ('dhaka', 'cantonment', 'mohakhali'),
  ('dhaka', 'airport', 'uttara'),
  ('dhaka', 'airport', 'dakshinkhan'),
  ('dhaka', 'airport', 'khilkhet'),
  ('dhaka', 'dakshinkhan', 'uttara'),
  ('dhaka', 'turag', 'uttara'),
  ('dhaka', 'khilkhet', 'uttara'),
  ('dhaka', 'dakshinkhan', 'khilkhet'),
  ('dhaka', 'badda', 'khilkhet'),
  ('dhaka', 'bashundhara', 'khilkhet'),
  ('dhaka', 'banani', 'gulshan'),
  ('dhaka', 'banani', 'mohakhali'),
  ('dhaka', 'banani', 'baridhara'),
  ('dhaka', 'baridhara', 'gulshan'),
  ('dhaka', 'badda', 'gulshan'),
  ('dhaka', 'gulshan', 'mohakhali'),
  ('dhaka', 'baridhara', 'bashundhara'),
  ('dhaka', 'badda', 'baridhara'),
  ('dhaka', 'badda', 'bashundhara'),
  ('dhaka', 'badda', 'rampura'),
  ('dhaka', 'badda', 'hatirjheel'),
  ('dhaka', 'mohakhali', 'tejgaon'),
  ('dhaka', 'hatirjheel', 'mohakhali'),
  ('dhaka', 'farmgate', 'tejgaon'),
  ('dhaka', 'agargaon', 'tejgaon'),
  ('dhaka', 'hatirjheel', 'tejgaon'),
  ('dhaka', 'farmgate', 'panthapath'),
  ('dhaka', 'farmgate', 'kalabagan'),
  ('dhaka', 'elephant-road', 'farmgate'),
  ('dhaka', 'kalabagan', 'panthapath'),
  ('dhaka', 'dhanmondi', 'panthapath'),
  ('dhaka', 'dhanmondi', 'kalabagan'),
  ('dhaka', 'dhanmondi', 'lalmatia'),
  ('dhaka', 'dhanmondi', 'mohammadpur'),
  ('dhaka', 'dhanmondi', 'elephant-road'),
  ('dhaka', 'dhanmondi', 'new-market'),
  ('dhaka', 'elephant-road', 'kalabagan'),
  ('dhaka', 'lalmatia', 'mohammadpur'),
  ('dhaka', 'adabor', 'lalmatia'),
  ('dhaka', 'adabor', 'mohammadpur'),
  ('dhaka', 'hazaribagh', 'mohammadpur'),
  ('dhaka', 'adabor', 'hazaribagh'),
  ('dhaka', 'azimpur', 'new-market'),
  ('dhaka', 'elephant-road', 'new-market'),
  ('dhaka', 'lalbagh', 'new-market'),
  ('dhaka', 'azimpur', 'lalbagh'),
  ('dhaka', 'azimpur', 'hazaribagh'),
  ('dhaka', 'new-market', 'shahbag'),
  ('dhaka', 'eskaton', 'shahbag'),
  ('dhaka', 'kakrail', 'shahbag'),
  ('dhaka', 'paltan', 'shahbag'),
  ('dhaka', 'eskaton', 'moghbazar'),
  ('dhaka', 'eskaton', 'kakrail'),
  ('dhaka', 'kakrail', 'shantinagar'),
  ('dhaka', 'kakrail', 'paltan'),
  ('dhaka', 'kakrail', 'moghbazar'),
  ('dhaka', 'motijheel', 'paltan'),
  ('dhaka', 'paltan', 'shantinagar'),
  ('dhaka', 'kotwali', 'motijheel'),
  ('dhaka', 'motijheel', 'wari'),
  ('dhaka', 'bangshal', 'motijheel'),
  ('dhaka', 'bangshal', 'kotwali'),
  ('dhaka', 'kotwali', 'sutrapur'),
  ('dhaka', 'kotwali', 'lalbagh'),
  ('dhaka', 'bangshal', 'lalbagh'),
  ('dhaka', 'hazaribagh', 'lalbagh'),
  ('dhaka', 'kamrangirchar', 'lalbagh'),
  ('dhaka', 'gendaria', 'wari'),
  ('dhaka', 'sutrapur', 'wari'),
  ('dhaka', 'gendaria', 'jatrabari'),
  ('dhaka', 'demra', 'gendaria'),
  ('dhaka', 'gendaria', 'sutrapur'),
  ('dhaka', 'malibagh', 'shantinagar'),
  ('dhaka', 'malibagh', 'moghbazar'),
  ('dhaka', 'malibagh', 'rampura'),
  ('dhaka', 'malibagh', 'rajarbagh'),
  ('dhaka', 'rajarbagh', 'shantinagar'),
  ('dhaka', 'moghbazar', 'shantinagar'),
  ('dhaka', 'moghbazar', 'rampura'),
  ('dhaka', 'khilgaon', 'rampura'),
  ('dhaka', 'hatirjheel', 'rampura'),
  ('dhaka', 'khilgaon', 'mugda'),
  ('dhaka', 'khilgaon', 'sabujbagh'),
  ('dhaka', 'mugda', 'sabujbagh'),
  ('dhaka', 'jatrabari', 'mugda'),
  ('dhaka', 'demra', 'sabujbagh'),
  ('dhaka', 'demra', 'jatrabari'),
  ('dhaka', 'agargaon', 'sher-e-bangla-nagar'),
  ('dhaka', 'mohammadpur', 'sher-e-bangla-nagar'),
  ('dhaka', 'farmgate', 'sher-e-bangla-nagar'),
  ('dhaka', 'dhamrai', 'savar'),
  ('dhaka', 'keraniganj', 'savar'),
  ('dhaka', 'mohammadpur', 'savar'),
  ('dhaka', 'hazaribagh', 'keraniganj'),
  ('dhaka', 'kamrangirchar', 'keraniganj'),
  ('dhaka', 'dohar', 'keraniganj'),
  ('dhaka', 'dohar', 'nawabganj'),
  ('dhaka', 'dhamrai', 'nawabganj'),
  ('dhaka', 'dhaka-sadar', 'shahbag'),
  ('dhaka', 'dhaka-sadar', 'motijheel'),
  ('dhaka', 'dhaka-sadar', 'paltan')
) AS v(district_slug, slug_a, slug_b)
JOIN public.districts d ON d.slug = v.district_slug
ON CONFLICT DO NOTHING;

SELECT public.refresh_upazila_geo_distance();

-- Ranked feed with hierarchical administrative proximity (geo_hop 0..5)
CREATE OR REPLACE FUNCTION public.fetch_ranked_feed(
  p_viewer UUID,
  p_limit INT DEFAULT 8,
  p_offset INT DEFAULT 0,
  p_blood TEXT DEFAULT NULL,
  p_district UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  requester_id UUID,
  patient_name TEXT,
  blood_group TEXT,
  bags_needed INT,
  hospital_name TEXT,
  hospital_id UUID,
  contact_phone TEXT,
  whatsapp_phone TEXT,
  needed_by TIMESTAMPTZ,
  urgency TEXT,
  status TEXT,
  notes TEXT,
  city TEXT,
  area TEXT,
  district_id UUID,
  need_reason_key TEXT,
  need_reason_label TEXT,
  like_count INT,
  comment_count INT,
  share_count INT,
  district_name_bn TEXT,
  district_name_en TEXT,
  rank_bucket INT,
  rank_score NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  cfg JSONB;
  v_blood TEXT;
  v_area TEXT;
  v_district UUID;
  v_slug TEXT;
  enabled BOOLEAN := true;
  prefer_own BOOLEAN := true;
  prefer_upazila BOOLEAN := true;
  prefer_blood BOOLEAN := true;
  prefer_proximity BOOLEAN := true;
  prefer_engagement BOOLEAN := true;
  prefer_urgency BOOLEAN := true;
  prefer_recency BOOLEAN := true;
  score_own NUMERIC := 1000000;
  score_exact NUMERIC := 200000;
  score_partial NUMERIC := 100000;
  score_blood_boost NUMERIC := 160000;
  score_geo0 NUMERIC := 500000;
  score_geo1 NUMERIC := 350000;
  score_geo2 NUMERIC := 250000;
  score_geo3 NUMERIC := 150000;
  score_geo4 NUMERIC := 80000;
  score_geo5 NUMERIC := 0;
  max_upazila_hops INT := 2;
  w_like NUMERIC := 25;
  w_comment NUMERIC := 40;
  w_share NUMERIC := 50;
  w_critical NUMERIC := 8000;
  w_urgent NUMERIC := 4000;
  w_normal NUMERIC := 0;
  recency_max NUMERIC := 5000;
  recency_hours NUMERIC := 72;
BEGIN
  SELECT COALESCE(a.feed_ranking_settings, '{}'::jsonb)
    INTO cfg
  FROM public.app_settings a
  WHERE a.id = 1;

  IF cfg ? 'enabled' THEN enabled := COALESCE((cfg->>'enabled')::boolean, true); END IF;
  IF cfg ? 'prefer_own' THEN prefer_own := COALESCE((cfg->>'prefer_own')::boolean, true); END IF;
  IF cfg ? 'prefer_upazila' THEN prefer_upazila := COALESCE((cfg->>'prefer_upazila')::boolean, true); END IF;
  IF cfg ? 'prefer_blood_group' THEN prefer_blood := COALESCE((cfg->>'prefer_blood_group')::boolean, true); END IF;
  IF cfg ? 'prefer_proximity' THEN prefer_proximity := COALESCE((cfg->>'prefer_proximity')::boolean, true); END IF;
  IF cfg ? 'prefer_engagement' THEN prefer_engagement := COALESCE((cfg->>'prefer_engagement')::boolean, true); END IF;
  IF cfg ? 'prefer_urgency' THEN prefer_urgency := COALESCE((cfg->>'prefer_urgency')::boolean, true); END IF;
  IF cfg ? 'prefer_recency' THEN prefer_recency := COALESCE((cfg->>'prefer_recency')::boolean, true); END IF;

  IF cfg ? 'score_own' THEN score_own := COALESCE((cfg->>'score_own')::numeric, score_own); END IF;
  IF cfg ? 'score_same_upazila_and_blood' THEN score_exact := COALESCE((cfg->>'score_same_upazila_and_blood')::numeric, score_exact); END IF;
  IF cfg ? 'score_same_upazila_or_blood' THEN score_partial := COALESCE((cfg->>'score_same_upazila_or_blood')::numeric, score_partial); END IF;
  IF cfg ? 'score_blood_boost' THEN score_blood_boost := COALESCE((cfg->>'score_blood_boost')::numeric, score_blood_boost); END IF;
  IF cfg ? 'score_geo_hop_0' THEN score_geo0 := COALESCE((cfg->>'score_geo_hop_0')::numeric, score_geo0); END IF;
  IF cfg ? 'score_geo_hop_1' THEN score_geo1 := COALESCE((cfg->>'score_geo_hop_1')::numeric, score_geo1); END IF;
  IF cfg ? 'score_geo_hop_2' THEN score_geo2 := COALESCE((cfg->>'score_geo_hop_2')::numeric, score_geo2); END IF;
  IF cfg ? 'score_geo_hop_3' THEN score_geo3 := COALESCE((cfg->>'score_geo_hop_3')::numeric, score_geo3); END IF;
  IF cfg ? 'score_geo_hop_4' THEN score_geo4 := COALESCE((cfg->>'score_geo_hop_4')::numeric, score_geo4); END IF;
  IF cfg ? 'score_geo_hop_5' THEN score_geo5 := COALESCE((cfg->>'score_geo_hop_5')::numeric, score_geo5); END IF;
  IF cfg ? 'max_upazila_hops' THEN max_upazila_hops := COALESCE((cfg->>'max_upazila_hops')::int, max_upazila_hops); END IF;
  IF cfg ? 'weight_like' THEN w_like := COALESCE((cfg->>'weight_like')::numeric, w_like); END IF;
  IF cfg ? 'weight_comment' THEN w_comment := COALESCE((cfg->>'weight_comment')::numeric, w_comment); END IF;
  IF cfg ? 'weight_share' THEN w_share := COALESCE((cfg->>'weight_share')::numeric, w_share); END IF;
  IF cfg ? 'weight_critical' THEN w_critical := COALESCE((cfg->>'weight_critical')::numeric, w_critical); END IF;
  IF cfg ? 'weight_urgent' THEN w_urgent := COALESCE((cfg->>'weight_urgent')::numeric, w_urgent); END IF;
  IF cfg ? 'weight_normal' THEN w_normal := COALESCE((cfg->>'weight_normal')::numeric, w_normal); END IF;
  IF cfg ? 'recency_max' THEN recency_max := COALESCE((cfg->>'recency_max')::numeric, recency_max); END IF;
  IF cfg ? 'recency_half_life_hours' THEN recency_hours := COALESCE((cfg->>'recency_half_life_hours')::numeric, recency_hours); END IF;

  IF p_viewer IS NOT NULL THEN
    SELECT p.blood_group::text, NULLIF(trim(p.area), ''), p.district_id
      INTO v_blood, v_area, v_district
    FROM public.profiles p
    WHERE p.id = p_viewer;
    v_slug := public.resolve_upazila_slug(v_district, v_area);
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      br.id AS req_id,
      br.created_at AS req_created_at,
      br.updated_at AS req_updated_at,
      br.requester_id AS req_requester_id,
      br.patient_name AS req_patient_name,
      br.blood_group AS req_blood_group,
      br.bags_needed AS req_bags_needed,
      br.hospital_name AS req_hospital_name,
      br.hospital_id AS req_hospital_id,
      br.contact_phone AS req_contact_phone,
      br.whatsapp_phone AS req_whatsapp_phone,
      br.needed_by AS req_needed_by,
      br.urgency AS req_urgency,
      br.status AS req_status,
      br.notes AS req_notes,
      br.city AS req_city,
      br.area AS req_area,
      br.district_id AS req_district_id,
      br.need_reason_key AS req_need_reason_key,
      br.need_reason_label AS req_need_reason_label,
      COALESCE(br.like_count, 0) AS req_like_count,
      COALESCE(br.comment_count, 0) AS req_comment_count,
      COALESCE(br.share_count, 0) AS req_share_count,
      d.name_bn AS d_bn,
      d.name_en AS d_en,
      public.resolve_upazila_slug(br.district_id, br.area) AS r_slug
    FROM public.blood_requests br
    LEFT JOIN public.districts d ON d.id = br.district_id
    WHERE br.status = 'open'
      AND (p_blood IS NULL OR p_blood = '' OR p_blood = 'ALL' OR br.blood_group::text = p_blood)
      AND (p_district IS NULL OR br.district_id = p_district)
  ),
  ranked AS (
    SELECT
      b.*,
      CASE
        WHEN NOT enabled THEN 3
        WHEN prefer_own AND p_viewer IS NOT NULL AND b.req_requester_id = p_viewer THEN -1
        WHEN prefer_proximity THEN
          CASE
            WHEN v_district IS NULL OR b.req_district_id IS NULL THEN 5
            WHEN b.req_district_id = v_district THEN
              CASE
                WHEN v_slug IS NOT NULL AND b.r_slug IS NOT NULL AND v_slug = b.r_slug THEN 0
                WHEN v_slug IS NOT NULL AND b.r_slug IS NOT NULL
                  AND max_upazila_hops >= 1
                  AND EXISTS (
                    SELECT 1 FROM public.upazila_geo_distance g
                    WHERE g.district_id = v_district
                      AND g.upazila_slug_a = LEAST(v_slug, b.r_slug)
                      AND g.upazila_slug_b = GREATEST(v_slug, b.r_slug)
                      AND g.hops = 1
                  ) THEN 1
                WHEN v_slug IS NOT NULL AND b.r_slug IS NOT NULL
                  AND max_upazila_hops >= 2
                  AND EXISTS (
                    SELECT 1 FROM public.upazila_geo_distance g
                    WHERE g.district_id = v_district
                      AND g.upazila_slug_a = LEAST(v_slug, b.r_slug)
                      AND g.upazila_slug_b = GREATEST(v_slug, b.r_slug)
                      AND g.hops = 2
                  ) THEN 2
                ELSE 3
              END
            WHEN EXISTS (
              SELECT 1 FROM public.district_neighbors dn
              WHERE dn.district_id = LEAST(v_district, b.req_district_id)
                AND dn.neighbor_district_id = GREATEST(v_district, b.req_district_id)
            ) THEN 4
            ELSE 5
          END
        WHEN prefer_upazila AND prefer_blood
          AND v_area IS NOT NULL AND NULLIF(trim(b.req_area), '') IS NOT NULL
          AND lower(trim(b.req_area)) = lower(v_area)
          AND v_blood IS NOT NULL AND b.req_blood_group::text = v_blood
          THEN 1
        WHEN (
          (prefer_upazila AND v_area IS NOT NULL AND NULLIF(trim(b.req_area), '') IS NOT NULL
            AND lower(trim(b.req_area)) = lower(v_area))
          OR (prefer_blood AND v_blood IS NOT NULL AND b.req_blood_group::text = v_blood)
        ) THEN 2
        ELSE 3
      END AS bucket,
      (
        CASE
          WHEN NOT enabled THEN 0::numeric
          WHEN prefer_own AND p_viewer IS NOT NULL AND b.req_requester_id = p_viewer THEN score_own
          WHEN prefer_proximity THEN
            CASE
              WHEN v_district IS NULL OR b.req_district_id IS NULL THEN score_geo5
              WHEN b.req_district_id = v_district THEN
                CASE
                  WHEN v_slug IS NOT NULL AND b.r_slug IS NOT NULL AND v_slug = b.r_slug THEN score_geo0
                  WHEN v_slug IS NOT NULL AND b.r_slug IS NOT NULL
                    AND max_upazila_hops >= 1
                    AND EXISTS (
                      SELECT 1 FROM public.upazila_geo_distance g
                      WHERE g.district_id = v_district
                        AND g.upazila_slug_a = LEAST(v_slug, b.r_slug)
                        AND g.upazila_slug_b = GREATEST(v_slug, b.r_slug)
                        AND g.hops = 1
                    ) THEN score_geo1
                  WHEN v_slug IS NOT NULL AND b.r_slug IS NOT NULL
                    AND max_upazila_hops >= 2
                    AND EXISTS (
                      SELECT 1 FROM public.upazila_geo_distance g
                      WHERE g.district_id = v_district
                        AND g.upazila_slug_a = LEAST(v_slug, b.r_slug)
                        AND g.upazila_slug_b = GREATEST(v_slug, b.r_slug)
                        AND g.hops = 2
                    ) THEN score_geo2
                  ELSE score_geo3
                END
              WHEN EXISTS (
                SELECT 1 FROM public.district_neighbors dn
                WHERE dn.district_id = LEAST(v_district, b.req_district_id)
                  AND dn.neighbor_district_id = GREATEST(v_district, b.req_district_id)
              ) THEN score_geo4
              ELSE score_geo5
            END
            + CASE
                WHEN prefer_blood AND v_blood IS NOT NULL AND b.req_blood_group::text = v_blood
                  THEN score_blood_boost
                ELSE 0::numeric
              END
          WHEN prefer_upazila AND prefer_blood
            AND v_area IS NOT NULL AND NULLIF(trim(b.req_area), '') IS NOT NULL
            AND lower(trim(b.req_area)) = lower(v_area)
            AND v_blood IS NOT NULL AND b.req_blood_group::text = v_blood
            THEN score_exact
          WHEN (
            (prefer_upazila AND v_area IS NOT NULL AND NULLIF(trim(b.req_area), '') IS NOT NULL
              AND lower(trim(b.req_area)) = lower(v_area))
            OR (prefer_blood AND v_blood IS NOT NULL AND b.req_blood_group::text = v_blood)
          ) THEN score_partial
          ELSE 0::numeric
        END
        + CASE
            WHEN NOT enabled OR NOT prefer_urgency THEN 0::numeric
            WHEN b.req_urgency::text = 'critical' THEN w_critical
            WHEN b.req_urgency::text = 'urgent' THEN w_urgent
            ELSE w_normal
          END
        + CASE
            WHEN NOT enabled OR NOT prefer_engagement THEN 0::numeric
            ELSE
              b.req_like_count * w_like
              + b.req_comment_count * w_comment
              + b.req_share_count * w_share
          END
        + CASE
            WHEN NOT enabled OR NOT prefer_recency OR recency_hours <= 0 THEN 0::numeric
            ELSE GREATEST(
              0::numeric,
              recency_max * (1 - LEAST(
                1::numeric,
                EXTRACT(EPOCH FROM (now() - b.req_created_at)) / NULLIF(recency_hours * 3600.0, 0)
              ))
            )
          END
      ) AS score
    FROM base b
  )
  SELECT
    r.req_id,
    r.req_created_at,
    r.req_updated_at,
    r.req_requester_id,
    r.req_patient_name,
    r.req_blood_group::text,
    r.req_bags_needed,
    r.req_hospital_name,
    r.req_hospital_id,
    r.req_contact_phone,
    r.req_whatsapp_phone,
    r.req_needed_by,
    r.req_urgency::text,
    r.req_status::text,
    r.req_notes,
    r.req_city,
    r.req_area,
    r.req_district_id,
    r.req_need_reason_key,
    r.req_need_reason_label,
    r.req_like_count,
    r.req_comment_count,
    r.req_share_count,
    r.d_bn,
    r.d_en,
    r.bucket,
    r.score
  FROM ranked r
  ORDER BY
    CASE WHEN enabled THEN r.bucket ELSE 0 END ASC,
    CASE WHEN enabled THEN r.score ELSE
      CASE r.req_urgency::text WHEN 'critical' THEN 2 WHEN 'urgent' THEN 1 ELSE 0 END
    END DESC,
    r.req_created_at DESC,
    r.req_id DESC
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 8), 50))
  OFFSET GREATEST(0, COALESCE(p_offset, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION public.fetch_ranked_feed(UUID, INT, INT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fetch_ranked_feed(UUID, INT, INT, TEXT, UUID) TO service_role;
