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
 * Lag-free hero crossfade: two GPU layers, opacity only, stable timer via refs.
 * All slides preloaded once; next image is painted on the hidden layer before fade.
 */
export function HeroBackgroundSlideshow({ images, slideshow, overlayOpacity }: Props) {
  const slides = ensureHeroSlides(images);
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);
  const pausedRef = useRef(false);
  const indexRef = useRef(0);
  const activeLayerRef = useRef<0 | 1>(0);
  const slidesRef = useRef(slides);

  const [layer0, setLayer0] = useState(slides[0] ?? LANDING_MEDIA.hero);
  const [layer1, setLayer1] = useState(slides[1] ?? slides[0] ?? LANDING_MEDIA.hero);
  const [activeLayer, setActiveLayer] = useState<0 | 1>(0);
  const [index, setIndex] = useState(0);

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
    preload(list);
  }, [images.join("|")]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = !!entry?.isIntersecting;
      },
      { threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const enabled = slideshow.enabled !== false && slides.length >= 2;
  // Honor admin settings fully (normalized range: interval 2.5–30s, fade 0.4–4s)
  const intervalMs = Math.min(30000, Math.max(2500, slideshow.interval_ms || 5500));
  const transitionMs = Math.min(4000, Math.max(400, slideshow.transition_ms || 900));

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      if (!visibleRef.current || document.hidden || pausedRef.current) return;
      const list = slidesRef.current;
      if (list.length < 2) return;

      const nextIdx = (indexRef.current + 1) % list.length;
      const nextSrc = list[nextIdx] ?? list[0];
      const nextLayer: 0 | 1 = activeLayerRef.current === 0 ? 1 : 0;

      // Paint next image on the hidden layer, then fade
      if (nextLayer === 0) setLayer0(nextSrc);
      else setLayer1(nextSrc);

      // Double-rAF so the browser paints the new src before opacity flip
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
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
      className="absolute inset-0 overflow-hidden bg-black"
      style={style}
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
        style={{ opacity: activeLayer === 0 ? 1 : 0 }}
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
        style={{ opacity: activeLayer === 1 ? 1 : 0 }}
      />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to top, rgba(0,0,0,${o}) 0%, rgba(0,0,0,${o * 0.45}) 50%, rgba(0,0,0,${o * 0.28}) 100%)`,
        }}
      />

      {slideshow.show_dots && slides.length > 1 && (
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
