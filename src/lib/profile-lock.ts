import { supabase } from "@/integrations/supabase/client";

export type ProfileLockField =
  | "phone"
  | "blood_group"
  | "bio"
  | "gender"
  | "age"
  | "location"
  | "last_donation"
  | "availability"
  | "stats";

export type ProfileLockSettings = Record<ProfileLockField, boolean>;

export const PROFILE_LOCK_FIELDS: ProfileLockField[] = [
  "phone",
  "blood_group",
  "bio",
  "gender",
  "age",
  "location",
  "last_donation",
  "availability",
  "stats",
];

export const DEFAULT_PROFILE_LOCK_SETTINGS: ProfileLockSettings = {
  phone: true,
  blood_group: true,
  bio: true,
  gender: true,
  age: true,
  location: true,
  last_donation: true,
  availability: true,
  stats: true,
};

export const PROFILE_LOCK_FIELD_META: Record<
  ProfileLockField,
  { bn: string; en: string; hint_bn: string; hint_en: string }
> = {
  phone: {
    bn: "মোবাইল",
    en: "Phone",
    hint_bn: "লক করলে অন্যরা দেখতে পাবে না",
    hint_en: "Hidden from others when profile is locked",
  },
  blood_group: {
    bn: "রক্তের গ্রুপ",
    en: "Blood group",
    hint_bn: "লক করলে অন্যরা দেখতে পাবে না",
    hint_en: "Hidden from others when profile is locked",
  },
  bio: {
    bn: "বায়ো",
    en: "Bio",
    hint_bn: "লক করলে অন্যরা দেখতে পাবে না",
    hint_en: "Hidden from others when profile is locked",
  },
  gender: {
    bn: "লিঙ্গ",
    en: "Gender",
    hint_bn: "লক করলে অন্যরা দেখতে পাবে না",
    hint_en: "Hidden from others when profile is locked",
  },
  age: {
    bn: "বয়স",
    en: "Age",
    hint_bn: "লক করলে অন্যরা দেখতে পাবে না",
    hint_en: "Hidden from others when profile is locked",
  },
  location: {
    bn: "অবস্থান",
    en: "Location",
    hint_bn: "জেলা ও উপজেলা",
    hint_en: "District & upazila",
  },
  last_donation: {
    bn: "শেষ দান",
    en: "Last donation",
    hint_bn: "লক করলে অন্যরা দেখতে পাবে না",
    hint_en: "Hidden from others when profile is locked",
  },
  availability: {
    bn: "উপলব্ধতা",
    en: "Availability",
    hint_bn: "দানের জন্য উপলব্ধ কিনা",
    hint_en: "Available to donate status",
  },
  stats: {
    bn: "পরিসংখ্যান",
    en: "Stats",
    hint_bn: "মোট দান ও জীবন বাঁচানো",
    hint_en: "Donations & lives saved",
  },
};

let lockSettingsCache: ProfileLockSettings | null = null;
let lockSettingsCachedAt = 0;

export function invalidateProfileLockSettingsCache() {
  lockSettingsCache = null;
  lockSettingsCachedAt = 0;
}

export function normalizeProfileLockSettings(raw: unknown): ProfileLockSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<ProfileLockField, boolean>>;
  const out = { ...DEFAULT_PROFILE_LOCK_SETTINGS };
  for (const key of PROFILE_LOCK_FIELDS) {
    if (typeof r[key] === "boolean") out[key] = r[key]!;
  }
  return out;
}

export async function fetchProfileLockSettings(force = false): Promise<ProfileLockSettings> {
  const now = Date.now();
  if (!force && lockSettingsCache && now - lockSettingsCachedAt < 60_000) {
    return lockSettingsCache;
  }
  const { data, error } = await supabase
    .from("app_settings")
    .select("profile_lock_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error && !/profile_lock_settings|column/i.test(error.message)) throw error;
  const normalized = normalizeProfileLockSettings(
    (data as { profile_lock_settings?: unknown } | null)?.profile_lock_settings,
  );
  lockSettingsCache = normalized;
  lockSettingsCachedAt = now;
  return normalized;
}

export async function saveProfileLockSettings(settings: ProfileLockSettings) {
  const normalized = normalizeProfileLockSettings(settings);
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, profile_lock_settings: normalized } as never);
  if (!error) invalidateProfileLockSettingsCache();
  return { error, settings: normalized };
}

export type PublicProfile = Record<string, unknown>;

export async function fetchProfileForViewer(
  userId: string,
  viewerId?: string | null,
): Promise<PublicProfile | null> {
  if (viewerId && viewerId === userId) {
    const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw error;
    return data as PublicProfile | null;
  }

  const { data, error } = await supabase.rpc("fetch_profile_public", { p_user_id: userId });
  if (error) {
    if (/fetch_profile_public|function|column/i.test(error.message)) {
      const { data: fallback, error: fbErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (fbErr) throw fbErr;
      return fallback as PublicProfile | null;
    }
    throw error;
  }
  return (data as PublicProfile | null) ?? null;
}

export async function setProfileLocked(userId: string, locked: boolean) {
  const { error } = await supabase
    .from("profiles")
    .update({ profile_locked: locked } as never)
    .eq("id", userId);
  return { error };
}

export function isFieldHiddenWhenLocked(
  field: ProfileLockField,
  lockSettings: ProfileLockSettings,
): boolean {
  return !!lockSettings[field];
}
