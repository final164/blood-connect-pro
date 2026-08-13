import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { LandingSettings } from "@/lib/landing-settings";
import {
  DEFAULT_LANDING_CONTENT,
  fetchLandingContentOnly,
  fetchLandingLiveCounts,
  type LandingContentBundle,
} from "@/lib/landing-content";
import { renderLandingSection } from "@/components/landing/LandingSections";
import { createAppQueryClient } from "@/lib/query-client";

const PLACEHOLDER: LandingContentBundle = {
  ...DEFAULT_LANDING_CONTENT,
  liveRequestCount: null,
  liveDonorCount: null,
};

/** Below-hero landing body — own chunk; fetches CMS after hero LCP. */
function LandingRestSectionsInner({
  settings,
  lang,
}: {
  settings: LandingSettings;
  lang: "bn" | "en";
}) {
  const contentQ = useQuery({
    queryKey: ["landing-content"],
    queryFn: () => fetchLandingContentOnly(),
    staleTime: 60_000,
    placeholderData: PLACEHOLDER,
    refetchOnWindowFocus: false,
  });
  const countsQ = useQuery({
    queryKey: ["landing-live-counts"],
    queryFn: () => fetchLandingLiveCounts(),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  const content: LandingContentBundle = {
    ...(contentQ.data ?? PLACEHOLDER),
    liveRequestCount: countsQ.data?.liveRequestCount ?? null,
    liveDonorCount: countsQ.data?.liveDonorCount ?? null,
  };

  return (
    <>
      {settings.section_order.map((id) => {
        if (id === "nav" || id === "hero") return null;
        return renderLandingSection(id, { settings, content, lang });
      })}
    </>
  );
}

/** Below-hero landing body — own chunk; fetches CMS after hero LCP. */
export function LandingRestSections(props: {
  settings: LandingSettings;
  lang: "bn" | "en";
}) {
  const [queryClient] = useState(() => createAppQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <LandingRestSectionsInner {...props} />
    </QueryClientProvider>
  );
}
