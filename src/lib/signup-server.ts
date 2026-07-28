import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL } from "@/integrations/supabase/public-env";
import {
  ADMIN_PHONE,
  ADMIN_PIN,
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
    global: { headers: { "User-Agent": "BloodLink-Signup/1.0" } },
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
    const email = phoneToAuthEmail(data.phone);
    const password = pinToPassword(data.pin);

    const { error } = await admin.auth.admin.createUser({
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
      throw new Error(error.message);
    }

    return { ok: true as const, exists: false as const };
  });

/**
 * Ensures the default admin phone account exists, PIN is set, and admin role is granted.
 */
export const ensureAdminAccount = createServerFn({ method: "POST" }).handler(async () => {
  const admin = adminClient();
  const email = phoneToAuthEmail(ADMIN_PHONE);
  const password = pinToPassword(ADMIN_PIN);

  let userId: string | null = null;

  const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = listed?.users?.find((u) => u.email?.toLowerCase() === email);
  if (existing) {
    userId = existing.id;
    await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      user_metadata: { full_name: "BloodLink Admin", phone: ADMIN_PHONE },
    });
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "BloodLink Admin", phone: ADMIN_PHONE },
    });
    if (error) throw new Error(error.message);
    userId = created.user?.id ?? null;
  }

  if (!userId) throw new Error("Could not resolve admin user");

  await admin.from("profiles").upsert({
    id: userId,
    full_name: "BloodLink Admin",
    phone: ADMIN_PHONE,
  });

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
