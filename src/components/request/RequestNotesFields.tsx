import {
  NEED_REASON_CUSTOM_ID,
  isCustomNeedReason,
  pickLocalized,
  type NeedReasonCategory,
} from "@/lib/need-reason-catalog";
import {
  POST_TEXT_STYLES,
  getPostTextStyle,
  postStyleAlignClass,
  postStyleFontClass,
  type PostTextStyleId,
} from "@/lib/post-text-styles";
import { getCachedMessagingSettings } from "@/lib/messaging-settings";
import { RequestPostBody } from "@/components/request/RequestPostBody";

export type RequestNotesPreviewData = {
  patient_name: string;
  blood_group: string;
  bags_needed: number;
  hospital_name?: string;
  area?: string | null;
  city?: string | null;
  districtName?: string | null;
  needed_by?: string;
};

type Props = {
  reasonKey: string;
  customReason: string;
  notes: string;
  onReasonKeyChange: (v: string) => void;
  onCustomReasonChange: (v: string) => void;
  onNotesChange: (v: string) => void;
  textStyleId: PostTextStyleId;
  onTextStyleChange: (id: PostTextStyleId) => void;
  categories: NeedReasonCategory[];
  reasonDisplayLang: "bn" | "en";
  uiLang: "bn" | "en";
  notesOptional: boolean;
  ph: (bn: string, en: string) => string;
  /** Live Facebook-style feed preview */
  preview?: RequestNotesPreviewData | null;
  fieldClassName?: string;
};

/**
 * Shared reason + suggestion chips + Facebook-style notes composer + style picker.
 */
export function RequestNotesFields({
  reasonKey,
  customReason,
  notes,
  onReasonKeyChange,
  onCustomReasonChange,
  onNotesChange,
  textStyleId,
  onTextStyleChange,
  categories,
  reasonDisplayLang,
  uiLang,
  notesOptional,
  ph,
  preview,
  fieldClassName = "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70",
}: Props) {
  const selected = categories.find((c) => c.id === reasonKey);
  const suggestionChips = selected?.suggestions ?? [];
  const reasonLabel = (() => {
    if (!reasonKey) return null;
    if (isCustomNeedReason(reasonKey)) return customReason.trim() || null;
    return selected ? pickLocalized(selected.label, reasonDisplayLang) : null;
  })();

  const style = getPostTextStyle(textStyleId);
  const styled = style.id !== "none";

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          {reasonDisplayLang === "bn" ? "সমস্যার কারণ / রোগের ধরন" : "Reason / disease type"}
        </label>
        <select
          className={fieldClassName}
          value={reasonKey}
          onChange={(e) => {
            onReasonKeyChange(e.target.value);
            if (!isCustomNeedReason(e.target.value)) onCustomReasonChange("");
          }}
          required
        >
          <option value="">
            {reasonDisplayLang === "bn" ? "কারণ নির্বাচন করুন…" : "Select a reason…"}
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {pickLocalized(c.label, reasonDisplayLang)}
            </option>
          ))}
          <option value={NEED_REASON_CUSTOM_ID}>
            {reasonDisplayLang === "bn" ? "কাস্টম (নিজে লিখুন)" : "Custom (write your own)"}
          </option>
        </select>

        {isCustomNeedReason(reasonKey) && (
          <input
            className={fieldClassName}
            placeholder={
              reasonDisplayLang === "bn" ? "কাস্টম কারণ লিখুন…" : "Write custom reason…"
            }
            value={customReason}
            onChange={(e) => onCustomReasonChange(e.target.value)}
            required
          />
        )}
      </div>

      {suggestionChips.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            {reasonDisplayLang === "bn"
              ? "পোস্ট টেক্সট সাজেশন — ট্যাপ করুন, তারপর এডিট করতে পারবেন"
              : "Post text suggestions — tap to use, then edit anytime"}
          </p>
          <div className="flex flex-col gap-1.5">
            {suggestionChips.map((s, i) => {
              const text = pickLocalized(s, reasonDisplayLang);
              const active = notes.trim() === text.trim();
              return (
                <button
                  key={`${reasonKey}-chip-${i}`}
                  type="button"
                  onClick={() => onNotesChange(text)}
                  className={`text-left rounded-xl border px-3 py-2.5 text-[13px] leading-5 transition ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Facebook-style status composer + background styles */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          {uiLang === "bn" ? "পোস্ট টেক্সট (ফিডে যা দেখাবে)" : "Post text (shown on feed)"}
        </label>

        <div
          className="overflow-hidden rounded-2xl border border-border/80 shadow-sm focus-within:ring-2 focus-within:ring-primary/20"
          style={
            styled
              ? { background: style.bg, color: style.color, borderColor: "transparent" }
              : undefined
          }
        >
          <textarea
            className={`w-full min-h-[120px] resize-y border-0 bg-transparent px-3.5 py-3 outline-none focus:ring-0 placeholder:opacity-70 ${
              styled
                ? `${postStyleFontClass(notes || "…")} ${postStyleAlignClass(notes || "")}`
                : "text-[15px] leading-5 text-foreground tracking-[-0.01em] placeholder:text-muted-foreground/65"
            }`}
            style={styled ? { color: style.color } : undefined}
            rows={4}
            placeholder={
              notesOptional
                ? ph(
                    "কী ঘটছে লিখুন… (ফেসবুক পোস্টের মতো)",
                    "Write what’s happening… (like a Facebook post)",
                  )
                : ph("কী ঘটছে লিখুন… (ফেসবুক পোস্টের মতো)", "Write what’s happening… (like a Facebook post)")
            }
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            required={!notesOptional}
          />
        </div>

        <div className="space-y-1">
          <p className="text-[11px] text-muted-foreground">
            {uiLang === "bn" ? "ব্যাকগ্রাউন্ড স্টাইল" : "Background style"}
          </p>
          <div
            className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="listbox"
            aria-label={uiLang === "bn" ? "পোস্ট স্টাইল" : "Post style"}
          >
            {POST_TEXT_STYLES.map((s) => {
              const active = textStyleId === s.id;
              const isNone = s.id === "none";
              return (
                <button
                  key={s.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  title={uiLang === "bn" ? s.label_bn : s.label_en}
                  onClick={() => onTextStyleChange(s.id)}
                  className={`relative h-9 w-9 shrink-0 rounded-full border-2 transition-transform active:scale-95 ${
                    active ? "border-foreground scale-105" : "border-transparent"
                  }`}
                  style={
                    isNone
                      ? {
                          background:
                            "linear-gradient(135deg, #f4f4f5 50%, #e4e4e7 50%)",
                        }
                      : { background: s.bg }
                  }
                >
                  {isNone && (
                    <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-zinc-600">
                      Aa
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {preview && (preview.patient_name.trim() || notes.trim() || reasonLabel) && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            {uiLang === "bn" ? "ফিড প্রিভিউ" : "Feed preview"}
          </p>
          <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/25">
            <div className="border-b border-border/50 bg-card px-3 py-2">
              <p className="text-[13px] font-semibold text-foreground/90">
                {uiLang === "bn" ? "এভাবে ফিডে দেখাবে" : "How it appears on the feed"}
              </p>
            </div>
            <div className="bg-card px-3 pt-3 pb-3">
              <RequestPostBody
                compact
                lang={uiLang}
                textStyleId={textStyleId}
                factSettings={getCachedMessagingSettings()}
                patient_name={preview.patient_name.trim() || (uiLang === "bn" ? "রোগী" : "Patient")}
                blood_group={preview.blood_group || "—"}
                bags_needed={preview.bags_needed || 1}
                hospital_name={preview.hospital_name}
                area={preview.area}
                city={preview.city}
                districtName={preview.districtName}
                needed_by={preview.needed_by || null}
                notes={notes}
                need_reason_label={reasonLabel}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
