-- Fix ambulance CMS catalog RLS: admins can manage form fields & other catalogs

-- Form fields: admins see disabled fields too
DROP POLICY IF EXISTS ambulance_form_read ON public.ambulance_form_fields;
CREATE POLICY ambulance_form_read ON public.ambulance_form_fields
FOR SELECT TO authenticated
USING (
  is_enabled
  OR public.is_care_staff()
  OR public.has_admin_permission(auth.uid(), 'ambulance.edit')
);

-- Admin write on global ambulance CMS catalogs (AmbulanceAdmin upserts)
DO $$
DECLARE
  t TEXT;
  pol TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ambulance_service_types',
    'ambulance_equipment_options',
    'ambulance_request_statuses',
    'ambulance_status_transitions',
    'ambulance_priority_levels',
    'ambulance_form_fields',
    'ambulance_notif_templates'
  ]
  LOOP
    pol := t || '_admin_all';
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    EXECUTE format(
      $p$
      CREATE POLICY %I ON public.%I FOR ALL TO authenticated
      USING (
        public.is_care_staff()
        OR public.has_admin_permission(auth.uid(), 'ambulance.edit')
      )
      WITH CHECK (
        public.is_care_staff()
        OR public.has_admin_permission(auth.uid(), 'ambulance.edit')
      )
      $p$,
      pol,
      t
    );
  END LOOP;
END $$;

-- Notif templates had RLS on but no SELECT policy
DROP POLICY IF EXISTS ambulance_notif_read ON public.ambulance_notif_templates;
CREATE POLICY ambulance_notif_read ON public.ambulance_notif_templates
FOR SELECT TO authenticated
USING (true);
