/** Fuzzy geo matching for Blood Donor AI (district + upazila). */

export type GeoCandidate = {
  id?: string;
  name_bn: string;
  name_en: string;
  slug?: string;
};

function normalizeGeoText(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[।.,;:!?()[\]{}'"`]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/university|বিশ্ববিদ্যালয়|বিশ্ববিদ্যালয়/gi, "uni")
    .replace(/upazila|উপজেলা|থানা/gi, "")
    .replace(/district|জেলা/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Simple edit-distance (Levenshtein), capped for short labels. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[] = new Array(cols);
  for (let j = 0; j < cols; j++) dp[j] = j;
  for (let i = 1; i < rows; i++) {
    let prev = dp[0]!;
    dp[0] = i;
    for (let j = 1; j < cols; j++) {
      const tmp = dp[j]!;
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j]! + 1, dp[j - 1]! + 1, prev + cost);
      prev = tmp;
    }
  }
  return dp[cols - 1]!;
}

/** 0–1 score; higher is better. */
export function geoMatchScore(query: string, candidate: GeoCandidate): number {
  const q = normalizeGeoText(query);
  if (!q) return 0;
  const names = [candidate.name_en, candidate.name_bn, candidate.slug ?? ""]
    .map(normalizeGeoText)
    .filter(Boolean);
  let best = 0;
  for (const n of names) {
    if (n === q) return 1;
    if (n.startsWith(q) || q.startsWith(n)) {
      best = Math.max(best, 0.92);
      continue;
    }
    if (n.includes(q) || q.includes(n)) {
      const ratio = Math.min(n.length, q.length) / Math.max(n.length, q.length, 1);
      best = Math.max(best, 0.55 + ratio * 0.35);
      continue;
    }
    const dist = editDistance(q, n);
    const maxLen = Math.max(q.length, n.length, 1);
    const sim = 1 - dist / maxLen;
    if (sim >= 0.55) best = Math.max(best, sim * 0.9);
  }
  return best;
}

export function pickBestGeoMatch<T extends GeoCandidate>(
  query: string,
  candidates: T[],
  minScore = 0.55,
): { hit: T; score: number } | null {
  const q = query.trim();
  if (!q || !candidates.length) return null;
  let best: T | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = geoMatchScore(q, c);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  if (!best || bestScore < minScore) return null;
  return { hit: best, score: bestScore };
}

/** True when stored upazila roughly matches the resolved filter label. */
export function upazilaRoughlyMatches(stored: string | null | undefined, filter: string): boolean {
  if (!filter.trim()) return true;
  if (!stored?.trim()) return false;
  const score = geoMatchScore(filter, {
    name_en: stored,
    name_bn: stored,
  });
  return score >= 0.55;
}
