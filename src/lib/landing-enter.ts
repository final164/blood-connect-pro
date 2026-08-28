import { authWithNext, isSafeNextPath } from "@/lib/auth-next";
import { peekStoredSession } from "@/lib/auth-peek";

/** Sync check from localStorage — never await GoTrue (can hang on lock). */
export function isLandingUserLoggedInSync(): boolean {
  const session = peekStoredSession();
  const user = session?.user;
  return !!user && !user.is_anonymous;
}

/** @deprecated Prefer sync peek — kept for call sites that await. */
export async function isLandingUserLoggedIn(): Promise<boolean> {
  return isLandingUserLoggedInSync();
}

/**
 * If already logged in → go to `next` (or /home).
 * Otherwise → /auth?next=…
 */
export async function enterAppOrAuth(nextPath?: string) {
  const next = (nextPath || "/home").trim() || "/home";
  if (isLandingUserLoggedInSync()) {
    window.location.assign(isSafeNextPath(next) ? next : "/home");
    return;
  }
  window.location.assign(authWithNext(next));
}

/** Login / signup CTA from landing: logged-in users skip the auth form. */
export async function enterAppOrOpenAuth() {
  window.location.assign(isLandingUserLoggedInSync() ? "/home" : "/auth");
}
