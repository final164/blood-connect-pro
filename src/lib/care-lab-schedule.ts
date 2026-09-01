import { formatDateTimeWindow } from "@/lib/care-time-window";

export type LabScheduleFields = {
  collection_date?: string | null;
  collection_start?: string | null;
  collection_end?: string | null;
  delivery_date?: string | null;
  delivery_start?: string | null;
  delivery_end?: string | null;
};

export function labSchedulePendingLabel(lang: "bn" | "en"): string {
  return lang === "bn" ? "পেন্ডিং" : "Pending";
}

export function labSchedulePendingHint(lang: "bn" | "en"): string {
  return lang === "bn"
    ? "ল্যাব ডেস্ক নমুনা সংগ্রহ ও রিপোর্ট ডেলিভারির সময় নিশ্চিত করবে"
    : "The lab desk will confirm sample collection and report delivery times";
}

export function hasLabDeskDeliverySchedule(s: LabScheduleFields | null | undefined): boolean {
  return !!(s?.delivery_date && s?.delivery_start);
}

export function hasLabDeskCollectionSchedule(s: LabScheduleFields | null | undefined): boolean {
  return !!(s?.collection_date && s?.collection_start);
}

export function hasLabDeskSchedule(s: LabScheduleFields | null | undefined): boolean {
  return hasLabDeskCollectionSchedule(s) && hasLabDeskDeliverySchedule(s);
}

export function formatLabCollectionSchedule(
  s: LabScheduleFields | null | undefined,
  lang: "bn" | "en",
): string | null {
  return formatDateTimeWindow(s?.collection_date, s?.collection_start, s?.collection_end, lang);
}

export function formatLabDeliverySchedule(
  s: LabScheduleFields | null | undefined,
  lang: "bn" | "en",
): string | null {
  return formatDateTimeWindow(s?.delivery_date, s?.delivery_start, s?.delivery_end, lang);
}

export function formatLabDeliveryScheduleOrPending(
  s: LabScheduleFields | null | undefined,
  lang: "bn" | "en",
): string {
  return formatLabDeliverySchedule(s, lang) ?? labSchedulePendingLabel(lang);
}

export function formatLabCollectionScheduleOrPending(
  s: LabScheduleFields | null | undefined,
  lang: "bn" | "en",
): string {
  return formatLabCollectionSchedule(s, lang) ?? labSchedulePendingLabel(lang);
}
