import { supabase } from "@/integrations/supabase/client";
import { resolveCarouselImageUrl } from "@/lib/feed-carousel";
import { LANDING_MEDIA, optimizeLandingImageUrl } from "@/lib/landing-media";

export type LandingTheme = "life_crimson" | "night_clinic";

export type LandingSectionId =
  | "nav"
  | "hero"
  | "stats"
  | "how_it_works"
  | "campaigns"
  | "community"
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
};

export const DEFAULT_HERO_SLIDESHOW: LandingHeroSlideshow = {
  enabled: true,
  interval_ms: 6000,
  transition_ms: 1400,
  transition: "crossfade",
  ken_burns: false,
  overlay_opacity: 80,
  pause_on_hover: true,
  show_dots: false,
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
  community: LandingCommunityBlock;
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
  "campaigns",
  "community",
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
      "বাংলাদেশের রিয়েলটাইম রক্তদাতা নেটওয়ার্ক। জরুরি রিকোয়েস্ট দেখুন, কাছের ডোনার খুঁজুন, এক ক্লিকে সাহায্য করুন।",
    description_en:
      "Bangladesh’s realtime blood donor network. See urgent requests, find nearby donors, and help in one tap.",
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
  const size = { w: 1400, q: 68 };
  const fromArray = Array.isArray(heroRaw.background_images)
    ? heroRaw.background_images
        .map((x) => (typeof x === "string" ? x.trim() : ""))
        .filter(Boolean)
        .map((url, i) =>
          mediaUrl(url, d.hero.background_images[i] ?? LANDING_MEDIA.heroSlides[i % LANDING_MEDIA.heroSlides.length], size),
        )
    : [];
  if (fromArray.length) return fromArray;
  const legacy = mediaUrl(heroRaw.background_url, d.hero.background_url, size);
  return legacy ? [legacy] : [...d.hero.background_images];
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
  const ctaRaw = (r.cta_band && typeof r.cta_band === "object" ? r.cta_band : {}) as Record<string, unknown>;
  const footerRaw = (r.footer && typeof r.footer === "object" ? r.footer : {}) as Record<string, unknown>;

  const enabledRaw =
    r.sections_enabled && typeof r.sections_enabled === "object"
      ? (r.sections_enabled as Record<string, unknown>)
      : {};
  const sections_enabled = Object.fromEntries(
    LANDING_SECTION_IDS.map((id) => [id, enabledRaw[id] !== false]),
  ) as Record<LandingSectionId, boolean>;

  let section_order = Array.isArray(r.section_order)
    ? (r.section_order.filter((x) => LANDING_SECTION_IDS.includes(x as LandingSectionId)) as LandingSectionId[])
    : [...d.section_order];
  for (const id of LANDING_SECTION_IDS) {
    if (!section_order.includes(id)) section_order.push(id);
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
      logo_url: mediaUrl(navRaw.logo_url, d.nav.logo_url, { w: 128, q: 80 }),
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
        background_url: background_images[0] ?? mediaUrl(heroRaw.background_url, d.hero.background_url, { w: 1400, q: 68 }),
        background_images,
        slideshow,
        background_video_url: str(heroRaw.background_video_url, ""),
      };
    })(),
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

export async function fetchLandingSettings(force = false): Promise<LandingSettings> {
  if (!force && cache && Date.now() - cachedAt < TTL) return cache;
  const { data, error } = await supabase
    .from("app_settings")
    .select("landing_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    // Column may not exist yet — fall back to defaults
    cache = DEFAULT_LANDING_SETTINGS;
    cachedAt = Date.now();
    return cache;
  }
  const row = data as { landing_settings?: unknown } | null;
  cache = normalizeLandingSettings(row?.landing_settings);
  cachedAt = Date.now();
  return cache;
}

export async function saveLandingSettings(settings: LandingSettings): Promise<void> {
  const normalized = normalizeLandingSettings(settings);
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
