import type { CSSProperties, ReactNode } from "react";
import type { LandingSettings } from "@/lib/landing-settings";
import { landingCssVars } from "@/lib/landing-settings";

export function LandingShell({
  settings,
  children,
}: {
  settings: LandingSettings;
  children: ReactNode;
}) {
  const dark = settings.theme === "night_clinic";
  return (
    <div
      className={`landing-root min-h-dvh ${dark ? "landing-dark" : ""}`}
      style={landingCssVars(settings) as CSSProperties}
    >
      <style>{`
        .landing-root {
          background: var(--landing-bg);
          color: var(--landing-fg);
          font-family: "DM Sans", "Noto Sans Bengali", system-ui, sans-serif;
        }
        .landing-root a { color: inherit; }
        .landing-brand {
          font-family: "Noto Sans Bengali", "DM Sans", sans-serif;
          letter-spacing: -0.02em;
        }
        .landing-glass {
          background: var(--landing-glass);
          /* Lighter blur — full 16px blur was a major scroll/FPS cost */
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
        .landing-section {
          content-visibility: auto;
          contain-intrinsic-size: auto 480px;
        }
        .landing-fade-up {
          animation: landingFadeUp 0.45s ease-out both;
        }
        @keyframes landingFadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-fade-up { animation: none; }
          .hero-slide-ken-burns,
          .hero-slide-ken-burns-static { animation: none !important; }
          .hero-slide-fade-in,
          .hero-slide-fade-out,
          .hero-slide-slide-in,
          .hero-slide-slide-out { transition: none !important; }
        }
        .hero-slide-layer {
          will-change: opacity, transform;
          backface-visibility: hidden;
          transform: translateZ(0);
        }
        .hero-slide-fade {
          transition: opacity var(--hero-transition-ms, 1400ms) ease-in-out;
        }
        .hero-slide-fade-in { opacity: 1; z-index: 2; }
        .hero-slide-fade-out { opacity: 0; z-index: 1; }
        .hero-slide-slide {
          transition: transform var(--hero-transition-ms, 1400ms) cubic-bezier(0.4, 0, 0.2, 1),
            opacity var(--hero-transition-ms, 1400ms) ease-in-out;
        }
        .hero-slide-slide-in { opacity: 1; transform: translateX(0); z-index: 2; }
        .hero-slide-slide-out { opacity: 0; transform: translateX(-4%); z-index: 1; }
        .hero-slide-ken-burns img,
        .hero-slide-ken-burns-static {
          animation: heroKenBurns var(--hero-interval-ms, 6000ms) ease-out forwards;
        }
        @keyframes heroKenBurns {
          from { transform: scale(1); }
          to { transform: scale(1.05); }
        }
      `}</style>
      {children}
    </div>
  );
}
