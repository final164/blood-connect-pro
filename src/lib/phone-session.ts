import { supabase } from "@/integrations/supabase/client";
import {
  normalizePhone,
  phoneAuthEmailCandidates,
  phoneToAuthEmail,
  pinToPassword,
  sanitizeAuthProviderError,
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

function isEmailRejected(message: string) {
  const m = message.toLowerCase();
  return (
    m.includes("email_address_invalid") ||
    (m.includes("email") && m.includes("invalid")) ||
    m.includes("unable to validate email")
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

/** Try every synthetic email for this phone until one signs in. */
async function signInWithPhonePassword(phone: string, password: string) {
  let lastError: Error | null = null;
  for (const email of phoneAuthEmailCandidates(phone)) {
    const { data, error } = await signIn(email, password);
    if (!error && data.user) return { data, email };
    if (error) lastError = new Error(sanitizeAuthProviderError(error.message));
  }
  throw lastError ?? new Error("INVALID_CREDENTIALS");
}

/**
 * Login with BD phone + 4-digit PIN (maps to synthetic email/password).
 */
export async function loginWithPhonePin(input: { phone: string; pin: string }): Promise<PhoneAuthResult> {
  const { phone, pin } = validatePhonePin(input);
  const password = pinToPassword(pin);
  try {
    const { data } = await signInWithPhonePassword(phone, password);
    await syncProfile(data.user!.id, phone);
    return { ok: true, exists: true, userId: data.user!.id };
  } catch (err) {
    const code = sanitizeAuthProviderError((err as Error).message);
    throw new Error(code === "AUTH_EMAIL_BACKEND" ? "INVALID_CREDENTIALS" : code);
  }
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
      // Email-backend errors from admin API → try client with alternate domains
      if (!isEmailRejected(msg) && !isAlreadyRegistered(msg)) {
        /* continue to sign-in / client signup */
      }
    }
  }

  // Try sign-in first (covers: just created via admin, or account already existed).
  try {
    const { data } = await signInWithPhonePassword(phone, password);
    await syncProfile(data.user!.id, phone, fullName);
    return { ok: true, exists: createdExists || usedServer, userId: data.user!.id };
  } catch {
    /* continue to client signup */
  }

  // Client signUp fallback — try each non-legacy domain until Supabase accepts the email.
  const candidates = phoneAuthEmailCandidates(phone).filter((e) => !e.endsWith(".local"));
  let lastSignUpMessage = "";

  for (const email of candidates) {
    const { data: signed, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        // Avoid confirmation-email flow for phone-PIN accounts
        emailRedirectTo: undefined,
      },
    });

    if (signUpError) {
      lastSignUpMessage = signUpError.message;
      if (isAlreadyRegistered(signUpError.message)) {
        try {
          const { data } = await signInWithPhonePassword(phone, password);
          await syncProfile(data.user!.id, phone, fullName);
          return { ok: true, exists: true, userId: data.user!.id };
        } catch {
          throw new Error("ACCOUNT_EXISTS_WRONG_PIN");
        }
      }
      if (isEmailRejected(signUpError.message)) {
        continue; // try next domain
      }
      throw new Error(sanitizeAuthProviderError(signUpError.message));
    }

    if (signed.session?.user) {
      await syncProfile(signed.session.user.id, phone, fullName);
      return { ok: true, exists: false, userId: signed.session.user.id };
    }

    // User row may exist without session when "Confirm email" is enabled.
    try {
      const { data } = await signInWithPhonePassword(phone, password);
      await syncProfile(data.user!.id, phone, fullName);
      return { ok: true, exists: false, userId: data.user!.id };
    } catch {
      // If this domain created an unconfirmed user, tell user how to fix
      throw new Error("EMAIL_CONFIRM_REQUIRED");
    }
  }

  throw new Error(sanitizeAuthProviderError(lastSignUpMessage) || "AUTH_EMAIL_BACKEND");
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
  const mapped = sanitizeAuthProviderError(code);
  switch (mapped) {
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
        ? "সাইনআপ আটকেছে: Supabase Auth → Providers → Email-এ Confirm email বন্ধ করুন"
        : "Signup blocked: disable Confirm email in Supabase Auth → Providers → Email";
    case "AUTH_EMAIL_BACKEND":
      return lang === "bn"
        ? "অ্যাকাউন্ট তৈরি করা যায়নি — একটু পর আবার চেষ্টা করুন। সমস্যা থাকলে অ্যাডমিনকে জানান।"
        : "Could not create account — try again shortly, or contact support.";
    case "AUTH_PASSWORD_BACKEND":
      return lang === "bn"
        ? "PIN সেট করা যায়নি — অন্য ৪ সংখ্যার PIN দিয়ে চেষ্টা করুন"
        : "Could not set PIN — try a different 4-digit PIN";
    case "Invalid phone — use 01XXXXXXXXX":
      return lang === "bn"
        ? "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)"
        : "Enter a valid mobile number (01XXXXXXXXX)";
    case "PIN must be exactly 4 digits":
      return lang === "bn" ? "PIN অবশ্যই ৪ সংখ্যার হতে হবে" : "PIN must be exactly 4 digits";
    case "PINs do not match":
      return lang === "bn" ? "PIN মিলছে না" : "PINs do not match";
    default:
      // Never surface raw "email … invalid" to phone-PIN users
      if (/email/i.test(mapped) && /invalid/i.test(mapped)) {
        return authErrorMessage("AUTH_EMAIL_BACKEND", lang);
      }
      return mapped;
  }
}

// re-export for callers that only imported from phone-session before
export { phoneToAuthEmail, normalizePhone };
