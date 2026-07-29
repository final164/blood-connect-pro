-- Actor names on interaction notifications + reply / comment-like alerts.
-- Run in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.notify_request_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
  recipient_id UUID;
  arg TEXT := TG_ARGV[0];
  ntype public.notif_type;
  preview TEXT := NULL;
  title_txt TEXT;
  kind_txt TEXT;
  actor_name TEXT;
BEGIN
  SELECT requester_id INTO owner_id FROM public.blood_requests WHERE id = NEW.request_id;

  SELECT COALESCE(
    NULLIF(trim(p.full_name), ''),
    NULLIF(trim(p.phone), ''),
    'User'
  )
  INTO actor_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  actor_name := COALESCE(actor_name, 'User');
  kind_txt := arg;
  recipient_id := owner_id;

  IF arg = 'like' THEN
    ntype := 'post_like'::public.notif_type;
    title_txt := 'request_like';
  ELSIF arg = 'comment' THEN
    ntype := 'post_comment'::public.notif_type;
    preview := left(NEW.content, 200);
    -- Reply → notify parent comment author (not only post owner)
    IF NEW.parent_id IS NOT NULL THEN
      SELECT c.user_id INTO recipient_id
      FROM public.request_comments c
      WHERE c.id = NEW.parent_id;
      kind_txt := 'reply';
      title_txt := 'request_reply';
    ELSE
      title_txt := 'request_comment';
    END IF;
  ELSIF arg = 'share' THEN
    ntype := 'system'::public.notif_type;
    title_txt := 'request_share';
  ELSE
    ntype := 'system'::public.notif_type;
    title_txt := coalesce(arg, 'system');
  END IF;

  IF recipient_id IS NULL OR recipient_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id, actor_id, type, request_id, title, body, data, is_read
  ) VALUES (
    recipient_id,
    NEW.user_id,
    ntype,
    NEW.request_id,
    title_txt,
    preview,
    jsonb_build_object(
      'actor_id', NEW.user_id,
      'actor_name', actor_name,
      'request_id', NEW.request_id,
      'kind', kind_txt
    ),
    false
  );

  RETURN NEW;
END;
$$;

-- Comment like → notify comment author
CREATE OR REPLACE FUNCTION public.notify_comment_like()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  comment_owner UUID;
  req_id UUID;
  actor_name TEXT;
BEGIN
  SELECT c.user_id, c.request_id INTO comment_owner, req_id
  FROM public.request_comments c
  WHERE c.id = NEW.comment_id;

  IF comment_owner IS NULL OR comment_owner = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(
    NULLIF(trim(p.full_name), ''),
    NULLIF(trim(p.phone), ''),
    'User'
  )
  INTO actor_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  actor_name := COALESCE(actor_name, 'User');

  INSERT INTO public.notifications (
    user_id, actor_id, type, request_id, title, body, data, is_read
  ) VALUES (
    comment_owner,
    NEW.user_id,
    'post_like'::public.notif_type,
    req_id,
    'comment_like',
    NULL,
    jsonb_build_object(
      'actor_id', NEW.user_id,
      'actor_name', actor_name,
      'request_id', req_id,
      'comment_id', NEW.comment_id,
      'kind', 'comment_like'
    ),
    false
  );

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  IF to_regclass('public.request_likes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_like ON public.request_likes;
    CREATE TRIGGER trg_notify_like
      AFTER INSERT ON public.request_likes
      FOR EACH ROW EXECUTE FUNCTION public.notify_request_owner('like');
  END IF;
  IF to_regclass('public.request_comments') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_comment ON public.request_comments;
    CREATE TRIGGER trg_notify_comment
      AFTER INSERT ON public.request_comments
      FOR EACH ROW EXECUTE FUNCTION public.notify_request_owner('comment');
  END IF;
  IF to_regclass('public.request_shares') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_share ON public.request_shares;
    CREATE TRIGGER trg_notify_share
      AFTER INSERT ON public.request_shares
      FOR EACH ROW EXECUTE FUNCTION public.notify_request_owner('share');
  END IF;
  IF to_regclass('public.request_comment_likes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_comment_like ON public.request_comment_likes;
    CREATE TRIGGER trg_notify_comment_like
      AFTER INSERT ON public.request_comment_likes
      FOR EACH ROW EXECUTE FUNCTION public.notify_comment_like();
  END IF;
END $$;

-- Backfill actor_name on recent notifications missing it
UPDATE public.notifications n
SET data = COALESCE(n.data, '{}'::jsonb) || jsonb_build_object(
  'actor_name', COALESCE(NULLIF(trim(p.full_name), ''), NULLIF(trim(p.phone), ''), 'User'),
  'actor_id', COALESCE(n.actor_id, (n.data->>'actor_id')::uuid)
)
FROM public.profiles p
WHERE p.id = COALESCE(n.actor_id, (n.data->>'actor_id')::uuid)
  AND (
    n.data IS NULL
    OR n.data->>'actor_name' IS NULL
    OR n.data->>'actor_name' = ''
  )
  AND COALESCE(n.actor_id, (n.data->>'actor_id')::uuid) IS NOT NULL;
