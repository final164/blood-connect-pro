/**
 * Email + password auth for regular users.
 * Phone + PIN (see phone-auth.ts / phone-session.ts) stays available for existing accounts.
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeAuthProviderError } from "@/lib/phone-auth";
import { checkUsernameAvailable, signupWithEmailPassword } from "@/lib/signup-server";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;

/** Synthetic domains used by the phone+PIN scheme — never real inboxes. */
const SYNTHETIC_DOMAINS = ["@bloodlink.app", "@supabase.co"];

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (v.length < 5 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v);
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function isValidUsername(value: string): boolean {
  return new RegExp(`^[a-z][a-z0-9_]{${USERNAME_MIN - 1},${USERNAME_MAX - 1}}$`).test(value);
}

export function isValidPassword(value: string): boolean {
  return value.length >= PASSWORD_MIN;
}

/**
 * True when the account was created by the phone+PIN flow, so settings should
 * offer "change PIN" instead of "change password".
 */
export function isPhoneAuthUser(email: string | null | undefined): boolean {
  const e = (email ?? "").toLowerCase();
  if (!e) return false;
  if (e.endsWith(".local")) return true;
  return SYNTHETIC_DOMAINS.some((d) => e.endsWith(d));
}

/** Slug a name or email into a username seed. Callers must still check availability. */
export function suggestUsername(seed: string): string {
  const base = normalizeUsername(seed.split("@")[0] ?? "").slice(0, USERNAME_MAX);
  const safe = /^[a-z]/.test(base) ? base : `u${base}`;
  return safe.length >= USERNAME_MIN
    ? safe.slice(0, USERNAME_MAX)
    : `${safe}${Math.random().toString(36).slice(2, 6)}`.slice(0, USERNAME_MAX);
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const u = normalizeUsername(username);
  if (!isValidUsername(u)) return false;
  const res = await checkUsernameAvailable({ data: { username: u } });
  return !!res.available;
}

/** Find a free username near `seed`, appending digits on collision. */
export async function resolveFreeUsername(seed: string): Promise<string> {
  const base = suggestUsername(seed);
  if (await isUsernameAvailable(base)) return base;
  for (let i = 0; i < 5; i++) {
    const suffix = String(Math.floor(Math.random() * 9000) + 1000);
    const candidate = `${base.slice(0, USERNAME_MAX - suffix.length)}${suffix}`;
    if (await isUsernameAvailable(candidate)) return candidate;
  }
  throw new Error("USERNAME_TAKEN");
}

export type EmailAuthResult = { ok: true; userId: string; session: import("@supabase/supabase-js").Session | null };

export async function loginWithEmailPassword(input: {
  email: string;
  password: string;
}): Promise<EmailAuthResult> {
  const email = normalizeEmail(input.email);
  if (!isValidEmail(email)) throw new Error("INVALID_EMAIL");
  if (!input.password) throw new Error("INVALID_CREDENTIALS");

  const signIn = supabase.auth.signInWithPassword({
    email,
    password: input.password,
  });
  const timed = await Promise.race([
    signIn,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("AUTH_TIMEOUT")), 12_000);
    }),
  ]);
  const { data, error } = timed;
  if (error) throw new Error(sanitizeAuthProviderError(error.message));
  if (!data.user) throw new Error("INVALID_CREDENTIALS");
  return { ok: true, userId: data.user.id, session: data.session };
}

export async function registerWithEmailPassword(input: {
  fullName: string;
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<EmailAuthResult> {
  const email = normalizeEmail(input.email);
  const username = normalizeUsername(input.username);
  const fullName = input.fullName.trim();

  if (!fullName) throw new Error("NAME_REQUIRED");
  if (!isValidUsername(username)) throw new Error("INVALID_USERNAME");
  if (!isValidEmail(email)) throw new Error("INVALID_EMAIL");
  if (!isValidPassword(input.password)) throw new Error("WEAK_PASSWORD");
  if (input.password !== input.confirmPassword) throw new Error("PASSWORDS_DO_NOT_MATCH");

  await signupWithEmailPassword({
    data: { fullName, username, email, password: input.password },
  });

  return loginWithEmailPassword({ email, password: input.password });
}

export async function sendPasswordResetEmail(email: string, redirectTo: string): Promise<void> {
  const e = normalizeEmail(email);
  if (!isValidEmail(e)) throw new Error("INVALID_EMAIL");
  const { error } = await supabase.auth.resetPasswordForEmail(e, { redirectTo });
  if (error) throw new Error(sanitizeAuthProviderError(error.message));
}

export async function updatePasswordAfterRecovery(input: {
  password: string;
  confirmPassword: string;
}): Promise<void> {
  if (!isValidPassword(input.password)) throw new Error("WEAK_PASSWORD");
  if (input.password !== input.confirmPassword) throw new Error("PASSWORDS_DO_NOT_MATCH");
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) throw new Error(sanitizeAuthProviderError(error.message));
}

export function emailAuthErrorMessage(raw: string, lang: "bn" | "en"): string {
  const code = sanitizeAuthProviderError(raw);
  switch (code) {
    case "INVALID_EMAIL":
      return lang === "bn" ? "সঠিক ইমেইল ঠিকানা দিন" : "Enter a valid email address";
    case "NAME_REQUIRED":
      return lang === "bn" ? "আপনার পূর্ণ নাম দিন" : "Enter your full name";
    case "INVALID_USERNAME":
      return lang === "bn"
        ? `ইউজারনেম ${USERNAME_MIN}-${USERNAME_MAX} অক্ষরের হবে — ছোট হাতের অক্ষর, সংখ্যা ও _ চলবে, শুরুতে অক্ষর`
        : `Username must be ${USERNAME_MIN}-${USERNAME_MAX} characters: lowercase letters, numbers and _, starting with a letter`;
    case "USERNAME_TAKEN":
      return lang === "bn"
        ? "এই ইউজারনেম নেওয়া হয়ে গেছে — অন্যটি চেষ্টা করুন"
        : "That username is taken — try another";
    case "WEAK_PASSWORD":
      return lang === "bn"
        ? `পাসওয়ার্ড কমপক্ষে ${PASSWORD_MIN} অক্ষরের হতে হবে`
        : `Password must be at least ${PASSWORD_MIN} characters`;
    case "PASSWORDS_DO_NOT_MATCH":
      return lang === "bn" ? "পাসওয়ার্ড মিলছে না" : "Passwords do not match";
    case "EMAIL_TAKEN":
      return lang === "bn"
        ? "এই ইমেইলে অ্যাকাউন্ট আছে — লগইন করুন বা পাসওয়ার্ড রিসেট করুন"
        : "An account with this email exists — log in or reset your password";
    case "INVALID_CREDENTIALS":
      return lang === "bn"
        ? "ইমেইল বা পাসওয়ার্ড ভুল — আবার চেষ্টা করুন"
        : "Wrong email or password — try again";
    case "AUTH_TIMEOUT":
      return lang === "bn"
        ? "Supabase Auth সাড়া দিচ্ছে না (টাইমআউট)। Dashboard → Project Settings → Restart project করে ২ মিনিট পর আবার চেষ্টা করুন।"
        : "Supabase Auth is not responding (timeout). Restart the project in Dashboard → Project Settings, wait ~2 min, then retry.";
    case "EMAIL_RATE_LIMIT":
      return lang === "bn"
        ? "অনেকবার চেষ্টা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন, অথবা Google দিয়ে ঢুকুন।"
        : "Too many attempts. Try again shortly, or continue with Google.";
    case "NO_SESSION":
      return lang === "bn"
        ? "লিংকটির মেয়াদ শেষ — আবার রিসেট ইমেইল পাঠান"
        : "This link has expired — request a new reset email";
    case "OAUTH_CANCELLED":
      return lang === "bn" ? "Google লগইন বাতিল হয়েছে" : "Google sign-in was cancelled";
    default:
      if (/rate.?limit/i.test(code)) return emailAuthErrorMessage("EMAIL_RATE_LIMIT", lang);
      return code;
  }
}
