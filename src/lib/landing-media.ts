/**
 * Landing media — prefer local `/landing/*` assets (reliable in BD, no CDN 404s).
 * Remote URLs are still downsized when admins paste Unsplash links.
 */

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
  const w = opts.w ?? 960;
  const q = opts.q ?? 65;
  const h = opts.h;

  try {
    if (/images\.unsplash\.com/i.test(raw)) {
      const u = new URL(raw);
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      u.searchParams.set("w", String(w));
      if (h) u.searchParams.set("h", String(h));
      u.searchParams.set("q", String(q));
      u.searchParams.delete("ixlib");
      return u.toString();
    }
  } catch {
    /* keep original */
  }
  return raw;
}

/**
 * Local blood-donation themed photos (shipped in public/landing).
 * Theme: donation process, hospital/clinic, volunteers — suitable for BD audiences.
 */
export const LANDING_MEDIA = {
  logo: "/icon-192.png",
  og: "/landing/hero.jpg",
  hero: "/landing/hero.jpg",
  /** Default hero slideshow (local, fast) */
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
