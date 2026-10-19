import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { APP_STYLESHEET } from "@/lib/app-stylesheet";
import {
  fetchCommunityOrgPublicProfile,
  type CommunityOrgBranding,
} from "@/lib/community-org-branding";
import { countOrgDonors, countOrgOpenRequests } from "@/lib/org-access";
import { OrgPublicCard } from "@/components/org/OrgBrandingPanel";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/org_/public/$orgId")({
  head: () => ({
    meta: [{ title: "Organization — Muktosheba" }],
    links: [APP_STYLESHEET],
  }),
  component: OrgPublicPage,
});

function OrgPublicPage() {
  const { orgId } = Route.useParams();
  const { lang } = useI18n();
  const [org, setOrg] = useState<CommunityOrgBranding | null>(null);
  const [donorCount, setDonorCount] = useState(0);
  const [openReqCount, setOpenReqCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const profile = await fetchCommunityOrgPublicProfile(orgId);
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
  }, [orgId, lang]);

  const name = org
    ? lang === "bn"
      ? org.name_bn || org.name
      : org.name
    : "";

  return (
    <div className="min-h-dvh bg-linear-to-b from-rose-50/80 via-background to-background dark:from-rose-950/20">
      <header className="sticky top-0 z-10 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <Link
            to="/home"
            className="grid h-9 w-9 place-items-center rounded-xl border text-muted-foreground hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {lang === "bn" ? "পাবলিক প্রোফাইল" : "Public profile"}
            </p>
            <p className="truncate text-sm font-bold">{name || "…"}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-3 py-4 pb-16">
        {loading && (
          <div className="grid place-items-center py-20 text-xs text-muted-foreground">
            {lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}
          </div>
        )}
        {error && !loading && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-6 text-center text-sm">
            {error}
          </div>
        )}
        {org && !loading && (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <OrgPublicCard
              name={name}
              description={
                lang === "bn"
                  ? org.description_bn || org.description
                  : org.description
              }
              logoUrl={org.logo_url}
              coverUrl={org.cover_url}
              phone={org.phone}
              verified={!!org.is_verified}
              donorCount={donorCount}
              openRequestCount={openReqCount}
              lang={lang}
            />
          </div>
        )}
      </main>
    </div>
  );
}
