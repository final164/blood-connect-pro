import { supabase } from "@/integrations/supabase/client";

export type FeedRankingSettings = {
  enabled: boolean;
  prefer_own: boolean;
  prefer_upazila: boolean;
  prefer_blood_group: boolean;
  prefer_engagement: boolean;
  prefer_urgency: boolean;
  prefer_recency: boolean;
  score_own: number;
  score_same_upazila_and_blood: number;
  score_same_upazila_or_blood: number;
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
  prefer_engagement: true,
  prefer_urgency: true,
  prefer_recency: true,
  score_own: 1_000_000,
  score_same_upazila_and_blood: 200_000,
  score_same_upazila_or_blood: 100_000,
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
    prefer_engagement: b(r.prefer_engagement, DEFAULT_FEED_RANKING.prefer_engagement),
    prefer_urgency: b(r.prefer_urgency, DEFAULT_FEED_RANKING.prefer_urgency),
    prefer_recency: b(r.prefer_recency, DEFAULT_FEED_RANKING.prefer_recency),
    score_own: n(r.score_own, DEFAULT_FEED_RANKING.score_own),
    score_same_upazila_and_blood: n(r.score_same_upazila_and_blood, DEFAULT_FEED_RANKING.score_same_upazila_and_blood),
    score_same_upazila_or_blood: n(r.score_same_upazila_or_blood, DEFAULT_FEED_RANKING.score_same_upazila_or_blood),
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

/** Full ranking plan copy for admin “View plan” modal (bn + en). */
export function feedRankingPlanMarkdown(lang: "bn" | "en", cfg: FeedRankingSettings = DEFAULT_FEED_RANKING): string {
  if (lang === "bn") {
    return `# ফিড পারসোনালাইজড র‍্যাঙ্কিং প্ল্যান

## লক্ষ্য
- ডিফল্টে **সব** open রিকোয়েস্ট স্ক্রল করে দেখা যায় (কিছু হাইড হয় না)।
- জেলা / ব্লাড গ্রুপ **হার্ড ফিল্টার** চাইলে ইউজার ম্যানুয়ালি চালু করতে পারে — ফিল্টারের ভিতরেও একই র‍্যাঙ্কিং।
- অটো-ফিল্টার (প্রোফাইল থেকে জোর করে ফিল্টার) আলাদা সেটিং; র‍্যাঙ্কিং আলাদা।

## সর্ট অর্ডার (বালতি → স্কোর → সময়)
1. **Bucket 0 — নিজের পোস্ট** (prefer_own): \`requester_id = viewer\`
2. **Bucket 1 — এক্স্যাক্ট ম্যাচ** (prefer_upazila + prefer_blood_group): একই উপজেলা (\`area\`) **এবং** একই রক্তের গ্রুপ
3. **Bucket 2 — পার্শিয়াল ম্যাচ**: একই উপজেলা **অথবা** একই রক্তের গ্রুপ
4. **Bucket 3 — বাকি সব**

প্রত্যেক বালতির ভিতরে **soft score** বেশি হলে আগে:
- জরুরিতা: critical=${cfg.weight_critical}, urgent=${cfg.weight_urgent}, normal=${cfg.weight_normal}
- এনগেজমেন্ট: like×${cfg.weight_like} + comment×${cfg.weight_comment} + share×${cfg.weight_share}
- রেসেন্সি: সর্বোচ্চ ${cfg.recency_max}, প্রায় ${cfg.recency_half_life_hours} ঘণ্টায় ক্ষয়

বালতি বেস স্কোর: own=${cfg.score_own}, exact=${cfg.score_same_upazila_and_blood}, partial=${cfg.score_same_upazila_or_blood}

## ডেটা
- \`blood_requests.area\` = উপজেলা (কম্পোজারে সেভ)
- \`like_count\` / \`comment_count\` / \`share_count\` ডিনরমালাইজড + ট্রিগার
- RPC: \`fetch_ranked_feed(viewer, limit, offset, blood?, district?)\`
- অ্যাডমিন কন্ট্রোল: \`app_settings.feed_ranking_settings\`

## বর্তমান স্ট্যাটাস
- Ranking enabled: **${cfg.enabled ? "ON" : "OFF"}**
- OFF হলে: পুরনো মতো urgency → created_at (ফিল্টার একইভাবে কাজ করে)
`;
  }

  return `# Feed personalized ranking plan

## Goal
- By default show **all** open requests (nothing hidden by personalization).
- Optional **hard** district / blood filters still available; ranking applies inside the filtered set.
- Auto-filter from profile is separate from ranking.

## Sort order (bucket → score → time)
1. **Bucket 0 — own posts** (\`prefer_own\`): \`requester_id = viewer\`
2. **Bucket 1 — exact match** (\`prefer_upazila\` + \`prefer_blood_group\`): same upazila (\`area\`) **and** same blood group
3. **Bucket 2 — partial match**: same upazila **or** same blood group
4. **Bucket 3 — everyone else**

Within each bucket, higher **soft score** ranks first:
- Urgency: critical=${cfg.weight_critical}, urgent=${cfg.weight_urgent}, normal=${cfg.weight_normal}
- Engagement: like×${cfg.weight_like} + comment×${cfg.weight_comment} + share×${cfg.weight_share}
- Recency: max ${cfg.recency_max}, decays over ~${cfg.recency_half_life_hours}h

Bucket base scores: own=${cfg.score_own}, exact=${cfg.score_same_upazila_and_blood}, partial=${cfg.score_same_upazila_or_blood}

## Data
- \`blood_requests.area\` = upazila (saved from composer)
- Denormalized \`like_count\` / \`comment_count\` / \`share_count\` + triggers
- RPC: \`fetch_ranked_feed(viewer, limit, offset, blood?, district?)\`
- Admin: \`app_settings.feed_ranking_settings\`

## Current status
- Ranking enabled: **${cfg.enabled ? "ON" : "OFF"}**
- When OFF: legacy urgency → created_at (filters still work)
`;
}
