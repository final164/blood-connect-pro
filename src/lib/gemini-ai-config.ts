import {
  fillPrompt,
  normalizeGeminiSettings,
  type GeminiSettings,
} from "@/lib/gemini-shared";

export type GeminiAiFeatures = {
  medical_advice: boolean;
  catalog_notes: boolean;
  test_suggestions: boolean;
  follow_up_questions: boolean;
  bundle_offer: boolean;
  match_fallback: boolean;
  /** Suggest which Care specialty / specialist to see */
  specialty_suggestions: boolean;
  /** Structured expert-style symptom analysis (urgency, red flags, systems) */
  expert_analysis: boolean;
  /** Home / primary first-aid steps behind a UI button */
  first_aid: boolean;
  /** Allow camera/photo prescription upload in AI chat */
  prescription_scan: boolean;
  /** Extract medicines + schedule from prescription image */
  prescription_medicines: boolean;
  /** Extract / map lab tests from prescription for cheap booking */
  prescription_tests: boolean;
};

export type GeminiUiCopy = {
  welcome_bn: string;
  welcome_en: string;
  disclaimer_bn: string;
  disclaimer_en: string;
  thinking_bn: string;
  thinking_en: string;
  page_title_bn: string;
  page_title_en: string;
  medical_heading_bn: string;
  medical_heading_en: string;
  catalog_heading_bn: string;
  catalog_heading_en: string;
  suggestions_heading_bn: string;
  suggestions_heading_en: string;
  bundle_cta_bn: string;
  bundle_cta_en: string;
  specialty_heading_bn: string;
  specialty_heading_en: string;
  expert_heading_bn: string;
  expert_heading_en: string;
  specialty_cta_bn: string;
  specialty_cta_en: string;
  first_aid_heading_bn: string;
  first_aid_heading_en: string;
  first_aid_button_bn: string;
  first_aid_button_en: string;
  prescription_attach_bn: string;
  prescription_attach_en: string;
  prescription_camera_bn: string;
  prescription_camera_en: string;
  prescription_photos_bn: string;
  prescription_photos_en: string;
  medicines_heading_bn: string;
  medicines_heading_en: string;
  prescription_disclaimer_bn: string;
  prescription_disclaimer_en: string;
  prescription_analyzing_bn: string;
  prescription_analyzing_en: string;
  lab_geo_title_bn: string;
  lab_geo_title_en: string;
  lab_geo_hint_bn: string;
  lab_geo_hint_en: string;
  lab_clinics_heading_bn: string;
  lab_clinics_heading_en: string;
  lab_geo_cta_bn: string;
  lab_geo_cta_en: string;
};

export const DEFAULT_GEMINI_FEATURES: GeminiAiFeatures = {
  medical_advice: true,
  catalog_notes: true,
  test_suggestions: true,
  follow_up_questions: true,
  bundle_offer: true,
  match_fallback: false,
  specialty_suggestions: true,
  expert_analysis: true,
  first_aid: true,
  prescription_scan: true,
  prescription_medicines: true,
  prescription_tests: true,
};

export const DEFAULT_GEMINI_UI: GeminiUiCopy = {
  welcome_bn:
    "আপনার লক্ষণ বা সমস্যা লিখুন। প্রয়োজন হলে আমি বয়স/সময়কালের মতো সংক্ষিপ্ত প্রশ্ন করব, তারপর বিশেষজ্ঞ ও টেস্ট সাজেশন দেব। টেস্ট লাগলে জেলা ও উপজেলা দিয়ে নিকটস্থ কম মূল্যের ভালো ল্যাব দেখাব। চিকিৎসকের বিকল্প নয় — জরুরি হলে হাসপাতালে যান।",
  welcome_en:
    "Describe your symptoms. I’ll only ask short follow-ups when needed (age, duration, etc.), then suggest specialists and tests. When tests are needed, pick district & upazila for nearby quality labs at the best price. Not a substitute for a doctor — seek emergency care when needed.",
  disclaimer_bn: "তথ্যমূলক সহায়তা; চিকিৎসকের পরামর্শের বিকল্প নয়।",
  disclaimer_en: "Informational support only — not a substitute for professional medical care.",
  thinking_bn: "আপনার জন্য expert বিশ্লেষণ প্রস্তুত করছি…",
  thinking_en: "Preparing expert-level guidance…",
  page_title_bn: "AI স্বাস্থ্য ও টেস্ট সহায়ক",
  page_title_en: "AI health & test assistant",
  medical_heading_bn: "স্বাস্থ্য তথ্য",
  medical_heading_en: "Health guidance",
  catalog_heading_bn: "ক্যাটালগ ভিত্তিক তথ্য",
  catalog_heading_en: "Catalog-based notes",
  suggestions_heading_bn: "সাজেস্টেড টেস্ট",
  suggestions_heading_en: "Suggested tests",
  bundle_cta_bn: "এই টেস্টগুলো সবচেয়ে ভালো ও কম টাকায় বুক করব?",
  bundle_cta_en: "Book these tests at the best price together?",
  specialty_heading_bn: "কোন বিশেষজ্ঞ দেখাবেন",
  specialty_heading_en: "Which specialist to see",
  expert_heading_bn: "বিশেষজ্ঞ-পর্যায়ের বিশ্লেষণ",
  expert_heading_en: "Expert-level analysis",
  specialty_cta_bn: "ডাক্তার খুঁজুন",
  specialty_cta_en: "Find doctors",
  first_aid_heading_bn: "প্রাথমিক চিকিৎসা",
  first_aid_heading_en: "Primary first aid",
  first_aid_button_bn: "প্রাথমিক চিকিৎসা",
  first_aid_button_en: "Primary first aid",
  prescription_attach_bn: "প্রেসক্রিপশন অ্যাটাচ",
  prescription_attach_en: "Attach prescription",
  prescription_camera_bn: "ক্যামেরা",
  prescription_camera_en: "Camera",
  prescription_photos_bn: "গ্যালারি / ফটো",
  prescription_photos_en: "Photos / gallery",
  medicines_heading_bn: "প্রেসক্রিপশনের ওষুধ",
  medicines_heading_en: "Prescription medicines",
  prescription_disclaimer_bn:
    "হাতের লেখার সম্ভাব্য পাঠ — শুধু প্রেসক্রিপশনে যা আছে। চিকিৎসকের নির্দেশের বিকল্প নয়।",
  prescription_disclaimer_en:
    "Likely reading of handwriting — only what is on the Rx. Not a substitute for your doctor.",
  prescription_analyzing_bn: "প্রেসক্রিপশন পড়ছি…",
  prescription_analyzing_en: "Reading your prescription…",
  lab_geo_title_bn: "নিকটস্থ ল্যাব সাজেশনের জন্য জেলা ও উপজেলা নির্বাচন করুন",
  lab_geo_title_en: "Select district & upazila for nearby lab suggestions",
  lab_geo_hint_bn:
    "আমি আপনার নিকটস্থ হাসপাতাল/ক্লিনিকে সবচেয়ে কম মূল্যে ভালো মানের টেস্ট সাজেশন দেব — তারপর সরাসরি বুক করতে পারবেন।",
  lab_geo_hint_en:
    "I'll suggest quality tests at the lowest prices near you — then you can book directly.",
  lab_clinics_heading_bn: "নিকটস্থ কম মূল্যের ভেরিফায়েড ক্লিনিক/ল্যাব",
  lab_clinics_heading_en: "Nearby low-price verified clinics/labs",
  lab_geo_cta_bn: "সাজেশন দেখুন",
  lab_geo_cta_en: "Show suggestions",
};

export type GeminiSettingsExtended = GeminiSettings & {
  features: GeminiAiFeatures;
  ui: GeminiUiCopy;
  follow_up: GeminiFollowUpSettings;
  max_questions: number;
  max_suggestions: number;
  max_specialties: number;
  max_medicines: number;
  max_prescription_images: number;
  /** Max image edge (px) before upload — client should compress */
  prescription_image_max_px: number;
  /** Days to keep AI chat in the user's browser (localStorage). No server storage. */
  chat_persist_days: number;
};

export type FollowUpKind = "duration" | "yes_no" | "age" | "severity" | "text";

export type GeminiFollowUpKindSettings = {
  /** One regex per line (case-insensitive). */
  patterns: string;
  quick_replies_bn: string;
  quick_replies_en: string;
  placeholder_bn: string;
  placeholder_en: string;
};

export type GeminiFollowUpSettings = {
  panel_title_bn: string;
  panel_title_en: string;
  question_label_bn: string;
  question_label_en: string;
  close_label_bn: string;
  close_label_en: string;
  chip_hint_bn: string;
  chip_hint_en: string;
  answer_tag_bn: string;
  answer_tag_en: string;
  question_tag_bn: string;
  question_tag_en: string;
  answer_inline_bn: string;
  answer_inline_en: string;
  bubble_prefix: string;
  bubble_caption_bn: string;
  bubble_caption_en: string;
  duration: GeminiFollowUpKindSettings;
  yes_no: GeminiFollowUpKindSettings;
  age: GeminiFollowUpKindSettings;
  severity: GeminiFollowUpKindSettings;
  text_placeholder_bn: string;
  text_placeholder_en: string;
  mode_single_bn: string;
  mode_single_en: string;
  mode_batch_bn: string;
  mode_batch_en: string;
  batch_submit_bn: string;
  batch_submit_en: string;
  batch_hint_bn: string;
  batch_hint_en: string;
  composer_hint_bn: string;
  composer_hint_en: string;
};

const DEFAULT_FOLLOWUP_KIND = (patterns: string, quick_bn: string[], quick_en: string[], ph_bn: string, ph_en: string): GeminiFollowUpKindSettings => ({
  patterns,
  quick_replies_bn: quick_bn.join("\n"),
  quick_replies_en: quick_en.join("\n"),
  placeholder_bn: ph_bn,
  placeholder_en: ph_en,
});

export const DEFAULT_GEMINI_FOLLOWUP: GeminiFollowUpSettings = {
  panel_title_bn: "আরও জানতে চাই — একটি প্রশ্নে ট্যাপ করুন অথবা সবগুলো একসাথে উত্তর দিন",
  panel_title_en: "Tell us more — tap one question or answer all together",
  question_label_bn: "প্রশ্ন:",
  question_label_en: "Question:",
  close_label_bn: "বন্ধ",
  close_label_en: "Close",
  chip_hint_bn: "দ্রুত চিপে ট্যাপ করুন অথবা নিজের ভাষায় উত্তর লিখুন।",
  chip_hint_en: "Tap a quick chip or type your own answer.",
  answer_tag_bn: "[উত্তর]",
  answer_tag_en: "[Answer]",
  question_tag_bn: "প্রশ্ন:",
  question_tag_en: "Question:",
  answer_inline_bn: "উত্তর:",
  answer_inline_en: "Answer:",
  bubble_prefix: "↳",
  bubble_caption_bn: "ফলো-আপ উত্তর",
  bubble_caption_en: "Follow-up answer",
  duration: DEFAULT_FOLLOWUP_KIND(
    "কত\\s*দিন\nকতদিন\nকত\\s*দিন\\s*ধরে\nকত\\s*ক্ষণ\nhow\\s+long\nsince\\s+when\nduration\nhow\\s+many\\s+days\nধরে\\s*হচ্ছে\nহচ্ছে\\s*কত",
    ["১–২ দিন", "৩–৭ দিন", "১–২ সপ্তাহ", "১ মাস+", "৬ মাস+"],
    ["1–2 days", "3–7 days", "1–2 weeks", "1 month+", "6 months+"],
    "যেমন: ২ সপ্তাহ ধরে",
    "e.g. for about 2 weeks",
  ),
  yes_no: DEFAULT_FOLLOWUP_KIND(
    "^আপনার\\s*কি\n^আপনি\\s*কি\n^do\\s+you\n^have\\s+you\n^is\\s+there\n^are\\s+you\n^any\\s+\nআছে\\s*কি\nকি\\s*আছে\nহয়\\s*কি",
    ["হ্যাঁ", "না", "মাঝে মাঝে", "নিশ্চিত নই"],
    ["Yes", "No", "Sometimes", "Not sure"],
    "বিস্তারিত লিখুন (ঐচ্ছিক)",
    "Add details (optional)",
  ),
  age: DEFAULT_FOLLOWUP_KIND(
    "বয়স\nage\nবছর\\s*বয়স\nকত\\s*বছর\\s*বয়স",
    ["১৮–৩০", "৩১–৪৫", "৪৬–৬০", "৬০+"],
    ["18–30", "31–45", "46–60", "60+"],
    "বয়স লিখুন",
    "Enter age",
  ),
  severity: DEFAULT_FOLLOWUP_KIND(
    "তীব্র\nseverity\nintensity\nকত\\s*টা\\s*ব্যথা\nকেমন\\s*ব্যথা\nlevel",
    ["হালকা", "মাঝারি", "তীব্র", "অত্যন্ত তীব্র"],
    ["Mild", "Moderate", "Severe", "Very severe"],
    "যেমন: মাঝারি, রাতে বাড়ে",
    "e.g. moderate, worse at night",
  ),
  text_placeholder_bn: "আপনার উত্তর লিখুন…",
  text_placeholder_en: "Type your answer…",
  mode_single_bn: "একটি",
  mode_single_en: "One",
  mode_batch_bn: "সবগুলো",
  mode_batch_en: "All",
  batch_submit_bn: "সব উত্তর পাঠান",
  batch_submit_en: "Send all answers",
  batch_hint_bn: "প্রতিটি প্রশ্নের উত্তর লিখুন, তারপর একসাথে পাঠান।",
  batch_hint_en: "Answer each question, then send together.",
  composer_hint_bn: "Enter পাঠান · Shift+Enter নতুন লাইন",
  composer_hint_en: "Enter to send · Shift+Enter new line",
};

const FOLLOWUP_KIND_KEYS = ["duration", "yes_no", "age", "severity"] as const;
const KIND_INFER_ORDER: FollowUpKind[] = ["duration", "age", "severity", "yes_no", "text"];

function splitLines(raw: string) {
  return raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

function normalizeKindSettings(raw: unknown, fallback: GeminiFollowUpKindSettings): GeminiFollowUpKindSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (key: keyof GeminiFollowUpKindSettings) => {
    const v = r[key];
    return typeof v === "string" && v.trim() ? v : fallback[key];
  };
  return {
    patterns: pick("patterns"),
    quick_replies_bn: pick("quick_replies_bn"),
    quick_replies_en: pick("quick_replies_en"),
    placeholder_bn: pick("placeholder_bn"),
    placeholder_en: pick("placeholder_en"),
  };
}

export function normalizeGeminiFollowUp(raw: unknown): GeminiFollowUpSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const f = (r.follow_up && typeof r.follow_up === "object" ? r.follow_up : r) as Record<string, unknown>;
  const out = { ...DEFAULT_GEMINI_FOLLOWUP };
  const stringKeys = [
    "panel_title_bn",
    "panel_title_en",
    "question_label_bn",
    "question_label_en",
    "close_label_bn",
    "close_label_en",
    "chip_hint_bn",
    "chip_hint_en",
    "answer_tag_bn",
    "answer_tag_en",
    "question_tag_bn",
    "question_tag_en",
    "answer_inline_bn",
    "answer_inline_en",
    "bubble_prefix",
    "bubble_caption_bn",
    "bubble_caption_en",
    "text_placeholder_bn",
    "text_placeholder_en",
    "mode_single_bn",
    "mode_single_en",
    "mode_batch_bn",
    "mode_batch_en",
    "batch_submit_bn",
    "batch_submit_en",
    "batch_hint_bn",
    "batch_hint_en",
    "composer_hint_bn",
    "composer_hint_en",
  ] as const;
  for (const key of stringKeys) {
    if (typeof f[key] === "string" && (f[key] as string).trim()) out[key] = f[key] as string;
  }
  for (const kind of FOLLOWUP_KIND_KEYS) {
    out[kind] = normalizeKindSettings(f[kind], DEFAULT_GEMINI_FOLLOWUP[kind]);
  }
  return out;
}

export type FollowUpPublicConfig = {
  panelTitle: string;
  questionLabel: string;
  closeLabel: string;
  chipHint: string;
  answerTag: string;
  questionTag: string;
  answerInline: string;
  bubblePrefix: string;
  bubbleCaption: string;
  textPlaceholder: string;
  modeSingle: string;
  modeBatch: string;
  batchSubmit: string;
  batchHint: string;
  composerHint: string;
  kinds: Record<
    Exclude<FollowUpKind, "text">,
    { patterns: RegExp[]; quickReplies: string[]; placeholder: string }
  >;
};

export function resolveFollowUpForLang(settings: GeminiFollowUpSettings, lang: "bn" | "en"): FollowUpPublicConfig {
  const compile = (patterns: string) =>
    splitLines(patterns)
      .map((p) => {
        try {
          return new RegExp(p, "i");
        } catch {
          return null;
        }
      })
      .filter((x): x is RegExp => x !== null);

  const kind = (k: (typeof FOLLOWUP_KIND_KEYS)[number]) => ({
    patterns: compile(settings[k].patterns),
    quickReplies: splitLines(lang === "bn" ? settings[k].quick_replies_bn : settings[k].quick_replies_en),
    placeholder: lang === "bn" ? settings[k].placeholder_bn : settings[k].placeholder_en,
  });

  return {
    panelTitle: lang === "bn" ? settings.panel_title_bn : settings.panel_title_en,
    questionLabel: lang === "bn" ? settings.question_label_bn : settings.question_label_en,
    closeLabel: lang === "bn" ? settings.close_label_bn : settings.close_label_en,
    chipHint: lang === "bn" ? settings.chip_hint_bn : settings.chip_hint_en,
    answerTag: lang === "bn" ? settings.answer_tag_bn : settings.answer_tag_en,
    questionTag: lang === "bn" ? settings.question_tag_bn : settings.question_tag_en,
    answerInline: lang === "bn" ? settings.answer_inline_bn : settings.answer_inline_en,
    bubblePrefix: settings.bubble_prefix || "↳",
    bubbleCaption: lang === "bn" ? settings.bubble_caption_bn : settings.bubble_caption_en,
    textPlaceholder: lang === "bn" ? settings.text_placeholder_bn : settings.text_placeholder_en,
    modeSingle: lang === "bn" ? settings.mode_single_bn : settings.mode_single_en,
    modeBatch: lang === "bn" ? settings.mode_batch_bn : settings.mode_batch_en,
    batchSubmit: lang === "bn" ? settings.batch_submit_bn : settings.batch_submit_en,
    batchHint: lang === "bn" ? settings.batch_hint_bn : settings.batch_hint_en,
    composerHint: lang === "bn" ? settings.composer_hint_bn : settings.composer_hint_en,
    kinds: {
      duration: kind("duration"),
      yes_no: kind("yes_no"),
      age: kind("age"),
      severity: kind("severity"),
    },
  };
}

export { KIND_INFER_ORDER, FOLLOWUP_KIND_KEYS, splitLines as followUpSplitLines };

function pickBool(raw: Record<string, unknown>, key: keyof GeminiAiFeatures, fallback: boolean) {
  const f = raw.features;
  if (f && typeof f === "object" && key in (f as object)) {
    return (f as Record<string, unknown>)[key] !== false;
  }
  if (key === "match_fallback") return raw.match_enabled === true;
  return fallback;
}

export function normalizeGeminiFeatures(raw: unknown): GeminiAiFeatures {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    medical_advice: pickBool(r, "medical_advice", DEFAULT_GEMINI_FEATURES.medical_advice),
    catalog_notes: pickBool(r, "catalog_notes", DEFAULT_GEMINI_FEATURES.catalog_notes),
    test_suggestions: pickBool(r, "test_suggestions", DEFAULT_GEMINI_FEATURES.test_suggestions),
    follow_up_questions: pickBool(r, "follow_up_questions", DEFAULT_GEMINI_FEATURES.follow_up_questions),
    bundle_offer: pickBool(r, "bundle_offer", DEFAULT_GEMINI_FEATURES.bundle_offer),
    match_fallback: pickBool(r, "match_fallback", DEFAULT_GEMINI_FEATURES.match_fallback),
    specialty_suggestions: pickBool(r, "specialty_suggestions", DEFAULT_GEMINI_FEATURES.specialty_suggestions),
    expert_analysis: pickBool(r, "expert_analysis", DEFAULT_GEMINI_FEATURES.expert_analysis),
    first_aid: pickBool(r, "first_aid", DEFAULT_GEMINI_FEATURES.first_aid),
    prescription_scan: pickBool(r, "prescription_scan", DEFAULT_GEMINI_FEATURES.prescription_scan),
    prescription_medicines: pickBool(r, "prescription_medicines", DEFAULT_GEMINI_FEATURES.prescription_medicines),
    prescription_tests: pickBool(r, "prescription_tests", DEFAULT_GEMINI_FEATURES.prescription_tests),
  };
}

export function normalizeGeminiUi(raw: unknown): GeminiUiCopy {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const u = (r.ui && typeof r.ui === "object" ? r.ui : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_GEMINI_UI };
  for (const key of Object.keys(DEFAULT_GEMINI_UI) as (keyof GeminiUiCopy)[]) {
    if (typeof u[key] === "string" && (u[key] as string).trim()) out[key] = u[key] as string;
  }
  return out;
}

export function extendGeminiSettings(base: GeminiSettings, raw: unknown): GeminiSettingsExtended {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const features = normalizeGeminiFeatures(raw);
  return {
    ...base,
    features,
    ui: normalizeGeminiUi(raw),
    follow_up: normalizeGeminiFollowUp(raw),
    match_enabled: features.match_fallback,
    max_questions: Math.min(6, Math.max(0, Number(r.max_questions ?? 4))),
    max_suggestions: Math.min(12, Math.max(0, Number(r.max_suggestions ?? 8))),
    max_specialties: Math.min(6, Math.max(0, Number(r.max_specialties ?? 3))),
    max_medicines: Math.min(30, Math.max(0, Number(r.max_medicines ?? 15))),
    max_prescription_images: Math.min(5, Math.max(1, Number(r.max_prescription_images ?? 2) || 2)),
    prescription_image_max_px: Math.min(2048, Math.max(800, Number(r.prescription_image_max_px ?? 1600) || 1600)),
    chat_persist_days: Math.min(90, Math.max(1, Number(r.chat_persist_days ?? 7) || 7)),
  };
}

export type CareAiUrgency = "routine" | "soon" | "urgent" | "emergency";

export function buildJsonSchema(features: GeminiAiFeatures): string {
  const fields = ['"reply":"string — short friendly summary"'];
  // Put questions early so they are less likely to be truncated by max_output_tokens.
  if (features.follow_up_questions) {
    fields.push(
      '"need_more_info":boolean — true only if you truly cannot safely guide without answers',
      '"questions":["string"] — ask ONLY missing clinically useful items; return [] when enough info already exists in history',
    );
  }
  if (features.medical_advice) {
    fields.push('"medical_advice":"string — general wellness guidance, not diagnosis, no prescription"');
  }
  if (features.expert_analysis) {
    fields.push(
      '"urgency":"routine|soon|urgent|emergency"',
      '"red_flags":["string"] — warning signs that need prompt care',
      '"likely_systems":["string"] — body systems / clinical domains involved',
      '"analysis_summary":"string — expert-style structured reasoning (educational, not diagnosis)"',
    );
  }
  if (features.catalog_notes) {
    fields.push('"catalog_notes":"string — formatted notes using ONLY catalog tests (names, prep, why relevant)"');
  }
  if (features.test_suggestions) {
    fields.push(
      '"suggested_tests":[{"catalog_id":"uuid","code":"CODE","reason":"why"},{"catalog_id":"uuid","code":"CODE","reason":"why"}] — prefer 3–6 relevant catalog tests when symptoms are clear',
    );
  }
  if (features.specialty_suggestions) {
    fields.push(
      '"suggested_specialties":[{"specialty_id":"uuid","slug":"slug","reason":"why this specialist"}] — ONLY from SPECIALTIES list',
    );
  }
  if (features.first_aid) {
    fields.push(
      '"first_aid":["string"] — 3–7 practical home / primary first-aid steps for this concern (no prescription drugs or doses; include when to seek care)',
    );
  }
  if (features.bundle_offer && features.test_suggestions) {
    fields.push('"offer_bundle":boolean');
  }
  if (features.prescription_medicines) {
    fields.push(
      '"medicines":[{"name_as_written":"string","suggested_name":"clarified same drug only","dose":"string","frequency":"e.g. 1-0-1 or twice daily","timing":"when to take","duration":"string","notes":"string"}] — ONLY drugs visible on the prescription; never invent extras',
    );
  }
  if (features.prescription_tests || features.test_suggestions) {
    // tests already covered when test_suggestions; for prescription mode ensure present
    if (!features.test_suggestions) {
      fields.push(
        '"suggested_tests":[{"catalog_id":"uuid","code":"CODE","reason":"from Rx"}] — ONLY catalog matches for tests written on the Rx',
      );
    }
  }
  return `{${fields.join(",")}}`;
}

export function buildPrescriptionSystemPrompt(
  settings: GeminiSettingsExtended,
  lang: "bn" | "en",
  catalog: string,
) {
  const template = lang === "bn" ? settings.prompt_prescription_bn : settings.prompt_prescription_en;
  const featureLines: string[] = [];
  if (settings.features.prescription_medicines) {
    featureLines.push(
      lang === "bn"
        ? `- medicines: সর্বোচ্চ ${settings.max_medicines}টি। শুধু ছবিতে দেখা ওষুধ। suggested_name = একই ওষুধের স্পষ্ট পাঠ (অন্য ওষুধ নয়)। frequency/timing/dose/duration পূরণ করুন।`
        : `- medicines: max ${settings.max_medicines}. Only drugs visible in the image. suggested_name = clarified reading of the SAME drug. Fill frequency/timing/dose/duration.`,
    );
  } else {
    featureLines.push(lang === "bn" ? "- medicines: []" : "- medicines: []");
  }
  if (settings.features.prescription_tests) {
    featureLines.push(
      lang === "bn"
        ? `- suggested_tests: প্রেসক্রিপশনে লেখা টেস্টগুলো ক্যাটালগ থেকে match (সর্বোচ্চ ${settings.max_suggestions})।`
        : `- suggested_tests: map Rx-written tests to catalog only (max ${settings.max_suggestions}).`,
    );
  } else {
    featureLines.push(lang === "bn" ? "- suggested_tests: []" : "- suggested_tests: []");
  }
  if (settings.features.bundle_offer && settings.features.prescription_tests) {
    featureLines.push(
      lang === "bn"
        ? "- offer_bundle=true যদি কোনো ক্যাটালগ টেস্ট ম্যাচ হয় (বুকিং ফর্ম দেখানোর জন্য)।"
        : "- offer_bundle=true if any catalog tests match (so the booking form can open).",
    );
  }
  featureLines.push(
    lang === "bn"
      ? "- reply: সংক্ষিপ্ত সারাংশ যে প্রেসক্রিপশন পড়া হয়েছে।"
      : "- reply: short summary that the prescription was read.",
  );

  const schema = buildJsonSchema({
    ...settings.features,
    medical_advice: false,
    catalog_notes: false,
    follow_up_questions: false,
    specialty_suggestions: false,
    expert_analysis: false,
    first_aid: false,
    test_suggestions: settings.features.prescription_tests,
    prescription_medicines: settings.features.prescription_medicines,
  });

  const addon =
    lang === "bn"
      ? `\n\nENABLED OUTPUT (JSON only):\n${schema}\n\nFeature rules:\n${featureLines.join("\n")}`
      : `\n\nENABLED OUTPUT (JSON only):\n${schema}\n\nFeature rules:\n${featureLines.join("\n")}`;

  return fillPrompt(template, { catalog, lang }) + addon;
}

export function buildChatSystemPrompt(
  settings: GeminiSettingsExtended,
  lang: "bn" | "en",
  catalog: string,
  specialties = "(none)",
) {
  const template = lang === "bn" ? settings.prompt_chat_bn : settings.prompt_chat_en;
  const featureLines: string[] = [];
  if (settings.features.medical_advice) {
    featureLines.push(
      lang === "bn"
        ? "- medical_advice: সাধারণ স্বাস্থ্য তথ্য দিন (রোগ নির্ণয়/ওষুধ/ডোজ নয়)। জরুরি লক্ষণে হাসপাতাল যাওয়ার পরামর্শ দিন।"
        : "- medical_advice: provide general wellness guidance (no diagnosis, drugs, or doses). Advise hospital for emergencies.",
    );
  } else {
    featureLines.push(lang === "bn" ? "- medical_advice ফিল্ড খালি রাখুন বা omit করুন।" : "- omit medical_advice.");
  }
  if (settings.features.expert_analysis) {
    featureLines.push(
      lang === "bn"
        ? "- expert analysis: urgency, red_flags, likely_systems, analysis_summary পূরণ করুন — শিক্ষামূলক reasoning; রোগের নাম দিয়ে নির্ণয় নয়। জীবন-হুমকি লক্ষণে urgency=emergency।"
        : "- expert analysis: fill urgency, red_flags, likely_systems, analysis_summary — educational reasoning; never name a definitive diagnosis. Life-threatening signs → urgency=emergency.",
    );
  }
  if (settings.features.catalog_notes) {
    featureLines.push(
      lang === "bn"
        ? "- catalog_notes: ক্যাটালগের টেস্টের নাম/প্রস্তুতি/কেন দরকার — সুন্দর বুলেট বা সংক্ষিপ্ত অনুচ্ছেদ।"
        : "- catalog_notes: formatted catalog-grounded notes (test names, prep, relevance).",
    );
  }
  if (settings.features.test_suggestions) {
    featureLines.push(
      lang === "bn"
        ? `- suggested_tests: শুধু ক্যাটালগ থেকে; লক্ষণ পরিষ্কার হলে সাধারণত ৩–${Math.min(6, Math.max(3, settings.max_suggestions))}টি (সর্বোচ্চ ${settings.max_suggestions})। প্রতিটিতে catalog_id+code দিন। একটাই দিবেন না যদি একাধিক প্রাসঙ্গিক থাকে।`
        : `- suggested_tests: catalog only; when symptoms are clear usually return 3–${Math.min(6, Math.max(3, settings.max_suggestions))} (max ${settings.max_suggestions}). Include catalog_id+code each. Do not return only one if several are relevant.`,
    );
  } else {
    featureLines.push(lang === "bn" ? "- suggested_tests: []" : "- suggested_tests: []");
  }
  if (settings.features.specialty_suggestions) {
    featureLines.push(
      lang === "bn"
        ? `- suggested_specialties: বাধ্যতামূলক যখন লক্ষণ/সমস্যা আছে। শুধু SPECIALTIES তালিকা থেকে; সর্বোচ্চ ${settings.max_specialties}টি। প্রতিটিতে specialty_id (uuid) + slug + reason। খালি [] দিবেন না যদি লক্ষণ পরিষ্কার হয়।`
        : `- suggested_specialties: REQUIRED when symptoms/concerns are present. ONLY from SPECIALTIES list; max ${settings.max_specialties}. Each needs specialty_id (uuid) + slug + reason. Do not return [] when symptoms are clear.`,
    );
  } else {
    featureLines.push(lang === "bn" ? "- suggested_specialties: []" : "- suggested_specialties: []");
  }
  if (settings.features.first_aid) {
    featureLines.push(
      lang === "bn"
        ? "- first_aid: লক্ষণ/সমস্যা থাকলে ৩–৭টি প্রাথমিক/ঘরোয়া যত্নের ধাপ (বিশ্রাম, পানি, ঠান্ডা সেঁক ইত্যাদি)। ওষুধের নাম/ডোজ দিবেন না। কখন ডাক্তার/হাসপাতালে যেতে হবে এক ধাপে লিখুন।"
        : "- first_aid: when symptoms/concerns are present, return 3–7 practical home/primary care steps (rest, fluids, cold compress, etc.). Never name prescription drugs or doses. Include one step on when to see a doctor/ER.",
    );
  } else {
    featureLines.push(lang === "bn" ? "- first_aid: [] বা omit।" : "- omit first_aid or return [].");
  }
  if (settings.features.follow_up_questions) {
    featureLines.push(
      lang === "bn"
        ? `- questions: সর্বোচ্চ ${settings.max_questions}টি। শুধু প্রয়োজন হলে (বয়স/সময়কাল/জানা রোগ/গর্ভাবস্থা ইত্যাদি)। ইতিহাসে থাকলে বা [উত্তর] ট্যাগ থাকলে পুনরায় জিজ্ঞাসা নিষেধ। যথেষ্ট তথ্য → questions=[] এবং need_more_info=false। অপ্রয়োজনীয় প্রশ্ন করবেন না। জেলা/উপজেলা questions-এ নয়।`
        : `- questions: max ${settings.max_questions}. Ask ONLY when needed (age/duration/known conditions/pregnancy etc.). Never re-ask if already in history or under [Answer] tags. Enough info → questions=[] and need_more_info=false. No filler. Do not ask district/upazila in questions.`,
    );
  }
  if (settings.features.bundle_offer && settings.features.test_suggestions) {
    featureLines.push(lang === "bn" ? "- offer_bundle=true যদি ২+ টেস্ট সাজেস্ট করেন।" : "- offer_bundle=true if 2+ tests suggested.");
  }

  const schema = buildJsonSchema(settings.features);
  const addon =
    lang === "bn"
      ? `\n\nENABLED OUTPUT (JSON only):\n${schema}\n\nFeature rules:\n${featureLines.join("\n")}`
      : `\n\nENABLED OUTPUT (JSON only):\n${schema}\n\nFeature rules:\n${featureLines.join("\n")}`;

  let prompt = fillPrompt(template, { catalog, specialties, lang }) + addon;

  // Custom DB prompts often omit {{specialties}} — always inject the live list when enabled.
  if (settings.features.specialty_suggestions) {
    const marker = "SPECIALTIES (id|slug|name_bn|name_en)";
    if (!prompt.includes(marker) || !prompt.includes(specialties.split("\n")[0] ?? "\0")) {
      prompt +=
        lang === "bn"
          ? `\n\n${marker} — suggested_specialties শুধু এখান থেকে (specialty_id + slug বাধ্যতামূলক):\n${specialties}\nলক্ষণ থাকলে অবশ্যই ১–${Math.max(1, settings.max_specialties)}টি বিশেষজ্ঞ দিন।`
          : `\n\n${marker} — suggested_specialties MUST use only these rows (specialty_id + slug required):\n${specialties}\nWhen symptoms are described, ALWAYS return 1–${Math.max(1, settings.max_specialties)} specialties.`;
    }
  }

  // Always reinforce ask-only-when-needed (even if Admin custom prompt is stale).
  if (settings.features.follow_up_questions) {
    prompt +=
      lang === "bn"
        ? `\n\nFOLLOW-UP POLICY (বাধ্যতামূলক): questions শুধু ক্লিনিক্যালি দরকারি মিসিং তথ্যের জন্য। ইতিমধ্যে জানা/উত্তর দেওয়া বিষয় পুনরায় জিজ্ঞাসা করবেন না। যথেষ্ট তথ্য থাকলে questions=[]। জেলা ও উপজেলা UI সংগ্রহ করবে — questions এ লিখবেন না।`
        : `\n\nFOLLOW-UP POLICY (mandatory): questions only for clinically missing info. Never re-ask answered items. If enough info, questions=[]. District/upazila are collected in the UI — never put them in questions.`;
  }

  return prompt;
}

export function getPublicAiConfig(settings: GeminiSettingsExtended, lang: "bn" | "en") {
  const ui = settings.ui;
  return {
    enabled: settings.enabled,
    features: settings.features,
    chatPersistDays: settings.chat_persist_days,
    followUp: resolveFollowUpForLang(settings.follow_up, lang),
    ui: {
      welcome: lang === "bn" ? ui.welcome_bn : ui.welcome_en,
      disclaimer: lang === "bn" ? ui.disclaimer_bn : ui.disclaimer_en,
      thinking: lang === "bn" ? ui.thinking_bn : ui.thinking_en,
      pageTitle: lang === "bn" ? ui.page_title_bn : ui.page_title_en,
      medicalHeading: lang === "bn" ? ui.medical_heading_bn : ui.medical_heading_en,
      catalogHeading: lang === "bn" ? ui.catalog_heading_bn : ui.catalog_heading_en,
      suggestionsHeading: lang === "bn" ? ui.suggestions_heading_bn : ui.suggestions_heading_en,
      bundleCta: lang === "bn" ? ui.bundle_cta_bn : ui.bundle_cta_en,
      specialtyHeading: lang === "bn" ? ui.specialty_heading_bn : ui.specialty_heading_en,
      expertHeading: lang === "bn" ? ui.expert_heading_bn : ui.expert_heading_en,
      specialtyCta: lang === "bn" ? ui.specialty_cta_bn : ui.specialty_cta_en,
      firstAidHeading: lang === "bn" ? ui.first_aid_heading_bn : ui.first_aid_heading_en,
      firstAidButton: lang === "bn" ? ui.first_aid_button_bn : ui.first_aid_button_en,
      prescriptionAttach: lang === "bn" ? ui.prescription_attach_bn : ui.prescription_attach_en,
      prescriptionCamera: lang === "bn" ? ui.prescription_camera_bn : ui.prescription_camera_en,
      prescriptionPhotos: lang === "bn" ? ui.prescription_photos_bn : ui.prescription_photos_en,
      medicinesHeading: lang === "bn" ? ui.medicines_heading_bn : ui.medicines_heading_en,
      prescriptionDisclaimer:
        lang === "bn" ? ui.prescription_disclaimer_bn : ui.prescription_disclaimer_en,
      prescriptionAnalyzing:
        lang === "bn" ? ui.prescription_analyzing_bn : ui.prescription_analyzing_en,
      labGeoTitle: lang === "bn" ? ui.lab_geo_title_bn : ui.lab_geo_title_en,
      labGeoHint: lang === "bn" ? ui.lab_geo_hint_bn : ui.lab_geo_hint_en,
      labClinicsHeading: lang === "bn" ? ui.lab_clinics_heading_bn : ui.lab_clinics_heading_en,
      labGeoCta: lang === "bn" ? ui.lab_geo_cta_bn : ui.lab_geo_cta_en,
    },
    limits: {
      maxPrescriptionImages: settings.max_prescription_images,
      prescriptionImageMaxPx: settings.prescription_image_max_px,
      maxMedicines: settings.max_medicines,
    },
  };
}

export type CareAiPublicConfig = ReturnType<typeof getPublicAiConfig>;

export function normalizeGeminiSettingsExtended(raw: unknown): GeminiSettingsExtended {
  const base = normalizeGeminiSettings(raw);
  return extendGeminiSettings(base, raw);
}

/** Persist extended settings to app_settings.gemini_settings JSONB. */
export function packGeminiSettingsForDb(ext: GeminiSettingsExtended): Record<string, unknown> {
  const {
    features,
    ui,
    follow_up,
    max_questions,
    max_suggestions,
    max_specialties,
    chat_persist_days,
    ...rest
  } = ext;
  return {
    ...rest,
    match_enabled: features.match_fallback,
    features,
    ui,
    follow_up,
    max_questions,
    max_suggestions,
    max_specialties,
    chat_persist_days,
  };
}
