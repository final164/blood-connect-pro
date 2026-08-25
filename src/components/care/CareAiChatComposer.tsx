import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Camera, ImageIcon, Loader2, Paperclip, Send, X } from "lucide-react";
import { useKeyboardInset } from "@/hooks/useKeyboardInset";

const MAX_HEIGHT_PX = 120;

export type CareAiPendingImage = {
  id: string;
  mimeType: string;
  data: string;
  previewUrl: string;
};

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
  /** When set, shows attach control for camera / gallery */
  attachEnabled?: boolean;
  attachLabel?: string;
  cameraLabel?: string;
  photosLabel?: string;
  pendingImages?: CareAiPendingImage[];
  onImagesChange?: (images: CareAiPendingImage[]) => void;
  onPickFiles?: (files: FileList | null, source: "camera" | "gallery") => void;
  maxImages?: number;
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
  attachEnabled,
  attachLabel,
  cameraLabel,
  photosLabel,
  pendingImages = [],
  onImagesChange,
  onPickFiles,
  maxImages = 2,
}: Props) {
  const keyboardInset = useKeyboardInset();
  const wrapRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const canSend =
    !busy && !disabled && (!!value.trim() || pendingImages.length > 0);
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
  }, [topSlot, hint, value, keyboardOpen, pendingImages.length, menuOpen]);

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

  function removeImage(id: string) {
    onImagesChange?.(pendingImages.filter((img) => img.id !== id));
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
        {pendingImages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-0.5">
            {pendingImages.map((img) => (
              <div key={img.id} className="relative shrink-0">
                <img
                  src={img.previewUrl}
                  alt=""
                  className="h-16 w-16 rounded-xl object-cover border"
                />
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground grid place-items-center"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
        {menuOpen && attachEnabled && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || pendingImages.length >= maxImages}
              onClick={() => {
                setMenuOpen(false);
                cameraRef.current?.click();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-xs font-semibold"
            >
              <Camera className="h-4 w-4" />
              {cameraLabel ?? "Camera"}
            </button>
            <button
              type="button"
              disabled={busy || pendingImages.length >= maxImages}
              onClick={() => {
                setMenuOpen(false);
                galleryRef.current?.click();
              }}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-xs font-semibold"
            >
              <ImageIcon className="h-4 w-4" />
              {photosLabel ?? "Photos"}
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          {attachEnabled ? (
            <button
              type="button"
              disabled={disabled || busy}
              title={attachLabel}
              aria-label={attachLabel ?? "Attach"}
              onClick={() => setMenuOpen((o) => !o)}
              className="mb-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border bg-muted/50 text-foreground disabled:opacity-50"
            >
              <Paperclip className="h-4 w-4" />
            </button>
          ) : null}
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
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          onPickFiles?.(e.target.files, "camera");
          e.target.value = "";
        }}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          onPickFiles?.(e.target.files, "gallery");
          e.target.value = "";
        }}
      />
    </div>
  );
}
