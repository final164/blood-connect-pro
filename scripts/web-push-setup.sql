-- Web Push dispatch (app closed) — run after deploying send-push edge function
-- 1. node scripts/generate-vapid-keys.mjs
-- 2. supabase secrets set ... && supabase functions deploy send-push --no-verify-jwt
-- 3. Paste WEBHOOK_SECRET into Admin → Notifications → Web Push webhook secret
-- 4. Run this script in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

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
SET notification_settings = COALESCE(notification_settings, '{}'::jsonb) || '{
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
}'::jsonb
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

CREATE OR REPLACE FUNCTION public.dispatch_web_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hook_secret text;
  fn_url text := 'https://aunxredquwbokhpluzgj.supabase.co/functions/v1/send-push';
  push_enabled boolean := true;
BEGIN
  SELECT
    COALESCE(notification_settings->>'web_push_hook_secret', ''),
    COALESCE((notification_settings->>'enable_push')::boolean, true)
  INTO hook_secret, push_enabled
  FROM app_settings WHERE id = 1;

  IF NOT push_enabled OR hook_secret IS NULL OR hook_secret = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', hook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'schema', 'public',
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'actor_id', NEW.actor_id,
        'type', NEW.type,
        'request_id', NEW.request_id,
        'title', NEW.title,
        'body', NEW.body,
        'data', NEW.data,
        'created_at', NEW.created_at
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dispatch_web_push ON public.notifications;
CREATE TRIGGER trg_dispatch_web_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.dispatch_web_push_notification();
