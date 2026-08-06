import { supabase } from "@/integrations/supabase/client";

export type BottomNavItemId = "feed" | "community" | "post" | "alert" | "profile";

export type BottomNavItem = {
  id: BottomNavItemId;
  enabled: boolean;
  order: number;
  label_bn: string;
  label_en: string;
};

export type BottomNavSettings = {
  items: BottomNavItem[];
};

const DEFAULT_ITEMS: BottomNavItem[] = [
  { id: "feed", enabled: true, order: 0, label_bn: "ফিড", label_en: "Feed" },
  { id: "community", enabled: true, order: 1, label_bn: "কমিউনিটি", label_en: "Community" },
  { id: "post", enabled: true, order: 2, label_bn: "পোস্ট", label_en: "Post" },
  { id: "alert", enabled: true, order: 3, label_bn: "অ্যালার্ট", label_en: "Alert" },
  { id: "profile", enabled: true, order: 4, label_bn: "প্রোফাইল", label_en: "Profile" },
];

export const DEFAULT_BOTTOM_NAV_SETTINGS: BottomNavSettings = {
  items: DEFAULT_ITEMS.map((i) => ({ ...i })),
};

const VALID_IDS = new Set<string>(DEFAULT_ITEMS.map((i) => i.id));

let cached: BottomNavSettings | null = null;
let cachedAt = 0;

export function invalidateBottomNavSettingsCache() {
  cached = null;
  cachedAt = 0;
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
    }
  }
  return [...byId.values()].sort((a, b) => a.order - b.order);
}

export function normalizeBottomNavSettings(raw: unknown): BottomNavSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as { items?: unknown };
  const items = mergeItems(r.items);
  // Keep at least one item enabled so the app always has a nav entry
  if (!items.some((i) => i.enabled)) {
    const feed = items.find((i) => i.id === "feed");
    if (feed) feed.enabled = true;
    else items[0]!.enabled = true;
  }
  return { items };
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
