import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { signupWithoutEmail } from "@/lib/signup-server";
import { toast } from "sonner";
import { Droplet, Loader2, Shield } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — BloodLink" }] }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "admin";

function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const { session, loading, isAnonymous, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !session || isAnonymous) return;
    navigate({ to: isAdmin || mode === "admin" ? "/admin" : "/" });
  }, [session, loading, isAnonymous, isAdmin, mode, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const mail = email.trim().toLowerCase();
        if (!mail.includes("@") || !mail.includes(".")) {
          toast.error(lang === "bn" ? "সঠিক ইমেইল দিন" : "Enter a valid email");
          return;
        }
        if (password !== confirm) {
          toast.error(lang === "bn" ? "পাসওয়ার্ড মিলছে না" : "Passwords do not match");
          return;
        }
        // Any letters/numbers/symbols — min 6 characters (Supabase default)
        if (password.length < 6) {
          toast.error(
            lang === "bn"
              ? "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে (অক্ষর/সংখ্যা/সিম্বল)"
              : "Password must be at least 6 characters (letters/numbers/symbols)",
          );
          return;
        }
        // Admin createUser (email already confirmed) — no auth emails → no rate limit
        const created = await signupWithoutEmail({
          data: {
            email: mail,
            password,
            fullName: name.trim() || mail.split("@")[0]!,
          },
        });
        const { error } = await supabase.auth.signInWithPassword({ email: mail, password });
        if (error) {
          if (created.exists) {
            toast.error(
              lang === "bn"
                ? "এই ইমেইলে অ্যাকাউন্ট আগেই আছে — পাসওয়ার্ড চেক করুন বা লগইন করুন"
                : "Account already exists — check password or sign in",
            );
            setMode("login");
            return;
          }
          throw error;
        }
        toast.success(
          created.exists
            ? lang === "bn"
              ? "লগইন হয়েছে"
              : "Signed in"
            : lang === "bn"
              ? "অ্যাকাউন্ট তৈরি হয়েছে"
              : "Account created",
        );
        navigate({ to: "/" });
      } else {
        const loginEmail = mode === "admin" ? "blood@gmail.com" : email.trim().toLowerCase();
        const loginPass =
          mode === "admin" && (password === "blood" || !password) ? "blood12" : password;
        const { error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password: loginPass,
        });
        if (error) throw error;
        navigate({ to: mode === "admin" ? "/admin" : "/" });
      }
    } catch (err) {
      const msg = (err as Error).message || String(err);
      if (/rate limit|email rate/i.test(msg)) {
        toast.error(
          lang === "bn"
            ? "সাইনআপ ইমেইল বন্ধ আছে — একটু পর আবার চেষ্টা করুন"
            : "Signup is busy — try again in a moment",
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background">
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="h-14 w-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-xl shadow-primary/30 mb-3">
              <Droplet className="h-7 w-7" fill="currentColor" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{t("appName")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("tagline")}</p>
          </div>

          <div className="rounded-3xl border border-border/80 bg-card/90 backdrop-blur p-5 shadow-xl shadow-primary/5">
            <div className="flex gap-1 rounded-2xl bg-muted/80 p-1 mb-5">
              {([
                ["login", t("login")],
                ["signup", t("signup")],
                ["admin", lang === "bn" ? "অ্যাডমিন" : "Admin"],
              ] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    if (m === "admin") {
                      setEmail("blood@gmail.com");
                      setPassword("blood");
                    } else if (email === "blood@gmail.com") {
                      setEmail("");
                      setPassword("");
                      setConfirm("");
                    }
                  }}
                  className={`flex-1 rounded-xl px-2 py-2 text-xs font-semibold transition ${
                    mode === m ? "bg-card shadow text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m === "admin" ? (
                    <span className="inline-flex items-center gap-1 justify-center w-full">
                      <Shield className="h-3 w-3" />
                      {label}
                    </span>
                  ) : (
                    label
                  )}
                </button>
              ))}
            </div>

            <form onSubmit={submit} className="space-y-3">
              {mode === "signup" && (
                <Field label={t("fullName")} value={name} onChange={setName} required />
              )}
              {mode !== "admin" && (
                <Field
                  label={t("email")}
                  type="email"
                  value={email}
                  onChange={setEmail}
                  required
                  placeholder="you@gmail.com"
                  autoComplete="email"
                />
              )}
              {mode === "admin" && (
                <p className="text-xs text-muted-foreground rounded-xl bg-muted/50 px-3 py-2">
                  {lang === "bn" ? "অ্যাডমিন: blood@gmail.com" : "Admin: blood@gmail.com"}
                </p>
              )}
              <Field
                label={t("password")}
                type="password"
                value={password}
                onChange={setPassword}
                required
                minLength={mode === "admin" ? 4 : 6}
                placeholder={mode === "signup" ? (lang === "bn" ? "কমপক্ষে ৬ অক্ষর" : "At least 6 characters") : undefined}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
              {mode === "signup" && (
                <Field
                  label={t("confirmPassword")}
                  type="password"
                  value={confirm}
                  onChange={setConfirm}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              )}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:brightness-105 transition"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signup"
                  ? t("createAccount")
                  : mode === "admin"
                    ? lang === "bn"
                      ? "অ্যাডমিন প্রবেশ"
                      : "Admin enter"
                    : t("login")}
              </button>
            </form>
          </div>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setLang(lang === "bn" ? "en" : "bn")}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {lang === "bn" ? "English" : "বাংলা"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  placeholder,
  minLength,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  minLength?: number;
  autoComplete?: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">{label}</label>
      <input
        className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
      />
    </div>
  );
}
