-- Run in Supabase SQL Editor if migrations are not applied automatically.
-- Donation offers + expanded donations RLS for request owners.

DO $$ BEGIN
  CREATE TYPE public.donation_offer_status AS ENUM (
    'interested',
    'donated_claimed',
    'confirmed',
    'rejected',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.donation_offer_source AS ENUM ('self', 'assigned');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.request_donation_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.donation_offer_status NOT NULL DEFAULT 'interested',
  source public.donation_offer_source NOT NULL DEFAULT 'self',
  bags INT NOT NULL DEFAULT 1 CHECK (bags >= 1 AND bags <= 20),
  donation_date DATE,
  notes TEXT,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  donation_id UUID REFERENCES public.donations(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, donor_id)
);

CREATE INDEX IF NOT EXISTS idx_rdo_request ON public.request_donation_offers(request_id);
CREATE INDEX IF NOT EXISTS idx_rdo_donor ON public.request_donation_offers(donor_id);

DROP TRIGGER IF EXISTS trg_rdo_updated ON public.request_donation_offers;
CREATE TRIGGER trg_rdo_updated
  BEFORE UPDATE ON public.request_donation_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, INSERT, UPDATE ON public.request_donation_offers TO authenticated;
GRANT ALL ON public.request_donation_offers TO service_role;
ALTER TABLE public.request_donation_offers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rdo_read_auth" ON public.request_donation_offers;
CREATE POLICY "rdo_read_auth" ON public.request_donation_offers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "rdo_insert_donor" ON public.request_donation_offers;
CREATE POLICY "rdo_insert_donor" ON public.request_donation_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = donor_id
    AND source = 'self'
    AND status IN ('interested', 'donated_claimed')
  );

DROP POLICY IF EXISTS "rdo_insert_requester" ON public.request_donation_offers;
CREATE POLICY "rdo_insert_requester" ON public.request_donation_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.blood_requests br
      WHERE br.id = request_id AND br.requester_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "rdo_update_donor" ON public.request_donation_offers;
CREATE POLICY "rdo_update_donor" ON public.request_donation_offers
  FOR UPDATE TO authenticated
  USING (auth.uid() = donor_id AND status IN ('interested', 'donated_claimed'))
  WITH CHECK (auth.uid() = donor_id);

DROP POLICY IF EXISTS "rdo_update_requester" ON public.request_donation_offers;
CREATE POLICY "rdo_update_requester" ON public.request_donation_offers
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.blood_requests br
      WHERE br.id = request_id AND br.requester_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "don_read_involved" ON public.donations;
DROP POLICY IF EXISTS "don_read_auth" ON public.donations;
CREATE POLICY "don_read_auth" ON public.donations
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "don_insert_donor" ON public.donations;
CREATE POLICY "don_insert_donor" ON public.donations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = donor_id);

DROP POLICY IF EXISTS "don_insert_requester" ON public.donations;
CREATE POLICY "don_insert_requester" ON public.donations
  FOR INSERT TO authenticated
  WITH CHECK (
    request_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.blood_requests br
      WHERE br.id = request_id AND br.requester_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.on_donation_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.confirmed IS TRUE AND NEW.donor_id IS NOT NULL THEN
    UPDATE public.profiles
    SET
      total_donations = COALESCE(total_donations, 0) + 1,
      last_donation_date = COALESCE(NEW.donation_date, CURRENT_DATE),
      is_donor = true
    WHERE id = NEW.donor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_donation_confirmed ON public.donations;
CREATE TRIGGER trg_donation_confirmed
  AFTER INSERT ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.on_donation_confirmed();
