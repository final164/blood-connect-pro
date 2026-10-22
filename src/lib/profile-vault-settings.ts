import { supabase } from "@/integrations/supabase/client";

export type ProfileVaultSettings = {
  enabled: boolean;
  show_on_own: boolean;
  show_on_public: boolean;
  use_avatar: boolean;
  use_post_photos: boolean;
  use_requests: boolean;
  use_people: boolean;
  use_stats: boolean;
  show_waveform: boolean;
  show_circuit: boolean;
  animate: boolean;
  max_photos: number;
  badge_bn: string;
  badge_en: string;
  title_bn: string;
  title_en: string;
  subtitle_bn: string;
  subtitle_en: string;
};

export const DEFAULT_PROFILE_VAULT_SETTINGS: ProfileVaultSettings = {
  enabled: true,
  show_on_own: true,
  show_on_public: true,
  use_avatar: true,
  use_post_photos: true,
  use_requests: true,
  use_people: true,
  use_stats: true,
  show_waveform: true,
  show_circuit: true,
  animate: true,
  max_photos: 8,
  badge_bn: "লাইফ নেটওয়ার্ক",
  badge_en: "LIFE NETWORK",
  title_bn: "{name}",
  title_en: "{name}",
  subtitle_bn: "{photos} ছবি · {people} সংযোগ · {donations} দান",
  subtitle_en: "{photos} photos · {people} links · {donations} donations",
};

const TEXT_KEYS = [
  "badge_bn",
  "badge_en",
  "title_bn",
  "title_en",
  "subtitle_bn",
  "subtitle_en",
] as const;

let cache: ProfileVaultSettings | null = null;
let cachedAt = 0;

export function invalidateProfileVaultSettingsCache() {
  cache = null;
  cachedAt = 0;
}

function clip(value: unknown, fallback: string, max = 120) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, max);
}

export function normalizeProfileVaultSettings(raw: unknown): ProfileVaultSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<ProfileVaultSettings>;
  const out: ProfileVaultSettings = { ...DEFAULT_PROFILE_VAULT_SETTINGS };
  const flags: (keyof ProfileVaultSettings)[] = [
    "enabled",
    "show_on_own",
    "show_on_public",
    "use_avatar",
    "use_post_photos",
    "use_requests",
    "use_people",
    "use_stats",
    "show_waveform",
    "show_circuit",
    "animate",
  ];
  for (const key of flags) {
    if (typeof r[key] === "boolean") (out[key] as boolean) = r[key] as boolean;
  }
  const n = Number(r.max_photos);
  if (Number.isFinite(n)) out.max_photos = Math.min(8, Math.max(1, Math.round(n)));
  for (const key of TEXT_KEYS) out[key] = clip(r[key], DEFAULT_PROFILE_VAULT_SETTINGS[key]);
  return out;
}

export type VaultTextStats = {
  name: string;
  photos: number;
  posts: number;
  requests: number;
  people: number;
  donations: number;
  lives: number;
  blood: string;
};

export function fillVaultText(template: string, stats: VaultTextStats) {
  return template.replace(/\{(name|photos|posts|requests|people|donations|lives|blood)\}/g, (_, key: keyof VaultTextStats) =>
    String(stats[key] ?? ""),
  );
}

export function vaultVisibleFor(settings: ProfileVaultSettings, isOwn: boolean) {
  if (!settings.enabled) return false;
  return isOwn ? settings.show_on_own : settings.show_on_public;
}

export async function fetchProfileVaultSettings(force = false): Promise<ProfileVaultSettings> {
  const now = Date.now();
  if (!force && cache && now - cachedAt < 60_000) return cache;
  const { data, error } = await supabase
    .from("app_settings")
    .select("profile_vault_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error && !/profile_vault_settings|column/i.test(error.message)) throw error;
  const normalized = normalizeProfileVaultSettings(
    (data as { profile_vault_settings?: unknown } | null)?.profile_vault_settings,
  );
  cache = normalized;
  cachedAt = now;
  return normalized;
}

export async function saveProfileVaultSettings(settings: ProfileVaultSettings) {
  const normalized = normalizeProfileVaultSettings(settings);
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, profile_vault_settings: normalized } as never);
  if (!error) invalidateProfileVaultSettingsCache();
  return { error, settings: normalized };
}
