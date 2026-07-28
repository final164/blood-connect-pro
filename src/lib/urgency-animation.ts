import { supabase } from "@/integrations/supabase/client";

export type UrgencyAnimMode = "breathe" | "heartbeat" | "pulse-glow" | "bounce";

export type UrgencyLevelAnim = {
  enabled: boolean;
  mode: UrgencyAnimMode;
  duration_ms: number;
  opacity_min: number;
  opacity_max: number;
  scale_min: number;
  scale_max: number;
  size_percent: number;
  droplet_count: number;
  easing: string;
  color: string;
  show_header_icon: boolean;
};

export type UrgencyAnimationSettings = {
  critical: UrgencyLevelAnim;
  urgent: UrgencyLevelAnim;
};

export const DEFAULT_CRITICAL_ANIM: UrgencyLevelAnim = {
  enabled: true,
  mode: "breathe",
  duration_ms: 2200,
  opacity_min: 0.06,
  opacity_max: 0.2,
  scale_min: 0.82,
  scale_max: 1.18,
  size_percent: 72,
  droplet_count: 1,
  easing: "ease-in-out",
  color: "#C62828",
  show_header_icon: true,
};

export const DEFAULT_URGENT_ANIM: UrgencyLevelAnim = {
  enabled: true,
  mode: "pulse-glow",
  duration_ms: 2800,
  opacity_min: 0.04,
  opacity_max: 0.14,
  scale_min: 0.88,
  scale_max: 1.1,
  size_percent: 64,
  droplet_count: 1,
  easing: "ease-in-out",
  color: "#E67E22",
  show_header_icon: false,
};

export const DEFAULT_URGENCY_ANIMATION: UrgencyAnimationSettings = {
  critical: { ...DEFAULT_CRITICAL_ANIM },
  urgent: { ...DEFAULT_URGENT_ANIM },
};

export type UrgencyPresetId = "soft" | "pulse" | "intense" | "heartbeat" | "minimal";

export const URGENCY_PRESETS: Record<
  UrgencyPresetId,
  { label_en: string; label_bn: string; critical: Partial<UrgencyLevelAnim>; urgent: Partial<UrgencyLevelAnim> }
> = {
  soft: {
    label_en: "Soft breathe",
    label_bn: "নরম শ্বাস",
    critical: {
      mode: "breathe",
      duration_ms: 3200,
      opacity_min: 0.04,
      opacity_max: 0.12,
      scale_min: 0.88,
      scale_max: 1.08,
      size_percent: 68,
      droplet_count: 1,
    },
    urgent: {
      mode: "breathe",
      duration_ms: 3600,
      opacity_min: 0.03,
      opacity_max: 0.1,
      scale_min: 0.9,
      scale_max: 1.06,
      size_percent: 60,
      droplet_count: 1,
    },
  },
  pulse: {
    label_en: "Pulse",
    label_bn: "পালস",
    critical: {
      mode: "pulse-glow",
      duration_ms: 1800,
      opacity_min: 0.08,
      opacity_max: 0.24,
      scale_min: 0.85,
      scale_max: 1.22,
      size_percent: 74,
      droplet_count: 1,
    },
    urgent: {
      mode: "pulse-glow",
      duration_ms: 2200,
      opacity_min: 0.05,
      opacity_max: 0.16,
      scale_min: 0.88,
      scale_max: 1.14,
      size_percent: 66,
      droplet_count: 1,
    },
  },
  intense: {
    label_en: "Intense",
    label_bn: "তীব্র",
    critical: {
      mode: "breathe",
      duration_ms: 1400,
      opacity_min: 0.1,
      opacity_max: 0.32,
      scale_min: 0.78,
      scale_max: 1.32,
      size_percent: 80,
      droplet_count: 2,
    },
    urgent: {
      mode: "bounce",
      duration_ms: 1600,
      opacity_min: 0.06,
      opacity_max: 0.2,
      scale_min: 0.85,
      scale_max: 1.2,
      size_percent: 70,
      droplet_count: 1,
    },
  },
  heartbeat: {
    label_en: "Heartbeat",
    label_bn: "হার্টবিট",
    critical: {
      mode: "heartbeat",
      duration_ms: 1600,
      opacity_min: 0.08,
      opacity_max: 0.28,
      scale_min: 0.8,
      scale_max: 1.28,
      size_percent: 76,
      droplet_count: 1,
    },
    urgent: {
      mode: "heartbeat",
      duration_ms: 2000,
      opacity_min: 0.05,
      opacity_max: 0.18,
      scale_min: 0.86,
      scale_max: 1.16,
      size_percent: 68,
      droplet_count: 1,
    },
  },
  minimal: {
    label_en: "Minimal",
    label_bn: "মিনিমাল",
    critical: {
      mode: "breathe",
      duration_ms: 4000,
      opacity_min: 0.03,
      opacity_max: 0.08,
      scale_min: 0.92,
      scale_max: 1.05,
      size_percent: 58,
      droplet_count: 1,
      show_header_icon: true,
    },
    urgent: {
      mode: "breathe",
      duration_ms: 4500,
      opacity_min: 0.02,
      opacity_max: 0.06,
      scale_min: 0.94,
      scale_max: 1.04,
      size_percent: 52,
      droplet_count: 1,
      show_header_icon: false,
    },
  },
};

export const URGENCY_EASINGS = [
  "ease-in-out",
  "ease",
  "ease-in",
  "ease-out",
  "linear",
  "cubic-bezier(0.4, 0, 0.2, 1)",
  "cubic-bezier(0.34, 1.56, 0.64, 1)",
] as const;

export const URGENCY_MODES: { id: UrgencyAnimMode; label_en: string; label_bn: string }[] = [
  { id: "breathe", label_en: "Breathe (opacity + scale)", label_bn: "শ্বাস (opacity + scale)" },
  { id: "heartbeat", label_en: "Heartbeat (double pulse)", label_bn: "হার্টবিট (ডাবল পালস)" },
  { id: "pulse-glow", label_en: "Soft pulse", label_bn: "সফট পালস" },
  { id: "bounce", label_en: "Soft bounce", label_bn: "সফট বাউন্স" },
];

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function normalizeLevelAnim(raw: Partial<UrgencyLevelAnim> | null | undefined, base: UrgencyLevelAnim): UrgencyLevelAnim {
  const m = { ...base, ...(raw ?? {}) };
  return {
    enabled: !!m.enabled,
    mode: (["breathe", "heartbeat", "pulse-glow", "bounce"] as UrgencyAnimMode[]).includes(m.mode as UrgencyAnimMode)
      ? (m.mode as UrgencyAnimMode)
      : base.mode,
    duration_ms: clamp(Number(m.duration_ms) || base.duration_ms, 600, 8000),
    opacity_min: clamp(Number(m.opacity_min) ?? base.opacity_min, 0, 1),
    opacity_max: clamp(Number(m.opacity_max) ?? base.opacity_max, 0, 1),
    scale_min: clamp(Number(m.scale_min) ?? base.scale_min, 0.3, 2),
    scale_max: clamp(Number(m.scale_max) ?? base.scale_max, 0.3, 2.5),
    size_percent: clamp(Number(m.size_percent) || base.size_percent, 30, 120),
    droplet_count: clamp(Math.round(Number(m.droplet_count) || 1), 1, 2),
    easing: typeof m.easing === "string" && m.easing.trim() ? m.easing.trim() : base.easing,
    color: typeof m.color === "string" && m.color.trim() ? m.color.trim() : base.color,
    show_header_icon: !!m.show_header_icon,
  };
}

export function normalizeUrgencyAnimation(raw: unknown): UrgencyAnimationSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<UrgencyAnimationSettings>;
  return {
    critical: normalizeLevelAnim(r.critical, DEFAULT_CRITICAL_ANIM),
    urgent: normalizeLevelAnim(r.urgent, DEFAULT_URGENT_ANIM),
  };
}

let cached: UrgencyAnimationSettings | null = null;
let cachedAt = 0;
let inflight: Promise<UrgencyAnimationSettings> | null = null;

export function invalidateUrgencyAnimationCache() {
  cached = null;
  cachedAt = 0;
  inflight = null;
}

export async function fetchUrgencyAnimationSettings(force = false): Promise<UrgencyAnimationSettings> {
  if (!force && cached && Date.now() - cachedAt < 120_000) return cached;
  if (!force && inflight) return inflight;

  inflight = (async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("urgency_animation, notification_settings")
      .eq("id", 1)
      .maybeSingle();

    if (error || !data) {
      cached = {
        critical: { ...DEFAULT_CRITICAL_ANIM },
        urgent: { ...DEFAULT_URGENT_ANIM },
      };
    } else {
      const normalized = normalizeUrgencyAnimation((data as { urgency_animation?: unknown }).urgency_animation);
      const ns = (data as { notification_settings?: { enable_critical_droplet_animation?: boolean } })
        .notification_settings;
      if (
        ns &&
        typeof ns.enable_critical_droplet_animation === "boolean" &&
        !(data as { urgency_animation?: unknown }).urgency_animation
      ) {
        normalized.critical.enabled = ns.enable_critical_droplet_animation;
      }
      // Soft performance caps — never allow extreme laggy configs
      for (const key of ["critical", "urgent"] as const) {
        normalized[key].droplet_count = Math.min(2, normalized[key].droplet_count);
        normalized[key].duration_ms = Math.max(900, normalized[key].duration_ms);
        if (normalized[key].opacity_max - normalized[key].opacity_min > 0.35) {
          normalized[key].opacity_max = normalized[key].opacity_min + 0.35;
        }
      }
      cached = normalized;
    }
    cachedAt = Date.now();
    inflight = null;
    return cached!;
  })();

  return inflight;
}

export function levelAnimCssVars(cfg: UrgencyLevelAnim): Record<string, string> {
  return {
    "--ua-duration": `${cfg.duration_ms}ms`,
    "--ua-opacity-min": String(cfg.opacity_min),
    "--ua-opacity-max": String(cfg.opacity_max),
    "--ua-scale-min": String(cfg.scale_min),
    "--ua-scale-max": String(cfg.scale_max),
    "--ua-easing": cfg.easing,
    "--ua-size": `${cfg.size_percent}%`,
    "--ua-color": cfg.color,
  };
}
