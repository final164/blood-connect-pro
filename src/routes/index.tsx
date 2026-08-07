import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_LANDING_SETTINGS,
  activeIslamicCards,
  fetchLandingSettings,
  fetchLandingSettingsForLoader,
  type LandingSettings,
} from "@/lib/landing-settings";
import {
  DEFAULT_SEO_SETTINGS,
  buildHead,
  fetchSeoSettings,
  fetchSeoSettingsForLoader,
} from "@/lib/seo-settings";
import {
  fetchLandingContentOnly,
  fetchLandingLiveCounts,
  DEFAULT_LANDING_CONTENT,
  type LandingContentBundle,
} from "@/lib/landing-content";
import { LandingShell } from "@/components/landing/LandingShell";
import { LandingNav } from "@/components/landing/LandingNav";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingSeoJsonLd, SeoHeadUpdater } from "@/components/SeoHead";
import { LANDING_MEDIA } from "@/lib/landing-media";
import { ensureHeroSlides } from "@/components/landing/HeroBackgroundSlideshow";

const LandingRestSections = lazy(() =>
  import("@/components/landing/LandingRestSections").then((m) => ({
    default: m.LandingRestSections,
  })),
);

const PLACEHOLDER_CONTENT: LandingContentBundle = {
  ...DEFAULT_LANDING_CONTENT,
  liveRequestCount: null,
  liveDonorCount: null,
};

/** Sync hint: known session in storage → soft-redirect without blocking anonymous paint. */
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

export const Route = createFileRoute("/")({
  loader: async () => {
    // Race CMS SEO/settings (~120ms max) so crawlers get real meta when warm/fast,
    // but anonymous users never wait on a slow Supabase RTT.
    const [seo, settings] = await Promise.all([
      fetchSeoSettingsForLoader(120),
      fetchLandingSettingsForLoader(120),
    ]);
    return { seo, settings };
  },
  head: ({ loaderData }) => {
    const seo = loaderData?.seo ?? DEFAULT_SEO_SETTINGS;
    const settings = loaderData?.settings ?? DEFAULT_LANDING_SETTINGS;
    const { meta, links } = buildHead(seo, "bn");
    const heroLcp =
      ensureHeroSlides(settings.hero?.background_images, settings.hero?.background_url)[0] ||
      LANDING_MEDIA.hero;
    return {
      meta,
      links: [...links, { rel: "preload", as: "image", href: heroLcp }],
    };
  },
  component: LandingPage,
});

function LandingPage() {
  const { session, loading, isAnonymous } = useAuth();
  const { lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [landingLang, setLandingLang] = useState<"bn" | "en">(lang);
  const [authHint] = useState(hasStoredAuthHint);
  const loaderData = Route.useLoaderData();

  const settingsQ = useQuery({
    queryKey: ["landing-settings"],
    queryFn: () => fetchLandingSettings(),
    staleTime: 60_000,
    initialData: loaderData.settings,
    placeholderData: DEFAULT_LANDING_SETTINGS,
  });

  const seoQ = useQuery({
    queryKey: ["seo-settings"],
    queryFn: () => fetchSeoSettings(),
    staleTime: 60_000,
    initialData: loaderData.seo,
  });

  const contentQ = useQuery({
    queryKey: ["landing-content"],
    queryFn: () => fetchLandingContentOnly(),
    staleTime: 60_000,
    placeholderData: PLACEHOLDER_CONTENT,
  });

  const countsQ = useQuery({
    queryKey: ["landing-live-counts"],
    queryFn: () => fetchLandingLiveCounts(),
    staleTime: 60_000,
  });

  const settings: LandingSettings = settingsQ.data ?? DEFAULT_LANDING_SETTINGS;
  const seo = seoQ.data ?? DEFAULT_SEO_SETTINGS;
  const content: LandingContentBundle = {
    ...(contentQ.data ?? PLACEHOLDER_CONTENT),
    liveRequestCount: countsQ.data?.liveRequestCount ?? null,
    liveDonorCount: countsQ.data?.liveDonorCount ?? null,
  };
  const faqSchemaItems = content.faqs.map((item) => ({
    question: landingLang === "bn" ? item.question_bn : item.question_en,
    answer: landingLang === "bn" ? item.answer_bn : item.answer_en,
  }));
  const islamicList =
    settings.sections_enabled.islamic_carousel === false
      ? null
      : {
          name:
            landingLang === "bn"
              ? settings.islamic.title_bn
              : settings.islamic.title_en,
          description:
            landingLang === "bn"
              ? settings.islamic.body_bn
              : settings.islamic.body_en,
          quotes: activeIslamicCards(settings.islamic).map((item) => ({
            text: landingLang === "bn" ? item.quote_bn : item.quote_en,
            source: landingLang === "bn" ? item.source_bn : item.source_en,
            name: landingLang === "bn" ? item.theme_bn : item.theme_en,
            comment:
              landingLang === "bn" ? item.reflection_bn : item.reflection_en,
          })),
        };
  const loggedIn = !loading && !!session && !isAnonymous;
  const showHero = settings.sections_enabled.hero !== false;

  useEffect(() => {
    setLandingLang(lang);
  }, [lang]);

  useEffect(() => {
    if (loggedIn) {
      void navigate({ to: "/home" });
    }
  }, [loggedIn, navigate]);

  useEffect(() => {
    if (settingsQ.isLoading || loggedIn) return;
    if (settings.enabled === false) {
      void navigate({ to: "/auth" });
    }
  }, [settings.enabled, settingsQ.isLoading, loggedIn, navigate]);

  if (loggedIn || (authHint && loading)) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#F7F3F0]">
        <div className="h-8 w-8 rounded-full border-2 border-[#C1121F] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (settingsQ.isFetched && settings.enabled === false) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#F7F3F0]">
        <div className="h-8 w-8 rounded-full border-2 border-[#C1121F] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (settingsQ.isFetched && !settings.enabled) {
    return null;
  }

  return (
    <LandingShell settings={settings}>
      <SeoHeadUpdater seo={seo} lang={landingLang} />
      <LandingSeoJsonLd
        seo={seo}
        lang={landingLang}
        faqs={faqSchemaItems}
        islamic={islamicList}
      />
      {settings.sections_enabled.nav && (
        <LandingNav
          settings={settings}
          lang={landingLang}
          onToggleLang={() => {
            const next = landingLang === "bn" ? "en" : "bn";
            setLandingLang(next);
            setLang(next);
          }}
        />
      )}
      <main>
        {showHero && <LandingHero settings={settings} lang={landingLang} />}
        <Suspense fallback={<div className="min-h-[40vh]" aria-hidden />}>
          <LandingRestSections settings={settings} content={content} lang={landingLang} />
        </Suspense>
      </main>
    </LandingShell>
  );
}
