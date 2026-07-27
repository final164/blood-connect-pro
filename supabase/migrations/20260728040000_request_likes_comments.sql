-- Likes & comments on blood request feed posts
CREATE TABLE IF NOT EXISTS public.request_likes (
  request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.request_likes TO authenticated;
GRANT ALL ON public.request_likes TO service_role;
ALTER TABLE public.request_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "req_like_read" ON public.request_likes;
CREATE POLICY "req_like_read" ON public.request_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "req_like_insert" ON public.request_likes;
CREATE POLICY "req_like_insert" ON public.request_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "req_like_delete" ON public.request_likes;
CREATE POLICY "req_like_delete" ON public.request_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS request_comments_req_idx ON public.request_comments (request_id, created_at);
GRANT SELECT, INSERT, DELETE ON public.request_comments TO authenticated;
GRANT ALL ON public.request_comments TO service_role;
ALTER TABLE public.request_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "req_cmt_read" ON public.request_comments;
CREATE POLICY "req_cmt_read" ON public.request_comments FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "req_cmt_insert" ON public.request_comments;
CREATE POLICY "req_cmt_insert" ON public.request_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "req_cmt_delete" ON public.request_comments;
CREATE POLICY "req_cmt_delete" ON public.request_comments FOR DELETE TO authenticated USING (auth.uid() = user_id);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.request_likes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.request_comments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
