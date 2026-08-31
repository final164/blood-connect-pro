import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Home, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { formatCareMoney } from "@/lib/care-invoice";
import {
  fetchHomeVisit,
  homeVisitStatusLabel,
  homeVisitStatusTone,
  setHomeVisitStatus,
  type CareHomeVisitBooking,
} from "@/lib/care-home-api";
import { cn } from "@/lib/utils";

export function CareHomeVisitPage({ bookingId }: { bookingId: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const { user } = useAuth();
  const [b, setB] = useState<CareHomeVisitBooking | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const row = await fetchHomeVisit(bookingId);
    setB(row);
  }

  useEffect(() => {
    void reload().catch((e) => toast.error((e as Error).message));
  }, [bookingId]);

  async function cancel() {
    if (!b) return;
    setBusy(true);
    try {
      await setHomeVisitStatus(b.id, "cancelled");
      toast.success(bn ? "বাতিল হয়েছে" : "Cancelled");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!b) {
    return (
      <div className="min-h-[40dvh] grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-teal-700" />
      </div>
    );
  }

  const docName = bn
    ? b.doctor?.full_name_bn || b.doctor?.full_name
    : b.doctor?.full_name;

  return (
    <div className="w-full min-h-dvh bg-gradient-to-b from-teal-50/60 to-background">
      <AutoHideHeader className="z-30 border-b bg-background/90 backdrop-blur safe-top">
        <div className="flex items-center gap-2 px-3 py-2 max-w-2xl mx-auto w-full">
          <PageBackButton fallbackTo="/care?tab=bookings" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate">{bn ? "হোম ভিজিট" : "Home visit"}</h1>
            <p className="text-[10px] text-muted-foreground">#{b.reference_code}</p>
          </div>
        </div>
      </AutoHideHeader>

      <div className="px-3 py-4 max-w-2xl mx-auto space-y-3 pb-24">
        <div className="rounded-2xl border bg-card p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span
              className={cn(
                "text-[11px] font-semibold border rounded-full px-2.5 py-0.5",
                homeVisitStatusTone(b.status),
              )}
            >
              {homeVisitStatusLabel(b.status, lang)}
            </span>
            <p className="text-sm font-bold text-teal-800">{formatCareMoney(b.fee_amount, lang)}</p>
          </div>
          <p className="text-sm font-semibold">
            {new Date(b.slot_start).toLocaleString(bn ? "bn-BD" : "en-US", {
              timeZone: "Asia/Dhaka",
              dateStyle: "full",
              timeStyle: "short",
            })}
          </p>
          {docName && (
            <Link
              to="/care/home-doctor/$doctorId"
              params={{ doctorId: b.doctor_id }}
              className="inline-flex items-center gap-2 text-sm font-semibold text-teal-800"
            >
              <Home className="h-4 w-4" />
              {docName}
            </Link>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-4 space-y-1">
          <p className="text-xs font-bold flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            {bn ? "ভিজিট ঠিকানা" : "Visit address"}
          </p>
          <p className="text-sm">
            {[b.visit_upazila, b.visit_address].filter(Boolean).join(" · ")}
          </p>
          {b.visit_lat != null && b.visit_lng != null && (
            <p className="text-[10px] text-muted-foreground">
              {b.visit_lat.toFixed(5)}, {b.visit_lng.toFixed(5)}
            </p>
          )}
        </div>

        {user?.id === b.patient_id &&
          (b.status === "requested" || b.status === "confirmed") && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void cancel()}
              className="w-full rounded-xl border border-rose-200 text-rose-700 py-2.5 text-sm font-semibold"
            >
              {bn ? "বুকিং বাতিল" : "Cancel booking"}
            </button>
          )}
      </div>
    </div>
  );
}
