import { useMemo, useState } from "react";
import { Clock, MapPin, MapPinned } from "lucide-react";
import {
  applySmsTemplate,
  DEFAULT_MESSAGING_SETTINGS,
  type MessagingSettings,
} from "@/lib/messaging-settings";
import {
  extractPostNotes,
  getPostTextStyle,
  postStyleAlignClass,
  postStyleFontClass,
} from "@/lib/post-text-styles";

export type FeedPostFactSettings = Pick<
  MessagingSettings,
  | "feed_show_patient_line"
  | "feed_patient_label_bn"
  | "feed_patient_label_en"
  | "feed_show_blood_bags_line"
  | "feed_blood_bags_template_bn"
  | "feed_blood_bags_template_en"
  | "feed_show_reason_line"
  | "feed_reason_label_bn"
  | "feed_reason_label_en"
>;

export type RequestPostBodyProps = {
  patient_name: string;
  blood_group: string;
  bags_needed: number;
  hospital_name?: string | null;
  area?: string | null;
  city?: string | null;
  districtName?: string | null;
  needed_by?: string | null;
  notes?: string | null;
  need_reason_label?: string | null;
  lang: "bn" | "en";
  /** Compact preview (composer / save request) */
  compact?: boolean;
  className?: string;
  /** When set, overrides style parsed from notes */
  textStyleId?: string | null;
  /** Admin-controlled fact lines above notes */
  factSettings?: FeedPostFactSettings | null;
};

const COLLAPSE_CHARS = 170;

function truncateAtWord(text: string, max: number) {
  if (text.length <= max) return text;
  const slice = text.slice(0, max);
  const sp = Math.max(slice.lastIndexOf(" "), slice.lastIndexOf("\n"));
  return (sp > max * 0.55 ? slice.slice(0, sp) : slice).trimEnd();
}

/**
 * Facebook-style post body for blood requests.
 * Admin-controlled fact lines sit above notes; notes may use colorful backgrounds.
 */
export function RequestPostBody({
  patient_name,
  blood_group,
  bags_needed,
  hospital_name,
  area,
  city,
  districtName,
  needed_by,
  notes,
  need_reason_label,
  lang,
  compact = false,
  className = "",
  textStyleId,
  factSettings,
}: RequestPostBodyProps) {
  const [expanded, setExpanded] = useState(false);
  const parsed = useMemo(() => extractPostNotes(notes), [notes]);
  const cleanNotes = parsed.text;
  const style = getPostTextStyle(textStyleId ?? parsed.styleId);
  const styled = style.id !== "none" && !!cleanNotes;
  const facts = factSettings ?? DEFAULT_MESSAGING_SETTINGS;

  const hospital = hospital_name?.trim() || "";
  const upazila = area?.trim() || null;
  const district = districtName?.trim() || city?.trim() || null;
  const placeParts = [hospital, upazila, district].filter(Boolean);
  const mapsQuery = placeParts.join(", ");
  const mapsHref = mapsQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`
    : null;

  const patientLabel = lang === "bn" ? facts.feed_patient_label_bn : facts.feed_patient_label_en;
  const reasonLabel = lang === "bn" ? facts.feed_reason_label_bn : facts.feed_reason_label_en;
  const bagsLine = applySmsTemplate(
    lang === "bn" ? facts.feed_blood_bags_template_bn : facts.feed_blood_bags_template_en,
    { blood_group, bags: bags_needed },
  );

  const showPatient = facts.feed_show_patient_line && !!patient_name?.trim();
  const showBags = facts.feed_show_blood_bags_line && !!bagsLine;
  const showReason =
    facts.feed_show_reason_line && !!need_reason_label?.trim();
  const hasFacts = showPatient || showBags || showReason;

  const lineCount = cleanNotes.split("\n").length;
  const collapsible = !styled && (cleanNotes.length > COLLAPSE_CHARS || lineCount > 4);
  const shown =
    !collapsible || expanded ? cleanNotes : `${truncateAtWord(cleanNotes, COLLAPSE_CHARS)}…`;

  const outerPad = compact ? "px-0 pb-0" : "px-0 pb-2";
  const contentPad = compact ? "" : "px-3";

  return (
    <div className={`relative z-[1] ${outerPad} space-y-2 ${className}`}>
      {hasFacts && (
        <div className={`space-y-1 text-[15px] leading-snug text-foreground ${contentPad}`}>
          {showPatient && (
            <p>
              <span className="font-semibold text-foreground/90">{patientLabel}</span>{" "}
              <span className="font-medium">{patient_name.trim()}</span>
            </p>
          )}
          {showBags && <p className="font-semibold tabular-nums text-primary">{bagsLine}</p>}
          {showReason && (
            <p>
              <span className="font-semibold text-foreground/90">{reasonLabel}</span>{" "}
              <span>{need_reason_label!.trim()}</span>
            </p>
          )}
        </div>
      )}

      {cleanNotes ? (
        styled ? (
          <div
            className={`relative flex w-full items-center justify-center overflow-hidden ${
              compact ? "min-h-[140px] rounded-xl" : "min-h-[200px] sm:min-h-[220px]"
            } px-5 py-8`}
            style={{ background: style.bg, color: style.color }}
          >
            <p
              className={`w-full max-w-prose whitespace-pre-wrap break-words tracking-[-0.015em] ${postStyleFontClass(
                cleanNotes,
              )} ${postStyleAlignClass(cleanNotes)}`}
            >
              {cleanNotes}
            </p>
          </div>
        ) : (
          <div className={`text-[15px] leading-5 text-foreground tracking-[-0.01em] ${contentPad}`}>
            <p className="whitespace-pre-wrap break-words">{shown}</p>
            {collapsible && (
              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="mt-0.5 font-semibold text-foreground/80 hover:underline"
              >
                {expanded
                  ? lang === "bn"
                    ? "কম দেখুন"
                    : "See less"
                  : lang === "bn"
                    ? "আরও দেখুন"
                    : "See more"}
              </button>
            )}
          </div>
        )
      ) : null}

      <div className={`space-y-2 ${contentPad}`}>
        {(hospital || upazila || district) && (
          <p className="flex items-start gap-1.5 text-[13px] leading-snug text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 opacity-80" />
            <span className="min-w-0">
              {hospital && (
                <span className="inline-flex items-center gap-1 max-w-full align-middle">
                  <span className="font-medium text-foreground/85 break-words">{hospital}</span>
                  {mapsHref && (
                    <a
                      href={mapsHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title={lang === "bn" ? "ম্যাপে দেখুন" : "Open in Maps"}
                      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-primary hover:bg-primary/10"
                    >
                      <MapPinned className="h-3.5 w-3.5" />
                    </a>
                  )}
                </span>
              )}
              {(upazila || district) && (
                <span>
                  {hospital ? " · " : ""}
                  {[upazila, district].filter(Boolean).join(" · ")}
                </span>
              )}
            </span>
          </p>
        )}

        {needed_by && (
          <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5 shrink-0 opacity-80" />
            {new Date(needed_by).toLocaleString(lang === "bn" ? "bn-BD" : "en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        )}
      </div>
    </div>
  );
}
