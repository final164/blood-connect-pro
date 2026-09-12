import { supabase } from "@/integrations/supabase/client";
import {
  resolveCarouselImageUrl,
  type FeedCarouselSettings,
} from "@/lib/feed-carousel";

export type SuccessCarouselSettings = Omit<
  FeedCarouselSettings,
  "show_on_community" | "community_district_filter" | "community_carousel_sticky"
>;

export type SuccessStorySlide = {
  id: string;
  request_id: string | null;
  district_id: string | null;
  blood_group: string;
  patient_name: string;
  hospital: string;
  bags_needed: number;
  location_label: string;
  notes_excerpt: string;
  completed_at: string;
  title_bn: string;
  title_en: string;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
};

export const DEFAULT_SUCCESS_CAROUSEL_SETTINGS: SuccessCarouselSettings = {
  enabled: true,
  insert_after_every: 3,
  title_bn: "সফল রক্তদান",
  title_en: "Successful donations",
  show_header: true,
  show_nav_arrows: true,
  show_item_menu: false,
  loop: true,
  autoplay: true,
  autoplay_ms: 5000,
  card_aspect: "3/4",
  card_basis_px: 160,
  gap_px: 12,
  radius_px: 16,
  open_links_new_tab: false,
};

const BUCKET = "success-carousel";

let settingsCache: SuccessCarouselSettings | null = null;
let settingsCachedAt = 0;
let slidesCache: SuccessStorySlide[] | null = null;
let slidesCachedAt = 0;

export function invalidateSuccessCarouselCache() {
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

export function normalizeSuccessCarouselSettings(raw: unknown): SuccessCarouselSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<SuccessCarouselSettings>;
  const aspect =
    typeof r.card_aspect === "string" && /^\d+\s*\/\s*\d+$/.test(r.card_aspect.trim())
      ? r.card_aspect.trim().replace(/\s+/g, "")
      : DEFAULT_SUCCESS_CAROUSEL_SETTINGS.card_aspect;
  return {
    enabled: r.enabled !== false,
    insert_after_every: clampInt(r.insert_after_every, 1, 20, 3),
    title_bn:
      typeof r.title_bn === "string" && r.title_bn.trim()
        ? r.title_bn.trim()
        : DEFAULT_SUCCESS_CAROUSEL_SETTINGS.title_bn,
    title_en:
      typeof r.title_en === "string" && r.title_en.trim()
        ? r.title_en.trim()
        : DEFAULT_SUCCESS_CAROUSEL_SETTINGS.title_en,
    show_header: r.show_header !== false,
    show_nav_arrows: r.show_nav_arrows !== false,
    show_item_menu: r.show_item_menu === true,
    loop: r.loop !== false,
    autoplay: r.autoplay === true,
    autoplay_ms: clampInt(r.autoplay_ms, 1500, 60_000, 5000),
    card_aspect: aspect,
    card_basis_px: clampInt(r.card_basis_px, 80, 280, 160),
    gap_px: clampInt(r.gap_px, 0, 32, 12),
    radius_px: clampInt(r.radius_px, 0, 32, 16),
    open_links_new_tab: r.open_links_new_tab === true,
  };
}

function mapSlide(row: Record<string, unknown>): SuccessStorySlide {
  return {
    id: String(row.id),
    request_id:
      typeof row.request_id === "string" && row.request_id.trim() ? row.request_id.trim() : null,
    district_id:
      typeof row.district_id === "string" && row.district_id.trim() ? row.district_id.trim() : null,
    blood_group: typeof row.blood_group === "string" ? row.blood_group : "",
    patient_name: typeof row.patient_name === "string" ? row.patient_name : "",
    hospital: typeof row.hospital === "string" ? row.hospital : "",
    bags_needed: Number(row.bags_needed) || 1,
    location_label: typeof row.location_label === "string" ? row.location_label : "",
    notes_excerpt: typeof row.notes_excerpt === "string" ? row.notes_excerpt : "",
    completed_at:
      typeof row.completed_at === "string" ? row.completed_at : new Date().toISOString(),
    title_bn: typeof row.title_bn === "string" ? row.title_bn : "",
    title_en: typeof row.title_en === "string" ? row.title_en : "",
    image_url:
      typeof row.image_url === "string" && row.image_url.trim()
        ? resolveCarouselImageUrl(row.image_url.trim())
        : null,
    link_url: typeof row.link_url === "string" && row.link_url.trim() ? row.link_url.trim() : null,
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : undefined,
  };
}

export async function fetchSuccessCarouselSettings(force = false): Promise<SuccessCarouselSettings> {
  if (!force && settingsCache && Date.now() - settingsCachedAt < 60_000) return settingsCache;
  const { data, error } = await supabase
    .from("app_settings")
    .select("success_carousel_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    settingsCache = { ...DEFAULT_SUCCESS_CAROUSEL_SETTINGS };
  } else {
    settingsCache = normalizeSuccessCarouselSettings(
      (data as { success_carousel_settings?: unknown }).success_carousel_settings,
    );
  }
  settingsCachedAt = Date.now();
  return settingsCache;
}

export async function saveSuccessCarouselSettings(next: SuccessCarouselSettings) {
  const normalized = normalizeSuccessCarouselSettings(next);
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    success_carousel_settings: normalized,
  } as never);
  if (!error) {
    settingsCache = normalized;
    settingsCachedAt = Date.now();
  }
  return { error, settings: normalized };
}

export async function fetchActiveSuccessStorySlides(force = false): Promise<SuccessStorySlide[]> {
  if (!force && slidesCache && Date.now() - slidesCachedAt < 60_000) return slidesCache;
  const { data, error } = await supabase
    .from("success_story_slides")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("completed_at", { ascending: false });
  if (error || !data) {
    slidesCache = [];
  } else {
    slidesCache = (data as Record<string, unknown>[]).map(mapSlide);
  }
  slidesCachedAt = Date.now();
  return slidesCache;
}

export async function fetchAllSuccessStorySlides(): Promise<{
  slides: SuccessStorySlide[];
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from("success_story_slides")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("completed_at", { ascending: false });
  if (error) return { slides: [], error: new Error(error.message) };
  return {
    slides: ((data ?? []) as Record<string, unknown>[]).map(mapSlide),
    error: null,
  };
}

export async function upsertSuccessStorySlide(slide: Partial<SuccessStorySlide> & { id?: string }) {
  const payload: Record<string, unknown> = {
    request_id: slide.request_id?.trim() || null,
    district_id: slide.district_id?.trim() || null,
    blood_group: slide.blood_group?.trim() ?? "",
    patient_name: slide.patient_name?.trim() ?? "",
    hospital: slide.hospital?.trim() ?? "",
    bags_needed: Math.max(1, Number(slide.bags_needed) || 1),
    location_label: slide.location_label?.trim() ?? "",
    notes_excerpt: slide.notes_excerpt?.trim() ?? "",
    title_bn: slide.title_bn?.trim() ?? "",
    title_en: slide.title_en?.trim() ?? "",
    image_url: slide.image_url?.trim()
      ? resolveCarouselImageUrl(slide.image_url.trim())
      : null,
    link_url: slide.link_url?.trim() || null,
    sort_order: Number.isFinite(slide.sort_order) ? slide.sort_order! : 0,
    is_active: slide.is_active !== false,
    updated_at: new Date().toISOString(),
  };

  const query = slide.id
    ? supabase
        .from("success_story_slides")
        .update(payload as never)
        .eq("id", slide.id)
        .select("*")
        .maybeSingle()
    : supabase
        .from("success_story_slides")
        .insert(payload as never)
        .select("*")
        .maybeSingle();

  const { data, error } = await query;
  invalidateSuccessCarouselCache();
  return {
    error: error ? new Error(error.message) : null,
    slide: data ? mapSlide(data as Record<string, unknown>) : null,
  };
}

export async function deleteSuccessStorySlide(id: string) {
  const { error } = await supabase.from("success_story_slides").delete().eq("id", id);
  invalidateSuccessCarouselCache();
  return { error: error ? new Error(error.message) : null };
}

export async function reorderSuccessStorySlides(orderedIds: string[]) {
  const updates = orderedIds.map((id, i) =>
    supabase
      .from("success_story_slides")
      .update({ sort_order: (i + 1) * 10, updated_at: new Date().toISOString() } as never)
      .eq("id", id),
  );
  const results = await Promise.all(updates);
  const firstErr = results.find((r) => r.error)?.error;
  invalidateSuccessCarouselCache();
  return { error: firstErr ? new Error(firstErr.message) : null };
}

export async function uploadSuccessCarouselImage(file: File): Promise<{
  url: string | null;
  error: Error | null;
}> {
  const { uploadAppImage } = await import("@/lib/google-drive");
  const result = await uploadAppImage(file, "media", async (f) => {
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const path = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || "jpg"}`;
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

export async function fetchSuccessCarouselBundle(force = false) {
  const [settings, slides] = await Promise.all([
    fetchSuccessCarouselSettings(force),
    fetchActiveSuccessStorySlides(force),
  ]);
  return { settings, slides };
}

export function successSlideHref(slide: SuccessStorySlide): string | null {
  if (slide.link_url?.trim()) return slide.link_url.trim();
  if (slide.request_id) return `/home?requestId=${encodeURIComponent(slide.request_id)}`;
  return null;
}
