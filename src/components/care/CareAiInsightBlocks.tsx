import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertTriangle, Bandage, ChevronDown, Stethoscope, UserRound } from "lucide-react";
import type { CareAiExpertAnalysis, CareAiSuggestedSpecialty } from "@/lib/care-ai-chat";

const URGENCY_LABEL: Record<
  CareAiExpertAnalysis["urgency"],
  { bn: string; en: string; className: string }
> = {
  routine: { bn: "নিয়মিত", en: "Routine", className: "bg-slate-100 text-slate-700" },
  soon: { bn: "শীঘ্রই", en: "Soon", className: "bg-amber-100 text-amber-900" },
  urgent: { bn: "জরুরি", en: "Urgent", className: "bg-orange-100 text-orange-900" },
  emergency: { bn: "জরুরি হাসপাতাল", en: "Emergency", className: "bg-red-100 text-red-800" },
};

export function CareAiExpertBlock({
  analysis,
  title,
  lang,
}: {
  analysis: CareAiExpertAnalysis | null | undefined;
  title: string;
  lang: "bn" | "en";
}) {
  if (!analysis) return null;
  const hasBody =
    analysis.analysis_summary.trim() ||
    analysis.red_flags.length > 0 ||
    analysis.likely_systems.length > 0;
  if (!hasBody && !analysis.urgency) return null;
  const urg = URGENCY_LABEL[analysis.urgency] ?? URGENCY_LABEL.soon;

  return (
    <div className="mt-2 rounded-xl border border-violet-500/30 bg-violet-500/5 px-2.5 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 flex items-center gap-1">
          <Stethoscope className="h-3 w-3" />
          {title}
        </p>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${urg.className}`}>
          {lang === "bn" ? urg.bn : urg.en}
        </span>
      </div>
      {analysis.analysis_summary.trim() ? (
        <p className="text-xs whitespace-pre-wrap leading-relaxed">{analysis.analysis_summary}</p>
      ) : null}
      {analysis.likely_systems.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {analysis.likely_systems.map((s) => (
            <span
              key={s}
              className="text-[10px] rounded-full border bg-background/80 px-2 py-0.5 text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      ) : null}
      {analysis.red_flags.length > 0 ? (
        <div className="rounded-lg border border-red-200/80 bg-red-50/80 dark:bg-red-950/30 dark:border-red-900 px-2 py-1.5">
          <p className="text-[10px] font-bold text-red-700 dark:text-red-300 flex items-center gap-1 mb-1">
            <AlertTriangle className="h-3 w-3" />
            {lang === "bn" ? "লাল পতাকা" : "Red flags"}
          </p>
          <ul className="text-xs space-y-0.5 list-disc pl-4 text-red-900/90 dark:text-red-100/90">
            {analysis.red_flags.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

export function CareAiSpecialtyCards({
  items,
  title,
  cta,
  lang,
  bookSerialCta,
  onBookSerial,
  serialAutoBook = false,
}: {
  items: CareAiSuggestedSpecialty[] | null | undefined;
  title: string;
  cta: string;
  lang: "bn" | "en";
  /** Primary auto-book button label */
  bookSerialCta?: string;
  onBookSerial?: (s: CareAiSuggestedSpecialty) => void;
  serialAutoBook?: boolean;
}) {
  if (!items?.length) return null;
  const bookLabel =
    bookSerialCta ?? (lang === "bn" ? "সিরিয়াল বুক করুন" : "Book serial");
  return (
    <div className="mt-2 space-y-1.5">
      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <UserRound className="h-3 w-3" />
        {title}
      </p>
      <ul className="space-y-1.5">
        {items.map((s) => {
          const name = lang === "bn" ? s.name_bn || s.name_en : s.name_en || s.name_bn;
          return (
            <li
              key={s.specialty_id}
              className="rounded-xl border bg-card px-3 py-2 space-y-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold truncate">{name}</p>
                {s.reason ? (
                  <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{s.reason}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center justify-end gap-1.5">
                {serialAutoBook && onBookSerial ? (
                  <button
                    type="button"
                    onClick={() => onBookSerial(s)}
                    className="shrink-0 rounded-lg bg-teal-700 text-white px-2.5 py-1.5 text-[11px] font-semibold hover:bg-teal-800"
                  >
                    {bookLabel}
                  </button>
                ) : null}
                <Link
                  to="/care"
                  search={{ tab: "doctors", specialty: s.specialty_id }}
                  className="shrink-0 rounded-lg bg-primary/10 text-primary px-2.5 py-1.5 text-[11px] font-semibold hover:bg-primary/15"
                >
                  {cta}
                </Link>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function CareAiFirstAidBlock({
  steps,
  buttonLabel,
  heading,
  lang,
  enabled = true,
}: {
  steps: string[] | null | undefined;
  buttonLabel: string;
  heading: string;
  lang: "bn" | "en";
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!enabled || !steps?.length) return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-teal-500/35 bg-teal-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-teal-900 dark:text-teal-100 hover:bg-teal-500/15"
        aria-expanded={open}
      >
        <Bandage className="h-3 w-3" />
        {buttonLabel}
        <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div className="mt-2 rounded-xl border border-teal-500/30 bg-teal-500/5 px-2.5 py-2 space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{heading}</p>
          <ol className="list-decimal pl-4 space-y-1 text-xs leading-relaxed">
            {steps.map((step, i) => (
              <li key={`${i}-${step.slice(0, 24)}`}>{step}</li>
            ))}
          </ol>
          <p className="text-[10px] text-muted-foreground pt-0.5">
            {lang === "bn"
              ? "শিক্ষামূলক ঘরোয়া যত্ন — ওষুধ/ডোজ নয়; জরুরি হলে হাসপাতালে যান।"
              : "Educational home care only — no drugs/doses; seek emergency care when needed."}
          </p>
        </div>
      ) : null}
    </div>
  );
}


