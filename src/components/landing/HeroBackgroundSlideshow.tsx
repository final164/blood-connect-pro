import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LandingHeroSlideshow } from "@/lib/landing-settings";
import { HERO_LCP, LANDING_MEDIA, isDefaultHeroUrl, landingImageSrcSet, optimizeLandingImageUrl } from "@/lib/landing-media";

type Props = {
  images: string[];
  slideshow: LandingHeroSlideshow;
  overlayOpacity: number;
};

/** Ensure at least 3 distinct local slides for a reliable slideshow. */
export function ensureHeroSlides(images: string[] | undefined, fallbackUrl?: string): string[] {
  const defaults = [...LANDING_MEDIA.heroSlides];
  const cleaned = (images ?? []).map((u) => u.trim()).filter(Boolean);
  if (cleaned.length >= 2) return cleaned;
  if (cleaned.length === 1) {
    const extras = defaults.filter((d) => d !== cleaned[0]);
    return [cleaned[0], ...extras].slice(0, Math.max(3, extras.length + 1));
  }
  if (fallbackUrl?.trim()) {
    const one = fallbackUrl.trim();
    const extras = defaults.filter((d) => d !== one);
    return [one, ...extras].slice(0, 3);
  }
  return defaults;
}

function preload(urls: string[]) {
  for (const url of urls) {
    if (!url) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}

function HeroSlideImg({
  src,
  active,
  away,
  priority,
}: {
  src: string | null;
  active: boolean;
  away: boolean;
  priority: boolean;
}) {
  if (!src) {
    return (
      <div
        className="hero-bg-layer absolute inset-0"
        style={{ opacity: 0, visibility: "hidden" }}
        aria-hidden
      />
    );
  }

  const useWebp = isDefaultHeroUrl(src);
  const remoteSrcSet = !useWebp ? landingImageSrcSet(src) : "";
  const remoteSrc = !useWebp
    ? optimizeLandingImageUrl(src, { w: 960, q: 58 }) || src
    : src;
  const common = {
    alt: "",
    width: HERO_LCP.width,
    height: HERO_LCP.height,
    /** Async decode — sync blocks first paint on Slow 4G. */
    decoding: "async" as const,
    loading: (priority ? "eager" : "lazy") as "eager" | "lazy",
    draggable: false,
    className: "hero-bg-layer absolute inset-0 h-full w-full object-cover",
    style: {
      opacity: away ? 0 : active ? 1 : 0,
      visibility: (away ? "hidden" : "visible") as "hidden" | "visible",
    },
  };

  if (useWebp) {
    return (
      <img
        {...common}
        src={HERO_LCP.webp}
        srcSet={HERO_LCP.srcSet}
        sizes={HERO_LCP.sizes}
        fetchPriority={priority ? "high" : "low"}
      />
    );
  }

  return (
    <img
      {...common}
      src={remoteSrc}
      {...(remoteSrcSet
        ? { srcSet: remoteSrcSet, sizes: HERO_LCP.sizes }
        : {})}
      fetchPriority={priority ? "high" : "low"}
    />
  );
}

/**
 * Lag-free hero crossfade: two GPU layers, opacity only.
 * Layer B has no src until first transition — avoids competing with LCP.
 */
export function HeroBackgroundSlideshow({ images, slideshow, overlayOpacity }: Props) {
  const slides = ensureHeroSlides(images);
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);
  const scrollingRef = useRef(false);
  const pausedRef = useRef(false);
  const indexRef = useRef(0);
  const activeLayerRef = useRef<0 | 1>(0);
  const slidesRef = useRef(slides);
  const scrollResumeTimer = useRef(0);

  const [layer0, setLayer0] = useState<string | null>(slides[0] ?? LANDING_MEDIA.hero);
  /** Intentionally empty until first slide change — do not compete with LCP. */
  const [layer1, setLayer1] = useState<string | null>(null);
  const [activeLayer, setActiveLayer] = useState<0 | 1>(0);
  const [index, setIndex] = useState(0);
  const [away, setAway] = useState(false);

  slidesRef.current = slides;

  // Reset when slide list changes — only paint slide 1 immediately
  useEffect(() => {
    const list = ensureHeroSlides(images);
    indexRef.current = 0;
    activeLayerRef.current = 0;
    setIndex(0);
    setActiveLayer(0);
    setLayer0(list[0] ?? LANDING_MEDIA.hero);
    setLayer1(null);
    const rest = list.slice(1);
    if (rest.length) {
      const run = () => preload(rest);
      if (typeof requestIdleCallback === "function") {
        const id = requestIdleCallback(run, { timeout: 12000 });
        return () => cancelIdleCallback(id);
      }
      const t = window.setTimeout(run, 8000);
      return () => window.clearTimeout(t);
    }
  }, [images.join("|")]);

  useEffect(() => {
    const onScroll = () => {
      scrollingRef.current = true;
      window.clearTimeout(scrollResumeTimer.current);
      scrollResumeTimer.current = window.setTimeout(() => {
        scrollingRef.current = false;
      }, 180);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.clearTimeout(scrollResumeTimer.current);
    };
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        const ratio = entry?.intersectionRatio ?? 0;
        const onScreen = !!entry?.isIntersecting && ratio > 0.08;
        visibleRef.current = onScreen;
        setAway(!onScreen);
      },
      { threshold: [0, 0.08, 0.25, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const enabled = slideshow.enabled !== false && slides.length >= 2;
  const intervalMs = Math.min(30000, Math.max(2500, slideshow.interval_ms || 5500));
  const transitionMs = Math.min(700, Math.max(350, slideshow.transition_ms || 700));

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (
        !visibleRef.current ||
        scrollingRef.current ||
        document.hidden ||
        pausedRef.current
      ) {
        return;
      }
      const list = slidesRef.current;
      if (list.length < 2) return;

      const nextIdx = (indexRef.current + 1) % list.length;
      const nextSrc = list[nextIdx] ?? list[0];
      const nextLayer: 0 | 1 = activeLayerRef.current === 0 ? 1 : 0;

      if (nextLayer === 0) setLayer0(nextSrc);
      else setLayer1(nextSrc);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (scrollingRef.current || !visibleRef.current) return;
          activeLayerRef.current = nextLayer;
          indexRef.current = nextIdx;
          setActiveLayer(nextLayer);
          setIndex(nextIdx);
        });
      });
    };

    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, intervalMs, slides.length]);

  const o = Math.min(100, Math.max(0, overlayOpacity)) / 100;
  const style = {
    "--hero-transition-ms": `${transitionMs}ms`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className="hero-bg-root absolute inset-0 overflow-hidden bg-black"
      style={style}
      data-away={away ? "true" : "false"}
      onMouseEnter={() => {
        if (slideshow.pause_on_hover) pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <HeroSlideImg src={layer0} active={activeLayer === 0} away={away} priority={activeLayer === 0} />
      <HeroSlideImg src={layer1} active={activeLayer === 1} away={away} priority={activeLayer === 1} />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: away
            ? "var(--landing-bg, #F7F3F0)"
            : `linear-gradient(to top, rgba(0,0,0,${o}) 0%, rgba(0,0,0,${o * 0.45}) 50%, rgba(0,0,0,${o * 0.28}) 100%)`,
        }}
      />

      {slideshow.show_dots && slides.length > 1 && !away && (
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-1.5 pointer-events-none">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full ${i === index ? "w-5 bg-white/90" : "w-1.5 bg-white/40"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
