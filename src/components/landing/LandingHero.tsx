import { type CSSProperties, type ReactNode, lazy, Suspense, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { LandingSettings } from "@/lib/landing-settings";
import { DEFAULT_HERO_SLIDESHOW, DEFAULT_HERO_YOUTUBE } from "@/lib/landing-settings";
import {
  HeroBackgroundSlideshow,
  ensureHeroSlides,
} from "@/components/landing/HeroBackgroundSlideshow";
import { parseYoutubeId } from "@/lib/youtube";

const LandingYoutubePlayer = lazy(() =>
  import("@/components/landing/LandingYoutubePlayer").then((m) => ({
    default: m.LandingYoutubePlayer,
  })),
);

function pick(lang: "bn" | "en", bn: string, en: string) {
  return lang === "bn" ? bn : en;
}

/** CMS href: hash, external, tel/mailto, or in-app path. */
export function LandingHref({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const h = (href || "/auth").trim() || "/auth";
  const external = /^https?:\/\//i.test(h);
  const special = h.startsWith("#") || h.startsWith("tel:") || h.startsWith("mailto:") || external;

  if (special) {
    return (
      <a
        href={h}
        className={className}
        style={style}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  }

  if (h === "/auth" || h.startsWith("/auth?") || h.startsWith("/auth/")) {
    return (
      <Link to="/auth" className={className} style={style}>
        {children}
      </Link>
    );
  }

  if (h.startsWith("/care/auth")) {
    const q = h.includes("?") ? new URLSearchParams(h.split("?")[1]) : null;
    const mode = q?.get("mode");
    return (
      <Link
        to="/care/auth"
        search={mode === "register" ? { mode: "register" as const, next: undefined } : { mode: undefined, next: undefined }}
        className={className}
        style={style}
      >
        {children}
      </Link>
    );
  }

  if (h.startsWith("/care/portal")) {
    const path = h.split("?")[0] as "/care/portal" | "/care/portal/desk" | "/care/portal/lab";
    return (
      <Link to={path || "/care/portal"} className={className} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <a href={h} className={className} style={style}>
      {children}
    </a>
  );
}

const shell = "mx-auto w-full max-w-5xl md:max-w-6xl px-4 sm:px-5";

export function LandingHero({ settings, lang }: { settings: LandingSettings; lang: "bn" | "en" }) {
  const h = settings.hero;
  const slides = ensureHeroSlides(h.background_images, h.background_url);
  const overlay = h.slideshow?.overlay_opacity ?? DEFAULT_HERO_SLIDESHOW.overlay_opacity;
  const slideshow = {
    ...DEFAULT_HERO_SLIDESHOW,
    ...(h.slideshow ?? {}),
    enabled: h.slideshow?.enabled !== false,
    ken_burns: false,
  };
  const yt = { ...DEFAULT_HERO_YOUTUBE, ...(h.youtube ?? {}) };
  if (!yt.url?.trim()) yt.url = DEFAULT_HERO_YOUTUBE.url;
  const canYoutube = yt.enabled !== false && !!parseYoutubeId(yt.url);
  const [showYoutube, setShowYoutube] = useState(false);
  const lcpSrc = slides[0];

  useEffect(() => {
    if (!canYoutube) return;
    // Desktop: restore side-by-side hero video (mobile stays click-to-play for LCP).
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const run = () => setShowYoutube(true);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 3500 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 1200);
    return () => window.clearTimeout(t);
  }, [canYoutube]);

  return (
    <section
      id="top"
      className="landing-hero relative min-h-[min(88dvh,820px)] flex flex-col justify-end overflow-x-hidden"
    >
      <div className="absolute inset-0">
        {h.background_video_url ? (
          <video
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={lcpSrc || undefined}
            src={h.background_video_url}
          />
        ) : (
          <HeroBackgroundSlideshow
            images={slides}
            slideshow={slideshow}
            overlayOpacity={overlay}
          />
        )}
        {h.background_video_url && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/25" />
        )}
      </div>

      <div className={`relative z-10 ${shell} pb-12 pt-28`}>
        <div
          className={
            showYoutube
              ? "grid gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-10 lg:items-end"
              : undefined
          }
        >
          <div className="min-w-0">
            <p className="landing-brand text-3xl sm:text-5xl md:text-6xl font-semibold text-white tracking-tight mb-3">
              {pick(lang, h.brand_bn, h.brand_en)}
            </p>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-semibold text-white/95 max-w-2xl leading-snug">
              {pick(lang, h.headline_bn, h.headline_en)}
            </h1>
            <p className="mt-3 text-sm sm:text-base text-white/75 max-w-xl leading-relaxed">
              {pick(lang, h.sub_bn, h.sub_en)}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <LandingHref
                href={h.cta_primary_href}
                className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30"
                style={{ background: "var(--landing-primary)" }}
              >
                {pick(lang, h.cta_primary_bn, h.cta_primary_en)}
              </LandingHref>
              <LandingHref
                href={h.cta_secondary_href}
                className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white/95 border border-white/35 bg-white/10"
              >
                {pick(lang, h.cta_secondary_bn, h.cta_secondary_en)}
              </LandingHref>
              {canYoutube && !showYoutube && (
                <button
                  type="button"
                  onClick={() => setShowYoutube(true)}
                  className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white/95 border border-white/35 bg-white/10 lg:hidden"
                >
                  {lang === "bn" ? "ভিডিও দেখুন" : "Watch video"}
                </button>
              )}
            </div>
          </div>
          {showYoutube && (
            <div className="min-w-0 w-full">
              <Suspense fallback={<div className="aspect-video rounded-2xl bg-black/40" aria-hidden />}>
                <LandingYoutubePlayer youtube={yt} lang={lang} variant="hero" />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
