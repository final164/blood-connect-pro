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
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .landing-fade-up {
          animation: landingFadeUp 0.7s ease-out both;
        }
        @keyframes landingFadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .landing-hero-bg {
          animation: landingHeroIn 1.1s ease-out both;
        }
        @keyframes landingHeroIn {
          from { opacity: 0.4; transform: scale(1.04); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
      {children}
    </div>
  );
}
