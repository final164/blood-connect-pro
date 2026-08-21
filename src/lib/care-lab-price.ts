import { formatCareMoney } from "@/lib/care-invoice";

/** List/MRP vs sale helpers for lab offerings. */

export function clampDiscountPercent(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, Math.round(n * 100) / 100);
}

export function offeringListPrice(o: { price?: number | null }): number {
  const n = Number(o.price ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function offeringSalePrice(o: {
  price?: number | null;
  discount_percent?: number | null;
}): number {
  const list = offeringListPrice(o);
  const disc = clampDiscountPercent(o.discount_percent);
  if (disc <= 0) return list;
  return Math.max(0, Math.round(list * (1 - disc / 100) * 100) / 100);
}

export function offeringHasDiscount(o: {
  price?: number | null;
  discount_percent?: number | null;
}): boolean {
  return clampDiscountPercent(o.discount_percent) > 0 && offeringListPrice(o) > offeringSalePrice(o);
}

export function offeringSavedAmount(o: {
  price?: number | null;
  discount_percent?: number | null;
}): number {
  return Math.max(0, offeringListPrice(o) - offeringSalePrice(o));
}

export { formatCareMoney };
