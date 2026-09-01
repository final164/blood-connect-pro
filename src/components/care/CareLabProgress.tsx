import { CalendarClock, Check, Hourglass } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatLabCollectionSchedule,
  formatLabDeliverySchedule,
  hasLabDeskSchedule,
  labSchedulePendingLabel,
} from "@/lib/care-lab-schedule";

export const LAB_FLOW = ["reserved", "checked_in", "sample_taken", "completed"] as const;

export function labStatusStepIndex(status: string) {
  if (status === "confirmed") return 0;
  const i = LAB_FLOW.indexOf(status as (typeof LAB_FLOW)[number]);
  return i >= 0 ? i : status === "cancelled" || status === "no_show" ? -1 : 0;
}

export function labStatusLabel(status: string, lang: "bn" | "en") {
  const map: Record<string, { bn: string; en: string }> = {
    reserved: { bn: "বুকড", en: "Booked" },
    confirmed: { bn: "কনফার্মড", en: "Confirmed" },
    checked_in: { bn: "চেক-ইন", en: "Checked in" },
    sample_taken: { bn: "নমুনা নেওয়া", en: "Sample taken" },
    completed: { bn: "সম্পন্ন", en: "Completed" },
    cancelled: { bn: "বাতিল", en: "Cancelled" },
    no_show: { bn: "নো-শো", en: "No-show" },
  };
  const row = map[status];
  if (!row) return status;
  return lang === "bn" ? row.bn : row.en;
}

export function labStatusTone(status: string) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  if (status === "cancelled" || status === "no_show")
    return "bg-destructive/10 text-destructive border-destructive/30";
  if (status === "checked_in" || status === "sample_taken")
    return "bg-sky-500/10 text-sky-700 border-sky-500/30";
  return "bg-amber-500/10 text-amber-800 border-amber-500/30";
}

export function labProgressPercent(status: string) {
  if (status === "cancelled" || status === "no_show") return 100;
  return Math.round(((labStatusStepIndex(status) + 1) / LAB_FLOW.length) * 100);
}

/** Compact bar for list cards (My Bookings). */
export function CareLabProgressMini({
  status,
  lang,
  className,
}: {
  status: string;
  lang: "bn" | "en";
  className?: string;
}) {
  const st = status || "reserved";
  const terminal = st === "cancelled" || st === "no_show";
  const pct = labProgressPercent(st);

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-bold",
            labStatusTone(st),
          )}
        >
          {labStatusLabel(st, lang)}
        </span>
        {!terminal && (
          <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{pct}%</span>
        )}
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            terminal ? "bg-destructive/70" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/** Full step progress for booking detail pages. */
export function CareLabProgressBar({
  status,
  lang,
  schedule,
}: {
  status: string;
  lang: "bn" | "en";
  /** Desk-confirmed collection / report delivery windows, when set. */
  schedule?: {
    collection_date?: string | null;
    collection_start?: string | null;
    collection_end?: string | null;
    delivery_date?: string | null;
    delivery_start?: string | null;
    delivery_end?: string | null;
  } | null;
}) {
  const terminal = status === "cancelled" || status === "no_show";
  const step = labStatusStepIndex(status);
  const labels =
    lang === "bn"
      ? ["বুকড", "চেক-ইন", "নমুনা", "সম্পন্ন"]
      : ["Booked", "Check-in", "Sample", "Done"];

  if (terminal) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
        <div className="h-2 rounded-full bg-destructive/20 overflow-hidden">
          <div className="h-full w-full bg-destructive/70" />
        </div>
        <p className="mt-2 text-xs font-semibold text-destructive">
          {labStatusLabel(status, lang)}
        </p>
      </div>
    );
  }

  const pct = Math.round(((step + 1) / LAB_FLOW.length) * 100);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-muted-foreground">
          {lang === "bn" ? "অগ্রগতি" : "Progress"}
        </span>
        <span className="font-bold tabular-nums text-primary">{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-4 gap-1">
        {labels.map((label, i) => {
          const done = i <= step;
          const current = i === step;
          return (
            <div key={label} className="flex flex-col items-center gap-1 min-w-0">
              <span
                className={cn(
                  "h-6 w-6 rounded-full border grid place-items-center text-[10px] font-bold",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/25 text-muted-foreground",
                  current && "ring-2 ring-primary/30",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[9px] font-semibold truncate w-full text-center",
                  done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
      <LabScheduleChips schedule={schedule} lang={lang} />
    </div>
  );
}

function LabScheduleChips({
  schedule,
  lang,
}: {
  schedule?: Parameters<typeof CareLabProgressBar>[0]["schedule"];
  lang: "bn" | "en";
}) {
  const collection = formatLabCollectionSchedule(schedule, lang);
  const delivery = formatLabDeliverySchedule(schedule, lang);
  const pending = !hasLabDeskSchedule(schedule);

  return (
    <div className="flex flex-wrap gap-1.5 pt-0.5">
      {pending ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/8 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
          <Hourglass className="h-3 w-3" />
          {lang === "bn" ? "সময়সূচি" : "Schedule"} · {labSchedulePendingLabel(lang)}
        </span>
      ) : (
        <>
          {collection && (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/30 bg-sky-500/5 px-2 py-0.5 text-[10px] font-semibold text-sky-700">
              <CalendarClock className="h-3 w-3" />
              {lang === "bn" ? "নমুনা সংগ্রহ" : "Collection"} · {collection}
            </span>
          )}
          {delivery && (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/5 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <CalendarClock className="h-3 w-3" />
              {lang === "bn" ? "রিপোর্ট" : "Report"} · {delivery}
            </span>
          )}
        </>
      )}
    </div>
  );
}

/** Compact chips for dashboard / hub booking cards. */
export function CareLabScheduleChips({
  schedule,
  lang,
}: {
  schedule?: Parameters<typeof CareLabProgressBar>[0]["schedule"];
  lang: "bn" | "en";
}) {
  return <LabScheduleChips schedule={schedule} lang={lang} />;
}

/** Worst / furthest-behind status across a multi-test invoice group for list summary. */
export function summarizeLabGroupStatus(statuses: string[]): string {
  if (!statuses.length) return "reserved";
  if (statuses.every((s) => s === "completed")) return "completed";
  if (statuses.every((s) => s === "cancelled" || s === "no_show")) {
    return statuses.includes("no_show") ? "no_show" : "cancelled";
  }
  const active = statuses.filter((s) => s !== "cancelled" && s !== "no_show");
  if (!active.length) return statuses[0]!;
  return active.reduce((min, s) =>
    labStatusStepIndex(s) < labStatusStepIndex(min) ? s : min,
  );
}
