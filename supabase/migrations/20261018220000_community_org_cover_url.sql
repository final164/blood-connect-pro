-- Community org public branding: cover photo alongside logo_url
ALTER TABLE public.community_orgs
  ADD COLUMN IF NOT EXISTS cover_url TEXT;
