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

/** Short label shown in the user chat bubble. */
export function displayAnswerBubble(question: string, answer: string, cfg: FollowUpPublicConfig): string {
  const a = answer.trim();
  return `${a}\n\n${cfg.bubblePrefix} ${question}`;
}
