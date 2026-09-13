import {
  DEFAULT_BLOOD_DONOR_AI_SETTINGS,
  type BloodDonorAiPublicConfig,
} from "@/lib/blood-donor-ai-settings";
import type { FollowUpPublicConfig } from "@/lib/gemini-ai-config";
import {
  parseFollowUpQuestions,
  type FollowUpQuestion,
} from "@/lib/care-ai-followup";
import { BLOOD_GROUPS } from "@/lib/format";

/** Map Blood Donor AI UI copy → Care follow-up panel config. */
export function bloodDonorFollowUpCopy(
  cfg: BloodDonorAiPublicConfig,
  lang: "bn" | "en",
): FollowUpPublicConfig {
  return {
    panelTitle: lang === "bn" ? "প্রশ্নগুলোর উত্তর দিন" : "Answer these questions",
    questionLabel: lang === "bn" ? "প্রশ্ন" : "Question",
    closeLabel: lang === "bn" ? "বন্ধ" : "Close",
    chipHint: lang === "bn" ? "একটি বেছে নিন অথবা লিখুন" : "Pick a chip or type",
    answerTag: cfg.ui.answer_tag,
    questionTag: cfg.ui.question_tag,
    answerInline: cfg.ui.answer_inline,
    bubblePrefix: cfg.ui.bubble_prefix,
    bubbleCaption: lang === "bn" ? "উত্তর" : "Answer",
    textPlaceholder: lang === "bn" ? "উত্তর লিখুন…" : "Type your answer…",
    modeSingle: lang === "bn" ? cfg.ui.one_label_bn : cfg.ui.one_label_en,
    modeBatch: lang === "bn" ? cfg.ui.all_label_bn : cfg.ui.all_label_en,
    batchSubmit: lang === "bn" ? "সব উত্তর পাঠান" : "Send all answers",
    batchHint: lang === "bn" ? "সব প্রশ্নের উত্তর একসাথে" : "Answer all questions together",
    composerHint: lang === "bn" ? "নিচে উত্তর দিন" : "Answer below",
    kinds: {
      duration: {
        patterns: [/কত\s*দিন|duration|how\s*long/i],
        quickReplies: lang === "bn" ? ["১ দিন", "২-৩ দিন"] : ["1 day", "2-3 days"],
        placeholder: lang === "bn" ? "কতদিন" : "Duration",
      },
      yes_no: {
        patterns: [/\b(কি|কী)\b|yes|no|\?/i],
        quickReplies: lang === "bn" ? ["হ্যাঁ", "না"] : ["Yes", "No"],
        placeholder: "",
      },
      age: {
        patterns: [/বয়স|age/i],
        quickReplies: [],
        placeholder: lang === "bn" ? "বয়স" : "Age",
      },
      severity: {
        patterns: [/urgency|জরুরি|critical|urgent|normal|রক্ত|blood|bags?|ব্যাগ/i],
        quickReplies:
          lang === "bn" ? ["normal", "urgent", "critical"] : ["normal", "urgent", "critical"],
        placeholder: "",
      },
    },
  };
}

export function parseBloodDonorQuestions(
  questions: string[],
  cfg: BloodDonorAiPublicConfig,
  lang: "bn" | "en",
): FollowUpQuestion[] {
  const copy = bloodDonorFollowUpCopy(cfg, lang);
  const parsed = parseFollowUpQuestions(questions, copy);
  const mapped = parsed.map((q) => {
    const lower = q.text.toLowerCase();
    const isUpazila = /উপজেলা|upazila|থানা/.test(lower) || /এলাকা/.test(q.text);
    const isDistrict =
      !isUpazila && (/জেলা|district/.test(lower) || /কোন জেলা/.test(q.text));
    if (isDistrict) {
      return {
        ...q,
        kind: "text" as const,
        quickReplies: [],
        geo: "district" as const,
        placeholder: lang === "bn" ? "জেলা খুঁজুন…" : "Search district…",
      };
    }
    if (isUpazila) {
      return {
        ...q,
        kind: "text" as const,
        quickReplies: [],
        geo: "upazila" as const,
        placeholder: lang === "bn" ? "উপজেলা খুঁজুন…" : "Search upazila…",
      };
    }
    if (/blood|রক্ত|গ্রুপ|group|a\+|o\+/.test(lower) || /কোন রক্ত/.test(q.text)) {
      return {
        ...q,
        kind: "severity" as const,
        quickReplies: [...BLOOD_GROUPS],
        placeholder: lang === "bn" ? "রক্তের গ্রুপ" : "Blood group",
      };
    }
    if (/urgency|জরুরি|critical|urgent|normal/.test(lower)) {
      return {
        ...q,
        kind: "severity" as const,
        quickReplies: ["normal", "urgent", "critical"],
        placeholder: lang === "bn" ? "জরুরি অবস্থা" : "Urgency",
      };
    }
    if (/bags?|ব্যাগ/.test(lower)) {
      return {
        ...q,
        kind: "severity" as const,
        quickReplies: ["1", "2", "3", "4"],
        placeholder: lang === "bn" ? "ব্যাগ সংখ্যা" : "Bags",
      };
    }
    return q;
  });
  if (cfg.defaults.upazila_all) {
    return mapped.filter((q) => q.geo !== "upazila");
  }
  return mapped;
}

export function defaultPublicConfig(): BloodDonorAiPublicConfig {
  const s = DEFAULT_BLOOD_DONOR_AI_SETTINGS;
  return {
    enabled: s.enabled,
    entry_points: s.entry_points,
    intents: s.intents,
    required_slots: s.required_slots,
    optional_slots: s.optional_slots,
    actions: s.actions,
    ui: s.ui,
    filters: { gender: s.filters.gender, max_donors: s.filters.max_donors },
    list_fields: s.list_fields,
    defaults: s.defaults,
  };
}
