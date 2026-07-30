-- Per-role geo scope for Users admin filters (district / upazila)

ALTER TABLE public.admin_roles
  ADD COLUMN IF NOT EXISTS users_geo_scope JSONB NOT NULL DEFAULT '{"districts":"all","upazilas":"all"}'::jsonb;

COMMENT ON COLUMN public.admin_roles.users_geo_scope IS
  'Users module filter scope: {"districts":"all"|[uuid...],"upazilas":"all"|["districtId::name_bn"...]}';

CREATE OR REPLACE FUNCTION public.get_my_users_geo_scope()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  scopes jsonb[];
  s jsonb;
  all_d boolean := false;
  all_u boolean := false;
  d_ids text[] := ARRAY[]::text[];
  u_keys text[] := ARRAY[]::text[];
  d_part jsonb;
  u_part jsonb;
BEGIN
  IF uid IS NULL THEN
    RETURN '{"districts":"all","upazilas":"all"}'::jsonb;
  END IF;

  IF public.is_super_admin_user(uid) THEN
    RETURN '{"districts":"all","upazilas":"all"}'::jsonb;
  END IF;

  SELECT coalesce(array_agg(r.users_geo_scope), ARRAY[]::jsonb[])
  INTO scopes
  FROM public.admin_user_roles ur
  JOIN public.admin_roles r ON r.id = ur.role_id AND r.is_active = true
  WHERE ur.user_id = uid;

  IF scopes IS NULL OR array_length(scopes, 1) IS NULL THEN
    -- No staff role: treat as all (permission keys still gate UI)
    RETURN '{"districts":"all","upazilas":"all"}'::jsonb;
  END IF;

  FOREACH s IN ARRAY scopes LOOP
    d_part := s->'districts';
    u_part := s->'upazilas';

    IF d_part IS NULL OR jsonb_typeof(d_part) = 'string' THEN
      IF coalesce(d_part #>> '{}', 'all') = 'all' THEN all_d := true; END IF;
    ELSIF jsonb_typeof(d_part) = 'array' THEN
      IF jsonb_array_length(d_part) = 0 THEN
        all_d := true;
      ELSE
        SELECT d_ids || array_agg(x)
        INTO d_ids
        FROM jsonb_array_elements_text(d_part) AS t(x);
      END IF;
    END IF;

    IF u_part IS NULL OR jsonb_typeof(u_part) = 'string' THEN
      IF coalesce(u_part #>> '{}', 'all') = 'all' THEN all_u := true; END IF;
    ELSIF jsonb_typeof(u_part) = 'array' THEN
      IF jsonb_array_length(u_part) = 0 THEN
        all_u := true;
      ELSE
        SELECT u_keys || array_agg(x)
        INTO u_keys
        FROM jsonb_array_elements_text(u_part) AS t(x);
      END IF;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'districts', CASE WHEN all_d THEN to_jsonb('all'::text) ELSE to_jsonb(ARRAY(SELECT DISTINCT unnest(d_ids))) END,
    'upazilas', CASE WHEN all_u THEN to_jsonb('all'::text) ELSE to_jsonb(ARRAY(SELECT DISTINCT unnest(u_keys))) END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_users_geo_scope() TO authenticated;
