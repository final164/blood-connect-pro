/** Substring hospital search — query may match anywhere in name / slug / upazila. */

export type HospitalSearchFields = {
  name_en: string;
  name_bn: string;
  slug: string;
  upazila?: string | null;
};

export function normalizeHospitalSearchQuery(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}

function haystack(h: HospitalSearchFields): { en: string; bn: string } {
  const en = [h.name_en, h.slug, h.upazila ?? ""].join(" ").toLowerCase();
  const bn = [h.name_bn, h.name_en, h.upazila ?? ""].join(" ");
  return { en, bn: bn.toLowerCase() };
}

/** True when every token appears somewhere in the hospital name (not prefix-only). */
export function hospitalMatchesSearchQuery(h: HospitalSearchFields, rawQuery: string): boolean {
  const q = normalizeHospitalSearchQuery(rawQuery);
  if (!q) return true;

  const { en, bn } = haystack(h);
  if (en.includes(q) || bn.includes(q)) return true;

  const tokens = q.split(" ").filter(Boolean);
  if (tokens.length <= 1) return false;

  return tokens.every((token) => en.includes(token) || bn.includes(token));
}

/** Prefix matches first, then substring matches (stable within each group). */
export function rankHospitalSearchResults<T extends HospitalSearchFields>(
  list: T[],
  rawQuery: string,
): T[] {
  const q = normalizeHospitalSearchQuery(rawQuery);
  if (!q) return list;

  const prefix: T[] = [];
  const contains: T[] = [];
  for (const h of list) {
    const { en, bn } = haystack(h);
    if (en.startsWith(q) || bn.startsWith(q)) prefix.push(h);
    else contains.push(h);
  }
  return [...prefix, ...contains];
}

export function filterHospitalsBySearch<T extends HospitalSearchFields>(
  list: T[],
  rawQuery: string,
): T[] {
  const q = rawQuery.trim();
  if (!q) return list;
  return rankHospitalSearchResults(
    list.filter((h) => hospitalMatchesSearchQuery(h, q)),
    q,
  );
}
