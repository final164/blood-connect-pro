import { formatCareMoney } from "@/lib/care-invoice";
import {
  priceItemLabel,
  type CareOperationPriceItem,
} from "@/lib/care-operations-api";

export type OperationPriceSummary = {
  /** Package / payable amount the patient pays */
  packagePrice: number;
  /** List / MRP before discount (optional) */
  priceOriginal?: number | null;
  discountPercent?: number | null;
  priceNote?: string | null;
  items?: CareOperationPriceItem[] | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Derive list, discount amount, and payable for an operation offering. */
export function operationPriceMath(input: OperationPriceSummary) {
  const payable = Math.max(0, Number(input.packagePrice) || 0);
  const list =
    input.priceOriginal != null && Number(input.priceOriginal) > payable
      ? Number(input.priceOriginal)
      : payable;
  const discountAmount = round2(Math.max(0, list - payable));
  let discountPercent =
    input.discountPercent != null && Number(input.discountPercent) > 0
      ? Number(input.discountPercent)
      : 0;
  if (discountAmount > 0 && discountPercent <= 0 && list > 0) {
    discountPercent = round2((discountAmount / list) * 100);
  }
  const itemsTotal = (input.items ?? []).reduce((s, i) => s + (Number(i.amount) || 0), 0);
  return { list: round2(list), payable: round2(payable), discountAmount, discountPercent, itemsTotal };
}

type Props = {
  summary: OperationPriceSummary;
  lang: "bn" | "en";
  /** compact = desk cards; card = patient detail */
  variant?: "card" | "compact";
  className?: string;
};

/**
 * Professional operation price sheet:
 * line items → মূল্য (list) → ছাড় → মোট (payable).
 */
export function CareOperationPriceBreakdown({
  summary,
  lang,
  variant = "card",
  className = "",
}: Props) {
  const bn = lang === "bn";
  const { list, payable, discountAmount, discountPercent } = operationPriceMath(summary);
  const items = summary.items ?? [];
  const hasItems = items.length > 0;
  const hasDiscount = discountAmount > 0;
  const compact = variant === "compact";
  const money = (n: number) => formatCareMoney(n, lang);

  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-card ${compact ? "text-xs" : "text-sm"} ${className}`}
    >
      <div
        className={`border-b bg-muted/30 px-3 ${compact ? "py-2" : "py-2.5"} flex items-center justify-between gap-2`}
      >
        <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
          {bn ? "মূল্য ব্রেকডাউন" : "Price breakdown"}
        </p>
        {hasDiscount ? (
          <span className="rounded-md border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
            {bn
              ? `${discountPercent % 1 === 0 ? discountPercent : discountPercent.toFixed(1)}% ছাড়`
              : `${discountPercent % 1 === 0 ? discountPercent : discountPercent.toFixed(1)}% OFF`}
          </span>
        ) : null}
      </div>

      {hasItems ? (
        <ul className={`divide-y divide-border/60 ${compact ? "px-3" : "px-3.5"}`}>
          {items.map((item) => (
            <li key={item.id} className={`flex items-start justify-between gap-3 ${compact ? "py-1.5" : "py-2"}`}>
              <span className="min-w-0 text-muted-foreground">{priceItemLabel(item, lang)}</span>
              <span className="shrink-0 tabular-nums font-medium text-foreground">
                {money(item.amount)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className={`px-3 ${compact ? "py-2" : "py-3"} text-muted-foreground`}>
          {bn ? "প্যাকেজ মূল্য (বিস্তারিত খাত নেই)" : "Package price (no line items)"}
        </p>
      )}

      <div className={`space-y-1.5 border-t bg-muted/20 ${compact ? "px-3 py-2.5" : "px-3.5 py-3"}`}>
        <Row
          label={bn ? "মূল্য" : "Price"}
          value={money(list)}
          muted={!hasDiscount}
          strike={false}
          bold={!hasDiscount}
        />
        {hasDiscount ? (
          <Row
            label={
              bn
                ? `ছাড়${discountPercent > 0 ? ` (${discountPercent % 1 === 0 ? discountPercent : discountPercent.toFixed(1)}%)` : ""}`
                : `Discount${discountPercent > 0 ? ` (${discountPercent % 1 === 0 ? discountPercent : discountPercent.toFixed(1)}%)` : ""}`
            }
            value={`− ${money(discountAmount)}`}
            accent="discount"
          />
        ) : null}
        <div className="my-1 border-t border-dashed border-border/80" />
        <Row
          label={bn ? "মোট" : "Total"}
          value={money(payable)}
          bold
          accent="total"
          large={!compact}
        />
      </div>

      {summary.priceNote ? (
        <p className={`border-t px-3 ${compact ? "py-1.5 text-[10px]" : "py-2 text-[11px]"} text-muted-foreground`}>
          {summary.priceNote}
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
  strike,
  accent,
  large,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  strike?: boolean;
  accent?: "discount" | "total";
  large?: boolean;
}) {
  const valueClass =
    accent === "discount"
      ? "font-semibold tabular-nums text-rose-700"
      : accent === "total"
        ? `font-bold tabular-nums text-emerald-700 ${large ? "text-base" : ""}`
        : muted
          ? "tabular-nums text-muted-foreground"
          : bold
            ? "font-semibold tabular-nums text-foreground"
            : "tabular-nums text-foreground";

  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={
          accent === "total"
            ? "font-bold text-foreground"
            : muted
              ? "text-muted-foreground"
              : "text-foreground/80"
        }
      >
        {label}
      </span>
      <span className={`${valueClass} ${strike ? "line-through" : ""}`}>{value}</span>
    </div>
  );
}
