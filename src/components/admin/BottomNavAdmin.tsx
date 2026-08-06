import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Save } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_BOTTOM_NAV_SETTINGS,
  fetchBottomNavSettings,
  invalidateBottomNavSettingsCache,
  saveBottomNavSettings,
  type BottomNavItem,
  type BottomNavSettings,
} from "@/lib/bottom-nav-settings";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

const ID_HINT: Record<BottomNavItem["id"], { bn: string; en: string }> = {
  feed: { bn: "হোম ফিড", en: "Home feed" },
  community: { bn: "কমিউনিটি ডোনার", en: "Community donors" },
  post: { bn: "নতুন রিকোয়েস্ট পোস্ট", en: "Create request / post" },
  alert: { bn: "নোটিফিকেশন / অ্যালার্ট", en: "Notifications / alerts" },
  profile: { bn: "ইউজার প্রোফাইল", en: "User profile" },
};

export function BottomNavAdmin() {
  const { lang, t } = useI18n();
  const { can } = useAdminAccess();
  const [cfg, setCfg] = useState<BottomNavSettings>(DEFAULT_BOTTOM_NAV_SETTINGS);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void fetchBottomNavSettings(true).then(setCfg);
  }, []);

  function move(index: number, dir: -1 | 1) {
    setCfg((prev) => {
      const items = [...prev.items].sort((a, b) => a.order - b.order);
      const j = index + dir;
      if (j < 0 || j >= items.length) return prev;
      const a = items[index]!;
      const b = items[j]!;
      const tmp = a.order;
      a.order = b.order;
      b.order = tmp;
      return { ...prev, items: items.map((it, i) => ({ ...it, order: i })) };
    });
  }

  function patchItem(id: BottomNavItem["id"], patch: Partial<BottomNavItem>) {
    setCfg((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  }

  async function save() {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    if (!cfg.items.some((i) => i.enabled)) {
      return toast.error(
        lang === "bn" ? "কমপক্ষে একটি আইটেম চালু রাখুন" : "Keep at least one item enabled",
      );
    }
    setBusy(true);
    const ordered = {
      items: [...cfg.items]
        .sort((a, b) => a.order - b.order)
        .map((it, i) => ({ ...it, order: i })),
    };
    const { error, settings } = await saveBottomNavSettings(ordered);
    setBusy(false);
    if (error) {
      if (/bottom_nav_settings|column/i.test(error.message)) {
        return toast.error(
          lang === "bn"
            ? "আগে scripts/bottom-nav-settings.sql চালান"
            : "Run scripts/bottom-nav-settings.sql first",
        );
      }
      return toast.error(error.message);
    }
    setCfg(settings);
    invalidateBottomNavSettingsCache();
    toast.success(t("saved"));
  }

  const items = [...cfg.items].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              {lang === "bn" ? "অ্যাপ ন্যাভ (Feed / Community / Post…)" : "App nav (Feed / Community / Post…)"}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              {lang === "bn"
                ? "মোবাইল বটম ন্যাভ ও ডেস্কটপ টপ ন্যাভে কোন আইটেম চালু থাকবে তা নিয়ন্ত্রণ করুন।"
                : "Control which items appear in the mobile bottom nav and desktop top nav."}
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

        <div className="space-y-2">
          {items.map((item, idx) => (
            <div
              key={item.id}
              className="rounded-lg border border-slate-800 bg-slate-950/70 p-3 space-y-2"
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-rose-500"
                  checked={item.enabled}
                  onChange={(e) => patchItem(item.id, { enabled: e.target.checked })}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-100">
                    {lang === "bn" ? item.label_bn : item.label_en}
                    <span className="ml-2 text-[10px] font-normal text-slate-500 uppercase">
                      {item.id}
                    </span>
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {lang === "bn" ? ID_HINT[item.id].bn : ID_HINT[item.id].en}
                  </p>
                </div>
                <button
                  type="button"
                  className="p-1 text-slate-400 disabled:opacity-30"
                  disabled={idx === 0}
                  onClick={() => move(idx, -1)}
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="p-1 text-slate-400 disabled:opacity-30"
                  disabled={idx >= items.length - 1}
                  onClick={() => move(idx, 1)}
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  className={ainp}
                  value={item.label_bn}
                  placeholder="Label BN"
                  onChange={(e) => patchItem(item.id, { label_bn: e.target.value })}
                />
                <input
                  className={ainp}
                  value={item.label_en}
                  placeholder="Label EN"
                  onChange={(e) => patchItem(item.id, { label_en: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
