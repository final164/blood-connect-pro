import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_FEED_RANKING,
  feedRankingPlanMarkdown,
  fetchFeedRankingSettings,
  invalidateFeedRankingCache,
  normalizeFeedRanking,
  type FeedRankingSettings,
} from "@/lib/feed-ranking";
import { BookOpen, RotateCcw, Save, X } from "lucide-react";
import { toast } from "sonner";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

type BoolKey = {
  [K in keyof FeedRankingSettings]: FeedRankingSettings[K] extends boolean ? K : never;
}[keyof FeedRankingSettings];

type NumKey = {
  [K in keyof FeedRankingSettings]: FeedRankingSettings[K] extends number ? K : never;
}[keyof FeedRankingSettings];

const BOOL_KEYS: { key: BoolKey; bn: string; en: string }[] = [
  { key: "enabled", bn: "পারসোনালাইজড র‍্যাঙ্কিং চালু", en: "Enable personalized ranking" },
  { key: "prefer_own", bn: "নিজের পোস্ট আগে", en: "Prefer own posts first" },
  { key: "prefer_upazila", bn: "একই উপজেলা প্রাধান্য", en: "Prefer same upazila" },
  { key: "prefer_blood_group", bn: "একই রক্তের গ্রুপ প্রাধান্য", en: "Prefer same blood group" },
  { key: "prefer_urgency", bn: "Critical / Urgent প্রাধান্য", en: "Prefer critical / urgent" },
  { key: "prefer_engagement", bn: "লাইক / কমেন্ট / শেয়ার প্রাধান্য", en: "Prefer likes / comments / shares" },
  { key: "prefer_recency", bn: "নতুন পোস্ট রেসেন্সি বোনাস", en: "Recency bonus for newer posts" },
];

const NUM_GROUPS: { titleBn: string; titleEn: string; keys: { key: NumKey; bn: string; en: string }[] }[] = [
  {
    titleBn: "বালতি বেস স্কোর",
    titleEn: "Bucket base scores",
    keys: [
      { key: "score_own", bn: "নিজের পোস্ট", en: "Own posts" },
      { key: "score_same_upazila_and_blood", bn: "উপজেলা + ব্লাড ম্যাচ", en: "Upazila + blood match" },
      { key: "score_same_upazila_or_blood", bn: "উপজেলা বা ব্লাড ম্যাচ", en: "Upazila or blood match" },
    ],
  },
  {
    titleBn: "জরুরিতা ওজন",
    titleEn: "Urgency weights",
    keys: [
      { key: "weight_critical", bn: "Critical", en: "Critical" },
      { key: "weight_urgent", bn: "Urgent", en: "Urgent" },
      { key: "weight_normal", bn: "Normal", en: "Normal" },
    ],
  },
  {
    titleBn: "এনগেজমেন্ট ওজন",
    titleEn: "Engagement weights",
    keys: [
      { key: "weight_like", bn: "প্রতি লাইক", en: "Per like" },
      { key: "weight_comment", bn: "প্রতি কমেন্ট", en: "Per comment" },
      { key: "weight_share", bn: "প্রতি শেয়ার", en: "Per share" },
    ],
  },
  {
    titleBn: "রেসেন্সি",
    titleEn: "Recency",
    keys: [
      { key: "recency_max", bn: "সর্বোচ্চ বোনাস", en: "Max bonus" },
      { key: "recency_half_life_hours", bn: "ক্ষয় সময় (ঘণ্টা)", en: "Decay window (hours)" },
    ],
  },
];

export function FeedRankingAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const [cfg, setCfg] = useState<FeedRankingSettings>({ ...DEFAULT_FEED_RANKING });
  const [busy, setBusy] = useState(false);
  const [showPlan, setShowPlan] = useState(false);

  useEffect(() => {
    fetchFeedRankingSettings(true).then(setCfg);
  }, []);

  async function save() {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    setBusy(true);
    const normalized = normalizeFeedRanking(cfg);
    const { error } = await supabase.from("app_settings").upsert({
      id: 1,
      feed_ranking_settings: normalized,
    });
    setBusy(false);
    if (error) {
      if (/feed_ranking_settings|column/i.test(error.message)) {
        return toast.error(
          lang === "bn"
            ? "DB কলাম নেই — scripts/feed-ranked-feed.sql চালান"
            : "Missing DB column — run scripts/feed-ranked-feed.sql",
        );
      }
      return toast.error(error.message);
    }
    setCfg(normalized);
    invalidateFeedRankingCache();
    toast.success(lang === "bn" ? "ফিড র‍্যাঙ্কিং সেভ হয়েছে" : "Feed ranking saved");
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              {lang === "bn" ? "ফিড পারসোনালাইজড র‍্যাঙ্কিং" : "Feed personalized ranking"}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {lang === "bn"
                ? "সব পোস্ট দেখা যায়; অর্ডার ব্যক্তিগত। জেলা/ব্লাড হার্ড ফিল্টার আলাদাভাবে কাজ করে।"
                : "All posts stay visible; order is personalized. District/blood hard filters still work when set."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowPlan(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              <BookOpen className="h-3.5 w-3.5" />
              {lang === "bn" ? "সম্পূর্ণ প্ল্যান দেখুন" : "View full plan"}
            </button>
            <button
              type="button"
              onClick={() => setCfg({ ...DEFAULT_FEED_RANKING })}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400 hover:text-slate-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {lang === "bn" ? "ডিফল্ট" : "Defaults"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {busy ? (lang === "bn" ? "সেভ…" : "Saving…") : lang === "bn" ? "সেভ" : "Save"}
            </button>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          {BOOL_KEYS.map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5"
            >
              <span className="text-xs text-slate-200">{lang === "bn" ? item.bn : item.en}</span>
              <button
                type="button"
                role="switch"
                aria-checked={cfg[item.key]}
                onClick={() => setCfg((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                  cfg[item.key] ? "bg-rose-600" : "bg-slate-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    cfg[item.key] ? "translate-x-5" : ""
                  }`}
                />
              </button>
            </label>
          ))}
        </div>
      </div>

      {NUM_GROUPS.map((group) => (
        <div key={group.titleEn} className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {lang === "bn" ? group.titleBn : group.titleEn}
          </h4>
          <div className="grid gap-3 sm:grid-cols-3">
            {group.keys.map((item) => (
              <label key={item.key} className="block space-y-1">
                <span className="text-[11px] text-slate-400">{lang === "bn" ? item.bn : item.en}</span>
                <input
                  className={ainp}
                  type="number"
                  value={cfg[item.key]}
                  onChange={(e) =>
                    setCfg((prev) => ({
                      ...prev,
                      [item.key]: Number(e.target.value),
                    }))
                  }
                />
              </label>
            ))}
          </div>
        </div>
      ))}

      {showPlan && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={() => setShowPlan(false)}>
          <div
            className="max-h-[85dvh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-100">
                {lang === "bn" ? "র‍্যাঙ্কিং সম্পূর্ণ প্ল্যান" : "Full ranking plan"}
              </h3>
              <button
                type="button"
                onClick={() => setShowPlan(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap font-sans">
              {feedRankingPlanMarkdown(lang, normalizeFeedRanking(cfg))}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
