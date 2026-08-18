import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Check, ChevronDown, MessageCircleQuestion, Send, X } from "lucide-react";
import type { FollowUpPublicConfig } from "@/lib/gemini-ai-config";
import type { FollowUpQuestion } from "@/lib/care-ai-followup";

type AnswerMode = "single" | "batch";

type Props = {
  questions: FollowUpQuestion[];
  active: FollowUpQuestion | null;
  answered: Set<string>;
  busy: boolean;
  copy: FollowUpPublicConfig;
  onSelect: (q: FollowUpQuestion | null) => void;
  onSubmit: (question: FollowUpQuestion, answer: string) => void;
  onSubmitBatch: (entries: { question: FollowUpQuestion; answer: string }[]) => void;
};

const MAX_INPUT_HEIGHT = 120;

function ExpandableInput({
  value,
  onChange,
  placeholder,
  disabled,
  onEnterSubmit,
  inputRef,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
  onEnterSubmit?: () => void;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
}) {
  const localRef = useRef<HTMLTextAreaElement>(null);
  const ref = inputRef ?? localRef;

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_INPUT_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_INPUT_HEIGHT ? "auto" : "hidden";
  }, [ref]);

  useEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && onEnterSubmit) {
      e.preventDefault();
      onEnterSubmit();
    }
  }

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className="flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 min-h-[44px] max-h-[120px] leading-relaxed"
    />
  );
}

export function CareAiFollowUpPanel({
  questions,
  active,
  answered,
  busy,
  copy,
  onSelect,
  onSubmit,
  onSubmitBatch,
}: Props) {
  const [mode, setMode] = useState<AnswerMode>("single");
  const [draft, setDraft] = useState("");
  const [batchDrafts, setBatchDrafts] = useState<Record<string, string>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const pending = questions.filter((q) => !answered.has(q.text));
  const showModeToggle = pending.length > 1;

  const pendingKey = pending.map((q) => q.text).join("\n");

  useEffect(() => {
    if (active && mode === "single") {
      setDraft("");
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [active, mode]);

  useEffect(() => {
    if (mode === "batch") {
      setBatchDrafts((prev) => {
        const next = { ...prev };
        for (const q of pending) {
          if (!(q.text in next)) next[q.text] = "";
        }
        return next;
      });
    }
  }, [mode, pendingKey, pending]);

  if (!questions.length) return null;

  function submitSingle(answer: string) {
    if (!active || busy) return;
    const trimmed = answer.trim();
    if (!trimmed) return;
    onSubmit(active, trimmed);
    setDraft("");
  }

  function submitBatchForm() {
    if (busy) return;
    const entries = pending
      .map((q) => ({ question: q, answer: (batchDrafts[q.text] ?? "").trim() }))
      .filter((e) => e.answer);
    if (!entries.length) return;
    onSubmitBatch(entries);
    setBatchDrafts({});
  }

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/3 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <MessageCircleQuestion className="h-4 w-4 text-primary shrink-0 mt-0.5" />
          <p className="text-xs font-semibold text-foreground leading-snug">{copy.panelTitle}</p>
        </div>
        {showModeToggle && (
          <div className="flex shrink-0 rounded-lg border bg-muted/40 p-0.5 text-[10px] font-semibold">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode("single");
                onSelect(null);
              }}
              className={`rounded-md px-2.5 py-1 transition ${
                mode === "single" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              {copy.modeSingle}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setMode("batch");
                onSelect(null);
              }}
              className={`rounded-md px-2.5 py-1 transition ${
                mode === "batch" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
              }`}
            >
              {copy.modeBatch}
            </button>
          </div>
        )}
      </div>

      {mode === "single" && (
        <>
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
                      onClick={() => submitSingle(chip)}
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
                className="flex gap-2 items-end"
                onSubmit={(e) => {
                  e.preventDefault();
                  submitSingle(draft);
                }}
              >
                <ExpandableInput
                  inputRef={inputRef}
                  value={draft}
                  disabled={busy}
                  onChange={setDraft}
                  placeholder={active.placeholder}
                  onEnterSubmit={() => submitSingle(draft)}
                />
                <button
                  type="submit"
                  disabled={busy || !draft.trim()}
                  className="h-11 w-11 shrink-0 rounded-xl bg-primary text-primary-foreground grid place-items-center disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>

              <p className="text-[10px] text-muted-foreground">{copy.chipHint}</p>
            </div>
          )}
        </>
      )}

      {mode === "batch" && pending.length > 0 && (
        <div className="rounded-xl border bg-card p-3 space-y-3 shadow-sm animate-in fade-in slide-in-from-top-1 duration-200">
          <p className="text-[10px] text-muted-foreground">{copy.batchHint}</p>
          <ul className="space-y-3">
            {pending.map((q, i) => (
              <li key={q.text} className="space-y-1.5">
                <p className="text-[11px] font-medium text-foreground leading-snug">
                  <span className="text-muted-foreground mr-1">{i + 1}.</span>
                  {q.text}
                </p>
                {q.quickReplies.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {q.quickReplies.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          setBatchDrafts((prev) => ({
                            ...prev,
                            [q.text]: chip,
                          }))
                        }
                        className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold transition hover:border-primary hover:bg-primary/10 ${
                          batchDrafts[q.text] === chip ? "border-primary bg-primary/10" : "bg-muted/40"
                        }`}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}
                <ExpandableInput
                  value={batchDrafts[q.text] ?? ""}
                  disabled={busy}
                  onChange={(v) => setBatchDrafts((prev) => ({ ...prev, [q.text]: v }))}
                  placeholder={q.placeholder}
                />
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy || !pending.some((q) => (batchDrafts[q.text] ?? "").trim())}
            onClick={submitBatchForm}
            className="w-full rounded-xl bg-primary text-primary-foreground px-3 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {copy.batchSubmit}
          </button>
        </div>
      )}
    </div>
  );
}
