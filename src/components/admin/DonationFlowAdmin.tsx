import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_DONATION_FLOW_SETTINGS,
  fetchDonationFlowSettings,
  invalidateDonationFlowSettingsCache,
  saveDonationFlowSettings,
  type DonationFlowSettings,
} from "@/lib/donation-flow-settings";
import { Save } from "lucide-react";
import { toast } from "sonner";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

export function DonationFlowAdmin() {
  const { lang, t } = useI18n();
  const { can } = useAdminAccess();
  const [cfg, setCfg] = useState<DonationFlowSettings>(DEFAULT_DONATION_FLOW_SETTINGS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchDonationFlowSettings(true).then(setCfg);
  }, []);

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
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4 max-w-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {lang === "bn" ? "রক্তদান ফ্লো" : "Donation flow"}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            {lang === "bn"
              ? "Complete-এর পর assign সীমা এবং ‘রক্ত দিতে পারি’ বাটন নিয়ন্ত্রণ।"
              : "Control max assign-after-complete and the “I can donate” button."}
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

      <div>
        <label className="text-[11px] text-slate-400">
          {lang === "bn"
            ? "Complete-এর পর সর্বোচ্চ কতজন assign"
            : "Max donors to assign after Complete"}
        </label>
        <input
          className={ainp}
          type="number"
          min={1}
          max={20}
          value={cfg.max_assigned_donors}
          onChange={(e) =>
            setCfg((p) => ({
              ...p,
              max_assigned_donors: Math.max(1, Math.min(20, Number(e.target.value) || 1)),
            }))
          }
        />
        <p className="text-[10px] text-slate-500 mt-1">
          {lang === "bn" ? "ডিফল্ট ৫ (১–২০)" : "Default 5 (range 1–20)"}
        </p>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5">
        <div>
          <p className="text-sm font-medium">
            {lang === "bn" ? "‘রক্ত দিতে পারি’ বাটন" : "“I can donate” button"}
          </p>
          <p className="text-[10px] text-slate-500 mt-0.5">
            {lang === "bn"
              ? "অফ থাকলে ডোনার সরাসরি ‘আমি দিয়েছি’ → মালিক Confirm"
              : "When off: donors go straight to “I donated” → owner Confirm"}
          </p>
        </div>
        <input
          type="checkbox"
          checked={cfg.enable_i_can_donate}
          onChange={(e) => setCfg((p) => ({ ...p, enable_i_can_donate: e.target.checked }))}
          className="h-4 w-4 accent-rose-500"
        />
      </label>
    </div>
  );
}
