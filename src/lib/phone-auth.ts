/** Bangladesh mobile auth helpers (phone + 4-digit PIN → Supabase email/password). */

const PHONE_RE = /^01[3-9]\d{8}$/;
const PIN_RE = /^\d{4}$/;

/** Default admin credentials (phone + PIN auth). */
export const ADMIN_PHONE = "01700000000";
export const ADMIN_PIN = "1212";
export const ADMIN_LEGACY_EMAIL = "blood@gmail.com";

/**
 * Domains for synthetic auth emails (never shown to users).
 * Supabase rejects `.local` / example / test domains (`email_address_invalid`).
 * Prefer real-looking FQDNs; login still tries legacy `.local` for old accounts.
 */
const AUTH_EMAIL_DOMAINS = ["bloodlink.app", "supabase.co"] as const;
const LEGACY_AUTH_SUFFIX = "@phone.bloodlink.local";

export function normalizePhone(input: string): string {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length >= 13) digits = "0" + digits.slice(3);
  else if (digits.startsWith("88") && digits.length >= 12) digits = "0" + digits.slice(2);
  else if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
  return digits;
}

export function isValidPhone(input: string): boolean {
  return PHONE_RE.test(normalizePhone(input));
}

export function isValidPin(input: string): boolean {
  return PIN_RE.test(input);
}

/** Preferred synthetic email for new signups. */
export function phoneToAuthEmail(phone: string): string {
  return phoneAuthEmailCandidates(phone)[0]!;
}

/** Legacy format used before Supabase tightened email rules. */
export function phoneToAuthEmailLegacy(phone: string): string {
  return `${normalizePhone(phone)}${LEGACY_AUTH_SUFFIX}`;
}

/** All emails to try for a phone (newest first, then legacy). */
export function phoneAuthEmailCandidates(phone: string): string[] {
  const p = normalizePhone(phone);
  const list = AUTH_EMAIL_DOMAINS.map((d) => `bd${p}@${d}`);
  list.push(`${p}${LEGACY_AUTH_SUFFIX}`);
  return list;
}

/** Supabase requires ≥6 chars; users only enter a 4-digit PIN. */
export function pinToPassword(pin: string): string {
  return `bl${pin}xx`;
}

export function validatePhonePin(input: { phone: string; pin: string; confirmPin?: string }) {
  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone)) {
    throw new Error("Invalid phone — use 01XXXXXXXXX");
  }
  if (!isValidPin(input.pin)) {
    throw new Error("PIN must be exactly 4 digits");
  }
  if (input.confirmPin !== undefined && input.pin !== input.confirmPin) {
    throw new Error("PINs do not match");
  }
  return { phone, pin: input.pin };
}

export function adminAuthEmail() {
  return phoneToAuthEmail(ADMIN_PHONE);
}

/** True for default admin phone account (any synthetic email) or legacy email admin. */
export function isAdminIdentity(email?: string | null) {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (e === ADMIN_LEGACY_EMAIL) return true;
  return phoneAuthEmailCandidates(ADMIN_PHONE).some((x) => x.toLowerCase() === e);
}

/** Map raw Supabase / GoTrue messages away from "email" wording for phone UX. */
export function sanitizeAuthProviderError(message: string): string {
  const m = message.toLowerCase();
  if (
    m.includes("email_address_invalid") ||
    (m.includes("email address") && m.includes("invalid")) ||
    m.includes("unable to validate email") ||
    m.includes("invalid email")
  ) {
    return "AUTH_EMAIL_BACKEND";
  }
  if (m.includes("password") && (m.includes("weak") || m.includes("least") || m.includes("short"))) {
    return "AUTH_PASSWORD_BACKEND";
  }
  if (
    m.includes("invalid login") ||
    m.includes("invalid credentials") ||
    m.includes("wrong password") ||
    m.includes("invalid_credentials")
  ) {
    return "INVALID_CREDENTIALS";
  }
  return message;
}
