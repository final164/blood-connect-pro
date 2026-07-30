-- Allow users to read their own login PIN (for change-PIN in settings)
DROP POLICY IF EXISTS "creds_select_self" ON public.user_login_credentials;
CREATE POLICY "creds_select_self" ON public.user_login_credentials
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
