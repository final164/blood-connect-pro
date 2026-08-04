import { supabase } from "@/integrations/supabase/client";
import { resolveCarouselImageUrl } from "@/lib/feed-carousel";

const BUCKET = "feed-carousel";
const PREFIX = "landing";

export type LandingStat = {
  id: string;
  label_bn: string;
  label_en: string;
  value_text: string;
  icon_key: string;
  source: "manual" | "live_donors" | "live_requests";
  sort_order: number;
  is_active: boolean;
};

export type LandingCard = {
  id: string;
  kind: "how" | "feature";
  title_bn: string;
  title_en: string;
  body_bn: string;
  body_en: string;
  icon_key: string;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export type LandingSlide = {
  id: string;
  kind: "main" | "stories";
  image_url: string;
  title_bn: string;
  title_en: string;
  body_bn: string;
  body_en: string;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export type LandingCampaign = {
  id: string;
  title_bn: string;
  title_en: string;
  body_bn: string;
  body_en: string;
  cover_url: string | null;
  starts_on: string | null;
  ends_on: string | null;
  cta_bn: string;
  cta_en: string;
  cta_href: string | null;
  sort_order: number;
  is_active: boolean;
};

export type LandingGalleryItem = {
  id: string;
  image_url: string;
  caption_bn: string;
  caption_en: string;
  sort_order: number;
  is_active: boolean;
};

export type LandingFaq = {
  id: string;
  question_bn: string;
  question_en: string;
  answer_bn: string;
  answer_en: string;
  sort_order: number;
  is_active: boolean;
};

export type LandingCommunityCard = {
  id: string;
  title_bn: string;
  title_en: string;
  body_bn: string;
  body_en: string;
  image_url: string | null;
  link_url: string | null;
  sort_order: number;
  is_active: boolean;
};

export type LandingContentBundle = {
  stats: LandingStat[];
  cards: LandingCard[];
  carousel: LandingSlide[];
  stories: LandingSlide[];
  campaigns: LandingCampaign[];
  gallery: LandingGalleryItem[];
  faqs: LandingFaq[];
  communityCards: LandingCommunityCard[];
  liveRequestCount: number | null;
};

async function selectActive<T>(table: string, map: (row: Record<string, unknown>) => T): Promise<T[]> {
  const { data, error } = await supabase
    .from(table as never)
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn(`[landing] ${table}:`, error.message);
    return [];
  }
  return (data ?? []).map((row) => map(row as Record<string, unknown>));
}

async function selectAllAdmin<T>(table: string, map: (row: Record<string, unknown>) => T): Promise<T[]> {
  const { data, error } = await supabase
    .from(table as never)
    .select("*")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => map(row as Record<string, unknown>));
}

function mapStat(row: Record<string, unknown>): LandingStat {
  const source = row.source === "live_donors" || row.source === "live_requests" ? row.source : "manual";
  return {
    id: String(row.id),
    label_bn: String(row.label_bn ?? ""),
    label_en: String(row.label_en ?? ""),
    value_text: String(row.value_text ?? "0"),
    icon_key: String(row.icon_key ?? "droplet"),
    source,
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
  };
}

function mapCard(row: Record<string, unknown>): LandingCard {
  return {
    id: String(row.id),
    kind: row.kind === "feature" ? "feature" : "how",
    title_bn: String(row.title_bn ?? ""),
    title_en: String(row.title_en ?? ""),
    body_bn: String(row.body_bn ?? ""),
    body_en: String(row.body_en ?? ""),
    icon_key: String(row.icon_key ?? "heart"),
    image_url: typeof row.image_url === "string" && row.image_url ? resolveCarouselImageUrl(row.image_url) : null,
    link_url: typeof row.link_url === "string" && row.link_url ? row.link_url : null,
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
  };
}

function mapSlide(row: Record<string, unknown>): LandingSlide {
  return {
    id: String(row.id),
    kind: row.kind === "stories" ? "stories" : "main",
    image_url: resolveCarouselImageUrl(String(row.image_url ?? "")),
    title_bn: String(row.title_bn ?? ""),
    title_en: String(row.title_en ?? ""),
    body_bn: String(row.body_bn ?? ""),
    body_en: String(row.body_en ?? ""),
    link_url: typeof row.link_url === "string" && row.link_url ? row.link_url : null,
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
  };
}

function mapCampaign(row: Record<string, unknown>): LandingCampaign {
  return {
    id: String(row.id),
    title_bn: String(row.title_bn ?? ""),
    title_en: String(row.title_en ?? ""),
    body_bn: String(row.body_bn ?? ""),
    body_en: String(row.body_en ?? ""),
    cover_url:
      typeof row.cover_url === "string" && row.cover_url ? resolveCarouselImageUrl(row.cover_url) : null,
    starts_on: typeof row.starts_on === "string" ? row.starts_on : null,
    ends_on: typeof row.ends_on === "string" ? row.ends_on : null,
    cta_bn: String(row.cta_bn ?? ""),
    cta_en: String(row.cta_en ?? ""),
    cta_href: typeof row.cta_href === "string" && row.cta_href ? row.cta_href : null,
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
  };
}

function mapGallery(row: Record<string, unknown>): LandingGalleryItem {
  return {
    id: String(row.id),
    image_url: resolveCarouselImageUrl(String(row.image_url ?? "")),
    caption_bn: String(row.caption_bn ?? ""),
    caption_en: String(row.caption_en ?? ""),
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
  };
}

function mapFaq(row: Record<string, unknown>): LandingFaq {
  return {
    id: String(row.id),
    question_bn: String(row.question_bn ?? ""),
    question_en: String(row.question_en ?? ""),
    answer_bn: String(row.answer_bn ?? ""),
    answer_en: String(row.answer_en ?? ""),
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
  };
}

function mapCommunityCard(row: Record<string, unknown>): LandingCommunityCard {
  return {
    id: String(row.id),
    title_bn: String(row.title_bn ?? ""),
    title_en: String(row.title_en ?? ""),
    body_bn: String(row.body_bn ?? ""),
    body_en: String(row.body_en ?? ""),
    image_url:
      typeof row.image_url === "string" && row.image_url ? resolveCarouselImageUrl(row.image_url) : null,
    link_url: typeof row.link_url === "string" && row.link_url ? row.link_url : null,
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
  };
}

export async function fetchLandingContentBundle(): Promise<LandingContentBundle> {
  const [stats, cards, slides, campaigns, gallery, faqs, communityCards, reqCount] = await Promise.all([
    selectActive("landing_stats", mapStat),
    selectActive("landing_cards", mapCard),
    selectActive("landing_carousel_slides", mapSlide),
    selectActive("landing_campaigns", mapCampaign),
    selectActive("landing_gallery", mapGallery),
    selectActive("landing_faqs", mapFaq),
    selectActive("landing_community_cards", mapCommunityCard),
    (async () => {
      try {
        const r = await supabase
          .from("blood_requests")
          .select("id", { count: "exact", head: true })
          .eq("status", "open");
        return typeof r.count === "number" ? r.count : null;
      } catch {
        return null;
      }
    })(),
  ]);

  return {
    stats,
    cards,
    carousel: slides.filter((s: LandingSlide) => s.kind === "main"),
    stories: slides.filter((s: LandingSlide) => s.kind === "stories"),
    campaigns,
    gallery,
    faqs,
    communityCards,
    liveRequestCount: reqCount,
  };
}

export async function uploadLandingImage(file: File): Promise<string> {
  const { uploadAppImage } = await import("@/lib/google-drive");
  const result = await uploadAppImage(file, "media", async (f) => {
    const ext = f.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${PREFIX}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, f, {
      cacheControl: "3600",
      upsert: false,
      contentType: f.type || "image/jpeg",
    });
    if (error) throw error;
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  });
  if (!result.url) throw result.error ?? new Error("Upload failed");
  return result.url;
}

/** Admin list helpers */
export const landingAdmin = {
  stats: () => selectAllAdmin("landing_stats", mapStat),
  cards: () => selectAllAdmin("landing_cards", mapCard),
  slides: () => selectAllAdmin("landing_carousel_slides", mapSlide),
  campaigns: () => selectAllAdmin("landing_campaigns", mapCampaign),
  gallery: () => selectAllAdmin("landing_gallery", mapGallery),
  faqs: () => selectAllAdmin("landing_faqs", mapFaq),
  communityCards: () => selectAllAdmin("landing_community_cards", mapCommunityCard),

  async upsert(table: string, row: Record<string, unknown>) {
    const payload = { ...row };
    if (typeof payload.image_url === "string") payload.image_url = resolveCarouselImageUrl(payload.image_url);
    if (typeof payload.cover_url === "string") payload.cover_url = resolveCarouselImageUrl(payload.cover_url);
    const { error } = await supabase.from(table as never).upsert(payload as never);
    if (error) throw error;
  },

  async remove(table: string, id: string) {
    const { error } = await supabase.from(table as never).delete().eq("id", id);
    if (error) throw error;
  },
};
