import { supabase } from "@/integrations/supabase/client";
import { resolveCarouselImageUrl } from "@/lib/feed-carousel";

/** How users/admins add images: paste Drive/URL, auto file upload, or both. */
export type DriveImageInputMode = "url" | "upload" | "both";

export type GoogleDriveSettings = {
  enabled: boolean;
  folder_id: string;
  folder_requests: string;
  folder_avatars: string;
  folder_media: string;
  make_public: boolean;
  /** url = link only; upload = file picker → Drive/storage; both = either */
  image_input_mode: DriveImageInputMode;
  /** Users can change profile photo */
  allow_profile_image: boolean;
  /** Users can attach image on blood request posts */
  allow_post_image: boolean;
};

export type DriveUploadPurpose = "request" | "avatar" | "media";

export const DEFAULT_GOOGLE_DRIVE_SETTINGS: GoogleDriveSettings = {
  enabled: false,
  folder_id: "",
  folder_requests: "",
  folder_avatars: "",
  folder_media: "",
  make_public: true,
  image_input_mode: "both",
  allow_profile_image: true,
  allow_post_image: true,
};

let cache: GoogleDriveSettings | null = null;
let cachedAt = 0;
const TTL = 30_000;

export function invalidateGoogleDriveSettingsCache() {
  cache = null;
  cachedAt = 0;
}

/** Extract Drive folder ID from a pasted folder URL or raw ID. */
export function extractDriveFolderId(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const fromFolders = raw.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (fromFolders?.[1]) return fromFolders[1];
  const fromId = raw.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (fromId?.[1]) return fromId[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(raw)) return raw;
  return raw;
}

export function normalizeGoogleDriveSettings(raw: unknown): GoogleDriveSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const modeRaw = r.image_input_mode;
  const image_input_mode: DriveImageInputMode =
    modeRaw === "url" || modeRaw === "upload" || modeRaw === "both" ? modeRaw : "both";
  return {
    enabled: r.enabled === true,
    folder_id: typeof r.folder_id === "string" ? extractDriveFolderId(r.folder_id) : "",
    folder_requests: typeof r.folder_requests === "string" ? extractDriveFolderId(r.folder_requests) : "",
    folder_avatars: typeof r.folder_avatars === "string" ? extractDriveFolderId(r.folder_avatars) : "",
    folder_media: typeof r.folder_media === "string" ? extractDriveFolderId(r.folder_media) : "",
    make_public: r.make_public !== false,
    image_input_mode,
    allow_profile_image: r.allow_profile_image !== false,
    allow_post_image: r.allow_post_image !== false,
  };
}

export function canPasteImageUrl(s: GoogleDriveSettings): boolean {
  return s.image_input_mode === "url" || s.image_input_mode === "both";
}

export function canUploadImageFile(s: GoogleDriveSettings): boolean {
  return s.image_input_mode === "upload" || s.image_input_mode === "both";
}

/** Normalize a pasted Drive/share/http URL into an img-friendly URL. */
export function normalizePastedImageUrl(input: string): string {
  return resolveCarouselImageUrl(input.trim());
}

export async function fetchGoogleDriveSettings(force = false): Promise<GoogleDriveSettings> {
  if (!force && cache && Date.now() - cachedAt < TTL) return cache;
  const { data, error } = await supabase
    .from("app_settings")
    .select("google_drive_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    cache = DEFAULT_GOOGLE_DRIVE_SETTINGS;
    cachedAt = Date.now();
    return cache;
  }
  const row = data as { google_drive_settings?: unknown } | null;
  cache = normalizeGoogleDriveSettings(row?.google_drive_settings);
  cachedAt = Date.now();
  return cache;
}

export async function saveGoogleDriveSettings(settings: GoogleDriveSettings): Promise<void> {
  const normalized = normalizeGoogleDriveSettings(settings);
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    google_drive_settings: normalized,
  } as never);
  if (error) throw error;
  cache = normalized;
  cachedAt = Date.now();
}

export type DriveSecretMeta = {
  configured: boolean;
  client_email: string;
};

/** Admin-only: metadata without private key (empty json still means not configured). */
export async function fetchDriveSecretMeta(): Promise<DriveSecretMeta> {
  const { data, error } = await supabase
    .from("google_drive_secrets" as never)
    .select("client_email, service_account_json")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    // Table may not exist yet
    return { configured: false, client_email: "" };
  }
  const row = data as { client_email?: string; service_account_json?: string } | null;
  const hasJson = !!(row?.service_account_json && row.service_account_json.trim());
  return {
    configured: hasJson,
    client_email: hasJson ? String(row?.client_email ?? "").trim() : "",
  };
}

export async function saveDriveServiceAccountJson(rawJson: string): Promise<{ client_email: string }> {
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(rawJson) as Record<string, string>;
  } catch {
    throw new Error("Invalid JSON");
  }
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("JSON must include client_email and private_key");
  }
  if (parsed.private_key.includes("\\n")) {
    parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
  }
  const normalized = JSON.stringify(parsed);

  // Prefer edge function (validates + service role), fall back to admin RLS upsert
  const { data, error } = await supabase.functions.invoke("drive-upload", {
    body: { action: "save_secret", service_account_json: normalized },
  });
  if (!error) {
    const res = data as { ok?: boolean; client_email?: string; error?: string } | null;
    if (res?.ok) return { client_email: res.client_email ?? parsed.client_email };
    if (res?.error && !/Failed to send|FunctionsFetchError|not found|404/i.test(res.error)) {
      throw new Error(res.error);
    }
  }

  const { error: dbErr } = await supabase.from("google_drive_secrets" as never).upsert({
    id: 1,
    service_account_json: normalized,
    client_email: parsed.client_email,
    updated_at: new Date().toISOString(),
  } as never);
  if (dbErr) {
    throw new Error(
      error?.message
        ? `${error.message} (DB: ${dbErr.message})`
        : dbErr.message,
    );
  }
  return { client_email: parsed.client_email };
}

export async function clearDriveServiceAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("drive-upload", {
    body: { action: "clear_secret" },
  });
  if (!error) {
    const res = data as { ok?: boolean; error?: string } | null;
    if (res?.ok) return;
  }
  const { error: dbErr } = await supabase.from("google_drive_secrets" as never).upsert({
    id: 1,
    service_account_json: "",
    client_email: "",
    updated_at: new Date().toISOString(),
  } as never);
  if (dbErr) throw new Error(dbErr.message);
}

export type DriveHealth = {
  ok: boolean;
  enabled?: boolean;
  has_service_account?: boolean;
  service_account_email?: string;
  folder_configured?: boolean;
  source?: string;
  error?: string;
};

export type DriveTestResult = {
  ok: boolean;
  token_ok?: boolean;
  folder_ok?: boolean;
  client_email?: string;
  folder_id?: string;
  folder_name?: string;
  message?: string;
  error?: string;
};

export async function checkDriveUploadHealth(): Promise<DriveHealth> {
  const { data, error } = await supabase.functions.invoke("drive-upload", {
    body: { action: "health" },
  });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false }) as DriveHealth;
}

export async function testDriveConnection(): Promise<DriveTestResult> {
  const { data, error } = await supabase.functions.invoke("drive-upload", {
    body: { action: "test" },
  });
  if (error) return { ok: false, error: error.message };
  return (data ?? { ok: false }) as DriveTestResult;
}

/**
 * Upload an image to the configured Google Drive folder via edge function.
 * Returns a display-friendly URL (thumbnail) when successful.
 */
export async function uploadImageToGoogleDrive(
  file: File,
  purpose: DriveUploadPurpose,
): Promise<{ url: string | null; fileId: string | null; error: Error | null }> {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);

  const { data, error } = await supabase.functions.invoke("drive-upload", {
    body: form,
  });

  if (error) return { url: null, fileId: null, error: new Error(error.message) };
  const res = data as {
    ok?: boolean;
    url?: string;
    file_id?: string;
    error?: string;
  } | null;
  if (!res?.ok || !res.url) {
    return {
      url: null,
      fileId: null,
      error: new Error(res?.error || "Drive upload failed"),
    };
  }
  return {
    url: resolveCarouselImageUrl(res.url),
    fileId: res.file_id ?? null,
    error: null,
  };
}

/**
 * Prefer Google Drive when enabled; otherwise upload to Supabase storage bucket.
 * Skips Drive auto-upload when image_input_mode is "url" only (caller shouldn't call this).
 */
export async function uploadAppImage(
  file: File,
  purpose: DriveUploadPurpose,
  fallbackUpload: (file: File) => Promise<{ url: string | null; error: Error | null }>,
): Promise<{ url: string | null; error: Error | null; via: "drive" | "storage" }> {
  const settings = await fetchGoogleDriveSettings();
  // User-facing purposes respect input mode; admin media always may upload files.
  if ((purpose === "request" || purpose === "avatar") && !canUploadImageFile(settings)) {
    return { url: null, error: new Error("File upload is disabled (URL mode only)"), via: "storage" };
  }
  const folderOk =
    !!(settings.folder_id ||
      (purpose === "request" && settings.folder_requests) ||
      (purpose === "avatar" && settings.folder_avatars) ||
      (purpose === "media" && settings.folder_media));

  if (settings.enabled && folderOk) {
    const drive = await uploadImageToGoogleDrive(file, purpose);
    if (!drive.error && drive.url) {
      return { url: drive.url, error: null, via: "drive" };
    }
    const fb = await fallbackUpload(file);
    if (fb.url) return { url: fb.url, error: null, via: "storage" };
    return {
      url: null,
      error: drive.error ?? fb.error ?? new Error("Upload failed"),
      via: "drive",
    };
  }

  const fb = await fallbackUpload(file);
  return { url: fb.url, error: fb.error, via: "storage" };
}
