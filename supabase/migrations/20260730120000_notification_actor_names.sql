-- Same as scripts/notification-actor-names.sql
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
  IF to_regclass('public.request_comment_likes') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_notify_comment_like ON public.request_comment_likes;
    CREATE TRIGGER trg_notify_comment_like
      AFTER INSERT ON public.request_comment_likes
      FOR EACH ROW EXECUTE FUNCTION public.notify_comment_like();
  END IF;
END $$;
