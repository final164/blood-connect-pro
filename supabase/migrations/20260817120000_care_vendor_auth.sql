-- Care vendor self-registration + account kind (separate from donor onboarding)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_kind TEXT NOT NULL DEFAULT 'patient'
  CHECK (account_kind IN ('patient', 'care_vendor'));

CREATE INDEX IF NOT EXISTS profiles_account_kind_idx ON public.profiles (account_kind)
  WHERE account_kind = 'care_vendor';

-- Self-register a care org (chamber / clinic / lab) for the logged-in user as owner
CREATE OR REPLACE FUNCTION public.care_register_vendor(
  _name TEXT,
  _name_bn TEXT DEFAULT NULL,
  _org_phone TEXT DEFAULT NULL,
  _org_kind_slug TEXT DEFAULT 'chamber',
  _district_id UUID DEFAULT NULL,
  _upazila TEXT DEFAULT NULL,
  _address TEXT DEFAULT NULL,
  _location_name TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  v_org_id UUID;
  kind_id UUID;
  loc_name TEXT;
  owner_role_id UUID;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  IF NULLIF(trim(_name), '') IS NULL THEN
    RAISE EXCEPTION 'Organization name is required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.care_org_members m
    WHERE m.user_id = uid AND m.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'You already own a care organization';
  END IF;

  SELECT id INTO kind_id
  FROM public.care_vendor_types
  WHERE slug = lower(trim(_org_kind_slug)) AND is_active
  LIMIT 1;

  IF kind_id IS NULL THEN
    SELECT id INTO kind_id FROM public.care_vendor_types WHERE slug = 'chamber' LIMIT 1;
  END IF;

  INSERT INTO public.care_orgs (
    org_kind_id, name, name_bn, phone, district_id, upazila, address,
    is_active, is_verified, is_listed, kyc_status
  )
  VALUES (
    kind_id,
    trim(_name),
    NULLIF(trim(_name_bn), ''),
    NULLIF(trim(_org_phone), ''),
    _district_id,
    NULLIF(trim(_upazila), ''),
    NULLIF(trim(_address), ''),
    true,
    false,
    false,
    'pending'
  )
  RETURNING id INTO v_org_id;

  PERFORM public.ensure_care_default_roles(v_org_id);

  SELECT id INTO owner_role_id
  FROM public.care_org_roles r
  WHERE r.org_id = v_org_id AND r.slug = 'owner'
  LIMIT 1;

  INSERT INTO public.care_org_members (org_id, user_id, role, role_id)
  VALUES (v_org_id, uid, 'owner', owner_role_id);

  loc_name := COALESCE(NULLIF(trim(_location_name), ''), trim(_name));
  INSERT INTO public.care_locations (org_id, name, name_bn, district_id, upazila, address, is_active, sort_order)
  VALUES (
    v_org_id,
    loc_name,
    NULLIF(trim(_name_bn), ''),
    _district_id,
    NULLIF(trim(_upazila), ''),
    NULLIF(trim(_address), ''),
    true,
    0
  );

  UPDATE public.profiles
  SET account_kind = 'care_vendor', updated_at = now()
  WHERE id = uid;

  PERFORM public.care_write_audit(v_org_id, 'vendor.register', 'care_orgs', v_org_id,
    jsonb_build_object('org_kind_slug', _org_kind_slug));

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_register_vendor(TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TEXT) TO authenticated;
