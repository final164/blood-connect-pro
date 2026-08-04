import { supabase } from "@/integrations/supabase/client";
import {
  isGoogleDriveUrl,
  resolveCarouselImageUrl,
} from "@/lib/feed-carousel";

export type FeedBannerSettings = {
  enabled: boolean;
  /** Show once after the first N posts. 0 = at the top of the feed (before posts). */
  insert_after_posts: number;
  title_bn: string;
  title_en: string;
  show_header: boolean;
  show_nav_arrows: boolean;
  show_dots: boolean;
  show_captions: boolean;
  loop: boolean;
  autoplay: boolean;
  autoplay_ms: number;
  /** CSS aspect-ratio, e.g. "16/9" */
  aspect_ratio: string;
  max_height_px: number;
  radius_px: number;
  open_links_new_tab: boolean;
};

export type FeedBannerSlide = {
  id: string;
  image_url: string;
  title_bn: string;
  title_en: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_FEED_BANNER_SETTINGS: FeedBannerSettings = {
  enabled: true,
  insert_after_posts: 4,
  title_bn: "স্পটলাইট",
  title_en: "Spotlight",
  show_header: false,
  show_nav_arrows: true,
  show_dots: true,
  show_captions: true,
  loop: true,
  autoplay: true,
  autoplay_ms: 5000,
  aspect_ratio: "16/9",
  max_height_px: 280,
  radius_px: 16,
  open_links_new_tab: true,
};

const BUCKET = "feed-carousel";

let settingsCache: FeedBannerSettings | null = null;
let settingsCachedAt = 0;
let slidesCache: FeedBannerSlide[] | null = null;
let slidesCachedAt = 0;

export { isGoogleDriveUrl, resolveCarouselImageUrl };

export function invalidateFeedBannerCache() {
  settingsCache = null;
  settingsCachedAt = 0;
  slidesCache = null;
  slidesCachedAt = 0;
}

function clampInt(n: unknown, min: number, max: number, fallback: number) {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}

export function normalizeFeedBannerSettings(raw: unknown): FeedBannerSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<FeedBannerSettings>;
  const aspect =
    typeof r.aspect_ratio === "string" && /^\d+\s*\/\s*\d+$/.test(r.aspect_ratio.trim())
      ? r.aspect_ratio.trim().replace(/\s+/g, "")
      : DEFAULT_FEED_BANNER_SETTINGS.aspect_ratio;
  return {
    enabled: r.enabled !== false,
    insert_after_posts: clampInt(r.insert_after_posts, 0, 50, 4),
    title_bn:
      typeof r.title_bn === "string" && r.title_bn.trim()
        ? r.title_bn.trim()
        : DEFAULT_FEED_BANNER_SETTINGS.title_bn,
    title_en:
      typeof r.title_en === "string" && r.title_en.trim()
        ? r.title_en.trim()
        : DEFAULT_FEED_BANNER_SETTINGS.title_en,
    show_header: r.show_header === true,
    show_nav_arrows: r.show_nav_arrows !== false,
    show_dots: r.show_dots !== false,
    show_captions: r.show_captions !== false,
    loop: r.loop !== false,
    autoplay: r.autoplay !== false,
    autoplay_ms: clampInt(r.autoplay_ms, 1500, 60_000, 5000),
    aspect_ratio: aspect,
    max_height_px: clampInt(r.max_height_px, 120, 640, 280),
    radius_px: clampInt(r.radius_px, 0, 32, 16),
    open_links_new_tab: r.open_links_new_tab !== false,
  };
}

function mapSlide(row: Record<string, unknown>): FeedBannerSlide {
  return {
    id: String(row.id),
    image_url: String(row.image_url ?? ""),
    title_bn: typeof row.title_bn === "string" ? row.title_bn : "",
    title_en: typeof row.title_en === "string" ? row.title_en : "",
    link_url: typeof row.link_url === "string" && row.link_url.trim() ? row.link_url.trim() : null,
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

export async function fetchFeedBannerSettings(force = false): Promise<FeedBannerSettings> {
  if (!force && settingsCache && Date.now() - settingsCachedAt < 60_000) return settingsCache;
  const { data, error } = await supabase
    .from("app_settings")
    .select("feed_banner_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    settingsCache = { ...DEFAULT_FEED_BANNER_SETTINGS };
  } else {
    settingsCache = normalizeFeedBannerSettings(
      (data as { feed_banner_settings?: unknown }).feed_banner_settings,
    );
  }
  settingsCachedAt = Date.now();
  return settingsCache;
}

export async function saveFeedBannerSettings(next: FeedBannerSettings) {
  const normalized = normalizeFeedBannerSettings(next);
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    feed_banner_settings: normalized,
  } as never);
  if (!error) {
    settingsCache = normalized;
    settingsCachedAt = Date.now();
  }
  return { error, settings: normalized };
}

export async function fetchActiveFeedBannerSlides(force = false): Promise<FeedBannerSlide[]> {
  if (!force && slidesCache && Date.now() - slidesCachedAt < 60_000) return slidesCache;
  const { data, error } = await supabase
    .from("feed_banner_slides")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error || !data) {
    slidesCache = [];
  } else {
    slidesCache = (data as Record<string, unknown>[]).map(mapSlide).filter((s) => !!s.image_url);
  }
  slidesCachedAt = Date.now();
  return slidesCache;
}

export async function fetchAllFeedBannerSlides(): Promise<{
  slides: FeedBannerSlide[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("feed_banner_slides")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return { slides: [], error: new Error(error.message) };
  return {
    slides: ((data ?? []) as Record<string, unknown>[]).map(mapSlide),
    error: null,
  };
}

export async function upsertFeedBannerSlide(
  slide: Partial<FeedBannerSlide> & { image_url: string },
) {
  const payload: Record<string, unknown> = {
    image_url: resolveCarouselImageUrl(slide.image_url),
    title_bn: slide.title_bn?.trim() ?? "",
    title_en: slide.title_en?.trim() ?? "",
    link_url: slide.link_url?.trim() || null,
    sort_order: Number.isFinite(slide.sort_order) ? slide.sort_order! : 0,
    is_active: slide.is_active !== false,
    updated_at: new Date().toISOString(),
  };

  const query = slide.id
    ? supabase
        .from("feed_banner_slides")
        .update(payload as never)
        .eq("id", slide.id)
        .select("*")
        .maybeSingle()
    : supabase
        .from("feed_banner_slides")
        .insert(payload as never)
        .select("*")
        .maybeSingle();

  const { data, error } = await query;
  invalidateFeedBannerCache();
  return {
    error: error ? new Error(error.message) : null,
    slide: data ? mapSlide(data as Record<string, unknown>) : null,
  };
}

export async function deleteFeedBannerSlide(id: string) {
  const { error } = await supabase.from("feed_banner_slides").delete().eq("id", id);
  invalidateFeedBannerCache();
  return { error: error ? new Error(error.message) : null };
}

export async function reorderFeedBannerSlides(orderedIds: string[]) {
  const updates = orderedIds.map((id, i) =>
    supabase
      .from("feed_banner_slides")
      .update({ sort_order: (i + 1) * 10, updated_at: new Date().toISOString() } as never)
      .eq("id", id),
  );
  const results = await Promise.all(updates);
  const firstErr = results.find((r) => r.error)?.error;
  invalidateFeedBannerCache();
  return { error: firstErr ? new Error(firstErr.message) : null };
}

export async function uploadFeedBannerImage(file: File): Promise<{
  url: string | null;
  error: Error | null;
}> {
  const { uploadAppImage } = await import("@/lib/google-drive");
  const result = await uploadAppImage(file, "media", async (f) => {
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `banner/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || "jpg"}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
      cacheControl: "3600",
      upsert: false,
      contentType: f.type || undefined,
    });
    if (error) return { url: null, error: new Error(error.message) };
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  });
  return { url: result.url, error: result.error };
}

export async function fetchFeedBannerBundle(force = false) {
  const [settings, slides] = await Promise.all([
    fetchFeedBannerSettings(force),
    fetchActiveFeedBannerSlides(force),
  ]);
  return { settings, slides };
}
