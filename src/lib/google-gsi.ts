import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: "standard" | "icon";
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
              shape?: "rectangular" | "pill" | "circle" | "square";
              width?: number;
              logo_alignment?: "left" | "center";
            },
          ) => void;
        };
      };
    };
  }
}

let gsiPromise: Promise<void> | null = null;

export function getGoogleWebClientId(): string {
  return (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID || "").trim();
}

function loadGsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiPromise) return gsiPromise;

  gsiPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-muktosheba-gsi="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("GSI_LOAD_FAILED")), { once: true });
      if (window.google?.accounts?.id) resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.muktoshebaGsi = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("GSI_LOAD_FAILED"));
    document.head.appendChild(script);
  });

  return gsiPromise;
}

/** Web-only: Google Identity Services button (no Supabase OAuth redirect / apikey in URL). */
export async function mountGoogleSignInButton(
  container: HTMLElement,
  onCredential: (credential: string) => Promise<void>,
): Promise<() => void> {
  const clientId = getGoogleWebClientId();
  if (!clientId) throw new Error("GOOGLE_CLIENT_MISSING");

  await loadGsiScript();
  if (!window.google?.accounts?.id) throw new Error("GSI_LOAD_FAILED");

  container.replaceChildren();

  return new Promise((resolve, reject) => {
    try {
      window.google!.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          void onCredential(response.credential).catch((err) => {
            console.error("Google sign-in failed", err);
          });
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      const width = Math.max(240, Math.floor(container.getBoundingClientRect().width) || 320);
      window.google!.accounts.id.renderButton(container, {
        type: "standard",
        theme: "outline",
        size: "large",
        text: "continue_with",
        shape: "rectangular",
        width,
        logo_alignment: "left",
      });
      resolve(() => container.replaceChildren());
    } catch (err) {
      reject(err);
    }
  });
}

export async function signInWithGoogleIdToken(credential: string): Promise<void> {
  const { error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: credential,
  });
  if (error) throw error;
}
