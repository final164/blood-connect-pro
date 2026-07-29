import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_DONATION_FLOW_SETTINGS,
  fetchDonationFlowSettings,
  invalidateDonationFlowSettingsCache,
  saveDonationFlowSettings,
  type DonationFlowLabels,
  type DonationFlowSettings,
  type LangPair,
} from "@/lib/donation-flow-settings";
import { Save } from "lucide-react";
import { toast } from "sonner";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

const LABEL_META: { key: keyof DonationFlowLabels; bn: string; en: string }[] = [
  { key: "progress_title", bn: "অগ্রগতি শিরোনাম", en: "Progress title" },
  { key: "i_can_donate", bn: "রক্ত দিতে পারি", en: "I can donate" },
  { key: "i_donated", bn: "আমি দিয়েছি", en: "I donated" },
  { key: "confirm", bn: "কনফার্ম", en: "Confirm" },
  { key: "reject", bn: "বাতিল / Reject", en: "Reject" },
  { key: "assign", bn: "Assign", en: "Assign" },
  { key: "complete_menu", bn: "Complete মেনু", en: "Complete menu" },
  { key: "finish", bn: "সম্পন্ন করুন", en: "Finish & fulfill" },
  { key: "waiting_confirm", bn: "অপেক্ষা টেক্সট", en: "Waiting text" },
  { key: "reopen_assign", bn: "Assign আবার খোলা", en: "Reopen assign" },
];

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-rose-500 shrink-0"
      />
    </label>
  );
}

export function DonationFlowAdmin() {
  const { lang, t } = useI18n();
  const { can } = useAdminAccess();
  const [cfg, setCfg] = useState<DonationFlowSettings>(DEFAULT_DONATION_FLOW_SETTINGS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchDonationFlowSettings(true).then(setCfg);
  }, []);

  function setFlag<K extends keyof DonationFlowSettings>(key: K, value: DonationFlowSettings[K]) {
    setCfg((p) => ({ ...p, [key]: value }));
  }

  function setLabel(key: keyof DonationFlowLabels, side: keyof LangPair, value: string) {
    setCfg((p) => ({
      ...p,
      labels: {
        ...p.labels,
        [key]: { ...p.labels[key], [side]: value },
      },
    }));
  }

  async function save() {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    setBusy(true);
    const { error, settings } = await saveDonationFlowSettings(cfg);
    setBusy(false);
    if (error) {
      if (/donation_flow_settings|column/i.test(error.message)) {
        return toast.error(
          lang === "bn"
            ? "আগে scripts/donation-flow-settings.sql চালান"
            : "Run scripts/donation-flow-settings.sql first",
        );
      }
      return toast.error(error.message);
    }
    setCfg(settings);
    invalidateDonationFlowSettingsCache();
    toast.success(t("saved"));
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-5 max-w-2xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {lang === "bn" ? "রক্তদান ফ্লো" : "Donation flow"}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {lang === "bn"
              ? "Progress, Assign, Confirm, বাটন ও লেবেল — সব এখান থেকে ম্যানেজ করুন।"
              : "Manage progress, assign, confirm, buttons, and labels."}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {t("save")}
        </button>
      </div>

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {lang === "bn" ? "সীমা" : "Limits"}
        </h4>
        <div>
          <label className="text-[11px] text-slate-400">
            {lang === "bn"
              ? "সর্বোচ্চ নিশ্চিত ডোনার (assign + confirm)"
              : "Max confirmed donors (assign + confirm)"}
          </label>
          <input
            className={ainp}
            type="number"
            min={1}
            max={20}
            value={cfg.max_assigned_donors}
            onChange={(e) =>
              setFlag(
                "max_assigned_donors",
                Math.max(1, Math.min(20, Number(e.target.value) || 1)),
              )
            }
          />
          <p className="text-[10px] text-slate-500 mt-1">
            {lang === "bn" ? "ডিফল্ট ৫ (১–২০)" : "Default 5 (range 1–20)"}
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {lang === "bn" ? "ফিচার টগল" : "Feature toggles"}
        </h4>
        <ToggleRow
          title={lang === "bn" ? "Progress দেখান" : "Show progress"}
          hint={
            lang === "bn"
              ? "ব্যাগ কাউন্ট ও প্রগ্রেস বার"
              : "Bag counts and progress bar"
          }
          checked={cfg.show_progress}
          onChange={(v) => setFlag("show_progress", v)}
        />
        <ToggleRow
          title={lang === "bn" ? "Assign চালু" : "Enable assign"}
          hint={
            lang === "bn"
              ? "Complete-এর পর owner ডোনার assign করতে পারবে"
              : "Owner can assign donors after Complete"
          }
          checked={cfg.enable_assign}
          onChange={(v) => setFlag("enable_assign", v)}
        />
        <ToggleRow
          title={lang === "bn" ? "Confirm / Reject চালু" : "Enable confirm / reject"}
          hint={
            lang === "bn"
              ? "‘আমি দিয়েছি’ দাবি মালিক কনফার্ম করতে পারবে"
              : "Owner can confirm or reject “I donated” claims"
          }
          checked={cfg.enable_confirm}
          onChange={(v) => setFlag("enable_confirm", v)}
        />
        <ToggleRow
          title={lang === "bn" ? "‘রক্ত দিতে পারি’ বাটন" : "“I can donate” button"}
          hint={
            lang === "bn"
              ? "অফ থাকলে আগ্রহ ধাপ ছাড়া সরাসরি দাবি (যদি I donated চালু থাকে)"
              : "When off: skip interest; use direct claim if I donated is on"
          }
          checked={cfg.enable_i_can_donate}
          onChange={(v) => setFlag("enable_i_can_donate", v)}
        />
        <ToggleRow
          title={lang === "bn" ? "‘আমি দিয়েছি’ বাটন" : "“I donated” button"}
          hint={
            lang === "bn"
              ? "ডোনার দান দাবি করতে পারবে কিনা"
              : "Whether donors can claim a donation"
          }
          checked={cfg.enable_i_donated}
          onChange={(v) => setFlag("enable_i_donated", v)}
        />
        <ToggleRow
          title={
            lang === "bn"
              ? "আগে Complete খুলতে হবে"
              : "Require Complete before claim"
          }
          hint={
            lang === "bn"
              ? "চালু থাকলে owner Complete করার পরই ‘আমি দিয়েছি’ আসবে"
              : "When on, “I donated” unlocks only after owner starts Complete"
          }
          checked={cfg.require_complete_first}
          onChange={(v) => setFlag("require_complete_first", v)}
        />
      </section>

      <section className="space-y-3">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {lang === "bn" ? "লেবেল (বাংলা / English)" : "Labels (Bangla / English)"}
        </h4>
        {LABEL_META.map((meta) => (
          <div key={meta.key} className="space-y-1">
            <p className="text-[11px] text-slate-400">
              {lang === "bn" ? meta.bn : meta.en}
            </p>
            <div className="grid sm:grid-cols-2 gap-2">
              <input
                className={ainp}
                value={cfg.labels[meta.key].bn}
                onChange={(e) => setLabel(meta.key, "bn", e.target.value)}
                placeholder="bn"
              />
              <input
                className={ainp}
                value={cfg.labels[meta.key].en}
                onChange={(e) => setLabel(meta.key, "en", e.target.value)}
                placeholder="en"
              />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
