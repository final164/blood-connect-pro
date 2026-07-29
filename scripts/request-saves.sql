-- Run in Supabase SQL Editor if needed.
CREATE TABLE IF NOT EXISTS public.request_saves (
  request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);
CREATE INDEX IF NOT EXISTS request_saves_user_idx
  ON public.request_saves (user_id, created_at DESC);

GRANT SELECT, INSERT, DELETE ON public.request_saves TO authenticated;
GRANT ALL ON public.request_saves TO service_role;
ALTER TABLE public.request_saves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "req_save_read" ON public.request_saves;
CREATE POLICY "req_save_read" ON public.request_saves
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "req_save_insert" ON public.request_saves;
CREATE POLICY "req_save_insert" ON public.request_saves
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "req_save_delete" ON public.request_saves;
CREATE POLICY "req_save_delete" ON public.request_saves
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
