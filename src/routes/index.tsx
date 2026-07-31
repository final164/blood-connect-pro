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
import {
  fetchLandingContentBundle,
  type LandingContentBundle,
} from "@/lib/landing-content";
import { LandingShell } from "@/components/landing/LandingShell";
import { LandingNav } from "@/components/landing/LandingNav";
import { renderLandingSection } from "@/components/landing/LandingSections";

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
  head: () => ({
    meta: [
      { title: DEFAULT_LANDING_SETTINGS.seo.title_bn },
      { name: "description", content: DEFAULT_LANDING_SETTINGS.seo.description_bn },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  const { session, loading, isAnonymous } = useAuth();
  const { lang, setLang } = useI18n();
  const navigate = useNavigate();
  const [landingLang, setLandingLang] = useState<"bn" | "en">(lang);

  const settingsQ = useQuery({
    queryKey: ["landing-settings"],
    queryFn: () => fetchLandingSettings(),
    staleTime: 60_000,
  });

  const contentQ = useQuery({
    queryKey: ["landing-content"],
    queryFn: () => fetchLandingContentBundle(),
    staleTime: 60_000,
  });

  const settings: LandingSettings = settingsQ.data ?? DEFAULT_LANDING_SETTINGS;
  const content = contentQ.data ?? EMPTY_CONTENT;
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

  const seoTitle = landingLang === "bn" ? settings.seo.title_bn : settings.seo.title_en;

  useEffect(() => {
    if (typeof document !== "undefined") document.title = seoTitle;
  }, [seoTitle]);

  if (loading || loggedIn || settingsQ.isLoading || !settings.enabled) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[#F7F3F0]">
        <div className="h-8 w-8 rounded-full border-2 border-[#C1121F] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <LandingShell settings={settings}>
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
