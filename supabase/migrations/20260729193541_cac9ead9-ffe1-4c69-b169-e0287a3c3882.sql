-- 1. Notifications: only for yourself
DROP POLICY IF EXISTS notif_insert_self_only ON public.notifications;
CREATE POLICY notif_insert_self ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 2. Profiles: restrict full-row reads
DROP POLICY IF EXISTS profiles_select_all_auth ON public.profiles;
CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = false) AS
SELECT id, full_name, username, avatar_url, bio, blood_group, is_donor, is_recipient,
       city, area, e2ee_public_key, is_verified, is_available, total_donations, lives_saved, created_at
FROM public.profiles;
GRANT SELECT ON public.profiles_public TO authenticated;

-- 3. Blood requests: mask contact phone for uninvolved users
DROP POLICY IF EXISTS req_read_all_auth ON public.blood_requests;
CREATE POLICY req_read_owner ON public.blood_requests
  FOR SELECT TO authenticated
  USING (
    auth.uid() = requester_id
    OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
  );

CREATE OR REPLACE VIEW public.blood_requests_public
WITH (security_invoker = false) AS
SELECT r.id, r.requester_id, r.patient_name, r.blood_group, r.bags_needed, r.hospital_name,
       r.city, r.area, r.latitude, r.longitude, r.needed_by, r.urgency, r.notes, r.status,
       r.created_at, r.updated_at,
       CASE
         WHEN auth.uid() = r.requester_id
           OR EXISTS (SELECT 1 FROM public.donations d WHERE d.request_id = r.id AND (d.donor_id = auth.uid() OR d.recipient_id = auth.uid()))
           OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin')
         THEN r.contact_phone
         ELSE NULL
       END AS contact_phone
FROM public.blood_requests r;
GRANT SELECT ON public.blood_requests_public TO authenticated;

-- 4. Messages: block guest (anonymous) accounts
DROP POLICY IF EXISTS msg_read_participant ON public.messages;
DROP POLICY IF EXISTS msg_update_participant ON public.messages;
CREATE POLICY msg_read_participant ON public.messages
  FOR SELECT TO authenticated
  USING (
    coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND (auth.uid() = sender_id OR auth.uid() = recipient_id)
  );
CREATE POLICY msg_update_participant ON public.messages
  FOR UPDATE TO authenticated
  USING (
    coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
    AND (auth.uid() = sender_id OR auth.uid() = recipient_id)
  );

-- 5. Remove per-user third-party API key storage
ALTER TABLE public.user_settings DROP COLUMN IF EXISTS google_maps_api_key;

-- 6. Lock down SECURITY DEFINER helper
DROP POLICY IF EXISTS app_settings_admin_write ON public.app_settings;
CREATE POLICY app_settings_admin_write ON public.app_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'admin'));

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;