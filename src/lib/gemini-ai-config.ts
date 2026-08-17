import {
  fillPrompt,
  normalizeGeminiSettings,
  type GeminiSettings,
} from "@/lib/gemini-rotate";

export type GeminiAiFeatures = {
  medical_advice: boolean;
  catalog_notes: boolean;
  test_suggestions: boolean;
  follow_up_questions: boolean;
  bundle_offer: boolean;
  match_fallback: boolean;
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
};

export const DEFAULT_GEMINI_FEATURES: GeminiAiFeatures = {
  medical_advice: true,
  catalog_notes: true,
  test_suggestions: true,
  follow_up_questions: true,
  bundle_offer: true,
  match_fallback: false,
};

export const DEFAULT_GEMINI_UI: GeminiUiCopy = {
  welcome_bn:
    "আপনার লক্ষণ বা সমস্যা লিখুন। আমি সাধারণ স্বাস্থ্য তথ্য, ক্যাটালগ-ভিত্তিক টেস্ট ব্যাখ্যা এবং বুকিং সাজেশন দেব। চিকিৎসকের বিকল্প নয় — জরুরি হলে হাসপাতালে যান।",
  welcome_en:
    "Describe your symptoms or concern. I will share general health information, catalog-based test guidance, and booking suggestions. Not a substitute for a doctor — seek emergency care when needed.",
  disclaimer_bn: "তথ্যমূলক সহায়তা; চিকিৎসকের পরামর্শের বিকল্প নয়।",
  disclaimer_en: "Informational support only — not a substitute for professional medical care.",
  thinking_bn: "আপনার জন্য তথ্য প্রস্তুত করছি…",
  thinking_en: "Preparing your guidance…",
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
};

export type GeminiSettingsExtended = GeminiSettings & {
  features: GeminiAiFeatures;
  ui: GeminiUiCopy;
  follow_up: GeminiFollowUpSettings;
  max_questions: number;
  max_suggestions: number;
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
};

const DEFAULT_FOLLOWUP_KIND = (patterns: string, quick_bn: string[], quick_en: string[], ph_bn: string, ph_en: string): GeminiFollowUpKindSettings => ({
  patterns,
  quick_replies_bn: quick_bn.join("\n"),
  quick_replies_en: quick_en.join("\n"),
  placeholder_bn: ph_bn,
  placeholder_en: ph_en,
});

export const DEFAULT_GEMINI_FOLLOWUP: GeminiFollowUpSettings = {
  panel_title_bn: "আরও জানতে চাই — একটি প্রশ্নে ট্যাপ করুন",
  panel_title_en: "Tap a question to answer",
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
  };
}

export function buildJsonSchema(features: GeminiAiFeatures): string {
  const fields = ['"reply":"string — short friendly summary"'];
  if (features.medical_advice) {
    fields.push('"medical_advice":"string — general wellness guidance, not diagnosis, no prescription"');
  }
  if (features.catalog_notes) {
    fields.push('"catalog_notes":"string — formatted notes using ONLY catalog tests (names, prep, why relevant)"');
  }
  if (features.follow_up_questions) {
    fields.push('"questions":["string"]');
  }
  if (features.test_suggestions) {
    fields.push('"suggested_tests":[{"catalog_id":"uuid","code":"CODE","reason":"why"}]');
  }
  if (features.bundle_offer && features.test_suggestions) {
    fields.push('"offer_bundle":boolean');
  }
  return `{${fields.join(",")}}`;
}

export function buildChatSystemPrompt(settings: GeminiSettingsExtended, lang: "bn" | "en", catalog: string) {
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
        ? `- suggested_tests: শুধু ক্যাটালগ থেকে, সর্বোচ্চ ${settings.max_suggestions}টি।`
        : `- suggested_tests: catalog only, max ${settings.max_suggestions}.`,
    );
  } else {
    featureLines.push(lang === "bn" ? "- suggested_tests: []" : "- suggested_tests: []");
  }
  if (settings.features.follow_up_questions) {
    featureLines.push(
      lang === "bn"
        ? `- questions: সর্বোচ্চ ${settings.max_questions}টি ফলো-আপ প্রশ্ন।`
        : `- questions: max ${settings.max_questions} follow-ups.`,
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

  return fillPrompt(template, { catalog, lang }) + addon;
}

export function getPublicAiConfig(settings: GeminiSettingsExtended, lang: "bn" | "en") {
  const ui = settings.ui;
  return {
    enabled: settings.enabled,
    features: settings.features,
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
  const { features, ui, follow_up, max_questions, max_suggestions, ...rest } = ext;
  return {
    ...rest,
    match_enabled: features.match_fallback,
    features,
    ui,
    follow_up,
    max_questions,
    max_suggestions,
  };
}
