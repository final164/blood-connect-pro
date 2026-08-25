import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import {
  DEFAULT_CARE_INVOICE_SETTINGS,
  fetchCareInvoiceSettings,
  invoiceLabel,
  normalizeCareInvoiceSettings,
  saveCareInvoiceSettings,
  type CareInvoiceLabelKey,
  type CareInvoiceSettings,
  type CareInvoiceStyle,
  type CareInvoiceVisibility,
} from "@/lib/care-invoice-settings";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

const COMMON_LABEL_KEYS: CareInvoiceLabelKey[] = [
  "title",
  "reg_no",
  "lab_id",
  "date",
  "age",
  "sex",
  "patient_name",
  "address",
  "mobile",
  "refd_by",
  "total",
  "discount",
  "vat",
  "payable",
  "received",
  "due",
  "delivery_time",
  "signature",
  "thanks",
  "disclaimer",
  "developed_by",
  "print_datetime",
  "page_of",
];

const LAB_TABLE_LABEL_KEYS: CareInvoiceLabelKey[] = [
  "col_sl",
  "col_test_id",
  "col_test_name",
  "col_delivery",
  "col_amount",
  "col_discount",
];

const SERIAL_COLUMN_LABEL_KEYS: CareInvoiceLabelKey[] = [
  "col_serial_sl",
  "col_serial_no",
  "col_serial_doctor",
  "col_serial_specialty",
  "col_serial_date",
  "col_serial_time",
  "col_serial_fee",
  "col_serial_discount",
];

const SERIAL_TABLE_LABEL_KEYS: CareInvoiceLabelKey[] = [
  "serial_claim_code",
  ...SERIAL_COLUMN_LABEL_KEYS,
  "serial_bmdc",
  "serial_qualifications",
  "serial_chamber",
];

const STYLE_KEYS: (keyof CareInvoiceStyle)[] = [
  "show_logo",
  "show_vat",
  "show_received_due",
  "show_delivery_slots",
  "show_signature",
  "show_developer",
  "show_print_datetime",
  "dense_meta",
];

const VIS_KEYS: (keyof CareInvoiceVisibility)[] = [
  "reg_no",
  "lab_id",
  "age",
  "sex",
  "address",
  "refd_by",
];

export function CareInvoiceAdmin({ canEdit, lang }: { canEdit: boolean; lang: "bn" | "en" }) {
  const [cfg, setCfg] = useState<CareInvoiceSettings>(DEFAULT_CARE_INVOICE_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [previewKind, setPreviewKind] = useState<"lab" | "serial">("lab");

  useEffect(() => {
    void fetchCareInvoiceSettings(true).then(setCfg);
  }, []);

  async function save() {
    setBusy(true);
    try {
      const next = await saveCareInvoiceSettings(cfg);
      setCfg(next);
      toast.success(lang === "bn" ? "ইনভয়েস সেটিংস সেভ" : "Invoice settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const styleLabel: Record<keyof CareInvoiceStyle, { bn: string; en: string }> = {
    show_logo: { bn: "লোগো দেখাও", en: "Show logo" },
    show_vat: { bn: "ভ্যাট দেখাও", en: "Show VAT" },
    show_received_due: { bn: "গৃহীত / বাকি দেখাও", en: "Show received / due" },
    show_delivery_slots: { bn: "ডেলিভারি স্লট চেকবক্স", en: "Delivery slot checkboxes" },
    show_signature: { bn: "স্বাক্ষর লাইন", en: "Signature line" },
    show_developer: { bn: "ডেভেলপার ক্রেডিট", en: "Developer credit" },
    show_print_datetime: { bn: "প্রিন্ট তারিখ/সময়", en: "Print date/time" },
    dense_meta: { bn: "কম্প্যাক্ট মেটা গ্রিড", en: "Dense meta grid" },
    font_scale: { bn: "ফন্ট স্কেল", en: "Font scale" },
  };

  return (
    <div className="space-y-4 max-w-3xl">
      <p className="text-xs text-slate-400">
        {lang === "bn"
          ? "ক্যাশ মেমো / বিল — প্ল্যাটফর্ম ডিফল্ট। ক্লিনিক letterhead ওভাররাইড করতে পারে।"
          : "Cash Memo / Bill — platform defaults. Clinics may override letterhead."}
      </p>

      <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-[11px] text-slate-300 space-y-2">
        <p className="font-bold text-slate-100">{invoiceLabel(cfg, "title", lang)}</p>
        <p className="text-slate-500">
          {lang === "bn" ? "প্রিভিউ টাইটেল · সেভের পর ইনভয়েসে দেখা যাবে" : "Title preview · applies after save"}
        </p>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-slate-500">{lang === "bn" ? "টেবিল হেডার:" : "Table headers:"}</span>
          <button
            type="button"
            onClick={() => setPreviewKind("lab")}
            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
              previewKind === "lab" ? "bg-teal-700 text-white" : "bg-slate-800 text-slate-400"
            }`}
          >
            Lab
          </button>
          <button
            type="button"
            onClick={() => setPreviewKind("serial")}
            className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
              previewKind === "serial" ? "bg-teal-700 text-white" : "bg-slate-800 text-slate-400"
            }`}
          >
            Serial
          </button>
        </div>
        <div className="overflow-x-auto rounded border border-slate-700/80 bg-slate-900/60">
          <table className="w-full text-[10px] text-slate-200">
            <thead>
              <tr className="border-b border-slate-700 text-teal-300">
                {(previewKind === "lab" ? LAB_TABLE_LABEL_KEYS : SERIAL_COLUMN_LABEL_KEYS).map((k) => (
                  <th key={k} className="px-2 py-1 text-left font-semibold whitespace-nowrap">
                    {invoiceLabel(cfg, k, lang)}
                  </th>
                ))}
              </tr>
            </thead>
          </table>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
          {lang === "bn" ? "স্টাইল / সেকশন" : "Style / sections"}
        </h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {STYLE_KEYS.map((k) => (
            <label key={k} className="flex items-center justify-between gap-2 text-xs text-slate-200">
              <span>{lang === "bn" ? styleLabel[k].bn : styleLabel[k].en}</span>
              <input
                type="checkbox"
                checked={cfg.style[k] === true}
                disabled={!canEdit}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, style: { ...p.style, [k]: e.target.checked } }))
                }
              />
            </label>
          ))}
          <label className="flex items-center justify-between gap-2 text-xs text-slate-200">
            <span>{lang === "bn" ? styleLabel.font_scale.bn : styleLabel.font_scale.en}</span>
            <input
              className={ainp + " w-20"}
              type="number"
              step="0.05"
              min={0.8}
              max={1.4}
              disabled={!canEdit}
              value={cfg.style.font_scale}
              onChange={(e) =>
                setCfg((p) =>
                  normalizeCareInvoiceSettings({
                    ...p,
                    style: { ...p.style, font_scale: Number(e.target.value) },
                  }),
                )
              }
            />
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
          {lang === "bn" ? "ডিফল্ট" : "Defaults"}
        </h3>
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="text-xs text-slate-200 space-y-1">
            <span>{lang === "bn" ? "ভ্যাট %" : "VAT %"}</span>
            <input
              className={ainp}
              type="number"
              min={0}
              max={100}
              disabled={!canEdit}
              value={cfg.defaults.vat_percent}
              onChange={(e) =>
                setCfg((p) =>
                  normalizeCareInvoiceSettings({
                    ...p,
                    defaults: { ...p.defaults, vat_percent: Number(e.target.value) },
                  }),
                )
              }
            />
          </label>
          <label className="text-xs text-slate-200 space-y-1">
            <span>{lang === "bn" ? "মুদ্রা প্রিফিক্স" : "Currency prefix"}</span>
            <input
              className={ainp}
              disabled={!canEdit}
              value={cfg.defaults.currency_prefix}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  defaults: { ...p.defaults, currency_prefix: e.target.value },
                }))
              }
            />
          </label>
          <label className="text-xs text-slate-200 space-y-1 sm:col-span-2">
            <span>{lang === "bn" ? "ডেলিভারি স্লট (কমা দিয়ে)" : "Delivery slots (comma-separated)"}</span>
            <input
              className={ainp}
              disabled={!canEdit}
              value={cfg.defaults.delivery_slot_labels.join(", ")}
              onChange={(e) =>
                setCfg((p) =>
                  normalizeCareInvoiceSettings({
                    ...p,
                    defaults: {
                      ...p.defaults,
                      delivery_slot_labels: e.target.value.split(","),
                    },
                  }),
                )
              }
            />
          </label>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
          {lang === "bn" ? "মেটা ভিজিবিলিটি" : "Meta visibility"}
        </h3>
        <div className="grid sm:grid-cols-3 gap-2">
          {VIS_KEYS.map((k) => (
            <label key={k} className="flex items-center justify-between gap-2 text-xs text-slate-200">
              <span>{k}</span>
              <input
                type="checkbox"
                checked={cfg.visibility[k]}
                disabled={!canEdit}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, visibility: { ...p.visibility, [k]: e.target.checked } }))
                }
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
          {lang === "bn" ? "লেবেল (বাংলা / English)" : "Labels (Bangla / English)"}
        </h3>
        <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
          {COMMON_LABEL_KEYS.map((k) => (
            <div key={k} className="grid sm:grid-cols-[7rem_1fr_1fr] gap-1 items-center">
              <span className="text-[10px] text-slate-500 font-mono">{k}</span>
              <input
                className={ainp}
                disabled={!canEdit}
                value={cfg.labels[k].bn}
                onChange={(e) =>
                  setCfg((p) => ({
                    ...p,
                    labels: { ...p.labels, [k]: { ...p.labels[k], bn: e.target.value } },
                  }))
                }
                placeholder="bn"
              />
              <input
                className={ainp}
                disabled={!canEdit}
                value={cfg.labels[k].en}
                onChange={(e) =>
                  setCfg((p) => ({
                    ...p,
                    labels: { ...p.labels, [k]: { ...p.labels[k], en: e.target.value } },
                  }))
                }
                placeholder="en"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
          {lang === "bn" ? "ল্যাব টেবিল" : "Lab table"}
        </h3>
        <div className="space-y-2 max-h-[16rem] overflow-y-auto pr-1">
          {LAB_TABLE_LABEL_KEYS.map((k) => (
            <div key={k} className="grid sm:grid-cols-[7rem_1fr_1fr] gap-1 items-center">
              <span className="text-[10px] text-slate-500 font-mono">{k}</span>
              <input
                className={ainp}
                disabled={!canEdit}
                value={cfg.labels[k].bn}
                onChange={(e) =>
                  setCfg((p) => ({
                    ...p,
                    labels: { ...p.labels, [k]: { ...p.labels[k], bn: e.target.value } },
                  }))
                }
                placeholder="bn"
              />
              <input
                className={ainp}
                disabled={!canEdit}
                value={cfg.labels[k].en}
                onChange={(e) =>
                  setCfg((p) => ({
                    ...p,
                    labels: { ...p.labels, [k]: { ...p.labels[k], en: e.target.value } },
                  }))
                }
                placeholder="en"
              />
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wide">
          {lang === "bn" ? "সিরিয়াল টেবিল (ডাক্তার)" : "Serial table (doctor)"}
        </h3>
        <div className="space-y-2 max-h-[20rem] overflow-y-auto pr-1">
          {SERIAL_TABLE_LABEL_KEYS.map((k) => (
            <div key={k} className="grid sm:grid-cols-[7rem_1fr_1fr] gap-1 items-center">
              <span className="text-[10px] text-slate-500 font-mono">{k}</span>
              <input
                className={ainp}
                disabled={!canEdit}
                value={cfg.labels[k].bn}
                onChange={(e) =>
                  setCfg((p) => ({
                    ...p,
                    labels: { ...p.labels, [k]: { ...p.labels[k], bn: e.target.value } },
                  }))
                }
                placeholder="bn"
              />
              <input
                className={ainp}
                disabled={!canEdit}
                value={cfg.labels[k].en}
                onChange={(e) =>
                  setCfg((p) => ({
                    ...p,
                    labels: { ...p.labels, [k]: { ...p.labels[k], en: e.target.value } },
                  }))
                }
                placeholder="en"
              />
            </div>
          ))}
        </div>
      </section>

      {canEdit && (
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {lang === "bn" ? "সেভ ইনভয়েস" : "Save invoice"}
        </button>
      )}
    </div>
  );
}
