import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { toast } from "sonner";
import { Droplet, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Log in — BloodLink" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const redirect = typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: redirect, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success(lang === "bn" ? "ইমেইল চেক করুন" : "Check your email");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-gradient-to-b from-primary/5 via-background to-background">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="h-12 w-12 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/25">
              <Droplet className="h-6 w-6" fill="currentColor" />
            </div>
            <div>
              <h1 className="text-xl font-bold leading-tight">{t("appName")}</h1>
              <p className="text-xs text-muted-foreground">{t("tagline")}</p>
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-5 shadow-sm">
            <div className="flex gap-1 rounded-full bg-muted p-1 mb-5">
              {(["login", "signup"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
                    mode === m ? "bg-card shadow text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m === "login" ? t("login") : t("signup")}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <input
                  className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={t("fullName")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              )}
              <input
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                type="email"
                placeholder={t("email")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <input
                className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                type="password"
                placeholder={t("password")}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "login" ? t("login") : t("createAccount")}
              </button>
            </form>

            <div className="mt-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {lang === "bn" ? "অথবা" : "or"}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={async () => {
                setBusy(true);
                try {
                  const { error } = await supabase.auth.signInAnonymously();
                  if (error) throw error;
                  navigate({ to: "/" });
                } catch (err) {
                  toast.error((err as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="mt-3 w-full rounded-xl border border-border bg-background py-3 text-sm font-semibold disabled:opacity-60"
            >
              {lang === "bn" ? "অতিথি হিসেবে প্রবেশ করুন" : "Continue as guest"}
            </button>
          </div>

          <div className="mt-5 text-center">
            <button
              onClick={() => setLang(lang === "bn" ? "en" : "bn")}
              className="text-xs text-muted-foreground underline"
            >
              {lang === "bn" ? "English" : "বাংলা"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
