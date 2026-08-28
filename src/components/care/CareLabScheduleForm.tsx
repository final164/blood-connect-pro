import { useEffect, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { setLabBookingStatus, setLabSchedule, type CareLabBooking } from "@/lib/care-lab-api";
import { formatDateTimeWindow } from "@/lib/care-time-window";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ScheduleSource = Pick<
  CareLabBooking,
  | "collection_date"
  | "collection_start"
  | "collection_end"
  | "delivery_date"
  | "delivery_start"
  | "delivery_end"
>;

/** Trim Postgres TIME values ("14:00:00") down to what <input type="time"> wants. */
function toTimeInput(v: string | null | undefined): string {
  return v ? String(v).slice(0, 5) : "";
}

function toDateInput(v: string | null | undefined): string {
  return v ? String(v).slice(0, 10) : "";
}

export function labCollectionLine(row: ScheduleSource, lang: "bn" | "en") {
  return formatDateTimeWindow(row.collection_date, row.collection_start, row.collection_end, lang);
}

export function labDeliveryLine(row: ScheduleSource, lang: "bn" | "en") {
  return formatDateTimeWindow(row.delivery_date, row.delivery_start, row.delivery_end, lang);
}

/**
 * Lab desk sets the sample collection time and the report delivery window.
 * Applies to the whole invoice by default, since a multi-test invoice is
 * collected and delivered in one visit.
 */
export function CareLabScheduleForm({
  booking,
  lang,
  canEdit,
  multiTest,
  onSaved,
}: {
  booking: ScheduleSource & { id: string };
  lang: "bn" | "en";
  canEdit: boolean;
  multiTest?: boolean;
  onSaved?: () => void;
}) {
  const bn = lang === "bn";
  const [collectionDate, setCollectionDate] = useState("");
  const [collectionStart, setCollectionStart] = useState("");
  const [collectionEnd, setCollectionEnd] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryStart, setDeliveryStart] = useState("");
  const [deliveryEnd, setDeliveryEnd] = useState("");
  const [applyGroup, setApplyGroup] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCollectionDate(toDateInput(booking.collection_date));
    setCollectionStart(toTimeInput(booking.collection_start));
    setCollectionEnd(toTimeInput(booking.collection_end));
    setDeliveryDate(toDateInput(booking.delivery_date));
    setDeliveryStart(toTimeInput(booking.delivery_start));
    setDeliveryEnd(toTimeInput(booking.delivery_end));
  }, [
    booking.id,
    booking.collection_date,
    booking.collection_start,
    booking.collection_end,
    booking.delivery_date,
    booking.delivery_start,
    booking.delivery_end,
  ]);

  const collectionLine = labCollectionLine(booking, lang);
  const deliveryLine = labDeliveryLine(booking, lang);

  if (!canEdit) {
    if (!collectionLine && !deliveryLine) return null;
    return (
      <div className="rounded-2xl border bg-card px-3 py-2.5 space-y-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {bn ? "সময়সূচি" : "Schedule"}
        </p>
        {collectionLine && (
          <p className="text-xs">
            <span className="text-muted-foreground">{bn ? "নমুনা সংগ্রহ" : "Sample collection"}: </span>
            <span className="font-semibold">{collectionLine}</span>
          </p>
        )}
                        {deliveryLine && (
          <p className="text-xs">
            <span className="text-muted-foreground">
              {bn ? "সম্ভাব্য রিপোর্ট ডেলিভারি" : "Expected report delivery"}:{" "}
            </span>
            <span className="font-semibold">{deliveryLine}</span>
          </p>
        )}
      </div>
    );
  }

  async function save() {
    if ((collectionStart || collectionEnd) && !collectionDate) {
      toast.error(bn ? "সংগ্রহের তারিখ দিন" : "Enter the collection date");
      return;
    }
    if ((deliveryStart || deliveryEnd) && !deliveryDate) {
      toast.error(bn ? "ডেলিভারির তারিখ দিন" : "Enter the delivery date");
      return;
    }
    if (collectionStart && collectionEnd && collectionEnd <= collectionStart) {
      toast.error(bn ? "সংগ্রহের শেষ সময় শুরুর পরে হতে হবে" : "Collection end must be after start");
      return;
    }
    if (deliveryStart && deliveryEnd && deliveryEnd <= deliveryStart) {
      toast.error(bn ? "ডেলিভারির শেষ সময় শুরুর পরে হতে হবে" : "Delivery end must be after start");
      return;
    }

    setBusy(true);
    try {
      await setLabSchedule(booking.id, {
        collectionDate,
        collectionStart,
        collectionEnd,
        deliveryDate,
        deliveryStart,
        deliveryEnd,
        applyGroup: multiTest ? applyGroup : false,
      });
      toast.success(bn ? "সময়সূচি সেভ হয়েছে" : "Schedule saved");
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-primary" />
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {bn ? "নমুনা সংগ্রহ ও রিপোর্ট ডেলিভারি" : "Collection & report delivery"}
        </p>
      </div>

      <ScheduleRow
        title={bn ? "নমুনা সংগ্রহ" : "Sample collection"}
        lang={lang}
        date={collectionDate}
        setDate={setCollectionDate}
        start={collectionStart}
        setStart={setCollectionStart}
        end={collectionEnd}
        setEnd={setCollectionEnd}
      />

      <ScheduleRow
        title={bn ? "সম্ভাব্য রিপোর্ট ডেলিভারি" : "Expected report delivery"}
        lang={lang}
        date={deliveryDate}
        setDate={setDeliveryDate}
        start={deliveryStart}
        setStart={setDeliveryStart}
        end={deliveryEnd}
        setEnd={setDeliveryEnd}
      />

      {multiTest && (
        <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={applyGroup}
            onChange={(e) => setApplyGroup(e.target.checked)}
            className="h-3.5 w-3.5 accent-primary"
          />
          {bn ? "এই ইনভয়েসের সব টেস্টে প্রয়োগ করুন" : "Apply to every test on this invoice"}
        </label>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={busy}
        className="w-full rounded-xl border-2 border-primary bg-primary/5 px-4 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        {bn ? "সময়সূচি সেভ করুন" : "Save schedule"}
      </button>
    </div>
  );
}

/**
 * Opened when lab desk clicks Check-in: requires collection + expected delivery
 * times, then saves schedule and advances status to checked_in.
 */
export function CheckinScheduleDialog({
  open,
  onOpenChange,
  bookingId,
  lang,
  applyGroup = true,
  initial,
  patientLabel,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookingId: string | null;
  lang: "bn" | "en";
  applyGroup?: boolean;
  initial?: ScheduleSource | null;
  patientLabel?: string | null;
  onDone?: () => void;
}) {
  const bn = lang === "bn";
  const [collectionDate, setCollectionDate] = useState("");
  const [collectionStart, setCollectionStart] = useState("");
  const [collectionEnd, setCollectionEnd] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [deliveryStart, setDeliveryStart] = useState("");
  const [deliveryEnd, setDeliveryEnd] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCollectionDate(toDateInput(initial?.collection_date));
    setCollectionStart(toTimeInput(initial?.collection_start));
    setCollectionEnd(toTimeInput(initial?.collection_end));
    setDeliveryDate(toDateInput(initial?.delivery_date));
    setDeliveryStart(toTimeInput(initial?.delivery_start));
    setDeliveryEnd(toTimeInput(initial?.delivery_end));
  }, [open, bookingId, initial]);

  async function confirm() {
    if (!bookingId) return;
    if (!collectionDate || !collectionStart) {
      toast.error(bn ? "নমুনা সংগ্রহের তারিখ ও সময় দিন" : "Enter sample collection date and time");
      return;
    }
    if (!deliveryDate || !deliveryStart) {
      toast.error(
        bn ? "সম্ভাব্য রিপোর্ট ডেলিভারির তারিখ ও সময় দিন" : "Enter expected report delivery date and time",
      );
      return;
    }
    if (collectionEnd && collectionEnd <= collectionStart) {
      toast.error(bn ? "সংগ্রহের শেষ সময় শুরুর পরে হতে হবে" : "Collection end must be after start");
      return;
    }
    if (deliveryEnd && deliveryEnd <= deliveryStart) {
      toast.error(bn ? "ডেলিভারির শেষ সময় শুরুর পরে হতে হবে" : "Delivery end must be after start");
      return;
    }

    setBusy(true);
    try {
      await setLabSchedule(bookingId, {
        collectionDate,
        collectionStart,
        collectionEnd,
        deliveryDate,
        deliveryStart,
        deliveryEnd,
        applyGroup,
      });
      await setLabBookingStatus(bookingId, "checked_in");
      toast.success(bn ? "চেক-ইন ও সময়সূচি সেভ হয়েছে" : "Checked in with schedule");
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="max-w-md gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2 text-left space-y-1">
          <DialogTitle>{bn ? "চেক-ইন · সময়সূচি" : "Check-in · schedule"}</DialogTitle>
          <DialogDescription>
            {patientLabel
              ? bn
                ? `${patientLabel} — নমুনা সংগ্রহ ও সম্ভাব্য রিপোর্ট ডেলিভারি সময় দিন।`
                : `${patientLabel} — enter sample collection and expected report delivery times.`
              : bn
                ? "নমুনা সংগ্রহ ও সম্ভাব্য রিপোর্ট ডেলিভারি সময় দিন, তারপর চেক-ইন নিশ্চিত করুন।"
                : "Enter sample collection and expected report delivery times, then confirm check-in."}
          </DialogDescription>
        </DialogHeader>

        <div className="px-4 py-3 space-y-3 border-t">
          <ScheduleRow
            title={bn ? "নমুনা সংগ্রহ" : "Sample collection"}
            lang={lang}
            date={collectionDate}
            setDate={setCollectionDate}
            start={collectionStart}
            setStart={setCollectionStart}
            end={collectionEnd}
            setEnd={setCollectionEnd}
          />
          <ScheduleRow
            title={bn ? "সম্ভাব্য রিপোর্ট ডেলিভারি" : "Expected report delivery"}
            lang={lang}
            date={deliveryDate}
            setDate={setDeliveryDate}
            start={deliveryStart}
            setStart={setDeliveryStart}
            end={deliveryEnd}
            setEnd={setDeliveryEnd}
          />
        </div>

        <div className="px-4 py-3 border-t flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onOpenChange(false)}
            className="flex-1 rounded-xl border px-3 py-2 text-xs font-bold hover:bg-muted transition disabled:opacity-50"
          >
            {bn ? "বাতিল" : "Cancel"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="flex-1 rounded-xl border-2 border-sky-500 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-500 hover:text-white transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {bn ? "চেক-ইন নিশ্চিত" : "Confirm check-in"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleRow({
  title,
  lang,
  date,
  setDate,
  start,
  setStart,
  end,
  setEnd,
}: {
  title: string;
  lang: "bn" | "en";
  date: string;
  setDate: (v: string) => void;
  start: string;
  setStart: (v: string) => void;
  end: string;
  setEnd: (v: string) => void;
}) {
  const input =
    "w-full rounded-lg border bg-background px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-primary/25 tabular-nums";
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold">{title}</p>
      <div className="grid grid-cols-3 gap-1.5">
        <label className="space-y-0.5">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "তারিখ" : "Date"}
          </span>
          <input type="date" className={input} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="space-y-0.5">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "শুরু" : "From"}
          </span>
          <input type="time" className={input} value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="space-y-0.5">
          <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "শেষ" : "To"}
          </span>
          <input type="time" className={input} value={end} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
    </div>
  );
}
