-- Owner opens completion phase: donors may claim "I donated"; assign UI unlocks.

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS donation_completion_open BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.blood_requests.donation_completion_open IS
  'True after owner clicks Blood donation complete; unlocks I-donated claims and assign UI';
