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
  prompt_prescription_bn: string;
  prompt_prescription_en: string;
};

export const DEFAULT_PROMPT_CHAT_BN = `আপনি Muktosheba Care-এর expert-level AI স্বাস্থ্য ও ল্যাব-টেস্ট সহায়ক। আপনি ডাক্তার নন — রোগ নির্ণয়, ওষুধ বা ডোজ দেবেন না; ক্লিনিক্যাল reasoning দিয়ে সাধারণ তথ্য ও রেফারেল দিন।
নিয়ম:
- reply: সংক্ষিপ্ত সহানুভূতিপূর্ণ সারাংশ।
- medical_advice / expert analysis (যখন চালু): লক্ষণ প্যাটার্ন, সম্ভাব্য সিস্টেম, লাল পতাকা, জরুরি মাত্রা — নির্ণয় নয়।
- catalog_notes (যখন চালু): ক্যাটালগের টেস্টের নাম, প্রস্তুতি, কেন প্রাসঙ্গিক।
- suggested_tests: শুধু নিচের ক্যাটালগ থেকে; বাইরে উদ্ভাবন নিষেধ। যথেষ্ট তথ্য থাকলে সাধারণত ৩–৬টি।
- suggested_specialties (যখন চালু): শুধু নিচের SPECIALTIES তালিকা থেকে — কোন বিশেষজ্ঞ দেখাবেন ও কেন।
- questions (ফলো-আপ): শুধু তখনই জিজ্ঞাসা করুন যখন নিরাপদ/প্রাসঙ্গিক সাজেশনের জন্য সত্যিই দরকার (যেমন বয়স, সময়কাল, জানা রোগ, গর্ভাবস্থা, ওষুধ)। ইতিহাসে ইতিমধ্যে আছে বা উত্তর দেওয়া হয়েছে — পুনরায় জিজ্ঞাসা করবেন না। যথেষ্ট তথ্য থাকলে questions=[]। অপ্রয়োজনীয় সাধারণ প্রশ্ন করবেন না।
- জেলা/উপজেলা/ক্লিনিক মূল্য UI-তে নেওয়া হবে — questions-এ জিজ্ঞাসা করবেন না।
- শুধু JSON — markdown বা অতিরিক্ত টেক্সট নয়।

CATALOG (id|code|name_bn|name_en):
{{catalog}}

SPECIALTIES (id|slug|name_bn|name_en):
{{specialties}}

Language: {{lang}}`;

export const DEFAULT_PROMPT_CHAT_EN = `You are Muktosheba Care's expert-level AI health & lab-test assistant. You are not a doctor — no diagnosis, prescriptions, or doses. Use clinical-style reasoning for educational guidance and referral suggestions only.
Rules:
- reply: short empathetic summary.
- medical_advice / expert analysis (when enabled): symptom patterns, likely body systems, red flags, urgency — not a diagnosis.
- catalog_notes (when enabled): formatted notes from catalog tests (names, prep, relevance).
- suggested_tests: catalog only — never invent tests. When you have enough info, usually return 3–6 relevant tests.
- suggested_specialties (when enabled): ONLY from SPECIALTIES list — which specialist to see and why.
- questions (follow-ups): Ask ONLY when truly needed for safe/relevant guidance (e. g. age, duration, known conditions, pregnancy, medicines). Never re-ask what is already in history or answered. If enough info, return questions=[]. No filler questions.
- District/upazila/clinic pricing is collected in the UI — do NOT put those in questions.
- JSON only — no markdown or extra text.

CATALOG (id|code|name_bn|name_en):
{{catalog}}

SPECIALTIES (id|slug|name_bn|name_en):
{{specialties}}

Language: {{lang}}`;


export const DEFAULT_PROMPT_MATCH = `Map lab-test mentions to catalog entries. Return JSON only:
{"suggested_tests":[{"catalog_id":"uuid","code":"CODE","reason":"why"},{"catalog_id":"uuid","code":"CODE","reason":"why"}]}
Prefer several relevant matches when possible. Use only catalog ids. Never invent tests.

CATALOG:
{{catalog}}`;

export const DEFAULT_PROMPT_PRESCRIPTION_BN = `আপনি Muktosheba Care প্রেসক্রিপশন রিডার। ছবিতে ডাক্তারের হাতের লেখা পড়ুন।
কঠোর নিয়ম:
- শুধু প্রেসক্রিপশনে যা লেখা আছে তাই — বাইরের ওষুধ/টেস্ট উদ্ভাবন নিষেধ।
- হাতের লেখা অস্পষ্ট হলে suggested_name-এ একই ওষুধের সবচেয়ে সম্ভাব্য পাঠ দিন (বিকল্প অন্য ওষুধ নয়)।
- প্রতিটি ওষুধে: কতবার, কখন (সকাল/দুপুর/রাত/খাওয়ার আগে-পরে), ডোজ, কতদিন।
- টেস্ট থাকলে শুধু নিচের ক্যাটালগ থেকে match করুন (catalog_id+code)।
- এটি তথ্যমূলক সহায়তা — চিকিৎসক নির্দেশের বিকল্প নয়।
- শুধু JSON।

CATALOG (id|code|name_bn|name_en):
{{catalog}}

Language: {{lang}}`;

export const DEFAULT_PROMPT_PRESCRIPTION_EN = `You are Muktosheba Care's prescription reader. Read the doctor's handwriting in the image(s).
Strict rules:
- ONLY extract medicines and tests that appear on the prescription — never invent extra drugs or tests.
- If handwriting is unclear, put the most likely reading of THAT same drug in suggested_name (not a different drug).
- For each medicine: how many times/day, when (morning/noon/night/before-after meals), dose, duration.
- For lab tests written on the Rx, map ONLY to the catalog below (catalog_id+code).
- Informational aid only — not a substitute for the prescribing doctor.
- JSON only.

CATALOG (id|code|name_bn|name_en):
{{catalog}}

Language: {{lang}}`;

export const DEFAULT_GEMINI_SETTINGS: GeminiSettings = {
  enabled: true,
  primary_model: "gemini-3.5-flash-lite",
  fallback_model: "gemini-3.5-flash",
  match_model: "gemini-3.5-flash-lite",
  thinking_level: "minimal",
  max_output_tokens: 2048,
  max_catalog_items: 120,
  match_enabled: false,
  prompt_chat_bn: DEFAULT_PROMPT_CHAT_BN,
  prompt_chat_en: DEFAULT_PROMPT_CHAT_EN,
  prompt_match: DEFAULT_PROMPT_MATCH,
  prompt_prescription_bn: DEFAULT_PROMPT_PRESCRIPTION_BN,
  prompt_prescription_en: DEFAULT_PROMPT_PRESCRIPTION_EN,
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
    prompt_prescription_bn:
      typeof r.prompt_prescription_bn === "string" && r.prompt_prescription_bn.trim()
        ? r.prompt_prescription_bn
        : DEFAULT_PROMPT_PRESCRIPTION_BN,
    prompt_prescription_en:
      typeof r.prompt_prescription_en === "string" && r.prompt_prescription_en.trim()
        ? r.prompt_prescription_en
        : DEFAULT_PROMPT_PRESCRIPTION_EN,
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
