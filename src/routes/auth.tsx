import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { ensureAdminAccount, signupWithPhone } from "@/lib/signup-server";
import {
  ADMIN_PHONE,
  ADMIN_PIN,
  isValidPhone,
  isValidPin,
  normalizePhone,
  phoneToAuthEmail,
  pinToPassword,
} from "@/lib/phone-auth";
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
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !session || isAnonymous) return;
    navigate({ to: isAdmin || mode === "admin" ? "/admin" : "/" });
  }, [session, loading, isAnonymous, isAdmin, mode, navigate]);

  async function signInWithPhonePin() {
    const normalized = normalizePhone(phone);
    if (!isValidPhone(normalized)) {
      toast.error(
        lang === "bn" ? "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)" : "Enter a valid mobile number (01XXXXXXXXX)",
      );
      return false;
    }
    if (!isValidPin(pin)) {
      toast.error(lang === "bn" ? "৪ সংখ্যার PIN দিন" : "Enter a 4-digit PIN");
      return false;
    }
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: phoneToAuthEmail(normalized),
      password: pinToPassword(pin),
    });
    if (error) {
      toast.error(
        lang === "bn"
          ? "ফোন বা PIN ভুল — আবার চেষ্টা করুন"
          : "Wrong phone or PIN — try again",
      );
      return false;
    }
    if (authData.user?.id) {
      await supabase.from("profiles").update({ phone: normalized }).eq("id", authData.user.id);
    }
    return true;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!isValidPhone(normalizePhone(phone))) {
          toast.error(
            lang === "bn" ? "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)" : "Enter a valid mobile number (01XXXXXXXXX)",
          );
          return;
        }
        if (!isValidPin(pin)) {
          toast.error(lang === "bn" ? "৪ সংখ্যার PIN দিন" : "Enter a 4-digit PIN");
          return;
        }
        if (pin !== confirmPin) {
          toast.error(lang === "bn" ? "PIN মিলছে না" : "PINs do not match");
          return;
        }
        const created = await signupWithPhone({
          data: {
            phone: normalizePhone(phone),
            pin,
            confirmPin,
            fullName: name.trim() || normalizePhone(phone),
          },
        });
        const ok = await signInWithPhonePin();
        if (!ok) {
          if (created.exists) {
            toast.error(
              lang === "bn"
                ? "এই নম্বরে অ্যাকাউন্ট আছে — PIN চেক করুন বা লগইন করুন"
                : "Account exists — check PIN or log in",
            );
            setMode("login");
          }
          return;
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
        if (mode === "admin") {
          await ensureAdminAccount();
        }
        const ok = await signInWithPhonePin();
        if (!ok) return;
        navigate({ to: mode === "admin" ? "/admin" : "/" });
      }
    } catch (err) {
      toast.error((err as Error).message || String(err));
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
                      setPhone(ADMIN_PHONE);
                      setPin(ADMIN_PIN);
                      setConfirmPin("");
                      setName("");
                    } else if (phone === ADMIN_PHONE) {
                      setPhone("");
                      setPin("");
                      setConfirmPin("");
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
              <Field
                label={t("phone")}
                type="tel"
                value={phone}
                onChange={setPhone}
                required
                placeholder="01712345678"
                autoComplete="tel"
                inputMode="numeric"
              />
              <PinField
                label={lang === "bn" ? "৪ সংখ্যার PIN" : "4-digit PIN"}
                value={pin}
                onChange={setPin}
              />
              {mode === "signup" && (
                <PinField
                  label={lang === "bn" ? "PIN নিশ্চিত করুন" : "Confirm PIN"}
                  value={confirmPin}
                  onChange={setConfirmPin}
                />
              )}
              {mode === "admin" && (
                <p className="text-xs text-muted-foreground rounded-xl bg-muted/50 px-3 py-2 leading-relaxed">
                  {lang === "bn" ? (
                    <>
                      অ্যাডমিন: <span className="font-mono text-foreground">{ADMIN_PHONE}</span>
                      {" · "}PIN <span className="font-mono text-foreground">{ADMIN_PIN}</span>
                    </>
                  ) : (
                    <>
                      Admin: <span className="font-mono text-foreground">{ADMIN_PHONE}</span>
                      {" · "}PIN <span className="font-mono text-foreground">{ADMIN_PIN}</span>
                    </>
                  )}
                </p>
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
  inputMode?: "numeric" | "tel" | "text";
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
        pattern="\d{4}"
        maxLength={4}
        value={value}
        placeholder="••••"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        required
        autoComplete={label.includes("Confirm") ? "new-password" : "current-password"}
      />
    </div>
  );
}
