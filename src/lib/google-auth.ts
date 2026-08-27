/**
 * Google OAuth sign-in.
 *
 * Web: normal Supabase redirect to /auth/callback.
 * Native: Google refuses OAuth inside embedded WebViews, so the consent screen is
 * opened in a system Custom Tab and returns through the `muktosheba://` scheme.
 * The PKCE code verifier lives in the WebView's localStorage and the callback
 * lands back in that same WebView, so the code exchange succeeds.
 */
import { supabase } from "@/integrations/supabase/client";
import { isNativeApp } from "@/lib/native-app";

export const NATIVE_OAUTH_REDIRECT = "muktosheba://auth/callback";

export function googleRedirectTo(next?: string): string {
  if (isNativeApp()) return NATIVE_OAUTH_REDIRECT;
  const base = `${window.location.origin}/auth/callback`;
  return next ? `${base}?next=${encodeURIComponent(next)}` : base;
}

export async function signInWithGoogle(next?: string): Promise<void> {
  const native = isNativeApp();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: googleRedirectTo(next),
      skipBrowserRedirect: native,
    },
  });
  if (error) throw error;

  if (!native) return;

  if (!data?.url) throw new Error("OAUTH_CANCELLED");
  const { Browser } = await import("@capacitor/browser");
  await Browser.open({ url: data.url });
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
