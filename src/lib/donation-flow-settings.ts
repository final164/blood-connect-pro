import { supabase } from "@/integrations/supabase/client";

export type DonationFlowSettings = {
  /** Max donors the owner may assign after “blood donation complete” */
  max_assigned_donors: number;
  /** If false, skip “I can donate” — show direct “I donated” → owner confirm */
  enable_i_can_donate: boolean;
};

export const DEFAULT_DONATION_FLOW_SETTINGS: DonationFlowSettings = {
  max_assigned_donors: 5,
  enable_i_can_donate: true,
};

let cached: DonationFlowSettings | null = null;
let cachedAt = 0;

export function invalidateDonationFlowSettingsCache() {
  cached = null;
  cachedAt = 0;
}

export function normalizeDonationFlowSettings(raw: unknown): DonationFlowSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<DonationFlowSettings>;
  const max = Math.round(Number(r.max_assigned_donors));
  return {
    max_assigned_donors: Number.isFinite(max) ? Math.min(20, Math.max(1, max)) : 5,
    enable_i_can_donate: r.enable_i_can_donate !== false,
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
    cached = { ...DEFAULT_DONATION_FLOW_SETTINGS };
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
