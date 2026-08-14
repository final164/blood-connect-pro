import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { useI18n } from "@/lib/i18n";
import { fetchLabBooking, setLabBookingStatus, type CareLabBooking } from "@/lib/care-lab-api";

export function CareLabBookingPage({ bookingId }: { bookingId: string }) {
  const { lang } = useI18n();
  const [row, setRow] = useState<CareLabBooking | null>(null);
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
          <Link to="/care" search={{ tab: "bookings" }} className="h-9 w-9 rounded-xl grid place-items-center hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="text-sm font-bold">{lang === "bn" ? "টেস্ট বুকিং" : "Test booking"}</h1>
        </div>
      </AutoHideHeader>
      <div className="px-3 py-6 max-w-md mx-auto text-center space-y-3">
        {!row ? (
          <p className="text-sm text-muted-foreground">{lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}</p>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {lang === "bn" ? "রেফারেন্স" : "Reference"}
            </p>
            <p className="text-3xl font-black tracking-widest">{row.reference_code}</p>
            <p className="text-sm">{row.status} · ৳{row.price}</p>
            {["reserved", "confirmed"].includes(row.status) && (
              <button type="button" disabled={busy} onClick={() => void cancel()} className="text-xs font-semibold text-destructive">
                {lang === "bn" ? "বাতিল" : "Cancel"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
