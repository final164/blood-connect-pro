import { useCallback, useEffect, useMemo, useState } from "react";
import { Receipt } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { fetchLabBookingsForInvoice, setLabBookingStatus, type CareLabBooking } from "@/lib/care-lab-api";
import { CareLabInvoiceCard } from "@/components/care/CareLabInvoice";
import { formatCareMoney } from "@/lib/care-invoice";

export function CareLabBookingPage({ bookingId }: { bookingId: string }) {
  const { lang } = useI18n();
  const [rows, setRows] = useState<CareLabBooking[]>([]);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setRows(await fetchLabBookingsForInvoice(bookingId));
  }, [bookingId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const primary = useMemo(
    () => rows.find((r) => r.id === bookingId) ?? rows[0] ?? null,
    [rows, bookingId],
  );

  const total = useMemo(() => rows.reduce((n, r) => n + Number(r.price ?? 0), 0), [rows]);
  const canCancel = rows.some((r) => ["reserved", "confirmed"].includes(r.status));

  async function cancel() {
    if (!rows.length) return;
    setBusy(true);
    try {
      const targets = rows.filter((r) => ["reserved", "confirmed"].includes(r.status));
      for (const r of targets) {
        await setLabBookingStatus(r.id, "cancelled");
      }
      toast.success(
        lang === "bn"
          ? targets.length > 1
            ? "সব টেস্ট বাতিল হয়েছে"
            : "বাতিল হয়েছে"
          : targets.length > 1
            ? "All tests cancelled"
            : "Cancelled",
      );
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
          <h1 className="text-sm font-bold">
            {rows.length > 1
              ? lang === "bn"
                ? "মাল্টি-টেস্ট ইনভয়েস"
                : "Multi-test invoice"
              : lang === "bn"
                ? "টেস্ট বুকিং"
                : "Test booking"}
          </h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-6 max-w-lg mx-auto space-y-6">
        {!primary ? (
          <p className="text-sm text-muted-foreground text-center">{lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}</p>
        ) : (
          <>
            <div className="text-center space-y-3 max-w-md mx-auto">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {rows.length > 1
                  ? lang === "bn"
                    ? "ইনভয়েস"
                    : "Invoice"
                  : lang === "bn"
                    ? "রেফারেন্স"
                    : "Reference"}
              </p>
              <p className="text-3xl font-black tracking-widest text-primary">
                {rows.length > 1
                  ? (primary.invoice_no || primary.reference_code).replace(/^BLT-/, "")
                  : primary.reference_code}
              </p>
              {primary.invoice_no && (
                <p className="text-[11px] text-muted-foreground inline-flex items-center gap-1 justify-center">
                  <Receipt className="h-3 w-3" />
                  {primary.invoice_no}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {rows.length > 1
                  ? lang === "bn"
                    ? `${rows.length}টি টেস্ট · ${formatCareMoney(total, lang)}`
                    : `${rows.length} tests · ${formatCareMoney(total, lang)}`
                  : `${primary.status} · ${formatCareMoney(Number(primary.price ?? 0), lang)}`}
              </p>
              {canCancel && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void cancel()}
                  className="text-xs font-semibold text-destructive"
                >
                  {rows.length > 1
                    ? lang === "bn"
                      ? "সব বাতিল"
                      : "Cancel all"
                    : lang === "bn"
                      ? "বাতিল"
                      : "Cancel"}
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
