import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { isSafeNextPath } from "@/lib/auth-next";
import { isValidPhone, isValidPin, normalizePhone } from "@/lib/phone-auth";
import {
  authErrorMessage,
  loginAsDefaultAdmin,
  loginWithPhonePin,
} from "@/lib/phone-session";
import {
  PASSWORD_MIN,
  USERNAME_MAX,
  emailAuthErrorMessage,
  isUsernameAvailable,
  isValidEmail,
  isValidUsername,
  loginWithEmailPassword,
  normalizeUsername,
  registerWithEmailPassword,
} from "@/lib/email-auth";
import { signInWithGoogle } from "@/lib/google-auth";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { PhoneField } from "@/components/auth/PhoneField";
import { toast } from "sonner";
import { Check, Droplet, Loader2, Shield, X } from "lucide-react";

type Mode = "login" | "signup" | "admin";

const authRoute = getRouteApi("/auth");

function resumePath(next: string | undefined, fallback: "/home" | "/admin") {
  if (next && isSafeNextPath(next)) {
    const [path, qs = ""] = next.split("?");
    const search: Record<string, string> = {};
    if (qs)
      new URLSearchParams(qs).forEach((v, k) => {
        search[k] = v;
      });
    return { to: path as never, search: Object.keys(search).length ? (search as never) : undefined };
  }
  return { to: fallback as never, search: undefined };
}

function authContinueHint(next: string | undefined, lang: "bn" | "en"): string | null {
  if (!next || !isSafeNextPath(next)) return null;
  const path = next.split("?")[0] || "";
  const qs = next.includes("?") ? new URLSearchParams(next.split("?")[1]) : null;
  const tab = qs?.get("tab") || "";
  if (path === "/ambulance" || path.startsWith("/ambulance/")) {
    return lang === "bn"
      ? "লগইন করুন — তারপর অ্যাম্বুলেন্স বুকিংয়ে ফিরে যাবেন।"
      : "Sign in to continue to ambulance booking.";
  }
  if (path.startsWith("/care/doctor") || ((path === "/care" || path === "/care/") && (!tab || tab === "doctors"))) {
    return lang === "bn"
      ? "লগইন করুন — তারপর ডাক্তার সিরিয়ালে ফিরে যাবেন।"
      : "Sign in to continue to doctor serial booking.";
  }
  if ((path === "/care" || path === "/care/") && tab === "bookings") {
    return lang === "bn"
      ? "লগইন করুন — তারপর আপনার বুকিং দেখতে পারবেন।"
      : "Sign in to view your bookings.";
  }
  return lang === "bn"
    ? "লগইন করুন — কাজ শেষে আগের পেজে ফিরে যাবেন।"
    : "Sign in to continue where you left off.";
}

type UsernameState = "idle" | "checking" | "free" | "taken" | "invalid";

export function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const { session, loading, isAnonymous, isAdmin, applySession } = useAuth();
  const navigate = useNavigate();
  const { next } = authRoute.useSearch();
  const continueHint = authContinueHint(next, lang);
  const bn = lang === "bn";

  const [mode, setMode] = useState<Mode>("login");
  const [usePhonePin, setUsePhonePin] = useState(false);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameState, setUsernameState] = useState<UsernameState>("idle");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");

  useEffect(() => {
    if (loading || !session || isAnonymous) return;
    const dest = resumePath(next, isAdmin || mode === "admin" ? "/admin" : "/home");
    void navigate(dest);
  }, [session, loading, isAnonymous, isAdmin, mode, navigate, next]);

  // Debounced username availability check — signup only.
  useEffect(() => {
    if (mode !== "signup" || usePhonePin) return;
    const u = normalizeUsername(username);
    if (!u) {
      setUsernameState("idle");
      return;
    }
    if (!isValidUsername(u)) {
      setUsernameState("invalid");
      return;
    }
    setUsernameState("checking");
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void isUsernameAvailable(u)
        .then((free) => {
          if (!cancelled) setUsernameState(free ? "free" : "taken");
        })
        .catch(() => {
          if (!cancelled) setUsernameState("idle");
        });
    }, 450);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [username, mode, usePhonePin]);

  async function submitPhonePin() {
    const normalized = normalizePhone(phone);
    if (!isValidPhone(normalized)) {
      toast.error(bn ? "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)" : "Enter a valid mobile number (01XXXXXXXXX)");
      return;
    }
    if (!isValidPin(pin)) {
      toast.error(bn ? "৪ সংখ্যার PIN দিন" : "Enter a 4-digit PIN");
      return;
    }
    if (mode === "admin") {
      const res = await loginAsDefaultAdmin({ phone: normalized, pin });
      if (res.session) applySession(res.session);
      else if (res.userId) {
        // Session missing from response — force full reload so AuthProvider peeks storage.
        window.location.assign(next && isSafeNextPath(next) ? next : "/admin");
        return;
      }
      void navigate(resumePath(next, "/admin"));
      return;
    }
    const res = await loginWithPhonePin({ phone: normalized, pin });
    if (res.session) applySession(res.session);
    else if (res.userId) {
      window.location.assign(next && isSafeNextPath(next) ? next : "/home");
      return;
    }
    void navigate(resumePath(next, "/home"));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "admin" || usePhonePin) {
        await submitPhonePin();
        return;
      }

      if (mode === "signup") {
        const res = await registerWithEmailPassword({
          fullName: name,
          username,
          email,
          password,
          confirmPassword,
        });
        if (res.session) applySession(res.session);
        toast.success(bn ? "অ্যাকাউন্ট তৈরি হয়েছে" : "Account created");
        void navigate(resumePath(next, "/home"));
        return;
      }

      const res = await loginWithEmailPassword({ email, password });
      if (res.session) applySession(res.session);
      void navigate(resumePath(next, "/home"));
    } catch (err) {
      const raw = (err as Error)?.message || String(err);
      toast.error(
        mode === "admin" || usePhonePin
          ? authErrorMessage(raw, lang)
          : emailAuthErrorMessage(raw, lang),
      );
      if (/ACCOUNT_EXISTS_WRONG_PIN/.test(raw)) setMode("login");
      if (/EMAIL_TAKEN/.test(raw)) setMode("login");
    } finally {
      setBusy(false);
    }
  }

  const emailFormReady =
    mode === "signup"
      ? name.trim().length > 0 &&
        usernameState === "free" &&
        isValidEmail(email) &&
        password.length >= PASSWORD_MIN &&
        confirmPassword.length >= PASSWORD_MIN
      : isValidEmail(email) && password.length > 0;

  const phoneFormReady = phone.replace(/\D/g, "").length === 11 && pin.length === 4;

  const submitDisabled = busy || (mode === "admin" || usePhonePin ? !phoneFormReady : !emailFormReady);

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
            {continueHint ? (
              <p className="mt-3 max-w-xs text-xs leading-relaxed text-primary/90 bg-primary/8 border border-primary/15 rounded-xl px-3 py-2">
                {continueHint}
              </p>
            ) : null}
          </div>

          <div className="rounded-3xl border border-border/80 bg-card/90 backdrop-blur p-5 shadow-xl shadow-primary/5">
            <div className="flex gap-1 rounded-2xl bg-muted/80 p-1 mb-5">
              {(
                [
                  ["login", t("login")],
                  ["signup", t("signup")],
                  ["admin", bn ? "অ্যাডমিন" : "Admin"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setUsePhonePin(false);
                    setConfirmPassword("");
                    if (m === "admin") {
                      setPhone("");
                      setPin("");
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

            {mode !== "admin" && !usePhonePin && (
              <>
                <GoogleButton
                  label={bn ? "Google দিয়ে চালিয়ে যান" : "Continue with Google"}
                  onClick={() => signInWithGoogle(next)}
                  disabled={busy}
                />
                <div className="my-4 flex items-center gap-3">
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {bn ? "অথবা" : "or"}
                  </span>
                  <div className="h-px flex-1 bg-border" />
                </div>
              </>
            )}

            <form onSubmit={(e) => void submit(e)} className="space-y-3">
              {mode === "admin" || usePhonePin ? (
                <>
                  <PhoneField label={t("phone")} value={phone} onChange={setPhone} lang={lang} />
                  <PinField
                    label={bn ? "৪ সংখ্যার PIN" : "4-digit PIN"}
                    value={pin}
                    onChange={setPin}
                  />
                </>
              ) : (
                <>
                  {mode === "signup" && (
                    <>
                      <Field
                        label={t("fullName")}
                        value={name}
                        onChange={setName}
                        autoComplete="name"
                        required
                      />
                      <UsernameField
                        value={username}
                        onChange={(v) => setUsername(normalizeUsername(v))}
                        state={usernameState}
                        lang={lang}
                      />
                    </>
                  )}
                  <Field
                    label={bn ? "ইমেইল" : "Email"}
                    value={email}
                    onChange={setEmail}
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    required
                  />
                  <Field
                    label={bn ? "পাসওয়ার্ড" : "Password"}
                    value={password}
                    onChange={setPassword}
                    type="password"
                    autoComplete={mode === "signup" ? "new-password" : "current-password"}
                    required
                  />
                  {mode === "signup" && (
                    <Field
                      label={bn ? "পাসওয়ার্ড নিশ্চিত করুন" : "Confirm password"}
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      type="password"
                      autoComplete="new-password"
                      required
                    />
                  )}
                  {mode === "signup" && (
                    <p className="text-[10px] text-muted-foreground">
                      {bn
                        ? `পাসওয়ার্ড কমপক্ষে ${PASSWORD_MIN} অক্ষরের হতে হবে`
                        : `Password must be at least ${PASSWORD_MIN} characters`}
                    </p>
                  )}
                </>
              )}

              <button
                type="submit"
                disabled={submitDisabled}
                className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2 shadow-lg shadow-primary/25 hover:brightness-105 transition"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "signup"
                  ? t("createAccount")
                  : mode === "admin"
                    ? bn
                      ? "অ্যাডমিন প্রবেশ"
                      : "Admin enter"
                    : t("login")}
              </button>
            </form>

            {mode === "login" && !usePhonePin && (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => void navigate({ to: "/auth/forgot" })}
                  className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  {bn ? "পাসওয়ার্ড ভুলে গেছেন?" : "Forgot your password?"}
                </button>
              </div>
            )}

            {mode === "login" && (
              <div className="mt-4 border-t border-border/70 pt-3 text-center">
                <button
                  type="button"
                  onClick={() => setUsePhonePin((v) => !v)}
                  className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline hover:text-foreground"
                >
                  {usePhonePin
                    ? bn
                      ? "ইমেইল দিয়ে লগইন করুন"
                      : "Log in with email instead"
                    : bn
                      ? "পুরোনো অ্যাকাউন্ট? ফোন ও PIN দিয়ে লগইন করুন"
                      : "Existing account? Log in with phone and PIN"}
                </button>
              </div>
            )}
          </div>

          <div className="mt-5 text-center">
            <button
              type="button"
              onClick={() => setLang(bn ? "en" : "bn")}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {bn ? "English" : "বাংলা"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UsernameField({
  value,
  onChange,
  state,
  lang,
}: {
  value: string;
  onChange: (v: string) => void;
  state: UsernameState;
  lang: "bn" | "en";
}) {
  const bn = lang === "bn";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-medium text-muted-foreground">
          {bn ? "ইউজারনেম" : "Username"}
        </label>
        {state === "checking" && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        {state === "free" && <Check className="h-3.5 w-3.5 text-emerald-600" />}
        {state === "taken" && <X className="h-3.5 w-3.5 text-destructive" />}
      </div>
      <div className="flex items-center rounded-xl border bg-background focus-within:ring-2 focus-within:ring-primary/30">
        <span className="pl-3 text-sm text-muted-foreground">@</span>
        <input
          className="w-full bg-transparent px-2 py-3 text-sm outline-none"
          value={value}
          maxLength={USERNAME_MAX}
          autoComplete="username"
          placeholder={bn ? "rahim_bd" : "rahim_bd"}
          onChange={(e) => onChange(e.target.value)}
          required
        />
      </div>
      {state === "invalid" && (
        <p className="mt-1 text-[10px] text-amber-600/90">
          {bn
            ? "ছোট হাতের অক্ষর, সংখ্যা ও _ চলবে — শুরুতে অক্ষর, ৩-২০ অক্ষর"
            : "Lowercase letters, numbers and _ only — must start with a letter, 3-20 characters"}
        </p>
      )}
      {state === "taken" && (
        <p className="mt-1 text-[10px] text-destructive">
          {bn ? "এই ইউজারনেম নেওয়া হয়ে গেছে" : "That username is taken"}
        </p>
      )}
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
  autoComplete,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "tel" | "text" | "email";
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
        autoComplete={autoComplete}
        inputMode={inputMode}
      />
    </div>
  );
}

function PinField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">{label}</label>
      <input
        className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 tracking-[0.35em] font-mono text-center"
        type="password"
        inputMode="numeric"
        maxLength={4}
        value={value}
        placeholder="••••"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        required
        autoComplete="current-password"
      />
    </div>
  );
}
