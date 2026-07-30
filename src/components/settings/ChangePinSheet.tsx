import { useEffect, useState } from "react";
import { X, Eye, EyeOff, KeyRound } from "lucide-react";
import { authErrorMessage, changeUserPin, fetchUserPin } from "@/lib/phone-session";
import { toast } from "sonner";

export function ChangePinSheet({
  open,
  onClose,
  userId,
  phone,
  lang,
  t,
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  phone: string;
  lang: "bn" | "en";
  t: (k: string) => string;
}) {
  const [currentPin, setCurrentPin] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingPin, setLoadingPin] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    setNewPin("");
    setConfirmPin("");
    setShowCurrent(false);
    setLoadingPin(true);
    fetchUserPin(userId)
      .then((pin) => setCurrentPin(pin ?? ""))
      .catch(() => setCurrentPin(""))
      .finally(() => setLoadingPin(false));
  }, [open, userId]);

  async function save() {
    if (!currentPin) {
      toast.error(lang === "bn" ? "বর্তমান PIN পাওয়া যায়নি — লগআউট করে আবার লগইন করুন" : "Current PIN not found — log out and sign in again");
      return;
    }
    if (newPin.length !== 4 || confirmPin.length !== 4) {
      toast.error(lang === "bn" ? "৪ সংখ্যার PIN দিন" : "Enter a 4-digit PIN");
      return;
    }
    setBusy(true);
    try {
      await changeUserPin({
        userId,
        phone,
        currentPin,
        newPin,
        confirmPin,
      });
      toast.success(lang === "bn" ? "PIN পরিবর্তন হয়েছে" : "PIN changed");
      onClose();
    } catch (err) {
      toast.error(authErrorMessage((err as Error).message, lang));
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center">
      <button type="button" className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close" />
      <div className="relative bg-background rounded-t-2xl sm:rounded-2xl sm:mx-auto sm:max-w-md w-full shadow-xl safe-bottom">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            <h3 className="font-bold">{lang === "bn" ? "PIN পরিবর্তন" : "Change PIN"}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-full hover:bg-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
              {lang === "bn" ? "বর্তমান PIN" : "Current PIN"}
            </label>
            <div className="flex gap-2">
              <div className="flex-1 rounded-xl border bg-muted/40 px-4 py-3 text-center font-mono text-lg tracking-[0.35em]">
                {loadingPin ? "…" : showCurrent && currentPin ? currentPin : currentPin ? "••••" : "—"}
              </div>
              <button
                type="button"
                onClick={() => setShowCurrent((v) => !v)}
                disabled={!currentPin || loadingPin}
                className="rounded-xl border px-3 hover:bg-muted disabled:opacity-40"
                title={lang === "bn" ? "PIN দেখুন" : "Show PIN"}
              >
                {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <PinInput
            label={lang === "bn" ? "নতুন PIN" : "New PIN"}
            value={newPin}
            onChange={setNewPin}
          />
          <PinInput label={t("confirmPin")} value={confirmPin} onChange={setConfirmPin} />

          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || loadingPin || newPin.length !== 4 || confirmPin.length !== 4}
            className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? t("saving") : lang === "bn" ? "PIN সেভ করুন" : "Save PIN"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PinInput({
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
        autoComplete="new-password"
      />
    </div>
  );
}
