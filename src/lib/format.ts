export function timeAgo(iso: string, lang: "bn" | "en" = "bn"): string {
  const d = new Date(iso).getTime();
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  const map: Array<[number, string, string]> = [
    [60, "সে", "s"],
    [60, "মি", "m"],
    [24, "ঘ", "h"],
    [7, "দি", "d"],
    [4, "সপ্তা", "w"],
    [12, "মা", "mo"],
  ];
  let v = s;
  for (const [step, bn, en] of map) {
    if (v < step) return `${v}${lang === "bn" ? bn : en}`;
    v = Math.floor(v / step);
  }
  return `${v}${lang === "bn" ? "বছ" : "y"}`;
}

export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
