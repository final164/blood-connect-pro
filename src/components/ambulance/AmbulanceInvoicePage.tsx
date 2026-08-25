import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MapPin, Receipt } from "lucide-react";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { fetchAmbulanceRequest } from "@/lib/ambulance-api";
import { CareAmbulanceInvoiceCard } from "@/components/care/CareAmbulanceInvoice";
import { CareLabPriceDisplay } from "@/components/care/CareLabPriceDisplay";
import { formatCareMoney } from "@/lib/care-invoice";

export function AmbulanceInvoicePage({ requestId }: { requestId: string }) {
  const { lang } = useI18n();
  const [row, setRow] = useState<Awaited<ReturnType<typeof fetchAmbulanceRequest>>>(null);

  const reload = useCallback(async () => {
    setRow(await fetchAmbulanceRequest(requestId));
  }, [requestId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton fallbackTo="/ambulance" shape="xl" />
          <h1 className="text-sm font-bold flex-1 truncate">
            {lang === "bn" ? "অ্যাম্বুলেন্স ইনভয়েস" : "Ambulance invoice"}
          </h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-6 max-w-lg mx-auto space-y-6">
        {!row ? (
          <p className="text-sm text-muted-foreground text-center">{lang === "bn" ? "লোড…" : "Loading…"}</p>
        ) : (
          <>
            <div className="text-center space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {lang === "bn" ? "রেফারেন্স" : "Reference"}
              </p>
              <p className="text-3xl font-black tracking-widest text-orange-700">{row.reference_code}</p>
              {row.invoice_no && (
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 justify-center">
                  <Receipt className="h-3 w-3" />
                  {row.invoice_no}
                </p>
              )}
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

            <div>
              <p className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5" /> {lang === "bn" ? "ইনভয়েস" : "Invoice"}
              </p>
              <CareAmbulanceInvoiceCard requestId={requestId} />
            </div>

            <Link
              to="/ambulance/request/$id"
              params={{ id: requestId }}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-orange-200 bg-orange-50/50 px-4 py-3 text-sm font-semibold text-orange-900 hover:bg-orange-50"
            >
              <MapPin className="h-4 w-4 shrink-0" />
              {lang === "bn" ? "ট্র্যাকিং দেখুন" : "View tracking"}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
