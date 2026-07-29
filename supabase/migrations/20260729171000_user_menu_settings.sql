ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS user_menu_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.app_settings.user_menu_settings IS
  'Facebook-style left menu: items order/labels/icons + design knobs';
