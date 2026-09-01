/** Synthetic / internal auth emails — never show as the user's real inbox. */
const SYNTHETIC_EMAIL_SUFFIXES = ["@bloodlink.app", "@muktosheba.app", "@supabase.co"] as const;

export function isSyntheticAuthEmail(email: string | null | undefined): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  if (e.endsWith(".local")) return true;
  return SYNTHETIC_EMAIL_SUFFIXES.some((suffix) => e.endsWith(suffix));
}

/** Gmail / real inbox suitable for admin display and profile sync. */
export function realAuthEmail(email: string | null | undefined): string | null {
  const e = (email ?? "").trim().toLowerCase();
  if (!e || isSyntheticAuthEmail(e)) return null;
  return e;
}

/** Strip Supabase keys / apikey query params from user-visible OAuth errors. */
export function sanitizeOAuthUserMessage(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/apikey=[^&\s]+/gi, "apikey=[hidden]")
    .replace(/sb_publishable_[A-Za-z0-9_-]+/gi, "[hidden]")
    .replace(/sb_secret_[A-Za-z0-9_-]+/gi, "[hidden]")
    .replace(/[a-z0-9]{20}\.supabase\.co/gi, "auth server");
}
