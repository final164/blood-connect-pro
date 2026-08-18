/** Client-safe Gemini types and helpers — no server secrets or Vite imports. */

export type GeminiThinkingLevel = "minimal" | "low" | "medium" | "high";

export type GeminiSettings = {
  enabled: boolean;
  primary_model: string;
  fallback_model: string;
  match_model: string;
  thinking_level: GeminiThinkingLevel;
  max_output_tokens: number;
  max_catalog_items: number;
  match_enabled: boolean;
  prompt_chat_bn: string;
  prompt_chat_en: string;
  prompt_match: string;
};

export const DEFAULT_PROMPT_CHAT_BN = `আপনি BloodLink Care-এর AI স্বাস্থ্য ও ল্যাব-টেস্ট সহায়ক। আপনি ডাক্তার নন — রোগ নির্ণয়, ওষুধ বা ডোজ দেবেন না।
নিয়ম:
- reply: সংক্ষিপ্ত সহানুভূতিপূর্ণ সারাংশ।
- medical_advice (যখন চালু): সাধারণ স্বাস্থ্য তথ্য — জরুরি লক্ষণে হাসপাতাল যাওয়ার পরামর্শ।
- catalog_notes (যখন চালু): ক্যাটালগের টেস্টের নাম, প্রস্তুতি, কেন প্রাসঙ্গিক — সুন্দর বুলেট/অনুচ্ছেদ।
- suggested_tests: শুধু নিচের ক্যাটালগ থেকে; বাইরে কিছু উদ্ভাবন নিষেধ।
- ইতিহাস কম হলে বয়স, সময়কাল, জানা রোগ জিজ্ঞাসা করুন।
- শুধু JSON — markdown বা অতিরিক্ত টেক্সট নয়।

CATALOG (id|code|name_bn|name_en):
{{catalog}}

Language: {{lang}}`;

export const DEFAULT_PROMPT_CHAT_EN = `You are BloodLink Care's AI health & lab-test assistant. You are not a doctor — no diagnosis, prescriptions, or doses.
Rules:
- reply: short empathetic summary.
- medical_advice (when enabled): general wellness guidance; advise emergency care for red flags.
- catalog_notes (when enabled): formatted notes from catalog tests (names, prep, relevance).
- suggested_tests: catalog only — never invent tests.
- If history is thin, ask age, duration, and known conditions.
- JSON only — no markdown or extra text.

CATALOG (id|code|name_bn|name_en):
{{catalog}}

Language: {{lang}}`;

export const DEFAULT_PROMPT_MATCH = `Map lab-test mentions to catalog entries. Return JSON only:
{"suggested_tests":[{"catalog_id":"uuid","code":"CODE","reason":"why"}]}
Use only catalog ids. Never invent tests.

CATALOG:
{{catalog}}`;

export const DEFAULT_GEMINI_SETTINGS: GeminiSettings = {
  enabled: true,
  primary_model: "gemini-3.5-flash-lite",
  fallback_model: "gemini-3.5-flash",
  match_model: "gemini-3.5-flash-lite",
  thinking_level: "minimal",
  max_output_tokens: 1024,
  max_catalog_items: 120,
  match_enabled: false,
  prompt_chat_bn: DEFAULT_PROMPT_CHAT_BN,
  prompt_chat_en: DEFAULT_PROMPT_CHAT_EN,
  prompt_match: DEFAULT_PROMPT_MATCH,
};

const THINKING_LEVELS: GeminiThinkingLevel[] = ["minimal", "low", "medium", "high"];

/** Official Gemini generateContent model IDs for the admin catalog. */
export const GEMINI_MODEL_CATALOG_SEED: {
  slug: string;
  label: string;
  is_active: boolean;
  sort_order: number;
}[] = [
  { slug: "gemini-flash-latest", label: "Gemini Flash (latest alias)", is_active: true, sort_order: 5 },
  { slug: "gemini-flash-lite-latest", label: "Gemini Flash-Lite (latest alias)", is_active: true, sort_order: 6 },
  { slug: "gemini-pro-latest", label: "Gemini Pro (latest alias)", is_active: true, sort_order: 7 },
  { slug: "gemini-3.7-flash", label: "Gemini 3.7 Flash", is_active: true, sort_order: 8 },
  { slug: "gemini-3.6-flash", label: "Gemini 3.6 Flash (recommended)", is_active: true, sort_order: 10 },
  { slug: "gemini-3.5-flash", label: "Gemini 3.5 Flash", is_active: true, sort_order: 20 },
  { slug: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", is_active: true, sort_order: 30 },
  { slug: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", is_active: true, sort_order: 40 },
  { slug: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", is_active: true, sort_order: 50 },
  { slug: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", is_active: true, sort_order: 60 },
  { slug: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview", is_active: true, sort_order: 70 },
  { slug: "gemini-2.5-flash", label: "Gemini 2.5 Flash (unavailable to new keys)", is_active: false, sort_order: 80 },
  { slug: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (unavailable to new keys)", is_active: false, sort_order: 90 },
  { slug: "gemini-2.5-pro", label: "Gemini 2.5 Pro", is_active: true, sort_order: 100 },
  { slug: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", is_active: true, sort_order: 110 },
  { slug: "gemini-2.0-flash", label: "Gemini 2.0 Flash (legacy)", is_active: true, sort_order: 120 },
  { slug: "gemini-2.0-flash-001", label: "Gemini 2.0 Flash 001 (legacy)", is_active: true, sort_order: 130 },
  { slug: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite (legacy)", is_active: true, sort_order: 140 },
  { slug: "gemini-2.0-flash-lite-001", label: "Gemini 2.0 Flash-Lite 001 (legacy)", is_active: true, sort_order: 150 },
  { slug: "gemini-1.5-flash", label: "Gemini 1.5 Flash (legacy)", is_active: true, sort_order: 160 },
  { slug: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash 8B (legacy)", is_active: true, sort_order: 170 },
  { slug: "gemini-1.5-pro", label: "Gemini 1.5 Pro (legacy)", is_active: true, sort_order: 180 },
];

export function normalizeGeminiSettings(raw: unknown): GeminiSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const thinking = String(r.thinking_level ?? DEFAULT_GEMINI_SETTINGS.thinking_level) as GeminiThinkingLevel;
  return {
    enabled: r.enabled !== false,
    primary_model:
      typeof r.primary_model === "string" && r.primary_model
        ? r.primary_model
        : DEFAULT_GEMINI_SETTINGS.primary_model,
    fallback_model:
      typeof r.fallback_model === "string" && r.fallback_model
        ? r.fallback_model
        : DEFAULT_GEMINI_SETTINGS.fallback_model,
    match_model:
      typeof r.match_model === "string" && r.match_model ? r.match_model : DEFAULT_GEMINI_SETTINGS.match_model,
    thinking_level: THINKING_LEVELS.includes(thinking) ? thinking : "minimal",
    max_output_tokens: Math.min(
      4096,
      Math.max(256, Number(r.max_output_tokens) || DEFAULT_GEMINI_SETTINGS.max_output_tokens),
    ),
    max_catalog_items: Math.min(
      400,
      Math.max(20, Number(r.max_catalog_items) || DEFAULT_GEMINI_SETTINGS.max_catalog_items),
    ),
    match_enabled: r.match_enabled === true,
    prompt_chat_bn:
      typeof r.prompt_chat_bn === "string" && r.prompt_chat_bn.trim() ? r.prompt_chat_bn : DEFAULT_PROMPT_CHAT_BN,
    prompt_chat_en:
      typeof r.prompt_chat_en === "string" && r.prompt_chat_en.trim() ? r.prompt_chat_en : DEFAULT_PROMPT_CHAT_EN,
    prompt_match:
      typeof r.prompt_match === "string" && r.prompt_match.trim() ? r.prompt_match : DEFAULT_PROMPT_MATCH,
  };
}

export function fillPrompt(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function isQuotaLike(status: number, body: string): boolean {
  if (status === 429) return true;
  const t = body.toLowerCase();
  return (
    t.includes("resource_exhausted") ||
    t.includes("quota") ||
    t.includes("rate limit") ||
    t.includes("resource exhausted") ||
    t.includes("exceeded")
  );
}
