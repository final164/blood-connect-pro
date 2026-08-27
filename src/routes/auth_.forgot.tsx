import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { useI18n } from "@/lib/i18n";
import { emailAuthErrorMessage, isValidEmail, sendPasswordResetEmail } from "@/lib/email-auth";
import { signInWithGoogle } from "@/lib/google-auth";
import { GoogleButton } from "@/components/auth/GoogleButton";

export const Route = createFileRoute("/auth_/forgot")({
  head: () => ({
    meta: [
      { title: "Reset password — Muktosheba" },
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [APP_STYLESHEET],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const bn = lang === "bn";
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await sendPasswordResetEmail(email, `${window.location.origin}/auth/reset`);
      setSent(true);
    } catch (err) {
      toast.error(emailAuthErrorMessage((err as Error).message, lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-sm">
        <button
          type="button"
          onClick={() => void navigate({ to: "/auth", search: { next: undefined } })}
          className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {bn ? "লগইনে ফিরে যান" : "Back to login"}
        </button>

        {sent ? (
          <div className="rounded-3xl border border-border/80 bg-card/90 p-6 text-center space-y-3">
            <MailCheck className="mx-auto h-9 w-9 text-primary" />
            <h1 className="text-lg font-bold">{bn ? "ইমেইল পাঠানো হয়েছে" : "Email sent"}</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {bn
                ? "আপনার ইনবক্স দেখুন — পাসওয়ার্ড বদলানোর একটি লিংক পাঠানো হয়েছে। স্প্যাম ফোল্ডারও দেখে নিন।"
                : "Check your inbox for a link to set a new password. Look in spam too."}
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="text-xs text-primary underline-offset-2 hover:underline"
            >
              {bn ? "অন্য ইমেইলে পাঠান" : "Send to a different email"}
            </button>
          </div>
        ) : (
          <div className="rounded-3xl border border-border/80 bg-card/90 p-6 space-y-4">
            <div>
              <h1 className="text-lg font-bold">
                {bn ? "পাসওয়ার্ড ভুলে গেছেন?" : "Forgot your password?"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {bn
                  ? "আপনার ইমেইল দিন — পাসওয়ার্ড বদলানোর লিংক পাঠাব।"
                  : "Enter your email and we'll send you a reset link."}
              </p>
            </div>

            <form onSubmit={(e) => void submit(e)} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                  {bn ? "ইমেইল" : "Email"}
                </label>
                <input
                  className="w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={busy || !isValidEmail(email)}
                className="w-full rounded-2xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                {bn ? "রিসেট লিংক পাঠান" : "Send reset link"}
              </button>
            </form>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {bn
                ? "ইমেইল না এলে Google দিয়েও ঢুকতে পারেন — একই ইমেইল হলে সেটিই আপনার অ্যাকাউন্ট।"
                : "If the email doesn't arrive, you can also continue with Google using the same address."}
            </p>
            <GoogleButton
              label={bn ? "Google দিয়ে চালিয়ে যান" : "Continue with Google"}
              onClick={() => signInWithGoogle()}
            />
          </div>
        )}
      </div>
    </div>
  );
}
