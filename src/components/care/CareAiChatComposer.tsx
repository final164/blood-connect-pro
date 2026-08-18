import { useCallback, useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { Send } from "lucide-react";
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

  const syncHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, MAX_HEIGHT_PX);
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
    return () => ro.disconnect();
  }, [topSlot, hint, value]);

  useEffect(() => {
    if (keyboardInset > 0) {
      textareaRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [keyboardInset]);

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy && value.trim()) onSend();
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
      className={`fixed inset-x-0 z-40 border-t bg-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 ${className}`}
      style={{
        bottom: keyboardInset,
        paddingBottom: keyboardInset > 0 ? "0.5rem" : "max(0.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <div className="max-w-2xl mx-auto px-3 py-2 space-y-2">
        {topSlot}
        <div className="flex gap-2 items-end">
          <div className="flex-1 min-w-0 rounded-xl border bg-card focus-within:ring-2 focus-within:ring-primary/30">
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
              className="w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none leading-relaxed min-h-[44px] max-h-[120px]"
            />
            {hint && <p className="px-3 pb-1.5 text-[10px] text-muted-foreground">{hint}</p>}
          </div>
          <button
            type="button"
            disabled={busy || !value.trim() || disabled}
            onClick={onSend}
            aria-label="Send"
            className="h-11 w-11 shrink-0 rounded-xl bg-primary text-primary-foreground grid place-items-center disabled:opacity-50 mb-0.5"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
