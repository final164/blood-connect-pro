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
          font-family: ui-sans-serif, system-ui, "Segoe UI", sans-serif;
        }
        .landing-root a { color: inherit; }
        .landing-brand {
          font-family: ui-sans-serif, system-ui, "Noto Sans Bengali", sans-serif;
          letter-spacing: -0.02em;
        }
        .landing-glass {
          background: var(--landing-glass);
        }
        .landing-section {
          content-visibility: auto;
          contain-intrinsic-size: auto 480px;
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
