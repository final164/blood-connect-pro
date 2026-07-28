/**
 * Public Supabase config (safe in the client bundle).
 * Publishable/anon key is designed to be public — never put the service_role secret here.
 * Override via VITE_SUPABASE_* / SUPABASE_* env when available (local .env or Lovable Cloud).
 */
export const PUBLIC_SUPABASE_URL = "https://aunxredquwbokhpluzgj.supabase.co";
export const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable_KJ0vUCz-iNCB8rqv3_Q_Eg_ZzZLmhtO";
export const PUBLIC_SUPABASE_PROJECT_ID = "aunxredquwbokhpluzgj";
/** Safe in client bundle — used for Web Push when app is closed */
export const PUBLIC_VAPID_PUBLIC_KEY =
  "BECAndT_0ZPOAwj9Ek6wyGYiB_8JaZmVgZsdvZGcl3cQEgpau-AdHczVS7og-NrXpq8V8SWLizdNcR82hg-PR-w";
