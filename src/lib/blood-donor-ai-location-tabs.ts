import type { BloodDonorAiIntentAction, BloodDonorAiSettings } from "@/lib/blood-donor-ai-settings";

export type BloodDonorAiLocationTab = {
  id: string;
  label_bn: string;
  label_en: string;
  /** English district name for DB resolution */
  district: string;
  /** English upazila label; empty = not pinned */
  upazila: string;
  intent: BloodDonorAiIntentAction;
  is_default?: boolean;
};

export type BloodDonorAiLocationPreset = {
  district: string;
  upazila: string;
};

export const DEFAULT_BLOOD_DONOR_LOCATION_TABS: BloodDonorAiLocationTab[] = [
  {
    id: "kishoreganj-university",
    label_bn: "কিশোরগঞ্জ বিশ্ববিদ্যালয় ডোনার",
    label_en: "Kishoreganj University Donors",
    district: "Kishoreganj",
    upazila: "Kishoreganj University",
    intent: "sms",
    is_default: true,
  },
  {
    id: "general",
    label_bn: "সাধারণ",
    label_en: "General",
    district: "",
    upazila: "",
    intent: "auto",
  },
];

export function normalizeLocationTabs(raw: unknown): BloodDonorAiLocationTab[] {
  const fallback = DEFAULT_BLOOD_DONOR_LOCATION_TABS;
  if (!Array.isArray(raw) || !raw.length) return fallback;
  const out: BloodDonorAiLocationTab[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const id = String(r.id ?? "").trim().slice(0, 48);
    const label_bn = String(r.label_bn ?? "").trim().slice(0, 120);
    const label_en = String(r.label_en ?? "").trim().slice(0, 120);
    if (!id || (!label_bn && !label_en)) continue;
    const intentRaw = String(r.intent ?? "auto");
    const intent: BloodDonorAiIntentAction =
      intentRaw === "sms" || intentRaw === "list" || intentRaw === "orgs"
        ? intentRaw
        : "auto";
    out.push({
      id,
      label_bn: label_bn || label_en,
      label_en: label_en || label_bn,
      district: String(r.district ?? "").trim().slice(0, 80),
      upazila: String(r.upazila ?? "").trim().slice(0, 120),
      intent,
      is_default: r.is_default === true,
    });
  }
  return out.length ? out.slice(0, 6) : fallback;
}

export function defaultLocationTabId(tabs: BloodDonorAiLocationTab[]): string {
  return tabs.find((t) => t.is_default)?.id ?? tabs[0]?.id ?? "general";
}

export function locationPresetForTab(
  tab: BloodDonorAiLocationTab | undefined,
): BloodDonorAiLocationPreset | undefined {
  if (!tab?.district?.trim()) return undefined;
  return {
    district: tab.district.trim(),
    upazila: tab.upazila.trim(),
  };
}

export function intentHintForTab(tab: BloodDonorAiLocationTab | undefined): string | undefined {
  if (!tab || tab.intent === "auto") return undefined;
  return tab.intent;
}

/** Seed chat history so district/upazila slots are filled for pinned tabs. */
export function buildLocationTabBootstrapApiText(
  tab: BloodDonorAiLocationTab,
  ui: BloodDonorAiSettings["ui"],
  lang: "bn" | "en",
): string {
  const lines: string[] = [];
  if (tab.district.trim()) {
    lines.push(
      `${ui.question_tag} ${lang === "bn" ? "কোন জেলায়?" : "Which district?"}`,
      `${ui.answer_inline} ${tab.district.trim()}`,
    );
  }
  if (tab.upazila.trim()) {
    lines.push(
      `${ui.question_tag} ${lang === "bn" ? "কোন উপজেলা?" : "Which upazila?"}`,
      `${ui.answer_inline} ${tab.upazila.trim()}`,
    );
  }
  lines.push(
    lang === "bn"
      ? `${tab.label_bn} — bulk SMS পাঠাতে চাই।`
      : `${tab.label_en} — send bulk SMS.`,
  );
  return lines.join("\n");
}
