import {
  clampDiscountPercent,
  formatCareMoney,
  offeringSalePrice,
} from "@/lib/care-lab-price";

type PriceBlockProps = {
  listPrice: number;
  salePrice?: number | null;
  discountPercent?: number | null;
  lang?: "bn" | "en";
  /** compact/inline = meta row; card = stacked with badge */
  variant?: "compact" | "card" | "inline";
  className?: string;
};

export function CareLabPriceDisplay({
  listPrice,
  salePrice,
  discountPercent,
  lang = "bn",
  variant = "card",
  className = "",
}: PriceBlockProps) {
  const disc = clampDiscountPercent(discountPercent);
  const list = Number(listPrice) || 0;
  const sale =
    salePrice != null && Number.isFinite(Number(salePrice))
      ? Number(salePrice)
      : offeringSalePrice({ price: list, discount_percent: disc });
  const onSale = disc > 0 && list > sale;
  const discLabel = disc % 1 === 0 ? String(disc) : disc.toFixed(1);

  if (!onSale) {
    return (
      <span className={`tabular-nums font-semibold ${className}`}>
        {formatCareMoney(list, lang)}
      </span>
    );
  }

  if (variant === "inline" || variant === "compact") {
    return (
      <span className={`inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 ${className}`}>
        <span className="text-[10px] font-bold uppercase tracking-wide text-rose-600 bg-rose-500/10 px-1.5 py-0.5 rounded-md">
          −{discLabel}%
        </span>
        <span className="text-xs text-muted-foreground line-through decoration-rose-400/80 tabular-nums">
          {formatCareMoney(list, lang)}
        </span>
        <span className="text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-400">
          {formatCareMoney(sale, lang)}
        </span>
      </span>
    );
  }

  return (
    <div className={`inline-flex flex-col items-start gap-0.5 ${className}`}>
      <span className="text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:text-rose-300 bg-rose-500/15 border border-rose-500/20 px-1.5 py-0.5 rounded-md">
        {lang === "bn" ? `${discLabel}% ছাড়` : `${discLabel}% OFF`}
      </span>
      <span className="text-xs text-muted-foreground line-through decoration-2 decoration-rose-400/70 tabular-nums">
        {formatCareMoney(list, lang)}
      </span>
      <span className="text-base font-bold tabular-nums text-emerald-700 dark:text-emerald-400 leading-tight">
        {formatCareMoney(sale, lang)}
      </span>
    </div>
  );
}
