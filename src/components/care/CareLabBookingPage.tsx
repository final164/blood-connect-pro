import { useCallback, useEffect, useState } from "react";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { fetchLabBooking, setLabBookingStatus } from "@/lib/care-lab-api";
import { CareLabInvoiceCard } from "@/components/care/CareLabInvoice";

export function CareLabBookingPage({ bookingId }: { bookingId: string }) {
  const { lang } = useI18n();
  const [row, setRow] = useState<Awaited<ReturnType<typeof fetchLabBooking>> | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setRow(await fetchLabBooking(bookingId));
  }, [bookingId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function cancel() {
    if (!row) return;
    setBusy(true);
    try {
      await setLabBookingStatus(row.id, "cancelled");
      toast.success(lang === "bn" ? "বাতিল হয়েছে" : "Cancelled");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton
            fallbackTo={{ to: "/care", search: { tab: "bookings" } }}
            shape="xl"
          />
          <h1 className="text-sm font-bold">{lang === "bn" ? "টেস্ট বুকিং" : "Test booking"}</h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-6 max-w-lg mx-auto space-y-6">
        {!row ? (
          <p className="text-sm text-muted-foreground text-center">{lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}</p>
        ) : (
          <>
            <div className="text-center space-y-3 max-w-md mx-auto">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {lang === "bn" ? "রেফারেন্স" : "Reference"}
              </p>
              <p className="text-3xl font-black tracking-widest text-primary">{row.reference_code}</p>
              {row.invoice_no && (
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 justify-center">
                  <Receipt className="h-3 w-3" />
                  {row.invoice_no}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {row.status} · ৳{row.price}
              </p>
              {["reserved", "confirmed"].includes(row.status) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void cancel()}
                  className="text-xs font-semibold text-destructive"
                >
                  {lang === "bn" ? "বাতিল" : "Cancel"}
                </button>
              )}
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground mb-2 flex items-center gap-1">
                <Receipt className="h-3.5 w-3.5" />
                {lang === "bn" ? "ইনভয়েস" : "Invoice"}
              </p>
              <CareLabInvoiceCard bookingId={bookingId} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
