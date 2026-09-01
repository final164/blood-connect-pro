-- Store real inbox (Google / email signup) on profiles for admin + display.
-- Synthetic phone-auth emails (@muktosheba.app, @bloodlink.app, @supabase.co) are excluded.

CREATE OR REPLACE FUNCTION public.real_user_email(e text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN e IS NULL OR btrim(e) = '' THEN NULL
    WHEN lower(e) LIKE '%@bloodlink.app' THEN NULL
    WHEN lower(e) LIKE '%@muktosheba.app' THEN NULL
    WHEN lower(e) LIKE '%@supabase.co' THEN NULL
    WHEN lower(e) LIKE '%.local' THEN NULL
    ELSE lower(btrim(e))
  END;
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email TEXT;

CREATE INDEX IF NOT EXISTS profiles_email_lower_idx
  ON public.profiles (lower(email))
  WHERE email IS NOT NULL;

UPDATE public.profiles p
SET email = public.real_user_email(u.email)
FROM auth.users u
WHERE u.id = p.id
  AND public.real_user_email(u.email) IS NOT NULL
  AND (p.email IS NULL OR p.email <> public.real_user_email(u.email));

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

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
