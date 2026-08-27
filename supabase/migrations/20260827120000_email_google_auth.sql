-- Email/password + Google sign-in support.
--
-- 1. Usernames become case-insensitively unique, so "Rahim" and "rahim" cannot
--    become two different accounts.
-- 2. handle_new_user() carries the username from signup metadata and stops
--    falling back to the raw email for full_name (Google/email users would
--    otherwise show up as "someone@gmail.com" everywhere in the feed).

-- Fold any pre-existing case-duplicate usernames before the index is created.
WITH dupes AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY LOWER(username) ORDER BY created_at NULLS LAST, id) AS rn
  FROM public.profiles
  WHERE username IS NOT NULL AND username <> ''
)
UPDATE public.profiles p
SET username = LEFT(p.username, 14) || '_' || SUBSTRING(p.id::text, 1, 4)
FROM dupes d
WHERE p.id = d.id AND d.rn > 1;

UPDATE public.profiles SET username = LOWER(username) WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (LOWER(username))
  WHERE username IS NOT NULL AND username <> '';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_username TEXT;
BEGIN
  v_username := NULLIF(LOWER(TRIM(NEW.raw_user_meta_data->>'username')), '');

  -- Only claim the username if it is free; a collision must never block signup.
  IF v_username IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles WHERE LOWER(username) = v_username
  ) THEN
    v_username := NULL;
  END IF;

  INSERT INTO public.profiles (id, full_name, avatar_url, phone, username)
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
    v_username
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    avatar_url = COALESCE(public.profiles.avatar_url, EXCLUDED.avatar_url),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone),
    username = COALESCE(public.profiles.username, EXCLUDED.username);

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
