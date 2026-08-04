import { supabase } from "@/integrations/supabase/client";

export type UserMenuItemId =
  | "my_posts"
  | "liked"
  | "commented"
  | "shared"
  | "saved"
  | "donated"
  | "organizations"
  | "profile"
  | "settings"
  | "report"
  | "logout";

export type UserMenuItem = {
  id: UserMenuItemId;
  enabled: boolean;
  order: number;
  icon: string;
  label_bn: string;
  label_en: string;
};

export type UserMenuDesign = {
  drawer_width_px: number;
  show_profile_card: boolean;
  show_see_more: boolean;
  accent: string;
};

export type UserMenuSettings = {
  items: UserMenuItem[];
  design: UserMenuDesign;
};

const DEFAULT_ITEMS: UserMenuItem[] = [
  { id: "my_posts", enabled: true, order: 0, icon: "FileText", label_bn: "আমার পোস্ট", label_en: "My posts" },
  { id: "liked", enabled: true, order: 1, icon: "ThumbsUp", label_bn: "লাইক করা", label_en: "Liked" },
  { id: "commented", enabled: true, order: 2, icon: "MessagesSquare", label_bn: "কমেন্ট করা", label_en: "Commented" },
  { id: "shared", enabled: true, order: 3, icon: "Share2", label_bn: "শেয়ার করা", label_en: "Shared" },
  { id: "saved", enabled: true, order: 4, icon: "Bookmark", label_bn: "সেভ করা", label_en: "Saved" },
  { id: "donated", enabled: true, order: 5, icon: "Droplet", label_bn: "রক্ত দিয়েছি", label_en: "Donated" },
  { id: "organizations", enabled: true, order: 6, icon: "Building2", label_bn: "অর্গানাইজেশন", label_en: "Organizations" },
  { id: "profile", enabled: true, order: 7, icon: "User", label_bn: "প্রোফাইল", label_en: "Profile" },
  { id: "settings", enabled: true, order: 8, icon: "Settings", label_bn: "সেটিংস", label_en: "Settings" },
  {
    id: "report",
    enabled: true,
    order: 9,
    icon: "Flag",
    label_bn: "রিপোর্ট / অভিযোগ",
    label_en: "Report / complain",
  },
  { id: "logout", enabled: true, order: 10, icon: "LogOut", label_bn: "লগআউট", label_en: "Log out" },
];

export const DEFAULT_USER_MENU_SETTINGS: UserMenuSettings = {
  items: DEFAULT_ITEMS,
  design: {
    drawer_width_px: 320,
    show_profile_card: true,
    show_see_more: false,
    accent: "#C62828",
  },
};

export const USER_MENU_ICON_OPTIONS = [
  "FileText",
  "ThumbsUp",
  "MessagesSquare",
  "Share2",
  "Bookmark",
  "Droplet",
  "Building2",
  "User",
  "Settings",
  "LogOut",
  "Flag",
  "Heart",
  "Users",
  "Home",
  "Clock",
] as const;

const VALID_IDS = new Set<string>(DEFAULT_ITEMS.map((i) => i.id));

let cached: UserMenuSettings | null = null;
let cachedAt = 0;

export function invalidateUserMenuSettingsCache() {
  cached = null;
  cachedAt = 0;
}

function mergeItems(raw: unknown): UserMenuItem[] {
  const byId = new Map(DEFAULT_ITEMS.map((i) => [i.id, { ...i }]));
  if (Array.isArray(raw)) {
    for (const row of raw) {
      if (!row || typeof row !== "object") continue;
      const r = row as Partial<UserMenuItem>;
      if (!r.id || !VALID_IDS.has(r.id)) continue;
      const base = byId.get(r.id as UserMenuItemId)!;
      byId.set(r.id as UserMenuItemId, {
        ...base,
        enabled: r.enabled !== false,
        order: Number.isFinite(Number(r.order)) ? Number(r.order) : base.order,
        icon: typeof r.icon === "string" && r.icon ? r.icon : base.icon,
        label_bn: typeof r.label_bn === "string" && r.label_bn ? r.label_bn : base.label_bn,
        label_en: typeof r.label_en === "string" && r.label_en ? r.label_en : base.label_en,
      });
    }
  }
  return [...byId.values()].sort((a, b) => a.order - b.order);
}

export function normalizeUserMenuSettings(raw: unknown): UserMenuSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<UserMenuSettings> & {
    design?: Partial<UserMenuDesign>;
  };
  const w = Math.round(Number(r.design?.drawer_width_px));
  return {
    items: mergeItems(r.items),
    design: {
      drawer_width_px: Number.isFinite(w) ? Math.min(420, Math.max(260, w)) : 320,
      show_profile_card: r.design?.show_profile_card !== false,
      show_see_more: r.design?.show_see_more === true,
      accent:
        typeof r.design?.accent === "string" && /^#[0-9A-Fa-f]{6}$/.test(r.design.accent)
          ? r.design.accent
          : "#C62828",
    },
  };
}

export async function fetchUserMenuSettings(force = false): Promise<UserMenuSettings> {
  if (!force && cached && Date.now() - cachedAt < 60_000) return cached;
  const { data, error } = await supabase
    .from("app_settings")
    .select("user_menu_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    cached = { ...DEFAULT_USER_MENU_SETTINGS, items: [...DEFAULT_ITEMS] };
  } else {
    cached = normalizeUserMenuSettings(
      (data as { user_menu_settings?: unknown }).user_menu_settings,
    );
  }
  cachedAt = Date.now();
  return cached;
}

export async function saveUserMenuSettings(next: UserMenuSettings) {
  const normalized = normalizeUserMenuSettings(next);
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    user_menu_settings: normalized,
  });
  if (!error) {
    cached = normalized;
    cachedAt = Date.now();
  }
  return { error, settings: normalized };
}

export function menuItemHref(id: UserMenuItemId): string | null {
  switch (id) {
    case "my_posts":
      return "/me/posts";
    case "liked":
      return "/me/liked";
    case "commented":
      return "/me/commented";
    case "shared":
      return "/me/shared";
    case "saved":
      return "/me/saved";
    case "donated":
      return "/me/donated";
    case "organizations":
      return "/me/organizations";
    case "profile":
      return "/profile";
    case "settings":
      return "/settings";
    case "report":
      return "/settings?report=1";
    case "logout":
      return null;
    default:
      return null;
  }
}
