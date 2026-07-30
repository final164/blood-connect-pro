-- Admin can read user PIN via security-definer RPC (bypasses RLS safely)

CREATE OR REPLACE FUNCTION public.admin_get_user_pin(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_phone text;
  v_pin text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (
    public.has_role(v_uid, 'admin')
    OR public.is_admin_staff(v_uid)
    OR public.has_admin_permission(v_uid, 'users.view_pin')
    OR public.has_admin_permission(v_uid, 'users.view')
  ) THEN
    RAISE EXCEPTION 'No permission to view PIN';
  END IF;

  SELECT c.phone, c.pin INTO v_phone, v_pin
  FROM public.user_login_credentials c
  WHERE c.user_id = p_user_id;

  IF v_pin IS NULL OR v_pin = '' THEN
    SELECT
      COALESCE(v_phone, u.raw_user_meta_data->>'phone'),
      COALESCE(NULLIF(u.raw_user_meta_data->>'pin', ''), NULLIF(u.raw_app_meta_data->>'pin', ''))
    INTO v_phone, v_pin
    FROM auth.users u
    WHERE u.id = p_user_id;
  END IF;

  IF v_pin IS NULL OR v_pin = '' THEN
    SELECT COALESCE(v_phone, p.phone) INTO v_phone
    FROM public.profiles p
    WHERE p.id = p_user_id;

    RETURN jsonb_build_object(
      'user_id', p_user_id,
      'phone', v_phone,
      'pin', NULL,
      'found', false
    );
  END IF;

  RETURN jsonb_build_object(
    'user_id', p_user_id,
    'phone', v_phone,
    'pin', v_pin,
    'found', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_get_user_pin(uuid) TO authenticated;

DROP POLICY IF EXISTS "creds_select_admin" ON public.user_login_credentials;
CREATE POLICY "creds_select_admin" ON public.user_login_credentials
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
    OR public.has_admin_permission(auth.uid(), 'users.view_pin')
    OR public.has_admin_permission(auth.uid(), 'users.view')
  );
