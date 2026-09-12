-- Self-serve community org registration (website Join Organization).
-- SECURITY DEFINER RPC only — public still cannot INSERT into community_orgs.

CREATE OR REPLACE FUNCTION public.register_community_org(
  p_name TEXT,
  p_name_bn TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_district_id UUID DEFAULT NULL
)
RETURNS UUID
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
  profile_phone TEXT;
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
    RETURN v_org_id;
  END IF;

  IF clean_phone IS NULL THEN
    SELECT phone INTO profile_phone FROM public.profiles WHERE id = uid;
    clean_phone := nullif(trim(COALESCE(profile_phone, '')), '');
  END IF;

  INSERT INTO public.community_orgs (
    name, name_bn, phone, district_id, is_active, is_verified, sort_order
  )
  VALUES (
    clean_name,
    clean_bn,
    clean_phone,
    p_district_id,
    true,
    false,
    0
  )
  RETURNING id INTO v_org_id;

  -- Roles seeded by AFTER INSERT trigger; ensure + resolve owner role_id
  PERFORM public.ensure_org_default_roles(v_org_id);

  SELECT id INTO owner_role_id
  FROM public.community_org_roles r
  WHERE r.org_id = v_org_id AND r.slug = 'owner'
  LIMIT 1;

  INSERT INTO public.community_org_members (org_id, user_id, role, role_id)
  VALUES (v_org_id, uid, 'owner', owner_role_id);

  RETURN v_org_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_community_org(TEXT, TEXT, TEXT, UUID) TO authenticated;

COMMENT ON FUNCTION public.register_community_org IS
  'Authenticated user creates a community org and becomes owner; redirects clients to /org.';
