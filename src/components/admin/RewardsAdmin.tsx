import { useEffect, useState } from "react";
import { Save, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_REWARDS_SETTINGS,
  fetchRewardsSettings,
  invalidateRewardsSettingsCache,
  saveRewardsSettings,
  type RewardLevelDef,
  type RewardsSettings,
} from "@/lib/rewards-settings";
import { adminAdjustRewardPoints } from "@/lib/rewards";
import { supabase } from "@/integrations/supabase/client";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

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

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] text-slate-400">{label}</span>
      <input
        type="number"
        className={ainp}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </label>
  );
}

export function RewardsAdmin() {
  const { lang, t } = useI18n();
  const { can } = useAdminAccess();
  const canEdit = can("settings.edit") || can("cms.edit") || can("community.edit");
  const [cfg, setCfg] = useState<RewardsSettings>(DEFAULT_REWARDS_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [schemaHint, setSchemaHint] = useState(false);
  const [recent, setRecent] = useState<
    { id: string; user_id: string; points: number; action: string; created_at: string }[]
  >([]);
  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustPts, setAdjustPts] = useState(0);
  const [adjustNote, setAdjustNote] = useState("");

  async function reload() {
    try {
      const s = await fetchRewardsSettings(true);
      setCfg(s);
      const { data, error } = await supabase
        .from("reward_ledger")
        .select("id, user_id, points, action, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error && /reward_ledger|column|schema/i.test(error.message)) {
        setSchemaHint(true);
      } else {
        setRecent((data as typeof recent) ?? []);
      }
    } catch {
      setSchemaHint(true);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function save() {
    if (!canEdit) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    setBusy(true);
    const { error } = await saveRewardsSettings(cfg);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      if (/rewards_settings|column/i.test(error.message)) setSchemaHint(true);
      return;
    }
    invalidateRewardsSettingsCache();
    toast.success(t("saved"));
  }

  function patchLevel(i: number, patch: Partial<RewardLevelDef>) {
    setCfg((p) => {
      const levels = p.levels.map((l, idx) => (idx === i ? { ...l, ...patch } : l));
      return { ...p, levels };
    });
  }

  async function runAdjust() {
    if (!canEdit) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!adjustUserId.trim() || !adjustPts) {
      return toast.error(lang === "bn" ? "ইউজার আইডি ও পয়েন্ট দিন" : "Enter user id and points");
    }
    try {
      await adminAdjustRewardPoints(adjustUserId.trim(), adjustPts, adjustNote.trim() || undefined);
      toast.success(lang === "bn" ? "সমন্বয় হয়েছে" : "Adjusted");
      setAdjustPts(0);
      setAdjustNote("");
      void reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-2">
        <Trophy className="h-5 w-5 text-rose-400" />
        <div>
          <h3 className="text-sm font-semibold">
            {lang === "bn" ? "রিওয়ার্ড পয়েন্ট" : "Reward points"}
          </h3>
          <p className="text-[10px] text-slate-500">
            {lang === "bn"
              ? "সাইন আপ, পোস্ট, রক্তদান কনফার্ম — অ্যামাউন্ট ও ক্যাপ এখান থেকে।"
              : "Signup, post, donation confirm — amounts and caps."}
          </p>
        </div>
      </div>

      {schemaHint && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
          {lang === "bn"
            ? "মাইগ্রেশন চালান: 20260912140000_rewards_system.sql"
            : "Run migration: 20260912140000_rewards_system.sql"}
        </p>
      )}

      <ToggleRow
        title={lang === "bn" ? "রিওয়ার্ড সিস্টেম চালু" : "Rewards system enabled"}
        hint={lang === "bn" ? "বন্ধ থাকলে কোনো পয়েন্ট দেওয়া হবে না" : "When off, no points are awarded"}
        checked={cfg.enabled}
        onChange={(v) => setCfg((p) => ({ ...p, enabled: v }))}
      />

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-300">
          {lang === "bn" ? "পয়েন্ট অ্যামাউন্ট" : "Point amounts"}
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          <NumField
            label={lang === "bn" ? "সাইন আপ" : "Signup"}
            value={cfg.signup_points}
            onChange={(n) => setCfg((p) => ({ ...p, signup_points: n }))}
          />
          <NumField
            label={lang === "bn" ? "পোস্ট রিকোয়েস্ট" : "Post request"}
            value={cfg.post_request_points}
            onChange={(n) => setCfg((p) => ({ ...p, post_request_points: n }))}
          />
          <NumField
            label={lang === "bn" ? "ডোনেশন কনফার্মড (ডোনার)" : "Donation confirmed (donor)"}
            value={cfg.donation_confirmed_points}
            onChange={(n) => setCfg((p) => ({ ...p, donation_confirmed_points: n }))}
          />
          <NumField
            label={lang === "bn" ? "রিকোয়েস্ট ফুলফিল (রিকোয়েস্টার)" : "Request fulfilled (requester)"}
            value={cfg.request_fulfilled_points}
            onChange={(n) => setCfg((p) => ({ ...p, request_fulfilled_points: n }))}
          />
          <NumField
            label="Like"
            value={cfg.like_points}
            onChange={(n) => setCfg((p) => ({ ...p, like_points: n }))}
          />
          <NumField
            label="Comment"
            value={cfg.comment_points}
            onChange={(n) => setCfg((p) => ({ ...p, comment_points: n }))}
          />
          <NumField
            label="Share"
            value={cfg.share_points}
            onChange={(n) => setCfg((p) => ({ ...p, share_points: n }))}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-300">
          {lang === "bn" ? "অ্যাকশন চালু/বন্ধ" : "Action toggles"}
        </p>
        {(
          [
            ["enable_signup", "Signup"],
            ["enable_post_request", "Post request"],
            ["enable_donation_confirmed", "Donation confirmed"],
            ["enable_request_fulfilled", "Request fulfilled"],
            ["enable_like", "Like (V1.1)"],
            ["enable_comment", "Comment (V1.1)"],
            ["enable_share", "Share (V1.1)"],
          ] as const
        ).map(([key, label]) => (
          <ToggleRow
            key={key}
            title={label}
            hint=""
            checked={cfg[key]}
            onChange={(v) => setCfg((p) => ({ ...p, [key]: v }))}
          />
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <p className="text-xs font-semibold text-slate-300">
          {lang === "bn" ? "ক্যাপ (ডোনেশন/সাইনআপ বাদে)" : "Caps (excl. donation/signup)"}
        </p>
        <div className="grid sm:grid-cols-3 gap-2">
          <NumField
            label={lang === "bn" ? "দৈনিক আর্ন ক্যাপ" : "Daily earn cap"}
            value={cfg.daily_earn_cap}
            onChange={(n) => setCfg((p) => ({ ...p, daily_earn_cap: n }))}
          />
          <NumField
            label={lang === "bn" ? "পোস্ট/দিন" : "Posts/day"}
            value={cfg.post_daily_cap}
            onChange={(n) => setCfg((p) => ({ ...p, post_daily_cap: n }))}
          />
          <NumField
            label={lang === "bn" ? "এনগেজ/দিন" : "Engage/day"}
            value={cfg.engage_daily_cap}
            onChange={(n) => setCfg((p) => ({ ...p, engage_daily_cap: n }))}
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-300">
          {lang === "bn" ? "লেভেল" : "Levels"}
        </p>
        <div className="space-y-2">
          {cfg.levels.map((l, i) => (
            <div key={i} className="grid grid-cols-4 gap-1.5">
              <input
                className={ainp}
                type="number"
                value={l.level}
                onChange={(e) => patchLevel(i, { level: Number(e.target.value) || 1 })}
                title="Level"
              />
              <input
                className={ainp}
                type="number"
                value={l.min_lifetime}
                onChange={(e) =>
                  patchLevel(i, { min_lifetime: Number(e.target.value) || 0 })
                }
                title="Min lifetime"
              />
              <input
                className={ainp}
                value={l.name_bn}
                onChange={(e) => patchLevel(i, { name_bn: e.target.value })}
                placeholder="BN"
              />
              <input
                className={ainp}
                value={l.name_en}
                onChange={(e) => patchLevel(i, { name_en: e.target.value })}
                placeholder="EN"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={busy || !canEdit}
        onClick={() => void save()}
        className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
      >
        <Save className="h-4 w-4" />
        {busy ? "…" : t("save")}
      </button>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-300">
          {lang === "bn" ? "ম্যানুয়াল সমন্বয়" : "Manual adjust"}
        </p>
        <input
          className={ainp}
          placeholder="user UUID"
          value={adjustUserId}
          onChange={(e) => setAdjustUserId(e.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            className={ainp}
            type="number"
            placeholder="points (+/−)"
            value={adjustPts || ""}
            onChange={(e) => setAdjustPts(Number(e.target.value) || 0)}
          />
          <input
            className={ainp}
            placeholder="note"
            value={adjustNote}
            onChange={(e) => setAdjustNote(e.target.value)}
          />
        </div>
        <button
          type="button"
          disabled={!canEdit}
          onClick={() => void runAdjust()}
          className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
        >
          {lang === "bn" ? "সমন্বয় করুন" : "Apply adjust"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
        <p className="text-xs font-semibold text-slate-300">
          {lang === "bn" ? "সাম্প্রতিক লেজার" : "Recent ledger"}
        </p>
        <ul className="max-h-48 overflow-auto space-y-1 text-[11px] text-slate-400">
          {recent.length === 0 && <li>—</li>}
          {recent.map((r) => (
            <li key={r.id} className="flex justify-between gap-2 border-b border-slate-800/80 py-1">
              <span className="truncate">
                {r.action} · {r.user_id.slice(0, 8)}…
              </span>
              <span className={r.points >= 0 ? "text-emerald-400" : "text-rose-400"}>
                {r.points >= 0 ? "+" : ""}
                {r.points}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
