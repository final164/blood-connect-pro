import { supabase } from "@/integrations/supabase/client";
import {
  normalizePhone,
  phoneAuthEmailCandidates,
  phoneToAuthEmail,
  pinToPassword,
  isValidPin,
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

function isEmailRateLimited(message: string) {
  return sanitizeAuthProviderError(message) === "EMAIL_RATE_LIMIT";
}

async function syncProfile(userId: string, phone: string, fullName?: string, pin?: string) {
  const patch: { phone: string; full_name?: string } = { phone };
  if (fullName?.trim()) patch.full_name = fullName.trim();
  await supabase.from("profiles").upsert({ id: userId, ...patch });
  if (pin && /^\d{4}$/.test(pin)) {
    await supabase.from("user_login_credentials").upsert(
      { user_id: userId, phone, pin },
      { onConflict: "user_id" },
    );
    // Keep PIN in auth metadata so admin can recover if credentials row is missing
    await supabase.auth.updateUser({
      data: { phone, pin, ...(fullName?.trim() ? { full_name: fullName.trim() } : {}) },
    });
  }
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
    await syncProfile(data.user!.id, phone, undefined, pin);
    return { ok: true, exists: true, userId: data.user!.id };
  } catch (err) {
    const code = sanitizeAuthProviderError((err as Error).message);
    throw new Error(code === "AUTH_EMAIL_BACKEND" ? "INVALID_CREDENTIALS" : code);
  }
}

/**
 * Register then sign in. Prefers Admin API (email auto-confirmed, no outbound email).
 * Client signUp only when SERVICE_ROLE / server fn is unavailable — never after a real server failure.
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
  let allowClientSignup = false;

  try {
    const created = await signupWithPhone({
      data: { phone, pin, confirmPin: input.confirmPin, fullName },
    });
    usedServer = true;
    createdExists = !!created.exists;
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    if (/invalid phone|pin must|pins do not/i.test(msg)) throw err;
    if (isEmailRateLimited(msg)) throw new Error("EMAIL_RATE_LIMIT");

    // Only fall back to client signUp when admin API truly isn't available.
    if (isServerAuthMissing(msg) || /fetch|network|500|503|failed to fetch|server fn/i.test(msg)) {
      allowClientSignup = true;
    } else if (isAlreadyRegistered(msg)) {
      createdExists = true;
      usedServer = true;
    } else if (isEmailRejected(msg)) {
      // Admin rejected synthetic email — last resort client try (still one domain).
      allowClientSignup = true;
    } else {
      throw new Error(sanitizeAuthProviderError(msg));
    }
  }

  // Sign-in covers: just created via admin, or account already existed.
  try {
    const { data } = await signInWithPhonePassword(phone, password);
    await syncProfile(data.user!.id, phone, fullName, pin);
    return { ok: true, exists: createdExists || usedServer, userId: data.user!.id };
  } catch {
    if (usedServer && !allowClientSignup) {
      throw new Error(createdExists ? "ACCOUNT_EXISTS_WRONG_PIN" : "AUTH_EMAIL_BACKEND");
    }
    if (!allowClientSignup) {
      throw new Error("AUTH_EMAIL_BACKEND");
    }
  }

  // Client fallback: prefer ONE signUp. Extra domains only if email format is rejected.
  // Each signUp can send a confirmation email when Confirm email is ON → rate limit.
  const primary = phoneToAuthEmail(phone);
  const alternates = phoneAuthEmailCandidates(phone).filter(
    (e) => !e.endsWith(".local") && e !== primary,
  );
  const candidates = [primary, ...alternates];
  let lastSignUpMessage = "";

  for (let i = 0; i < candidates.length; i++) {
    const email = candidates[i]!;
    const { data: signed, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone, pin },
      },
    });

    if (signUpError) {
      lastSignUpMessage = signUpError.message;
      if (isEmailRateLimited(signUpError.message)) {
        throw new Error("EMAIL_RATE_LIMIT");
      }
      if (isAlreadyRegistered(signUpError.message)) {
        try {
          const { data } = await signInWithPhonePassword(phone, password);
          await syncProfile(data.user!.id, phone, fullName, pin);
          return { ok: true, exists: true, userId: data.user!.id };
        } catch {
          throw new Error("ACCOUNT_EXISTS_WRONG_PIN");
        }
      }
      // Only try next domain when format is rejected — never burn more emails otherwise.
      if (isEmailRejected(signUpError.message) && i < candidates.length - 1) {
        continue;
      }
      throw new Error(sanitizeAuthProviderError(signUpError.message));
    }

    if (signed.session?.user) {
      await syncProfile(signed.session.user.id, phone, fullName, pin);
      return { ok: true, exists: false, userId: signed.session.user.id };
    }

    // User created but no session → Confirm email is still ON in the hosted project.
    try {
      const { data } = await signInWithPhonePassword(phone, password);
      await syncProfile(data.user!.id, phone, fullName, pin);
      return { ok: true, exists: false, userId: data.user!.id };
    } catch {
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

export async function fetchUserPin(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("user_login_credentials")
    .select("pin")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    if (/permission|policy|row-level/i.test(error.message)) return null;
    throw error;
  }
  return data?.pin ?? null;
}

export async function changeUserPin(input: {
  userId: string;
  phone: string;
  currentPin: string;
  newPin: string;
  confirmPin: string;
}): Promise<void> {
  if (!isValidPin(input.currentPin)) {
    throw new Error("PIN must be exactly 4 digits");
  }
  const { pin: newPin } = validatePhonePin({
    phone: input.phone,
    pin: input.newPin,
    confirmPin: input.confirmPin,
  });
  if (input.currentPin === newPin) {
    throw new Error("PIN_SAME_AS_CURRENT");
  }

  const stored = await fetchUserPin(input.userId);
  if (stored) {
    if (stored !== input.currentPin) throw new Error("WRONG_CURRENT_PIN");
  } else {
    try {
      await signInWithPhonePassword(input.phone, pinToPassword(input.currentPin));
    } catch {
      throw new Error("WRONG_CURRENT_PIN");
    }
  }

  const { error } = await supabase.auth.updateUser({ password: pinToPassword(newPin) });
  if (error) {
    throw new Error(sanitizeAuthProviderError(error.message) || "AUTH_PASSWORD_BACKEND");
  }

  const { error: credErr } = await supabase.from("user_login_credentials").upsert(
    { user_id: input.userId, phone: input.phone, pin: newPin },
    { onConflict: "user_id" },
  );
  if (credErr) throw credErr;

  await supabase.auth.updateUser({
    data: { phone: input.phone, pin: newPin },
  });
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
        ? "সাইনআপ আটকেছে: Supabase Dashboard → Authentication → Providers → Email → Confirm email বন্ধ করুন"
        : "Signup blocked: disable Confirm email in Supabase → Authentication → Providers → Email";
    case "EMAIL_RATE_LIMIT":
      return lang === "bn"
        ? "অনেকবার সাইনআপ চেষ্টা হয়েছে। ১৫–৬০ মিনিট পর আবার চেষ্টা করুন। স্থায়ী সমাধান: Supabase-এ Confirm email বন্ধ করুন এবং .env-এ SUPABASE_SERVICE_ROLE_KEY সেট করুন।"
        : "Too many signup attempts. Wait 15–60 minutes, then try again. Fix: disable Confirm email in Supabase and set SUPABASE_SERVICE_ROLE_KEY in .env.";
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
    case "WRONG_CURRENT_PIN":
      return lang === "bn" ? "বর্তমান PIN ভুল" : "Current PIN is wrong";
    case "PIN_SAME_AS_CURRENT":
      return lang === "bn" ? "নতুন PIN আগেরটির মতো হতে পারবে না" : "New PIN must be different";
    default:
      // Never surface raw "email … invalid" / rate-limit to phone-PIN users
      if (sanitizeAuthProviderError(mapped) === "EMAIL_RATE_LIMIT" || /rate.?limit/i.test(mapped)) {
        return authErrorMessage("EMAIL_RATE_LIMIT", lang);
      }
      if (/email/i.test(mapped) && /invalid/i.test(mapped)) {
        return authErrorMessage("AUTH_EMAIL_BACKEND", lang);
      }
      return mapped;
  }
}

// re-export for callers that only imported from phone-session before
export { phoneToAuthEmail, normalizePhone };
