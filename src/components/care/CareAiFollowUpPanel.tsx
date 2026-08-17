import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, MessageCircleQuestion, Send, X } from "lucide-react";
import type { FollowUpPublicConfig } from "@/lib/gemini-ai-config";
import type { FollowUpQuestion } from "@/lib/care-ai-followup";

type Props = {
  questions: FollowUpQuestion[];
  active: FollowUpQuestion | null;
  answered: Set<string>;
  busy: boolean;
  copy: FollowUpPublicConfig;
  onSelect: (q: FollowUpQuestion | null) => void;
  onSubmit: (question: FollowUpQuestion, answer: string) => void;
};

export function CareAiFollowUpPanel({
  questions,
  active,
  answered,
  busy,
  copy,
  onSelect,
  onSubmit,
}: Props) {
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active) {
      setDraft("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [active?.text]);

  if (!questions.length) return null;

  function submit(answer: string) {
    if (!active || busy) return;
    const trimmed = answer.trim();
    if (!trimmed) return;
    onSubmit(active, trimmed);
    setDraft("");
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/3 p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <MessageCircleQuestion className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs font-semibold text-foreground">{copy.panelTitle}</p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {questions.map((q) => {
          const isActive = active?.text === q.text;
          const isAnswered = answered.has(q.text);
          return (
            <button
              key={q.text}
              type="button"
              disabled={busy || isAnswered}
              onClick={() => onSelect(isActive ? null : q)}
              className={`max-w-full text-left rounded-xl border px-3 py-2 text-xs font-medium transition ${
                isAnswered
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200 opacity-80"
                  : isActive
                    ? "border-primary bg-primary/10 text-foreground ring-2 ring-primary/25"
                    : "border-border bg-card hover:bg-muted/60"
              }`}
            >
              <span className="flex items-start gap-1.5">
                {isAnswered ? (
                  <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-emerald-600" />
                ) : (
                  <ChevronDown
                    className={`h-3.5 w-3.5 shrink-0 mt-0.5 transition ${isActive ? "rotate-180 text-primary" : "text-muted-foreground"}`}
                  />
                )}
                <span className="leading-snug">{q.text}</span>
              </span>
            </button>
          );
        })}
      </div>

      {active && !answered.has(active.text) && (
        <div className="rounded-xl border bg-card p-3 space-y-2.5 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              <span className="font-semibold text-foreground">{copy.questionLabel} </span>
              {active.text}
            </p>
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="h-7 w-7 shrink-0 grid place-items-center rounded-lg hover:bg-muted"
              aria-label={copy.closeLabel}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {active.quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {active.quickReplies.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  disabled={busy}
                  onClick={() => submit(chip)}
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition hover:border-primary hover:bg-primary/10 ${
                    draft === chip ? "border-primary bg-primary/10" : "bg-muted/40"
                  }`}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submit(draft);
            }}
          >
            <input
              ref={inputRef}
              value={draft}
              disabled={busy}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={active.placeholder}
              className="flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              className="h-10 w-10 shrink-0 rounded-xl bg-primary text-primary-foreground grid place-items-center disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>

          <p className="text-[10px] text-muted-foreground">{copy.chipHint}</p>
        </div>
      )}
    </div>
  );
}
