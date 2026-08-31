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
import { fetchGuestBrowseEnabled } from "@/lib/guest-browse-settings";
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
    const heroLcp =
      ensureHeroSlides(settings.hero?.background_images, settings.hero?.background_url)[0] ||
      LANDING_MEDIA.hero;
    const preload = heroLcpPreload(heroLcp);
    return {
      meta,
      links: [
        LANDING_STYLESHEET,
        ...links,
        {
          rel: "preload" as const,
          as: "image" as const,
          href: preload.href,
          fetchPriority: "high" as const,
          ...(preload.imageSrcSet
            ? { imageSrcSet: preload.imageSrcSet, imageSizes: preload.imageSizes }
            : {}),
        },
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

    const schedule = () => {
      const desktop = window.matchMedia("(min-width: 768px)").matches;
      // Wait for idle after load so LCP image wins the network on Slow 4G.
      if (typeof requestIdleCallback === "function") {
        const id = requestIdleCallback(reveal, { timeout: desktop ? 900 : 4200 });
        return () => cancelIdleCallback(id);
      }
      const t = window.setTimeout(reveal, desktop ? 450 : 2200);
      return () => window.clearTimeout(t);
    };

    let cancelSchedule: (() => void) | undefined;
    const onReady = () => {
      cancelSchedule = schedule();
    };

    if (document.readyState === "complete") {
      onReady();
    } else {
      window.addEventListener("load", onReady, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", onReady);
      cancelSchedule?.();
    };
  }, []);

  useEffect(() => {
    if (settings.enabled === false) void navigate({ to: "/auth", search: {} });
  }, [settings.enabled, navigate]);

  useEffect(() => {
    void fetchGuestBrowseEnabled();
  }, []);

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
