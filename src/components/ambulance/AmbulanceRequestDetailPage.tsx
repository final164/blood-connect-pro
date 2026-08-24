import { useCallback, useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { fetchAmbulanceRequest, fetchRequestEvents, subscribeAmbulanceRequest } from "@/lib/ambulance-api";
import { fetchAmbulanceRequestStatuses } from "@/lib/ambulance-cms";
import { CareAmbulanceInvoiceCard } from "@/components/care/CareAmbulanceInvoice";
import { CareLabPriceDisplay } from "@/components/care/CareLabPriceDisplay";
import { formatCareMoney } from "@/lib/care-invoice";

export function AmbulanceRequestDetailPage({ requestId }: { requestId: string }) {
  const { lang } = useI18n();
  const [row, setRow] = useState<Awaited<ReturnType<typeof fetchAmbulanceRequest>>>(null);
  const [events, setEvents] = useState<Awaited<ReturnType<typeof fetchRequestEvents>>>([]);
  const [statuses, setStatuses] = useState<Awaited<ReturnType<typeof fetchAmbulanceRequestStatuses>>>([]);

  const reload = useCallback(async () => {
    setRow(await fetchAmbulanceRequest(requestId));
    setEvents(await fetchRequestEvents(requestId));
  }, [requestId]);

  useEffect(() => {
    void reload();
    void fetchAmbulanceRequestStatuses().then(setStatuses);
    return subscribeAmbulanceRequest(requestId, () => void reload());
  }, [requestId, reload]);

  const statusLabel = (slug: string) => {
    const s = statuses.find((x) => x.slug === slug);
    return s ? (lang === "bn" ? s.label_bn : s.label_en) : slug;
  };

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton fallbackTo="/ambulance" shape="xl" />
          <h1 className="text-sm font-bold">{lang === "bn" ? "ট্র্যাকিং" : "Tracking"}</h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-6 max-w-lg mx-auto space-y-6">
        {!row ? (
          <p className="text-sm text-muted-foreground text-center">{lang === "bn" ? "লোড…" : "Loading…"}</p>
        ) : (
          <>
            <div className="text-center space-y-2">
              <p className="text-xs uppercase text-muted-foreground">{lang === "bn" ? "রেফারেন্স" : "Reference"}</p>
              <p className="text-3xl font-black tracking-widest text-orange-700">{row.reference_code}</p>
              <p className="text-sm">{statusLabel(row.status)} · {row.mode}</p>
              {(row.final_fare ?? row.estimated_fare) != null && (
                <div className="flex justify-center pt-1">
                  {row.fare_original != null && row.discount_percent != null && Number(row.discount_percent) > 0 ? (
                    <CareLabPriceDisplay
                      listPrice={Number(row.fare_original)}
                      salePrice={Number(row.final_fare ?? row.estimated_fare)}
                      discountPercent={Number(row.discount_percent)}
                      lang={lang}
                      variant="card"
                    />
                  ) : (
                    <p className="text-sm font-semibold tabular-nums">
                      {formatCareMoney(Number(row.final_fare ?? row.estimated_fare), lang)}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="rounded-2xl border bg-card p-4 space-y-2 text-sm">
              <p><span className="text-muted-foreground">Pickup:</span> {row.pickup_address || "—"}</p>
              <p><span className="text-muted-foreground">Dropoff:</span> {row.dropoff_address || "—"}</p>
            </div>
            <div>
              <h2 className="text-xs font-bold uppercase text-muted-foreground mb-2">{lang === "bn" ? "টাইমলাইন" : "Timeline"}</h2>
              <ul className="space-y-2 border-l-2 border-orange-200 pl-3">
                {events.map((e) => (
                  <li key={e.id} className="text-xs">
                    <span className="text-muted-foreground">{new Date(String(e.created_at)).toLocaleString()}</span>
                    {" · "}
                    {e.to_status ? statusLabel(String(e.to_status)) : String(e.event_type)}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5" /> {lang === "bn" ? "ইনভয়েস" : "Invoice"}
              </p>
              <CareAmbulanceInvoiceCard requestId={requestId} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
