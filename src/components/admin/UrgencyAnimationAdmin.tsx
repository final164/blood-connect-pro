import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_URGENCY_ANIMATION,
  URGENCY_EASINGS,
  URGENCY_MODES,
  URGENCY_PRESETS,
  fetchUrgencyAnimationSettings,
  invalidateUrgencyAnimationCache,
  normalizeUrgencyAnimation,
  type UrgencyAnimMode,
  type UrgencyAnimationSettings,
  type UrgencyLevelAnim,
  type UrgencyPresetId,
} from "@/lib/urgency-animation";
import { UrgencyDropletBackdrop, UrgencyHeaderIcon } from "@/components/request/UrgencyDropletBackdrop";
import { publishUrgencyAnimationSettings } from "@/hooks/useUrgencyAnimationSettings";
import { Droplets, Save } from "lucide-react";
import { toast } from "sonner";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

type LevelKey = "critical" | "urgent";

export function UrgencyAnimationAdmin() {
  const { lang, t } = useI18n();
  const { can } = useAdminAccess();
  const [cfg, setCfg] = useState<UrgencyAnimationSettings>(DEFAULT_URGENCY_ANIMATION);
  const [tab, setTab] = useState<LevelKey>("critical");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchUrgencyAnimationSettings(true).then(setCfg);
  }, []);

  function patchLevel(key: LevelKey, patch: Partial<UrgencyLevelAnim>) {
    setCfg((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  function applyPreset(id: UrgencyPresetId) {
    const p = URGENCY_PRESETS[id];
    setCfg((prev) =>
      normalizeUrgencyAnimation({
        critical: { ...prev.critical, ...p.critical, enabled: prev.critical.enabled },
        urgent: { ...prev.urgent, ...p.urgent, enabled: prev.urgent.enabled },
      }),
    );
  }

  async function save() {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    setBusy(true);
    const normalized = normalizeUrgencyAnimation(cfg);
    const { data: existing } = await supabase
      .from("app_settings")
      .select("notification_settings")
      .eq("id", 1)
      .maybeSingle();
    const ns = {
      ...((existing?.notification_settings as object) ?? {}),
      enable_critical_droplet_animation: normalized.critical.enabled,
    };
    const { error } = await supabase.from("app_settings").upsert({
      id: 1,
      urgency_animation: normalized,
      notification_settings: ns,
    });
    setBusy(false);
    if (error) {
      if (/urgency_animation|column/i.test(error.message)) {
        return toast.error(
          lang === "bn"
            ? "আগে scripts/urgency-animation.sql চালান"
            : "Run scripts/urgency-animation.sql first",
        );
      }
      return toast.error(error.message);
    }
    setCfg(normalized);
    invalidateUrgencyAnimationCache();
    publishUrgencyAnimationSettings(normalized);
    toast.success(t("saved"));
  }

  const level = cfg[tab];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Droplets className="h-4 w-4 text-rose-400" />
            {lang === "bn" ? "জরুরিতা অ্যানিমেশন (পোস্ট ব্যাকগ্রাউন্ড)" : "Urgency animation (post backdrop)"}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xl leading-relaxed">
            {lang === "bn"
              ? "Critical ও Urgent পোস্টে রক্তের ফোঁটা opacity/scale দিয়ে পুরো কার্ড জুড়ে অ্যানিমেট হবে। স্ক্রল ল্যাগ এড়াতে মোবাইলে ১টি ফোঁটা, অফ-স্ক্রিনে অ্যানিমেশন পজ।"
              : "Critical & Urgent posts show a blood droplet backdrop. Tuned for smooth scroll: max 2 droplets (1 on mobile), no blur, pauses off-screen."}
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {busy ? t("saving") : t("save")}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(URGENCY_PRESETS) as UrgencyPresetId[]).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => applyPreset(id)}
            className="rounded-lg border border-slate-700 px-2.5 py-1 text-[10px] text-slate-300 hover:border-rose-500/40"
          >
            {lang === "bn" ? URGENCY_PRESETS[id].label_bn : URGENCY_PRESETS[id].label_en}
          </button>
        ))}
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-950 p-1">
        {(["critical", "urgent"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k)}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              tab === k ? "bg-rose-600 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {k === "critical"
              ? lang === "bn"
                ? "সংকটাপন্ন (Critical)"
                : "Critical"
              : lang === "bn"
                ? "জরুরি (Urgent)"
                : "Urgent"}
          </button>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="space-y-3">
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
            <span>{lang === "bn" ? "অ্যানিমেশন চালু" : "Animation enabled"}</span>
            <input
              type="checkbox"
              checked={level.enabled}
              onChange={(e) => patchLevel(tab, { enabled: e.target.checked })}
              className="h-4 w-4 accent-rose-500"
            />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
            <span>{lang === "bn" ? "হেডারে ছোট আইকন" : "Header icon"}</span>
            <input
              type="checkbox"
              checked={level.show_header_icon}
              onChange={(e) => patchLevel(tab, { show_header_icon: e.target.checked })}
              className="h-4 w-4 accent-rose-500"
            />
          </label>

          <Field label={lang === "bn" ? "মোশন মোড" : "Motion mode"}>
            <select
              className={ainp}
              value={level.mode}
              onChange={(e) => patchLevel(tab, { mode: e.target.value as UrgencyAnimMode })}
            >
              {URGENCY_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {lang === "bn" ? m.label_bn : m.label_en}
                </option>
              ))}
            </select>
          </Field>

          <Field label={`${lang === "bn" ? "সাইকেল (ms)" : "Cycle (ms)"}: ${level.duration_ms}`}>
            <input
              type="range"
              min={600}
              max={8000}
              step={100}
              value={level.duration_ms}
              onChange={(e) => patchLevel(tab, { duration_ms: Number(e.target.value) })}
              className="w-full accent-rose-500"
            />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label={`${lang === "bn" ? "Opacity min" : "Opacity min"}: ${level.opacity_min.toFixed(2)}`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={level.opacity_min}
                onChange={(e) => patchLevel(tab, { opacity_min: Number(e.target.value) })}
                className="w-full accent-rose-500"
              />
            </Field>
            <Field label={`${lang === "bn" ? "Opacity max" : "Opacity max"}: ${level.opacity_max.toFixed(2)}`}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={level.opacity_max}
                onChange={(e) => patchLevel(tab, { opacity_max: Number(e.target.value) })}
                className="w-full accent-rose-500"
              />
            </Field>
            <Field label={`${lang === "bn" ? "Scale min" : "Scale min"}: ${level.scale_min.toFixed(2)}`}>
              <input
                type="range"
                min={0.3}
                max={2}
                step={0.01}
                value={level.scale_min}
                onChange={(e) => patchLevel(tab, { scale_min: Number(e.target.value) })}
                className="w-full accent-rose-500"
              />
            </Field>
            <Field label={`${lang === "bn" ? "Scale max" : "Scale max"}: ${level.scale_max.toFixed(2)}`}>
              <input
                type="range"
                min={0.3}
                max={2.5}
                step={0.01}
                value={level.scale_max}
                onChange={(e) => patchLevel(tab, { scale_max: Number(e.target.value) })}
                className="w-full accent-rose-500"
              />
            </Field>
          </div>

          <Field label={`${lang === "bn" ? "আকার %" : "Size %"}: ${level.size_percent}`}>
            <input
              type="range"
              min={30}
              max={120}
              step={1}
              value={level.size_percent}
              onChange={(e) => patchLevel(tab, { size_percent: Number(e.target.value) })}
              className="w-full accent-rose-500"
            />
          </Field>

          <Field
            label={lang === "bn" ? "ফোঁটার সংখ্যা (মোবাইলে সবসময় ১)" : "Droplet count (always 1 on mobile)"}
          >
            <select
              className={ainp}
              value={level.droplet_count}
              onChange={(e) => patchLevel(tab, { droplet_count: Number(e.target.value) })}
            >
              {[1, 2].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>

          <Field label={lang === "bn" ? "Easing" : "Easing"}>
            <select className={ainp} value={level.easing} onChange={(e) => patchLevel(tab, { easing: e.target.value })}>
              {URGENCY_EASINGS.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </Field>

          <Field label={lang === "bn" ? "রঙ" : "Color"}>
            <div className="flex gap-2">
              <input
                type="color"
                value={level.color}
                onChange={(e) => patchLevel(tab, { color: e.target.value })}
                className="h-9 w-12 rounded border border-slate-700 bg-slate-950"
              />
              <input
                className={ainp}
                value={level.color}
                onChange={(e) => patchLevel(tab, { color: e.target.value })}
              />
            </div>
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            {lang === "bn" ? "লাইভ প্রিভিউ" : "Live preview"}
          </p>
          <div
            className={`relative rounded-2xl border border-slate-700 overflow-hidden min-h-[220px] ${
              tab === "critical" ? "bg-slate-950" : "bg-slate-950"
            }`}
          >
            <UrgencyDropletBackdrop config={level} />
            <div
              className={`relative z-[1] px-4 py-2.5 flex items-center gap-2 ${
                tab === "critical"
                  ? "bg-gradient-to-r from-rose-700 to-rose-600 text-white"
                  : "bg-gradient-to-r from-amber-600 to-orange-500 text-white"
              }`}
            >
              <UrgencyHeaderIcon config={level} />
              <span className="text-lg font-bold">B+</span>
              <span className="text-[10px] font-semibold uppercase opacity-90 px-2 py-0.5 rounded-md bg-black/15">
                {tab}
              </span>
            </div>
            <div className="relative z-[1] p-4 space-y-2 bg-slate-900/90">
              <p className="text-sm font-semibold text-slate-100">
                {lang === "bn" ? "নমুনা রোগী" : "Sample patient"}
              </p>
              <p className="text-xs text-slate-400">
                {lang === "bn"
                  ? "পোস্টের ব্যাকগ্রাউন্ডে রক্তের ফোঁটা opacity ও scale বাড়ছে-কমছে।"
                  : "Blood droplet opacity & scale breathe across the full post."}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                {level.mode} · {level.duration_ms}ms · {level.opacity_min}→{level.opacity_max} ·{" "}
                {level.scale_min}→{level.scale_max}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-slate-400 block mb-1">{label}</label>
      {children}
    </div>
  );
}
