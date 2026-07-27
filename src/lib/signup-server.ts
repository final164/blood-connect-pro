import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

type SignupInput = {
  email: string;
  password: string;
  fullName: string;
};

/**
 * Creates an account via Auth Admin API with email_confirm: true.
 * No confirmation / welcome email is sent — avoids "email rate limit exceeded".
 */
export const signupWithoutEmail = createServerFn({ method: "POST" })
  .inputValidator((data: SignupInput) => {
    const email = String(data?.email ?? "")
      .trim()
      .toLowerCase();
    const password = String(data?.password ?? "");
    const fullName = String(data?.fullName ?? "").trim();
    if (!email.includes("@") || !email.includes(".")) {
      throw new Error("Invalid email");
    }
    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters");
    }
    return { email, password, fullName: fullName || email.split("@")[0]! };
  })
  .handler(async ({ data }) => {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !secret) {
      throw new Error("Server auth is not configured (missing service role key)");
    }

    const admin = createClient(url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "User-Agent": "BloodLink-Signup/1.0" } },
    });

    const { error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.fullName },
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
