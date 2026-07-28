/** Bangladesh mobile auth helpers (phone + 4-digit PIN → Supabase email/password). */

const PHONE_RE = /^01[3-9]\d{8}$/;
const PIN_RE = /^\d{4}$/;

/** Default admin credentials (phone + PIN auth). */
export const ADMIN_PHONE = "01700000000";
export const ADMIN_PIN = "1212";
export const ADMIN_LEGACY_EMAIL = "blood@gmail.com";

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

/** Internal Supabase auth email — not shown to users. */
export function phoneToAuthEmail(phone: string): string {
  return `${normalizePhone(phone)}@phone.bloodlink.local`;
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

/** True for default admin phone account or legacy email admin. */
export function isAdminIdentity(email?: string | null) {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  return e === ADMIN_LEGACY_EMAIL || e === adminAuthEmail();
}
