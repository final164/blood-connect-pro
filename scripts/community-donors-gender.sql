-- Add gender to community_donors (male | female)
ALTER TABLE public.community_donors
  ADD COLUMN IF NOT EXISTS gender TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'community_donors_gender_check'
  ) THEN
    ALTER TABLE public.community_donors
      ADD CONSTRAINT community_donors_gender_check
      CHECK (gender IS NULL OR gender IN ('male', 'female'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS community_donors_gender_idx ON public.community_donors (gender);
