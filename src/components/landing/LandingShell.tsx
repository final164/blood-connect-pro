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
        /* Hero overlay cards — driven by admin hero.overlay_cards */
        .landing-hero-card {
          border-radius: 1rem;
          border: 1px solid rgba(var(--hero-card-rgb, 255,255,255), var(--hero-card-border-a, 0.15));
          background: rgba(var(--hero-card-rgb, 255,255,255), var(--hero-card-bg-a, 0.06));
          backdrop-filter: blur(var(--hero-card-blur, 12px));
          -webkit-backdrop-filter: blur(var(--hero-card-blur, 12px));
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, var(--hero-card-shadow-a, 0.2));
        }
        .landing-hero-card-inner {
          border-radius: 0.75rem;
          border: 1px solid rgba(var(--hero-card-rgb, 255,255,255), var(--hero-card-border-a, 0.15));
          background: rgba(var(--hero-card-rgb, 255,255,255), var(--hero-card-inner-bg-a, 0.06));
        }
        .landing-hero-card-footer {
          border-top: 1px solid rgba(var(--hero-card-rgb, 255,255,255), var(--hero-card-border-a, 0.15));
          background: rgba(var(--hero-card-rgb, 255,255,255), var(--hero-card-footer-bg-a, 0.04));
          backdrop-filter: blur(calc(var(--hero-card-blur, 12px) * 0.75));
          -webkit-backdrop-filter: blur(calc(var(--hero-card-blur, 12px) * 0.75));
        }
        .landing-hero-card-title {
          color: rgba(var(--hero-card-fg-rgb, 255,255,255), var(--hero-card-title-a, 0.7));
        }
        .landing-hero-card-body {
          color: rgba(var(--hero-card-fg-rgb, 255,255,255), var(--hero-card-body-a, 0.95));
        }
        .landing-hero-card-muted {
          color: rgba(var(--hero-card-fg-rgb, 255,255,255), var(--hero-card-muted-a, 0.6));
        }
        .landing-hero-card-label {
          color: rgba(var(--hero-card-fg-rgb, 255,255,255), var(--hero-card-body-a, 0.95));
        }
        .landing-hero-card-icon {
          color: var(--landing-primary);
          background: color-mix(in srgb, var(--landing-primary) var(--hero-card-icon-tint, 18%), transparent);
        }
        .landing-hero-card-tile:hover {
          background: rgba(var(--hero-card-rgb, 255,255,255), var(--hero-card-hover-a, 0.1));
        }
        .landing-hero-card-tile:active {
          transform: scale(0.97);
        }
        .landing-hero-card-btn-muted {
          color: rgba(var(--hero-card-fg-rgb, 255,255,255), var(--hero-card-muted-a, 0.6));
        }
        .landing-hero-card-btn-muted:hover {
          background: rgba(var(--hero-card-rgb, 255,255,255), var(--hero-card-hover-a, 0.1));
        }
        .landing-hero-card-input {
          border: 1px solid rgba(var(--hero-card-rgb, 255,255,255), var(--hero-card-border-a, 0.15));
          background: rgba(var(--hero-card-rgb, 255,255,255), var(--hero-card-inner-bg-a, 0.06));
          color: rgba(var(--hero-card-fg-rgb, 255,255,255), var(--hero-card-body-a, 0.95));
        }
        .landing-hero-card-input::placeholder {
          color: rgba(var(--hero-card-fg-rgb, 255,255,255), calc(var(--hero-card-muted-a, 0.6) * 0.85));
        }
        .landing-hero-card-divider {
          border-color: rgba(var(--hero-card-rgb, 255,255,255), var(--hero-card-border-a, 0.15));
        }
        .landing-hero-card-outline-btn {
          border: 1px solid rgba(var(--hero-card-rgb, 255,255,255), var(--hero-card-border-a, 0.15));
          color: rgba(var(--hero-card-fg-rgb, 255,255,255), var(--hero-card-body-a, 0.95));
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
