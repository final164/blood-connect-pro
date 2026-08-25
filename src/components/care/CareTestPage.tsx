import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { fetchOffering } from "@/lib/care-lab-api";

/** Legacy single-test URL → clinic multi-select with this offering pre-selected. */
export function CareTestPage({ offeringId }: { offeringId: string }) {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetchOffering(offeringId).then((o) => {
      if (cancelled) return;
      if (!o?.org_id) {
        setMissing(true);
        return;
      }
      void navigate({
        to: "/care/labs/$orgId",
        params: { orgId: o.org_id },
        search: { select: offeringId },
        replace: true,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [offeringId, navigate]);

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton
            fallbackTo={{ to: "/care", search: { tab: "tests" } }}
            shape="xl"
          />
          <h1 className="text-sm font-bold truncate">
            {lang === "bn" ? "টেস্ট" : "Test"}
          </h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-8 max-w-2xl mx-auto text-center text-sm text-muted-foreground">
        {missing
          ? lang === "bn"
            ? "টেস্ট পাওয়া যায়নি"
            : "Test not found"
          : lang === "bn"
            ? "ক্লিনিকে নিয়ে যাওয়া হচ্ছে…"
            : "Opening clinic…"}
      </div>
    </div>
  );
}
