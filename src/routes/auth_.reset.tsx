import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { useI18n } from "@/lib/i18n";
import {
  PASSWORD_MIN,
  emailAuthErrorMessage,
  updatePasswordAfterRecovery,
} from "@/lib/email-auth";

export const Route = createFileRoute("/auth_/reset")({
  head: () => ({
    meta: [
      { title: "Set new password — Muktosheba" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [APP_STYLESHEET],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const bn = lang === "bn";
  const [checking, setChecking] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // The recovery link carries the session in the URL; supabase-js picks it up
    // asynchronously, so listen as well as poll once.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled || !session?.user) return;
      setHasSession(true);
      setChecking(false);
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) setHasSession(true);
      setChecking(false);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await updatePasswordAfterRecovery({ password, confirmPassword: confirm });
      toast.success(bn ? "নতুন পাসওয়ার্ড সেভ হয়েছে" : "New password saved");
      void navigate({ to: "/home" });
    } catch (err) {
      toast.error(emailAuthErrorMessage((err as Error).message, lang));
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <p className="text-base font-semibold">
            {bn ? "লিংকটির মেয়াদ শেষ" : "This link has expired"}
          </p>
          <p className="text-sm text-muted-foreground">
            {bn
              ? "নতুন করে রিসেট ইমেইল পাঠান।"
              : "Request a new password reset email."}
          </p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/auth/forgot" })}
            className="w-full rounded-2xl bg-primary py-3 text-sm font-semibold text-primary-foreground"
          >
            {bn ? "রিসেট ইমেইল পাঠান" : "Send reset email"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-border/80 bg-card/90 p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-lg font-bold">
            {bn ? "নতুন পাসওয়ার্ড দিন" : "Set a new password"}
          </h1>
        </div>

        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <PasswordField
            label={bn ? "নতুন পাসওয়ার্ড" : "New password"}
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
          />
          <PasswordField
            label={bn ? "পাসওয়ার্ড নিশ্চিত করুন" : "Confirm password"}
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
          />
          <p className="text-[11px] text-muted-foreground">
            {bn
              ? `কমপক্ষে ${PASSWORD_MIN} অক্ষর`
              : `At least ${PASSWORD_MIN} characters`}
          </p>
          <button
            type="submit"
            disabled={busy || password.length < PASSWORD_MIN || confirm.length < PASSWORD_MIN}
            className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {bn ? "সেভ করুন" : "Save password"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PasswordField({
  label,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">{label}</label>
      <input
        className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        type="password"
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );
}
