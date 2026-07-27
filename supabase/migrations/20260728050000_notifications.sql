-- Align with existing notifications (notif_type enum, read_at, data jsonb)
-- Uses existing enum values: post_like, post_comment, system

CREATE TABLE IF NOT EXISTS public.request_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);
GRANT SELECT, INSERT ON public.request_shares TO authenticated;
GRANT ALL ON public.request_shares TO service_role;
ALTER TABLE public.request_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "req_share_read" ON public.request_shares;
CREATE POLICY "req_share_read" ON public.request_shares FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "req_share_insert" ON public.request_shares;
CREATE POLICY "req_share_insert" ON public.request_shares FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS request_id UUID REFERENCES public.blood_requests(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

UPDATE public.notifications
SET is_read = true
WHERE read_at IS NOT NULL AND COALESCE(is_read, false) = false;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id) WHERE is_read = false;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_read_self" ON public.notifications;
CREATE POLICY "notif_select_own" ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "notif_update_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_update_self" ON public.notifications;
CREATE POLICY "notif_update_own" ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "notif_delete_own" ON public.notifications;
DROP POLICY IF EXISTS "notif_delete_self" ON public.notifications;
CREATE POLICY "notif_delete_own" ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "notif_insert_admin" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_any" ON public.notifications;
DROP POLICY IF EXISTS "notif_insert_self_only" ON public.notifications;
CREATE POLICY "notif_insert_admin" ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.notify_request_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  owner_id UUID;
  arg TEXT := TG_ARGV[0];
  ntype public.notif_type;
  preview TEXT := NULL;
  title_txt TEXT;
BEGIN
  SELECT requester_id INTO owner_id FROM public.blood_requests WHERE id = NEW.request_id;
  IF owner_id IS NULL OR owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  IF arg = 'like' THEN
    ntype := 'post_like'::public.notif_type;
    title_txt := 'request_like';
  ELSIF arg = 'comment' THEN
    ntype := 'post_comment'::public.notif_type;
    title_txt := 'request_comment';
    preview := left(NEW.content, 200);
  ELSIF arg = 'share' THEN
    ntype := 'system'::public.notif_type;
    title_txt := 'request_share';
  ELSE
    ntype := 'system'::public.notif_type;
    title_txt := coalesce(arg, 'system');
  END IF;

  INSERT INTO public.notifications (
    user_id, actor_id, type, request_id, title, body, data, is_read
  ) VALUES (
    owner_id,
    NEW.user_id,
    ntype,
    NEW.request_id,
    title_txt,
    preview,
    jsonb_build_object('actor_id', NEW.user_id, 'request_id', NEW.request_id, 'kind', arg),
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
END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
