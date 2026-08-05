-- Same as supabase/migrations/20260806010000_community_request_contacts.sql
-- Paste into Supabase SQL editor if not using migrations CLI.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS unavailable_until TIMESTAMPTZ;

ALTER TABLE public.community_donors
  ADD COLUMN IF NOT EXISTS unavailable_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_donated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_donated_request_id UUID REFERENCES public.blood_requests(id) ON DELETE SET NULL;

ALTER TABLE public.blood_requests
  ADD COLUMN IF NOT EXISTS from_community BOOLEAN NOT NULL DEFAULT false;

DO $$ BEGIN
  CREATE TYPE public.community_contact_channel AS ENUM ('call', 'sms', 'whatsapp', 'saved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.community_request_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.blood_requests(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.community_orgs(id) ON DELETE SET NULL,
  community_donor_id UUID REFERENCES public.community_donors(id) ON DELETE SET NULL,
  donor_name TEXT,
  donor_phone TEXT NOT NULL,
  channel public.community_contact_channel NOT NULL,
  outcome TEXT NOT NULL DEFAULT 'initiated'
    CHECK (outcome IN ('initiated', 'donated', 'cancelled')),
  contacted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  matched_profile_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  bags INT CHECK (bags IS NULL OR (bags >= 1 AND bags <= 20)),
  notes TEXT,
  donation_id UUID REFERENCES public.donations(id) ON DELETE SET NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  donated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS community_request_contacts_request_idx
  ON public.community_request_contacts (request_id, created_at DESC);
CREATE INDEX IF NOT EXISTS community_request_contacts_org_idx
  ON public.community_request_contacts (org_id, created_at DESC)
  WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS community_request_contacts_donor_idx
  ON public.community_request_contacts (community_donor_id)
  WHERE community_donor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS community_request_contacts_phone_idx
  ON public.community_request_contacts (donor_phone);

CREATE UNIQUE INDEX IF NOT EXISTS community_request_contacts_uniq_initiated
  ON public.community_request_contacts (request_id, donor_phone, channel)
  WHERE outcome = 'initiated';

ALTER TABLE public.community_request_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crc_select" ON public.community_request_contacts;
CREATE POLICY "crc_select" ON public.community_request_contacts
  FOR SELECT TO authenticated
  USING (
    contacted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.blood_requests br
      WHERE br.id = request_id AND br.requester_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.community_org_members m
      WHERE m.org_id = community_request_contacts.org_id
        AND m.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS "crc_insert" ON public.community_request_contacts;
CREATE POLICY "crc_insert" ON public.community_request_contacts
  FOR INSERT TO authenticated
  WITH CHECK (contacted_by = auth.uid());

DROP POLICY IF EXISTS "crc_update" ON public.community_request_contacts;
CREATE POLICY "crc_update" ON public.community_request_contacts
  FOR UPDATE TO authenticated
  USING (
    contacted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.blood_requests br
      WHERE br.id = request_id AND br.requester_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.community_org_members m
      WHERE m.org_id = community_request_contacts.org_id
        AND m.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON public.community_request_contacts TO authenticated;
GRANT ALL ON public.community_request_contacts TO service_role;

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
      is_donor = true,
      is_available = false,
      unavailable_until = (COALESCE(NEW.donation_date, CURRENT_DATE)::timestamptz + INTERVAL '3 months')
    WHERE id = NEW.donor_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_donation_confirmed ON public.donations;
CREATE TRIGGER trg_donation_confirmed
  AFTER INSERT ON public.donations
  FOR EACH ROW EXECUTE FUNCTION public.on_donation_confirmed();

CREATE OR REPLACE FUNCTION public.restore_expired_donor_availability()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n INT := 0;
  m INT := 0;
BEGIN
  UPDATE public.profiles
  SET is_available = true, unavailable_until = NULL
  WHERE is_available = false
    AND unavailable_until IS NOT NULL
    AND unavailable_until <= now();
  GET DIAGNOSTICS n = ROW_COUNT;

  UPDATE public.community_donors
  SET unavailable_until = NULL
  WHERE unavailable_until IS NOT NULL
    AND unavailable_until <= now();
  GET DIAGNOSTICS m = ROW_COUNT;

  RETURN n + m;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_expired_donor_availability() TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_expired_donor_availability() TO service_role;

CREATE OR REPLACE FUNCTION public.mark_community_donor_donated(
  p_contact_id UUID,
  p_bags INT DEFAULT 1,
  p_actor UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.community_request_contacts%ROWTYPE;
  v_request public.blood_requests%ROWTYPE;
  v_profile_id UUID;
  v_donation_id UUID;
  v_until TIMESTAMPTZ := now() + INTERVAL '3 months';
  v_phone_digits TEXT;
BEGIN
  IF p_actor IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO c FROM public.community_request_contacts WHERE id = p_contact_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Contact not found';
  END IF;

  SELECT * INTO v_request FROM public.blood_requests WHERE id = c.request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  IF v_request.requester_id IS DISTINCT FROM p_actor
     AND NOT EXISTS (
       SELECT 1 FROM public.community_org_members m
       WHERE m.org_id = COALESCE(c.org_id, v_request.org_id)
         AND m.user_id = p_actor
     )
     AND NOT (
       public.has_role(p_actor, 'admin')
       OR public.has_role(p_actor, 'moderator')
       OR public.is_admin_staff(p_actor)
     )
  THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  v_phone_digits := regexp_replace(COALESCE(c.donor_phone, ''), '\D', '', 'g');
  SELECT p.id INTO v_profile_id
  FROM public.profiles p
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') = v_phone_digits
     OR regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') LIKE '%' || right(v_phone_digits, 10)
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    v_profile_id := c.matched_profile_id;
  END IF;

  IF v_profile_id IS NOT NULL THEN
    INSERT INTO public.donations (donor_id, recipient_id, request_id, bags, confirmed, donation_date, notes)
    VALUES (
      v_profile_id,
      v_request.requester_id,
      c.request_id,
      GREATEST(1, COALESCE(p_bags, 1)),
      true,
      CURRENT_DATE,
      'Assigned via community/org panel'
    )
    RETURNING id INTO v_donation_id;
  END IF;

  IF c.community_donor_id IS NOT NULL THEN
    UPDATE public.community_donors
    SET
      unavailable_until = v_until,
      last_donated_at = now(),
      last_donated_request_id = c.request_id
    WHERE id = c.community_donor_id;
  END IF;

  UPDATE public.community_request_contacts
  SET
    outcome = 'donated',
    bags = GREATEST(1, COALESCE(p_bags, 1)),
    matched_profile_id = COALESCE(v_profile_id, matched_profile_id),
    donation_id = v_donation_id,
    assigned_by = p_actor,
    donated_at = now(),
    updated_at = now()
  WHERE id = p_contact_id;

  RETURN p_contact_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_community_donor_donated(UUID, INT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_community_donor_donated(UUID, INT, UUID) TO service_role;
