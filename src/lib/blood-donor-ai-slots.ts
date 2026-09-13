/** Canonical slot value: whole district (no upazila filter). */
export const UPAZILA_ALL_SLOT = "__all__";

export function isUpazilaAllValue(raw: string): boolean {
  const t = raw.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  return (
    lower === UPAZILA_ALL_SLOT ||
    lower === "all" ||
    lower === "any" ||
    /^সব/.test(t) ||
    /all\s*upazila/i.test(t) ||
    /whole\s*district/i.test(t) ||
    /entire\s*district/i.test(t) ||
    /সব\s*উপজেলা/.test(t)
  );
}

/** True when user chose a specific upazila or explicitly chose “all”. */
export function isUpazilaSlotSet(raw: string): boolean {
  return !!raw.trim();
}

/** DB filter: empty string = no upazila constraint. */
export function upazilaFilterForQuery(raw: string): string {
  if (!raw.trim() || isUpazilaAllValue(raw)) return "";
  return raw.trim();
}

export function parseUpazilaSlotInput(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (isUpazilaAllValue(t)) return UPAZILA_ALL_SLOT;
  return t;
}

export function upazilaSlotLabel(raw: string, lang: "bn" | "en"): string {
  if (isUpazilaAllValue(raw)) return lang === "bn" ? "সব উপজেলা" : "All upazilas";
  return raw.trim();
}
