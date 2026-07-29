import { supabase } from "@/integrations/supabase/client";

export type LangPair = { bn: string; en: string };

export type DonationFlowLabels = {
  progress_title: LangPair;
  i_can_donate: LangPair;
  i_donated: LangPair;
  confirm: LangPair;
  reject: LangPair;
  assign: LangPair;
  complete_menu: LangPair;
  finish: LangPair;
  waiting_confirm: LangPair;
  reopen_assign: LangPair;
};

export type DonationFlowSettings = {
  /** Max confirmed donors (assign + claim confirm combined) */
  max_assigned_donors: number;
  /** Show bags progress bar + counts */
  show_progress: boolean;
  /** Owner may assign donors after Complete */
  enable_assign: boolean;
  /** Owner may Confirm/Reject “I donated” claims */
  enable_confirm: boolean;
  /** Donor “I can donate” interest button */
  enable_i_can_donate: boolean;
  /** Donor “I donated” claim button */
  enable_i_donated: boolean;
  /** If true, “I donated” only after owner opens Complete */
  require_complete_first: boolean;
  labels: DonationFlowLabels;
};

export const DEFAULT_DONATION_FLOW_LABELS: DonationFlowLabels = {
  progress_title: { bn: "রক্তদান অগ্রগতি", en: "Donation progress" },
  i_can_donate: { bn: "রক্ত দিতে পারি", en: "I can donate" },
  i_donated: { bn: "আমি দিয়েছি", en: "I donated" },
  confirm: { bn: "কনফার্ম", en: "Confirm" },
  reject: { bn: "বাতিল", en: "Reject" },
  assign: { bn: "Assign", en: "Assign" },
  complete_menu: { bn: "রক্ত দান সম্পন্ন", en: "Blood donation complete" },
  finish: { bn: "সম্পন্ন করুন", en: "Finish & fulfill" },
  waiting_confirm: {
    bn: "পোস্টকারীর নিশ্চিতকরণের অপেক্ষা…",
    en: "Waiting for owner confirmation…",
  },
  reopen_assign: {
    bn: "ডোনার assign / সম্পন্ন করুন",
    en: "Assign donors / finish",
  },
};

export const DEFAULT_DONATION_FLOW_SETTINGS: DonationFlowSettings = {
  max_assigned_donors: 5,
  show_progress: true,
  enable_assign: true,
  enable_confirm: true,
  enable_i_can_donate: true,
  enable_i_donated: true,
  require_complete_first: true,
  labels: DEFAULT_DONATION_FLOW_LABELS,
};

let cached: DonationFlowSettings | null = null;
let cachedAt = 0;

export function invalidateDonationFlowSettingsCache() {
  cached = null;
  cachedAt = 0;
}

function pair(raw: unknown, fallback: LangPair): LangPair {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<LangPair>;
  return {
    bn: typeof r.bn === "string" && r.bn.trim() ? r.bn : fallback.bn,
    en: typeof r.en === "string" && r.en.trim() ? r.en : fallback.en,
  };
}

function normalizeLabels(raw: unknown): DonationFlowLabels {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<keyof DonationFlowLabels, unknown>
  >;
  const out = { ...DEFAULT_DONATION_FLOW_LABELS };
  (Object.keys(DEFAULT_DONATION_FLOW_LABELS) as (keyof DonationFlowLabels)[]).forEach((k) => {
    out[k] = pair(r[k], DEFAULT_DONATION_FLOW_LABELS[k]);
  });
  return out;
}

export function donationLabel(
  settings: DonationFlowSettings,
  key: keyof DonationFlowLabels,
  lang: "bn" | "en",
): string {
  return settings.labels[key][lang];
}

export function normalizeDonationFlowSettings(raw: unknown): DonationFlowSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<DonationFlowSettings>;
  const max = Math.round(Number(r.max_assigned_donors));
  return {
    max_assigned_donors: Number.isFinite(max) ? Math.min(20, Math.max(1, max)) : 5,
    show_progress: r.show_progress !== false,
    enable_assign: r.enable_assign !== false,
    enable_confirm: r.enable_confirm !== false,
    enable_i_can_donate: r.enable_i_can_donate !== false,
    enable_i_donated: r.enable_i_donated !== false,
    require_complete_first: r.require_complete_first !== false,
    labels: normalizeLabels(r.labels),
  };
}

export async function fetchDonationFlowSettings(force = false): Promise<DonationFlowSettings> {
  if (!force && cached && Date.now() - cachedAt < 60_000) return cached;
  const { data, error } = await supabase
    .from("app_settings")
    .select("donation_flow_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    cached = { ...DEFAULT_DONATION_FLOW_SETTINGS, labels: { ...DEFAULT_DONATION_FLOW_LABELS } };
  } else {
    cached = normalizeDonationFlowSettings(
      (data as { donation_flow_settings?: unknown }).donation_flow_settings,
    );
  }
  cachedAt = Date.now();
  return cached;
}

export async function saveDonationFlowSettings(next: DonationFlowSettings) {
  const normalized = normalizeDonationFlowSettings(next);
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    donation_flow_settings: normalized,
  });
  if (!error) {
    cached = normalized;
    cachedAt = Date.now();
  }
  return { error, settings: normalized };
}
