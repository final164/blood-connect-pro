import { supabase } from "@/integrations/supabase/client";
import {
  fetchRewardsSettings,
  levelName,
  type RewardsSettings,
} from "@/lib/rewards-settings";

export type RewardLedgerRow = {
  id: string;
  user_id: string;
  points: number;
  kind: "earn" | "spend" | "adjust" | "expire" | string;
  action: string;
  event_key: string;
  ref_type: string | null;
  ref_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type RewardProfileStats = {
  reward_points: number;
  reward_lifetime_earned: number;
  reward_level: number;
};

export async function fetchMyRewardStats(userId: string): Promise<RewardProfileStats> {
  const { data, error } = await supabase
    .from("profiles")
    .select("reward_points, reward_lifetime_earned, reward_level")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) {
    return { reward_points: 0, reward_lifetime_earned: 0, reward_level: 1 };
  }
  const row = data as Record<string, unknown>;
  return {
    reward_points: Number(row.reward_points) || 0,
    reward_lifetime_earned: Number(row.reward_lifetime_earned) || 0,
    reward_level: Number(row.reward_level) || 1,
  };
}

export async function fetchRewardLedger(
  userId: string,
  limit = 40,
): Promise<RewardLedgerRow[]> {
  const { data, error } = await supabase
    .from("reward_ledger")
    .select("id, user_id, points, kind, action, event_key, ref_type, ref_id, meta, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as RewardLedgerRow[]).map((r) => ({
    ...r,
    meta: (r.meta && typeof r.meta === "object" ? r.meta : {}) as Record<string, unknown>,
  }));
}

export async function fetchRewardLeaderboard(limit = 10): Promise<
  {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    reward_lifetime_earned: number;
    reward_level: number;
    reward_points: number;
  }[]
> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, reward_lifetime_earned, reward_level, reward_points")
    .gt("reward_lifetime_earned", 0)
    .order("reward_lifetime_earned", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    full_name: (r.full_name as string | null) ?? null,
    avatar_url: (r.avatar_url as string | null) ?? null,
    reward_lifetime_earned: Number(r.reward_lifetime_earned) || 0,
    reward_level: Number(r.reward_level) || 1,
    reward_points: Number(r.reward_points) || 0,
  }));
}

export async function adminAdjustRewardPoints(
  userId: string,
  points: number,
  note?: string,
) {
  const { data, error } = await supabase.rpc("admin_adjust_reward_points", {
    p_user_id: userId,
    p_points: points,
    p_note: note ?? null,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown>;
}

export function rewardActionLabel(action: string, lang: "bn" | "en"): string {
  const map: Record<string, { bn: string; en: string }> = {
    signup: { bn: "সাইন আপ", en: "Sign up" },
    post_request: { bn: "রক্তের অনুরোধ পোস্ট", en: "Posted blood request" },
    donation_confirmed: { bn: "রক্তদান নিশ্চিত", en: "Donation confirmed" },
    request_fulfilled: { bn: "রিকোয়েস্ট সম্পন্ন", en: "Request fulfilled" },
    like: { bn: "লাইক", en: "Like" },
    comment: { bn: "কমেন্ট", en: "Comment" },
    share: { bn: "শেয়ার", en: "Share" },
    admin_adjust: { bn: "অ্যাডমিন সমন্বয়", en: "Admin adjustment" },
  };
  const row = map[action];
  if (!row) return action;
  return lang === "bn" ? row.bn : row.en;
}

export function formatRewardToast(
  points: number,
  lang: "bn" | "en",
  action?: string,
): string {
  const base =
    lang === "bn" ? `+${points} পয়েন্ট` : `+${points} points`;
  if (!action) return base;
  const label = rewardActionLabel(action, lang);
  return lang === "bn" ? `${base} — ${label}` : `${base} — ${label}`;
}

export async function resolveLevelLabel(
  level: number,
  lang: "bn" | "en",
  settings?: RewardsSettings,
): Promise<string> {
  const s = settings ?? (await fetchRewardsSettings());
  return levelName(s, level, lang);
}
