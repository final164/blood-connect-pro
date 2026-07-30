import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_MESSAGING_SETTINGS,
  fetchMessagingSettings,
  invalidateMessagingSettingsCache,
  saveMessagingSettings,
  type MessagingSettings,
  type PostIconSettings,
} from "@/lib/messaging-settings";
import { toast } from "sonner";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/40 placeholder:text-slate-500";

const POST_ICON_KEYS: (keyof PostIconSettings)[] = [
  "like",
  "comment",
  "chat",
  "phone",
  "whatsapp",
  "save",
  "share",
];

export function MessagingSettingsAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const [s, setS] = useState<MessagingSettings>({ ...DEFAULT_MESSAGING_SETTINGS });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchMessagingSettings(true).then(setS);
  }, []);

  async function save() {
    if (!can("settings.edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    setBusy(true);
    try {
      await saveMessagingSettings(s);
      invalidateMessagingSettingsCache();
      toast.success(lang === "bn" ? "সেভ হয়েছে" : "Saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const iconLabels: Record<keyof PostIconSettings, { bn: string; en: string }> = {
    like: { bn: "লাইক", en: "Like" },
    comment: { bn: "কমেন্ট", en: "Comment" },
    chat: { bn: "চ্যাট", en: "Chat" },
    phone: { bn: "কল", en: "Call" },
    whatsapp: { bn: "WhatsApp", en: "WhatsApp" },
    save: { bn: "সেভ", en: "Save" },
    share: { bn: "শেয়ার", en: "Share" },
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "কমিউনিটি SMS টেমপ্লেট" : "Community SMS template"}
        </h3>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          {"{{blood_group}} {{patient_name}} {{hospital}} {{upazila}} {{district}} {{bags}} {{urgency}} {{contact}} {{notes}} {{link}}"}
        </p>
        <label className="block text-[10px] text-slate-400 mb-1">Bangla</label>
        <textarea
          className={`${ainp} min-h-[100px] font-mono text-xs`}
          value={s.community_sms_bn}
          onChange={(e) => setS({ ...s, community_sms_bn: e.target.value })}
        />
        <label className="block text-[10px] text-slate-400 mb-1">English</label>
        <textarea
          className={`${ainp} min-h-[100px] font-mono text-xs`}
          value={s.community_sms_en}
          onChange={(e) => setS({ ...s, community_sms_en: e.target.value })}
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "পোস্ট শেয়ার / SMS টেমপ্লেট" : "Post share / SMS template"}
        </h3>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          {"{{blood_group}} {{patient_name}} {{location}} {{hospital}} {{link}} …"}
        </p>
        <label className="block text-[10px] text-slate-400 mb-1">Bangla</label>
        <textarea
          className={`${ainp} min-h-[80px] font-mono text-xs`}
          value={s.share_sms_bn}
          onChange={(e) => setS({ ...s, share_sms_bn: e.target.value })}
        />
        <label className="block text-[10px] text-slate-400 mb-1">English</label>
        <textarea
          className={`${ainp} min-h-[80px] font-mono text-xs`}
          value={s.share_sms_en}
          onChange={(e) => setS({ ...s, share_sms_en: e.target.value })}
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "পোস্ট আইকন (ফিড)" : "Post icons (feed)"}
        </h3>
        <div className="grid sm:grid-cols-2 gap-2">
          {POST_ICON_KEYS.map((key) => (
            <label
              key={key}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs"
            >
              <span className="text-slate-300">{lang === "bn" ? iconLabels[key].bn : iconLabels[key].en}</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-rose-500"
                checked={s.post_icons[key]}
                onChange={(e) =>
                  setS({
                    ...s,
                    post_icons: { ...s.post_icons, [key]: e.target.checked },
                  })
                }
              />
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="rounded-lg bg-rose-600 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50"
      >
        {busy ? "…" : lang === "bn" ? "সেভ" : "Save"}
      </button>
    </div>
  );
}
