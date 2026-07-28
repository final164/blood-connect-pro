-- Advanced notification platform: push subs, district/blood alerts, retention, admin settings
-- Run in Supabase SQL Editor

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{
    "retention_days": 1,
    "enable_managed_button": true,
    "enable_push": true,
    "push_new_request": true,
    "push_interactions": true,
    "match_district_for_alerts": true,
    "match_blood_group_for_alerts": true,
    "auto_feed_district": true,
    "auto_feed_blood_group": true,
    "web_push_hook_secret": ""
  }'::jsonb;

UPDATE public.app_settings
SET notification_settings = COALESCE(notification_settings, '{
  "retention_days": 1,
  "enable_managed_button": true,
  "enable_push": true,
  "push_new_request": true,
  "push_interactions": true,
  "match_district_for_alerts": true,
  "match_blood_group_for_alerts": true,
  "auto_feed_district": true,
  "auto_feed_blood_group": true,
  "web_push_hook_secret": ""
}'::jsonb)
WHERE id = 1;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT,
  auth TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON public.push_subscriptions (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "push_sub_own" ON public.push_subscriptions;
CREATE POLICY "push_sub_own" ON public.push_subscriptions FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Purge notifications older than admin retention_days
CREATE OR REPLACE FUNCTION public.purge_expired_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  days INT := 1;
  deleted INT;
BEGIN
  SELECT COALESCE((notification_settings->>'retention_days')::INT, 1)
  INTO days
  FROM app_settings WHERE id = 1;

  IF days < 1 THEN days := 1; END IF;

  DELETE FROM notifications
  WHERE created_at < now() - (days || ' days')::INTERVAL;

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.purge_expired_notifications() TO authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_notifications() TO service_role;

-- Notify users in same district + blood group when new open request is posted
CREATE OR REPLACE FUNCTION public.notify_matching_donors_new_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cfg JSONB;
  use_district BOOLEAN := true;
  use_blood BOOLEAN := true;
BEGIN
  IF NEW.status IS DISTINCT FROM 'open' THEN
    RETURN NEW;
  END IF;

  SELECT notification_settings INTO cfg FROM app_settings WHERE id = 1;
  IF cfg IS NOT NULL THEN
    use_district := COALESCE((cfg->>'match_district_for_alerts')::BOOLEAN, true);
    use_blood := COALESCE((cfg->>'match_blood_group_for_alerts')::BOOLEAN, true);
  END IF;

  INSERT INTO notifications (user_id, actor_id, type, request_id, title, body, data, is_read)
  SELECT
    p.id,
    NEW.requester_id,
    'request_match'::public.notif_type,
    NEW.id,
    'new_request',
    NEW.patient_name || ' · ' || NEW.blood_group::TEXT,
    jsonb_build_object(
      'kind', 'new_request',
      'request_id', NEW.id,
      'blood_group', NEW.blood_group,
      'district_id', NEW.district_id
    ),
    false
  FROM profiles p
  LEFT JOIN user_settings us ON us.user_id = p.id
  WHERE p.id <> NEW.requester_id
    AND COALESCE(us.notif_new_request, true) = true
    AND (
      NOT use_district
      OR (NEW.district_id IS NOT NULL AND p.district_id = NEW.district_id)
    )
    AND (
      NOT use_blood
      OR (NEW.blood_group IS NOT NULL AND p.blood_group = NEW.blood_group)
    );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_matching_donors ON public.blood_requests;
CREATE TRIGGER trg_notify_matching_donors
  AFTER INSERT ON public.blood_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_matching_donors_new_request();

-- Also refresh notify_request_owner to ensure request_id in data (already has it)

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
