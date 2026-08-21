import {
  LANDING_MEDIA,
  optimizeLandingImageUrl,
  sanitizeLogoUrl,
} from "@/lib/landing-media";

function resolveCarouselImageUrl(url: string, maxWidth = 1200): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  const w = Math.min(2000, Math.max(200, Math.round(maxWidth)));
  const drive = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)?.[1]
    || new URL(trimmed, "https://x").searchParams.get("id");
  if (/drive\.google\.com/i.test(trimmed) && drive) {
    return `https://drive.google.com/thumbnail?id=${drive}&sz=w${w}`;
  }
  if (/dropbox\.com\//i.test(trimmed)) {
    return trimmed.replace(/\?dl=0/, "?raw=1").replace(/&dl=0/, "&raw=1");
  }
  return trimmed;
}

export type LandingTheme = "life_crimson" | "night_clinic";

export type LandingSectionId =
  | "nav"
  | "hero"
  | "stats"
  | "how_it_works"
  | "islamic_carousel"
  | "campaigns"
  | "community"
  | "care_vendor"
  | "gallery"
  | "stories_carousel"
  | "faq"
  | "cta_band"
  | "footer";

export type LandingNavLink = {
  id: string;
  label_bn: string;
  label_en: string;
  href: string;
};

export type LandingColors = {
  primary: string;
  background: string;
  foreground: string;
  muted: string;
  glass: string;
};

export type LandingHeroTransition = "fade" | "crossfade" | "slide";

export type LandingHeroSlideshow = {
  enabled: boolean;
  interval_ms: number;
  transition_ms: number;
  transition: LandingHeroTransition;
  ken_burns: boolean;
  overlay_opacity: number;
  pause_on_hover: boolean;
  show_dots: boolean;
};

export type LandingHeroYoutube = {
  enabled: boolean;
  /** Full YouTube URL or 11-char video id */
  url: string;
  title_bn: string;
  title_en: string;
  body_bn: string;
  body_en: string;
  /** Optional custom poster; empty = YouTube thumbnail */
  poster_url: string;
  /** Load iframe & autoplay on play click (stays on-site) */
  autoplay_on_click: boolean;
};

/** Lucide icon keys for MyGP-style landing feature grid. */
export type LandingFeatureIcon =
  | "droplet"
  | "heart_pulse"
  | "sparkles"
  | "ambulance"
  | "stethoscope"
  | "flask"
  | "users"
  | "message"
  | "calendar"
  | "store"
  | "user"
  | "settings";

export type LandingFeatureTile = {
  id: string;
  label_bn: string;
  label_en: string;
  href: string;
  icon: LandingFeatureIcon;
  /** If true, guests go to /auth?next=… */
  requires_auth: boolean;
  /** Shown only after “See more” expands */
  more?: boolean;
};

export type LandingFeatureGrid = {
  enabled: boolean;
  title_bn: string;
  title_en: string;
  see_more_bn: string;
  see_more_en: string;
  see_less_bn: string;
  see_less_en: string;
  tiles: LandingFeatureTile[];
};

export type LandingHero = {
  brand_bn: string;
  brand_en: string;
  headline_bn: string;
  headline_en: string;
  sub_bn: string;
  sub_en: string;
  cta_primary_bn: string;
  cta_primary_en: string;
  cta_primary_href: string;
  cta_secondary_bn: string;
  cta_secondary_en: string;
  cta_secondary_href: string;
  /** Legacy single image — kept in sync with first slide */
  background_url: string;
  /** Hero slideshow images (Drive link, upload, or /landing/*) */
  background_images: string[];
  slideshow: LandingHeroSlideshow;
  background_video_url: string;
  youtube: LandingHeroYoutube;
  /** MyGP-style utility icon grid (first viewport when enabled) */
  feature_grid: LandingFeatureGrid;
};

export const DEFAULT_FEATURE_GRID_TILES: LandingFeatureTile[] = [
  {
    id: "request_blood",
    label_bn: "রক্ত চান",
    label_en: "Request blood",
    href: "/home?compose=true",
    icon: "droplet",
    requires_auth: true,
  },
  {
    id: "live_requests",
    label_bn: "জরুরি রিকোয়েস্ট",
    label_en: "Live requests",
    href: "/home",
    icon: "heart_pulse",
    requires_auth: true,
  },
  {
    id: "ai_health",
    label_bn: "AI স্বাস্থ্য",
    label_en: "AI health",
    href: "/care/ai-tests",
    icon: "sparkles",
    requires_auth: false,
  },
  {
    id: "ambulance",
    label_bn: "অ্যাম্বুলেন্স",
    label_en: "Ambulance",
    href: "/ambulance",
    icon: "ambulance",
    requires_auth: true,
  },
  {
    id: "doctors",
    label_bn: "ডাক্তার",
    label_en: "Doctors",
    href: "/care?tab=doctors",
    icon: "stethoscope",
    requires_auth: true,
  },
  {
    id: "lab_tests",
    label_bn: "ল্যাব টেস্ট",
    label_en: "Lab tests",
    href: "/care?tab=tests",
    icon: "flask",
    requires_auth: false,
  },
  {
    id: "community",
    label_bn: "কমিউনিটি",
    label_en: "Community",
    href: "/community",
    icon: "users",
    requires_auth: true,
  },
  {
    id: "chat",
    label_bn: "চ্যাট",
    label_en: "Chat",
    href: "/chat",
    icon: "message",
    requires_auth: true,
  },
  {
    id: "bookings",
    label_bn: "বুকিং",
    label_en: "Bookings",
    href: "/care?tab=bookings",
    icon: "calendar",
    requires_auth: true,
    more: true,
  },
  {
    id: "vendor",
    label_bn: "Care ভেন্ডর",
    label_en: "Care vendor",
    href: "/care/auth?mode=register",
    icon: "store",
    requires_auth: false,
    more: true,
  },
  {
    id: "profile",
    label_bn: "প্রোফাইল",
    label_en: "Profile",
    href: "/profile",
    icon: "user",
    requires_auth: true,
    more: true,
  },
  {
    id: "settings",
    label_bn: "সেটিংস",
    label_en: "Settings",
    href: "/settings",
    icon: "settings",
    requires_auth: true,
    more: true,
  },
];

export const DEFAULT_FEATURE_GRID: LandingFeatureGrid = {
  enabled: true,
  title_bn: "সেবাসমূহ",
  title_en: "Services",
  see_more_bn: "আরো দেখুন",
  see_more_en: "See more",
  see_less_bn: "কম দেখুন",
  see_less_en: "See less",
  tiles: DEFAULT_FEATURE_GRID_TILES.map((t) => ({ ...t })),
};

export const DEFAULT_HERO_SLIDESHOW: LandingHeroSlideshow = {
  enabled: true,
  interval_ms: 5500,
  transition_ms: 900,
  transition: "crossfade",
  ken_burns: false,
  overlay_opacity: 75,
  pause_on_hover: false,
  show_dots: true,
};

export const DEFAULT_HERO_YOUTUBE: LandingHeroYoutube = {
  enabled: true,
  /** WHO World Blood Donor Day — replace anytime from Settings → Hero */
  url: "https://www.youtube.com/watch?v=hjyZX-LIacM",
  title_bn: "রক্তদানের গল্প দেখুন",
  title_en: "Watch our donation story",
  body_bn: "ক্লিক করুন — YouTube-এ না গিয়েই ভিডিও চলবে।",
  body_en: "Click to play — watch without leaving this page.",
  poster_url: "",
  autoplay_on_click: true,
};

export type LandingCommunityBlock = {
  title_bn: string;
  title_en: string;
  body_bn: string;
  body_en: string;
  background_url: string;
  pull_orgs: boolean;
  cta_bn: string;
  cta_en: string;
  cta_href: string;
};

export type LandingCareVendorBlock = {
  title_bn: string;
  title_en: string;
  body_bn: string;
  body_en: string;
  register_bn: string;
  register_en: string;
  login_bn: string;
  login_en: string;
};

/** Islamic inspiration section (text-first cards; no heavy media). */
export type LandingIslamicCard = {
  id: string;
  theme_bn: string;
  theme_en: string;
  quote_bn: string;
  quote_en: string;
  source_bn: string;
  source_en: string;
  reflection_bn: string;
  reflection_en: string;
  sort_order: number;
  is_active: boolean;
};

export type LandingIslamicBlock = {
  title_bn: string;
  title_en: string;
  body_bn: string;
  body_en: string;
  /** Editable in Admin → Landing → Islamic (saved with landing_settings). */
  cards: LandingIslamicCard[];
};

export const DEFAULT_ISLAMIC_CARDS: LandingIslamicCard[] = [
  {
    id: "seed-isl-1",
    theme_bn: "জীবন রক্ষা",
    theme_en: "Saving a life",
    quote_bn: "যে ব্যক্তি একজন মানুষের জীবন রক্ষা করল, সে যেন সমগ্র মানবজাতির জীবন রক্ষা করল।",
    quote_en: "Whoever saves a life, it is as if he had saved all of mankind.",
    source_bn: "সূরা আল-মায়িদাহ ৫:৩২",
    source_en: "Qur’an 5:32",
    reflection_bn: "জরুরি রক্তের চাহিদায় সাড়া দেওয়া — এই বাণীর বাস্তব প্রয়োগ।",
    reflection_en: "Answering an urgent blood need is this verse lived out.",
    sort_order: 0,
    is_active: true,
  },
  {
    id: "seed-isl-2",
    theme_bn: "পরস্পর সাহায্য",
    theme_en: "Helping others",
    quote_bn: "মানুষের মধ্যে সর্বোত্তম তারাই, যারা মানুষের সবচেয়ে বেশি উপকার করে।",
    quote_en: "The best of people are those who are most beneficial to people.",
    source_bn: "হাদিস — আত-তাবারানি",
    source_en: "Hadith — al-Tabarani",
    reflection_bn: "নিবন্ধিত রক্তদাতা হয়ে আপনার এলাকার কারো উপকারে আসুন।",
    reflection_en: "Become a registered donor and benefit someone near you.",
    sort_order: 10,
    is_active: true,
  },
  {
    id: "seed-isl-3",
    theme_bn: "এক দেহ",
    theme_en: "One body",
    quote_bn: "মুমিনগণ পরস্পরের প্রতি ভালোবাসা ও সহানুভূতিতে এক দেহের মতো।",
    quote_en: "The believers in their mutual kindness and compassion are like one body.",
    source_bn: "সহিহ বুখারি ও মুসলিম",
    source_en: "Sahih al-Bukhari & Muslim",
    reflection_bn: "কমিউনিটি নেটওয়ার্কে যুক্ত হয়ে একজনের ব্যথা সবার হয়ে উঠুক।",
    reflection_en: "Join the network so one person’s need becomes everyone’s concern.",
    sort_order: 20,
    is_active: true,
  },
  {
    id: "seed-isl-4",
    theme_bn: "কষ্ট লাঘব",
    theme_en: "Relieving hardship",
    quote_bn: "যে ব্যক্তি কোনো মুমিনের দুনিয়ার কষ্ট লাঘব করে, আল্লাহ তার কষ্ট লাঘব করবেন।",
    quote_en: "Whoever relieves a believer’s distress in this world, Allah will relieve his distress.",
    source_bn: "সহিহ মুসলিম",
    source_en: "Sahih Muslim",
    reflection_bn: "এক ব্যাগ রক্ত — কারো পরিবারের সবচেয়ে কঠিন রাত হালকা করতে পারে।",
    reflection_en: "One unit of blood can ease a family’s hardest night.",
    sort_order: 30,
    is_active: true,
  },
  {
    id: "seed-isl-5",
    theme_bn: "সদাচার",
    theme_en: "Continuous good",
    quote_bn: "যে ব্যক্তি কোনো ভালো কাজের পথ দেখায়, সে যেন তা নিজে করেছে — সমান সওয়াব।",
    quote_en: "Whoever guides others to good is like the one who does it.",
    source_bn: "সহিহ মুসলিম",
    source_en: "Sahih Muslim",
    reflection_bn: "BloodLink-এ শেয়ার ও আমন্ত্রণ — অন্যকেও রক্তদানে উদ্বুদ্ধ করে।",
    reflection_en: "Sharing BloodLink invites others into the same good.",
    sort_order: 40,
    is_active: true,
  },
];

export function activeIslamicCards(block: LandingIslamicBlock): LandingIslamicCard[] {
  return [...(block.cards ?? [])]
    .filter((c) => c.is_active !== false)
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
}

export type LandingCtaBand = {
  title_bn: string;
  title_en: string;
  body_bn: string;
  body_en: string;
  background_url: string;
  primary_bn: string;
  primary_en: string;
  primary_href: string;
  secondary_bn: string;
  secondary_en: string;
  secondary_href: string;
};

export type LandingFooterLink = { label_bn: string; label_en: string; href: string };
export type LandingFooterColumn = {
  title_bn: string;
  title_en: string;
  links: LandingFooterLink[];
};

export type LandingSettings = {
  enabled: boolean;
  theme: LandingTheme;
  colors: LandingColors;
  seo: {
    title_bn: string;
    title_en: string;
    description_bn: string;
    description_en: string;
    og_image_url: string;
  };
  nav: {
    logo_url: string;
    show_lang_toggle: boolean;
    cta_login_bn: string;
    cta_login_en: string;
    cta_signup_bn: string;
    cta_signup_en: string;
    links: LandingNavLink[];
  };
  hero: LandingHero;
  islamic: LandingIslamicBlock;
  community: LandingCommunityBlock;
  care_vendor: LandingCareVendorBlock;
  cta_band: LandingCtaBand;
  footer: {
    copyright_bn: string;
    copyright_en: string;
    hotline: string;
    columns: LandingFooterColumn[];
    social: LandingFooterLink[];
  };
  section_order: LandingSectionId[];
  sections_enabled: Record<LandingSectionId, boolean>;
};

export const LANDING_SECTION_IDS: LandingSectionId[] = [
  "nav",
  "hero",
  "stats",
  "how_it_works",
  "islamic_carousel",
  "campaigns",
  "community",
  "care_vendor",
  "gallery",
  "stories_carousel",
  "faq",
  "cta_band",
  "footer",
];

export const THEME_PRESETS: Record<LandingTheme, LandingColors> = {
  life_crimson: {
    primary: "#C1121F",
    background: "#F7F3F0",
    foreground: "#1A1210",
    muted: "#6B5E58",
    glass: "rgba(255,255,255,0.55)",
  },
  night_clinic: {
    primary: "#E11D2E",
    background: "#0F0C0C",
    foreground: "#F5EDE8",
    muted: "#A89890",
    glass: "rgba(20,12,12,0.55)",
  },
};

export const DEFAULT_LANDING_SETTINGS: LandingSettings = {
  enabled: true,
  theme: "life_crimson",
  colors: { ...THEME_PRESETS.life_crimson },
  seo: {
    title_bn: "BloodLink — রক্তদানে জীবন বাঁচান",
    title_en: "BloodLink — Save lives with blood donation",
    description_bn:
      "বাংলাদেশের রিয়েলটাইম রক্তদাতা নেটওয়ার্ক। জরুরি রিকোয়েস্ট দেখুন, কাছের ডোনার খুঁজুন — ইসলামে জীবন রক্ষার আলোকে সাহায্য করুন।",
    description_en:
      "Bangladesh’s realtime blood donor network. See urgent requests, find nearby donors — give inspired by saving lives.",
    og_image_url: LANDING_MEDIA.og,
  },
  nav: {
    logo_url: LANDING_MEDIA.logo,
    show_lang_toggle: true,
    cta_login_bn: "লগইন",
    cta_login_en: "Log in",
    cta_signup_bn: "সাইন আপ",
    cta_signup_en: "Sign up",
    links: [
      { id: "how", label_bn: "কীভাবে কাজ করে", label_en: "How it works", href: "#how" },
      { id: "campaigns", label_bn: "ক্যাম্পেইন", label_en: "Campaigns", href: "#campaigns" },
      { id: "community", label_bn: "কমিউনিটি", label_en: "Community", href: "#community" },
      { id: "care-vendor", label_bn: "Care ভেন্ডর", label_en: "Care vendor", href: "#care-vendor" },
      { id: "gallery", label_bn: "গ্যালারি", label_en: "Gallery", href: "#gallery" },
      { id: "faq", label_bn: "প্রশ্নোত্তর", label_en: "FAQ", href: "#faq" },
    ],
  },
  hero: {
    brand_bn: "BloodLink",
    brand_en: "BloodLink",
    headline_bn: "রক্তদান করুন, জীবন বাঁচান",
    headline_en: "Donate blood. Save lives.",
    sub_bn:
      "আপনার এলাকার জরুরি রক্তের চাহিদা দেখুন, যাচাইকৃত ডোনারদের সাথে যোগাযোগ করুন — এক অ্যাপেই সব।",
    sub_en:
      "See urgent blood needs near you, reach verified donors, and help — all in one app.",
    cta_primary_bn: "বিনামূল্যে শুরু করুন",
    cta_primary_en: "Get started free",
    cta_primary_href: "/auth",
    cta_secondary_bn: "কীভাবে কাজ করে",
    cta_secondary_en: "How it works",
    cta_secondary_href: "#how",
    background_url: LANDING_MEDIA.hero,
    background_images: [...LANDING_MEDIA.heroSlides],
    slideshow: { ...DEFAULT_HERO_SLIDESHOW },
    background_video_url: "",
    youtube: { ...DEFAULT_HERO_YOUTUBE },
    feature_grid: { ...DEFAULT_FEATURE_GRID, tiles: DEFAULT_FEATURE_GRID_TILES.map((t) => ({ ...t })) },
  },
  islamic: {
    title_bn: "ইসলামে জীবন রক্ষা ও সাহায্য",
    title_en: "Saving lives in Islam",
    body_bn:
      "রক্তদান একটি মানবিক ইবাদতের মতো — একজনের জীবন বাঁচানো মানেই মানবতার সেবা।",
    body_en: "Blood donation is an act of mercy — saving one life serves humanity.",
    cards: DEFAULT_ISLAMIC_CARDS.map((c) => ({ ...c })),
  },
  community: {
    title_bn: "একসাথে গড়া রক্তদানের কমিউনিটি",
    title_en: "A community built to give",
    body_bn:
      "জেলাভিত্তিক সংস্থা, হাসপাতাল পার্টনার ও স্বেচ্ছাসেবী রক্তদাতারা এক প্ল্যাটফর্মে — যখন দরকার, তখন সাড়া।",
    body_en:
      "District orgs, hospital partners, and volunteer donors on one platform — ready when it matters.",
    background_url: LANDING_MEDIA.communityBg,
    pull_orgs: true,
    cta_bn: "অ্যাকাউন্ট খুলুন",
    cta_en: "Create account",
    cta_href: "/auth",
  },
  care_vendor: {
    title_bn: "BloodLink Care — চেম্বার, ক্লিনিক ও ল্যাব",
    title_en: "BloodLink Care — chambers, clinics & labs",
    body_bn:
      "ডাক্তার সিরিয়াল, কিউ, ওয়াক-ইন ও ল্যাব বুকিং পরিচালনার জন্য আলাদা পেশাদার পোর্টাল। চেম্বার বা ডায়াগনস্টিক ল্যাব হিসেবে নিবন্ধন করুন।",
    body_en:
      "A dedicated professional portal for doctor serials, queues, walk-ins, and lab bookings. Register as a chamber or diagnostic lab.",
    register_bn: "ভেন্ডর নিবন্ধন",
    register_en: "Vendor registration",
    login_bn: "ভেন্ডর লগইন",
    login_en: "Vendor login",
  },
  cta_band: {
    title_bn: "আজই একজনের জীবন বদলান",
    title_en: "Change a life today",
    body_bn: "নিবন্ধন করুন, প্রোফাইল সম্পন্ন করুন, এবং আপনার এলাকার জরুরি রিকোয়েস্ট দেখুন।",
    body_en: "Sign up, complete your profile, and see urgent requests in your area.",
    background_url: LANDING_MEDIA.ctaBg,
    primary_bn: "সাইন আপ করুন",
    primary_en: "Sign up now",
    primary_href: "/auth",
    secondary_bn: "কীভাবে কাজ করে",
    secondary_en: "How it works",
    secondary_href: "#how",
  },
  footer: {
    copyright_bn: "© BloodLink. রক্তদান — সবার অধিকার, সবার দায়িত্ব।",
    copyright_en: "© BloodLink. Blood donation — a right and a responsibility.",
    hotline: "16263",
    columns: [
      {
        title_bn: "প্ল্যাটফর্ম",
        title_en: "Platform",
        links: [
          { label_bn: "লগইন", label_en: "Log in", href: "/auth" },
          { label_bn: "সাইন আপ", label_en: "Sign up", href: "/auth" },
          { label_bn: "Care ভেন্ডর নিবন্ধন", label_en: "Care vendor register", href: "/care/auth?mode=register" },
          { label_bn: "Care ভেন্ডর লগইন", label_en: "Care vendor login", href: "/care/auth" },
          { label_bn: "কীভাবে কাজ করে", label_en: "How it works", href: "#how" },
        ],
      },
      {
        title_bn: "সম্পদ",
        title_en: "Resources",
        links: [
          { label_bn: "ক্যাম্পেইন", label_en: "Campaigns", href: "#campaigns" },
          { label_bn: "গ্যালারি", label_en: "Gallery", href: "#gallery" },
          { label_bn: "প্রশ্নোত্তর", label_en: "FAQ", href: "#faq" },
        ],
      },
      {
        title_bn: "যোগাযোগ",
        title_en: "Contact",
        links: [
          { label_bn: "জরুরি হটলাইন", label_en: "Emergency hotline", href: "tel:16263" },
          { label_bn: "কমিউনিটি", label_en: "Community", href: "#community" },
          { label_bn: "উপরে যান", label_en: "Back to top", href: "#top" },
        ],
      },
    ],
    social: [
      {
        label_bn: "ফেসবুক",
        label_en: "Facebook",
        href: "https://www.facebook.com/",
      },
      {
        label_bn: "ইউটিউব",
        label_en: "YouTube",
        href: "https://www.youtube.com/",
      },
      {
        label_bn: "হোয়াটসঅ্যাপ",
        label_en: "WhatsApp",
        href: "https://wa.me/",
      },
    ],
  },
  section_order: [...LANDING_SECTION_IDS],
  sections_enabled: Object.fromEntries(LANDING_SECTION_IDS.map((id) => [id, true])) as Record<
    LandingSectionId,
    boolean
  >,
};

let cache: LandingSettings | null = null;
let cachedAt = 0;
const TTL = 60_000;

export function invalidateLandingSettingsCache() {
  cache = null;
  cachedAt = 0;
}

function normalizeIslamicCards(raw: unknown, fallback: LandingIslamicCard[]): LandingIslamicCard[] {
  if (!Array.isArray(raw)) {
    return fallback.map((c) => ({ ...c }));
  }
  if (raw.length === 0) return [];
  return raw
    .map((item, i) => {
      const x = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      const id = str(x.id, `isl-${i}`);
      return {
        id,
        theme_bn: str(x.theme_bn, ""),
        theme_en: str(x.theme_en, ""),
        quote_bn: str(x.quote_bn, ""),
        quote_en: str(x.quote_en, ""),
        source_bn: str(x.source_bn, ""),
        source_en: str(x.source_en, ""),
        reflection_bn: str(x.reflection_bn, ""),
        reflection_en: str(x.reflection_en, ""),
        sort_order: num(x.sort_order, i * 10, 0, 9999),
        is_active: x.is_active !== false,
      } satisfies LandingIslamicCard;
    })
    .filter((c) => c.quote_bn || c.quote_en || c.theme_bn || c.theme_en);
}

function str(v: unknown, fallback: string) {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

/** Prefer stored URL; fall back to curated default when empty. Always downsize remote CDN images. */
const BROKEN_REMOTE =
  /photo-1576091160550-2173dba07efd|photo-1551190822-a9333d79a5c3|photo-1530026186672-2cd00ffc50ce/i;

function mediaUrl(v: unknown, fallback: string, size?: { w?: number; q?: number; h?: number }) {
  const raw = typeof v === "string" ? v.trim() : "";
  // Known-dead Unsplash IDs → use local curated asset
  if (raw && BROKEN_REMOTE.test(raw)) {
    return fallback.startsWith("/") ? fallback : optimizeLandingImageUrl(fallback, size);
  }
  const resolved = resolveCarouselImageUrl(raw || fallback);
  return optimizeLandingImageUrl(resolved, size ?? { w: 1200, q: 65 });
}

function num(v: unknown, fallback: number, min: number, max: number) {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function normalizeHeroImages(heroRaw: Record<string, unknown>, d: LandingSettings): string[] {
  // Mobile LCP budget: prefer ~960w; slideshow still looks sharp on phones
  const size = { w: 960, q: 58 };
  const defaults = [...d.hero.background_images];
  /** Remote CDN heroes → local (saves Slow-4G RTT; BD-friendly). */
  const localForRemote = (url: string, i: number) => {
    if (/images\.unsplash\.com|images\.pexels\.com|cdn\.pixabay\.com/i.test(url)) {
      return defaults[i % defaults.length] ?? LANDING_MEDIA.heroSlides[i % 3];
    }
    return url;
  };
  const fromArray = Array.isArray(heroRaw.background_images)
    ? heroRaw.background_images
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
        .map((url, i) =>
          mediaUrl(
            localForRemote(url, i),
            defaults[i] ?? LANDING_MEDIA.heroSlides[i % LANDING_MEDIA.heroSlides.length],
            size,
          ),
        )
    : [];
  // 2+ admin images → use as-is
  if (fromArray.length >= 2) return fromArray;
  // 1 admin image → pad with local defaults so slideshow always works
  if (fromArray.length === 1) {
    const extras = defaults.filter((u) => u !== fromArray[0]);
    return [fromArray[0], ...extras].slice(0, Math.max(3, extras.length + 1));
  }
  // No background_images in DB (legacy) → prefer full default trio over single legacy URL
  if (!Array.isArray(heroRaw.background_images)) {
    return defaults;
  }
  const legacy = mediaUrl(heroRaw.background_url, d.hero.background_url, size);
  if (legacy) {
    const extras = defaults.filter((u) => u !== legacy);
    return [legacy, ...extras].slice(0, 3);
  }
  return defaults;
}

function normalizeHeroYoutube(raw: unknown, d: LandingHeroYoutube): LandingHeroYoutube {
  const y = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  // Empty / missing URL → curated default so the hero player is visible out of the box
  const urlRaw = typeof y.url === "string" ? y.url.trim() : "";
  return {
    enabled: y.enabled !== false,
    url: urlRaw || d.url,
    title_bn: str(y.title_bn, d.title_bn),
    title_en: str(y.title_en, d.title_en),
    body_bn: typeof y.body_bn === "string" ? y.body_bn : d.body_bn,
    body_en: typeof y.body_en === "string" ? y.body_en : d.body_en,
    poster_url: (() => {
      const p = typeof y.poster_url === "string" ? y.poster_url.trim() : d.poster_url;
      // maxresdefault often 404s and is huge — prefer hq for LCP budget
      return p.replace(/\/maxresdefault\.jpg/i, "/hqdefault.jpg");
    })(),
    autoplay_on_click: y.autoplay_on_click !== false,
  };
}

function normalizeHeroSlideshow(raw: unknown, d: LandingHeroSlideshow): LandingHeroSlideshow {
  const s = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const transition =
    s.transition === "fade" || s.transition === "crossfade" || s.transition === "slide"
      ? s.transition
      : d.transition;
  return {
    enabled: s.enabled !== false,
    interval_ms: num(s.interval_ms, d.interval_ms, 2500, 30000),
    transition_ms: num(s.transition_ms, d.transition_ms, 400, 4000),
    transition,
    ken_burns: s.ken_burns === true,
    overlay_opacity: num(s.overlay_opacity, d.overlay_opacity, 0, 100),
    pause_on_hover: s.pause_on_hover !== false,
    show_dots: s.show_dots === true,
  };
}

const FEATURE_ICONS = new Set<LandingFeatureIcon>([
  "droplet",
  "heart_pulse",
  "sparkles",
  "ambulance",
  "stethoscope",
  "flask",
  "users",
  "message",
  "calendar",
  "store",
  "user",
  "settings",
]);

function normalizeFeatureGrid(raw: unknown, d: LandingFeatureGrid): LandingFeatureGrid {
  const g = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const tilesRaw = Array.isArray(g.tiles) ? g.tiles : null;
  let tiles: LandingFeatureTile[];
  if (tilesRaw && tilesRaw.length >= 4) {
    tiles = tilesRaw
      .map((item, i) => {
        const t = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
        const fb = d.tiles[i] ?? d.tiles[0];
        const icon = FEATURE_ICONS.has(t.icon as LandingFeatureIcon)
          ? (t.icon as LandingFeatureIcon)
          : fb.icon;
        const id = str(t.id, fb.id || `tile_${i}`);
        return {
          id,
          label_bn: str(t.label_bn, fb.label_bn),
          label_en: str(t.label_en, fb.label_en),
          href: str(t.href, fb.href),
          icon,
          requires_auth:
            id === "ambulance" ||
            id === "doctors" ||
            id === "bookings" ||
            t.requires_auth === true ||
            (t.requires_auth !== false && fb.requires_auth),
          more: t.more === true || fb.more === true,
        };
      })
      .filter((t) => t.label_bn || t.label_en);
  } else {
    tiles = d.tiles.map((t) => ({ ...t }));
  }
  return {
    enabled: g.enabled !== false,
    title_bn: str(g.title_bn, d.title_bn),
    title_en: str(g.title_en, d.title_en),
    see_more_bn: str(g.see_more_bn, d.see_more_bn),
    see_more_en: str(g.see_more_en, d.see_more_en),
    see_less_bn: str(g.see_less_bn, d.see_less_bn),
    see_less_en: str(g.see_less_en, d.see_less_en),
    tiles,
  };
}

export function normalizeLandingSettings(raw: unknown): LandingSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_LANDING_SETTINGS;
  const theme: LandingTheme = r.theme === "night_clinic" ? "night_clinic" : "life_crimson";
  const colorsRaw = (r.colors && typeof r.colors === "object" ? r.colors : {}) as Partial<LandingColors>;
  const preset = THEME_PRESETS[theme];
  const colors: LandingColors = {
    primary: str(colorsRaw.primary, preset.primary),
    background: str(colorsRaw.background, preset.background),
    foreground: str(colorsRaw.foreground, preset.foreground),
    muted: str(colorsRaw.muted, preset.muted),
    glass: str(colorsRaw.glass, preset.glass),
  };

  const seoRaw = (r.seo && typeof r.seo === "object" ? r.seo : {}) as Record<string, unknown>;
  const navRaw = (r.nav && typeof r.nav === "object" ? r.nav : {}) as Record<string, unknown>;
  const heroRaw = (r.hero && typeof r.hero === "object" ? r.hero : {}) as Record<string, unknown>;
  const communityRaw = (r.community && typeof r.community === "object" ? r.community : {}) as Record<
    string,
    unknown
  >;
  const careVendorRaw = (r.care_vendor && typeof r.care_vendor === "object" ? r.care_vendor : {}) as Record<
    string,
    unknown
  >;
  const islamicRaw = (r.islamic && typeof r.islamic === "object" ? r.islamic : {}) as Record<string, unknown>;
  const ctaRaw = (r.cta_band && typeof r.cta_band === "object" ? r.cta_band : {}) as Record<string, unknown>;
  const footerRaw = (r.footer && typeof r.footer === "object" ? r.footer : {}) as Record<string, unknown>;

  const enabledRaw =
    r.sections_enabled && typeof r.sections_enabled === "object"
      ? (r.sections_enabled as Record<string, unknown>)
      : {};
  const sections_enabled = Object.fromEntries(
    LANDING_SECTION_IDS.map((id) => [id, enabledRaw[id] !== false]),
  ) as Record<LandingSectionId, boolean>;

  const section_order = Array.isArray(r.section_order)
    ? (r.section_order.filter((x) => LANDING_SECTION_IDS.includes(x as LandingSectionId)) as LandingSectionId[])
    : [...d.section_order];
  for (const id of LANDING_SECTION_IDS) {
    if (section_order.includes(id)) continue;
    if (id === "islamic_carousel") {
      const howIdx = section_order.indexOf("how_it_works");
      if (howIdx >= 0) section_order.splice(howIdx + 1, 0, id);
      else section_order.push(id);
    } else if (id === "care_vendor") {
      const commIdx = section_order.indexOf("community");
      if (commIdx >= 0) section_order.splice(commIdx + 1, 0, id);
      else section_order.push(id);
    } else {
      section_order.push(id);
    }
  }

  const footerCols =
    Array.isArray(footerRaw.columns) && footerRaw.columns.length > 0
      ? footerRaw.columns.map((c) => {
          const col = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
          const colLinks = Array.isArray(col.links)
            ? col.links.map((l) => {
                const x = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
                return {
                  label_bn: str(x.label_bn, ""),
                  label_en: str(x.label_en, ""),
                  href: str(x.href, "#"),
                };
              })
            : [];
          return {
            title_bn: str(col.title_bn, ""),
            title_en: str(col.title_en, ""),
            links: colLinks,
          };
        })
      : d.footer.columns;

  const social =
    Array.isArray(footerRaw.social) && footerRaw.social.length > 0
      ? footerRaw.social.map((l) => {
          const x = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
          return {
            label_bn: str(x.label_bn, ""),
            label_en: str(x.label_en, ""),
            href: str(x.href, "#"),
          };
        })
      : d.footer.social;

  const navLinks =
    Array.isArray(navRaw.links) && navRaw.links.length > 0
      ? navRaw.links
          .map((l, i) => {
            const x = (l && typeof l === "object" ? l : {}) as Record<string, unknown>;
            return {
              id: str(x.id, `link-${i}`),
              label_bn: str(x.label_bn, ""),
              label_en: str(x.label_en, ""),
              href: str(x.href, "#"),
            };
          })
          .filter((l) => l.label_bn || l.label_en)
      : d.nav.links;

  return {
    enabled: r.enabled !== false,
    theme,
    colors,
    seo: {
      title_bn: str(seoRaw.title_bn, d.seo.title_bn),
      title_en: str(seoRaw.title_en, d.seo.title_en),
      description_bn: str(seoRaw.description_bn, d.seo.description_bn),
      description_en: str(seoRaw.description_en, d.seo.description_en),
      og_image_url: mediaUrl(seoRaw.og_image_url, d.seo.og_image_url, { w: 1200, h: 630, q: 70 }),
    },
    nav: {
      logo_url: sanitizeLogoUrl(mediaUrl(navRaw.logo_url, d.nav.logo_url, { w: 128, q: 80 })),
      show_lang_toggle: navRaw.show_lang_toggle !== false,
      cta_login_bn: str(navRaw.cta_login_bn, d.nav.cta_login_bn),
      cta_login_en: str(navRaw.cta_login_en, d.nav.cta_login_en),
      cta_signup_bn: str(navRaw.cta_signup_bn, d.nav.cta_signup_bn),
      cta_signup_en: str(navRaw.cta_signup_en, d.nav.cta_signup_en),
      links: navLinks,
    },
    hero: (() => {
      const background_images = normalizeHeroImages(heroRaw, d);
      const slideshow = normalizeHeroSlideshow(heroRaw.slideshow, d.hero.slideshow);
      return {
        brand_bn: str(heroRaw.brand_bn, d.hero.brand_bn),
        brand_en: str(heroRaw.brand_en, d.hero.brand_en),
        headline_bn: str(heroRaw.headline_bn, d.hero.headline_bn),
        headline_en: str(heroRaw.headline_en, d.hero.headline_en),
        sub_bn: str(heroRaw.sub_bn, d.hero.sub_bn),
        sub_en: str(heroRaw.sub_en, d.hero.sub_en),
        cta_primary_bn: str(heroRaw.cta_primary_bn, d.hero.cta_primary_bn),
        cta_primary_en: str(heroRaw.cta_primary_en, d.hero.cta_primary_en),
        cta_primary_href: str(heroRaw.cta_primary_href, d.hero.cta_primary_href),
        cta_secondary_bn: str(heroRaw.cta_secondary_bn, d.hero.cta_secondary_bn),
        cta_secondary_en: str(heroRaw.cta_secondary_en, d.hero.cta_secondary_en),
        cta_secondary_href: str(heroRaw.cta_secondary_href, d.hero.cta_secondary_href),
        background_url:
          background_images[0] ??
          mediaUrl(heroRaw.background_url, d.hero.background_url, { w: 960, q: 58 }),
        background_images,
        slideshow,
        background_video_url: str(heroRaw.background_video_url, ""),
        youtube: normalizeHeroYoutube(heroRaw.youtube, d.hero.youtube),
        feature_grid: normalizeFeatureGrid(heroRaw.feature_grid, d.hero.feature_grid),
      };
    })(),
    islamic: {
      title_bn: str(islamicRaw.title_bn, d.islamic.title_bn),
      title_en: str(islamicRaw.title_en, d.islamic.title_en),
      body_bn: str(islamicRaw.body_bn, d.islamic.body_bn),
      body_en: str(islamicRaw.body_en, d.islamic.body_en),
      cards: normalizeIslamicCards(islamicRaw.cards, d.islamic.cards),
    },
    community: {
      title_bn: str(communityRaw.title_bn, d.community.title_bn),
      title_en: str(communityRaw.title_en, d.community.title_en),
      body_bn: str(communityRaw.body_bn, d.community.body_bn),
      body_en: str(communityRaw.body_en, d.community.body_en),
      background_url: mediaUrl(communityRaw.background_url, d.community.background_url, {
        w: 1100,
        q: 58,
      }),
      pull_orgs: communityRaw.pull_orgs !== false,
      cta_bn: str(communityRaw.cta_bn, d.community.cta_bn),
      cta_en: str(communityRaw.cta_en, d.community.cta_en),
      cta_href: str(communityRaw.cta_href, d.community.cta_href),
    },
    care_vendor: {
      title_bn: str(careVendorRaw.title_bn, d.care_vendor.title_bn),
      title_en: str(careVendorRaw.title_en, d.care_vendor.title_en),
      body_bn: str(careVendorRaw.body_bn, d.care_vendor.body_bn),
      body_en: str(careVendorRaw.body_en, d.care_vendor.body_en),
      register_bn: str(careVendorRaw.register_bn, d.care_vendor.register_bn),
      register_en: str(careVendorRaw.register_en, d.care_vendor.register_en),
      login_bn: str(careVendorRaw.login_bn, d.care_vendor.login_bn),
      login_en: str(careVendorRaw.login_en, d.care_vendor.login_en),
    },
    cta_band: {
      title_bn: str(ctaRaw.title_bn, d.cta_band.title_bn),
      title_en: str(ctaRaw.title_en, d.cta_band.title_en),
      body_bn: str(ctaRaw.body_bn, d.cta_band.body_bn),
      body_en: str(ctaRaw.body_en, d.cta_band.body_en),
      background_url: mediaUrl(ctaRaw.background_url, d.cta_band.background_url, { w: 1100, q: 58 }),
      primary_bn: str(ctaRaw.primary_bn, d.cta_band.primary_bn),
      primary_en: str(ctaRaw.primary_en, d.cta_band.primary_en),
      primary_href: str(ctaRaw.primary_href, d.cta_band.primary_href),
      secondary_bn: str(ctaRaw.secondary_bn, d.cta_band.secondary_bn),
      secondary_en: str(ctaRaw.secondary_en, d.cta_band.secondary_en),
      secondary_href: str(ctaRaw.secondary_href, d.cta_band.secondary_href),
    },
    footer: {
      copyright_bn: str(footerRaw.copyright_bn, d.footer.copyright_bn),
      copyright_en: str(footerRaw.copyright_en, d.footer.copyright_en),
      hotline: str(footerRaw.hotline, d.footer.hotline),
      columns: footerCols,
      social,
    },
    section_order,
    sections_enabled,
  };
}

async function db() {
  const { supabase } = await import("@/integrations/supabase/client");
  return supabase;
}

export async function fetchLandingSettings(force = false): Promise<LandingSettings> {
  if (!force && cache && Date.now() - cachedAt < TTL) return cache;
  const supabase = await db();
  const { data, error } = await supabase
    .from("app_settings")
    .select("landing_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    // Column may not exist yet — fall back to defaults
    cache = cache ?? DEFAULT_LANDING_SETTINGS;
    cachedAt = Date.now();
    return cache;
  }
  const row = data as { landing_settings?: unknown } | null;
  cache = normalizeLandingSettings(row?.landing_settings);
  cachedAt = Date.now();
  return cache;
}

export function peekLandingSettingsCache(): LandingSettings {
  return cache ?? DEFAULT_LANDING_SETTINGS;
}

/** Cached / raced fetch so SSR HTML stays fast but still gets CMS when warm. */
export async function fetchLandingSettingsForLoader(maxWaitMs = 120): Promise<LandingSettings> {
  if (cache && Date.now() - cachedAt < TTL) return cache;
  const pending = fetchLandingSettings(true).catch(() => peekLandingSettingsCache());
  if (maxWaitMs <= 0) {
    void pending;
    return peekLandingSettingsCache();
  }
  return await new Promise<LandingSettings>((resolve) => {
    let settled = false;
    const done = (s: LandingSettings) => {
      if (settled) return;
      settled = true;
      resolve(s);
    };
    const timer = setTimeout(() => done(peekLandingSettingsCache()), maxWaitMs);
    void pending.then((s) => {
      clearTimeout(timer);
      done(s);
    });
  });
}

export async function saveLandingSettings(settings: LandingSettings): Promise<void> {
  const normalized = normalizeLandingSettings(settings);
  const supabase = await db();
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    landing_settings: normalized,
  } as never);
  if (error) throw error;
  cache = normalized;
  cachedAt = Date.now();
}

export function landingCssVars(settings: LandingSettings): Record<string, string> {
  const c = settings.colors;
  return {
    "--landing-primary": c.primary,
    "--landing-bg": c.background,
    "--landing-fg": c.foreground,
    "--landing-muted": c.muted,
    "--landing-glass": c.glass,
  };
}
