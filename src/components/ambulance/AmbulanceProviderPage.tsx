import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Ambulance } from "lucide-react";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { fetchOrgOfferings } from "@/lib/ambulance-api";
import { fetchAmbulanceServiceTypes } from "@/lib/ambulance-cms";

export function AmbulanceProviderPage({ orgId }: { orgId: string }) {
  const { lang } = useI18n();
  const [org, setOrg] = useState<Record<string, unknown> | null>(null);
  const [offerings, setOfferings] = useState<Awaited<ReturnType<typeof fetchOrgOfferings>>>([]);
  const [types, setTypes] = useState<Awaited<ReturnType<typeof fetchAmbulanceServiceTypes>>>([]);

  useEffect(() => {
    void supabase.from("care_orgs").select("id, name, name_bn, phone, address, upazila, description, description_bn").eq("id", orgId).maybeSingle().then(({ data }) => setOrg(data as Record<string, unknown>));
    void fetchOrgOfferings(orgId).then(setOfferings);
    void fetchAmbulanceServiceTypes().then(setTypes);
  }, [orgId]);

  const name = org ? String(lang === "bn" ? org.name_bn || org.name : org.name) : "…";

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <Link to="/ambulance" className="h-9 w-9 rounded-xl grid place-items-center hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm font-bold truncate">{name}</h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-4 max-w-lg mx-auto space-y-4">
        <div className="flex gap-3 items-start">
          <span className="h-12 w-12 rounded-xl bg-orange-600/10 text-orange-700 grid place-items-center shrink-0">
            <Ambulance className="h-6 w-6" />
          </span>
          <div>
            <p className="font-bold">{name}</p>
            <p className="text-xs text-muted-foreground">{[org?.upazila, org?.phone].filter(Boolean).join(" · ")}</p>
            {org?.address ? <p className="text-xs text-muted-foreground mt-1">{String(org.address)}</p> : null}
          </div>
        </div>
        {offerings.length > 0 && (
          <ul className="space-y-2">
            {offerings.map((o) => {
              const t = types.find((x) => x.id === o.service_type_id);
              return (
                <li key={o.id} className="rounded-xl border px-3 py-2 text-sm">
                  {lang === "bn" ? t?.name_bn : t?.name_en} · ৳{o.base_price} + ৳{o.per_km_price}/km
                </li>
              );
            })}
          </ul>
        )}
        <div className="grid gap-2 sm:grid-cols-2">
          <Link to="/ambulance/request" search={{ mode: "emergency", orgId }} className="rounded-xl bg-red-600 text-white py-3 text-center text-sm font-bold">
            {lang === "bn" ? "জরুরি বুক" : "Emergency"}
          </Link>
          <Link to="/ambulance/request" search={{ mode: "scheduled", orgId }} className="rounded-xl border py-3 text-center text-sm font-bold">
            {lang === "bn" ? "শিডিউল বুক" : "Schedule"}
          </Link>
        </div>
      </div>
    </div>
  );
}
