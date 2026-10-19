-- Org overview: About us, FAQ, advanced portal options (JSON only — no media storage)
ALTER TABLE public.community_orgs
  ADD COLUMN IF NOT EXISTS portal_content JSONB NOT NULL DEFAULT '{}'::jsonb;
