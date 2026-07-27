-- Comment likes + nested replies on blood request comments
-- Run in Supabase SQL Editor after request-likes-comments.sql

ALTER TABLE public.request_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.request_comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS request_comments_parent_idx
  ON public.request_comments (parent_id, created_at);

CREATE TABLE IF NOT EXISTS public.request_comment_likes (
  comment_id UUID NOT NULL REFERENCES public.request_comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.request_comment_likes TO authenticated;
GRANT ALL ON public.request_comment_likes TO service_role;
ALTER TABLE public.request_comment_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "req_cmt_like_read" ON public.request_comment_likes;
CREATE POLICY "req_cmt_like_read" ON public.request_comment_likes FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "req_cmt_like_insert" ON public.request_comment_likes;
CREATE POLICY "req_cmt_like_insert" ON public.request_comment_likes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "req_cmt_like_delete" ON public.request_comment_likes;
CREATE POLICY "req_cmt_like_delete" ON public.request_comment_likes FOR DELETE TO authenticated USING (auth.uid() = user_id);

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.request_comment_likes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
