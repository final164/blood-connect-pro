import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Share2 } from "lucide-react";
import { toast } from "sonner";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import {
  communityOrgPublicUrl,
  fetchCommunityOrgPublicProfile,
  type CommunityOrgBranding,
} from "@/lib/community-org-branding";
import { parseOrgPortalContent } from "@/lib/community-org-portal";
import { countOrgDonors, countOrgOpenRequests } from "@/lib/org-access";
import { OrgPublicProfile } from "@/components/org/OrgPublicProfile";
import { useI18n } from "@/lib/i18n";
import { DEFAULT_SEO_SETTINGS, absoluteUrl } from "@/lib/seo-settings";

export const Route = createFileRoute("/org_/public/$orgId")({
  loader: async ({ params }) => {
    try {
      const profile = await fetchCommunityOrgPublicProfile(params.orgId);
      return { profile };
    } catch {
      return { profile: null as CommunityOrgBranding | null };
    }
  },
  head: ({ loaderData, params }) => {
    const profile = loaderData?.profile;
    const portal = parseOrgPortalContent(profile?.portal_content);
    const name =
      profile?.name_bn || profile?.name || "Organization";
    const desc =
      (portal.about_bn ||
        portal.about_en ||
        profile?.description_bn ||
        profile?.description ||
        "স্পন্দন — রক্তদান সংস্থা · spandonbd.com"
      ).slice(0, 180);
    const ogImage =
      profile?.cover_url ||
      profile?.logo_url ||
      DEFAULT_SEO_SETTINGS.og_image_url;
    const canonical = absoluteUrl(
      `/org/public/${params.orgId}`,
      DEFAULT_SEO_SETTINGS,
      "https://spandonbd.com",
    );
    const title = `${name} — স্পন্দন`;
    return {
      meta: [
        { title },
        { name: "description", content: desc },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: title },
        { property: "og:description", content: desc },
        { property: "og:type", content: "website" },
        { property: "og:image", content: ogImage },
        ...(canonical ? [{ property: "og:url" as const, content: canonical }] : []),
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: desc },
        { name: "twitter:image", content: ogImage },
      ],
      links: [
        APP_STYLESHEET,
        ...(canonical ? [{ rel: "canonical" as const, href: canonical }] : []),
      ],
    };
  },
  component: OrgPublicPage,
});

function OrgPublicPage() {
  const { orgId } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const { lang } = useI18n();
  const [org, setOrg] = useState<CommunityOrgBranding | null>(
    loaderData?.profile ?? null,
  );
  const [donorCount, setDonorCount] = useState(0);
  const [openReqCount, setOpenReqCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!loaderData?.profile);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!org) setLoading(true);
      setError(null);
      try {
        const profile =
          org && org.id === orgId
            ? org
            : await fetchCommunityOrgPublicProfile(orgId);
        if (cancelled) return;
        if (!profile) {
          setError(lang === "bn" ? "সংস্থা পাওয়া যায়নি" : "Organization not found");
          setOrg(null);
          return;
        }
        setOrg(profile);
        const [donors, open] = await Promise.all([
          countOrgDonors(orgId),
          countOrgOpenRequests(orgId),
        ]);
        if (cancelled) return;
        setDonorCount(donors);
        setOpenReqCount(open);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh on orgId / lang only
  }, [orgId, lang]);

  const portal = useMemo(
    () => parseOrgPortalContent(org?.portal_content),
    [org?.portal_content],
  );

  const name = org
    ? lang === "bn"
      ? org.name_bn || org.name
      : org.name
    : "";

  const about =
    (lang === "bn" ? portal.about_bn || org?.description_bn : portal.about_en || org?.description) ||
    org?.description_bn ||
    org?.description ||
    null;

  const welcome =
    lang === "bn"
      ? portal.advanced.welcome_bn || portal.advanced.welcome_en
      : portal.advanced.welcome_en || portal.advanced.welcome_bn;

  async function shareOrg() {
    if (!org) return;
    const url = communityOrgPublicUrl(org.id);
    try {
      if (navigator.share) {
        await navigator.share({
          title: name,
          text: about || welcome || name,
          url,
        });
        return;
      }
    } catch {
      /* cancelled */
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(lang === "bn" ? "লিংক কপি হয়েছে" : "Link copied");
    } catch {
      toast.error(lang === "bn" ? "শেয়ার ব্যর্থ" : "Share failed");
    }
  }

  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-background text-foreground">
      {/* Soft page atmosphere */}
      <div
        className="pointer-events-none fixed inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% -15%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 60%), linear-gradient(180deg, color-mix(in srgb, var(--primary) 4%, var(--background)), var(--background) 40%)",
        }}
      />

      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link
            to="/"
            className="grid h-9 w-9 place-items-center rounded-xl border bg-card text-muted-foreground transition hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {lang === "bn" ? "পাবলিক প্রোফাইল" : "Public profile"}
            </p>
            <p className="truncate text-sm font-bold">{name || "…"}</p>
          </div>
          {org && (
            <button
              type="button"
              onClick={() => void shareOrg()}
              className="inline-flex items-center gap-1.5 rounded-xl border bg-card px-3 py-2 text-xs font-semibold hover:bg-muted"
            >
              <Share2 className="h-3.5 w-3.5" />
              {lang === "bn" ? "শেয়ার" : "Share"}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-lg pb-16">
        {loading && (
          <div className="space-y-4 px-4 py-6">
            <div className="h-52 animate-pulse rounded-none bg-muted" />
            <div className="-mt-10 flex gap-4 px-1">
              <div className="h-24 w-24 animate-pulse rounded-[1.35rem] bg-muted" />
              <div className="flex-1 space-y-2 pt-10">
                <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </div>
        )}
        {error && !loading && (
          <div className="mx-3 mt-8 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-8 text-center text-sm">
            {error}
          </div>
        )}
        {org && !loading && (
          <div className="overflow-hidden border-x border-border/40 bg-card/40 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.35)] sm:mx-0 sm:mt-0 sm:rounded-none md:mx-0">
            <OrgPublicProfile
              name={name}
              description={about}
              welcome={welcome || null}
              logoUrl={org.logo_url}
              coverUrl={org.cover_url}
              phone={portal.advanced.show_phone_public ? org.phone : null}
              email={org.email}
              website={org.website}
              verified={portal.advanced.highlight_verified_badge && !!org.is_verified}
              donorCount={
                portal.advanced.show_donor_count_public ? donorCount : undefined
              }
              openRequestCount={
                portal.advanced.show_open_requests_public ? openReqCount : undefined
              }
              faqs={portal.faqs}
              lang={lang}
              variant="full"
              onShare={() => void shareOrg()}
            />
          </div>
        )}
      </main>
    </div>
  );
}
