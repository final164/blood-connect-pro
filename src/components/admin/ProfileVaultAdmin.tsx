import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_PROFILE_VAULT_SETTINGS,
  fetchProfileVaultSettings,
  saveProfileVaultSettings,
  type ProfileVaultSettings,
} from "@/lib/profile-vault-settings";
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

export function ProfileVaultAdmin() {
  const { lang, t } = useI18n();
  const { can } = useAdminAccess();
  const [cfg, setCfg] = useState<ProfileVaultSettings>(DEFAULT_PROFILE_VAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const bn = lang === "bn";

  useEffect(() => {
    fetchProfileVaultSettings(true).then(setCfg).catch(() => setCfg(DEFAULT_PROFILE_VAULT_SETTINGS));
  }, []);

  function setFlag<K extends keyof ProfileVaultSettings>(key: K, value: ProfileVaultSettings[K]) {
    setCfg((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!can("settings.edit")) {
      toast.error(bn ? "অনুমতি নেই" : "No permission");
      return;
    }
    setBusy(true);
    const { error } = await saveProfileVaultSettings(cfg);
    setBusy(false);
    if (error) {
      const missing = /profile_vault_settings|column/i.test(error.message);
      toast.error(
        missing
          ? bn
            ? "কলাম নেই। Supabase-এ 20261021121000_profile_vault_settings.sql চালান।"
            : "Column missing. Run 20261021121000_profile_vault_settings.sql in Supabase."
          : error.message,
      );
      return;
    }
    toast.success(t("saved"));
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4 max-w-2xl">
      <div>
        <h3 className="text-sm font-semibold">
          {bn ? "প্রোফাইল লাইফ নেটওয়ার্ক" : "Profile life network"}
        </h3>
        <p className="text-xs text-slate-400 mt-1">
          {bn
            ? "প্রোফাইলে কাচের ভল্ট, ভাসমান ছবি, হার্টবিট ও সার্কিট — সব এখান থেকে চালু বা বন্ধ।"
            : "Glass vault, floating photos, heartbeat and circuit on profiles — all toggled here."}
        </p>
      </div>

      <ul className="space-y-2">
        <li>
          <ToggleRow
            title={bn ? "নেটওয়ার্ক চালু" : "Network on"}
            hint={bn ? "বন্ধ করলে প্রোফাইলে ভল্ট দেখাবে না" : "Off hides the vault on every profile"}
            checked={cfg.enabled}
            onChange={(v) => setFlag("enabled", v)}
          />
        </li>
        <li>
          <ToggleRow
            title={bn ? "নিজের প্রোফাইলে" : "On own profile"}
            hint={bn ? "ইউজার নিজের প্রোফাইল খুললে" : "When someone opens their own profile"}
            checked={cfg.show_on_own}
            onChange={(v) => setFlag("show_on_own", v)}
          />
        </li>
        <li>
          <ToggleRow
            title={bn ? "অন্যের প্রোফাইলে" : "On public profiles"}
            hint={bn ? "অন্য ইউজারের প্রোফাইল দেখলে" : "When viewing someone else's profile"}
            checked={cfg.show_on_public}
            onChange={(v) => setFlag("show_on_public", v)}
          />
        </li>
        <li>
          <ToggleRow
            title={bn ? "প্রোফাইল ছবি" : "Profile photo"}
            hint={bn ? "অ্যাভাটার কার্ডে ব্যবহার হবে" : "Avatar fills the floating cards"}
            checked={cfg.use_avatar}
            onChange={(v) => setFlag("use_avatar", v)}
          />
        </li>
        <li>
          <ToggleRow
            title={bn ? "পোস্টের ছবি" : "Post photos"}
            hint={bn ? "সাম্প্রতিক পোস্ট ভল্টে আসবে" : "Recent posts appear in the vault"}
            checked={cfg.use_post_photos}
            onChange={(v) => setFlag("use_post_photos", v)}
          />
        </li>
        <li>
          <ToggleRow
            title={bn ? "রক্তের রিকোয়েস্ট" : "Blood requests"}
            hint={bn ? "নিজের রিকোয়েস্টের ছবি বা গ্রুপ" : "Their request photos or blood group"}
            checked={cfg.use_requests}
            onChange={(v) => setFlag("use_requests", v)}
          />
        </li>
        <li>
          <ToggleRow
            title={bn ? "সংযোগ" : "Connections"}
            hint={bn ? "যাদের ফলো করেছেন তাদের ছবি" : "Photos of people they follow"}
            checked={cfg.use_people}
            onChange={(v) => setFlag("use_people", v)}
          />
        </li>
        <li>
          <ToggleRow
            title={bn ? "পরিসংখ্যান" : "Stats"}
            hint={bn ? "গ্রুপ, দান ও জীবন বাঁচানো" : "Group, donations and lives saved"}
            checked={cfg.use_stats}
            onChange={(v) => setFlag("use_stats", v)}
          />
        </li>
        <li>
          <ToggleRow
            title={bn ? "হার্টবিট লাইন" : "Heartbeat line"}
            hint={bn ? "মাঝের তরঙ্গরেখা" : "The waveform across the vault"}
            checked={cfg.show_waveform}
            onChange={(v) => setFlag("show_waveform", v)}
          />
        </li>
        <li>
          <ToggleRow
            title={bn ? "সার্কিট ফ্লোর" : "Circuit floor"}
            hint={bn ? "নিচের গ্রিড" : "The grid under the capsule"}
            checked={cfg.show_circuit}
            onChange={(v) => setFlag("show_circuit", v)}
          />
        </li>
        <li>
          <ToggleRow
            title={bn ? "ভাসমান অ্যানিমেশন" : "Float animation"}
            hint={bn ? "কার্ডগুলো আস্তে উপরে-নিচে নড়বে" : "Cards drift slowly up and down"}
            checked={cfg.animate}
            onChange={(v) => setFlag("animate", v)}
          />
        </li>
      </ul>

      <label className="block space-y-1">
        <span className="text-xs text-slate-400">{bn ? "সর্বোচ্চ নোড (১–৮)" : "Max nodes (1–8)"}</span>
        <input
          type="number"
          min={1}
          max={8}
          value={cfg.max_photos}
          onChange={(e) => setFlag("max_photos", Number(e.target.value))}
          className="w-24 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
        />
      </label>

      <p className="text-[11px] text-slate-500">
        {bn
          ? "লেখায় {name} {photos} {posts} {requests} {people} {donations} {lives} {blood} বসালে ইউজারের লাইভ ডেটা দেখাবে।"
          : "Use {name} {photos} {posts} {requests} {people} {donations} {lives} {blood} to insert that user's live data."}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["badge_bn", "ব্যাজ (বাংলা)"],
            ["badge_en", "Badge (English)"],
            ["title_bn", "শিরোনাম (বাংলা)"],
            ["title_en", "Title (English)"],
            ["subtitle_bn", "সাবটাইটেল (বাংলা)"],
            ["subtitle_en", "Subtitle (English)"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="block space-y-1">
            <span className="text-xs text-slate-400">{label}</span>
            <input
              value={cfg[key]}
              maxLength={80}
              onChange={(e) => setFlag(key, e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
          </label>
        ))}
      </div>

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
