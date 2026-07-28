import { PUBLIC_VAPID_PUBLIC_KEY } from "@/integrations/supabase/public-env";

function asTrimmedString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value == null) return "";
  // Lovable / some env injectors can surface non-strings
  if (typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function readEnvVapid(): unknown {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env) {
      const fromVite = (import.meta.env as Record<string, unknown>).VITE_VAPID_PUBLIC_KEY;
      if (fromVite != null && fromVite !== "") return fromVite;
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof process !== "undefined" && process.env) {
      return process.env.VITE_VAPID_PUBLIC_KEY;
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** VAPID public key — safe in client bundle (private key stays server-side only). */
export function getVapidPublicKey(): string {
  const fromEnv = asTrimmedString(readEnvVapid());
  return fromEnv || asTrimmedString(PUBLIC_VAPID_PUBLIC_KEY) || "";
}

export function hasWebPushConfigured() {
  return getVapidPublicKey().length > 0;
}
