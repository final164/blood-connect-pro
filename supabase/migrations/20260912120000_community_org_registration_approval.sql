-- Community org self-registration: KYC status + admin auto-approve setting.

ALTER TABLE public.community_orgs
  ADD COLUMN IF NOT EXISTS kyc_status TEXT NOT NULL DEFAULT 'verified',
  ADD COLUMN IF NOT EXISTS kyc_notes TEXT,
  ADD COLUMN IF NOT EXISTS registration_source TEXT NOT NULL DEFAULT 'admin';

ALTER TABLE public.community_orgs
  DROP CONSTRAINT IF EXISTS community_orgs_kyc_status_check;
ALTER TABLE public.community_orgs
  ADD CONSTRAINT community_orgs_kyc_status_check
  CHECK (kyc_status IN ('pending', 'verified', 'rejected'));

ALTER TABLE public.community_orgs
  DROP CONSTRAINT IF EXISTS community_orgs_registration_source_check;
ALTER TABLE public.community_orgs
  ADD CONSTRAINT community_orgs_registration_source_check
  CHECK (registration_source IN ('admin', 'self'));

-- Existing orgs stay publicly listable / treated as approved.
UPDATE public.community_orgs
SET kyc_status = 'verified'
WHERE kyc_status IS NULL OR kyc_status = '';

CREATE INDEX IF NOT EXISTS community_orgs_kyc_status_idx
  ON public.community_orgs (kyc_status, is_active);

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS community_org_registration_settings JSONB NOT NULL DEFAULT '{
    "auto_approve_registration": false
  }'::jsonb;

UPDATE public.app_settings
SET community_org_registration_settings = COALESCE(
  community_org_registration_settings,
  '{"auto_approve_registration": false}'::jsonb
)
WHERE id = 1;

-- Replace register RPC: respect auto-approve; return org_id + status.
DROP FUNCTION IF EXISTS public.register_community_org(TEXT, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.register_community_org(
  p_name TEXT,
  p_name_bn TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_district_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  v_org_id UUID;
  owner_role_id UUID;
  clean_name TEXT := nullif(trim(COALESCE(p_name, '')), '');
  clean_bn TEXT := nullif(trim(COALESCE(p_name_bn, '')), '');
  clean_phone TEXT := nullif(trim(COALESCE(p_phone, '')), '');
  clean_email TEXT := nullif(trim(COALESCE(p_email, '')), '');
  clean_desc TEXT := nullif(trim(COALESCE(p_description, '')), '');
  profile_phone TEXT;
  auto_approve BOOLEAN := false;
  settings_raw JSONB;
  v_status TEXT;
  v_verified BOOLEAN;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  IF clean_name IS NULL THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  -- Already an owner → return existing org (idempotent UX)
  SELECT m.org_id INTO v_org_id
  FROM public.community_org_members m
  WHERE m.user_id = uid AND lower(m.role) = 'owner'
  ORDER BY m.created_at ASC
  LIMIT 1;

  IF v_org_id IS NOT NULL THEN
    SELECT o.kyc_status, o.is_verified
      INTO v_status, v_verified
    FROM public.community_orgs o
    WHERE o.id = v_org_id;
    RETURN jsonb_build_object(
      'org_id', v_org_id,
      'kyc_status', COALESCE(v_status, 'verified'),
      'auto_approved', COALESCE(v_verified, false),
      'already_member', true
    );
  END IF;

  IF clean_phone IS NULL THEN
    SELECT phone INTO profile_phone FROM public.profiles WHERE id = uid;
    clean_phone := nullif(trim(COALESCE(profile_phone, '')), '');
  END IF;

  IF clean_phone IS NULL THEN
    RAISE EXCEPTION 'Organization phone is required';
  END IF;

  SELECT community_org_registration_settings
    INTO settings_raw
  FROM public.app_settings
  WHERE id = 1;

  auto_approve := COALESCE((settings_raw ->> 'auto_approve_registration')::boolean, false);

  IF auto_approve THEN
    v_status := 'verified';
    v_verified := true;
  ELSE
    v_status := 'pending';
    v_verified := false;
  END IF;

  INSERT INTO public.community_orgs (
    name, name_bn, phone, email, description, district_id,
    is_active, is_verified, kyc_status, registration_source, sort_order
  )
  VALUES (
    clean_name,
    clean_bn,
    clean_phone,
    clean_email,
    clean_desc,
    p_district_id,
    true,
    v_verified,
    v_status,
    'self',
    0
  )
  RETURNING id INTO v_org_id;

  PERFORM public.ensure_org_default_roles(v_org_id);

  SELECT id INTO owner_role_id
  FROM public.community_org_roles r
  WHERE r.org_id = v_org_id AND r.slug = 'owner'
  LIMIT 1;

  INSERT INTO public.community_org_members (org_id, user_id, role, role_id)
  VALUES (v_org_id, uid, 'owner', owner_role_id);

  RETURN jsonb_build_object(
    'org_id', v_org_id,
    'kyc_status', v_status,
    'auto_approved', auto_approve,
    'already_member', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_community_org(TEXT, TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.register_community_org IS
  'Self-serve community org registration. Honors app_settings.community_org_registration_settings.auto_approve_registration.';
