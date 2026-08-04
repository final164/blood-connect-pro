import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import {
  DEFAULT_LANDING_SETTINGS,
  fetchLandingSettings,
  type LandingSettings,
} from "@/lib/landing-settings";
import { DEFAULT_SEO_SETTINGS, buildHead, fetchSeoSettings } from "@/lib/seo-settings";
import { fetchLandingContentBundle, type LandingContentBundle } from "@/lib/landing-content";
import { LandingShell } from "@/components/landing/LandingShell";
import { LandingNav } from "@/components/landing/LandingNav";
import { renderLandingSection } from "@/components/landing/LandingSections";
import { LandingSeoJsonLd, SeoHeadUpdater } from "@/components/SeoHead";

const EMPTY_CONTENT: LandingContentBundle = {
  stats: [],
  cards: [],
  carousel: [],
  stories: [],
  campaigns: [],
  gallery: [],
  faqs: [],
  communityCards: [],
  liveRequestCount: null,
};

export const Route = createFileRoute("/")({
  loader: async () => {
    const seo = await fetchSeoSettings();
    return { seo };
  },
  head: ({ loaderData }) => {
    const seo = loaderData?.seo ?? DEFAULT_SEO_SETTINGS;
    const { meta, links } = buildHead(seo, "bn");
    return { meta, links };
  },
  component: LandingPage,
});

function LandingPage() {
  const { session, loading, isAnonymous } = useAuth();
  const { lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [landingLang, setLandingLang] = useState<"bn" | "en">(lang);
  const { seo: loaderSeo } = Route.useLoaderData();

  const settingsQ = useQuery({
    queryKey: ["landing-settings"],
    queryFn: () => fetchLandingSettings(),
    staleTime: 60_000,
  });

  const seoQ = useQuery({
    queryKey: ["seo-settings"],
    queryFn: () => fetchSeoSettings(),
    staleTime: 60_000,
    initialData: loaderSeo,
  });

  const contentQ = useQuery({
    queryKey: ["landing-content"],
    queryFn: () => fetchLandingContentBundle(),
    staleTime: 60_000,
  });

  const settings: LandingSettings = settingsQ.data ?? DEFAULT_LANDING_SETTINGS;
  const seo = seoQ.data ?? DEFAULT_SEO_SETTINGS;
  const content = contentQ.data ?? EMPTY_CONTENT;
  const faqSchemaItems = content.faqs.map((item) => ({
    question: landingLang === "bn" ? item.question_bn : item.question_en,
    answer: landingLang === "bn" ? item.answer_bn : item.answer_en,
  }));
  const loggedIn = !loading && !!session && !isAnonymous;

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

  if (loading || loggedIn || settingsQ.isLoading || !settings.enabled) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#F7F3F0]">
        <div className="h-8 w-8 rounded-full border-2 border-[#C1121F] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <LandingShell settings={settings}>
      <SeoHeadUpdater seo={seo} lang={landingLang} />
      <LandingSeoJsonLd seo={seo} lang={landingLang} faqs={faqSchemaItems} />
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
        {settings.section_order.map((id) =>
          renderLandingSection(id, { settings, content, lang: landingLang }),
        )}
      </main>
    </LandingShell>
  );
}
