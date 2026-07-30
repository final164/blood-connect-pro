-- Recognize phone-PIN admin synthetic emails (after .local was rejected by Supabase Auth).
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.is_super_admin_user(_uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _uid
      AND (
        lower(u.email) = 'blood@gmail.com'
        OR lower(u.email) = '01700000000@phone.bloodlink.local'
        OR lower(u.email) = 'bd01700000000@bloodlink.app'
        OR lower(u.email) = 'bd01700000000@supabase.co'
        OR lower(u.email) LIKE 'bd01700000000@%'
      )
  )
  OR EXISTS (
    SELECT 1
    FROM public.admin_user_roles aur
    JOIN public.admin_roles r ON r.id = aur.role_id
    WHERE aur.user_id = _uid AND r.slug = 'super-admin'
  );
$$;
