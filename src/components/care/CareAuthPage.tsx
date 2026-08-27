import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2, FlaskConical, Loader2, ShieldCheck, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { fetchMyCareMemberships } from "@/lib/care-access";
import { useI18n } from "@/lib/i18n";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { clampPhoneDigits, isValidPhone, isValidPin, normalizePhone } from "@/lib/phone-auth";
import {
  authErrorMessage,
  loginWithPhonePin,
  registerWithPhonePin,
} from "@/lib/phone-session";
import {
  registerCareVendorAccount,
  resolveCarePortalPath,
} from "@/lib/care-vendor-auth";

type Mode = "login" | "register";

type CareAuthSearch = {
  mode?: Mode;
  next?: string;
};

export function CareAuthPage() {
  const { lang, setLang } = useI18n();
  const { session, loading, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as CareAuthSearch;
  const [mode, setMode] = useState<Mode>(search.mode === "register" ? "register" : "login");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !session || isAnonymous) return;
    void (async () => {
      const next = search.next?.trim();
      if (next?.startsWith("/care/portal")) {
        void navigate({ to: next as "/care/portal/desk" });
        return;
      }
      const rows = await fetchMyCareMemberships();
      const active = rows.filter((r) => r.care_orgs?.is_active !== false);
      if (active.length) {
        const path = await resolveCarePortalPath(active[0]!);
        void navigate({ to: path as "/care/portal/desk" });
      } else if (mode === "register") {
        return;
      } else {
        void navigate({ to: "/care/portal" });
      }
    })();
  }, [session, loading, isAnonymous, navigate, search.next, mode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const normalized = normalizePhone(phone);
      if (!isValidPhone(normalized)) {
        toast.error(
          lang === "bn"
            ? "সঠিক মোবাইল নম্বর দিন (01XXXXXXXXX)"
            : "Enter a valid mobile number (01XXXXXXXXX)",
        );
        return;
      }
      if (!isValidPin(pin)) {
        toast.error(lang === "bn" ? "৪ সংখ্যার PIN দিন" : "Enter a 4-digit PIN");
        return;
      }

      if (mode === "register") {
        if (pin !== confirmPin) {
          toast.error(lang === "bn" ? "PIN মিলছে না" : "PINs do not match");
          return;
        }

        await registerWithPhonePin({
          phone: normalized,
          pin,
          confirmPin,
          fullName: normalized,
        });

        await registerCareVendorAccount();

        toast.success(
          lang === "bn"
            ? "অ্যাকাউন্ট তৈরি হয়েছে — এখন প্রোফাইল সম্পূর্ণ করুন"
            : "Account created — complete your profile next",
        );

        void navigate({
          to: "/care/portal/onboarding",
          search: { welcome: true },
        });
        return;
      }

      await loginWithPhonePin({ phone: normalized, pin });
      const rows = await fetchMyCareMemberships();
      const active = rows.filter((r) => r.care_orgs?.is_active !== false);
      if (!active.length) {
        toast.error(
          lang === "bn"
            ? "এই নম্বরে কেয়ার ভেন্ডর অ্যাকাউন্ট নেই — নিবন্ধন করুন"
            : "No care vendor account on this number — please register",
        );
        setMode("register");
        return;
      }

      const next = search.next?.trim();
      if (next?.startsWith("/care/portal")) {
        void navigate({ to: next as "/care/portal/desk" });
        return;
      }
      const path = await resolveCarePortalPath(active[0]!);
      toast.success(lang === "bn" ? "লগইন হয়েছে" : "Signed in");
      void navigate({ to: path as "/care/portal/desk" });
    } catch (err) {
      const raw = (err as Error)?.message || String(err);
      toast.error(authErrorMessage(raw, lang));
    } finally {
      setBusy(false);
    }
  }

  const copy = {
    title: lang === "bn" ? "Muktosheba Care" : "Muktosheba Care",
    subtitle:
      lang === "bn"
        ? "চেম্বার, ক্লিনিক ও ল্যাবের জন্য পেশাদার পোর্টাল"
        : "Professional portal for chambers, clinics & labs",
    login: lang === "bn" ? "ভেন্ডর লগইন" : "Vendor login",
    register: lang === "bn" ? "নতুন ভেন্ডর নিবন্ধন" : "New vendor registration",
    registerHint:
      lang === "bn"
        ? "শুধু মোবাইল ও PIN — প্রোফাইল পরে সম্পূর্ণ করুন"
        : "Mobile & PIN only — complete profile later",
    patientLink: lang === "bn" ? "রোগী হিসেবে লগইন" : "Sign in as patient",
  };

  return (
    <div className="min-h-dvh flex flex-col lg:flex-row bg-background">
      <aside className="relative overflow-hidden bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-950 text-white lg:w-[42%] xl:w-[38%]">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_20%_20%,white,transparent_45%)]" />
        <div className="relative flex min-h-[220px] lg:min-h-dvh flex-col justify-between p-8 lg:p-12">
          <div>
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur">
              <Stethoscope className="h-6 w-6" />
            </div>
            <h1 className="mt-6 text-3xl font-bold tracking-tight">{copy.title}</h1>
            <p className="mt-2 max-w-sm text-sm text-teal-100/90">{copy.subtitle}</p>
          </div>
          <ul className="mt-8 hidden space-y-4 text-sm text-teal-50/90 lg:block">
            <li className="flex items-start gap-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
              {lang === "bn" ? "১ মিনিটে অ্যাকাউন্ট — ফোন + PIN" : "1-minute signup — phone + PIN"}
            </li>
            <li className="flex items-start gap-3">
              <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" />
              {lang === "bn" ? "প্রোফাইল যেকোনো সময় সম্পূর্ণ করুন" : "Complete profile anytime"}
            </li>
            <li className="flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
              {lang === "bn" ? "অ্যাডমিন অনুমোদনের পর লিস্টেড" : "Listed after admin approval"}
            </li>
          </ul>
          <p className="mt-6 text-xs text-teal-200/70">© {new Date().getFullYear()} Muktosheba Care</p>
        </div>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <PageBackButton fallbackTo="/home" shape="xl" />
              <div className="lg:hidden min-w-0">
                <h2 className="text-xl font-bold">{copy.title}</h2>
                <p className="text-xs text-muted-foreground">{copy.subtitle}</p>
              </div>
            </div>
            <div className="ml-auto flex rounded-xl border p-0.5 text-xs shrink-0">
              {(["bn", "en"] as const).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`rounded-lg px-2.5 py-1 font-semibold ${lang === l ? "bg-teal-600 text-white" : "text-muted-foreground"}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border bg-card p-5 shadow-lg shadow-teal-900/5">
            <div className="mb-5 flex gap-1 rounded-2xl bg-muted/80 p-1">
              {(
                [
                  ["login", copy.login],
                  ["register", copy.register],
                ] as const
              ).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
                    mode === m ? "bg-teal-600 text-white shadow" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "register" && (
              <p className="mb-4 rounded-xl bg-teal-50 px-3 py-2 text-xs text-teal-900 dark:bg-teal-950/40 dark:text-teal-100">
                {copy.registerHint}
              </p>
            )}

            <form onSubmit={(e) => void submit(e)} className="space-y-3">
              <Field
                label={lang === "bn" ? "মালিকের মোবাইল" : "Owner mobile"}
                value={phone}
                onChange={(v) => setPhone(clampPhoneDigits(v))}
                inputMode="tel"
                placeholder="01XXXXXXXXX"
                maxLength={11}
                required
              />

              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="PIN"
                  value={pin}
                  onChange={setPin}
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="••••"
                  required
                />
                {mode === "register" ? (
                  <Field
                    label={lang === "bn" ? "PIN নিশ্চিত" : "Confirm PIN"}
                    value={confirmPin}
                    onChange={setConfirmPin}
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="••••"
                    required
                  />
                ) : null}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-3 text-sm font-semibold text-white shadow-lg shadow-teal-900/20 hover:bg-teal-700 disabled:opacity-60"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "login"
                  ? lang === "bn"
                    ? "পোর্টালে প্রবেশ"
                    : "Enter portal"
                  : lang === "bn"
                    ? "অ্যাকাউন্ট তৈরি করুন"
                    : "Create account"}
              </button>
            </form>
          </div>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            {lang === "bn" ? "রক্তদান বা রোগী অ্যাকাউন্ট?" : "Blood donation or patient account?"}{" "}
            <Link to="/auth" search={{}} className="font-semibold text-teal-700 hover:underline">
              {copy.patientLink}
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  inputMode,
  maxLength,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const isPhone = inputMode === "tel";
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      <input
        type={type}
        inputMode={inputMode}
        value={value}
        maxLength={isPhone ? 11 : maxLength}
        onChange={(e) => onChange(isPhone ? clampPhoneDigits(e.target.value) : e.target.value)}
        className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none ring-teal-600/30 focus:ring-2"
        {...rest}
      />
    </div>
  );
}
