import { clampPhoneDigits } from "@/lib/phone-auth";

/** BD mobile input with a live 11-digit counter. Shared by /auth and /onboarding. */
export function PhoneField({
  label,
  value,
  onChange,
  lang,
  readOnly,
  required = true,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  lang: "bn" | "en";
  readOnly?: boolean;
  required?: boolean;
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
        required={required}
        onChange={(e) => onChange(clampPhoneDigits(e.target.value))}
        onPaste={(e) => {
          e.preventDefault();
          const text = e.clipboardData.getData("text") || "";
          onChange(clampPhoneDigits(text));
        }}
        onKeyDown={(e) => {
          if (
            e.ctrlKey ||
            e.metaKey ||
            e.altKey ||
            [
              "Backspace",
              "Delete",
              "Tab",
              "Enter",
              "ArrowLeft",
              "ArrowRight",
              "Home",
              "End",
            ].includes(e.key)
          ) {
            return;
          }
          if (!/^\d$/.test(e.key)) {
            e.preventDefault();
            return;
          }
          if (value.replace(/\D/g, "").length >= 11) {
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
