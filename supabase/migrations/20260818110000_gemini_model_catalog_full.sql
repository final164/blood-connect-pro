-- Full Gemini model catalog (idempotent). Does not overwrite is_active if already set.

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
