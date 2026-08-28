-- Fast blood-request inserts: defer matching alerts + batch web-push (no N×http_post on insert).

CREATE OR REPLACE FUNCTION public.dispatch_web_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hook_secret text;
  fn_url text := 'https://aunxredquwbokhpluzgj.supabase.co/functions/v1/send-push';
  push_enabled boolean := true;
  skip text;
BEGIN
  -- Bulk fan-out / service paths set this to avoid N HTTP posts inside one statement
  skip := NULLIF(current_setting('app.skip_web_push', true), '');
  IF skip IN ('on', 'true', '1') THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(notification_settings->>'web_push_hook_secret', ''),
    COALESCE((notification_settings->>'enable_push')::boolean, true)
  INTO hook_secret, push_enabled
  FROM app_settings WHERE id = 1;

  IF NOT push_enabled OR hook_secret IS NULL OR hook_secret = '' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := fn_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', hook_secret
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'schema', 'public',
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'actor_id', NEW.actor_id,
        'type', NEW.type,
        'request_id', NEW.request_id,
        'title', NEW.title,
        'body', NEW.body,
        'data', NEW.data,
        'created_at', NEW.created_at
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- SECURITY DEFINER: insert matching in-app notifications without per-row push HTTP
CREATE OR REPLACE FUNCTION public.fanout_request_match_notifications(_request_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  req public.blood_requests%ROWTYPE;
  cfg JSONB;
  use_district BOOLEAN := true;
  use_blood BOOLEAN := true;
  inserted INT := 0;
BEGIN
  SELECT * INTO req FROM public.blood_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  IF req.status IS DISTINCT FROM 'open' THEN
    RETURN 0;
  END IF;

  SELECT notification_settings INTO cfg FROM public.app_settings WHERE id = 1;
  IF cfg IS NOT NULL THEN
    use_district := COALESCE((cfg->>'match_district_for_alerts')::BOOLEAN, true);
    use_blood := COALESCE((cfg->>'match_blood_group_for_alerts')::BOOLEAN, true);
  END IF;

  PERFORM set_config('app.skip_web_push', 'on', true);

  INSERT INTO public.notifications (user_id, actor_id, type, request_id, title, body, data, is_read)
  SELECT
    p.id,
    req.requester_id,
    'request_match'::public.notif_type,
    req.id,
    'new_request',
    req.patient_name || ' · ' || req.blood_group::TEXT,
    jsonb_build_object(
      'kind', 'new_request',
      'request_id', req.id,
      'blood_group', req.blood_group,
      'district_id', req.district_id
    ),
    false
  FROM public.profiles p
  LEFT JOIN public.user_settings us ON us.user_id = p.id
  WHERE p.id <> req.requester_id
    AND COALESCE(us.notif_new_request, true) = true
    AND (
      NOT use_district
      OR (req.district_id IS NOT NULL AND p.district_id = req.district_id)
    )
    AND (
      NOT use_blood
      OR (req.blood_group IS NOT NULL AND p.blood_group = req.blood_group)
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = p.id
        AND n.request_id = req.id
        AND n.type = 'request_match'
    );

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fanout_request_match_notifications(UUID) TO service_role;

-- Trigger: queue ONE async webhook; do not block insert on N notifications / N pushes
CREATE OR REPLACE FUNCTION public.notify_matching_donors_new_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hook_secret text;
  fn_url text := 'https://aunxredquwbokhpluzgj.supabase.co/functions/v1/send-push';
  push_enabled boolean := true;
BEGIN
  IF NEW.status IS DISTINCT FROM 'open' THEN
    RETURN NEW;
  END IF;

  SELECT
    COALESCE(notification_settings->>'web_push_hook_secret', ''),
    COALESCE((notification_settings->>'enable_push')::boolean, true)
  INTO hook_secret, push_enabled
  FROM public.app_settings WHERE id = 1;

  -- Always try to queue async fan-out when hook is configured
  IF hook_secret IS NOT NULL AND hook_secret <> '' THEN
    BEGIN
      PERFORM net.http_post(
        url := fn_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-webhook-secret', hook_secret
        ),
        body := jsonb_build_object(
          'type', 'fanout_request_alerts',
          'request_id', NEW.id,
          'enable_push', push_enabled
        )
      );
    EXCEPTION WHEN OTHERS THEN
      NULL; -- never fail the blood request insert
    END;
    RETURN NEW;
  END IF;

  -- Fallback (no webhook secret): sync in-app notifications only, still skip per-row push
  PERFORM public.fanout_request_match_notifications(NEW.id);
  RETURN NEW;
END;
$$;

-- One round-trip app booking: ensure session + issue serial
CREATE OR REPLACE FUNCTION public.care_book_app_serial(
  _schedule_id UUID,
  _date DATE,
  _guest_name TEXT DEFAULT NULL,
  _guest_phone TEXT DEFAULT NULL,
  _guest_age INT DEFAULT NULL,
  _guest_address TEXT DEFAULT NULL,
  _is_second_visit BOOLEAN DEFAULT false
)
RETURNS public.care_serials
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sid UUID;
BEGIN
  sid := public.care_ensure_session(_schedule_id, _date);
  RETURN public.care_issue_serial(
    sid,
    NULL,
    _guest_name,
    _guest_phone,
    'app',
    _guest_age,
    _guest_address,
    _is_second_visit
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_book_app_serial(UUID, DATE, TEXT, TEXT, INT, TEXT, BOOLEAN) TO authenticated;
