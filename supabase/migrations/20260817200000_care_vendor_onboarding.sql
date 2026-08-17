-- Care vendor: phone-only register + deferred profile onboarding + admin-controlled fields

-- (also in 20260817120000 — safe if that migration was not applied yet)
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

ALTER TABLE public.care_orgs
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS profile_submitted_at TIMESTAMPTZ;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS care_vendor_onboarding JSONB NOT NULL DEFAULT '{
    "fields": {
      "owner_name": { "enabled": true, "required": true, "label_bn": "মালিকের নাম", "label_en": "Owner name" },
      "org_name": { "enabled": true, "required": true, "label_bn": "প্রতিষ্ঠানের নাম", "label_en": "Organization name" },
      "org_name_bn": { "enabled": true, "required": false, "label_bn": "প্রতিষ্ঠান (বাংলা)", "label_en": "Organization (Bangla)" },
      "org_kind": { "enabled": true, "required": true, "label_bn": "ভেন্ডর ধরন", "label_en": "Vendor type" },
      "org_phone": { "enabled": true, "required": true, "label_bn": "প্রতিষ্ঠান ফোন", "label_en": "Organization phone" },
      "email": { "enabled": true, "required": false, "label_bn": "ইমেইল", "label_en": "Email" },
      "district": { "enabled": true, "required": true, "label_bn": "জেলা", "label_en": "District" },
      "upazila": { "enabled": true, "required": true, "label_bn": "উপজেলা", "label_en": "Upazila" },
      "address": { "enabled": true, "required": true, "label_bn": "ঠিকানা", "label_en": "Address" },
      "location_name": { "enabled": true, "required": false, "label_bn": "শাখা / চেম্বার", "label_en": "Branch / chamber" },
      "description": { "enabled": true, "required": false, "label_bn": "বিবরণ", "label_en": "Description" }
    }
  }'::jsonb;

UPDATE public.app_settings
SET care_vendor_onboarding = COALESCE(care_vendor_onboarding, '{}'::jsonb)
WHERE id = 1;

-- Minimal vendor account after phone+PIN signup (stub org, complete profile later)
CREATE OR REPLACE FUNCTION public.care_register_vendor_account()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  v_org_id UUID;
  kind_id UUID;
  owner_role_id UUID;
  owner_phone TEXT;
  stub_name TEXT;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.care_org_members m
    WHERE m.user_id = uid AND m.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'You already own a care organization';
  END IF;

  SELECT phone INTO owner_phone FROM public.profiles WHERE id = uid;
  stub_name := COALESCE(NULLIF(trim(owner_phone), ''), 'Care vendor');

  SELECT id INTO kind_id FROM public.care_vendor_types WHERE slug = 'chamber' AND is_active LIMIT 1;
  IF kind_id IS NULL THEN
    SELECT id INTO kind_id FROM public.care_vendor_types WHERE is_active ORDER BY sort_order LIMIT 1;
  END IF;

  INSERT INTO public.care_orgs (
    org_kind_id, name, phone, is_active, is_verified, is_listed,
    kyc_status, profile_completed
  )
  VALUES (
    kind_id, stub_name, owner_phone, true, false, false, 'draft', false
  )
  RETURNING id INTO v_org_id;

  PERFORM public.ensure_care_default_roles(v_org_id);

  SELECT id INTO owner_role_id
  FROM public.care_org_roles r
  WHERE r.org_id = v_org_id AND r.slug = 'owner'
  LIMIT 1;

  INSERT INTO public.care_org_members (org_id, user_id, role, role_id)
  VALUES (v_org_id, uid, 'owner', owner_role_id);

  UPDATE public.profiles
  SET account_kind = 'care_vendor', updated_at = now()
  WHERE id = uid;

  PERFORM public.care_write_audit(v_org_id, 'vendor.register', 'care_orgs', v_org_id,
    jsonb_build_object('mode', 'phone_only'));

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_register_vendor_account() TO authenticated;

-- Owner saves draft profile (does not submit for approval)
CREATE OR REPLACE FUNCTION public.care_save_vendor_profile(
  _org_id UUID,
  _payload JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  kind_slug TEXT;
  kind_id UUID;
  loc_id UUID;
  owner_name TEXT;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.care_org_members m
    WHERE m.org_id = _org_id AND m.user_id = uid AND m.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;

  kind_slug := NULLIF(trim(_payload->>'org_kind_slug'), '');
  IF kind_slug IS NOT NULL THEN
    SELECT id INTO kind_id FROM public.care_vendor_types
    WHERE slug = lower(kind_slug) AND is_active LIMIT 1;
  END IF;

  owner_name := NULLIF(trim(_payload->>'owner_name'), '');
  IF owner_name IS NOT NULL THEN
    UPDATE public.profiles SET full_name = owner_name, updated_at = now() WHERE id = uid;
  END IF;

  UPDATE public.care_orgs o SET
    org_kind_id = COALESCE(kind_id, o.org_kind_id),
    name = COALESCE(NULLIF(trim(_payload->>'org_name'), ''), o.name),
    name_bn = COALESCE(NULLIF(trim(_payload->>'org_name_bn'), ''), o.name_bn),
    phone = COALESCE(NULLIF(trim(_payload->>'org_phone'), ''), o.phone),
    email = COALESCE(NULLIF(trim(_payload->>'email'), ''), o.email),
    description = COALESCE(NULLIF(trim(_payload->>'description'), ''), o.description),
    description_bn = COALESCE(NULLIF(trim(_payload->>'description_bn'), ''), o.description_bn),
    district_id = CASE
      WHEN _payload ? 'district_id' AND NULLIF(_payload->>'district_id', '') IS NOT NULL
      THEN (_payload->>'district_id')::uuid
      ELSE o.district_id
    END,
    upazila = COALESCE(NULLIF(trim(_payload->>'upazila'), ''), o.upazila),
    address = COALESCE(NULLIF(trim(_payload->>'address'), ''), o.address),
    updated_at = now()
  WHERE o.id = _org_id;

  SELECT id INTO loc_id FROM public.care_locations
  WHERE org_id = _org_id ORDER BY sort_order, created_at LIMIT 1;

  IF loc_id IS NULL THEN
    INSERT INTO public.care_locations (org_id, name, name_bn, district_id, upazila, address, is_active, sort_order)
    VALUES (
      _org_id,
      COALESCE(NULLIF(trim(_payload->>'location_name'), ''), NULLIF(trim(_payload->>'org_name'), ''), 'Main'),
      NULLIF(trim(_payload->>'org_name_bn'), ''),
      CASE WHEN _payload ? 'district_id' AND NULLIF(_payload->>'district_id', '') IS NOT NULL
        THEN (_payload->>'district_id')::uuid ELSE NULL END,
      NULLIF(trim(_payload->>'upazila'), ''),
      NULLIF(trim(_payload->>'address'), ''),
      true, 0
    );
  ELSE
    UPDATE public.care_locations SET
      name = COALESCE(NULLIF(trim(_payload->>'location_name'), ''), name),
      name_bn = COALESCE(NULLIF(trim(_payload->>'org_name_bn'), ''), name_bn),
      district_id = CASE
        WHEN _payload ? 'district_id' AND NULLIF(_payload->>'district_id', '') IS NOT NULL
        THEN (_payload->>'district_id')::uuid ELSE district_id END,
      upazila = COALESCE(NULLIF(trim(_payload->>'upazila'), ''), upazila),
      address = COALESCE(NULLIF(trim(_payload->>'address'), ''), address),
      updated_at = now()
    WHERE id = loc_id;
  END IF;

  PERFORM public.care_write_audit(_org_id, 'vendor.profile.save', 'care_orgs', _org_id, '{}'::jsonb);
  RETURN _org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_save_vendor_profile(UUID, JSONB) TO authenticated;

-- Submit profile for admin approval
CREATE OR REPLACE FUNCTION public.care_submit_vendor_profile(_org_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  cfg JSONB;
  fields JSONB;
  fk TEXT;
  fcfg JSONB;
  org public.care_orgs%ROWTYPE;
  prof public.profiles%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.care_org_members m
    WHERE m.org_id = _org_id AND m.user_id = uid AND m.role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Owner access required';
  END IF;

  SELECT * INTO org FROM public.care_orgs WHERE id = _org_id;
  SELECT * INTO prof FROM public.profiles WHERE id = uid;

  SELECT care_vendor_onboarding INTO cfg FROM public.app_settings WHERE id = 1;
  fields := COALESCE(cfg->'fields', '{}'::jsonb);

  FOR fk, fcfg IN SELECT * FROM jsonb_each(fields) LOOP
    IF COALESCE((fcfg->>'enabled')::boolean, true) IS NOT TRUE THEN CONTINUE; END IF;
    IF COALESCE((fcfg->>'required')::boolean, false) IS NOT TRUE THEN CONTINUE; END IF;

    IF fk = 'owner_name' AND NULLIF(trim(prof.full_name), '') IS NULL THEN
      RAISE EXCEPTION 'Owner name is required';
    ELSIF fk = 'org_name' AND NULLIF(trim(org.name), '') IS NULL THEN
      RAISE EXCEPTION 'Organization name is required';
    ELSIF fk = 'org_name_bn' AND NULLIF(trim(org.name_bn), '') IS NULL THEN
      RAISE EXCEPTION 'Organization name (Bangla) is required';
    ELSIF fk = 'org_kind' AND org.org_kind_id IS NULL THEN
      RAISE EXCEPTION 'Vendor type is required';
    ELSIF fk = 'org_phone' AND NULLIF(trim(org.phone), '') IS NULL THEN
      RAISE EXCEPTION 'Organization phone is required';
    ELSIF fk = 'email' AND NULLIF(trim(org.email), '') IS NULL THEN
      RAISE EXCEPTION 'Email is required';
    ELSIF fk = 'district' AND org.district_id IS NULL THEN
      RAISE EXCEPTION 'District is required';
    ELSIF fk = 'upazila' AND NULLIF(trim(org.upazila), '') IS NULL THEN
      RAISE EXCEPTION 'Upazila is required';
    ELSIF fk = 'address' AND NULLIF(trim(org.address), '') IS NULL THEN
      RAISE EXCEPTION 'Address is required';
    ELSIF fk = 'description' AND NULLIF(trim(org.description), '') IS NULL THEN
      RAISE EXCEPTION 'Description is required';
    END IF;
  END LOOP;

  UPDATE public.care_orgs SET
    profile_completed = true,
    profile_submitted_at = now(),
    kyc_status = 'pending',
    updated_at = now()
  WHERE id = _org_id;

  PERFORM public.care_write_audit(_org_id, 'vendor.profile.submit', 'care_orgs', _org_id, '{}'::jsonb);
  RETURN _org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_submit_vendor_profile(UUID) TO authenticated;

-- Keep legacy full-register RPC but delegate to account + save when name provided
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
  v_org_id UUID;
BEGIN
  v_org_id := public.care_register_vendor_account();
  PERFORM public.care_save_vendor_profile(v_org_id, jsonb_build_object(
    'org_name', _name,
    'org_name_bn', _name_bn,
    'org_phone', _org_phone,
    'org_kind_slug', _org_kind_slug,
    'district_id', _district_id,
    'upazila', _upazila,
    'address', _address,
    'location_name', _location_name
  ));
  RETURN v_org_id;
END;
$$;
