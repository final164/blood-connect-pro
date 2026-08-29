import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { doctorAuthErrorMessage, loginDoctor } from "@/lib/care-doctor-auth";
import { cn } from "@/lib/utils";

export function DoctorAuthPage() {
  const { lang, setLang } = useI18n();
  const bn = lang === "bn";
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await loginDoctor(email, password);
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
        <p className="text-sm text-muted-foreground mb-5">
          {bn ? "ইমেইল ও পাসওয়ার্ড দিয়ে প্রবেশ করুন" : "Sign in with email and password"}
        </p>
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
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
