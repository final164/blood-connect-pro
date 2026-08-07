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
          /* No backdrop-filter — blur over hero images tanks scroll FPS */
        }
        .landing-section {
          content-visibility: auto;
          contain-intrinsic-size: auto 480px;
        }
        .landing-fade-up {
          animation: landingFadeUp 0.45s ease-out both;
        }
        @keyframes landingFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }
        @media (prefers-reduced-motion: reduce) {
          .landing-fade-up { animation: none; }
          .hero-bg-layer { transition: none !important; }
        }
        /* Hero slideshow — opacity-only; frozen when scrolled away */
        .hero-bg-layer {
          backface-visibility: hidden;
          transform: translateZ(0);
          transition: opacity var(--hero-transition-ms, 700ms) ease-in-out;
          pointer-events: none;
          user-select: none;
          will-change: opacity;
        }
        .hero-bg-root[data-away="true"] .hero-bg-layer {
          transition: none !important;
          will-change: auto;
          /* Drop from compositor while off-screen — big scroll FPS win */
          content-visibility: hidden;
        }
        .hero-bg-root[data-away="true"] {
          contain: strict;
        }
        .landing-hero {
          contain: layout paint style;
        }
      `}</style>
      {children}
    </div>
  );
}
