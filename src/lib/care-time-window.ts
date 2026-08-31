import { formatTimeAmPm } from "@/lib/care-api";

const MONTH_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "6:00 pm - 8:00 pm", or a single time when only one end is known. */
export function formatTimeWindow(
  start: string | null | undefined,
  end: string | null | undefined,
  lang: "bn" | "en" = "en",
): string {
  const s = formatTimeAmPm(start, lang);
  const e = formatTimeAmPm(end, lang);
  if (s && e) return `${s} - ${e}`;
  return s || e || "";
}

function formatDate(date: string | null | undefined, lang: "bn" | "en"): string {
  if (!date) return "";
  const d = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(date);
  return d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * "28 Aug 2026, 2:00 pm - 3:00 pm". Returns null when nothing is set so callers
 * can fall back to a placeholder instead of printing a stray comma.
 */
export function formatDateTimeWindow(
  date: string | null | undefined,
  start: string | null | undefined,
  end: string | null | undefined,
  lang: "bn" | "en" = "en",
): string | null {
  const d = formatDate(date, lang);
  const w = formatTimeWindow(start, end, lang);
  if (d && w) return `${d}, ${w}`;
  return d || w || null;
}

/** "06 Sep" from ISO date `2026-09-06`. */
export function formatSerialDayMonth(date: string | null | undefined): string {
  if (!date) return "";
  const raw = String(date).slice(0, 10);
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    const m = raw.slice(5, 7);
    const day = raw.slice(8, 10);
    return day && m ? `${day} ${MONTH_EN[Number(m) - 1] ?? m}` : raw;
  }
  const day = String(d.getDate()).padStart(2, "0");
  const mon = MONTH_EN[d.getMonth()] ?? "";
  return `${day} ${mon}`;
}

/** "06 Sep serial" / "06 Sep সিরিয়াল" */
export function formatSerialDateChip(date: string | null | undefined, lang: "bn" | "en" = "en"): string {
  const dm = formatSerialDayMonth(date);
  if (!dm) return "";
  return `${dm} ${lang === "bn" ? "সিরিয়াল" : "serial"}`;
}
