import { supabase } from "@/integrations/supabase/client";

export type BottomNavItemId = "feed" | "community" | "post" | "alert" | "profile";

export type BottomNavItem = {
  id: BottomNavItemId;
  enabled: boolean;
  order: number;
  label_bn: string;
  label_en: string;
};

/** Mobile bottom-nav colors (dark bar). Hex or rgba. */
export type BottomNavColors = {
  /** Inactive icon outline / stroke */
  icon: string;
  /** Active icon */
  icon_active: string;
  /** Inactive label under icon */
  label: string;
  /** Active label */
  label_active: string;
  /** Bar background */
  bar_bg: string;
  /** Center Post (+) circle background */
  compose_bg: string;
  /** Center Post (+) icon */
  compose_icon: string;
  /** Top hairline on the bar */
  bar_border: string;
};

export type BottomNavSettings = {
  items: BottomNavItem[];
  colors: BottomNavColors;
};

const DEFAULT_ITEMS: BottomNavItem[] = [
  { id: "feed", enabled: true, order: 0, label_bn: "ফিড", label_en: "Feed" },
  { id: "community", enabled: true, order: 1, label_bn: "কমিউনিটি", label_en: "Community" },
  { id: "post", enabled: true, order: 2, label_bn: "পোস্ট", label_en: "Post" },
  { id: "alert", enabled: true, order: 3, label_bn: "চ্যাট", label_en: "Chat" },
  { id: "profile", enabled: true, order: 4, label_bn: "প্রোফাইল", label_en: "Profile" },
];

export const DEFAULT_BOTTOM_NAV_COLORS: BottomNavColors = {
  icon: "#9aa3b2",
  icon_active: "#ffffff",
  label: "#8b93a3",
  label_active: "#ffffff",
  bar_bg: "#14181f",
  compose_bg: "#2a3140",
  compose_icon: "#ffffff",
  bar_border: "rgba(255,255,255,0.08)",
};

export const DEFAULT_BOTTOM_NAV_SETTINGS: BottomNavSettings = {
  items: DEFAULT_ITEMS.map((i) => ({ ...i })),
  colors: { ...DEFAULT_BOTTOM_NAV_COLORS },
};

const VALID_IDS = new Set<string>(DEFAULT_ITEMS.map((i) => i.id));

const COLOR_KEYS: (keyof BottomNavColors)[] = [
  "icon",
  "icon_active",
  "label",
  "label_active",
  "bar_bg",
  "compose_bg",
  "compose_icon",
  "bar_border",
];

let cached: BottomNavSettings | null = null;
let cachedAt = 0;

export function invalidateBottomNavSettingsCache() {
  cached = null;
  cachedAt = 0;
}

function isCssColor(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s || s.length > 64) return false;
  return /^(#([0-9a-f]{3,8})|rgba?\([^)]+\)|hsla?\([^)]+\)|[a-z]+)$/i.test(s);
}

export function normalizeBottomNavColors(raw: unknown): BottomNavColors {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<BottomNavColors>;
  const out = { ...DEFAULT_BOTTOM_NAV_COLORS };
  for (const key of COLOR_KEYS) {
    const v = r[key];
    if (isCssColor(v)) out[key] = v.trim();
  }
  return out;
}

/** CSS custom properties for the dark bottom nav shell */
export function bottomNavColorStyle(colors: BottomNavColors): Record<string, string> {
  return {
    "--bn-icon": colors.icon,
    "--bn-icon-active": colors.icon_active,
    "--bn-label": colors.label,
    "--bn-label-active": colors.label_active,
    "--bn-bar-bg": colors.bar_bg,
    "--bn-compose-bg": colors.compose_bg,
    "--bn-compose-icon": colors.compose_icon,
    "--bn-bar-border": colors.bar_border,
  };
}

function mergeItems(raw: unknown): BottomNavItem[] {
  const byId = new Map(DEFAULT_ITEMS.map((i) => [i.id, { ...i }]));
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Partial<BottomNavItem>;
      if (!r.id || !VALID_IDS.has(r.id)) continue;
      const base = byId.get(r.id as BottomNavItemId)!;
      byId.set(r.id as BottomNavItemId, {
        ...base,
        enabled: r.enabled !== false,
        order: Number.isFinite(Number(r.order)) ? Number(r.order) : base.order,
        label_bn: typeof r.label_bn === "string" && r.label_bn.trim() ? r.label_bn.trim() : base.label_bn,
        label_en: typeof r.label_en === "string" && r.label_en.trim() ? r.label_en.trim() : base.label_en,
      });
      // Slot id stays "alert" but destination is chat — migrate old default labels.
      if (r.id === "alert") {
        const cur = byId.get("alert")!;
        if (!cur.label_en || /^alert$/i.test(cur.label_en) || cur.label_en === "Alerts") {
          cur.label_en = base.label_en;
        }
        if (!cur.label_bn || cur.label_bn === "অ্যালার্ট" || cur.label_bn === "নোটিফ") {
          cur.label_bn = base.label_bn;
        }
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.order - b.order);
}

export function normalizeBottomNavSettings(raw: unknown): BottomNavSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as { items?: unknown; colors?: unknown };
  const items = mergeItems(r.items);
  // Keep at least one item enabled so the app always has a nav entry
  if (!items.some((i) => i.enabled)) {
    const feed = items.find((i) => i.id === "feed");
    if (feed) feed.enabled = true;
    else items[0]!.enabled = true;
  }
  return { items, colors: normalizeBottomNavColors(r.colors) };
}

export async function fetchBottomNavSettings(force = false): Promise<BottomNavSettings> {
  if (!force && cached && Date.now() - cachedAt < 60_000) return cached;
  const { data, error } = await supabase
    .from("app_settings")
    .select("bottom_nav_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    cached = {
      items: DEFAULT_ITEMS.map((i) => ({ ...i })),
      colors: { ...DEFAULT_BOTTOM_NAV_COLORS },
    };
  } else {
    cached = normalizeBottomNavSettings(
      (data as { bottom_nav_settings?: unknown }).bottom_nav_settings,
    );
  }
  cachedAt = Date.now();
  return cached;
}

export async function saveBottomNavSettings(next: BottomNavSettings) {
  const normalized = normalizeBottomNavSettings(next);
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    bottom_nav_settings: normalized,
  } as never);
  if (!error) {
    cached = normalized;
    cachedAt = Date.now();
  }
  return { error, settings: normalized };
}

export function enabledBottomNavIds(settings: BottomNavSettings): BottomNavItemId[] {
  return [...settings.items]
    .filter((i) => i.enabled)
    .sort((a, b) => a.order - b.order)
    .map((i) => i.id);
}
