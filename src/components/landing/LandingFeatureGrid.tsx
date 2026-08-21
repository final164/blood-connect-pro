import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Ambulance,
  CalendarDays,
  Droplet,
  FlaskConical,
  HeartPulse,
  MessageCircle,
  Settings,
  Sparkles,
  Stethoscope,
  Store,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { LandingFeatureGrid, LandingFeatureIcon, LandingFeatureTile } from "@/lib/landing-settings";
import { authWithNext, hrefRequiresLogin } from "@/lib/auth-next";
import { useAuth } from "@/lib/auth-context";

const ICON_MAP: Record<LandingFeatureIcon, LucideIcon> = {
  droplet: Droplet,
  heart_pulse: HeartPulse,
  sparkles: Sparkles,
  ambulance: Ambulance,
  stethoscope: Stethoscope,
  flask: FlaskConical,
  users: Users,
  message: MessageCircle,
  calendar: CalendarDays,
  store: Store,
  user: User,
  settings: Settings,
};

function pick(lang: "bn" | "en", bn: string, en: string) {
  return lang === "bn" ? bn : en;
}

function parseAppHref(href: string): { pathname: string; search: Record<string, string> } {
  const raw = (href || "/").trim() || "/";
  const [pathPart, qs = ""] = raw.split("?");
  const search: Record<string, string> = {};
  if (qs) {
    new URLSearchParams(qs).forEach((v, k) => {
      search[k] = v;
    });
  }
  return { pathname: pathPart || "/", search };
}

export function useSmartLandingNav() {
  const navigate = useNavigate();
  const { session, isAnonymous, loading } = useAuth();
  const loggedIn = !!session && !isAnonymous && !loading;

  return function goToTile(tile: LandingFeatureTile) {
    const href = (tile.href || "/").trim() || "/";
    if (href.startsWith("#") || href.startsWith("http") || href.startsWith("tel:") || href.startsWith("mailto:")) {
      window.location.assign(href);
      return;
    }
    if ((tile.requires_auth || hrefRequiresLogin(href)) && !loggedIn) {
      void navigate({ to: "/auth", search: { next: href } as never });
      return;
    }
    const { pathname, search } = parseAppHref(href);
    if (pathname === "/auth" || pathname.startsWith("/auth/")) {
      void navigate({ to: "/auth", search: search.next ? { next: search.next } : {} });
      return;
    }
    if (pathname.startsWith("/care/auth")) {
      void navigate({
        to: "/care/auth",
        search: {
          mode: search.mode === "register" ? ("register" as const) : undefined,
          next: search.next || undefined,
        },
      });
      return;
    }
    void navigate({ to: pathname as never, search: Object.keys(search).length ? (search as never) : undefined });
  };
}

export function LandingFeatureGridPanel({
  grid,
  lang,
}: {
  grid: LandingFeatureGrid;
  lang: "bn" | "en";
}) {
  const [expanded, setExpanded] = useState(false);
  const go = useSmartLandingNav();
  const primary = grid.tiles.filter((t) => !t.more);
  const extra = grid.tiles.filter((t) => t.more);
  const visible = expanded ? [...primary, ...extra] : primary;

  return (
    <div className="landing-feature-grid w-full rounded-2xl bg-white/95 text-[color:var(--landing-foreground,#1a1a1a)] shadow-lg shadow-black/10 border border-black/5 px-3 pt-3 pb-2 sm:px-4">
      {grid.title_bn || grid.title_en ? (
        <p className="text-xs font-semibold text-black/55 px-1 mb-2">
          {pick(lang, grid.title_bn, grid.title_en)}
        </p>
      ) : null}
      <div className="grid grid-cols-4 gap-y-3 gap-x-1 sm:gap-y-4">
        {visible.map((tile) => {
          const Icon = ICON_MAP[tile.icon] ?? Sparkles;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => go(tile)}
              className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center transition active:scale-[0.97] hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-primary)]"
            >
              <span
                className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl grid place-items-center"
                style={{ color: "var(--landing-primary)", background: "color-mix(in srgb, var(--landing-primary) 12%, transparent)" }}
              >
                <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={1.75} />
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium leading-tight text-black/80 max-w-[4.75rem] line-clamp-2">
                {pick(lang, tile.label_bn, tile.label_en)}
              </span>
            </button>
          );
        })}
      </div>
      {extra.length > 0 && (
        <div className="mt-1 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-semibold py-2 px-3"
            style={{ color: "var(--landing-primary)" }}
          >
            {expanded
              ? pick(lang, grid.see_less_bn, grid.see_less_en)
              : pick(lang, grid.see_more_bn, grid.see_more_en)}
          </button>
        </div>
      )}
    </div>
  );
}

/** For guests without AuthProvider (landing shell) — soft navigate via location. */
export function LandingFeatureGridGuest({
  grid,
  lang,
  onAiHealth,
}: {
  grid: LandingFeatureGrid;
  lang: "bn" | "en";
  /** When set, AI health tile opens inline panel instead of navigating away. */
  onAiHealth?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const primary = grid.tiles.filter((t) => !t.more);
  const extra = grid.tiles.filter((t) => t.more);
  const visible = expanded ? [...primary, ...extra] : primary;

  function go(tile: LandingFeatureTile) {
    if (tile.id === "ai_health" && onAiHealth) {
      onAiHealth();
      return;
    }
    const href = (tile.href || "/").trim() || "/";
    if (tile.requires_auth || hrefRequiresLogin(href)) {
      window.location.assign(authWithNext(href));
      return;
    }
    window.location.assign(href);
  }

  return (
    <div className="landing-feature-grid w-full rounded-2xl bg-white/95 text-[color:var(--landing-foreground,#1a1a1a)] shadow-lg shadow-black/10 border border-black/5 px-3 pt-3 pb-2 sm:px-4">
      {grid.title_bn || grid.title_en ? (
        <p className="text-xs font-semibold text-black/55 px-1 mb-2">
          {pick(lang, grid.title_bn, grid.title_en)}
        </p>
      ) : null}
      <div className="grid grid-cols-4 gap-y-3 gap-x-1 sm:gap-y-4">
        {visible.map((tile) => {
          const Icon = ICON_MAP[tile.icon] ?? Sparkles;
          return (
            <button
              key={tile.id}
              type="button"
              onClick={() => go(tile)}
              className="flex flex-col items-center gap-1.5 rounded-xl px-1 py-2 text-center transition active:scale-[0.97] hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--landing-primary)]"
            >
              <span
                className="h-11 w-11 sm:h-12 sm:w-12 rounded-2xl grid place-items-center"
                style={{
                  color: "var(--landing-primary)",
                  background: "color-mix(in srgb, var(--landing-primary) 12%, transparent)",
                }}
              >
                <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" strokeWidth={1.75} />
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium leading-tight text-black/80 max-w-[4.75rem] line-clamp-2">
                {pick(lang, tile.label_bn, tile.label_en)}
              </span>
            </button>
          );
        })}
      </div>
      {extra.length > 0 && (
        <div className="mt-1 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-semibold py-2 px-3"
            style={{ color: "var(--landing-primary)" }}
          >
            {expanded
              ? pick(lang, grid.see_less_bn, grid.see_less_en)
              : pick(lang, grid.see_more_bn, grid.see_more_en)}
          </button>
        </div>
      )}
    </div>
  );
}
