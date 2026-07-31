import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import {
  isValidPhone,
  isValidPin,
  normalizePhone,
} from "@/lib/phone-auth";
import {
  authErrorMessage,
  loginAsDefaultAdmin,
  loginWithPhonePin,
  registerWithPhonePin,
} from "@/lib/phone-session";
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const normalized = normalizePhone(phone);
      if (!isValidPhone(normalized)) {
        toast.error(
          lang === "bn" ? "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)" : "Enter a valid mobile number (01XXXXXXXXX)",
        );
        return;
      }
      if (!isValidPin(pin)) {
        toast.error(lang === "bn" ? "৪ সংখ্যার PIN দিন" : "Enter a 4-digit PIN");
        return;
      }

      if (mode === "signup") {
        if (pin !== confirmPin) {
          toast.error(lang === "bn" ? "PIN মিলছে না" : "PINs do not match");
          return;
        }
        const result = await registerWithPhonePin({
          phone: normalized,
          pin,
          confirmPin,
          fullName: name.trim() || normalized,
        });
        toast.success(
          result.exists
            ? lang === "bn"
              ? "লগইন হয়েছে"
              : "Signed in"
            : lang === "bn"
              ? "অ্যাকাউন্ট তৈরি হয়েছে"
              : "Account created",
        );
        navigate({ to: "/" });
        return;
      }

      if (mode === "admin") {
        await loginAsDefaultAdmin({ phone: normalized, pin });
        navigate({ to: "/admin" });
        return;
      }

      await loginWithPhonePin({ phone: normalized, pin });
      navigate({ to: "/" });
    } catch (err) {
      const raw = (err as Error)?.message || String(err);
      toast.error(authErrorMessage(raw, lang));
      if (raw === "ACCOUNT_EXISTS_WRONG_PIN" || /ACCOUNT_EXISTS_WRONG_PIN/.test(raw)) setMode("login");
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
              {(
                [
                  ["login", t("login")],
                  ["signup", t("signup")],
                  ["admin", lang === "bn" ? "অ্যাডমিন" : "Admin"],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setConfirmPin("");
                    setName("");
                    // Admin: empty inputs — user types phone/PIN (no prefilled credentials)
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

            <form onSubmit={(e) => void submit(e)} className="space-y-3">
              {mode === "signup" && (
                <Field label={t("fullName")} value={name} onChange={setName} required />
              )}
              <PhoneField
                label={t("phone")}
                value={phone}
                onChange={setPhone}
                lang={lang}
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
              <button
                type="submit"
                disabled={
                  busy ||
                  phone.replace(/\D/g, "").length !== 11 ||
                  pin.length !== 4 ||
                  (mode === "signup" && confirmPin.length !== 4)
                }
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

function clampPhoneDigits(raw: string): string {
  // Digits only; if pasted with country code, normalize then keep 11
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("880") && digits.length > 11) digits = "0" + digits.slice(3);
  else if (digits.startsWith("88") && digits.length > 11) digits = "0" + digits.slice(2);
  else if (digits.length === 10 && digits.startsWith("1")) digits = "0" + digits;
  return digits.slice(0, 11);
}

function PhoneField({
  label,
  value,
  onChange,
  lang,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  lang: "bn" | "en";
  readOnly?: boolean;
}) {
  const len = value.replace(/\D/g, "").length;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
        <span
          className={`text-[10px] font-mono tabular-nums ${
            len === 11 ? "text-emerald-600" : "text-muted-foreground"
          }`}
        >
          {len}/11
        </span>
      </div>
      <input
        className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 font-mono tracking-wide"
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={11}
        value={value}
        placeholder="01712345678"
        readOnly={readOnly}
        required
        onChange={(e) => onChange(clampPhoneDigits(e.target.value))}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text") || "";
          onChange(clampPhoneDigits(text));
        }}
        onKeyDown={(e) => {
          // Block non-digit keys (allow control/nav)
          if (
            e.ctrlKey ||
            e.metaKey ||
            e.altKey ||
            ["Backspace", "Delete", "Tab", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
          ) {
            return;
          }
          if (!/^\d$/.test(e.key)) {
            e.preventDefault();
            return;
          }
          if (value.replace(/\D/g, "").length >= 11 && !e.key.match(/^(Backspace|Delete)$/)) {
            // Selection replace is ok; otherwise block extra digit
            const el = e.currentTarget;
            const hasSelection = (el.selectionEnd ?? 0) > (el.selectionStart ?? 0);
            if (!hasSelection) e.preventDefault();
          }
        }}
      />
      {len > 0 && len < 11 && (
        <p className="mt-1 text-[10px] text-amber-600/90">
          {lang === "bn" ? "ঠিক ১১ সংখ্যার মোবাইল নম্বর দিন" : "Enter exactly 11 digits"}
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
        maxLength={4}
        value={value}
        placeholder="••••"
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
        required
        autoComplete={label.includes("Confirm") || label.includes("নিশ্চিত") ? "new-password" : "current-password"}
      />
    </div>
  );
}
