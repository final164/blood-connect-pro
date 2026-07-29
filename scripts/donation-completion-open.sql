-- Run in Supabase SQL Editor if needed.
ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS donation_completion_open BOOLEAN NOT NULL DEFAULT false;
