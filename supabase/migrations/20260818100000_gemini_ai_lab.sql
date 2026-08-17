-- Gemini API key rotation + AI lab-test helper RPC

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS gemini_settings JSONB NOT NULL DEFAULT '{
    "enabled": true,
    "primary_model": "gemini-3.6-flash",
    "fallback_model": "gemini-3.5-flash",
    "match_model": "gemini-3.5-flash-lite"
  }'::jsonb;

CREATE TABLE IF NOT EXISTS public.gemini_model_catalog (
  slug TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.gemini_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_used_at TIMESTAMPTZ,
  error_count INT NOT NULL DEFAULT 0,
  last_error TEXT,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT gemini_api_keys_status_check CHECK (status IN ('active', 'quota', 'error', 'disabled'))
);

INSERT INTO public.gemini_model_catalog (slug, label, is_active, sort_order) VALUES
  ('gemini-flash-latest', 'Gemini Flash (latest alias)', true, 5),
  ('gemini-flash-lite-latest', 'Gemini Flash-Lite (latest alias)', true, 6),
  ('gemini-pro-latest', 'Gemini Pro (latest alias)', true, 7),
  ('gemini-3.7-flash', 'Gemini 3.7 Flash', true, 8),
  ('gemini-3.6-flash', 'Gemini 3.6 Flash (recommended)', true, 10),
  ('gemini-3.5-flash', 'Gemini 3.5 Flash', true, 20),
  ('gemini-3.5-flash-lite', 'Gemini 3.5 Flash-Lite', true, 30),
  ('gemini-3-flash-preview', 'Gemini 3 Flash Preview', true, 40),
  ('gemini-3.1-flash-lite', 'Gemini 3.1 Flash-Lite', true, 50),
  ('gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview', true, 60),
  ('gemini-3-pro-preview', 'Gemini 3 Pro Preview', true, 70),
  ('gemini-2.5-flash', 'Gemini 2.5 Flash', true, 80),
  ('gemini-2.5-flash-lite', 'Gemini 2.5 Flash-Lite', true, 90),
  ('gemini-2.5-pro', 'Gemini 2.5 Pro', true, 100),
  ('gemini-2.5-flash-image', 'Gemini 2.5 Flash Image', true, 110),
  ('gemini-2.0-flash', 'Gemini 2.0 Flash (legacy)', true, 120),
  ('gemini-2.0-flash-001', 'Gemini 2.0 Flash 001 (legacy)', true, 130),
  ('gemini-2.0-flash-lite', 'Gemini 2.0 Flash-Lite (legacy)', true, 140),
  ('gemini-2.0-flash-lite-001', 'Gemini 2.0 Flash-Lite 001 (legacy)', true, 150),
  ('gemini-1.5-flash', 'Gemini 1.5 Flash (legacy)', true, 160),
  ('gemini-1.5-flash-8b', 'Gemini 1.5 Flash 8B (legacy)', true, 170),
  ('gemini-1.5-pro', 'Gemini 1.5 Pro (legacy)', true, 180)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  sort_order = EXCLUDED.sort_order;

INSERT INTO public.care_hub_modules (slug, label_bn, label_en, icon, href, audience, sort_order)
VALUES ('ai_tests', 'AI টেস্ট সাজেশন', 'AI test advisor', 'Sparkles', '/care/ai-tests', 'patient', 15)
ON CONFLICT (slug) DO UPDATE SET
  label_bn = EXCLUDED.label_bn,
  label_en = EXCLUDED.label_en,
  icon = EXCLUDED.icon,
  href = EXCLUDED.href,
  audience = EXCLUDED.audience,
  sort_order = EXCLUDED.sort_order;

ALTER TABLE public.gemini_model_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gemini_api_keys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gemini_models_read ON public.gemini_model_catalog;
CREATE POLICY gemini_models_read ON public.gemini_model_catalog
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS gemini_models_admin ON public.gemini_model_catalog;
CREATE POLICY gemini_models_admin ON public.gemini_model_catalog
  FOR ALL TO authenticated
  USING (public.is_admin_staff(auth.uid()))
  WITH CHECK (public.is_admin_staff(auth.uid()));

-- Keys: no client SELECT of raw api_key. Service role only.
REVOKE ALL ON public.gemini_api_keys FROM anon, authenticated;
GRANT ALL ON public.gemini_api_keys TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gemini_model_catalog TO authenticated;
GRANT ALL ON public.gemini_model_catalog TO service_role;

-- Patient: ensure a day exists then caller uses care_reserve_lab
CREATE OR REPLACE FUNCTION public.care_ensure_patient_lab_day(
  _offering_id UUID,
  _date DATE DEFAULT (timezone('Asia/Dhaka', now()))::DATE
)
RETURNS public.care_lab_calendars
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  off public.care_test_offerings%ROWTYPE;
  org public.care_orgs%ROWTYPE;
  cal public.care_lab_calendars%ROWTYPE;
  cap INT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in required'; END IF;

  SELECT * INTO off FROM public.care_test_offerings WHERE id = _offering_id AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Offering not found'; END IF;

  SELECT * INTO org FROM public.care_orgs WHERE id = off.org_id;
  IF NOT FOUND OR org.is_active IS NOT TRUE OR org.is_listed IS NOT TRUE OR org.is_verified IS NOT TRUE THEN
    RAISE EXCEPTION 'Lab not available';
  END IF;

  SELECT * INTO cal
  FROM public.care_lab_calendars
  WHERE offering_id = off.id AND cal_date = _date AND is_open
  ORDER BY reserved_count ASC
  LIMIT 1;

  IF FOUND AND cal.reserved_count < cal.capacity THEN
    RETURN cal;
  END IF;

  cap := COALESCE(off.default_capacity, 40);
  INSERT INTO public.care_lab_calendars (offering_id, location_id, cal_date, slot_key, capacity, reserved_count, is_open)
  VALUES (off.id, off.location_id, _date, '00:00', cap, 0, true)
  ON CONFLICT (offering_id, cal_date, slot_key)
  DO UPDATE SET is_open = true
  RETURNING * INTO cal;

  RETURN cal;
END;
$$;

GRANT EXECUTE ON FUNCTION public.care_ensure_patient_lab_day(UUID, DATE) TO authenticated;
