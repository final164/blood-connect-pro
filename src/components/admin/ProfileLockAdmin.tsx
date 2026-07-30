import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_PROFILE_LOCK_SETTINGS,
  fetchProfileLockSettings,
  invalidateProfileLockSettingsCache,
  saveProfileLockSettings,
  PROFILE_LOCK_FIELDS,
  PROFILE_LOCK_FIELD_META,
  type ProfileLockSettings,
} from "@/lib/profile-lock";
import { Save } from "lucide-react";
import { toast } from "sonner";

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

export function ProfileLockAdmin() {
  const { lang, t } = useI18n();
  const { can } = useAdminAccess();
  const [cfg, setCfg] = useState<ProfileLockSettings>(DEFAULT_PROFILE_LOCK_SETTINGS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchProfileLockSettings(true).then(setCfg);
  }, []);

  async function save() {
    if (!can("settings.edit")) {
      toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
      return;
    }
    setBusy(true);
    const { error } = await saveProfileLockSettings(cfg);
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      invalidateProfileLockSettingsCache();
      toast.success(t("saved"));
    }
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "প্রোফাইল লক — লুকানো ফিল্ড" : "Profile lock — hidden fields"}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {lang === "bn"
            ? "ইউজার প্রোফাইল লক করলে নিচের চেক করা ফিল্ডগুলো অন্য ইউজারদের কাছে দেখা যাবে না।"
            : "When a user locks their profile, checked fields below are hidden from other users."}
        </p>
      </div>

      <ul className="space-y-2">
        {PROFILE_LOCK_FIELDS.map((key) => {
          const meta = PROFILE_LOCK_FIELD_META[key];
          return (
            <li key={key}>
              <ToggleRow
                title={lang === "bn" ? meta.bn : meta.en}
                hint={lang === "bn" ? meta.hint_bn : meta.hint_en}
                checked={!!cfg[key]}
                onChange={(v) => setCfg((p) => ({ ...p, [key]: v }))}
              />
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 text-white px-4 py-2.5 text-sm font-semibold disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {busy ? t("saving") : t("save")}
      </button>
    </div>
  );
}
