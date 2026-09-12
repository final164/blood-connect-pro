import { supabase } from "@/integrations/supabase/client";

export type RewardLevelDef = {
  level: number;
  min_lifetime: number;
  name_bn: string;
  name_en: string;
};

export type RewardsSettings = {
  enabled: boolean;
  signup_points: number;
  post_request_points: number;
  donation_confirmed_points: number;
  request_fulfilled_points: number;
  like_points: number;
  comment_points: number;
  share_points: number;
  enable_signup: boolean;
  enable_post_request: boolean;
  enable_donation_confirmed: boolean;
  enable_request_fulfilled: boolean;
  enable_like: boolean;
  enable_comment: boolean;
  enable_share: boolean;
  daily_earn_cap: number;
  post_daily_cap: number;
  engage_daily_cap: number;
  levels: RewardLevelDef[];
};

export const DEFAULT_REWARD_LEVELS: RewardLevelDef[] = [
  { level: 1, min_lifetime: 0, name_bn: "নবীন", name_en: "Newcomer" },
  { level: 2, min_lifetime: 100, name_bn: "সহযোগী", name_en: "Helper" },
  { level: 3, min_lifetime: 500, name_bn: "অভিযাত্রী", name_en: "Trailblazer" },
  { level: 4, min_lifetime: 2000, name_bn: "রক্তযোদ্ধা", name_en: "Blood Warrior" },
  { level: 5, min_lifetime: 5000, name_bn: "রক্ষক", name_en: "Guardian" },
  { level: 6, min_lifetime: 10000, name_bn: "লিজেন্ড", name_en: "Legend" },
];

export const DEFAULT_REWARDS_SETTINGS: RewardsSettings = {
  enabled: true,
  signup_points: 50,
  post_request_points: 20,
  donation_confirmed_points: 2000,
  request_fulfilled_points: 30,
  like_points: 2,
  comment_points: 5,
  share_points: 8,
  enable_signup: true,
  enable_post_request: true,
  enable_donation_confirmed: true,
  enable_request_fulfilled: true,
  enable_like: false,
  enable_comment: false,
  enable_share: false,
  daily_earn_cap: 400,
  post_daily_cap: 3,
  engage_daily_cap: 20,
  levels: DEFAULT_REWARD_LEVELS,
};

let cache: RewardsSettings | null = null;
let cachedAt = 0;

export function invalidateRewardsSettingsCache() {
  cache = null;
  cachedAt = 0;
}

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

function normalizeLevels(raw: unknown): RewardLevelDef[] {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_REWARD_LEVELS.map((l) => ({ ...l }));
  const out: RewardLevelDef[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    out.push({
      level: clampInt(r.level, 1, 99, out.length + 1),
      min_lifetime: clampInt(r.min_lifetime, 0, 10_000_000, 0),
      name_bn:
        typeof r.name_bn === "string" && r.name_bn.trim()
          ? r.name_bn.trim()
          : `লেভেল ${out.length + 1}`,
      name_en:
        typeof r.name_en === "string" && r.name_en.trim()
          ? r.name_en.trim()
          : `Level ${out.length + 1}`,
    });
  }
  return out.length ? out.sort((a, b) => a.min_lifetime - b.min_lifetime) : DEFAULT_REWARD_LEVELS.map((l) => ({ ...l }));
}

export function normalizeRewardsSettings(raw: unknown): RewardsSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<RewardsSettings>;
  const d = DEFAULT_REWARDS_SETTINGS;
  return {
    enabled: r.enabled !== false,
    signup_points: clampInt(r.signup_points, 0, 100_000, d.signup_points),
    post_request_points: clampInt(r.post_request_points, 0, 100_000, d.post_request_points),
    donation_confirmed_points: clampInt(
      r.donation_confirmed_points,
      0,
      1_000_000,
      d.donation_confirmed_points,
    ),
    request_fulfilled_points: clampInt(
      r.request_fulfilled_points,
      0,
      100_000,
      d.request_fulfilled_points,
    ),
    like_points: clampInt(r.like_points, 0, 10_000, d.like_points),
    comment_points: clampInt(r.comment_points, 0, 10_000, d.comment_points),
    share_points: clampInt(r.share_points, 0, 10_000, d.share_points),
    enable_signup: r.enable_signup !== false,
    enable_post_request: r.enable_post_request !== false,
    enable_donation_confirmed: r.enable_donation_confirmed !== false,
    enable_request_fulfilled: r.enable_request_fulfilled !== false,
    enable_like: r.enable_like === true,
    enable_comment: r.enable_comment === true,
    enable_share: r.enable_share === true,
    daily_earn_cap: clampInt(r.daily_earn_cap, 0, 1_000_000, d.daily_earn_cap),
    post_daily_cap: clampInt(r.post_daily_cap, 0, 100, d.post_daily_cap),
    engage_daily_cap: clampInt(r.engage_daily_cap, 0, 500, d.engage_daily_cap),
    levels: normalizeLevels(r.levels),
  };
}

export async function fetchRewardsSettings(force = false): Promise<RewardsSettings> {
  if (!force && cache && Date.now() - cachedAt < 60_000) return cache;
  const { data, error } = await supabase
    .from("app_settings")
    .select("rewards_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    cache = { ...DEFAULT_REWARDS_SETTINGS, levels: DEFAULT_REWARD_LEVELS.map((l) => ({ ...l })) };
  } else {
    cache = normalizeRewardsSettings(
      (data as { rewards_settings?: unknown }).rewards_settings,
    );
  }
  cachedAt = Date.now();
  return cache;
}

export async function saveRewardsSettings(next: RewardsSettings) {
  const normalized = normalizeRewardsSettings(next);
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    rewards_settings: normalized,
  } as never);
  if (!error) {
    cache = normalized;
    cachedAt = Date.now();
  }
  return { error, settings: normalized };
}

export function levelName(
  settings: RewardsSettings,
  level: number,
  lang: "bn" | "en",
): string {
  const row =
    settings.levels.find((l) => l.level === level) ??
    [...settings.levels].reverse().find((l) => l.level <= level);
  if (!row) return lang === "bn" ? `লেভেল ${level}` : `Level ${level}`;
  return lang === "bn" ? row.name_bn : row.name_en;
}

export function levelForLifetime(settings: RewardsSettings, lifetime: number): number {
  let lvl = 1;
  for (const row of [...settings.levels].sort((a, b) => a.min_lifetime - b.min_lifetime)) {
    if (lifetime >= row.min_lifetime) lvl = row.level;
  }
  return lvl;
}
