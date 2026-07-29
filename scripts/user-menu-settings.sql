-- Run in Supabase SQL Editor if needed.
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS user_menu_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
