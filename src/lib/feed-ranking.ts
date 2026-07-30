import { supabase } from "@/integrations/supabase/client";

export type FeedRankingSettings = {
  enabled: boolean;
  prefer_own: boolean;
  prefer_upazila: boolean;
  prefer_blood_group: boolean;
  /** Hierarchical district/upazila adjacency (geo_hop 0–5) */
  prefer_proximity: boolean;
  prefer_engagement: boolean;
  prefer_urgency: boolean;
  prefer_recency: boolean;
  score_own: number;
  /** Legacy buckets when prefer_proximity is off */
  score_same_upazila_and_blood: number;
  score_same_upazila_or_blood: number;
  score_blood_boost: number;
  score_geo_hop_0: number;
  score_geo_hop_1: number;
  score_geo_hop_2: number;
  score_geo_hop_3: number;
  score_geo_hop_4: number;
  score_geo_hop_5: number;
  max_upazila_hops: number;
  weight_like: number;
  weight_comment: number;
  weight_share: number;
  weight_critical: number;
  weight_urgent: number;
  weight_normal: number;
  recency_max: number;
  recency_half_life_hours: number;
};

export const DEFAULT_FEED_RANKING: FeedRankingSettings = {
  enabled: true,
  prefer_own: true,
  prefer_upazila: true,
  prefer_blood_group: true,
  prefer_proximity: true,
  prefer_engagement: true,
  prefer_urgency: true,
  prefer_recency: true,
  score_own: 1_000_000,
  score_same_upazila_and_blood: 200_000,
  score_same_upazila_or_blood: 100_000,
  score_blood_boost: 160_000,
  score_geo_hop_0: 500_000,
  score_geo_hop_1: 350_000,
  score_geo_hop_2: 250_000,
  score_geo_hop_3: 150_000,
  score_geo_hop_4: 80_000,
  score_geo_hop_5: 0,
  max_upazila_hops: 2,
  weight_like: 25,
  weight_comment: 40,
  weight_share: 50,
  weight_critical: 8000,
  weight_urgent: 4000,
  weight_normal: 0,
  recency_max: 5000,
  recency_half_life_hours: 72,
};

export function normalizeFeedRanking(raw: unknown): FeedRankingSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<FeedRankingSettings>;
  const n = (v: unknown, fallback: number) => {
    const x = typeof v === "number" ? v : Number(v);
    return Number.isFinite(x) ? x : fallback;
  };
  const b = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);
  return {
    enabled: b(r.enabled, DEFAULT_FEED_RANKING.enabled),
    prefer_own: b(r.prefer_own, DEFAULT_FEED_RANKING.prefer_own),
    prefer_upazila: b(r.prefer_upazila, DEFAULT_FEED_RANKING.prefer_upazila),
    prefer_blood_group: b(r.prefer_blood_group, DEFAULT_FEED_RANKING.prefer_blood_group),
    prefer_proximity: b(r.prefer_proximity, DEFAULT_FEED_RANKING.prefer_proximity),
    prefer_engagement: b(r.prefer_engagement, DEFAULT_FEED_RANKING.prefer_engagement),
    prefer_urgency: b(r.prefer_urgency, DEFAULT_FEED_RANKING.prefer_urgency),
    prefer_recency: b(r.prefer_recency, DEFAULT_FEED_RANKING.prefer_recency),
    score_own: n(r.score_own, DEFAULT_FEED_RANKING.score_own),
    score_same_upazila_and_blood: n(r.score_same_upazila_and_blood, DEFAULT_FEED_RANKING.score_same_upazila_and_blood),
    score_same_upazila_or_blood: n(r.score_same_upazila_or_blood, DEFAULT_FEED_RANKING.score_same_upazila_or_blood),
    score_blood_boost: n(r.score_blood_boost, DEFAULT_FEED_RANKING.score_blood_boost),
    score_geo_hop_0: n(r.score_geo_hop_0, DEFAULT_FEED_RANKING.score_geo_hop_0),
    score_geo_hop_1: n(r.score_geo_hop_1, DEFAULT_FEED_RANKING.score_geo_hop_1),
    score_geo_hop_2: n(r.score_geo_hop_2, DEFAULT_FEED_RANKING.score_geo_hop_2),
    score_geo_hop_3: n(r.score_geo_hop_3, DEFAULT_FEED_RANKING.score_geo_hop_3),
    score_geo_hop_4: n(r.score_geo_hop_4, DEFAULT_FEED_RANKING.score_geo_hop_4),
    score_geo_hop_5: n(r.score_geo_hop_5, DEFAULT_FEED_RANKING.score_geo_hop_5),
    max_upazila_hops: Math.max(0, Math.min(2, Math.round(n(r.max_upazila_hops, DEFAULT_FEED_RANKING.max_upazila_hops)))),
    weight_like: n(r.weight_like, DEFAULT_FEED_RANKING.weight_like),
    weight_comment: n(r.weight_comment, DEFAULT_FEED_RANKING.weight_comment),
    weight_share: n(r.weight_share, DEFAULT_FEED_RANKING.weight_share),
    weight_critical: n(r.weight_critical, DEFAULT_FEED_RANKING.weight_critical),
    weight_urgent: n(r.weight_urgent, DEFAULT_FEED_RANKING.weight_urgent),
    weight_normal: n(r.weight_normal, DEFAULT_FEED_RANKING.weight_normal),
    recency_max: n(r.recency_max, DEFAULT_FEED_RANKING.recency_max),
    recency_half_life_hours: n(r.recency_half_life_hours, DEFAULT_FEED_RANKING.recency_half_life_hours),
  };
}

let cached: FeedRankingSettings | null = null;
let cachedAt = 0;

export function invalidateFeedRankingCache() {
  cached = null;
  cachedAt = 0;
}

export async function fetchFeedRankingSettings(force = false): Promise<FeedRankingSettings> {
  if (!force && cached && Date.now() - cachedAt < 60_000) return cached;
  const { data, error } = await supabase
    .from("app_settings")
    .select("feed_ranking_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    cached = { ...DEFAULT_FEED_RANKING };
  } else {
    cached = normalizeFeedRanking((data as { feed_ranking_settings?: unknown }).feed_ranking_settings);
  }
  cachedAt = Date.now();
  return cached;
}

/** Doc sections for admin “how it works” buttons */
export type FeedRankingDocId =
  | "plan"
  | "how"
  | "hops"
  | "score"
  | "data"
  | "example"
  | "setup";

export function feedRankingDocTitle(id: FeedRankingDocId, lang: "bn" | "en"): string {
  const map: Record<FeedRankingDocId, { bn: string; en: string }> = {
    plan: { bn: "সম্পূর্ণ প্ল্যান", en: "Full plan" },
    how: { bn: "কীভাবে কাজ করে", en: "How it works" },
    hops: { bn: "geo_hop স্তরসমূহ", en: "geo_hop tiers" },
    score: { bn: "স্কোর ফর্মুলা", en: "Score formula" },
    data: { bn: "ডেটা ও টেবিল", en: "Data & tables" },
    example: { bn: "উদাহরণ (Mirpur)", en: "Example (Mirpur)" },
    setup: { bn: "সেটআপ চেকলিস্ট", en: "Setup checklist" },
  };
  return lang === "bn" ? map[id].bn : map[id].en;
}

export function feedRankingDocMarkdown(
  id: FeedRankingDocId,
  lang: "bn" | "en",
  cfg: FeedRankingSettings = DEFAULT_FEED_RANKING,
): string {
  if (id === "plan") return feedRankingPlanMarkdown(lang, cfg);

  if (id === "how") {
    return lang === "bn"
      ? `# কীভাবে ফিড র‍্যাঙ্কিং কাজ করে

1. ইউজার ফিড খোলে → ক্লায়েন্ট \`fetch_ranked_feed(viewer, …)\` RPC কল করে।
2. RPC প্রোফাইল থেকে নেয়: \`district_id\`, \`area\` (উপজেলা), \`blood_group\`।
3. প্রতিটি open রিকোয়েস্টের জন্য **geo_hop** (০–৫) হিসাব হয় — proximity গ্রাফ দিয়ে।
4. **Primary sort:** geo_hop ASC (কাছের আগে)। নিজের পোস্ট = −১।
5. **Secondary:** rank_score DESC = geo স্কোর + blood boost + urgency + engagement + recency।
6. হার্ড ফিল্টার (জেলা/ব্লাড চিপ) শুধু ইউজার ম্যানুয়ালি দিলে লাগে — র‍্যাঙ্কিং হাইড করে না।

\`\`\`
Viewer (Mirpur, A+)
        │
        ▼
  fetch_ranked_feed
        │
        ├─ hop 0  একই উপজেলা
        ├─ hop 1  পাশের উপজেলা
        ├─ hop 2  ২-হপ
        ├─ hop 3  একই জেলা
        ├─ hop 4  পাশের জেলা
        └─ hop 5  দূর
        │
        ▼
  + blood / urgency / likes → স্ক্রল অর্ডার
\`\`\`

GPS এখন ব্যবহার হয় না — শুধু জেলা/উপজেলা adjacency।`
      : `# How feed ranking works

1. Feed opens → client calls \`fetch_ranked_feed(viewer, …)\`.
2. RPC loads profile: \`district_id\`, \`area\` (upazila), \`blood_group\`.
3. Each open request gets a **geo_hop** (0–5) from the proximity graph.
4. **Primary sort:** geo_hop ASC (closer first). Own posts = −1.
5. **Secondary:** rank_score DESC = geo score + blood boost + urgency + engagement + recency.
6. Hard filters (district/blood chips) only apply when the user sets them — ranking never hides posts.

GPS is not used yet — only district/upazila adjacency.`;
  }

  if (id === "hops") {
    return lang === "bn"
      ? `# geo_hop স্তরসমূহ (বর্তমান ওজন)

| Hop | অর্থ | স্কোর |
|-----|------|-------|
| −1 | নিজের পোস্ট | ${cfg.score_own} |
| 0 | একই উপজেলা | ${cfg.score_geo_hop_0} |
| 1 | পাশের উপজেলা (\`upazila_neighbors\`) | ${cfg.score_geo_hop_1} |
| 2 | ২-হপ (\`upazila_geo_distance\`) | ${cfg.score_geo_hop_2} |
| 3 | একই জেলা, দূরের উপজেলা | ${cfg.score_geo_hop_3} |
| 4 | পাশের জেলা (\`district_neighbors\`) | ${cfg.score_geo_hop_4} |
| 5 | বাকি দেশ | ${cfg.score_geo_hop_5} |

- \`max_upazila_hops\` = ${cfg.max_upazila_hops} (০ হলে শুধু exact / same-district / district-neighbor)
- ঢাকা মেট্রো: ধানমন্ডি–কালাবাগান–মিরপুর ইত্যাদি curated edges
- অন্য জেলা: Sadar-star (প্রতিটি উপজেলা ↔ সদর)`
      : `# geo_hop tiers (current weights)

| Hop | Meaning | Score |
|-----|---------|-------|
| −1 | Own post | ${cfg.score_own} |
| 0 | Same upazila | ${cfg.score_geo_hop_0} |
| 1 | Neighbor upazila | ${cfg.score_geo_hop_1} |
| 2 | 2-hop | ${cfg.score_geo_hop_2} |
| 3 | Same district (far) | ${cfg.score_geo_hop_3} |
| 4 | Neighbor district | ${cfg.score_geo_hop_4} |
| 5 | Far | ${cfg.score_geo_hop_5} |

- \`max_upazila_hops\` = ${cfg.max_upazila_hops}
- Dhaka metro: curated neighborhood edges
- Other districts: Sadar-star graph`;
  }

  if (id === "score") {
    return lang === "bn"
      ? `# স্কোর ফর্মুলা

\`\`\`
rank_score =
  score_geo[geo_hop]
+ (same_blood ? score_blood_boost : 0)   // এখন ${cfg.score_blood_boost}
+ (own ? score_own : 0)                 // শুধু own বালতিতে
+ urgency_weight                        // critical ${cfg.weight_critical} / urgent ${cfg.weight_urgent}
+ likes×${cfg.weight_like} + comments×${cfg.weight_comment} + shares×${cfg.weight_share}
+ recency_bonus                         // max ${cfg.recency_max} over ${cfg.recency_half_life_hours}h
\`\`\`

**সর্ট:** bucket/hop ASC → rank_score DESC → created_at DESC

**Blood policy (ডিফল্ট):** hop1 + blood (${cfg.score_geo_hop_1 + cfg.score_blood_boost}) ${
          cfg.score_geo_hop_1 + cfg.score_blood_boost > cfg.score_geo_hop_0 ? ">" : "≤"
        } hop0 wrong blood (${cfg.score_geo_hop_0}) — কাছের compatible donorকে প্রাধান্য।

**Blood-first প্রিসেট:** blood boost ≥ ২০০০০০ রাখুন যাতে exact+blood সবসময় উপরে থাকে।

Proximity OFF হলে পুরনো বালতি: own / exact (${cfg.score_same_upazila_and_blood}) / partial (${cfg.score_same_upazila_or_blood})।`
      : `# Score formula

\`\`\`
rank_score =
  score_geo[geo_hop]
+ (same_blood ? score_blood_boost : 0)   // currently ${cfg.score_blood_boost}
+ (own ? score_own : 0)
+ urgency_weight
+ likes×${cfg.weight_like} + comments×${cfg.weight_comment} + shares×${cfg.weight_share}
+ recency_bonus (max ${cfg.recency_max} / ${cfg.recency_half_life_hours}h)
\`\`\`

**Sort:** hop ASC → score DESC → created_at DESC

**Blood policy:** hop1+blood vs hop0 wrong blood uses boost ${cfg.score_blood_boost}.

When proximity is OFF: legacy own / exact / partial buckets.`;
  }

  if (id === "data") {
    return lang === "bn"
      ? `# ডেটা লেয়ার

| টেবিল / ফাংশন | কাজ |
|---------------|-----|
| \`district_neighbors\` | পাশের জেলা (undirected) |
| \`upazila_neighbors\` | পাশের উপজেলা / ঢাকা মেট্রো |
| \`upazila_geo_distance\` | precomputed hop 1–2 |
| \`resolve_upazila_slug\` | area টেক্সট → slug (EN/BN) |
| \`refresh_upazila_geo_distance\` | hop টেবিল রিফ্রেশ |
| \`fetch_ranked_feed\` | ফিড RPC |
| \`app_settings.feed_ranking_settings\` | এই পেজের সব নব |

ক্যাটালগ সোর্স:
- \`src/data/district-neighbors.ts\`
- \`src/data/upazila-neighbors.ts\` (ঢাকা dense graph)

নোট: Kushtia Mirpur ≠ Dhaka Mirpur — সবসময় \`district_id\` সহ ম্যাচ।`
      : `# Data layer

| Table / function | Role |
|------------------|------|
| \`district_neighbors\` | Neighbor districts |
| \`upazila_neighbors\` | Neighbor upazilas / Dhaka metro |
| \`upazila_geo_distance\` | Precomputed hops 1–2 |
| \`resolve_upazila_slug\` | area text → slug |
| \`refresh_upazila_geo_distance\` | Rebuild hop table |
| \`fetch_ranked_feed\` | Feed RPC |
| \`app_settings.feed_ranking_settings\` | This page’s knobs |

Always match with \`district_id\` (Kushtia Mirpur ≠ Dhaka Mirpur).`;
  }

  if (id === "example") {
    return lang === "bn"
      ? `# উদাহরণ — Viewer: ঢাকা / মিরপুর / A+

| রিকোয়েস্ট এলাকা | Hop | বেস স্কোর | +A+ blood |
|------------------|-----|-----------|-----------|
| Mirpur | 0 | ${cfg.score_geo_hop_0} | ${cfg.score_geo_hop_0 + cfg.score_blood_boost} |
| Pallabi / Kafrul | 1 | ${cfg.score_geo_hop_1} | ${cfg.score_geo_hop_1 + cfg.score_blood_boost} |
| Dhanmondi (২-হপ) | 2 | ${cfg.score_geo_hop_2} | ${cfg.score_geo_hop_2 + cfg.score_blood_boost} |
| Dohar (দূর উপজেলা) | 3 | ${cfg.score_geo_hop_3} | ${cfg.score_geo_hop_3 + cfg.score_blood_boost} |
| Gazipur | 4 | ${cfg.score_geo_hop_4} | ${cfg.score_geo_hop_4 + cfg.score_blood_boost} |
| Sylhet | 5 | ${cfg.score_geo_hop_5} | ${cfg.score_geo_hop_5 + cfg.score_blood_boost} |

অর্ডার সাধারণত: Mirpur → Pallabi → Dhanmondi → … → Gazipur → Sylhet।  
Critical urgency (+${cfg.weight_critical}) একই hop-এর ভিতরে উপরে তোলে।`
      : `# Example — Viewer: Dhaka / Mirpur / A+

| Request area | Hop | Base | +A+ blood |
|--------------|-----|------|-----------|
| Mirpur | 0 | ${cfg.score_geo_hop_0} | ${cfg.score_geo_hop_0 + cfg.score_blood_boost} |
| Pallabi | 1 | ${cfg.score_geo_hop_1} | ${cfg.score_geo_hop_1 + cfg.score_blood_boost} |
| Dhanmondi | 2 | ${cfg.score_geo_hop_2} | ${cfg.score_geo_hop_2 + cfg.score_blood_boost} |
| Dohar | 3 | ${cfg.score_geo_hop_3} | ${cfg.score_geo_hop_3 + cfg.score_blood_boost} |
| Gazipur | 4 | ${cfg.score_geo_hop_4} | ${cfg.score_geo_hop_4 + cfg.score_blood_boost} |
| Sylhet | 5 | ${cfg.score_geo_hop_5} | ${cfg.score_geo_hop_5 + cfg.score_blood_boost} |

Typical order: Mirpur → neighbors → near → same district → neighbor district → far.`;
  }

  // setup
  return lang === "bn"
    ? `# সেটআপ চেকলিস্ট

1. SQL Editor-এ চালান: \`scripts/feed-ranked-feed.sql\` (কাউন্টার + settings কলাম)
2. তারপর: \`scripts/feed-proximity-ranking.sql\` (neighbors + RPC rewrite)
3. Admin → Districts → **Seed upazilas from catalog** (ঢাকা মেট্রো + proximity edges)
4. এই পেজে **Proximity গ্রাফ সিড / রিফ্রেশ** বাটন দিয়ে edges আপডেট
5. Settings → Feed ranking → টগল/স্কোর সেভ
6. ফিডে লগইন করে Mirpur প্রোফাইল দিয়ে অর্ডার যাচাই

সমস্যা হলে: neighbors টেবিল খালি, বা RPC পুরনো — SQL আবার চালান।`
    : `# Setup checklist

1. Run \`scripts/feed-ranked-feed.sql\`
2. Run \`scripts/feed-proximity-ranking.sql\`
3. Admin → Districts → Seed upazilas (includes proximity edges)
4. Use **Seed / refresh proximity graph** on this page
5. Save toggles/scores here
6. Verify feed order with a Mirpur profile

If broken: empty neighbor tables or stale RPC — re-run SQL.`;
}

export function geoScoreForHop(cfg: FeedRankingSettings, hop: number): number {
  if (hop <= -1) return cfg.score_own;
  if (hop === 0) return cfg.score_geo_hop_0;
  if (hop === 1) return cfg.score_geo_hop_1;
  if (hop === 2) return cfg.score_geo_hop_2;
  if (hop === 3) return cfg.score_geo_hop_3;
  if (hop === 4) return cfg.score_geo_hop_4;
  return cfg.score_geo_hop_5;
}

export const FEED_RANKING_PRESETS: {
  id: string;
  bn: string;
  en: string;
  apply: (base: FeedRankingSettings) => FeedRankingSettings;
}[] = [
  {
    id: "balanced",
    bn: "ব্যালান্সড (ডিফল্ট)",
    en: "Balanced (default)",
    apply: () => ({ ...DEFAULT_FEED_RANKING }),
  },
  {
    id: "blood-first",
    bn: "ব্লাড-ফার্স্ট",
    en: "Blood-first",
    apply: (b) =>
      normalizeFeedRanking({
        ...b,
        ...DEFAULT_FEED_RANKING,
        score_blood_boost: 220_000,
        prefer_blood_group: true,
        prefer_proximity: true,
      }),
  },
  {
    id: "locality-first",
    bn: "লোকালিটি-ফার্স্ট",
    en: "Locality-first",
    apply: (b) =>
      normalizeFeedRanking({
        ...b,
        ...DEFAULT_FEED_RANKING,
        score_geo_hop_0: 600_000,
        score_geo_hop_1: 400_000,
        score_geo_hop_2: 280_000,
        score_blood_boost: 50_000,
        prefer_proximity: true,
      }),
  },
  {
    id: "engagement",
    bn: "এনগেজমেন্ট হেভি",
    en: "Engagement-heavy",
    apply: (b) =>
      normalizeFeedRanking({
        ...b,
        ...DEFAULT_FEED_RANKING,
        weight_like: 80,
        weight_comment: 120,
        weight_share: 150,
        prefer_engagement: true,
      }),
  },
  {
    id: "legacy",
    bn: "লেগাসি (proximity OFF)",
    en: "Legacy (proximity OFF)",
    apply: (b) =>
      normalizeFeedRanking({
        ...b,
        ...DEFAULT_FEED_RANKING,
        prefer_proximity: false,
        prefer_upazila: true,
        prefer_blood_group: true,
      }),
  },
];

/** Full ranking plan copy for admin docs. */
export function feedRankingPlanMarkdown(lang: "bn" | "en", cfg: FeedRankingSettings = DEFAULT_FEED_RANKING): string {
  if (lang === "bn") {
    return `# ফিড পারসোনালাইজড র‍্যাঙ্কিং প্ল্যান

## লক্ষ্য
- ডিফল্টে **সব** open রিকোয়েস্ট স্ক্রল করে দেখা যায় (কিছু হাইড হয় না)।
- জেলা / ব্লাড গ্রুপ **হার্ড ফিল্টার** চাইলে ইউজার ম্যানুয়ালি চালু করতে পারে।
- দূরত্ব = **administrative proximity** (পাশের উপজেলা/জেলা গ্রাফ), GPS নয়।

## সর্ট অর্ডার (proximity ON)
1. **Bucket -1 — নিজের পোস্ট** (prefer_own)
2. **geo_hop 0** — একই উপজেলা (score ${cfg.score_geo_hop_0})
3. **geo_hop 1** — পাশের উপজেলা (score ${cfg.score_geo_hop_1})
4. **geo_hop 2** — ২-হপ উপজেলা (score ${cfg.score_geo_hop_2})
5. **geo_hop 3** — একই জেলা (score ${cfg.score_geo_hop_3})
6. **geo_hop 4** — পাশের জেলা (score ${cfg.score_geo_hop_4})
7. **geo_hop 5** — দূরের জেলা (score ${cfg.score_geo_hop_5})

প্রতিটি hop-এ একই ব্লাড হলে +${cfg.score_blood_boost} (blood boost)।  
উদাহরণ (Mirpur): Mirpur → Pallabi → Dhanmondi → Savar → Gazipur → Sylhet।

## Soft score (প্রতি বালতিতে)
- জরুরিতা: critical=${cfg.weight_critical}, urgent=${cfg.weight_urgent}, normal=${cfg.weight_normal}
- এনগেজমেন্ট: like×${cfg.weight_like} + comment×${cfg.weight_comment} + share×${cfg.weight_share}
- রেসেন্সি: সর্বোচ্চ ${cfg.recency_max}, ~${cfg.recency_half_life_hours} ঘণ্টায় ক্ষয়

## ডেটা
- \`district_neighbors\` / \`upazila_neighbors\` / \`upazila_geo_distance\`
- \`resolve_upazila_slug(district, area)\` — EN/BN/slug ম্যাচ
- RPC: \`fetch_ranked_feed\`
- সিড: Admin → Seed upazilas (neighbors auto) বা \`scripts/feed-proximity-ranking.sql\`

## স্ট্যাটাস
- Ranking: **${cfg.enabled ? "ON" : "OFF"}** | Proximity: **${cfg.prefer_proximity ? "ON" : "OFF"}**
- max_upazila_hops: ${cfg.max_upazila_hops}
`;
  }

  return `# Feed personalized ranking plan

## Goal
- Show **all** open requests by default (personalization reorders, never hides).
- Optional hard district / blood filters still work.
- Distance = **administrative proximity graph** (neighbor upazilas/districts), not GPS.

## Sort order (proximity ON)
1. **Bucket -1 — own posts** (\`prefer_own\`)
2. **geo_hop 0** — same upazila (score ${cfg.score_geo_hop_0})
3. **geo_hop 1** — neighbor upazila (score ${cfg.score_geo_hop_1})
4. **geo_hop 2** — 2-hop upazila (score ${cfg.score_geo_hop_2})
5. **geo_hop 3** — same district (score ${cfg.score_geo_hop_3})
6. **geo_hop 4** — neighbor district (score ${cfg.score_geo_hop_4})
7. **geo_hop 5** — far district (score ${cfg.score_geo_hop_5})

Same blood adds +${cfg.score_blood_boost} at any hop.  
Example (viewer Mirpur): Mirpur → Pallabi → Dhanmondi → Savar → Gazipur → Sylhet.

## Soft score
- Urgency: critical=${cfg.weight_critical}, urgent=${cfg.weight_urgent}, normal=${cfg.weight_normal}
- Engagement: like×${cfg.weight_like} + comment×${cfg.weight_comment} + share×${cfg.weight_share}
- Recency: max ${cfg.recency_max}, decays over ~${cfg.recency_half_life_hours}h

## Data
- \`district_neighbors\` / \`upazila_neighbors\` / \`upazila_geo_distance\`
- \`resolve_upazila_slug(district, area)\`
- RPC: \`fetch_ranked_feed\`
- Seed: Admin upazila seed (neighbors) or \`scripts/feed-proximity-ranking.sql\`

## Status
- Ranking: **${cfg.enabled ? "ON" : "OFF"}** | Proximity: **${cfg.prefer_proximity ? "ON" : "OFF"}**
- max_upazila_hops: ${cfg.max_upazila_hops}
`;
}
