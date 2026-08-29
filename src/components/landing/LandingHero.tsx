import { type CSSProperties, type ReactNode, lazy, Suspense, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import type { LandingSettings } from "@/lib/landing-settings";
import { DEFAULT_FEATURE_GRID, DEFAULT_HERO_SLIDESHOW, DEFAULT_HERO_YOUTUBE } from "@/lib/landing-settings";
import {
  HeroBackgroundSlideshow,
  ensureHeroSlides,
} from "@/components/landing/HeroBackgroundSlideshow";
import { LandingFeatureGridGuest } from "@/components/landing/LandingFeatureGridGuest";
import { parseYoutubeId } from "@/lib/youtube";
import { hrefRequiresLogin } from "@/lib/auth-next";
import { enterAppOrAuth, enterAppOrOpenAuth } from "@/lib/landing-enter";

const LandingYoutubePlayer = lazy(() =>
  import("@/components/landing/LandingYoutubePlayer").then((m) => ({
    default: m.LandingYoutubePlayer,
  })),
);

const LandingAiHealthPanel = lazy(() =>
  import("@/components/landing/LandingAiHealthPanel").then((m) => ({
    default: m.LandingAiHealthPanel,
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
      <a
        href="/auth"
        className={className}
        style={style}
        onClick={(e) => {
          e.preventDefault();
          void enterAppOrOpenAuth();
        }}
      >
        {children}
      </a>
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

  if (h.startsWith("/care/doctor/")) {
    const path = h.split("?")[0] as
      | "/care/doctor/register"
      | "/care/doctor/auth"
      | "/care/doctor/portal";
    return (
      <Link to={path} className={className} style={style}>
        {children}
      </Link>
    );
  }

  if (h.startsWith("/care/video")) {
    return (
      <Link to="/care/video" className={className} style={style}>
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

  if (hrefRequiresLogin(h)) {
    return (
      <a
        href={h}
        className={className}
        style={style}
        onClick={(e) => {
          e.preventDefault();
          void enterAppOrAuth(h);
        }}
      >
        {children}
      </a>
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
  const grid = h.feature_grid ?? DEFAULT_FEATURE_GRID;
  const gridOn = grid.enabled !== false && grid.tiles.length > 0;
  const slides = ensureHeroSlides(h.background_images, h.background_url);
  const overlay = h.slideshow?.overlay_opacity ?? DEFAULT_HERO_SLIDESHOW.overlay_opacity;
  const [showYoutube, setShowYoutube] = useState(false);
  const [aiReady, setAiReady] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [slidesReady, setSlidesReady] = useState(false);
  const lcpSrc = slides[0];

  const mobileHero =
    typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const slideshow = {
    ...DEFAULT_HERO_SLIDESHOW,
    ...(h.slideshow ?? {}),
    enabled: slidesReady && h.slideshow?.enabled !== false,
    ken_burns: false,
    interval_ms: mobileHero
      ? Math.max(h.slideshow?.interval_ms ?? DEFAULT_HERO_SLIDESHOW.interval_ms, 8000)
      : (h.slideshow?.interval_ms ?? DEFAULT_HERO_SLIDESHOW.interval_ms),
    transition_ms: mobileHero
      ? Math.min(h.slideshow?.transition_ms ?? DEFAULT_HERO_SLIDESHOW.transition_ms, 500)
      : (h.slideshow?.transition_ms ?? DEFAULT_HERO_SLIDESHOW.transition_ms),
    show_dots: mobileHero ? false : (h.slideshow?.show_dots ?? DEFAULT_HERO_SLIDESHOW.show_dots),
  };
  const yt = { ...DEFAULT_HERO_YOUTUBE, ...(h.youtube ?? {}) };
  if (!yt.url?.trim()) yt.url = DEFAULT_HERO_YOUTUBE.url;
  const canYoutube = yt.enabled !== false && !!parseYoutubeId(yt.url);

  useEffect(() => {
    const startSlides = () => setSlidesReady(true);
    const startAi = () => setAiReady(true);
    const mobile =
      typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
    if (typeof requestIdleCallback === "function") {
      const a = requestIdleCallback(startSlides, { timeout: mobile ? 4500 : 1800 });
      const b = requestIdleCallback(startAi, { timeout: mobile ? 6500 : 2800 });
      return () => {
        cancelIdleCallback(a);
        cancelIdleCallback(b);
      };
    }
    const t1 = window.setTimeout(startSlides, mobile ? 2000 : 700);
    const t2 = window.setTimeout(startAi, mobile ? 3200 : 1400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  useEffect(() => {
    if (!canYoutube || gridOn) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const run = () => setShowYoutube(true);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 3500 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 1200);
    return () => window.clearTimeout(t);
  }, [canYoutube, gridOn]);

  if (gridOn) {
    return (
      <section
        id="top"
        className="landing-hero relative flex flex-col overflow-x-hidden min-h-[min(88dvh,820px)]"
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/35" />
          )}
        </div>

        <div className={`relative z-10 ${shell} flex flex-1 flex-col justify-end pb-8 pt-24`}>
          <div className="pb-4">
            <p className="landing-brand text-3xl sm:text-4xl md:text-5xl font-semibold text-white tracking-tight drop-shadow-sm">
              {pick(lang, h.brand_bn, h.brand_en)}
            </p>
            <p className="mt-2 text-sm sm:text-base text-white/85 max-w-xl leading-relaxed drop-shadow-sm">
              {pick(lang, h.sub_bn, h.sub_en)}
            </p>
          </div>

          <div className="space-y-3">
            <LandingFeatureGridGuest
              grid={grid}
              lang={lang}
              onAiHealth={() => {
                setAiReady(true);
                setAiOpen(true);
                requestAnimationFrame(() => {
                  document.getElementById("landing-ai-health")?.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest",
                  });
                });
              }}
            />
            {aiReady ? (
              <Suspense
                fallback={
                  <div
                    className="landing-hero-card w-full px-4 py-3.5 h-[4.25rem]"
                    id="landing-ai-health"
                    aria-hidden
                  />
                }
              >
                <LandingAiHealthPanel lang={lang} open={aiOpen} onOpenChange={setAiOpen} />
              </Suspense>
            ) : (
              <button
                type="button"
                id="landing-ai-health"
                onClick={() => {
                  setAiReady(true);
                  setAiOpen(true);
                }}
                className="landing-hero-card w-full px-4 py-3.5 flex items-center gap-3 text-left"
              >
                <span className="landing-hero-card-icon h-11 w-11 rounded-2xl grid place-items-center shrink-0">
                  <span className="text-sm font-bold">AI</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="landing-hero-card-body text-sm font-semibold">
                    {pick(lang, "AI স্বাস্থ্য — লক্ষণ লিখুন", "AI health — describe symptoms")}
                  </p>
                  <p className="landing-hero-card-muted text-[11px] truncate">
                    {pick(lang, "সাজেশন ও বুকিং · চ্যাটে লগইন লাগবে", "Suggestions & booking · login to chat")}
                  </p>
                </div>
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

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
            showYoutube ? "grid gap-6 sm:gap-8 lg:grid-cols-2 lg:gap-10 lg:items-end" : undefined
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
