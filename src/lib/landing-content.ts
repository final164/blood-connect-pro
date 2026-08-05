import { supabase } from "@/integrations/supabase/client";
import { resolveCarouselImageUrl } from "@/lib/feed-carousel";
import { LANDING_MEDIA } from "@/lib/landing-media";

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
  liveDonorCount: number | null;
};

/** Client-side fallbacks when DB tables are empty — keeps frontpage polished. */
export const DEFAULT_LANDING_CONTENT: Omit<
  LandingContentBundle,
  "liveRequestCount" | "liveDonorCount"
> = {
  stats: [
    {
      id: "seed-stat-donors",
      label_bn: "সক্রিয় রক্তদাতা",
      label_en: "Active donors",
      value_text: "1,200+",
      icon_key: "users",
      source: "live_donors",
      sort_order: 0,
      is_active: true,
    },
    {
      id: "seed-stat-requests",
      label_bn: "খোলা রিকোয়েস্ট",
      label_en: "Open requests",
      value_text: "—",
      icon_key: "droplet",
      source: "live_requests",
      sort_order: 1,
      is_active: true,
    },
    {
      id: "seed-stat-orgs",
      label_bn: "সংস্থা",
      label_en: "Organizations",
      value_text: "40+",
      icon_key: "building",
      source: "manual",
      sort_order: 2,
      is_active: true,
    },
  ],
  cards: [
    {
      id: "seed-how-1",
      kind: "how",
      title_bn: "প্রোফাইল তৈরি করুন",
      title_en: "Create your profile",
      body_bn: "রক্তের গ্রুপ, এলাকা ও যোগাযোগ সেট করে এক মিনিটেই রেডি হোন।",
      body_en: "Set blood group, area, and contact — ready in a minute.",
      icon_key: "user",
      image_url: LANDING_MEDIA.how[0],
      link_url: "/auth",
      sort_order: 0,
      is_active: true,
    },
    {
      id: "seed-how-2",
      kind: "how",
      title_bn: "রিকোয়েস্ট দেখুন",
      title_en: "See live requests",
      body_bn: "আপনার কাছের জরুরি চাহিদা ফিডে দেখুন এবং দ্রুত সাড়া দিন।",
      body_en: "Browse urgent needs near you and respond fast.",
      icon_key: "bell",
      image_url: LANDING_MEDIA.how[1],
      link_url: "/auth",
      sort_order: 1,
      is_active: true,
    },
    {
      id: "seed-how-3",
      kind: "how",
      title_bn: "জীবন বাঁচান",
      title_en: "Help someone live",
      body_bn: "কল, এসএমএস বা হোয়াটসঅ্যাপে যোগাযোগ করে রক্তদান সম্পন্ন করুন।",
      body_en: "Connect via call, SMS, or WhatsApp and complete the donation.",
      icon_key: "heart",
      image_url: LANDING_MEDIA.how[2],
      link_url: "/auth",
      sort_order: 2,
      is_active: true,
    },
  ],
  carousel: [
    {
      id: "seed-carousel-1",
      kind: "main",
      image_url: LANDING_MEDIA.carousel[0],
      title_bn: "প্রতিটি ব্যাগ একটি জীবন",
      title_en: "Every bag is a life",
      body_bn: "নিয়মিত রক্তদান হাসপাতালের স্টক স্থিতিশীল রাখে।",
      body_en: "Regular donation keeps hospital stocks steady.",
      link_url: "/auth",
      sort_order: 0,
      is_active: true,
    },
    {
      id: "seed-carousel-2",
      kind: "main",
      image_url: LANDING_MEDIA.carousel[1],
      title_bn: "হাসপাতাল ও কমিউনিটি একসাথে",
      title_en: "Hospitals and community, together",
      body_bn: "পার্টনার হাসপাতাল ও স্থানীয় সংস্থা এক নেটওয়ার্কে।",
      body_en: "Partner hospitals and local orgs on one network.",
      link_url: "#community",
      sort_order: 1,
      is_active: true,
    },
    {
      id: "seed-carousel-3",
      kind: "main",
      image_url: LANDING_MEDIA.carousel[2],
      title_bn: "জরুরি মুহূর্তে দ্রুত ম্যাচ",
      title_en: "Fast match when it matters",
      body_bn: "গ্রুপ ও লোকেশন মিলিয়ে কাছের ডোনার খুঁজুন।",
      body_en: "Match by group and location to find nearby donors.",
      link_url: "/auth",
      sort_order: 2,
      is_active: true,
    },
  ],
  stories: [
    {
      id: "seed-story-1",
      kind: "stories",
      image_url: LANDING_MEDIA.stories[0],
      title_bn: "প্রথমবার রক্তদান",
      title_en: "My first donation",
      body_bn: "ভয় পেয়েছিলাম — কিন্তু কেউ একজন বাঁচলো। এখন প্রতি তিন মাসে দিই।",
      body_en: "I was nervous — then someone lived. Now I donate every three months.",
      link_url: "/auth",
      sort_order: 0,
      is_active: true,
    },
    {
      id: "seed-story-2",
      kind: "stories",
      image_url: LANDING_MEDIA.stories[1],
      title_bn: "মধ্যরাতে রিকোয়েস্ট",
      title_en: "A midnight request",
      body_bn: "BloodLink নোটিফিকেশনে দেখে হাসপাতালে পৌঁছেছি — সময়মতো।",
      body_en: "A BloodLink alert got me to the hospital in time.",
      link_url: "#faq",
      sort_order: 1,
      is_active: true,
    },
  ],
  campaigns: [
    {
      id: "seed-camp-1",
      title_bn: "জরুরি O-negative ড্রাইভ",
      title_en: "Urgent O-negative drive",
      body_bn: "O-negative সর্বজনীন ডোনার — এই সপ্তাহে অগ্রাধিকার দিন।",
      body_en: "O-negative is universal — prioritize it this week.",
      cover_url: LANDING_MEDIA.campaigns[0],
      starts_on: null,
      ends_on: null,
      cta_bn: "যোগ দিন",
      cta_en: "Join now",
      cta_href: "/auth",
      sort_order: 0,
      is_active: true,
    },
    {
      id: "seed-camp-2",
      title_bn: "কলেজ ক্যাম্পাস ড্রাইভ",
      title_en: "Campus donation week",
      body_bn: "বিশ্ববিদ্যালয় ও কলেজে সচেতনতা ও রেজিস্ট্রেশন ক্যাম্প।",
      body_en: "Awareness and registration camps across campuses.",
      cover_url: LANDING_MEDIA.campaigns[1],
      starts_on: null,
      ends_on: null,
      cta_bn: "রেজিস্টার",
      cta_en: "Register",
      cta_href: "/auth",
      sort_order: 1,
      is_active: true,
    },
    {
      id: "seed-camp-3",
      title_bn: "থ্যালাসেমিয়া সহায়তা",
      title_en: "Thalassemia support",
      body_bn: "নিয়মিত রক্তের প্রয়োজন — স্থায়ী ডোনার পুল গড়ুন।",
      body_en: "Ongoing need — build a steady donor pool.",
      cover_url: LANDING_MEDIA.campaigns[2],
      starts_on: null,
      ends_on: null,
      cta_bn: "জানুন",
      cta_en: "Learn more",
      cta_href: "#faq",
      sort_order: 2,
      is_active: true,
    },
  ],
  gallery: LANDING_MEDIA.gallery.map((url, i) => ({
    id: `seed-gallery-${i + 1}`,
    image_url: url,
    caption_bn:
      i % 2 === 0 ? "রক্তদান ক্যাম্প" : i % 3 === 0 ? "স্বেচ্ছাসেবী দল" : "হাসপাতাল পার্টনারশিপ",
    caption_en:
      i % 2 === 0 ? "Donation camp" : i % 3 === 0 ? "Volunteer team" : "Hospital partnership",
    sort_order: i,
    is_active: true,
  })),
  faqs: [
    {
      id: "seed-faq-1",
      question_bn: "BloodLink কী?",
      question_en: "What is BloodLink?",
      answer_bn:
        "BloodLink একটি রিয়েলটাইম রক্তদাতা নেটওয়ার্ক — রিকোয়েস্ট পোস্ট করুন, কাছের ডোনার খুঁজুন, এবং নিরাপদে যোগাযোগ করুন।",
      answer_en:
        "BloodLink is a realtime blood donor network — post requests, find nearby donors, and connect safely.",
      sort_order: 0,
      is_active: true,
    },
    {
      id: "seed-faq-2",
      question_bn: "কীভাবে রক্তদাতা হবো?",
      question_en: "How do I become a donor?",
      answer_bn:
        "সাইন আপ করুন, রক্তের গ্রুপ ও লোকেশন দিন, উপলব্ধতা চালু রাখুন। জরুরি রিকোয়েস্ট এলে নোটিফিকেশন পাবেন।",
      answer_en:
        "Sign up, set your blood group and location, stay available. You’ll get alerts for urgent matches.",
      sort_order: 1,
      is_active: true,
    },
    {
      id: "seed-faq-3",
      question_bn: "কমিউনিটি সংস্থা কারা?",
      question_en: "What are community organizations?",
      answer_bn:
        "জেলাভিত্তিক স্বেচ্ছাসেবী সংস্থা যারা ডোনার তালিকা ও রিকোয়েস্ট সমন্বয় করে — BloodLink-এ তারা অর্গ প্যানেল ব্যবহার করে।",
      answer_en:
        "District volunteer groups that coordinate donors and requests — they use the org panel on BloodLink.",
      sort_order: 2,
      is_active: true,
    },
    {
      id: "seed-faq-4",
      question_bn: "এটি কি বিনামূল্যে?",
      question_en: "Is it free?",
      answer_bn: "হ্যাঁ। রক্তদাতা ও রিকোয়েস্টার উভয়ের জন্য মূল ফিচার বিনামূল্যে।",
      answer_en: "Yes. Core features are free for donors and requesters.",
      sort_order: 3,
      is_active: true,
    },
  ],
  communityCards: [
    {
      id: "seed-cc-1",
      title_bn: "জেলা সংস্থা",
      title_en: "District orgs",
      body_bn: "স্থানীয় নেটওয়ার্ক দিয়ে দ্রুত ম্যাচ।",
      body_en: "Faster matches through local networks.",
      image_url: LANDING_MEDIA.communityCards[0],
      link_url: "/auth",
      sort_order: 0,
      is_active: true,
    },
    {
      id: "seed-cc-2",
      title_bn: "স্বেচ্ছাসেবী",
      title_en: "Volunteers",
      body_bn: "সচেতনতা ও ক্যাম্প পরিচালনা।",
      body_en: "Awareness drives and camp support.",
      image_url: LANDING_MEDIA.communityCards[1],
      link_url: "#campaigns",
      sort_order: 1,
      is_active: true,
    },
    {
      id: "seed-cc-3",
      title_bn: "হাসপাতাল পার্টনার",
      title_en: "Hospital partners",
      body_bn: "যাচাইকৃত চাহিদা ও নিরাপদ সমন্বয়।",
      body_en: "Verified needs and safer coordination.",
      image_url: LANDING_MEDIA.communityCards[2],
      link_url: "#faq",
      sort_order: 2,
      is_active: true,
    },
  ],
};

function withContentDefaults(
  bundle: LandingContentBundle,
): LandingContentBundle {
  const d = DEFAULT_LANDING_CONTENT;
  const stats = (bundle.stats.length ? bundle.stats : d.stats).map((s) => {
    if (s.source !== "manual") return s;
    if (/donor|রক্তদাতা/i.test(`${s.label_en} ${s.label_bn}`)) {
      return { ...s, source: "live_donors" as const };
    }
    return s;
  });
  const cards = (bundle.cards.length ? bundle.cards : d.cards).map((c, i) => ({
    ...c,
    image_url: c.image_url || LANDING_MEDIA.how[i % LANDING_MEDIA.how.length] || null,
    link_url: c.link_url || "/auth",
  }));
  const carousel = (bundle.carousel.length ? bundle.carousel : d.carousel).map((s, i) => ({
    ...s,
    image_url: s.image_url || LANDING_MEDIA.carousel[i % LANDING_MEDIA.carousel.length],
    link_url: s.link_url || "/auth",
  }));
  const stories = (bundle.stories.length ? bundle.stories : d.stories).map((s, i) => ({
    ...s,
    image_url: s.image_url || LANDING_MEDIA.stories[i % LANDING_MEDIA.stories.length],
    link_url: s.link_url || "/auth",
  }));
  const campaigns = (bundle.campaigns.length ? bundle.campaigns : d.campaigns).map((c, i) => ({
    ...c,
    cover_url: c.cover_url || LANDING_MEDIA.campaigns[i % LANDING_MEDIA.campaigns.length] || null,
    cta_href: c.cta_href || "/auth",
  }));
  const gallery = bundle.gallery.length ? bundle.gallery : d.gallery;
  const faqs = bundle.faqs.length ? bundle.faqs : d.faqs;
  const communityCards = (bundle.communityCards.length
    ? bundle.communityCards
    : d.communityCards
  ).map((c, i) => ({
    ...c,
    image_url:
      c.image_url || LANDING_MEDIA.communityCards[i % LANDING_MEDIA.communityCards.length] || null,
    link_url: c.link_url || "/auth",
  }));

  return {
    stats,
    cards,
    carousel,
    stories,
    campaigns,
    gallery,
    faqs,
    communityCards,
    liveRequestCount: bundle.liveRequestCount,
    liveDonorCount: bundle.liveDonorCount,
  };
}

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
  const [stats, cards, slides, campaigns, gallery, faqs, communityCards, reqCount, donorCount] =
    await Promise.all([
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
      (async () => {
        try {
          const r = await supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("is_donor", true);
          return typeof r.count === "number" ? r.count : null;
        } catch {
          return null;
        }
      })(),
    ]);

  return withContentDefaults({
    stats,
    cards,
    carousel: slides.filter((s: LandingSlide) => s.kind === "main"),
    stories: slides.filter((s: LandingSlide) => s.kind === "stories"),
    campaigns,
    gallery,
    faqs,
    communityCards,
    liveRequestCount: reqCount,
    liveDonorCount: donorCount,
  });
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
