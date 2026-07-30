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

export const adminDeleteUser = createServerFn({ method: "POST" })
  .validator((data: { userId: string }) => {
    const userId = String(data?.userId ?? "").trim();
    if (!userId) throw new Error("userId required");
    return { userId };
  })
  .handler(async ({ data }) => {
    const admin = adminClient();
    const { error } = await admin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
