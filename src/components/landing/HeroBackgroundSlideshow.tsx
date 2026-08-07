import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LandingHeroSlideshow } from "@/lib/landing-settings";
import { LANDING_MEDIA } from "@/lib/landing-media";

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

/**
 * Lag-free hero crossfade: two GPU layers, opacity only.
 * Pauses while the user scrolls / hero leaves the viewport so scroll FPS stays smooth.
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

  const [layer0, setLayer0] = useState(slides[0] ?? LANDING_MEDIA.hero);
  const [layer1, setLayer1] = useState(slides[1] ?? slides[0] ?? LANDING_MEDIA.hero);
  const [activeLayer, setActiveLayer] = useState<0 | 1>(0);
  const [index, setIndex] = useState(0);
  const [away, setAway] = useState(false);

  slidesRef.current = slides;

  // Reset + preload when slide list changes
  useEffect(() => {
    const list = ensureHeroSlides(images);
    indexRef.current = 0;
    activeLayerRef.current = 0;
    setIndex(0);
    setActiveLayer(0);
    setLayer0(list[0] ?? LANDING_MEDIA.hero);
    setLayer1(list[1] ?? list[0] ?? LANDING_MEDIA.hero);
    preload(list.slice(0, 1));
    const rest = list.slice(1);
    if (rest.length) {
      const run = () => preload(rest);
      if (typeof requestIdleCallback === "function") {
        const id = requestIdleCallback(run, { timeout: 2500 });
        return () => cancelIdleCallback(id);
      }
      const t = window.setTimeout(run, 800);
      return () => window.clearTimeout(t);
    }
  }, [images.join("|")]);

  // Pause slideshow while scrolling (hero crossfade mid-scroll = jank)
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
        // Freeze compositor work for full-bleed images once hero is mostly gone
        setAway(!onScreen);
      },
      { threshold: [0, 0.08, 0.25, 0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const enabled = slideshow.enabled !== false && slides.length >= 2;
  const intervalMs = Math.min(30000, Math.max(2500, slideshow.interval_ms || 5500));
  // Cap fade length — long opacity transitions over 88vh images hurt scroll
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
      <img
        src={layer0}
        alt=""
        width={1400}
        height={900}
        decoding="async"
        fetchPriority={activeLayer === 0 ? "high" : "low"}
        draggable={false}
        className="hero-bg-layer absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: away ? 0 : activeLayer === 0 ? 1 : 0,
          visibility: away ? "hidden" : "visible",
        }}
      />
      <img
        src={layer1}
        alt=""
        width={1400}
        height={900}
        decoding="async"
        fetchPriority={activeLayer === 1 ? "high" : "low"}
        draggable={false}
        className="hero-bg-layer absolute inset-0 h-full w-full object-cover"
        style={{
          opacity: away ? 0 : activeLayer === 1 ? 1 : 0,
          visibility: away ? "hidden" : "visible",
        }}
      />

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
