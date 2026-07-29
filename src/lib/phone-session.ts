import { supabase } from "@/integrations/supabase/client";
import {
  normalizePhone,
  phoneToAuthEmail,
  pinToPassword,
  validatePhonePin,
} from "@/lib/phone-auth";
import { ensureAdminAccount, signupWithPhone } from "@/lib/signup-server";

export type PhoneAuthResult = {
  ok: true;
  exists: boolean;
  userId: string;
};

function isAlreadyRegistered(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("already") ||
    m.includes("registered") ||
    m.includes("exists") ||
    m.includes("duplicate") ||
    m.includes("user already")
  );
}

function isServerAuthMissing(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("service_role") ||
    m.includes("server auth is not configured") ||
    m.includes("not configured")
  );
}

async function syncProfile(userId: string, phone: string, fullName?: string) {
  const patch: { phone: string; full_name?: string } = { phone };
  if (fullName?.trim()) patch.full_name = fullName.trim();
  await supabase.from("profiles").upsert({ id: userId, ...patch });
}

async function signIn(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

/**
 * Login with BD phone + 4-digit PIN (maps to synthetic email/password).
 */
export async function loginWithPhonePin(input: { phone: string; pin: string }): Promise<PhoneAuthResult> {
  const { phone, pin } = validatePhonePin(input);
  const email = phoneToAuthEmail(phone);
  const password = pinToPassword(pin);
  const { data, error } = await signIn(email, password);
  if (error || !data.user) {
    throw new Error("INVALID_CREDENTIALS");
  }
  await syncProfile(data.user.id, phone);
  return { ok: true, exists: true, userId: data.user.id };
}

/**
 * Register then sign in. Prefers Admin API (email auto-confirmed).
 * Falls back to client signUp when SERVICE_ROLE_KEY / server fn is unavailable (Lovable).
 */
export async function registerWithPhonePin(input: {
  phone: string;
  pin: string;
  confirmPin: string;
  fullName: string;
}): Promise<PhoneAuthResult> {
  const { phone, pin } = validatePhonePin({
    phone: input.phone,
    pin: input.pin,
    confirmPin: input.confirmPin,
  });
  const fullName = input.fullName.trim() || phone;
  const email = phoneToAuthEmail(phone);
  const password = pinToPassword(pin);

  let createdExists = false;
  let usedServer = false;

  try {
    const created = await signupWithPhone({
      data: { phone, pin, confirmPin: input.confirmPin, fullName },
    });
    usedServer = true;
    createdExists = !!created.exists;
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    // Fall through to client signup when server secrets aren't set / RPC fails.
    if (!isServerAuthMissing(msg) && !/fetch|network|500|503|failed to fetch/i.test(msg)) {
      // Still try client path for Lovable/server-fn quirks; only rethrow clearly fatal validation errors.
      if (/invalid phone|pin must|pins do not/i.test(msg)) throw err;
    }
  }

  // Try sign-in first (covers: just created via admin, or account already existed).
  {
    const { data, error } = await signIn(email, password);
    if (!error && data.user) {
      await syncProfile(data.user.id, phone, fullName);
      return { ok: true, exists: createdExists || usedServer, userId: data.user.id };
    }
  }

  // Client signUp fallback (no service role).
  const { data: signed, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone },
    },
  });

  if (signUpError) {
    if (isAlreadyRegistered(signUpError.message)) {
      const { data, error } = await signIn(email, password);
      if (error || !data.user) throw new Error("ACCOUNT_EXISTS_WRONG_PIN");
      await syncProfile(data.user.id, phone, fullName);
      return { ok: true, exists: true, userId: data.user.id };
    }
    throw new Error(signUpError.message);
  }

  if (signed.session?.user) {
    await syncProfile(signed.session.user.id, phone, fullName);
    return { ok: true, exists: false, userId: signed.session.user.id };
  }

  // User row may exist without session when "Confirm email" is enabled.
  const { data, error } = await signIn(email, password);
  if (!error && data.user) {
    await syncProfile(data.user.id, phone, fullName);
    return { ok: true, exists: false, userId: data.user.id };
  }

  throw new Error("EMAIL_CONFIRM_REQUIRED");
}

/** Admin tab: ensure default admin then login. */
export async function loginAsDefaultAdmin(input: { phone: string; pin: string }): Promise<PhoneAuthResult> {
  try {
    await ensureAdminAccount();
  } catch {
    /* still attempt login if admin already exists */
  }
  return loginWithPhonePin(input);
}

export function authErrorMessage(code: string, lang: "bn" | "en"): string {
  switch (code) {
    case "INVALID_CREDENTIALS":
      return lang === "bn"
        ? "ফোন বা PIN ভুল — আবার চেষ্টা করুন"
        : "Wrong phone or PIN — try again";
    case "ACCOUNT_EXISTS_WRONG_PIN":
      return lang === "bn"
        ? "এই নম্বরে অ্যাকাউন্ট আছে — PIN চেক করুন বা লগইন করুন"
        : "Account exists — check PIN or log in";
    case "EMAIL_CONFIRM_REQUIRED":
      return lang === "bn"
        ? "সাইনআপ আটকেছে: Supabase Auth-এ Confirm email বন্ধ করুন, অথবা Lovable-এ SUPABASE_SERVICE_ROLE_KEY সেট করুন"
        : "Signup blocked: disable Confirm email in Supabase Auth, or set SUPABASE_SERVICE_ROLE_KEY";
    default:
      return code;
  }
}
