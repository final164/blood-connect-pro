-- Muktosheba Rewards V1: ledger + balances + award RPC + signup/post/donation/fulfill triggers.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS rewards_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.app_settings
SET rewards_settings = COALESCE(NULLIF(rewards_settings, '{}'::jsonb), '{
  "enabled": true,
  "signup_points": 50,
  "post_request_points": 20,
  "donation_confirmed_points": 2000,
  "request_fulfilled_points": 30,
  "like_points": 2,
  "comment_points": 5,
  "share_points": 8,
  "enable_signup": true,
  "enable_post_request": true,
  "enable_donation_confirmed": true,
  "enable_request_fulfilled": true,
  "enable_like": false,
  "enable_comment": false,
  "enable_share": false,
  "daily_earn_cap": 400,
  "post_daily_cap": 3,
  "engage_daily_cap": 20,
  "levels": [
    {"level": 1, "min_lifetime": 0, "name_bn": "নবীন", "name_en": "Newcomer"},
    {"level": 2, "min_lifetime": 100, "name_bn": "সহযোগী", "name_en": "Helper"},
    {"level": 3, "min_lifetime": 500, "name_bn": "অভিযাত্রী", "name_en": "Trailblazer"},
    {"level": 4, "min_lifetime": 2000, "name_bn": "রক্তযোদ্ধা", "name_en": "Blood Warrior"},
    {"level": 5, "min_lifetime": 5000, "name_bn": "রক্ষক", "name_en": "Guardian"},
    {"level": 6, "min_lifetime": 10000, "name_bn": "লিজেন্ড", "name_en": "Legend"}
  ]
}'::jsonb)
WHERE id = 1;

-- ---------------------------------------------------------------------------
-- Profile balances
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS reward_points INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_lifetime_earned INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reward_level INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS profiles_reward_lifetime_idx
  ON public.profiles (reward_lifetime_earned DESC);

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reward_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points INT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('earn', 'spend', 'adjust', 'expire')),
  action TEXT NOT NULL,
  event_key TEXT NOT NULL,
  ref_type TEXT,
  ref_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reward_ledger_event_key_unique UNIQUE (event_key)
);

CREATE INDEX IF NOT EXISTS reward_ledger_user_created_idx
  ON public.reward_ledger (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS reward_ledger_action_created_idx
  ON public.reward_ledger (action, created_at DESC);

ALTER TABLE public.reward_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reward_ledger_select_own" ON public.reward_ledger;
CREATE POLICY "reward_ledger_select_own" ON public.reward_ledger
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

DROP POLICY IF EXISTS "reward_ledger_admin_all" ON public.reward_ledger;
CREATE POLICY "reward_ledger_admin_all" ON public.reward_ledger
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
  );

GRANT SELECT ON public.reward_ledger TO authenticated;
GRANT ALL ON public.reward_ledger TO service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reward_settings_raw()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(rewards_settings, '{}'::jsonb)
  FROM public.app_settings
  WHERE id = 1;
$$;

CREATE OR REPLACE FUNCTION public.reward_level_for_lifetime(p_lifetime INT, p_settings JSONB DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s JSONB := COALESCE(p_settings, public.reward_settings_raw());
  lvl INT := 1;
  row JSONB;
BEGIN
  IF s ? 'levels' AND jsonb_typeof(s->'levels') = 'array' THEN
    FOR row IN
      SELECT value
      FROM jsonb_array_elements(s->'levels') AS t(value)
      ORDER BY COALESCE((value->>'min_lifetime')::int, 0) ASC
    LOOP
      IF p_lifetime >= COALESCE((row->>'min_lifetime')::int, 0) THEN
        lvl := GREATEST(lvl, COALESCE((row->>'level')::int, lvl));
      END IF;
    END LOOP;
  ELSE
    IF p_lifetime >= 10000 THEN lvl := 6;
    ELSIF p_lifetime >= 5000 THEN lvl := 5;
    ELSIF p_lifetime >= 2000 THEN lvl := 4;
    ELSIF p_lifetime >= 500 THEN lvl := 3;
    ELSIF p_lifetime >= 100 THEN lvl := 2;
    ELSE lvl := 1;
    END IF;
  END IF;
  RETURN lvl;
END;
$$;

CREATE OR REPLACE FUNCTION public.award_reward_points(
  p_user_id UUID,
  p_action TEXT,
  p_event_key TEXT,
  p_ref_type TEXT DEFAULT NULL,
  p_ref_id UUID DEFAULT NULL,
  p_meta JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s JSONB := public.reward_settings_raw();
  pts INT := 0;
  enabled BOOLEAN := true;
  action_on BOOLEAN := true;
  daily_cap INT := 400;
  post_cap INT := 3;
  engage_cap INT := 20;
  earned_today INT := 0;
  action_today INT := 0;
  skip_daily BOOLEAN := false;
  bal INT := 0;
  life INT := 0;
  lvl INT := 1;
  inserted BOOLEAN := false;
BEGIN
  IF p_user_id IS NULL OR nullif(trim(p_event_key), '') IS NULL OR nullif(trim(p_action), '') IS NULL THEN
    RETURN jsonb_build_object('awarded', false, 'reason', 'invalid_args');
  END IF;

  enabled := COALESCE((s->>'enabled')::boolean, true);
  IF NOT enabled THEN
    RETURN jsonb_build_object('awarded', false, 'reason', 'disabled');
  END IF;

  -- Already awarded?
  IF EXISTS (SELECT 1 FROM public.reward_ledger WHERE event_key = p_event_key) THEN
    SELECT reward_points, reward_lifetime_earned, reward_level
      INTO bal, life, lvl
    FROM public.profiles WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'awarded', false,
      'duplicate', true,
      'points', 0,
      'balance', COALESCE(bal, 0),
      'level', COALESCE(lvl, 1),
      'lifetime', COALESCE(life, 0)
    );
  END IF;

  CASE p_action
    WHEN 'signup' THEN
      action_on := COALESCE((s->>'enable_signup')::boolean, true);
      pts := COALESCE((s->>'signup_points')::int, 50);
      skip_daily := true;
    WHEN 'post_request' THEN
      action_on := COALESCE((s->>'enable_post_request')::boolean, true);
      pts := COALESCE((s->>'post_request_points')::int, 20);
      post_cap := COALESCE((s->>'post_daily_cap')::int, 3);
    WHEN 'donation_confirmed' THEN
      action_on := COALESCE((s->>'enable_donation_confirmed')::boolean, true);
      pts := COALESCE((s->>'donation_confirmed_points')::int, 2000);
      skip_daily := true;
    WHEN 'request_fulfilled' THEN
      action_on := COALESCE((s->>'enable_request_fulfilled')::boolean, true);
      pts := COALESCE((s->>'request_fulfilled_points')::int, 30);
    WHEN 'like' THEN
      action_on := COALESCE((s->>'enable_like')::boolean, false);
      pts := COALESCE((s->>'like_points')::int, 2);
      engage_cap := COALESCE((s->>'engage_daily_cap')::int, 20);
    WHEN 'comment' THEN
      action_on := COALESCE((s->>'enable_comment')::boolean, false);
      pts := COALESCE((s->>'comment_points')::int, 5);
      engage_cap := COALESCE((s->>'engage_daily_cap')::int, 20);
    WHEN 'share' THEN
      action_on := COALESCE((s->>'enable_share')::boolean, false);
      pts := COALESCE((s->>'share_points')::int, 8);
      engage_cap := COALESCE((s->>'engage_daily_cap')::int, 20);
    ELSE
      RETURN jsonb_build_object('awarded', false, 'reason', 'unknown_action');
  END CASE;

  IF NOT action_on OR pts <= 0 THEN
    RETURN jsonb_build_object('awarded', false, 'reason', 'action_off');
  END IF;

  daily_cap := COALESCE((s->>'daily_earn_cap')::int, 400);

  IF NOT skip_daily THEN
    SELECT COALESCE(SUM(points), 0) INTO earned_today
    FROM public.reward_ledger
    WHERE user_id = p_user_id
      AND kind = 'earn'
      AND action <> 'donation_confirmed'
      AND action <> 'signup'
      AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka';

    IF earned_today >= daily_cap THEN
      RETURN jsonb_build_object('awarded', false, 'reason', 'daily_cap');
    END IF;

    IF p_action = 'post_request' THEN
      SELECT COUNT(*) INTO action_today
      FROM public.reward_ledger
      WHERE user_id = p_user_id
        AND action = 'post_request'
        AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka';
      IF action_today >= post_cap THEN
        RETURN jsonb_build_object('awarded', false, 'reason', 'post_daily_cap');
      END IF;
    END IF;

    IF p_action IN ('like', 'comment', 'share') THEN
      SELECT COUNT(*) INTO action_today
      FROM public.reward_ledger
      WHERE user_id = p_user_id
        AND action IN ('like', 'comment', 'share')
        AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Dhaka') AT TIME ZONE 'Asia/Dhaka';
      IF action_today >= engage_cap THEN
        RETURN jsonb_build_object('awarded', false, 'reason', 'engage_daily_cap');
      END IF;
    END IF;

    IF earned_today + pts > daily_cap THEN
      pts := GREATEST(0, daily_cap - earned_today);
    END IF;
    IF pts <= 0 THEN
      RETURN jsonb_build_object('awarded', false, 'reason', 'daily_cap');
    END IF;
  END IF;

  BEGIN
    INSERT INTO public.reward_ledger (user_id, points, kind, action, event_key, ref_type, ref_id, meta)
    VALUES (
      p_user_id,
      pts,
      'earn',
      p_action,
      p_event_key,
      p_ref_type,
      p_ref_id,
      COALESCE(p_meta, '{}'::jsonb)
    );
    inserted := true;
  EXCEPTION WHEN unique_violation THEN
    SELECT reward_points, reward_lifetime_earned, reward_level
      INTO bal, life, lvl
    FROM public.profiles WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'awarded', false,
      'duplicate', true,
      'points', 0,
      'balance', COALESCE(bal, 0),
      'level', COALESCE(lvl, 1),
      'lifetime', COALESCE(life, 0)
    );
  END;

  UPDATE public.profiles
  SET
    reward_points = COALESCE(reward_points, 0) + pts,
    reward_lifetime_earned = COALESCE(reward_lifetime_earned, 0) + pts,
    reward_level = public.reward_level_for_lifetime(COALESCE(reward_lifetime_earned, 0) + pts, s)
  WHERE id = p_user_id
  RETURNING reward_points, reward_lifetime_earned, reward_level
  INTO bal, life, lvl;

  RETURN jsonb_build_object(
    'awarded', inserted,
    'duplicate', false,
    'points', pts,
    'balance', COALESCE(bal, 0),
    'level', COALESCE(lvl, 1),
    'lifetime', COALESCE(life, 0),
    'action', p_action
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_reward_points(UUID, TEXT, TEXT, TEXT, UUID, JSONB) TO authenticated, service_role;

-- Admin adjust (signed points; can be negative)
CREATE OR REPLACE FUNCTION public.admin_adjust_reward_points(
  p_user_id UUID,
  p_points INT,
  p_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bal INT;
  life INT;
  lvl INT;
  s JSONB := public.reward_settings_raw();
  ek TEXT;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')
  ) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;
  IF p_user_id IS NULL OR p_points = 0 THEN
    RAISE EXCEPTION 'Invalid adjust';
  END IF;

  ek := 'admin_adjust:' || p_user_id::text || ':' || gen_random_uuid()::text;

  INSERT INTO public.reward_ledger (user_id, points, kind, action, event_key, meta)
  VALUES (
    p_user_id,
    p_points,
    'adjust',
    'admin_adjust',
    ek,
    jsonb_build_object('note', COALESCE(p_note, ''), 'by', auth.uid())
  );

  UPDATE public.profiles
  SET
    reward_points = GREATEST(0, COALESCE(reward_points, 0) + p_points),
    reward_lifetime_earned = CASE
      WHEN p_points > 0 THEN COALESCE(reward_lifetime_earned, 0) + p_points
      ELSE COALESCE(reward_lifetime_earned, 0)
    END,
    reward_level = public.reward_level_for_lifetime(
      CASE
        WHEN p_points > 0 THEN COALESCE(reward_lifetime_earned, 0) + p_points
        ELSE COALESCE(reward_lifetime_earned, 0)
      END,
      s
    )
  WHERE id = p_user_id
  RETURNING reward_points, reward_lifetime_earned, reward_level
  INTO bal, life, lvl;

  RETURN jsonb_build_object(
    'ok', true,
    'points', p_points,
    'balance', bal,
    'lifetime', life,
    'level', lvl,
    'event_key', ek
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_reward_points(UUID, INT, TEXT) TO authenticated;

-- ---------------------------------------------------------------------------
-- Triggers: signup / post / donation / fulfill
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
  v_email TEXT;
BEGIN
  v_username := NULLIF(LOWER(TRIM(NEW.raw_user_meta_data->>'username')), '');
  v_email := public.real_user_email(NEW.email);

  IF v_username IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE LOWER(username) = v_username
  ) THEN
    v_username := NULL;
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, phone, username, email)
  VALUES (
    NEW.id,
    NULLIF(TRIM(COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    )), ''),
    COALESCE(
      NEW.raw_user_meta_data->>'avatar_url',
      NEW.raw_user_meta_data->>'picture'
    ),
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    v_username,
    v_email
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    username = COALESCE(public.profiles.username, EXCLUDED.username),
    email = COALESCE(public.profiles.email, EXCLUDED.email);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  BEGIN
    PERFORM public.link_org_donor_history_to_profile(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'link_org_donor_history_to_profile on signup failed: %', SQLERRM;
  END;

  BEGIN
    PERFORM public.award_reward_points(
      NEW.id,
      'signup',
      'signup:' || NEW.id::text,
      'user',
      NEW.id,
      '{}'::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'signup reward failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_reward_on_blood_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.requester_id IS NOT NULL THEN
    BEGIN
      PERFORM public.award_reward_points(
        NEW.requester_id,
        'post_request',
        'post:' || NEW.id::text,
        'blood_request',
        NEW.id,
        jsonb_build_object('blood_group', NEW.blood_group)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'post reward failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blood_requests_reward_points ON public.blood_requests;
CREATE TRIGGER blood_requests_reward_points
  AFTER INSERT ON public.blood_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_reward_on_blood_request();

CREATE OR REPLACE FUNCTION public.on_donation_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.confirmed IS TRUE AND NEW.donor_id IS NOT NULL THEN
    UPDATE public.profiles
    SET
      total_donations = COALESCE(total_donations, 0) + 1,
      last_donation_date = COALESCE(NEW.donation_date, CURRENT_DATE),
      is_donor = true,
      is_available = false,
      unavailable_until = (COALESCE(NEW.donation_date, CURRENT_DATE)::timestamptz + INTERVAL '3 months')
    WHERE id = NEW.donor_id;

    BEGIN
      PERFORM public.award_reward_points(
        NEW.donor_id,
        'donation_confirmed',
        'donation:' || NEW.id::text,
        'donation',
        NEW.id,
        jsonb_build_object('bags', COALESCE(NEW.bags, 1), 'request_id', NEW.request_id)
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'donation reward failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_donation_confirmed ON public.donations;
CREATE TRIGGER trg_donation_confirmed
  AFTER INSERT ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.on_donation_confirmed();

CREATE OR REPLACE FUNCTION public.trg_reward_on_request_fulfilled()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'fulfilled'
     AND (OLD.status IS DISTINCT FROM 'fulfilled')
     AND NEW.requester_id IS NOT NULL THEN
    BEGIN
      PERFORM public.award_reward_points(
        NEW.requester_id,
        'request_fulfilled',
        'fulfilled:' || NEW.id::text,
        'blood_request',
        NEW.id,
        '{}'::jsonb
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'fulfill reward failed for %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS blood_requests_reward_fulfilled ON public.blood_requests;
CREATE TRIGGER blood_requests_reward_fulfilled
  AFTER UPDATE OF status ON public.blood_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_reward_on_request_fulfilled();

COMMENT ON TABLE public.reward_ledger IS 'Append-only rewards ledger; earn via award_reward_points (idempotent event_key).';
COMMENT ON FUNCTION public.award_reward_points IS 'Idempotent points award; donation/signup bypass daily cap.';
