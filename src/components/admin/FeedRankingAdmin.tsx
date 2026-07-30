import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_FEED_RANKING,
  FEED_RANKING_PRESETS,
  feedRankingDocMarkdown,
  feedRankingDocTitle,
  fetchFeedRankingSettings,
  geoScoreForHop,
  invalidateFeedRankingCache,
  normalizeFeedRanking,
  type FeedRankingDocId,
  type FeedRankingSettings,
} from "@/lib/feed-ranking";
import {
  fetchProximityGraphStats,
  refreshUpazilaGeoDistance,
  seedGeoNeighborsFromCatalog,
} from "@/lib/geo-neighbors-seed";
import {
  BookOpen,
  ChevronDown,
  Database,
  GitBranch,
  Info,
  Map,
  Network,
  RotateCcw,
  Save,
  Calculator,
  ListChecks,
  Workflow,
  X,
} from "lucide-react";
import { toast } from "sonner";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

const DOC_BUTTONS: { id: FeedRankingDocId; icon: typeof BookOpen }[] = [
  { id: "plan", icon: BookOpen },
  { id: "how", icon: Workflow },
  { id: "hops", icon: GitBranch },
  { id: "score", icon: Calculator },
  { id: "data", icon: Database },
  { id: "example", icon: Map },
  { id: "setup", icon: ListChecks },
];

type BoolKey = {
  [K in keyof FeedRankingSettings]: FeedRankingSettings[K] extends boolean ? K : never;
}[keyof FeedRankingSettings];

type NumKey = {
  [K in keyof FeedRankingSettings]: FeedRankingSettings[K] extends number ? K : never;
}[keyof FeedRankingSettings];

const BOOL_KEYS: { key: BoolKey; bn: string; en: string; hintBn: string; hintEn: string }[] = [
  {
    key: "enabled",
    bn: "পারসোনালাইজড র‍্যাঙ্কিং চালু",
    en: "Enable personalized ranking",
    hintBn: "OFF হলে urgency → created_at",
    hintEn: "When OFF: urgency → created_at",
  },
  {
    key: "prefer_own",
    bn: "নিজের পোস্ট আগে",
    en: "Prefer own posts first",
    hintBn: "geo_hop = −1",
    hintEn: "Forces geo_hop = −1",
  },
  {
    key: "prefer_proximity",
    bn: "Proximity (পাশের জেলা/উপজেলা)",
    en: "Proximity (neighbor district/upazila)",
    hintBn: "HAP গ্রাফ — geo_hop ০–৫",
    hintEn: "HAP graph — geo_hop 0–5",
  },
  {
    key: "prefer_blood_group",
    bn: "একই রক্তের গ্রুপ বোনাস",
    en: "Same blood group boost",
    hintBn: "score_blood_boost যোগ হয়",
    hintEn: "Adds score_blood_boost",
  },
  {
    key: "prefer_upazila",
    bn: "লেগাসি একই উপজেলা",
    en: "Legacy same upazila",
    hintBn: "শুধু proximity OFF-এ",
    hintEn: "Only when proximity OFF",
  },
  {
    key: "prefer_urgency",
    bn: "Critical / Urgent প্রাধান্য",
    en: "Prefer critical / urgent",
    hintBn: "soft score",
    hintEn: "Soft score inside hop",
  },
  {
    key: "prefer_engagement",
    bn: "লাইক / কমেন্ট / শেয়ার",
    en: "Likes / comments / shares",
    hintBn: "soft score",
    hintEn: "Soft score inside hop",
  },
  {
    key: "prefer_recency",
    bn: "রেসেন্সি বোনাস",
    en: "Recency bonus",
    hintBn: "নতুন পোস্ট বোনাস",
    hintEn: "Newer posts get bonus",
  },
];

const ADVANCED_GROUPS: {
  id: string;
  titleBn: string;
  titleEn: string;
  keys: { key: NumKey; bn: string; en: string }[];
}[] = [
  {
    id: "geo",
    titleBn: "Proximity geo_hop স্কোর",
    titleEn: "Proximity geo_hop scores",
    keys: [
      { key: "score_own", bn: "Own (−1)", en: "Own (−1)" },
      { key: "score_geo_hop_0", bn: "Hop 0 exact", en: "Hop 0 exact" },
      { key: "score_geo_hop_1", bn: "Hop 1 neighbor", en: "Hop 1 neighbor" },
      { key: "score_geo_hop_2", bn: "Hop 2 near", en: "Hop 2 near" },
      { key: "score_geo_hop_3", bn: "Hop 3 same district", en: "Hop 3 same district" },
      { key: "score_geo_hop_4", bn: "Hop 4 neighbor district", en: "Hop 4 neighbor district" },
      { key: "score_geo_hop_5", bn: "Hop 5 far", en: "Hop 5 far" },
      { key: "score_blood_boost", bn: "Blood boost", en: "Blood boost" },
      { key: "max_upazila_hops", bn: "Max upazila hops (0–2)", en: "Max upazila hops (0–2)" },
    ],
  },
  {
    id: "legacy",
    titleBn: "লেগাসি বালতি (proximity OFF)",
    titleEn: "Legacy buckets (proximity OFF)",
    keys: [
      { key: "score_same_upazila_and_blood", bn: "Exact upazila+blood", en: "Exact upazila+blood" },
      { key: "score_same_upazila_or_blood", bn: "Partial match", en: "Partial match" },
    ],
  },
  {
    id: "urgency",
    titleBn: "জরুরিতা ওজন",
    titleEn: "Urgency weights",
    keys: [
      { key: "weight_critical", bn: "Critical", en: "Critical" },
      { key: "weight_urgent", bn: "Urgent", en: "Urgent" },
      { key: "weight_normal", bn: "Normal", en: "Normal" },
    ],
  },
  {
    id: "engagement",
    titleBn: "এনগেজমেন্ট ওজন",
    titleEn: "Engagement weights",
    keys: [
      { key: "weight_like", bn: "Per like", en: "Per like" },
      { key: "weight_comment", bn: "Per comment", en: "Per comment" },
      { key: "weight_share", bn: "Per share", en: "Per share" },
    ],
  },
  {
    id: "recency",
    titleBn: "রেসেন্সি",
    titleEn: "Recency",
    keys: [
      { key: "recency_max", bn: "Max bonus", en: "Max bonus" },
      { key: "recency_half_life_hours", bn: "Decay hours", en: "Decay hours" },
    ],
  },
];

const SIM_HOPS = [
  { hop: 0, bn: "Mirpur (exact)", en: "Mirpur (exact)" },
  { hop: 1, bn: "Pallabi (neighbor)", en: "Pallabi (neighbor)" },
  { hop: 2, bn: "Dhanmondi (2-hop)", en: "Dhanmondi (2-hop)" },
  { hop: 3, bn: "Dohar (same district)", en: "Dohar (same district)" },
  { hop: 4, bn: "Gazipur (neighbor district)", en: "Gazipur (neighbor district)" },
  { hop: 5, bn: "Sylhet (far)", en: "Sylhet (far)" },
];

export function FeedRankingAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const [cfg, setCfg] = useState<FeedRankingSettings>({ ...DEFAULT_FEED_RANKING });
  const [busy, setBusy] = useState(false);
  const [docId, setDocId] = useState<FeedRankingDocId | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    geo: true,
    legacy: false,
    urgency: false,
    engagement: false,
    recency: false,
  });
  const [simBlood, setSimBlood] = useState(true);
  const [simUrgency, setSimUrgency] = useState<"normal" | "urgent" | "critical">("normal");
  const [graphBusy, setGraphBusy] = useState(false);
  const [stats, setStats] = useState<{
    districtEdges: number;
    upazilaEdges: number;
    hopPairs: number;
    ready: boolean;
    error?: string;
  } | null>(null);

  useEffect(() => {
    fetchFeedRankingSettings(true).then(setCfg);
    void fetchProximityGraphStats().then(setStats);
  }, []);

  const normalized = useMemo(() => normalizeFeedRanking(cfg), [cfg]);

  const simRows = useMemo(() => {
    const urg =
      simUrgency === "critical"
        ? normalized.weight_critical
        : simUrgency === "urgent"
          ? normalized.weight_urgent
          : normalized.weight_normal;
    return SIM_HOPS.map((row) => {
      const base = geoScoreForHop(normalized, row.hop);
      const blood = simBlood && normalized.prefer_blood_group ? normalized.score_blood_boost : 0;
      const total = base + blood + (normalized.prefer_urgency ? urg : 0);
      return { ...row, base, blood, urg: normalized.prefer_urgency ? urg : 0, total };
    }).sort((a, b) => a.hop - b.hop || b.total - a.total);
  }, [normalized, simBlood, simUrgency]);

  async function save() {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    setBusy(true);
    const next = normalizeFeedRanking(cfg);
    const { error } = await supabase.from("app_settings").upsert({
      id: 1,
      feed_ranking_settings: next,
    });
    setBusy(false);
    if (error) {
      if (/feed_ranking_settings|column/i.test(error.message)) {
        return toast.error(
          lang === "bn"
            ? "DB কলাম নেই — scripts/feed-ranked-feed.sql ও scripts/feed-proximity-ranking.sql চালান"
            : "Missing DB column — run scripts/feed-ranked-feed.sql and scripts/feed-proximity-ranking.sql",
        );
      }
      return toast.error(error.message);
    }
    setCfg(next);
    invalidateFeedRankingCache();
    toast.success(lang === "bn" ? "ফিড র‍্যাঙ্কিং সেভ হয়েছে" : "Feed ranking saved");
  }

  async function seedGraph() {
    if (!can("settings.edit") && !can("districts.add")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    setGraphBusy(true);
    try {
      const r = await seedGeoNeighborsFromCatalog();
      setStats(await fetchProximityGraphStats());
      toast.success(
        lang === "bn"
          ? `Proximity সিড: ${r.districts} জেলা + ${r.upazilas} উপজেলা এজ`
          : `Proximity seeded: ${r.districts} district + ${r.upazilas} upazila edges`,
      );
    } catch (e) {
      toast.error(
        lang === "bn"
          ? `সিড ব্যর্থ — SQL চালান? ${(e as Error).message}`
          : `Seed failed — run SQL? ${(e as Error).message}`,
      );
    } finally {
      setGraphBusy(false);
    }
  }

  async function refreshHops() {
    setGraphBusy(true);
    try {
      const n = await refreshUpazilaGeoDistance();
      setStats(await fetchProximityGraphStats());
      toast.success(lang === "bn" ? `Hop টেবিল রিফ্রেশ: ${n} জোড়া` : `Hop table refreshed: ${n} pairs`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setGraphBusy(false);
    }
  }

  function toggleGroup(id: string) {
    setOpenGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header + actions */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Network className="h-4 w-4 text-rose-400" />
              {lang === "bn" ? "ফিড পারসোনালাইজড র‍্যাঙ্কিং" : "Feed personalized ranking"}
            </h3>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              {lang === "bn"
                ? "সব পোস্ট দেখা যায়; অর্ডার proximity + blood + urgency। নিচের বাটনে প্ল্যান/হাউ-ইট-ওয়ার্কস দেখুন; অ্যাডভান্স দিয়ে সব ওজন ম্যানেজ করুন।"
                : "All posts stay visible; order uses proximity + blood + urgency. Use doc buttons below; manage every weight in Advanced."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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

        {/* Doc buttons */}
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1">
            <Info className="h-3 w-3" />
            {lang === "bn" ? "ডকুমেন্টেশন — ক্লিক করে দেখুন" : "Documentation — click to view"}
          </p>
          <div className="flex flex-wrap gap-2">
            {DOC_BUTTONS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setDocId(id)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-950 px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-rose-500/50 hover:bg-slate-800"
              >
                <Icon className="h-3.5 w-3.5 text-rose-400" />
                {feedRankingDocTitle(id, lang)}
              </button>
            ))}
          </div>
        </div>

        {/* Presets */}
        <div>
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">
            {lang === "bn" ? "প্রিসেট (সেভ করতে ভুলবেন না)" : "Presets (remember to Save)"}
          </p>
          <div className="flex flex-wrap gap-2">
            {FEED_RANKING_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setCfg(p.apply(cfg))}
                className="rounded-lg border border-slate-700 bg-slate-950/80 px-2.5 py-1.5 text-[11px] text-slate-300 hover:border-slate-500 hover:text-white"
              >
                {lang === "bn" ? p.bn : p.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Feature toggles */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {lang === "bn" ? "ফিচার টগল" : "Feature toggles"}
        </h4>
        <div className="grid gap-2 sm:grid-cols-2">
          {BOOL_KEYS.map((item) => (
            <label
              key={item.key}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5"
            >
              <span>
                <span className="block text-xs text-slate-200">{lang === "bn" ? item.bn : item.en}</span>
                <span className="block text-[10px] text-slate-500 mt-0.5">
                  {lang === "bn" ? item.hintBn : item.hintEn}
                </span>
              </span>
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

      {/* Proximity graph tools */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {lang === "bn" ? "Proximity গ্রাফ ম্যানেজ" : "Proximity graph manage"}
        </h4>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-2">
            <div className="text-lg font-semibold text-slate-100">{stats?.districtEdges ?? "—"}</div>
            <div className="text-[10px] text-slate-500">{lang === "bn" ? "জেলা এজ" : "District edges"}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-2">
            <div className="text-lg font-semibold text-slate-100">{stats?.upazilaEdges ?? "—"}</div>
            <div className="text-[10px] text-slate-500">{lang === "bn" ? "উপজেলা এজ" : "Upazila edges"}</div>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 px-2 py-2">
            <div className="text-lg font-semibold text-slate-100">{stats?.hopPairs ?? "—"}</div>
            <div className="text-[10px] text-slate-500">{lang === "bn" ? "Hop জোড়া" : "Hop pairs"}</div>
          </div>
        </div>
        {stats && !stats.ready && (
          <p className="text-[11px] text-amber-400/90">
            {lang === "bn"
              ? `টেবিল নেই বা খালি — scripts/feed-proximity-ranking.sql চালান। ${stats.error ?? ""}`
              : `Tables missing/empty — run scripts/feed-proximity-ranking.sql. ${stats.error ?? ""}`}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={graphBusy}
            onClick={() => void seedGraph()}
            className="rounded-lg bg-slate-100 text-slate-900 px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {lang === "bn" ? "ক্যাটালগ থেকে সিড" : "Seed from catalog"}
          </button>
          <button
            type="button"
            disabled={graphBusy}
            onClick={() => void refreshHops()}
            className="rounded-lg border border-slate-600 px-3 py-2 text-xs text-slate-200 disabled:opacity-50"
          >
            {lang === "bn" ? "Hop টেবিল রিফ্রেশ" : "Refresh hop table"}
          </button>
          <button
            type="button"
            disabled={graphBusy}
            onClick={() => void fetchProximityGraphStats().then(setStats)}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400"
          >
            {lang === "bn" ? "স্ট্যাটস রিলোড" : "Reload stats"}
          </button>
        </div>
      </div>

      {/* Live score simulator */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          {lang === "bn" ? "লাইভ স্কোর সিমুলেটর (Mirpur viewer)" : "Live score simulator (Mirpur viewer)"}
        </h4>
        <div className="flex flex-wrap gap-3 items-center text-xs text-slate-300">
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" checked={simBlood} onChange={(e) => setSimBlood(e.target.checked)} />
            {lang === "bn" ? "একই ব্লাড" : "Same blood"}
          </label>
          <label className="inline-flex items-center gap-2">
            {lang === "bn" ? "জরুরিতা" : "Urgency"}
            <select
              className={ainp + " w-auto"}
              value={simUrgency}
              onChange={(e) => setSimUrgency(e.target.value as typeof simUrgency)}
            >
              <option value="normal">normal</option>
              <option value="urgent">urgent</option>
              <option value="critical">critical</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-[11px]">
            <thead className="bg-slate-950 text-slate-400">
              <tr>
                <th className="px-2 py-1.5">Area</th>
                <th className="px-2 py-1.5">Hop</th>
                <th className="px-2 py-1.5">Geo</th>
                <th className="px-2 py-1.5">Blood</th>
                <th className="px-2 py-1.5">Urg</th>
                <th className="px-2 py-1.5">Total</th>
              </tr>
            </thead>
            <tbody>
              {simRows.map((r) => (
                <tr key={r.hop} className="border-t border-slate-800 text-slate-200">
                  <td className="px-2 py-1.5">{lang === "bn" ? r.bn : r.en}</td>
                  <td className="px-2 py-1.5">{r.hop}</td>
                  <td className="px-2 py-1.5 tabular-nums">{r.base.toLocaleString()}</td>
                  <td className="px-2 py-1.5 tabular-nums">{r.blood.toLocaleString()}</td>
                  <td className="px-2 py-1.5 tabular-nums">{r.urg.toLocaleString()}</td>
                  <td className="px-2 py-1.5 tabular-nums font-semibold text-rose-300">{r.total.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-slate-500">
          {lang === "bn"
            ? "সর্ট: আগে hop ASC, তারপর total DESC। এনগেজমেন্ট/রেসেন্সি আলাদাভাবে যোগ হয়।"
            : "Sort: hop ASC first, then total DESC. Engagement/recency add separately."}
        </p>
      </div>

      {/* Advanced scores */}
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-800/40"
        >
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            {lang === "bn" ? "অ্যাডভান্স স্কোর ও ওজন" : "Advanced scores & weights"}
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-400 transition ${showAdvanced ? "rotate-180" : ""}`} />
        </button>
        {showAdvanced && (
          <div className="border-t border-slate-800 p-4 space-y-3">
            {ADVANCED_GROUPS.map((group) => (
              <div key={group.id} className="rounded-lg border border-slate-800 overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex w-full items-center justify-between bg-slate-950/50 px-3 py-2 text-left"
                >
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                    {lang === "bn" ? group.titleBn : group.titleEn}
                  </span>
                  <ChevronDown
                    className={`h-3.5 w-3.5 text-slate-500 transition ${openGroups[group.id] ? "rotate-180" : ""}`}
                  />
                </button>
                {openGroups[group.id] && (
                  <div className="grid gap-3 p-3 sm:grid-cols-3">
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
                )}
              </div>
            ))}
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {lang === "bn" ? "অ্যাডভান্স সেভ" : "Save advanced"}
            </button>
          </div>
        )}
      </div>

      {/* Doc modal */}
      {docId && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 p-4" onClick={() => setDocId(null)}>
          <div
            className="max-h-[85dvh] w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 px-4 py-3">
              <h3 className="text-sm font-semibold text-slate-100">{feedRankingDocTitle(docId, lang)}</h3>
              <button
                type="button"
                onClick={() => setDocId(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 border-b border-slate-800 px-3 py-2">
              {DOC_BUTTONS.map(({ id }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDocId(id)}
                  className={`rounded-md px-2 py-1 text-[10px] ${
                    docId === id ? "bg-rose-600 text-white" : "bg-slate-900 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {feedRankingDocTitle(id, lang)}
                </button>
              ))}
            </div>
            <pre className="flex-1 overflow-auto p-4 text-xs leading-relaxed text-slate-300 whitespace-pre-wrap font-sans">
              {feedRankingDocMarkdown(docId, lang, normalized)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
