/**
 * Google OAuth sign-in.
 *
 * Web (when VITE_GOOGLE_WEB_CLIENT_ID is set): Google Identity Services + signInWithIdToken
 * — user only sees Google's UI, not Supabase authorize URL with apikey.
 *
 * Web fallback / native: Supabase OAuth redirect (Custom Tab on native).
 */
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/native-app";
import { getGoogleWebClientId } from "@/lib/google-gsi";

export const NATIVE_OAUTH_REDIRECT = "muktosheba://auth/callback";

export function googleRedirectTo(next?: string): string {
  if (isNativeApp()) return NATIVE_OAUTH_REDIRECT;
  const base = `${window.location.origin}/auth/callback`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}

async function signInWithGoogleOAuth(next?: string): Promise<void> {
  const native = isNativeApp();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: googleRedirectTo(next),
      skipBrowserRedirect: native,
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;

  if (!native) {
    if (!data?.url) throw new Error("OAUTH_CANCELLED");
    window.location.assign(data.url);
    return;
  }

  if (!data?.url) throw new Error("OAUTH_CANCELLED");
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: data.url, presentationStyle: "popover" });
}

/** True when the web app can use GIS instead of Supabase OAuth redirect. */
export function canUseGoogleIdentityServices(): boolean {
  return !isNativeApp() && !!getGoogleWebClientId();
}

export async function signInWithGoogle(next?: string): Promise<void> {
  if (canUseGoogleIdentityServices()) {
    throw new Error("USE_GSI_BUTTON");
  }
  await signInWithGoogleOAuth(next);
}

/** Close the Custom Tab once the callback has been handled. Safe no-op on web. */
export async function closeOAuthBrowser(): Promise<void> {
  if (!isNativeApp()) return;
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.close();
  } catch {
    /* tab already dismissed */
  }
}
