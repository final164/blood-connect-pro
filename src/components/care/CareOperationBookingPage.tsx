import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Receipt, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { formatCareMoney } from "@/lib/care-invoice";
import { formatTimeWindow } from "@/lib/care-time-window";
import { CareOrgChatButton } from "@/components/care/CareOrgChatButton";
import { CareOperationInvoiceCard } from "@/components/care/CareOperationInvoice";
import {
  OPERATION_FLOW,
  fetchOperationBooking,
  operationDoctorRoleLabel,
  operationName,
  operationStatusLabel,
  operationStatusTone,
  setOperationStatus,
  type CareOperationBookingRow,
} from "@/lib/care-operations-api";

export function CareOperationBookingPage({ bookingId }: { bookingId: string }) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [booking, setBooking] = useState<CareOperationBookingRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setBooking(await fetchOperationBooking(bookingId));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function cancel() {
    setBusy(true);
    try {
      await setOperationStatus(bookingId, "cancelled");
      toast.success(bn ? "বাতিল হয়েছে" : "Cancelled");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const canCancel = booking && ["requested", "confirmed"].includes(booking.status);
  const window = formatTimeWindow(booking?.scheduled_start, booking?.scheduled_end, lang);

  return (
    <div className="w-full">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton fallbackTo={{ to: "/care", search: { tab: "bookings" } }} shape="xl" />
          <h1 className="flex-1 truncate text-sm font-bold">
            {bn ? "অপারেশন বুকিং" : "Operation booking"}
          </h1>
          {booking?.org_id ? <CareOrgChatButton orgId={booking.org_id} variant="icon" /> : null}
        </div>
      </AutoHideHeader>

      <div className="mx-auto max-w-lg space-y-6 px-3 py-6">
        {loading ? (
          <p className="text-center text-sm text-muted-foreground">{bn ? "লোড হচ্ছে…" : "Loading…"}</p>
        ) : !booking ? (
          <p className="text-center text-sm text-muted-foreground">
            {bn ? "বুকিং পাওয়া যায়নি" : "Booking not found"}
          </p>
        ) : (
          <>
            <div className="mx-auto max-w-md space-y-3 text-center">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                {bn ? "রেফারেন্স" : "Reference"}
              </p>
              <p className="text-3xl font-black tracking-widest text-primary">
                {booking.reference_code}
              </p>
              {booking.invoice_no && (
                <p className="inline-flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
                  <Receipt className="h-3 w-3" />
                  {booking.invoice_no}
                </p>
              )}
              <p className="text-sm font-semibold">{operationName(booking.catalog, lang)}</p>
              <p className="text-sm text-muted-foreground">
                {formatCareMoney(booking.price, lang)}
                {booking.org ? ` · ${bn ? booking.org.name_bn || booking.org.name : booking.org.name}` : ""}
              </p>
              <span
                className={cn(
                  "inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
                  operationStatusTone(booking.status),
                )}
              >
                {operationStatusLabel(booking.status, lang)}
              </span>
              {canCancel && (
                <div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void cancel()}
                    className="text-xs font-semibold text-destructive"
                  >
                    {bn ? "বাতিল করুন" : "Cancel"}
                  </button>
                </div>
              )}
            </div>

            <section className="space-y-4 rounded-2xl border bg-card p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {bn ? "অগ্রগতি" : "Progress"}
              </p>
              <OperationProgress status={booking.status} lang={lang} />

              <div className="space-y-1.5 rounded-xl bg-muted/40 p-3 text-xs">
                <p className="flex items-start gap-1.5">
                  <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                  <span>
                    <b>{bn ? "অপারেশনের তারিখ" : "Operation date"}: </b>
                    {booking.scheduled_date
                      ? `${booking.scheduled_date}${window ? ` · ${window}` : ""}`
                      : booking.requested_date
                        ? bn
                          ? `অনুরোধ ${booking.requested_date} — ডেস্ক নিশ্চিত করবে`
                          : `Requested ${booking.requested_date} — the desk will confirm`
                        : bn
                          ? "ডেস্ক থেকে নিশ্চিত করা হবে"
                          : "To be confirmed by the desk"}
                  </span>
                </p>
                {booking.admission_date && (
                  <p>
                    <b>{bn ? "ভর্তির তারিখ" : "Admission date"}: </b>
                    {booking.admission_date}
                  </p>
                )}
                {booking.location && (
                  <p>
                    <b>{bn ? "স্থান" : "Venue"}: </b>
                    {bn ? booking.location.name_bn || booking.location.name : booking.location.name}
                  </p>
                )}
                {booking.desk_note && (
                  <p>
                    <b>{bn ? "ডেস্ক নোট" : "Desk note"}: </b>
                    {booking.desk_note}
                  </p>
                )}
              </div>

              {!!booking.doctors?.length && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {bn ? "সার্জন টিম" : "Surgical team"}
                  </p>
                  <ul className="space-y-1">
                    {booking.doctors.map((d, i) => (
                      <li key={i} className="flex items-center gap-1.5 text-xs">
                        <Stethoscope className="h-3.5 w-3.5 text-primary" />
                        <span className="font-medium">{d.doctor_name_snapshot || "—"}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {operationDoctorRoleLabel(d.role, lang)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            <div>
              <p className="mb-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <Receipt className="h-3.5 w-3.5" />
                {bn ? "ইনভয়েস" : "Invoice"}
              </p>
              <CareOperationInvoiceCard bookingId={bookingId} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function OperationProgress({ status, lang }: { status: string; lang: "bn" | "en" }) {
  const cancelled = status === "cancelled" || status === "no_show";
  const activeIdx = OPERATION_FLOW.indexOf(status as (typeof OPERATION_FLOW)[number]);
  return (
    <ol className="flex items-center gap-1">
      {OPERATION_FLOW.map((step, i) => {
        const done = !cancelled && activeIdx >= i;
        return (
          <li key={step} className="flex-1">
            <div
              className={cn(
                "h-1.5 rounded-full",
                cancelled ? "bg-destructive/30" : done ? "bg-primary" : "bg-muted",
              )}
            />
            <p
              className={cn(
                "mt-1 text-[10px]",
                done ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {operationStatusLabel(step, lang)}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
