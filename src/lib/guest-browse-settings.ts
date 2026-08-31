import { supabase } from "@/integrations/supabase/client";

/**
 * Platform toggle: guests may browse Care/Video catalog without login.
 * Book / message / bookings / portal still require auth (soft-gate paths).
 * Stored on app_settings.enable_guest (Admin → Settings → App).
 */
let cache: { enabled: boolean; at: number } | null = null;
const CACHE_MS = 60_000;

export function invalidateGuestBrowseSettingsCache() {
  cache = null;
}

/** Sync peek — null until first fetch. Optimistic allow when unknown. */
export function peekGuestBrowseEnabled(): boolean | null {
  return cache?.enabled ?? null;
}

/**
 * When cache is cold, treat as enabled so landing tiles don't flash login
 * for Care; SoftGate still waits for a real fetch before allowing guest shell.
 */
export function guestBrowseEnabledOrDefault(): boolean {
  return cache?.enabled !== false;
}

export async function fetchGuestBrowseEnabled(force = false): Promise<boolean> {
  if (!force && cache && Date.now() - cache.at < CACHE_MS) {
    return cache.enabled;
  }
  const { data, error } = await supabase
    .from("app_settings")
    .select("enable_guest")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    console.warn("fetchGuestBrowseEnabled", error.message);
    // Fail open to match shipped guest Care browse; SoftGate path rules still apply.
    cache = { enabled: true, at: Date.now() };
    return true;
  }
  const enabled = data?.enable_guest === true;
  cache = { enabled, at: Date.now() };
  return enabled;
}

export async function saveGuestBrowseEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    enable_guest: enabled,
  } as never);
  if (error) throw new Error(error.message);
  cache = { enabled, at: Date.now() };
}
