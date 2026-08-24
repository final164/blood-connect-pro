-- Native (FCM/APNs) push tokens alongside Web Push subscriptions

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT 'web';

COMMENT ON COLUMN public.push_subscriptions.platform IS
  'web | android | ios — capacitor FCM/APNs use endpoint fcm:<token> or apns:<token>';

CREATE INDEX IF NOT EXISTS push_subscriptions_platform_idx
  ON public.push_subscriptions (platform);
