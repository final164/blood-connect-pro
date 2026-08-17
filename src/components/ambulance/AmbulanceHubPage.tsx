import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Ambulance, ArrowLeft, Siren, CalendarClock } from "lucide-react";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { useI18n } from "@/lib/i18n";
import type { District } from "@/lib/api";
import { fetchListedAmbulanceProviders, fetchMyAmbulanceRequests } from "@/lib/ambulance-api";
import { fetchAmbulanceServiceTypes } from "@/lib/ambulance-cms";
import { fetchAmbulanceSettings } from "@/lib/ambulance-settings";
import { useAuth } from "@/lib/auth-context";

export function AmbulanceHubPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const [district, setDistrict] = useState<District | null>(null);
  const [providers, setProviders] = useState<Awaited<ReturnType<typeof fetchListedAmbulanceProviders>>>([]);
  const [types, setTypes] = useState<Awaited<ReturnType<typeof fetchAmbulanceServiceTypes>>>([]);
  const [settings, setSettings] = useState<Awaited<ReturnType<typeof fetchAmbulanceSettings>> | null>(null);
  const [myReqs, setMyReqs] = useState<Awaited<ReturnType<typeof fetchMyAmbulanceRequests>>>([]);

  useEffect(() => {
    void fetchAmbulanceSettings().then(setSettings);
    void fetchAmbulanceServiceTypes().then(setTypes);
    if (user) void fetchMyAmbulanceRequests().then(setMyReqs);
  }, [user]);

  useEffect(() => {
    void fetchListedAmbulanceProviders(district?.id).then(setProviders);
  }, [district?.id]);

  const labels = settings?.labels;

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <Link to="/care" search={{ tab: "ambulance" }} className="h-9 w-9 rounded-xl grid place-items-center hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm font-bold">{labels ? (lang === "bn" ? labels.hub_title_bn : labels.hub_title_en) : lang === "bn" ? "অ্যাম্বুলেন্স" : "Ambulance"}</h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-4 max-w-2xl mx-auto space-y-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {settings?.features.emergency_enabled !== false && (
            <Link to="/ambulance/request" search={{ mode: "emergency" }} className="rounded-2xl bg-red-600 text-white p-4 flex items-center gap-3 shadow-md">
              <Siren className="h-8 w-8 shrink-0" />
              <div>
                <p className="font-bold">{labels ? (lang === "bn" ? labels.emergency_cta_bn : labels.emergency_cta_en) : lang === "bn" ? "জরুরি" : "Emergency"}</p>
                <p className="text-xs opacity-90">{lang === "bn" ? "এখনই অ্যাম্বুলেন্স" : "Ambulance now"}</p>
              </div>
            </Link>
          )}
          {settings?.features.scheduled_enabled !== false && (
            <Link to="/ambulance/request" search={{ mode: "scheduled" }} className="rounded-2xl border bg-card p-4 flex items-center gap-3">
              <CalendarClock className="h-8 w-8 text-primary shrink-0" />
              <div>
                <p className="font-bold">{labels ? (lang === "bn" ? labels.scheduled_cta_bn : labels.scheduled_cta_en) : lang === "bn" ? "শিডিউল" : "Schedule"}</p>
                <p className="text-xs text-muted-foreground">{lang === "bn" ? "আগে থেকে বুক" : "Book ahead"}</p>
              </div>
            </Link>
          )}
        </div>

        {myReqs.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-xs font-bold uppercase text-muted-foreground">{lang === "bn" ? "আমার রিকোয়েস্ট" : "My requests"}</h2>
            <ul className="space-y-2">
              {myReqs.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link to="/ambulance/request/$id" params={{ id: r.id }} className="block rounded-xl border px-3 py-2 text-sm hover:bg-muted/40">
                    <span className="font-mono font-bold text-orange-700">{r.reference_code}</span>
                    <span className="text-muted-foreground ml-2">{r.status}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <DistrictTypeahead value={district} onChange={setDistrict} placeholder={lang === "bn" ? "জেলা" : "District"} />

        <section className="space-y-2">
          <h2 className="text-xs font-bold uppercase text-muted-foreground">{lang === "bn" ? "প্রোভাইডার" : "Providers"}</h2>
          {providers.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">{lang === "bn" ? "কোনো প্রোভাইডার নেই" : "No providers"}</p>
          ) : (
            <ul className="space-y-2">
              {providers.map((p) => (
                <li key={p.id}>
                  <Link to="/ambulance/provider/$orgId" params={{ orgId: p.id }} className="flex gap-3 rounded-2xl border bg-card p-3 hover:bg-muted/30">
                    <span className="h-10 w-10 rounded-xl bg-orange-600/10 text-orange-700 grid place-items-center shrink-0">
                      <Ambulance className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold truncate">{lang === "bn" ? p.name_bn || p.name : p.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{[p.upazila, p.phone].filter(Boolean).join(" · ")}</p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {types.length > 0 && (
          <p className="text-[11px] text-muted-foreground text-center">
            {lang === "bn" ? "সার্ভিস:" : "Services:"}{" "}
            {types.filter((t) => t.is_active).map((t) => (lang === "bn" ? t.name_bn : t.name_en)).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}
