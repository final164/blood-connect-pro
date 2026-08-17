-- Quick fix: run this in Supabase Dashboard → SQL Editor if vendor register fails with
-- "column account_kind of relation profiles does not exist"
--
-- Then run the full file: supabase/migrations/20260817200000_care_vendor_onboarding.sql

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_kind TEXT NOT NULL DEFAULT 'patient';

DO $$
BEGIN
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_account_kind_check
    CHECK (account_kind IN ('patient', 'care_vendor'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS profiles_account_kind_idx ON public.profiles (account_kind)
  WHERE account_kind = 'care_vendor';
