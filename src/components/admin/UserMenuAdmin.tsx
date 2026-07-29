import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_USER_MENU_SETTINGS,
  fetchUserMenuSettings,
  invalidateUserMenuSettingsCache,
  saveUserMenuSettings,
  USER_MENU_ICON_OPTIONS,
  type UserMenuItem,
  type UserMenuSettings,
} from "@/lib/user-menu-settings";
import { USER_MENU_PLAN_MARKDOWN } from "@/lib/user-menu-plan-doc";
import { ArrowDown, ArrowUp, FileText, Save, X } from "lucide-react";
import { toast } from "sonner";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

export function UserMenuAdmin() {
  const { lang, t } = useI18n();
  const { can } = useAdminAccess();
  const [cfg, setCfg] = useState<UserMenuSettings>(DEFAULT_USER_MENU_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  useEffect(() => {
    fetchUserMenuSettings(true).then(setCfg);
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

  function patchItem(id: UserMenuItem["id"], patch: Partial<UserMenuItem>) {
    setCfg((prev) => ({
      ...prev,
      items: prev.items.map((it) => (it.id === id ? { ...it, ...patch } : it)),
    }));
  }

  async function save() {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    setBusy(true);
    const ordered = {
      ...cfg,
      items: [...cfg.items]
        .sort((a, b) => a.order - b.order)
        .map((it, i) => ({ ...it, order: i })),
    };
    const { error, settings } = await saveUserMenuSettings(ordered);
    setBusy(false);
    if (error) {
      if (/user_menu_settings|column/i.test(error.message)) {
        return toast.error(
          lang === "bn"
            ? "আগে scripts/user-menu-settings.sql চালান"
            : "Run scripts/user-menu-settings.sql first",
        );
      }
      return toast.error(error.message);
    }
    setCfg(settings);
    invalidateUserMenuSettingsCache();
    toast.success(t("saved"));
  }

  const items = [...cfg.items].sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              {lang === "bn" ? "ইউজার মেনু (Drawer)" : "User menu (Drawer)"}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              {lang === "bn"
                ? "বাম মেনু আইটেম, লেবেল, আইকন এবং ডিজাইন নিয়ন্ত্রণ।"
                : "Control left-menu items, labels, icons, and design."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowPlan(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              <FileText className="h-3.5 w-3.5" />
              {lang === "bn" ? "প্ল্যানিং দেখুন" : "View planning"}
            </button>
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
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[11px] text-slate-400">
              {lang === "bn" ? "Drawer প্রস্থ (px)" : "Drawer width (px)"}
            </label>
            <input
              className={ainp}
              type="number"
              min={260}
              max={420}
              value={cfg.design.drawer_width_px}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  design: {
                    ...p.design,
                    drawer_width_px: Math.max(260, Math.min(420, Number(e.target.value) || 320)),
                  },
                }))
              }
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-400">
              {lang === "bn" ? "অ্যাকসেন্ট রং" : "Accent color"}
            </label>
            <input
              className={ainp}
              type="color"
              value={cfg.design.accent}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  design: { ...p.design, accent: e.target.value },
                }))
              }
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5 sm:col-span-2">
            <span className="text-sm">
              {lang === "bn" ? "প্রোফাইল কার্ড দেখান" : "Show profile card"}
            </span>
            <input
              type="checkbox"
              checked={cfg.design.show_profile_card}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  design: { ...p.design, show_profile_card: e.target.checked },
                }))
              }
              className="h-4 w-4 accent-rose-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5 sm:col-span-2">
            <span className="text-sm">
              {lang === "bn" ? "‘আরও দেখুন’ বাটন" : "“See more” button"}
            </span>
            <input
              type="checkbox"
              checked={cfg.design.show_see_more}
              onChange={(e) =>
                setCfg((p) => ({
                  ...p,
                  design: { ...p.design, show_see_more: e.target.checked },
                }))
              }
              className="h-4 w-4 accent-rose-500"
            />
          </label>
        </div>

        <ul className="space-y-2">
          {items.map((it, index) => (
            <li
              key={it.id}
              className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-2 text-xs shrink-0">
                  <input
                    type="checkbox"
                    checked={it.enabled}
                    onChange={(e) => patchItem(it.id, { enabled: e.target.checked })}
                    className="h-3.5 w-3.5 accent-rose-500"
                  />
                  <span className="font-mono text-slate-400">{it.id}</span>
                </label>
                <div className="ml-auto flex gap-1">
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    className="h-7 w-7 rounded border border-slate-700 grid place-items-center text-slate-300 hover:bg-slate-800"
                    aria-label="Up"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    className="h-7 w-7 rounded border border-slate-700 grid place-items-center text-slate-300 hover:bg-slate-800"
                    aria-label="Down"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <input
                  className={ainp}
                  value={it.label_bn}
                  onChange={(e) => patchItem(it.id, { label_bn: e.target.value })}
                  placeholder="label_bn"
                />
                <input
                  className={ainp}
                  value={it.label_en}
                  onChange={(e) => patchItem(it.id, { label_en: e.target.value })}
                  placeholder="label_en"
                />
                <select
                  className={ainp}
                  value={it.icon}
                  onChange={(e) => patchItem(it.id, { icon: e.target.value })}
                >
                  {USER_MENU_ICON_OPTIONS.map((ic) => (
                    <option key={ic} value={ic}>
                      {ic}
                    </option>
                  ))}
                  {!USER_MENU_ICON_OPTIONS.includes(it.icon as (typeof USER_MENU_ICON_OPTIONS)[number]) && (
                    <option value={it.icon}>{it.icon}</option>
                  )}
                </select>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {showPlan && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-6">
          <div className="w-full max-w-3xl max-h-[90dvh] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-slate-700 bg-slate-950 flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-800">
              <h4 className="text-sm font-semibold">
                {lang === "bn" ? "User Menu — প্ল্যানিং" : "User Menu — Planning"}
              </h4>
              <button
                type="button"
                onClick={() => setShowPlan(false)}
                className="h-8 w-8 rounded-lg border border-slate-700 grid place-items-center text-slate-300 hover:bg-slate-900"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <article className="overflow-y-auto p-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
              {USER_MENU_PLAN_MARKDOWN}
            </article>
          </div>
        </div>
      )}
    </div>
  );
}
