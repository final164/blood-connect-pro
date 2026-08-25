import type { CareOrgInvoiceSettings } from "@/lib/care-invoice-settings";

type Props = {
  lang: "bn" | "en";
  value: CareOrgInvoiceSettings;
  onChange: (next: CareOrgInvoiceSettings) => void;
  disabled?: boolean;
  variant?: "desk" | "admin";
};

/** Clinic letterhead overrides for Cash Memo invoices. */
export function CareInvoiceLetterheadForm({
  lang,
  value,
  onChange,
  disabled,
  variant = "desk",
}: Props) {
  const labelCls = variant === "admin" ? "text-xs text-slate-200" : "text-sm text-foreground";
  const hintCls = variant === "admin" ? "text-[10px] text-slate-500" : "text-[10px] text-muted-foreground";
  const boxCls =
    variant === "admin"
      ? "rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-3"
      : "rounded-2xl border bg-card p-3 space-y-3";
  const inp =
    variant === "admin"
      ? "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none"
      : "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30";

  return (
    <div className={boxCls}>
      <div>
        <p className={`font-semibold ${labelCls}`}>
          {lang === "bn" ? "ইনভয়েস লেটারহেড" : "Invoice letterhead"}
        </p>
        <p className={hintCls}>
          {lang === "bn"
            ? "ক্যাশ মেমো হেডার — খালি রাখলে অর্গ প্রোফাইল ব্যবহার হবে।"
            : "Cash Memo header — leave blank to use org profile."}
        </p>
      </div>
      <label className={`block space-y-1 ${labelCls}`}>
        <span>{lang === "bn" ? "লোগো URL" : "Logo URL"}</span>
        <input
          className={inp}
          disabled={disabled}
          value={value.logo_url ?? ""}
          onChange={(e) => onChange({ ...value, logo_url: e.target.value || null })}
        />
      </label>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className={`block space-y-1 ${labelCls}`}>
          <span>{lang === "bn" ? "ডিসপ্লে নাম" : "Display name"}</span>
          <input
            className={inp}
            disabled={disabled}
            value={value.display_name ?? ""}
            onChange={(e) => onChange({ ...value, display_name: e.target.value || null })}
          />
        </label>
        <label className={`block space-y-1 ${labelCls}`}>
          <span>{lang === "bn" ? "নাম (বাংলা)" : "Name (Bangla)"}</span>
          <input
            className={inp}
            disabled={disabled}
            value={value.display_name_bn ?? ""}
            onChange={(e) => onChange({ ...value, display_name_bn: e.target.value || null })}
          />
        </label>
      </div>
      <label className={`block space-y-1 ${labelCls}`}>
        <span>{lang === "bn" ? "ঠিকানা" : "Address"}</span>
        <input
          className={inp}
          disabled={disabled}
          value={value.address ?? ""}
          onChange={(e) => onChange({ ...value, address: e.target.value || null })}
        />
      </label>
      <label className={`block space-y-1 ${labelCls}`}>
        <span>{lang === "bn" ? "ফোন (কমা দিয়ে)" : "Phones (comma-separated)"}</span>
        <input
          className={inp}
          disabled={disabled}
          value={(value.phones ?? []).join(", ")}
          onChange={(e) =>
            onChange({
              ...value,
              phones: e.target.value
                .split(",")
                .map((p) => p.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
      <label className={`block space-y-1 ${labelCls}`}>
        <span>Email</span>
        <input
          className={inp}
          disabled={disabled}
          value={value.email ?? ""}
          onChange={(e) => onChange({ ...value, email: e.target.value || null })}
        />
      </label>
      <label className={`block space-y-1 ${labelCls}`}>
        <span>{lang === "bn" ? "ভ্যাট % (ওভাররাইড)" : "VAT % (override)"}</span>
        <input
          className={inp}
          type="number"
          min={0}
          max={100}
          disabled={disabled}
          value={value.vat_percent ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              vat_percent: e.target.value === "" ? undefined : Number(e.target.value),
            })
          }
        />
      </label>
      <label className={`block space-y-1 ${labelCls}`}>
        <span>{lang === "bn" ? "ডিসক্লেইমার (বাংলা)" : "Disclaimer (Bangla)"}</span>
        <textarea
          className={inp}
          rows={2}
          disabled={disabled}
          value={value.disclaimer_bn ?? ""}
          onChange={(e) => onChange({ ...value, disclaimer_bn: e.target.value || null })}
        />
      </label>
      <label className={`block space-y-1 ${labelCls}`}>
        <span>{lang === "bn" ? "স্বাক্ষর লেবেল" : "Signature label"}</span>
        <input
          className={inp}
          disabled={disabled}
          value={value.signature_en ?? value.signature_bn ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              signature_en: e.target.value || null,
              signature_bn: e.target.value || null,
            })
          }
        />
      </label>
    </div>
  );
}
