import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Save } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_BOTTOM_NAV_COLORS,
  DEFAULT_BOTTOM_NAV_SETTINGS,
  fetchBottomNavSettings,
  invalidateBottomNavSettingsCache,
  saveBottomNavSettings,
  type BottomNavColors,
  type BottomNavItem,
  type BottomNavSettings,
} from "@/lib/bottom-nav-settings";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

const ID_HINT: Record<BottomNavItem["id"], { bn: string; en: string }> = {
  feed: { bn: "হোম ফিড", en: "Home feed" },
  community: { bn: "কমিউনিটি ডোনার", en: "Community donors" },
  post: { bn: "নতুন রিকোয়েস্ট পোস্ট", en: "Create request / post" },
  alert: { bn: "চ্যাট (মেসেজ)", en: "Chat / messages" },
  more: { bn: "কেয়ার হাব (ডাক্তার / টেস্ট)", en: "Care hub (doctors / tests)" },
};

const COLOR_FIELDS: {
  key: keyof BottomNavColors;
  bn: string;
  en: string;
}[] = [
  { key: "icon", bn: "আইকন outline (ইনঅ্যাকটিভ)", en: "Icon outline (inactive)" },
  { key: "icon_active", bn: "আইকন (অ্যাকটিভ)", en: "Icon (active)" },
  { key: "label", bn: "লেবেল (ইনঅ্যাকটিভ)", en: "Label (inactive)" },
  { key: "label_active", bn: "লেবেল (অ্যাকটিভ)", en: "Label (active)" },
  { key: "compose_bg", bn: "পোস্ট (+) বৃত্ত ব্যাকগ্রাউন্ড", en: "Post (+) circle background" },
  { key: "compose_icon", bn: "পোস্ট (+) আইকন", en: "Post (+) icon" },
  { key: "bar_bg", bn: "ন্যাভ বার ব্যাকগ্রাউন্ড", en: "Nav bar background" },
  { key: "bar_border", bn: "ন্যাভ টপ বর্ডার", en: "Nav top border" },
];

/** color input needs #rrggbb — extract when possible */
function toColorInputValue(css: string): string {
  const s = css.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s;
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    const r = s[1]!;
    const g = s[2]!;
    const b = s[3]!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#ffffff";
}

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

  function patchColor(key: keyof BottomNavColors, value: string) {
    setCfg((prev) => ({
      ...prev,
      colors: { ...prev.colors, [key]: value },
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
      colors: cfg.colors,
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

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">
              {lang === "bn" ? "বটম ন্যাভ আইকন / রঙ" : "Bottom nav icon colors"}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              {lang === "bn"
                ? "মোবাইল ডার্ক ন্যাভের আইকন outline, অ্যাকটিভ রঙ, লেবেল ও বার ব্যাকগ্রাউন্ড।"
                : "Icon outline, active color, labels, and bar background for the mobile dark nav."}
            </p>
          </div>
          <button
            type="button"
            className="text-[10px] text-slate-400 hover:text-slate-200 underline-offset-2 hover:underline"
            onClick={() =>
              setCfg((prev) => ({ ...prev, colors: { ...DEFAULT_BOTTOM_NAV_COLORS } }))
            }
          >
            {lang === "bn" ? "ডিফল্ট রঙ" : "Reset colors"}
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-2.5">
          {COLOR_FIELDS.map((field) => {
            const value = cfg.colors[field.key];
            return (
              <label
                key={field.key}
                className="rounded-lg border border-slate-800 bg-slate-950/70 px-2.5 py-2 space-y-1.5"
              >
                <span className="text-[10px] text-slate-400 block">
                  {lang === "bn" ? field.bn : field.en}
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-8 w-10 shrink-0 cursor-pointer rounded border border-slate-700 bg-transparent p-0.5"
                    value={toColorInputValue(value)}
                    onChange={(e) => patchColor(field.key, e.target.value)}
                    aria-label={field.en}
                  />
                  <input
                    className={ainp + " font-mono"}
                    value={value}
                    onChange={(e) => patchColor(field.key, e.target.value)}
                    placeholder="#ffffff"
                  />
                </div>
              </label>
            );
          })}
        </div>

        <div
          className="rounded-xl overflow-hidden border border-slate-700 mt-1"
          style={{
            background: cfg.colors.bar_bg,
            borderColor: cfg.colors.bar_border,
          }}
        >
          <p className="text-[9px] text-slate-500 px-3 pt-2">
            {lang === "bn" ? "প্রিভিউ" : "Preview"}
          </p>
          <div className="grid grid-cols-5 px-1 py-2">
            {(
              [
                { active: true, label: lang === "bn" ? "ফিড" : "Feed" },
                { active: false, label: lang === "bn" ? "কমিউনিটি" : "Community" },
                { active: false, label: lang === "bn" ? "পোস্ট" : "Post", compose: true },
                { active: false, label: lang === "bn" ? "চ্যাট" : "Chat" },
                { active: false, label: lang === "bn" ? "প্রোফাইল" : "Profile" },
              ] as const
            ).map((slot, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5 py-1">
                {"compose" in slot && slot.compose ? (
                  <span
                    className="h-7 w-7 rounded-full grid place-items-center text-sm font-semibold"
                    style={{
                      background: cfg.colors.compose_bg,
                      color: cfg.colors.compose_icon,
                    }}
                  >
                    +
                  </span>
                ) : (
                  <span
                    className="h-5 w-5 rounded-sm border-2"
                    style={{
                      borderColor: slot.active ? cfg.colors.icon_active : cfg.colors.icon,
                      background: slot.active ? cfg.colors.icon_active : "transparent",
                      opacity: slot.active ? 1 : 0.9,
                    }}
                  />
                )}
                <span
                  className="text-[9px]"
                  style={{
                    color: slot.active ? cfg.colors.label_active : cfg.colors.label,
                  }}
                >
                  {slot.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
