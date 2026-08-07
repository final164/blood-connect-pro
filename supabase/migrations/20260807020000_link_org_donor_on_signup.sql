-- Link org-imported community donors to profile when they sign up with the same phone.
-- Also restores cooldown fields and backfills donations from community_request_contacts.

CREATE OR REPLACE FUNCTION public.link_org_donor_history_to_profile(p_user_id UUID DEFAULT auth.uid())
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT;
  v_digits TEXT;
  v_donor RECORD;
  v_contact RECORD;
  v_linked INT := 0;
  v_donation_id UUID;
  v_enabled BOOLEAN := true;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Respect admin messaging setting when present
  BEGIN
    SELECT COALESCE((notification_settings IS NOT NULL), true) INTO v_enabled
    FROM app_settings WHERE id = 1;
    SELECT COALESCE((messaging_settings->>'link_org_donor_on_signup')::boolean, true)
      INTO v_enabled
    FROM app_settings WHERE id = 1;
  EXCEPTION WHEN OTHERS THEN
    v_enabled := true;
  END;

  IF NOT v_enabled THEN
    RETURN 0;
  END IF;

  SELECT phone INTO v_phone FROM public.profiles WHERE id = p_user_id;
  v_digits := regexp_replace(COALESCE(v_phone, ''), '\D', '', 'g');
  IF length(v_digits) < 10 THEN
    RETURN 0;
  END IF;

  -- Clear expired cooldowns first
  PERFORM public.restore_expired_donor_availability();

  FOR v_donor IN
    SELECT *
    FROM public.community_donors d
    WHERE d.is_active = true
      AND (
        regexp_replace(COALESCE(d.phone, ''), '\D', '', 'g') = v_digits
        OR regexp_replace(COALESCE(d.phone, ''), '\D', '', 'g') LIKE '%' || right(v_digits, 10)
        OR v_digits LIKE '%' || right(regexp_replace(COALESCE(d.phone, ''), '\D', '', 'g'), 10)
      )
  LOOP
    v_linked := v_linked + 1;

    -- Fill empty profile fields from org donor card
    UPDATE public.profiles p
    SET
      blood_group = COALESCE(
        p.blood_group,
        CASE
          WHEN v_donor.blood_group IN ('A+','A-','B+','B-','AB+','AB-','O+','O-')
            THEN v_donor.blood_group::public.blood_group
          ELSE NULL
        END
      ),
      gender = COALESCE(NULLIF(p.gender, ''), v_donor.gender),
      district_id = COALESCE(p.district_id, v_donor.district_id),
      full_name = CASE
        WHEN p.full_name IS NULL OR btrim(p.full_name) = '' OR p.full_name LIKE '%@%'
          THEN COALESCE(NULLIF(v_donor.full_name, ''), p.full_name)
        ELSE p.full_name
      END,
      last_donation_date = COALESCE(
        p.last_donation_date,
        CASE WHEN v_donor.last_donated_at IS NOT NULL THEN (v_donor.last_donated_at AT TIME ZONE 'UTC')::date ELSE NULL END
      ),
      unavailable_until = CASE
        WHEN v_donor.unavailable_until IS NOT NULL AND v_donor.unavailable_until > now()
          THEN GREATEST(COALESCE(p.unavailable_until, v_donor.unavailable_until), v_donor.unavailable_until)
        ELSE p.unavailable_until
      END,
      is_available = CASE
        WHEN v_donor.unavailable_until IS NOT NULL AND v_donor.unavailable_until > now() THEN false
        ELSE p.is_available
      END
    WHERE p.id = p_user_id;

    -- Backfill donations from donated community contacts
    FOR v_contact IN
      SELECT c.*
      FROM public.community_request_contacts c
      WHERE c.outcome = 'donated'
        AND (
          c.community_donor_id = v_donor.id
          OR (
            c.community_donor_id IS NULL
            AND (
              regexp_replace(COALESCE(c.donor_phone, ''), '\D', '', 'g') = v_digits
              OR regexp_replace(COALESCE(c.donor_phone, ''), '\D', '', 'g') LIKE '%' || right(v_digits, 10)
            )
          )
        )
    LOOP
      UPDATE public.community_request_contacts
      SET matched_profile_id = COALESCE(matched_profile_id, p_user_id),
          updated_at = now()
      WHERE id = v_contact.id;

      IF v_contact.donation_id IS NULL THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.donations d
          WHERE d.donor_id = p_user_id
            AND d.request_id = v_contact.request_id
        ) THEN
          INSERT INTO public.donations (donor_id, recipient_id, request_id, bags, confirmed, donation_date, notes)
          SELECT
            p_user_id,
            br.requester_id,
            v_contact.request_id,
            GREATEST(1, COALESCE(v_contact.bags, 1)),
            true,
            COALESCE(v_contact.donated_at::date, CURRENT_DATE),
            'Synced from organization donor record'
          FROM public.blood_requests br
          WHERE br.id = v_contact.request_id
          RETURNING id INTO v_donation_id;

          IF v_donation_id IS NOT NULL THEN
            UPDATE public.community_request_contacts
            SET donation_id = v_donation_id, updated_at = now()
            WHERE id = v_contact.id;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_linked;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'link_org_donor_history_to_profile failed for %: %', p_user_id, SQLERRM;
  RETURN 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_org_donor_history_to_profile(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_org_donor_history_to_profile(UUID) TO service_role;

-- Call linker after profile is created on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    NULLIF(NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, public.profiles.phone);

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  BEGIN
    PERFORM public.link_org_donor_history_to_profile(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'link_org_donor_history_to_profile on signup failed: %', SQLERRM;
  END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;
