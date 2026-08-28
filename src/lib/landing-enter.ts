import { authWithNext, isSafeNextPath } from "@/lib/auth-next";

/** Click-time only — keeps supabase off the landing critical JS path. */
export async function isLandingUserLoggedIn(): Promise<boolean> {
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;
    return !!user && !user.is_anonymous;
  } catch {
    return false;
  }
}

/**
 * If already logged in → go to `next` (or /home).
 * Otherwise → /auth?next=…
 */
export async function enterAppOrAuth(nextPath?: string) {
  const next = (nextPath || "/home").trim() || "/home";
  const loggedIn = await isLandingUserLoggedIn();
  if (loggedIn) {
    window.location.assign(isSafeNextPath(next) ? next : "/home");
    return;
  }
  window.location.assign(authWithNext(next));
}

/** Login / signup CTA from landing: logged-in users skip the auth form. */
export async function enterAppOrOpenAuth() {
  const loggedIn = await isLandingUserLoggedIn();
  window.location.assign(loggedIn ? "/home" : "/auth");
}
