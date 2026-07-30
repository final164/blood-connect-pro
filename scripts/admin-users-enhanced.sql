-- Admin users: block flag + extended permissions
-- Run in Supabase SQL Editor if migration is not applied.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN NOT NULL DEFAULT false;

INSERT INTO public.admin_permissions (key, module, action, label_en, label_bn, sort_order) VALUES
  ('users.filter_search', 'users', 'filter_search', 'Filter: phone search', 'ফিল্টার: ফোন সার্চ', 24),
  ('users.filter_role', 'users', 'filter_role', 'Filter: role', 'ফিল্টার: রোল', 25),
  ('users.filter_district', 'users', 'filter_district', 'Filter: district', 'ফিল্টার: জেলা', 26),
  ('users.filter_upazila', 'users', 'filter_upazila', 'Filter: upazila', 'ফিল্টার: উপজেলা', 27),
  ('users.filter_blood_group', 'users', 'filter_blood_group', 'Filter: blood group', 'ফিল্টার: রক্তের গ্রুপ', 28),
  ('users.filter_donated', 'users', 'filter_donated', 'Filter: donated', 'ফিল্টার: দান করেছে', 29),
  ('users.filter_received', 'users', 'filter_received', 'Filter: received', 'ফিল্টার: গ্রহণ (complete)', 30),
  ('users.view_pin', 'users', 'view_pin', 'View user PIN', 'ইউজার PIN দেখা', 31),
  ('users.block', 'users', 'block', 'Block / unblock users', 'ইউজার ব্লক', 32),
  ('users.delete', 'users', 'delete', 'Delete users', 'ইউজার ডিলিট', 33)
ON CONFLICT (key) DO UPDATE SET
  module = EXCLUDED.module,
  action = EXCLUDED.action,
  label_en = EXCLUDED.label_en,
  label_bn = EXCLUDED.label_bn,
  sort_order = EXCLUDED.sort_order;

DROP POLICY IF EXISTS "profiles_admin_update" ON public.profiles;
CREATE POLICY "profiles_admin_update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  )
  WITH CHECK (
    auth.uid() = id
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_admin_staff(auth.uid())
  );
