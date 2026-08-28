import { useEffect, useState } from "react";
import { CalendarClock, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatTimeWindow } from "@/lib/care-time-window";
import {
  fetchOrgOperationBookings,
  operationDoctorRoleLabel,
  operationName,
  operationStatusLabel,
  operationStatusTone,
  setOperationPayment,
  setOperationSchedule,
  setOperationStatus,
  type CareOperationBookingRow,
} from "@/lib/care-operations-api";
import { CareOperationInvoiceDialog } from "@/components/care/CareOperationInvoice";

const STATUS_FILTERS = ["requested", "confirmed", "in_progress", "completed", "all"] as const;

function money(n: number, bn: boolean) {
  return `${bn ? "৳" : "BDT "}${n.toLocaleString("en-US")}`;
}

export function CareOperationDeskPanel({
  orgId,
  canSchedule,
  lang,
}: {
  orgId: string;
  canSchedule: boolean;
  lang: "bn" | "en";
}) {
  const bn = lang === "bn";
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>("requested");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<CareOperationBookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function reload() {
    setLoading(true);
    try {
      setRows(await fetchOrgOperationBookings(orgId, { status, date: date || undefined }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, status, date]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
          <CalendarClock className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h2 className="text-sm font-bold">{bn ? "অপারেশন বুকিং" : "Operation bookings"}</h2>
          <p className="text-xs text-muted-foreground">
            {bn ? "তারিখ ও সময় নির্ধারণ করে নিশ্চিত করুন" : "Set the date and time, then confirm"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="h-9 w-9 grid place-items-center rounded-xl border"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              status === s ? "bg-primary text-primary-foreground" : "border text-muted-foreground"
            }`}
          >
            {s === "all" ? (bn ? "সব" : "All") : operationStatusLabel(s, lang)}
          </button>
        ))}
        <input
          type="date"
          className="ml-auto rounded-xl border bg-background px-2 py-1.5 text-xs"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-14">
          <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : !rows.length ? (
        <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
          {bn ? "কোনো বুকিং নেই।" : "No bookings."}
        </p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <BookingRow
              key={row.id}
              row={row}
              lang={lang}
              canSchedule={canSchedule}
              onChanged={() => void reload()}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingRow({
  row,
  lang,
  canSchedule,
  onChanged,
}: {
  row: CareOperationBookingRow;
  lang: "bn" | "en";
  canSchedule: boolean;
  onChanged: () => void;
}) {
  const bn = lang === "bn";
  const [open, setOpen] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [schedDate, setSchedDate] = useState(row.scheduled_date ?? row.requested_date ?? "");
  const [start, setStart] = useState(row.scheduled_start?.slice(0, 5) ?? "");
  const [end, setEnd] = useState(row.scheduled_end?.slice(0, 5) ?? "");
  const [admission, setAdmission] = useState(row.admission_date ?? "");
  const [note, setNote] = useState(row.desk_note ?? "");
  const [busy, setBusy] = useState(false);

  async function confirmSchedule() {
    if (!schedDate) {
      toast.error(bn ? "তারিখ দিন" : "Pick a date");
      return;
    }
    if (start && end && end <= start) {
      toast.error(bn ? "শেষ সময় শুরুর পরে হতে হবে" : "End time must be after the start time");
      return;
    }
    setBusy(true);
    try {
      await setOperationSchedule({
        bookingId: row.id,
        scheduledDate: schedDate,
        scheduledStart: start || null,
        scheduledEnd: end || null,
        admissionDate: admission || null,
        deskNote: note.trim() || null,
      });
      toast.success(bn ? "নিশ্চিত করা হয়েছে" : "Confirmed");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(next: string) {
    setBusy(true);
    try {
      await setOperationStatus(row.id, next);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function markPaid() {
    setBusy(true);
    try {
      await setOperationPayment(row.id, "paid", row.price);
      toast.success(bn ? "পেমেন্ট নেওয়া হয়েছে" : "Payment recorded");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const window = formatTimeWindow(row.scheduled_start, row.scheduled_end, lang);
  const patient = row.guest_name || (bn ? "রোগী" : "Patient");

  return (
    <div className="rounded-2xl border bg-card">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center gap-3 p-3 text-left">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{operationName(row.catalog, lang)}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {patient}
            {row.guest_phone ? ` · ${row.guest_phone}` : ""} · {row.reference_code}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {row.scheduled_date
              ? `${row.scheduled_date}${window ? ` · ${window}` : ""}`
              : row.requested_date
                ? `${bn ? "অনুরোধ" : "Requested"}: ${row.requested_date}`
                : bn
                  ? "তারিখ নির্ধারিত হয়নি"
                  : "Date not set"}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span
            className={`inline-block rounded-full border px-2 py-0.5 text-[10px] font-bold ${operationStatusTone(row.status)}`}
          >
            {operationStatusLabel(row.status, lang)}
          </span>
          <p className="mt-1 text-xs font-bold">{money(row.price, bn)}</p>
        </div>
      </button>

      {open && (
        <div className="space-y-3 border-t p-3">
          {!!row.doctors?.length && (
            <div className="text-xs">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {bn ? "সার্জন" : "Surgeons"}
              </p>
              <ul className="space-y-0.5">
                {row.doctors.map((d, i) => (
                  <li key={i}>
                    {d.doctor_name_snapshot || "—"}
                    <span className="ml-1.5 text-[10px] text-muted-foreground">
                      {operationDoctorRoleLabel(d.role, lang)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {row.patient_note && (
            <p className="rounded-xl bg-muted/40 p-2.5 text-xs">
              <span className="font-semibold">{bn ? "রোগীর নোট" : "Patient note"}: </span>
              {row.patient_note}
            </p>
          )}

          {canSchedule && row.status !== "cancelled" && (
            <div className="space-y-2 rounded-xl border border-dashed p-2.5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {bn ? "তারিখ ও সময় নির্ধারণ" : "Set date & time"}
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                <input
                  type="date"
                  className="rounded-xl border bg-background px-2 py-2 text-xs"
                  value={schedDate}
                  onChange={(e) => setSchedDate(e.target.value)}
                />
                <input
                  type="time"
                  className="rounded-xl border bg-background px-2 py-2 text-xs"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
                <input
                  type="time"
                  className="rounded-xl border bg-background px-2 py-2 text-xs"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] text-muted-foreground">
                  {bn ? "ভর্তির তারিখ (ঐচ্ছিক)" : "Admission date (optional)"}
                </label>
                <input
                  type="date"
                  className="w-full rounded-xl border bg-background px-2 py-2 text-xs"
                  value={admission}
                  onChange={(e) => setAdmission(e.target.value)}
                />
              </div>
              <textarea
                rows={2}
                className="w-full rounded-xl border bg-background px-2 py-2 text-xs"
                placeholder={bn ? "ডেস্ক নোট" : "Desk note"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <button
                type="button"
                onClick={() => void confirmSchedule()}
                disabled={busy}
                className="w-full rounded-xl bg-primary py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {bn ? "নিশ্চিত করুন" : "Confirm"}
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setInvoiceOpen(true)}
              className="rounded-xl border px-3 py-2 text-xs font-semibold"
            >
              {bn ? "ইনভয়েস" : "Invoice"}
            </button>
            {canSchedule && row.payment_status !== "paid" && (
              <button
                type="button"
                onClick={() => void markPaid()}
                disabled={busy}
                className="rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {bn ? "পেমেন্ট নেওয়া হলো" : "Mark paid"}
              </button>
            )}
            {canSchedule && row.status === "confirmed" && (
              <button
                type="button"
                onClick={() => void changeStatus("in_progress")}
                disabled={busy}
                className="rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {bn ? "শুরু" : "Start"}
              </button>
            )}
            {canSchedule && row.status === "in_progress" && (
              <button
                type="button"
                onClick={() => void changeStatus("completed")}
                disabled={busy}
                className="rounded-xl border px-3 py-2 text-xs font-semibold disabled:opacity-50"
              >
                {bn ? "সম্পন্ন" : "Complete"}
              </button>
            )}
            {canSchedule && row.status !== "cancelled" && row.status !== "completed" && (
              <button
                type="button"
                onClick={() => void changeStatus("cancelled")}
                disabled={busy}
                className="rounded-xl border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50"
              >
                {bn ? "বাতিল" : "Cancel"}
              </button>
            )}
          </div>
        </div>
      )}

      {invoiceOpen && (
        <CareOperationInvoiceDialog
          bookingId={row.id}
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
        />
      )}
    </div>
  );
}
