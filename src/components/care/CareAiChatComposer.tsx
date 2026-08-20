import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Loader2, Send } from "lucide-react";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";

const MAX_HEIGHT_PX = 120;

type Props = {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  disabled?: boolean;
  busy?: boolean;
  hint?: string;
  id?: string;
  topSlot?: ReactNode;
  className?: string;
};

export function CareAiChatComposer({
  value,
  onChange,
  onSend,
  placeholder,
  disabled,
  busy,
  hint,
  id = "care-ai-composer",
  topSlot,
  className = "",
}: Props) {
  const keyboardInset = useKeyboardInset();
  const wrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !busy && !disabled && !!value.trim();
  const keyboardOpen = keyboardInset > 0;

  const syncHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(Math.max(el.scrollHeight, 24), MAX_HEIGHT_PX);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > MAX_HEIGHT_PX ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(() => {
      document.documentElement.style.setProperty("--care-ai-composer-h", `${wrap.offsetHeight}px`);
    });
    ro.observe(wrap);
    document.documentElement.style.setProperty("--care-ai-composer-h", `${wrap.offsetHeight}px`);
    return () => {
      ro.disconnect();
      document.documentElement.style.removeProperty("--care-ai-composer-h");
    };
  }, [topSlot, hint, value, keyboardOpen]);

  useEffect(() => {
    if (keyboardOpen) {
      textareaRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [keyboardOpen, keyboardInset]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (canSend) onSend();
    }
  }

  function handleFocus() {
    requestAnimationFrame(() => {
      wrapRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  }

  return (
    <div
      ref={wrapRef}
      className={`care-ai-composer fixed inset-x-0 z-50 border-t border-border/60 bg-background/95 backdrop-blur-xl supports-backdrop-filter:bg-background/85 ${
        keyboardOpen ? "" : "bottom-[var(--app-bottom-nav-h,0px)] md:bottom-0"
      } ${className}`}
      style={keyboardOpen ? { bottom: keyboardInset } : undefined}
    >
      <div
        className="max-w-2xl mx-auto w-full px-3 pt-2.5 space-y-2"
        style={{ paddingBottom: "0.5rem" }}
      >
        {topSlot}
        <div className="flex items-end gap-2">
          <label
            htmlFor={id}
            className="group relative flex min-w-0 flex-1 items-end gap-2 rounded-2xl border border-border/70 bg-muted/35 pl-3.5 pr-1.5 py-1.5 shadow-sm transition-[border-color,box-shadow,background-color] focus-within:border-primary/40 focus-within:bg-background focus-within:ring-2 focus-within:ring-primary/15"
          >
            <textarea
              id={id}
              ref={textareaRef}
              rows={1}
              value={value}
              disabled={disabled || busy}
              onFocus={handleFocus}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              enterKeyHint="send"
              aria-label={placeholder}
              className="min-h-7 max-h-30 w-full flex-1 resize-none bg-transparent py-2 text-[15px] leading-snug text-foreground outline-none placeholder:text-muted-foreground/70 disabled:opacity-60"
            />
            <button
              type="button"
              disabled={!canSend}
              onClick={onSend}
              aria-label="Send"
              className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm transition enabled:active:scale-95 disabled:bg-muted disabled:text-muted-foreground/50 disabled:shadow-none"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4 translate-x-px" strokeWidth={2.25} />
              )}
            </button>
          </label>
        </div>
        {hint ? (
          <p className="px-1 pb-0.5 text-[10px] leading-snug text-muted-foreground/75">{hint}</p>
        ) : null}
      </div>
    </div>
  );
}
