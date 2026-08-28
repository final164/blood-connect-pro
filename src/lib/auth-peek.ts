import type { Session } from "@supabase/supabase-js";

/** Instant session read from localStorage — never awaits GoTrue lock/network. */
export function peekStoredSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.includes("-auth-token")) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const data = JSON.parse(raw) as Record<string, unknown>;
      const session = (data.currentSession ?? data.session ?? data) as Session | null;
      if (session?.access_token && session?.user?.id) return session;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return null;
}
