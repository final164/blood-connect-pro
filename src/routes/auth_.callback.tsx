import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { isSafeNextPath } from "@/lib/auth-next";
import { sanitizeOAuthUserMessage } from "@/lib/auth-email";
import { closeOAuthBrowser } from "@/lib/google-auth";

export const Route = createFileRoute("/auth_/callback")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: typeof search.next === "string" ? search.next : undefined,
    error_description:
      typeof search.error_description === "string" ? search.error_description : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Signing in — Muktosheba" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [APP_STYLESHEET],
  }),
  component: AuthCallbackPage,
});

/** How long to wait for the PKCE exchange before sending the user back to /auth. */
const TIMEOUT_MS = 8000;

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { next, error_description: errorDescription } = Route.useSearch();
  const [failed, setFailed] = useState<string | null>(
    errorDescription ? sanitizeOAuthUserMessage(errorDescription) : null,
  );
  const settled = useRef(false);

  useEffect(() => {
    void closeOAuthBrowser();

    if (errorDescription) return;

    const finish = (ok: boolean, message?: string) => {
      if (settled.current) return;
      settled.current = true;
      if (ok) {
        const dest = next && isSafeNextPath(next) ? next : "/home";
        window.location.replace(dest);
        return;
      }
      setFailed(sanitizeOAuthUserMessage(message ?? "Sign-in did not complete"));
    };

    // detectSessionInUrl is on by default, so supabase-js exchanges ?code= itself.
    // Listen for the resulting session rather than racing it.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) finish(true);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) finish(true);
    });

    const timer = window.setTimeout(() => finish(false), TIMEOUT_MS);

    return () => {
      window.clearTimeout(timer);
      sub.subscription.unsubscribe();
    };
  }, [next, errorDescription, navigate]);

  if (failed) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="text-base font-semibold text-foreground">
            লগইন সম্পূর্ণ হয়নি / Sign-in did not complete
          </p>
          <p className="text-sm text-muted-foreground break-words">{failed}</p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/auth", search: { next } })}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            আবার চেষ্টা করুন / Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh grid place-items-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
        <p className="text-sm">সাইন ইন হচ্ছে… / Signing you in…</p>
      </div>
    </div>
  );
}
