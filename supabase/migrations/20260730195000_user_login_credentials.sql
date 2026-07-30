-- Admin-visible phone + PIN (not exposed on public profiles select)
CREATE TABLE IF NOT EXISTS public.user_login_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  pin TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_login_credentials_phone_idx
  ON public.user_login_credentials (phone);

ALTER TABLE public.user_login_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "creds_select_admin" ON public.user_login_credentials;
CREATE POLICY "creds_select_admin" ON public.user_login_credentials
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'moderator')
    OR public.is_admin_staff(auth.uid())
  );

DROP POLICY IF EXISTS "creds_insert_self" ON public.user_login_credentials;
CREATE POLICY "creds_insert_self" ON public.user_login_credentials
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "creds_update_self" ON public.user_login_credentials;
CREATE POLICY "creds_update_self" ON public.user_login_credentials
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "creds_admin_write" ON public.user_login_credentials;
CREATE POLICY "creds_admin_write" ON public.user_login_credentials
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  );

GRANT SELECT, INSERT, UPDATE ON public.user_login_credentials TO authenticated;
GRANT ALL ON public.user_login_credentials TO service_role;

DROP TRIGGER IF EXISTS trg_user_login_credentials_updated ON public.user_login_credentials;
CREATE TRIGGER trg_user_login_credentials_updated
  BEFORE UPDATE ON public.user_login_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.user_login_credentials (user_id, phone, pin)
SELECT p.id, COALESCE(p.phone, '01700000000'), '1212'
FROM public.profiles p
WHERE p.phone = '01700000000'
   OR p.id IN (
     SELECT id FROM auth.users
     WHERE lower(email) LIKE 'bd01700000000@%'
        OR lower(email) = '01700000000@phone.bloodlink.local'
        OR lower(email) = 'blood@gmail.com'
   )
ON CONFLICT (user_id) DO UPDATE SET
  phone = EXCLUDED.phone,
  pin = EXCLUDED.pin,
  updated_at = now();
