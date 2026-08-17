import { supabase } from "@/integrations/supabase/client";

export type AmbulanceFeatureFlags = {
  emergency_enabled: boolean;
  scheduled_enabled: boolean;
  auto_assign: boolean;
  require_quote_approval: boolean;
};

export type AmbulanceSettings = {
  features: AmbulanceFeatureFlags;
  coverage: {
    default_search_radius_km: number;
    allow_cross_district: boolean;
  };
  pricing: {
    platform_commission_pct: number;
    min_fare_cap: number;
    max_fare_cap: number;
  };
  labels: {
    hub_title_bn: string;
    hub_title_en: string;
    emergency_cta_bn: string;
    emergency_cta_en: string;
    scheduled_cta_bn: string;
    scheduled_cta_en: string;
  };
  notifications: {
    push_enabled: boolean;
    sms_enabled: boolean;
  };
  webhook_url: string | null;
};

export const DEFAULT_AMBULANCE_SETTINGS: AmbulanceSettings = {
  features: {
    emergency_enabled: true,
    scheduled_enabled: true,
    auto_assign: false,
    require_quote_approval: false,
  },
  coverage: {
    default_search_radius_km: 25,
    allow_cross_district: true,
  },
  pricing: {
    platform_commission_pct: 0,
    min_fare_cap: 0,
    max_fare_cap: 0,
  },
  labels: {
    hub_title_bn: "অ্যাম্বুলেন্স",
    hub_title_en: "Ambulance",
    emergency_cta_bn: "জরুরি অ্যাম্বুলেন্স",
    emergency_cta_en: "Emergency ambulance",
    scheduled_cta_bn: "আগে থেকে বুক",
    scheduled_cta_en: "Schedule booking",
  },
  notifications: {
    push_enabled: true,
    sms_enabled: false,
  },
  webhook_url: null,
};

let cache: AmbulanceSettings | null = null;

function num(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return fallback;
}

function str(v: unknown, fallback: string): string {
  return v != null && String(v).trim() ? String(v) : fallback;
}

export function normalizeAmbulanceSettings(raw: unknown): AmbulanceSettings {
  const d = DEFAULT_AMBULANCE_SETTINGS;
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f = (r.features && typeof r.features === "object" ? r.features : {}) as Record<string, unknown>;
  const c = (r.coverage && typeof r.coverage === "object" ? r.coverage : {}) as Record<string, unknown>;
  const p = (r.pricing && typeof r.pricing === "object" ? r.pricing : {}) as Record<string, unknown>;
  const l = (r.labels && typeof r.labels === "object" ? r.labels : {}) as Record<string, unknown>;
  const n = (r.notifications && typeof r.notifications === "object" ? r.notifications : {}) as Record<string, unknown>;
  return {
    features: {
      emergency_enabled: bool(f.emergency_enabled, d.features.emergency_enabled),
      scheduled_enabled: bool(f.scheduled_enabled, d.features.scheduled_enabled),
      auto_assign: bool(f.auto_assign, d.features.auto_assign),
      require_quote_approval: bool(f.require_quote_approval, d.features.require_quote_approval),
    },
    coverage: {
      default_search_radius_km: num(c.default_search_radius_km, d.coverage.default_search_radius_km),
      allow_cross_district: bool(c.allow_cross_district, d.coverage.allow_cross_district),
    },
    pricing: {
      platform_commission_pct: num(p.platform_commission_pct, d.pricing.platform_commission_pct),
      min_fare_cap: num(p.min_fare_cap, d.pricing.min_fare_cap),
      max_fare_cap: num(p.max_fare_cap, d.pricing.max_fare_cap),
    },
    labels: {
      hub_title_bn: str(l.hub_title_bn, d.labels.hub_title_bn),
      hub_title_en: str(l.hub_title_en, d.labels.hub_title_en),
      emergency_cta_bn: str(l.emergency_cta_bn, d.labels.emergency_cta_bn),
      emergency_cta_en: str(l.emergency_cta_en, d.labels.emergency_cta_en),
      scheduled_cta_bn: str(l.scheduled_cta_bn, d.labels.scheduled_cta_bn),
      scheduled_cta_en: str(l.scheduled_cta_en, d.labels.scheduled_cta_en),
    },
    notifications: {
      push_enabled: bool(n.push_enabled, d.notifications.push_enabled),
      sms_enabled: bool(n.sms_enabled, d.notifications.sms_enabled),
    },
    webhook_url: r.webhook_url != null ? String(r.webhook_url) : null,
  };
}

export function invalidateAmbulanceSettingsCache() {
  cache = null;
}

export async function fetchAmbulanceSettings(force = false): Promise<AmbulanceSettings> {
  if (cache && !force) return cache;
  const { data, error } = await supabase.from("app_settings").select("ambulance_settings").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  cache = normalizeAmbulanceSettings((data as { ambulance_settings?: unknown } | null)?.ambulance_settings);
  return cache;
}

export async function saveAmbulanceSettings(settings: AmbulanceSettings): Promise<void> {
  const { error } = await supabase.from("app_settings").upsert({ id: 1, ambulance_settings: settings } as never);
  if (error) throw new Error(error.message);
  cache = settings;
}
