import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL } from "@/integrations/supabase/public-env";
import {
  ADMIN_PHONE,
  ADMIN_PIN,
  phoneAuthEmailCandidates,
  phoneToAuthEmail,
  pinToPassword,
  validatePhonePin,
} from "@/lib/phone-auth";

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error(
      "Server auth is not configured — set SUPABASE_SERVICE_ROLE_KEY in .env / Lovable secrets",
    );
  }
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "User-Agent": "Muktosheba-Signup/1.0" } },
  });
}

type SignupInput = {
  phone: string;
  pin: string;
  fullName: string;
  confirmPin?: string;
};

/**
 * Creates an account via Auth Admin API with email_confirm: true.
 * Uses synthetic email from phone — no confirmation email sent.
 */
export const signupWithPhone = createServerFn({ method: "POST" })
  .validator((data: SignupInput) => {
    const fullName = String(data?.fullName ?? "").trim();
    const { phone, pin } = validatePhonePin({
      phone: String(data?.phone ?? ""),
      pin: String(data?.pin ?? ""),
      confirmPin: data?.confirmPin !== undefined ? String(data.confirmPin) : undefined,
    });
    return { phone, pin, fullName: fullName || phone };
  })
  .handler(async ({ data }) => {
    const admin = adminClient();
    const password = pinToPassword(data.pin);
    // Prefer primary synthetic email; only try alternate if format is rejected.
    const primary = phoneToAuthEmail(data.phone);
    const emails = [
      primary,
      ...phoneAuthEmailCandidates(data.phone).filter((e) => !e.endsWith(".local") && e !== primary),
    ];

    let lastError: Error | null = null;
    let createdUserId: string | null = null;

    for (const email of emails) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: data.fullName, phone: data.phone },
      });

      if (error) {
        const msg = error.message.toLowerCase();
        if (
          msg.includes("already") ||
          msg.includes("registered") ||
          msg.includes("exists") ||
          msg.includes("duplicate")
        ) {
          return { ok: true as const, exists: true as const };
        }
        // Try next domain if this email format is rejected
        if (msg.includes("email") && msg.includes("invalid")) {
          lastError = new Error(error.message);
          continue;
        }
        throw new Error(error.message);
      }

      createdUserId = created.user?.id ?? null;
      break;
    }

    if (!createdUserId && lastError) throw lastError;
    if (!createdUserId) throw new Error("Could not create user");

    await admin.from("profiles").upsert({
      id: createdUserId,
      full_name: data.fullName,
      phone: data.phone,
    });
    await admin.from("user_login_credentials").upsert(
      { user_id: createdUserId, phone: data.phone, pin: data.pin },
      { onConflict: "user_id" },
    );
    await admin.auth.admin.updateUserById(createdUserId, {
      user_metadata: { full_name: data.fullName, phone: data.phone, pin: data.pin },
    });

    return { ok: true as const, exists: false as const };
  });

type EmailSignupInput = {
  fullName: string;
  username: string;
  email: string;
  password: string;
};

const USERNAME_RE = /^[a-z][a-z0-9_]{2,19}$/;

/**
 * Username lookup runs server-side because the profiles SELECT policy is
 * `TO authenticated` — an anonymous visitor on the signup form cannot read it.
 */
export const checkUsernameAvailable = createServerFn({ method: "POST" })
  .validator((data: { username: string }) => ({
    username: String(data?.username ?? "").trim().toLowerCase(),
  }))
  .handler(async ({ data }) => {
    if (!USERNAME_RE.test(data.username)) return { available: false as const };
    const admin = adminClient();
    const { data: row } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    return { available: !row };
  });

/**
 * Creates an email/password account via Auth Admin API with email_confirm: true,
 * so no confirmation email is sent (Supabase email confirmations are disabled).
 */
export const signupWithEmailPassword = createServerFn({ method: "POST" })
  .validator((data: EmailSignupInput) => {
    const fullName = String(data?.fullName ?? "").trim();
    const username = String(data?.username ?? "").trim().toLowerCase();
    const email = String(data?.email ?? "").trim().toLowerCase();
    const password = String(data?.password ?? "");
    if (!fullName) throw new Error("NAME_REQUIRED");
    if (!USERNAME_RE.test(username)) throw new Error("INVALID_USERNAME");
    if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) throw new Error("INVALID_EMAIL");
    if (password.length < 8) throw new Error("WEAK_PASSWORD");
    return { fullName, username, email, password };
  })
  .handler(async ({ data }) => {
    const admin = adminClient();

    const { data: taken } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", data.username)
      .maybeSingle();
    if (taken) throw new Error("USERNAME_TAKEN");

    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName, username: data.username },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("already") ||
        msg.includes("registered") ||
        msg.includes("exists") ||
        msg.includes("duplicate")
      ) {
        throw new Error("EMAIL_TAKEN");
      }
      throw new Error(error.message);
    }

    const userId = created.user?.id;
    if (!userId) throw new Error("Could not create user");

    const { error: profileErr } = await admin.from("profiles").upsert({
      id: userId,
      full_name: data.fullName,
      username: data.username,
    });
    if (profileErr) {
      // Username lost a race between the check above and the insert — undo the
      // half-made account so the user can retry instead of being locked out.
      if (/username/i.test(profileErr.message)) {
        await admin.auth.admin.deleteUser(userId);
        throw new Error("USERNAME_TAKEN");
      }
      throw new Error(profileErr.message);
    }

    return { ok: true as const, userId };
  });

/**
 * Ensures the default admin phone account exists, PIN is set, and admin role is granted.
 */
export const ensureAdminAccount = createServerFn({ method: "POST" }).handler(async () => {
  const admin = adminClient();
  const emails = phoneAuthEmailCandidates(ADMIN_PHONE);
  const password = pinToPassword(ADMIN_PIN);
  const preferredEmail = phoneToAuthEmail(ADMIN_PHONE);

  let userId: string | null = null;

  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = listed?.users?.find((u) =>
    emails.some((e) => u.email?.toLowerCase() === e.toLowerCase()),
  );
  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, {
      email: preferredEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Muktosheba Admin", phone: ADMIN_PHONE, pin: ADMIN_PIN },
    });
  } else {
    let lastError: Error | null = null;
    for (const email of emails.filter((e) => !e.endsWith(".local"))) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: "Muktosheba Admin", phone: ADMIN_PHONE, pin: ADMIN_PIN },
      });
      if (error) {
        if (error.message.toLowerCase().includes("email") && error.message.toLowerCase().includes("invalid")) {
          lastError = new Error(error.message);
          continue;
        }
        throw new Error(error.message);
      }
      userId = created.user?.id ?? null;
      break;
    }
    if (!userId && lastError) throw lastError;
  }

  if (!userId) throw new Error("Could not resolve admin user");

  await admin.from("profiles").upsert({
    id: userId,
    full_name: "Muktosheba Admin",
    phone: ADMIN_PHONE,
  });
  await admin.from("user_login_credentials").upsert(
    { user_id: userId, phone: ADMIN_PHONE, pin: ADMIN_PIN },
    { onConflict: "user_id" },
  );

  await admin.from("user_roles").delete().eq("user_id", userId).in("role", ["user", "moderator"]);
  const { error: roleErr } = await admin.from("user_roles").upsert(
    { user_id: userId, role: "admin" },
    { onConflict: "user_id,role" },
  );
  if (roleErr) {
    const msg = roleErr.message.toLowerCase();
    if (!msg.includes("duplicate") && !msg.includes("unique")) throw new Error(roleErr.message);
  }

  // Ensure Super Admin staff role (ACL)
  const { data: saRole } = await admin
    .from("admin_roles")
    .select("id")
    .eq("slug", "super-admin")
    .maybeSingle();
  if (saRole?.id) {
    await admin.from("admin_user_roles").upsert({
      user_id: userId,
      role_id: saRole.id,
    });
  }

  return { ok: true as const, phone: ADMIN_PHONE, pin: ADMIN_PIN };
});
