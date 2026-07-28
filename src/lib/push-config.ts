import { PUBLIC_VAPID_PUBLIC_KEY } from "@/integrations/supabase/public-env";

/** VAPID public key — safe in client bundle (private key stays server-side only). */
export function getVapidPublicKey(): string {
  const fromEnv =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_VAPID_PUBLIC_KEY) ||
    (typeof process !== "undefined" && process.env?.VITE_VAPID_PUBLIC_KEY);
  return (fromEnv as string | undefined)?.trim() || PUBLIC_VAPID_PUBLIC_KEY;
}

export function hasWebPushConfigured() {
  return getVapidPublicKey().length > 0;
}
