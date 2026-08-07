import type { LandingSettings } from "@/lib/landing-settings";
import type { LandingContentBundle } from "@/lib/landing-content";
import { renderLandingSection } from "@/components/landing/LandingSections";

/** Below-hero landing body — separate chunk from critical hero/nav. */
export function LandingRestSections({
  settings,
  content,
  lang,
}: {
  settings: LandingSettings;
  content: LandingContentBundle;
  lang: "bn" | "en";
}) {
  return (
    <>
      {settings.section_order.map((id) => {
        if (id === "nav" || id === "hero") return null;
        return renderLandingSection(id, { settings, content, lang });
      })}
    </>
  );
}
