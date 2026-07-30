import { supabase } from "@/integrations/supabase/client";

export type FeedCarouselSettings = {
  enabled: boolean;
  /** Insert a carousel block after every N feed posts (default 2). */
  insert_after_every: number;
  title_bn: string;
  title_en: string;
  show_header: boolean;
  show_nav_arrows: boolean;
  show_item_menu: boolean;
  loop: boolean;
  autoplay: boolean;
  autoplay_ms: number;
  /** CSS aspect-ratio value, e.g. "2/3" or "9/16" */
  card_aspect: string;
  /** Approximate slide width in px (peek layout). */
  card_basis_px: number;
  gap_px: number;
  radius_px: number;
  open_links_new_tab: boolean;
};

export type FeedCarouselSlide = {
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

export const DEFAULT_FEED_CAROUSEL_SETTINGS: FeedCarouselSettings = {
  enabled: true,
  insert_after_every: 2,
  title_bn: "হাইলাইটস",
  title_en: "Highlights",
  show_header: true,
  show_nav_arrows: true,
  show_item_menu: false,
  loop: true,
  autoplay: false,
  autoplay_ms: 4500,
  card_aspect: "2/3",
  card_basis_px: 128,
  gap_px: 10,
  radius_px: 14,
  open_links_new_tab: true,
};

const BUCKET = "feed-carousel";

let settingsCache: FeedCarouselSettings | null = null;
let settingsCachedAt = 0;
let slidesCache: FeedCarouselSlide[] | null = null;
let slidesCachedAt = 0;

export function invalidateFeedCarouselCache() {
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

export function normalizeFeedCarouselSettings(raw: unknown): FeedCarouselSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<FeedCarouselSettings>;
  const aspect =
    typeof r.card_aspect === "string" && /^\d+\s*\/\s*\d+$/.test(r.card_aspect.trim())
      ? r.card_aspect.trim().replace(/\s+/g, "")
      : DEFAULT_FEED_CAROUSEL_SETTINGS.card_aspect;
  return {
    enabled: r.enabled !== false,
    insert_after_every: clampInt(r.insert_after_every, 1, 20, 2),
    title_bn:
      typeof r.title_bn === "string" && r.title_bn.trim()
        ? r.title_bn.trim()
        : DEFAULT_FEED_CAROUSEL_SETTINGS.title_bn,
    title_en:
      typeof r.title_en === "string" && r.title_en.trim()
        ? r.title_en.trim()
        : DEFAULT_FEED_CAROUSEL_SETTINGS.title_en,
    show_header: r.show_header !== false,
    show_nav_arrows: r.show_nav_arrows !== false,
    show_item_menu: r.show_item_menu === true,
    loop: r.loop !== false,
    autoplay: r.autoplay === true,
    autoplay_ms: clampInt(r.autoplay_ms, 1500, 60_000, 4500),
    card_aspect: aspect,
    card_basis_px: clampInt(r.card_basis_px, 80, 280, 128),
    gap_px: clampInt(r.gap_px, 0, 32, 10),
    radius_px: clampInt(r.radius_px, 0, 32, 14),
    open_links_new_tab: r.open_links_new_tab !== false,
  };
}

function mapSlide(row: Record<string, unknown>): FeedCarouselSlide {
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

export async function fetchFeedCarouselSettings(force = false): Promise<FeedCarouselSettings> {
  if (!force && settingsCache && Date.now() - settingsCachedAt < 60_000) return settingsCache;
  const { data, error } = await supabase
    .from("app_settings")
    .select("feed_carousel_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    settingsCache = { ...DEFAULT_FEED_CAROUSEL_SETTINGS };
  } else {
    settingsCache = normalizeFeedCarouselSettings(
      (data as { feed_carousel_settings?: unknown }).feed_carousel_settings,
    );
  }
  settingsCachedAt = Date.now();
  return settingsCache;
}

export async function saveFeedCarouselSettings(next: FeedCarouselSettings) {
  const normalized = normalizeFeedCarouselSettings(next);
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    feed_carousel_settings: normalized,
  } as never);
  if (!error) {
    settingsCache = normalized;
    settingsCachedAt = Date.now();
  }
  return { error, settings: normalized };
}

/** Active slides for the public feed (ordered). */
export async function fetchActiveFeedCarouselSlides(force = false): Promise<FeedCarouselSlide[]> {
  if (!force && slidesCache && Date.now() - slidesCachedAt < 60_000) return slidesCache;
  const { data, error } = await supabase
    .from("feed_carousel_slides")
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

/** All slides for admin (including inactive). */
export async function fetchAllFeedCarouselSlides(): Promise<{
  slides: FeedCarouselSlide[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("feed_carousel_slides")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) return { slides: [], error: new Error(error.message) };
  return {
    slides: ((data ?? []) as Record<string, unknown>[]).map(mapSlide),
    error: null,
  };
}

export async function upsertFeedCarouselSlide(
  slide: Partial<FeedCarouselSlide> & { image_url: string },
) {
  const payload: Record<string, unknown> = {
    image_url: slide.image_url.trim(),
    title_bn: slide.title_bn?.trim() ?? "",
    title_en: slide.title_en?.trim() ?? "",
    link_url: slide.link_url?.trim() || null,
    sort_order: Number.isFinite(slide.sort_order) ? slide.sort_order! : 0,
    is_active: slide.is_active !== false,
    updated_at: new Date().toISOString(),
  };

  const query = slide.id
    ? supabase
        .from("feed_carousel_slides")
        .update(payload as never)
        .eq("id", slide.id)
        .select("*")
        .maybeSingle()
    : supabase
        .from("feed_carousel_slides")
        .insert(payload as never)
        .select("*")
        .maybeSingle();

  const { data, error } = await query;
  invalidateFeedCarouselCache();
  return {
    error: error ? new Error(error.message) : null,
    slide: data ? mapSlide(data as Record<string, unknown>) : null,
  };
}

export async function deleteFeedCarouselSlide(id: string) {
  const { error } = await supabase.from("feed_carousel_slides").delete().eq("id", id);
  invalidateFeedCarouselCache();
  return { error: error ? new Error(error.message) : null };
}

export async function reorderFeedCarouselSlides(orderedIds: string[]) {
  const updates = orderedIds.map((id, i) =>
    supabase
      .from("feed_carousel_slides")
      .update({ sort_order: (i + 1) * 10, updated_at: new Date().toISOString() } as never)
      .eq("id", id),
  );
  const results = await Promise.all(updates);
  const firstErr = results.find((r) => r.error)?.error;
  invalidateFeedCarouselCache();
  return { error: firstErr ? new Error(firstErr.message) : null };
}

export async function uploadFeedCarouselImage(file: File): Promise<{
  url: string | null;
  error: Error | null;
}> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || "jpg"}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) return { url: null, error: new Error(error.message) };
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

export async function fetchFeedCarouselBundle(force = false) {
  const [settings, slides] = await Promise.all([
    fetchFeedCarouselSettings(force),
    fetchActiveFeedCarouselSlides(force),
  ]);
  return { settings, slides };
}
