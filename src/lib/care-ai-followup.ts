import { KIND_INFER_ORDER, type FollowUpKind, type FollowUpPublicConfig } from "@/lib/gemini-ai-config";

export type { FollowUpKind } from "@/lib/gemini-ai-config";

export type FollowUpQuestion = {
  text: string;
  kind: FollowUpKind;
  quickReplies: string[];
  placeholder: string;
};

function inferKind(text: string, cfg: FollowUpPublicConfig): FollowUpKind {
  for (const kind of KIND_INFER_ORDER) {
    if (kind === "text") break;
    const patterns = cfg.kinds[kind].patterns;
    if (patterns.some((re) => re.test(text))) return kind;
  }
  return "text";
}

export function parseFollowUpQuestion(text: string, cfg: FollowUpPublicConfig): FollowUpQuestion {
  const trimmed = text.trim();
  const kind = inferKind(trimmed, cfg);
  if (kind === "text") {
    return {
      text: trimmed,
      kind,
      quickReplies: [],
      placeholder: cfg.textPlaceholder,
    };
  }
  const k = cfg.kinds[kind];
  return {
    text: trimmed,
    kind,
    quickReplies: k.quickReplies,
    placeholder: k.placeholder,
  };
}

export function parseFollowUpQuestions(items: string[], cfg: FollowUpPublicConfig): FollowUpQuestion[] {
  return items.map((q) => parseFollowUpQuestion(q, cfg));
}

/** Format user answer so the model knows which question was answered. */
export function formatFollowUpAnswer(question: string, answer: string, cfg: FollowUpPublicConfig): string {
  const a = answer.trim();
  if (!a) return "";
  return `${cfg.answerTag}\n${cfg.questionTag} ${question}\n${cfg.answerInline} ${a}`;
}

export function formatFollowUpBatchAnswer(
  entries: { question: string; answer: string }[],
  cfg: FollowUpPublicConfig,
): string {
  const blocks = entries
    .filter((e) => e.answer.trim())
    .map((e) => `${cfg.questionTag} ${e.question}\n${cfg.answerInline} ${e.answer.trim()}`);
  if (!blocks.length) return "";
  return `${cfg.answerTag}\n${blocks.join("\n\n")}`;
}

export function displayBatchAnswerBubble(
  entries: { question: string; answer: string }[],
  cfg: FollowUpPublicConfig,
): string {
  const lines = entries
    .filter((e) => e.answer.trim())
    .map((e) => `${e.answer.trim()}\n${cfg.bubblePrefix} ${e.question}`);
  return lines.join("\n\n");
}

/** Short label shown in the user chat bubble. */
export function displayAnswerBubble(question: string, answer: string, cfg: FollowUpPublicConfig): string {
  const a = answer.trim();
  return `${a}\n\n${cfg.bubblePrefix} ${question}`;
}

const AGE_HINT =
  /(?:বয়স|age)\s*[:：]?\s*\d{1,3}|\b(?:আমার\s+)?(?:বয়স|age)\b|\b\d{1,2}\s*(?:বছর|yrs?|years?\s*old)\b/i;
const DURATION_HINT =
  /(?:কত\s*দিন|কতদিন|কত\s*ক্ষণ|duration|how\s+long|since\s+when|\d+\s*(?:দিন|সপ্তাহ|মাস|ঘণ্টা)|দিন\s*ধরে|সপ্তাহ\s*ধরে|মাস\s*ধরে)/i;
const CONDITION_HINT =
  /(?:জানা\s*রোগ|ডায়াবেটিস|diabetes|hypertension|উচ্চ\s*রক্তচাপ|asthma|অ্যাজমা|thyroid|গর্ভ|pregnan|ওষুধ|medicine)/i;

/** Detect which clinical fields already appear in chat history (answers or free text). */
export function detectAnsweredFollowUpKinds(
  messages: { role: string; text?: string; apiText?: string }[],
): Set<FollowUpKind> {
  const answered = new Set<FollowUpKind>();
  const userBlob = messages
    .filter((m) => m.role === "user")
    .map((m) => `${m.apiText ?? ""}\n${m.text ?? ""}`)
    .join("\n");
  if (AGE_HINT.test(userBlob)) answered.add("age");
  if (DURATION_HINT.test(userBlob)) answered.add("duration");
  if (CONDITION_HINT.test(userBlob)) answered.add("yes_no");
  for (const m of messages) {
    if (m.role !== "user") continue;
    const raw = `${m.apiText ?? ""}\n${m.text ?? ""}`;
    if (!/\[(?:উত্তর|Answer)\]/i.test(raw)) continue;
    const qLines = raw.match(/(?:প্রশ্ন|Question)\s*:\s*(.+)/gi) ?? [];
    for (const line of qLines) {
      const q = line.replace(/^(?:প্রশ্ন|Question)\s*:\s*/i, "").trim();
      if (!q) continue;
      if (/বয়স|age/i.test(q)) answered.add("age");
      else if (/দিন|ক্ষণ|duration|how\s+long|ধরে/i.test(q)) answered.add("duration");
      else if (/তীব্র|severity|ব্যথা/i.test(q)) answered.add("severity");
      else answered.add("yes_no");
    }
  }
  return answered;
}

/**
 * Drop redundant follow-ups the model re-asked after the user already answered.
 * Soft-fill essential questions when history is thin and clinically relevant.
 */
export function refineFollowUpQuestions(opts: {
  questions: string[];
  messages: { role: string; text?: string; apiText?: string }[];
  max: number;
  lang: "bn" | "en";
  looksClinical: boolean;
  needMoreInfo?: boolean;
}): string[] {
  const answered = detectAnsweredFollowUpKinds(opts.messages);
  const seen = new Set<string>();
  let out = opts.questions
    .map((q) => q.trim())
    .filter(Boolean)
    .filter((q) => {
      const key = q.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      if (/জেলা|উপজেলা|district|upazila|থানা/i.test(q)) return false;
      if (/বয়স|age/i.test(q) && answered.has("age")) return false;
      if (/(দিন|ক্ষণ|duration|how\s+long|ধরে)/i.test(q) && answered.has("duration")) return false;
      if (/(তীব্র|severity)/i.test(q) && answered.has("severity")) return false;
      return true;
    });

  const userTurns = opts.messages.filter((m) => m.role === "user").length;
  const thin = userTurns <= 2 && !answered.has("age") && !answered.has("duration");
  const shouldAsk =
    opts.looksClinical && (opts.needMoreInfo === true || (thin && out.length === 0));

  if (shouldAsk && out.length === 0) {
    out =
      opts.lang === "bn"
        ? [
            ...(answered.has("age") ? [] : ["আপনার বয়স কত?"]),
            ...(answered.has("duration") ? [] : ["এই সমস্যা কতদিন ধরে হচ্ছে?"]),
            "কোনো জানা রোগ (যেমন ডায়াবেটিস) বা নিয়মিত ওষুধ আছে কি?",
          ]
        : [
            ...(answered.has("age") ? [] : ["What is your age?"]),
            ...(answered.has("duration") ? [] : ["How long have you had this problem?"]),
            "Any known conditions (e.g. diabetes) or regular medicines?",
          ];
  }

  if (opts.needMoreInfo === false && !thin && out.length && answered.size >= 2) {
    out = [];
  }

  return out.slice(0, Math.max(0, opts.max));
}
