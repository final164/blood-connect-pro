import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState } from "react";
import {
  DEFAULT_LANDING_SETTINGS,
  activeIslamicCards,
  type LandingSettings,
} from "@/lib/landing-settings";
import {
  DEFAULT_SEO_SETTINGS,
  buildHead,
} from "@/lib/seo-settings";
import { loadLandingPage } from "@/lib/landing-page-data";
import { LANDING_STYLESHEET } from "@/lib/landing-stylesheet";
import { LandingShell } from "@/components/landing/LandingShell";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { LANDING_MEDIA, heroLcpPreload } from "@/lib/landing-media";
import { ensureHeroSlides } from "@/components/landing/HeroBackgroundSlideshow";

const LandingRestSections = lazy(() =>
  import("@/components/landing/LandingRestSections").then((m) => ({
    default: m.LandingRestSections,
  })),
);

const LandingSeoJsonLd = lazy(() =>
  import("@/components/SeoHead").then((m) => ({ default: m.LandingSeoJsonLd })),
);

function hasStoredAuthHint(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/auth-token|sb-.*-auth/i.test(key)) continue;
      const raw = localStorage.getItem(key);
      if (raw && /access_token|"user"/.test(raw)) return true;
    }
  } catch {
    /* private mode */
  }
  return false;
}

function readLandingLang(): "bn" | "en" {
  if (typeof window === "undefined") return "bn";
  try {
    if (window.localStorage.getItem("lang") === "en") return "en";
  } catch {
    /* private mode */
  }
  return "bn";
}

export const Route = createFileRoute("/")({
  loader: () => loadLandingPage(),
  head: ({ loaderData }) => {
    const seo = loaderData?.seo ?? DEFAULT_SEO_SETTINGS;
    const settings = loaderData?.settings ?? DEFAULT_LANDING_SETTINGS;
    const { meta, links } = buildHead(seo, "bn");
    const gridOn = settings.hero?.feature_grid?.enabled !== false;
    const heroLcp =
      ensureHeroSlides(settings.hero?.background_images, settings.hero?.background_url)[0] ||
      LANDING_MEDIA.hero;
    const preload = heroLcpPreload(heroLcp);
    const logo = settings.nav?.logo_url || LANDING_MEDIA.logo;
    return {
      meta,
      links: [
        LANDING_STYLESHEET,
        ...links,
        ...(gridOn
          ? [
              {
                rel: "preload" as const,
                as: "image" as const,
                href: logo,
                fetchPriority: "high" as const,
              },
            ]
          : [
              {
                rel: "preload" as const,
                as: "image" as const,
                href: preload.href,
                fetchPriority: "high" as const,
                ...(preload.imageSrcSet
                  ? { imageSrcSet: preload.imageSrcSet, imageSizes: preload.imageSizes }
                  : {}),
              },
            ]),
      ],
    };
  },
  component: LandingPage,
});

function LandingPage() {
  const navigate = useNavigate();
  const [landingLang, setLandingLang] = useState<"bn" | "en">(readLandingLang);
  const [belowReady, setBelowReady] = useState(false);
  const loaderData = Route.useLoaderData();
  const settings: LandingSettings = loaderData?.settings ?? DEFAULT_LANDING_SETTINGS;
  const seo = loaderData?.seo ?? DEFAULT_SEO_SETTINGS;
  const showHero = settings.sections_enabled.hero !== false;

  const islamicList =
    settings.sections_enabled.islamic_carousel === false
      ? null
      : {
          name: landingLang === "bn" ? settings.islamic.title_bn : settings.islamic.title_en,
          description: landingLang === "bn" ? settings.islamic.body_bn : settings.islamic.body_en,
          quotes: activeIslamicCards(settings.islamic).map((item) => ({
            text: landingLang === "bn" ? item.quote_bn : item.quote_en,
            source: landingLang === "bn" ? item.source_bn : item.source_en,
            name: landingLang === "bn" ? item.theme_bn : item.theme_en,
            comment: landingLang === "bn" ? item.reflection_bn : item.reflection_en,
          })),
        };

  useEffect(() => {
    let cancelled = false;
    const reveal = () => {
      if (!cancelled) setBelowReady(true);
    };

    // Desktop: show full landing immediately (hero + sections + YouTube layout).
    if (window.matchMedia("(min-width: 768px)").matches) {
      reveal();
      return () => {
        cancelled = true;
      };
    }

    // Mobile: defer below-fold chunk so LCP stays fast.
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(reveal, { timeout: 3200 });
      return () => {
        cancelled = true;
        cancelIdleCallback(id);
      };
    }
    const t = window.setTimeout(reveal, 1800);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, []);

  useEffect(() => {
    if (!hasStoredAuthHint()) return;
    let cancelled = false;
    const t = window.setTimeout(() => {
      void import("@/integrations/supabase/client").then(async ({ supabase }) => {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        const s = data.session;
        if (s && !s.user?.is_anonymous) void navigate({ to: "/home" });
      });
    }, 600);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [navigate]);

  useEffect(() => {
    if (settings.enabled === false) void navigate({ to: "/auth", search: {} });
  }, [settings.enabled, navigate]);

  if (settings.enabled === false) return null;

  return (
    <LandingShell settings={settings}>
      {settings.sections_enabled.nav && (
        <LandingNav
          settings={settings}
          lang={landingLang}
          onToggleLang={() => {
            const next = landingLang === "bn" ? "en" : "bn";
            setLandingLang(next);
            try {
              window.localStorage.setItem("lang", next);
            } catch {
              /* ignore */
            }
          }}
        />
      )}
      <main>
        {showHero && <LandingHero settings={settings} lang={landingLang} />}
        {belowReady && (
          <Suspense fallback={<div className="min-h-[40vh]" aria-hidden />}>
            <LandingRestSections settings={settings} lang={landingLang} />
            <LandingSeoJsonLd seo={seo} lang={landingLang} faqs={[]} islamic={islamicList} />
          </Suspense>
        )}
      </main>
    </LandingShell>
  );
}
