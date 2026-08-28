/**
 * Landing media — prefer local `/landing/*` assets (reliable in BD, no CDN 404s).
 * Remote URLs are still downsized when admins paste Unsplash links.
 */

/** Never use the heavy PWA icon as a nav/logo <img> (steals LCP bandwidth). */
export function sanitizeLogoUrl(url: string | null | undefined): string {
  const raw = (url ?? "").trim();
  if (!raw) return "/icon.svg";
  if (/icon-512\.png/i.test(raw)) return "/icon-192.png";
  return raw;
}

function rewriteUnsplash(
  raw: string,
  opts: { w?: number; q?: number; h?: number },
): string {
  const w = opts.w ?? 960;
  const q = opts.q ?? 60;
  const h = opts.h;
  try {
    const u = new URL(raw);
    u.searchParams.set("auto", "format");
    u.searchParams.set("fit", "crop");
    u.searchParams.set("w", String(w));
    if (h) u.searchParams.set("h", String(h));
    else u.searchParams.delete("h");
    u.searchParams.set("q", String(q));
    u.searchParams.delete("ixlib");
    return u.toString();
  } catch {
    return raw;
  }
}

export function optimizeLandingImageUrl(
  url: string | null | undefined,
  opts: { w?: number; q?: number; h?: number } = {},
): string {
  const raw = (url ?? "").trim();
  if (!raw) return "";
  // Local / relative assets — never rewrite
  if (raw.startsWith("/") || raw.startsWith("data:") || !/^https?:\/\//i.test(raw)) {
    return raw;
  }
  if (/images\.unsplash\.com/i.test(raw)) {
    return rewriteUnsplash(raw, opts);
  }
  return raw;
}

/** Responsive srcset for Unsplash (or empty if not Unsplash). */
export function landingImageSrcSet(
  url: string | null | undefined,
  opts: { q?: number } = {},
): string {
  const raw = (url ?? "").trim();
  if (!raw || !/images\.unsplash\.com/i.test(raw)) return "";
  const q = opts.q ?? 58;
  return [640, 960, 1280]
    .map((w) => `${rewriteUnsplash(raw, { w, q })} ${w}w`)
    .join(", ");
}

/** Best preload href + optional imagesrcset for the LCP hero.
 * Must match the priority <img> src/srcSet exactly so the browser
 * does not double-fetch (huge LCP win on Slow 4G).
 */
export function heroLcpPreload(url: string | null | undefined): {
  href: string;
  imageSrcSet?: string;
  imageSizes?: string;
} {
  const raw = (url ?? "").trim();
  if (isDefaultHeroUrl(raw)) {
    return {
      href: HERO_LCP.webp,
      imageSrcSet: HERO_LCP.srcSet,
      imageSizes: HERO_LCP.sizes,
    };
  }
  const href = optimizeLandingImageUrl(raw || HERO_LCP.jpg, { w: 960, q: 58 });
  const imageSrcSet = landingImageSrcSet(raw, { q: 58 });
  return imageSrcSet
    ? { href, imageSrcSet, imageSizes: HERO_LCP.sizes }
    : { href };
}

/** Optimized LCP hero (WebP + JPEG fallback). */
export const HERO_LCP = {
  /** Default preload / fallback JPEG */
  jpg: "/landing/hero.jpg",
  /** Best default for mobile LCP (Moto G / Slow 4G) */
  webp: "/landing/hero-640.webp",
  srcSet:
    "/landing/hero-640.webp 640w, /landing/hero-960.webp 960w, /landing/hero-1280.webp 1280w",
  sizes: "100vw",
  width: 1280,
  height: 800,
} as const;

/** True when URL is the default local hero (supports WebP srcset). */
export function isDefaultHeroUrl(url: string | null | undefined): boolean {
  const u = (url ?? "").trim();
  return !u || u === HERO_LCP.jpg || u.startsWith("/landing/hero");
}

/**
 * Local blood-donation themed photos (shipped in public/landing).
 * Theme: donation process, hospital/clinic, volunteers — suitable for BD audiences.
 */
export const LANDING_MEDIA = {
  logo: "/icon-192.png",
  og: "/landing/hero.jpg",
  hero: "/landing/hero.jpg",
  /** Default hero slideshow (local, fast) — slide 1 is LCP */
  heroSlides: ["/landing/hero.jpg", "/landing/arm-donate.jpg", "/landing/bags.jpg"] as const,
  communityBg: "/landing/volunteer.jpg",
  ctaBg: "/landing/clinic.jpg",
  how: ["/landing/lab.jpg", "/landing/hospital.jpg", "/landing/care-team.jpg"] as const,
  carousel: ["/landing/bags.jpg", "/landing/hospital.jpg", "/landing/arm-donate.jpg"] as const,
  stories: ["/landing/nurse.jpg", "/landing/care-team.jpg"] as const,
  campaigns: ["/landing/arm-donate.jpg", "/landing/hands.jpg", "/landing/clinic.jpg"] as const,
  gallery: [
    "/landing/hero.jpg",
    "/landing/arm-donate.jpg",
    "/landing/bags.jpg",
    "/landing/volunteer.jpg",
    "/landing/hospital.jpg",
    "/landing/nurse.jpg",
  ] as const,
  communityCards: ["/landing/community.jpg", "/landing/hands.jpg", "/landing/ward.jpg"] as const,
  /** Used when an image fails to load */
  fallback: "/landing/hero.jpg",
} as const;
