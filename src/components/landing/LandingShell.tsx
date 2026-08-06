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
          .hero-bg-layer { transition: none !important; }
        }
        /* Hero slideshow — opacity-only GPU fade (no transform/scale = no lag) */
        .hero-bg-layer {
          backface-visibility: hidden;
          transform: translateZ(0);
          transition: opacity var(--hero-transition-ms, 900ms) ease-in-out;
          pointer-events: none;
          user-select: none;
        }
      `}</style>
      {children}
    </div>
  );
}
