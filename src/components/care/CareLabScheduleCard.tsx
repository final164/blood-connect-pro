import { Building2, CalendarClock, FlaskConical, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CareLabBooking } from "@/lib/care-lab-api";
import {
  formatLabCollectionSchedule,
  formatLabDeliverySchedule,
  hasLabDeskSchedule,
  labSchedulePendingHint,
  labSchedulePendingLabel,
} from "@/lib/care-lab-schedule";

type LabBookingRow = CareLabBooking & {
  offering?: { name_bn?: string | null; name_en?: string | null } | null;
};

function testName(row: LabBookingRow, lang: "bn" | "en") {
  return (lang === "bn" ? row.offering?.name_bn : row.offering?.name_en) || row.reference_code;
}

function ScheduleRow({
  label,
  value,
  pending,
  lang,
}: {
  label: string;
  value: string | null;
  pending: boolean;
  lang: "bn" | "en";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-xl border px-3 py-2.5",
        pending
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-emerald-500/25 bg-emerald-500/5",
      )}
    >
      <span
        className={cn(
          "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          pending ? "bg-amber-500/15 text-amber-700" : "bg-emerald-500/15 text-emerald-700",
        )}
      >
        {pending ? <Hourglass className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            "text-sm font-semibold mt-0.5",
            pending ? "text-amber-800" : "text-foreground",
          )}
        >
          {value ?? labSchedulePendingLabel(lang)}
        </p>
      </div>
    </div>
  );
}

/** Patient-facing schedule card — pending until lab desk sets collection + delivery. */
export function CareLabScheduleCard({
  bookings,
  orgName,
  orgNameBn,
  lang,
  className,
}: {
  bookings: LabBookingRow[];
  orgName?: string | null;
  orgNameBn?: string | null;
  lang: "bn" | "en";
  className?: string;
}) {
  if (!bookings.length) return null;

  const hospital =
    (lang === "bn" ? orgNameBn || orgName : orgName || orgNameBn) ||
    (lang === "bn" ? "হাসপাতাল / ল্যাব" : "Hospital / lab");
  const allScheduled = bookings.every((b) => hasLabDeskSchedule(b));
  const single = bookings.length === 1;

  return (
    <section
      className={cn(
        "rounded-2xl border shadow-lg overflow-hidden",
        allScheduled
          ? "border-emerald-500/30 bg-gradient-to-b from-emerald-500/8 to-card"
          : "border-amber-500/35 bg-gradient-to-b from-amber-500/10 to-card",
        className,
      )}
    >
      <div className="px-4 py-3 border-b border-border/60 bg-card/80 backdrop-blur-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
              {lang === "bn" ? "হাসপাতাল / ল্যাব" : "Hospital / lab"}
            </p>
            <p className="text-base font-bold leading-snug truncate">{hospital}</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-3">
        {single ? (
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FlaskConical className="h-4 w-4 text-primary shrink-0" />
            <span className="truncate">{testName(bookings[0]!, lang)}</span>
          </div>
        ) : (
          <ul className="space-y-1.5">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center gap-2 text-sm font-semibold min-w-0">
                <FlaskConical className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">{testName(b, lang)}</span>
              </li>
            ))}
          </ul>
        )}

        {single ? (
          <div className="space-y-2">
            <ScheduleRow
              label={lang === "bn" ? "নমুনা সংগ্রহ" : "Sample collection"}
              value={formatLabCollectionSchedule(bookings[0], lang)}
              pending={!formatLabCollectionSchedule(bookings[0], lang)}
              lang={lang}
            />
            <ScheduleRow
              label={lang === "bn" ? "রিপোর্ট ডেলিভারি" : "Report delivery"}
              value={formatLabDeliverySchedule(bookings[0], lang)}
              pending={!formatLabDeliverySchedule(bookings[0], lang)}
              lang={lang}
            />
          </div>
        ) : (
          <ul className="space-y-3">
            {bookings.map((b) => {
              const collection = formatLabCollectionSchedule(b, lang);
              const delivery = formatLabDeliverySchedule(b, lang);
              return (
                <li key={b.id} className="rounded-xl border bg-card/60 p-3 space-y-2">
                  <p className="text-xs font-bold text-muted-foreground truncate">{testName(b, lang)}</p>
                  <ScheduleRow
                    label={lang === "bn" ? "নমুনা সংগ্রহ" : "Sample collection"}
                    value={collection}
                    pending={!collection}
                    lang={lang}
                  />
                  <ScheduleRow
                    label={lang === "bn" ? "রিপোর্ট ডেলিভারি" : "Report delivery"}
                    value={delivery}
                    pending={!delivery}
                    lang={lang}
                  />
                </li>
              );
            })}
          </ul>
        )}

        {!allScheduled ? (
          <p className="text-[11px] text-muted-foreground leading-relaxed text-center px-1">
            {labSchedulePendingHint(lang)}
          </p>
        ) : null}
      </div>
    </section>
  );
}
