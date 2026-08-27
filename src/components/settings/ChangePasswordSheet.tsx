import { useEffect, useState } from "react";
import { KeyRound, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PASSWORD_MIN, emailAuthErrorMessage, isValidPassword } from "@/lib/email-auth";

/**
 * Change (or first-time set) the account password.
 * Google-only accounts have no password yet, so the current-password step is skipped.
 */
export function ChangePasswordSheet({
  open,
  onClose,
  email,
  hasPassword,
  lang,
  t,
}: {
  open: boolean;
  onClose: () => void;
  email: string;
  hasPassword: boolean;
  lang: "bn" | "en";
  t: (k: string) => string;
}) {
  const bn = lang === "bn";
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  }, [open]);

  async function save() {
    if (!isValidPassword(newPassword)) {
      toast.error(emailAuthErrorMessage("WEAK_PASSWORD", lang));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(emailAuthErrorMessage("PASSWORDS_DO_NOT_MATCH", lang));
      return;
    }

    setBusy(true);
    try {
      // Supabase does not verify the old password on updateUser, so re-authenticate
      // first to stop a hijacked session from silently taking over the account.
      if (hasPassword) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: currentPassword,
        });
        if (error) {
          toast.error(bn ? "বর্তমান পাসওয়ার্ড ভুল" : "Current password is wrong");
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      toast.success(bn ? "পাসওয়ার্ড পরিবর্তন হয়েছে" : "Password changed");
      onClose();
    } catch (err) {
      toast.error(emailAuthErrorMessage((err as Error).message, lang));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  const ready =
    newPassword.length >= PASSWORD_MIN &&
    confirmPassword.length >= PASSWORD_MIN &&
    (!hasPassword || currentPassword.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-label="Close"
      />
      <div className="relative bg-background rounded-t-2xl sm:rounded-2xl sm:mx-auto sm:max-w-md w-full shadow-xl safe-bottom">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h3 className="font-bold">
              {hasPassword
                ? bn
                  ? "পাসওয়ার্ড পরিবর্তন"
                  : "Change password"
                : bn
                  ? "পাসওয়ার্ড সেট করুন"
                  : "Set a password"}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {!hasPassword && (
            <p className="rounded-xl bg-muted/50 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              {bn
                ? "আপনি Google দিয়ে ঢুকেছেন। পাসওয়ার্ড সেট করলে ইমেইল দিয়েও লগইন করতে পারবেন।"
                : "You signed in with Google. Setting a password lets you also log in with your email."}
            </p>
          )}

          {hasPassword && (
            <PasswordInput
              label={bn ? "বর্তমান পাসওয়ার্ড" : "Current password"}
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
          )}
          <PasswordInput
            label={bn ? "নতুন পাসওয়ার্ড" : "New password"}
            value={newPassword}
            onChange={setNewPassword}
            autoComplete="new-password"
          />
          <PasswordInput
            label={bn ? "পাসওয়ার্ড নিশ্চিত করুন" : "Confirm password"}
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
          <p className="text-[11px] text-muted-foreground">
            {bn ? `কমপক্ষে ${PASSWORD_MIN} অক্ষর` : `At least ${PASSWORD_MIN} characters`}
          </p>

          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !ready}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? t("saving") : bn ? "সেভ করুন" : "Save password"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordInput({
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
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
