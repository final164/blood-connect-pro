import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import {
  doctorAuthErrorMessage,
  loginDoctor,
  loginDoctorWithPhonePin,
} from "@/lib/care-doctor-auth";
import { clampPhoneDigits } from "@/lib/phone-auth";
import { cn } from "@/lib/utils";

export function DoctorAuthPage() {
  const { lang, setLang } = useI18n();
  const bn = lang === "bn";
  const navigate = useNavigate();
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "phone") {
        await loginDoctorWithPhonePin(phone, pin);
      } else {
        await loginDoctor(email, password);
      }
      toast.success(bn ? "লগইন সফল" : "Signed in");
      void navigate({ to: "/care/doctor/portal" });
    } catch (err) {
      toast.error(doctorAuthErrorMessage((err as Error).message, lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 via-white to-sky-50/40">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <PageBackButton fallbackTo={{ to: "/care" }} shape="xl" />
          <button
            type="button"
            onClick={() => setLang(bn ? "en" : "bn")}
            className="text-xs font-semibold text-sky-700"
          >
            {bn ? "EN" : "বাং"}
          </button>
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">
          {bn ? "ডাক্তার সাইন ইন" : "Doctor Sign in"}
        </h1>
        <div className="mb-4 flex gap-2 rounded-xl border bg-white p-1">
          <button
            type="button"
            onClick={() => setMode("phone")}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-bold",
              mode === "phone" ? "bg-sky-600 text-white" : "text-muted-foreground",
            )}
          >
            {bn ? "মোবাইল + পিন" : "Phone + PIN"}
          </button>
          <button
            type="button"
            onClick={() => setMode("email")}
            className={cn(
              "flex-1 rounded-lg py-2 text-xs font-bold",
              mode === "email" ? "bg-sky-600 text-white" : "text-muted-foreground",
            )}
          >
            {bn ? "ইমেইল" : "Email"}
          </button>
        </div>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          {mode === "phone" ? (
            <>
              <label className="block space-y-1">
                <span className="text-xs font-semibold">{bn ? "মোবাইল" : "Mobile"}</span>
                <input
                  className={inp}
                  value={phone}
                  onChange={(e) => setPhone(clampPhoneDigits(e.target.value))}
                  inputMode="tel"
                  maxLength={11}
                  required
                  placeholder="01XXXXXXXXX"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold">{bn ? "পিন" : "PIN"}</span>
                <input
                  className={inp}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  inputMode="numeric"
                  maxLength={4}
                  required
                  autoComplete="current-password"
                  placeholder="••••"
                />
              </label>
            </>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-xs font-semibold">{bn ? "ইমেইল" : "Email"}</span>
                <input
                  type="email"
                  className={inp}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-semibold">{bn ? "পাসওয়ার্ড" : "Password"}</span>
                <div className="relative">
                  <input
                    type={showPw ? "text" : "password"}
                    className={cn(inp, "pr-10")}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPw((v) => !v)}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            </>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-sky-600 py-3.5 text-sm font-black uppercase text-white disabled:opacity-60"
          >
            {busy ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : bn ? "সাইন ইন" : "Sign in"}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {bn ? "নতুন ডাক্তার? " : "New doctor? "}
          <Link to="/care/doctor/register" className="font-semibold text-sky-700">
            {bn ? "রেজিস্টার" : "Register"}
          </Link>
        </p>
      </div>
    </div>
  );
}

const inp =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500/30";
