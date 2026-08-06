import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { LandingHeroSlideshow, LandingHeroTransition } from "@/lib/landing-settings";
import { LandingImg } from "@/components/landing/LandingImg";
import { LANDING_MEDIA } from "@/lib/landing-media";

type Props = {
  images: string[];
  slideshow: LandingHeroSlideshow;
  overlayOpacity: number;
};

function layerClass(transition: LandingHeroTransition, visible: boolean, kenBurns: boolean) {
  const base = "hero-slide-layer absolute inset-0 h-full w-full";
  const motion = kenBurns ? " hero-slide-ken-burns" : "";
  if (transition === "slide") {
    return `${base}${motion} hero-slide-slide ${visible ? "hero-slide-slide-in" : "hero-slide-slide-out"}`;
  }
  return `${base}${motion} hero-slide-fade ${visible ? "hero-slide-fade-in" : "hero-slide-fade-out"}`;
}

export function HeroBackgroundSlideshow({ images, slideshow, overlayOpacity }: Props) {
  const slides = images.filter(Boolean);
  const rootRef = useRef<HTMLDivElement>(null);
  const visibleRef = useRef(true);
  const pausedRef = useRef(false);
  const [index, setIndex] = useState(0);
  const [frontIsB, setFrontIsB] = useState(false);
  const [srcA, setSrcA] = useState(slides[0] ?? "");
  const [srcB, setSrcB] = useState(slides[1] ?? slides[0] ?? "");

  const single = slides.length <= 1 || !slideshow.enabled;
  const activeSrc = slides[index] ?? slides[0] ?? LANDING_MEDIA.hero;

  const advance = useCallback(() => {
    if (single || slides.length < 2) return;
    const nextIdx = (index + 1) % slides.length;
    const nextSrc = slides[nextIdx] ?? slides[0];
    if (frontIsB) {
      setSrcA(nextSrc);
    } else {
      setSrcB(nextSrc);
    }
    setFrontIsB((v) => !v);
    setIndex(nextIdx);
  }, [frontIsB, index, single, slides]);

  useEffect(() => {
    setIndex(0);
    setFrontIsB(false);
    setSrcA(slides[0] ?? "");
    setSrcB(slides[1] ?? slides[0] ?? "");
  }, [slides.join("|")]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = !!entry?.isIntersecting;
      },
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (single || slides.length < 2) return;
    const tick = () => {
      if (!visibleRef.current || document.hidden || pausedRef.current) return;
      advance();
    };
    const id = window.setInterval(tick, slideshow.interval_ms);
    return () => window.clearInterval(id);
  }, [advance, single, slides.length, slideshow.interval_ms]);

  useEffect(() => {
    if (single || slides.length < 2) return;
    const next = slides[(index + 1) % slides.length];
    if (!next) return;
    const img = new Image();
    img.decoding = "async";
    img.src = next;
  }, [index, single, slides]);

  const transitionStyle = {
    "--hero-transition-ms": `${slideshow.transition_ms}ms`,
    "--hero-interval-ms": `${slideshow.interval_ms}ms`,
  } as CSSProperties;

  if (!slides.length) return null;

  if (single) {
    return (
      <div ref={rootRef} className="absolute inset-0" style={transitionStyle}>
        <LandingImg
          src={activeSrc}
          fallbackSrc={LANDING_MEDIA.hero}
          alt=""
          className={`h-full w-full object-cover${slideshow.ken_burns ? " hero-slide-ken-burns-static" : ""}`}
          fetchPriority="high"
          decoding="async"
          width={1400}
          height={900}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(to top, rgba(0,0,0,${overlayOpacity / 100}) 0%, rgba(0,0,0,${overlayOpacity * 0.5 / 100}) 45%, rgba(0,0,0,${overlayOpacity * 0.3 / 100}) 100%)`,
          }}
        />
      </div>
    );
  }

  const frontSrc = frontIsB ? srcB : srcA;
  const backSrc = frontIsB ? srcA : srcB;

  return (
    <div
      ref={rootRef}
      className="absolute inset-0 overflow-hidden"
      style={transitionStyle}
      onMouseEnter={() => {
        if (slideshow.pause_on_hover) pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
    >
      <div className={layerClass(slideshow.transition, false, slideshow.ken_burns)}>
        <LandingImg
          src={backSrc}
          fallbackSrc={LANDING_MEDIA.hero}
          alt=""
          className="h-full w-full object-cover"
          decoding="async"
          width={1400}
          height={900}
        />
      </div>
      <div className={layerClass(slideshow.transition, true, slideshow.ken_burns)}>
        <LandingImg
          src={frontSrc}
          fallbackSrc={LANDING_MEDIA.hero}
          alt=""
          className="h-full w-full object-cover"
          fetchPriority="high"
          decoding="async"
          width={1400}
          height={900}
        />
      </div>

      {slideshow.show_dots && (
        <div className="absolute bottom-4 left-0 right-0 z-10 flex justify-center gap-1.5 pointer-events-none">
          {slides.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                idx === index ? "w-5 bg-white/90" : "w-1.5 bg-white/40"
              }`}
            />
          ))}
        </div>
      )}

      <div
        className="absolute inset-0 pointer-events-none z-[5]"
        style={{
          background: `linear-gradient(to top, rgba(0,0,0,${overlayOpacity / 100}) 0%, rgba(0,0,0,${overlayOpacity * 0.5 / 100}) 45%, rgba(0,0,0,${overlayOpacity * 0.3 / 100}) 100%)`,
        }}
      />
    </div>
  );
}
