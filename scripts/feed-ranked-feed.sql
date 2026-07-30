-- Feed personalized ranking: engagement counters + RPC + settings column

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS like_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comment_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_count INT NOT NULL DEFAULT 0;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS feed_ranking_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.app_settings.feed_ranking_settings IS
  'Personalized feed ranking weights and feature flags (admin Settings → Feed ranking)';

-- Backfill counters
UPDATE public.blood_requests br
SET like_count = COALESCE((
  SELECT COUNT(*)::INT FROM public.request_likes rl WHERE rl.request_id = br.id
), 0);

UPDATE public.blood_requests br
SET comment_count = COALESCE((
  SELECT COUNT(*)::INT FROM public.request_comments rc WHERE rc.request_id = br.id
), 0);

UPDATE public.blood_requests br
SET share_count = COALESCE((
  SELECT COUNT(*)::INT FROM public.request_shares rs WHERE rs.request_id = br.id
), 0);

-- Maintain counters
CREATE OR REPLACE FUNCTION public.trg_request_like_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.blood_requests SET like_count = like_count + 1 WHERE id = NEW.request_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.blood_requests SET like_count = GREATEST(0, like_count - 1) WHERE id = OLD.request_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_request_likes_count ON public.request_likes;
CREATE TRIGGER trg_request_likes_count
  AFTER INSERT OR DELETE ON public.request_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_request_like_count();

CREATE OR REPLACE FUNCTION public.trg_request_comment_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.blood_requests SET comment_count = comment_count + 1 WHERE id = NEW.request_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.blood_requests SET comment_count = GREATEST(0, comment_count - 1) WHERE id = OLD.request_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_request_comments_count ON public.request_comments;
CREATE TRIGGER trg_request_comments_count
  AFTER INSERT OR DELETE ON public.request_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_request_comment_count();

CREATE OR REPLACE FUNCTION public.trg_request_share_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.blood_requests SET share_count = share_count + 1 WHERE id = NEW.request_id;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_request_shares_count ON public.request_shares;
CREATE TRIGGER trg_request_shares_count
  AFTER INSERT ON public.request_shares
  FOR EACH ROW EXECUTE FUNCTION public.trg_request_share_count();

CREATE INDEX IF NOT EXISTS blood_requests_open_created_idx
  ON public.blood_requests (status, created_at DESC);

-- Ranked feed page
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
  enabled BOOLEAN := true;
  prefer_own BOOLEAN := true;
  prefer_upazila BOOLEAN := true;
  prefer_blood BOOLEAN := true;
  prefer_engagement BOOLEAN := true;
  prefer_urgency BOOLEAN := true;
  prefer_recency BOOLEAN := true;
  score_own NUMERIC := 1000000;
  score_exact NUMERIC := 200000;
  score_partial NUMERIC := 100000;
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
  IF cfg ? 'prefer_engagement' THEN prefer_engagement := COALESCE((cfg->>'prefer_engagement')::boolean, true); END IF;
  IF cfg ? 'prefer_urgency' THEN prefer_urgency := COALESCE((cfg->>'prefer_urgency')::boolean, true); END IF;
  IF cfg ? 'prefer_recency' THEN prefer_recency := COALESCE((cfg->>'prefer_recency')::boolean, true); END IF;

  IF cfg ? 'score_own' THEN score_own := COALESCE((cfg->>'score_own')::numeric, score_own); END IF;
  IF cfg ? 'score_same_upazila_and_blood' THEN score_exact := COALESCE((cfg->>'score_same_upazila_and_blood')::numeric, score_exact); END IF;
  IF cfg ? 'score_same_upazila_or_blood' THEN score_partial := COALESCE((cfg->>'score_same_upazila_or_blood')::numeric, score_partial); END IF;
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
  END IF;

  RETURN QUERY
  WITH ranked AS (
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
      CASE
        WHEN NOT enabled THEN 3
        WHEN prefer_own AND p_viewer IS NOT NULL AND br.requester_id = p_viewer THEN 0
        WHEN prefer_upazila AND prefer_blood
          AND v_area IS NOT NULL AND NULLIF(trim(br.area), '') IS NOT NULL
          AND lower(trim(br.area)) = lower(v_area)
          AND v_blood IS NOT NULL AND br.blood_group::text = v_blood
          THEN 1
        WHEN (
          (prefer_upazila AND v_area IS NOT NULL AND NULLIF(trim(br.area), '') IS NOT NULL
            AND lower(trim(br.area)) = lower(v_area))
          OR (prefer_blood AND v_blood IS NOT NULL AND br.blood_group::text = v_blood)
        ) THEN 2
        ELSE 3
      END AS bucket,
      (
        CASE
          WHEN NOT enabled THEN 0::numeric
          WHEN prefer_own AND p_viewer IS NOT NULL AND br.requester_id = p_viewer THEN score_own
          WHEN prefer_upazila AND prefer_blood
            AND v_area IS NOT NULL AND NULLIF(trim(br.area), '') IS NOT NULL
            AND lower(trim(br.area)) = lower(v_area)
            AND v_blood IS NOT NULL AND br.blood_group::text = v_blood
            THEN score_exact
          WHEN (
            (prefer_upazila AND v_area IS NOT NULL AND NULLIF(trim(br.area), '') IS NOT NULL
              AND lower(trim(br.area)) = lower(v_area))
            OR (prefer_blood AND v_blood IS NOT NULL AND br.blood_group::text = v_blood)
          ) THEN score_partial
          ELSE 0::numeric
        END
        + CASE
            WHEN NOT enabled OR NOT prefer_urgency THEN 0::numeric
            WHEN br.urgency::text = 'critical' THEN w_critical
            WHEN br.urgency::text = 'urgent' THEN w_urgent
            ELSE w_normal
          END
        + CASE
            WHEN NOT enabled OR NOT prefer_engagement THEN 0::numeric
            ELSE
              COALESCE(br.like_count, 0) * w_like
              + COALESCE(br.comment_count, 0) * w_comment
              + COALESCE(br.share_count, 0) * w_share
          END
        + CASE
            WHEN NOT enabled OR NOT prefer_recency OR recency_hours <= 0 THEN 0::numeric
            ELSE GREATEST(
              0::numeric,
              recency_max * (1 - LEAST(
                1::numeric,
                EXTRACT(EPOCH FROM (now() - br.created_at)) / NULLIF(recency_hours * 3600.0, 0)
              ))
            )
          END
      ) AS score
    FROM public.blood_requests br
    LEFT JOIN public.districts d ON d.id = br.district_id
    WHERE br.status = 'open'
      AND (p_blood IS NULL OR p_blood = '' OR p_blood = 'ALL' OR br.blood_group::text = p_blood)
      AND (p_district IS NULL OR br.district_id = p_district)
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
