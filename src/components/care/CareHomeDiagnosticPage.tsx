import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { FlaskConical, Home, Loader2, MapPin } from "lucide-react";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { CareHomeLocationPicker } from "@/components/care/CareHomeLocationPicker";
import { useI18n } from "@/lib/i18n";
import { formatCareMoney } from "@/lib/care-invoice";
import { offeringSalePrice } from "@/lib/care-lab-price";
import {
  searchHomeCollectionOfferings,
  resolveOrgImageUrl,
  type CareOffering,
} from "@/lib/care-lab-api";
import {
  fetchHomeCareFlags,
  loadCachedHomeLocation,
  type CareHomeLocation,
} from "@/lib/care-home-api";

type FacilityGroup = {
  orgId: string;
  name: string;
  nameBn: string | null;
  logo: string | null;
  offerings: CareOffering[];
  fromPrice: number;
};

export function CareHomeDiagnosticPage() {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [flagOn, setFlagOn] = useState<boolean | null>(null);
  const [loc, setLoc] = useState<CareHomeLocation | null>(() => loadCachedHomeLocation());
  const [editLoc, setEditLoc] = useState(!loadCachedHomeLocation());
  const [offerings, setOfferings] = useState<CareOffering[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    void fetchHomeCareFlags().then((f) =>
      setFlagOn(f.home_diagnostic || f.home_collection),
    );
  }, []);

  useEffect(() => {
    if (!loc || editLoc) return;
    setLoading(true);
    void searchHomeCollectionOfferings({
      districtId: loc.districtId,
      upazila: loc.upazila,
      q: q.trim() || undefined,
    })
      .then(setOfferings)
      .catch(() => setOfferings([]))
      .finally(() => setLoading(false));
  }, [loc, editLoc, q]);

  const groups = useMemo(() => {
    const map = new Map<string, FacilityGroup>();
    for (const o of offerings) {
      const org = o.org;
      if (!org?.id) continue;
      // v1: match patient district to org district
      if (loc?.districtId && org.district_id && org.district_id !== loc.districtId) continue;
      const g = map.get(org.id) ?? {
        orgId: org.id,
        name: org.name,
        nameBn: org.name_bn,
        logo: resolveOrgImageUrl(
          (org as { logo_url?: string | null }).logo_url,
          (org as { settings?: unknown }).settings,
        ),
        offerings: [],
        fromPrice: Infinity,
      };
      g.offerings.push(o);
      g.fromPrice = Math.min(g.fromPrice, offeringSalePrice(o));
      map.set(org.id, g);
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [offerings, loc?.districtId]);

  if (flagOn === false) {
    return (
      <div className="min-h-[50dvh] grid place-items-center px-4 text-sm text-muted-foreground text-center">
        {bn ? "হোম ডায়াগনস্টিক এখন বন্ধ আছে" : "Home Diagnostic is currently disabled"}
      </div>
    );
  }

  return (
    <div className="w-full min-h-dvh bg-gradient-to-b from-teal-50/80 via-background to-background">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur safe-top">
        <div className="flex items-center gap-2 px-3 py-2 max-w-2xl mx-auto w-full">
          <PageBackButton fallbackTo="/care" />
          <div className="h-8 w-8 rounded-xl bg-teal-100 text-teal-800 grid place-items-center">
            <FlaskConical className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate">
              {bn ? "হোম ডায়াগনস্টিক" : "Home Diagnostic"}
            </h1>
            <p className="text-[10px] text-muted-foreground truncate">
              {bn ? "বাড়ি থেকে স্যাম্পল কালেকশন" : "Home sample collection"}
            </p>
          </div>
        </div>
      </AutoHideHeader>

      <div className="px-3 py-4 max-w-2xl mx-auto space-y-4 pb-24">
        {editLoc || !loc ? (
          <CareHomeLocationPicker
            bn={bn}
            variant="home_diagnostic"
            initial={loc}
            onConfirm={(l) => {
              setLoc(l);
              setEditLoc(false);
            }}
          />
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditLoc(true)}
              className="w-full flex items-center gap-2 rounded-2xl border bg-card px-3 py-2.5 text-left"
            >
              <MapPin className="h-4 w-4 text-teal-700 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate">
                  {bn ? loc.districtNameBn || loc.districtName : loc.districtName} · {loc.upazila}
                </p>
                <p className="text-[11px] text-muted-foreground truncate">{loc.address}</p>
              </div>
              <span className="text-[10px] font-semibold text-teal-800 shrink-0">
                {bn ? "বদলান" : "Change"}
              </span>
            </button>

            <input
              className="w-full rounded-xl border bg-card px-3 py-2 text-sm"
              placeholder={bn ? "টেস্ট খুঁজুন…" : "Search tests…"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            {loading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
              </div>
            ) : !groups.length ? (
              <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
                {bn
                  ? "এই এলাকায় হোম কালেকশন ল্যাব পাওয়া যায়নি"
                  : "No home-collection labs in this area"}
              </div>
            ) : (
              <ul className="space-y-2">
                {groups.map((g) => {
                  const name = bn ? g.nameBn || g.name : g.name;
                  return (
                    <li key={g.orgId}>
                      <Link
                        to="/care/labs/$orgId"
                        params={{ orgId: g.orgId }}
                        search={{ home: "1" }}
                        className="flex gap-3 rounded-2xl border bg-card p-3 hover:border-teal-300 transition-colors"
                      >
                        <div className="h-14 w-14 rounded-xl overflow-hidden bg-muted shrink-0 grid place-items-center">
                          {g.logo ? (
                            <img src={g.logo} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Home className="h-5 w-5 text-teal-700" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">{name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {g.offerings.length}{" "}
                            {bn ? "হোম টেস্ট" : "home tests"}
                            {Number.isFinite(g.fromPrice)
                              ? ` · ${bn ? "থেকে" : "from"} ${formatCareMoney(g.fromPrice, lang)}`
                              : ""}
                          </p>
                          <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wide text-teal-800 bg-teal-50 border border-teal-200 rounded-full px-2 py-0.5">
                            Home
                          </span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
