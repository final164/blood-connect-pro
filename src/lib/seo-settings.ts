import { supabase } from "@/integrations/supabase/client";

export type SeoSettings = {
  site_url: string;
  title_bn: string;
  title_en: string;
  title_template: string;
  description_bn: string;
  description_en: string;
  keywords_bn: string;
  keywords_en: string;
  og_title_bn: string;
  og_title_en: string;
  og_description_bn: string;
  og_description_en: string;
  og_image_url: string;
  og_type: string;
  twitter_card: "summary" | "summary_large_image";
  twitter_title: string;
  twitter_description: string;
  twitter_image_url: string;
  robots_index: boolean;
  robots_follow: boolean;
  canonical_url: string;
  hreflang_bn: string;
  hreflang_en: string;
  google_site_verification: string;
  bing_site_verification: string;
  json_ld_enabled: boolean;
  org_name: string;
  org_logo_url: string;
  org_phone: string;
  org_same_as: string[];
  robots_txt: string;
  sitemap_enabled: boolean;
  sitemap_extra_paths: string[];
};

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  site_url: "https://blood.pgdiary.cloud",
  title_bn: "BloodLink — রক্তদাতা খুঁজুন, রক্তদান করুন, জীবন বাঁচান",
  title_en: "BloodLink — Find blood donors and save lives in Bangladesh",
  title_template: "%s — BloodLink",
  description_bn:
    "BloodLink বাংলাদেশজুড়ে রিয়েলটাইম ব্লাড ডোনার নেটওয়ার্ক। রক্তদাতা খুঁজুন, জরুরি রক্তের রিকোয়েস্ট দিন — ইসলামে জীবন রক্ষার অনুপ্রেরণায় একসাথে সাহায্য করুন।",
  description_en:
    "BloodLink is a Bangladesh-wide realtime blood donor network. Find donors, post urgent requests, and give inspired by the call to save lives.",
  keywords_bn:
    "রক্তদান, রক্তদাতা, ব্লাড ডোনার, জরুরি রক্ত, বাংলাদেশ, BloodLink, রক্তের গ্রুপ, হাসপাতাল, জেলা ভিত্তিক রক্তদাতা, রক্ত খুঁজুন, ইসলামে জীবন রক্ষা, সদকা",
  keywords_en:
    "blood donation, blood donor, Bangladesh, urgent blood, BloodLink, blood group, hospital, district donor, find blood donor, save a life Islam, charity",
  og_title_bn: "BloodLink — রক্তদাতা খুঁজুন, রক্তদান করুন",
  og_title_en: "BloodLink — Find blood donors in Bangladesh",
  og_description_bn:
    "রিয়েলটাইম ব্লাড ডোনার নেটওয়ার্ক — রক্তদাতা খুঁজুন, রিকোয়েস্ট পাঠান, এন্ড-টু-এন্ড এনক্রিপ্টেড চ্যাট।",
  og_description_en:
    "Realtime blood donor social network with E2EE chat and live map across Bangladesh.",
  og_image_url: "https://blood.pgdiary.cloud/landing/hero.jpg",
  og_type: "website",
  twitter_card: "summary_large_image",
  twitter_title: "BloodLink — Find blood donors and save lives in Bangladesh",
  twitter_description:
    "Find blood donors, post urgent requests, and get district and hospital based blood support across Bangladesh.",
  twitter_image_url: "https://blood.pgdiary.cloud/landing/hero.jpg",
  robots_index: true,
  robots_follow: true,
  canonical_url: "/",
  hreflang_bn: "/",
  hreflang_en: "/?lang=en",
  google_site_verification: "",
  bing_site_verification: "",
  json_ld_enabled: true,
  org_name: "BloodLink",
  org_logo_url: "https://blood.pgdiary.cloud/icon-192.png",
  org_phone: "",
  org_same_as: [],
  robots_txt: "",
  sitemap_enabled: true,
  sitemap_extra_paths: [],
};

let cache: SeoSettings | null = null;
let cachedAt = 0;
const TTL = 60_000;

function str(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function bool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
}

export function normalizeSeoSettings(raw: unknown): SeoSettings {
  const d = DEFAULT_SEO_SETTINGS;
  const x = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const twitterCard = str(x.twitter_card, d.twitter_card);
  /** Avoid huge PWA icon as OG/social — browsers may preload og:image and stall LCP. */
  const softImage = (v: unknown, fallback: string) => {
    const s = str(v, fallback);
    return /icon-512\.png/i.test(s) ? fallback : s;
  };
  return {
    site_url: str(x.site_url, d.site_url),
    title_bn: str(x.title_bn, d.title_bn),
    title_en: str(x.title_en, d.title_en),
    title_template: str(x.title_template, d.title_template),
    description_bn: str(x.description_bn, d.description_bn),
    description_en: str(x.description_en, d.description_en),
    keywords_bn: str(x.keywords_bn, d.keywords_bn),
    keywords_en: str(x.keywords_en, d.keywords_en),
    og_title_bn: str(x.og_title_bn, d.og_title_bn),
    og_title_en: str(x.og_title_en, d.og_title_en),
    og_description_bn: str(x.og_description_bn, d.og_description_bn),
    og_description_en: str(x.og_description_en, d.og_description_en),
    og_image_url: softImage(x.og_image_url, d.og_image_url),
    og_type: str(x.og_type, d.og_type),
    twitter_card: twitterCard === "summary" ? "summary" : "summary_large_image",
    twitter_title: str(x.twitter_title, d.twitter_title),
    twitter_description: str(x.twitter_description, d.twitter_description),
    twitter_image_url: softImage(x.twitter_image_url, d.twitter_image_url),
    robots_index: bool(x.robots_index, d.robots_index),
    robots_follow: bool(x.robots_follow, d.robots_follow),
    canonical_url: str(x.canonical_url, d.canonical_url),
    hreflang_bn: str(x.hreflang_bn, d.hreflang_bn),
    hreflang_en: str(x.hreflang_en, d.hreflang_en),
    google_site_verification: str(x.google_site_verification, d.google_site_verification),
    bing_site_verification: str(x.bing_site_verification, d.bing_site_verification),
    json_ld_enabled: bool(x.json_ld_enabled, d.json_ld_enabled),
    org_name: str(x.org_name, d.org_name),
    org_logo_url: softImage(x.org_logo_url, d.org_logo_url),
    org_phone: str(x.org_phone, d.org_phone),
    org_same_as: strArray(x.org_same_as),
    robots_txt: str(x.robots_txt, d.robots_txt),
    sitemap_enabled: bool(x.sitemap_enabled, d.sitemap_enabled),
    sitemap_extra_paths: strArray(x.sitemap_extra_paths),
  };
}

export function invalidateSeoSettingsCache() {
  cache = null;
  cachedAt = 0;
}

export async function fetchSeoSettings(force = false): Promise<SeoSettings> {
  if (!force && cache && Date.now() - cachedAt < TTL) return cache;
  const { data, error } = await supabase
    .from("app_settings")
    .select("seo_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error) {
    cache = cache ?? DEFAULT_SEO_SETTINGS;
    cachedAt = Date.now();
    return cache;
  }
  const row = data as { seo_settings?: unknown } | null;
  cache = normalizeSeoSettings(row?.seo_settings);
  cachedAt = Date.now();
  return cache;
}

/** Last known SEO (even stale) — better for crawlers than empty defaults when possible. */
export function peekSeoSettingsCache(): SeoSettings {
  return cache ?? DEFAULT_SEO_SETTINGS;
}

/**
 * Fast path for route `head` / loader: return cached SEO immediately, else race
 * Supabase vs a short timeout so HTML isn't stalled. Continues warming the cache.
 */
export async function fetchSeoSettingsForLoader(maxWaitMs = 120): Promise<SeoSettings> {
  if (cache && Date.now() - cachedAt < TTL) return cache;

  const pending = fetchSeoSettings(true).catch(() => peekSeoSettingsCache());

  if (maxWaitMs <= 0) {
    void pending;
    return peekSeoSettingsCache();
  }

  return await new Promise<SeoSettings>((resolve) => {
    let settled = false;
    const done = (seo: SeoSettings) => {
      if (settled) return;
      settled = true;
      resolve(seo);
    };
    const timer = setTimeout(() => done(peekSeoSettingsCache()), maxWaitMs);
    void pending.then((seo) => {
      clearTimeout(timer);
      done(seo);
    });
  });
}

export async function saveSeoSettings(settings: SeoSettings): Promise<void> {
  const normalized = normalizeSeoSettings(settings);
  const landingSeo = landingSeoFromSiteSeo(normalized);

  const { data: existing } = await supabase
    .from("app_settings")
    .select("landing_settings")
    .eq("id", 1)
    .maybeSingle();
  const landingRaw = (existing as { landing_settings?: Record<string, unknown> } | null)
    ?.landing_settings;
  const landingMerged =
    landingRaw && typeof landingRaw === "object" ? { ...landingRaw, seo: landingSeo } : undefined;

  const payload: Record<string, unknown> = {
    id: 1,
    seo_settings: normalized,
  };
  if (landingMerged) payload.landing_settings = landingMerged;

  const { error } = await supabase.from("app_settings").upsert(payload as never);
  if (error) throw error;
  cache = normalized;
  cachedAt = Date.now();
}

export function resolveSiteUrl(seo: SeoSettings, fallbackOrigin = ""): string {
  const trimmed = seo.site_url.trim().replace(/\/+$/, "");
  if (trimmed) return trimmed;
  if (fallbackOrigin) return fallbackOrigin.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function absoluteUrl(path: string, seo: SeoSettings, origin = ""): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  const base = resolveSiteUrl(seo, origin);
  if (!base) return path.startsWith("/") ? path : `/${path}`;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function seoTitleForLang(seo: SeoSettings, lang: "bn" | "en"): string {
  return lang === "bn" ? seo.title_bn : seo.title_en;
}

export function seoDescriptionForLang(seo: SeoSettings, lang: "bn" | "en"): string {
  return lang === "bn" ? seo.description_bn : seo.description_en;
}

export function ogTitleForLang(seo: SeoSettings, lang: "bn" | "en"): string {
  const v = lang === "bn" ? seo.og_title_bn : seo.og_title_en;
  return v || seoTitleForLang(seo, lang);
}

export function ogDescriptionForLang(seo: SeoSettings, lang: "bn" | "en"): string {
  const v = lang === "bn" ? seo.og_description_bn : seo.og_description_en;
  return v || seoDescriptionForLang(seo, lang);
}

export function keywordsForLang(seo: SeoSettings, lang: "bn" | "en"): string {
  return lang === "bn" ? seo.keywords_bn : seo.keywords_en;
}

export function robotsContent(seo: SeoSettings): string {
  const parts: string[] = [];
  parts.push(seo.robots_index ? "index" : "noindex");
  parts.push(seo.robots_follow ? "follow" : "nofollow");
  return parts.join(", ");
}

export type HeadMetaTag =
  | { title: string }
  | { name: string; content: string }
  | { property: string; content: string };

export type HeadLinkTag = {
  rel: string;
  href: string;
  hrefLang?: string;
  as?: string;
  type?: string;
  imageSrcSet?: string;
  imageSizes?: string;
  crossOrigin?: "" | "anonymous" | "use-credentials";
};

export function buildHead(
  seo: SeoSettings,
  lang: "bn" | "en" = "bn",
  origin = "",
): { meta: HeadMetaTag[]; links: HeadLinkTag[] } {
  const title = seoTitleForLang(seo, lang);
  const description = seoDescriptionForLang(seo, lang);
  const ogTitle = ogTitleForLang(seo, lang);
  const ogDescription = ogDescriptionForLang(seo, lang);
  const keywords = keywordsForLang(seo, lang);
  const ogImage = absoluteUrl(seo.og_image_url || "/landing/hero.jpg", seo, origin);
  const twitterImage = absoluteUrl(
    seo.twitter_image_url || seo.og_image_url || "/landing/hero.jpg",
    seo,
    origin,
  );
  const canonical = seo.canonical_url.trim()
    ? absoluteUrl(seo.canonical_url, seo, origin)
    : absoluteUrl("/", seo, origin);
  const siteUrl = resolveSiteUrl(seo, origin);
  const locale = lang === "bn" ? "bn_BD" : "en_BD";
  const alternateLocale = lang === "bn" ? "en_BD" : "bn_BD";
  const language = lang === "bn" ? "bn-BD" : "en-BD";

  const meta: HeadMetaTag[] = [
    { title },
    { name: "description", content: description },
    { name: "keywords", content: keywords },
    { name: "author", content: seo.org_name || "BloodLink" },
    { name: "publisher", content: seo.org_name || "BloodLink" },
    { name: "language", content: language },
    { name: "geo.region", content: "BD" },
    { name: "geo.placename", content: "Bangladesh" },
    { name: "ICBM", content: "23.685, 90.3563" },
    { name: "robots", content: robotsContent(seo) },
    { property: "og:title", content: ogTitle },
    { property: "og:description", content: ogDescription },
    { property: "og:type", content: seo.og_type || "website" },
    { property: "og:locale", content: locale },
    { property: "og:locale:alternate", content: alternateLocale },
    { property: "og:image", content: ogImage },
    { property: "og:image:alt", content: ogTitle },
    { name: "twitter:card", content: seo.twitter_card },
    {
      name: "twitter:title",
      content: seo.twitter_title || ogTitle,
    },
    {
      name: "twitter:description",
      content: seo.twitter_description || ogDescription,
    },
    { name: "twitter:image", content: twitterImage },
    { name: "application-name", content: seo.org_name || "BloodLink" },
    { name: "apple-mobile-web-app-title", content: seo.org_name || "BloodLink" },
  ];

  if (siteUrl) {
    meta.push({ property: "og:url", content: canonical });
    meta.push({ property: "og:site_name", content: seo.org_name || "BloodLink" });
  }

  if (seo.google_site_verification.trim()) {
    meta.push({ name: "google-site-verification", content: seo.google_site_verification.trim() });
  }
  if (seo.bing_site_verification.trim()) {
    meta.push({ name: "msvalidate.01", content: seo.bing_site_verification.trim() });
  }

  const links: HeadLinkTag[] = [];
  if (canonical) links.push({ rel: "canonical", href: canonical });
  if (siteUrl && seo.hreflang_bn) {
    links.push({
      rel: "alternate",
      href: absoluteUrl(seo.hreflang_bn, seo, origin),
      hrefLang: "bn",
    });
  }
  if (siteUrl && seo.hreflang_en) {
    links.push({
      rel: "alternate",
      href: absoluteUrl(seo.hreflang_en, seo, origin),
      hrefLang: "en",
    });
  }

  return { meta, links };
}

/** @deprecated Use buildHead() */
export function buildHeadMeta(
  seo: SeoSettings,
  lang: "bn" | "en" = "bn",
  origin = "",
): HeadMetaTag[] {
  return buildHead(seo, lang, origin).meta;
}

export function buildJsonLd(seo: SeoSettings, lang: "bn" | "en" = "bn", origin = "") {
  if (!seo.json_ld_enabled) return null;
  const siteUrl = resolveSiteUrl(seo, origin);
  const logo = absoluteUrl(seo.org_logo_url || "/icon-192.png", seo, origin);
  const sameAs = seo.org_same_as.filter(Boolean);
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: seo.org_name || "BloodLink",
    url: siteUrl || undefined,
    logo,
    description: seoDescriptionForLang(seo, lang),
    telephone: seo.org_phone.trim() || undefined,
    sameAs: sameAs.length ? sameAs : undefined,
    areaServed: {
      "@type": "Country",
      name: "Bangladesh",
    },
    knowsAbout: [
      "Blood donation",
      "Emergency blood requests",
      "Blood donor network",
      "Islamic charity",
      "Saving lives",
    ],
  };
}

export type SeoFaqEntry = {
  question: string;
  answer: string;
};

export type SeoQuoteEntry = {
  text: string;
  source?: string;
  name?: string;
  /** Optional reflection / commentary shown on the card */
  comment?: string;
};

export type SeoIslamicList = {
  name: string;
  description?: string;
  quotes: SeoQuoteEntry[];
};

export function buildLandingJsonLd(
  seo: SeoSettings,
  lang: "bn" | "en" = "bn",
  origin = "",
  faqs: SeoFaqEntry[] = [],
  quotes: SeoQuoteEntry[] = [],
  islamic?: SeoIslamicList | null,
) {
  const siteUrl = resolveSiteUrl(seo, origin);
  const pageUrl = absoluteUrl("/", seo, origin);
  const org = buildJsonLd(seo, lang, origin);
  const inLanguage = lang === "bn" ? "bn-BD" : "en-BD";
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: seo.org_name || "BloodLink",
    url: siteUrl || pageUrl,
    inLanguage,
    description: seoDescriptionForLang(seo, lang),
  };
  const webpage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: seoTitleForLang(seo, lang),
    url: pageUrl,
    description: seoDescriptionForLang(seo, lang),
    inLanguage,
    isPartOf: siteUrl
      ? {
          "@type": "WebSite",
          name: seo.org_name || "BloodLink",
          url: siteUrl,
        }
      : undefined,
    about: [
      "Blood donation",
      "Blood donor network",
      "Emergency blood requests",
      "Bangladesh",
      "Islamic charity",
      lang === "bn" ? "ইসলামে জীবন রক্ষা" : "Saving lives in Islam",
      lang === "bn" ? "রক্তদান সওয়াব" : "Blood donation as charity",
    ],
    hasPart:
      islamic && islamic.quotes.length
        ? {
            "@type": "ItemList",
            name: islamic.name,
            url: `${pageUrl}#islamic`,
          }
        : undefined,
  };
  const items: Record<string, unknown>[] = [];
  if (org) items.push(org as unknown as Record<string, unknown>);
  items.push(website, webpage);
  if (faqs.length) {
    items.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: faqs.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    });
  }
  const quoteList = islamic?.quotes?.length ? islamic.quotes : quotes;
  if (quoteList.length) {
    items.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "@id": `${pageUrl}#islamic`,
      name:
        islamic?.name ||
        (lang === "bn"
          ? "ইসলামে জীবন রক্ষা ও সাহায্য — রক্তদান"
          : "Islamic guidance on saving lives — blood donation"),
      description:
        islamic?.description ||
        (lang === "bn"
          ? "কুরআন ও হাদিসের আলোকে জীবন রক্ষা ও রক্তদানের অনুপ্রেরণা।"
          : "Qur’anic and prophetic inspiration for saving lives through blood donation."),
      numberOfItems: quoteList.length,
      inLanguage,
      url: `${pageUrl}#islamic`,
      itemListElement: quoteList.map((q, i) => ({
        "@type": "ListItem",
        position: i + 1,
        item: {
          "@type": "Quotation",
          text: q.text,
          name: q.name || undefined,
          inLanguage,
          about: ["Blood donation", "Saving lives", "Islamic charity"],
          isBasedOn: q.source
            ? {
                "@type": "CreativeWork",
                name: q.source,
              }
            : undefined,
          description: q.comment || undefined,
        },
      })),
    });
  }
  return items;
}

export function defaultRobotsTxt(seo: SeoSettings, origin = ""): string {
  const siteUrl = resolveSiteUrl(seo, origin) || "https://example.com";
  return `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;
}

export function buildRobotsTxt(seo: SeoSettings, origin = ""): string {
  const custom = seo.robots_txt.trim();
  if (custom) return custom;
  return defaultRobotsTxt(seo, origin);
}

export function sitemapPaths(seo: SeoSettings): string[] {
  const base = ["/", "/auth"];
  const extra = seo.sitemap_extra_paths.map((p) => (p.startsWith("/") ? p : `/${p}`));
  return [...new Set([...base, ...extra])];
}

export function buildSitemapXml(seo: SeoSettings, origin = ""): string {
  const siteUrl = resolveSiteUrl(seo, origin);
  const paths = sitemapPaths(seo);
  const now = new Date().toISOString();
  const urls = paths
    .map((path) => {
      const loc = siteUrl ? `${siteUrl}${path}` : path;
      return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${path === "/" ? "daily" : "weekly"}</changefreq>
    <priority>${path === "/" ? "1.0" : "0.7"}</priority>
  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Sync legacy landing_settings.seo fields from site SEO (backward compat). */
export function landingSeoFromSiteSeo(seo: SeoSettings) {
  return {
    title_bn: seo.title_bn,
    title_en: seo.title_en,
    description_bn: seo.description_bn,
    description_en: seo.description_en,
    og_image_url: seo.og_image_url,
  };
}
