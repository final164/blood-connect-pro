import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL } from "@/integrations/supabase/public-env";

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) {
    throw new Error("Server auth is not configured — set SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role PIN lookup for admin UI (credentials table + auth metadata). */
export const adminFetchUserPin = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => {
    const userId = String(data?.userId ?? "").trim();
    if (!userId) throw new Error("userId required");
    return { userId };
  })
  .handler(async ({ data }) => {
    const admin = adminClient();

    const { data: cred } = await admin
      .from("user_login_credentials")
      .select("phone, pin")
      .eq("user_id", data.userId)
      .maybeSingle();

    if (cred?.pin) {
      return { ok: true as const, pin: cred.pin as string, phone: (cred.phone as string) ?? null };
    }

    const { data: userData, error } = await admin.auth.admin.getUserById(data.userId);
    if (error) throw new Error(error.message);

    const meta = userData.user?.user_metadata ?? {};
    const pin = typeof meta.pin === "string" && /^\d{4}$/.test(meta.pin) ? meta.pin : null;
    const phone =
      (typeof meta.phone === "string" ? meta.phone : null) ||
      userData.user?.phone ||
      null;

    if (pin) {
      // Backfill credentials so next reads are fast
      await admin.from("user_login_credentials").upsert(
        { user_id: data.userId, phone, pin },
        { onConflict: "user_id" },
      );
      return { ok: true as const, pin, phone };
    }

    return { ok: false as const, pin: null as string | null, phone };
  });
