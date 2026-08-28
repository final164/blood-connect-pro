import { formatTimeAmPm } from "@/lib/care-api";

/** "2:00 PM – 3:00 PM", or a single time when only one end is known. */
export function formatTimeWindow(
  start: string | null | undefined,
  end: string | null | undefined,
  lang: "bn" | "en" = "en",
): string {
  const s = formatTimeAmPm(start, lang);
  const e = formatTimeAmPm(end, lang);
  if (s && e) return `${s} – ${e}`;
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
 * "28 Aug 2026, 2:00 PM – 3:00 PM". Returns null when nothing is set so callers
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
