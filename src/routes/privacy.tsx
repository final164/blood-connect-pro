import { createFileRoute } from "@tanstack/react-router";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import { loadLegalPages } from "@/lib/legal-page-data";
import { DEFAULT_LEGAL_SETTINGS, legalDocTitle } from "@/lib/legal-settings";
import { DEFAULT_SEO_SETTINGS, absoluteUrl } from "@/lib/seo-settings";
import { LegalPageDisabled, LegalPageView } from "@/components/legal/LegalPageView";

export const Route = createFileRoute("/privacy")({
  loader: () => loadLegalPages(),
  head: ({ loaderData }) => {
    const seo = loaderData?.seo ?? DEFAULT_SEO_SETTINGS;
    const legal = loaderData?.legal ?? DEFAULT_LEGAL_SETTINGS;
    const title = `${legalDocTitle(legal.privacy, "bn")} — ${seo.org_name || "Muktosheba"}`;
    const description = legal.privacy.intro_bn.slice(0, 180);
    const canonical = absoluteUrl("/privacy", seo, loaderData?.origin ?? "");
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        ...(canonical ? [{ property: "og:url" as const, content: canonical }] : []),
      ],
      links: [
        APP_STYLESHEET,
        ...(canonical ? [{ rel: "canonical" as const, href: canonical }] : []),
      ],
    };
  },
  component: PrivacyPage,
});

function PrivacyPage() {
  const { legal } = Route.useLoaderData();

  if (!legal.privacy.enabled) return <LegalPageDisabled />;

  return (
    <LegalPageView
      doc={legal.privacy}
      legal={legal}
      otherHref="/terms"
      otherLabelBn="সেবার শর্তাবলী দেখুন →"
      otherLabelEn="Read the Terms of Service →"
    />
  );
}
