import { clampDiscountPercent } from "@/lib/care-lab-price";
import { formatCareMoney } from "@/lib/care-invoice";

export type AmbulanceFareBreakdown = {
  base_price: number;
  per_km_price: number;
  min_fare: number;
  distance_km: number;
  discount_percent: number;
  list_fare: number;
  sale_fare: number;
  saved: number;
};

export function computeAmbulanceFare(params: {
  base_price: number;
  per_km_price: number;
  min_fare: number;
  discount_percent?: number | null;
  distance_km?: number;
  min_fare_cap?: number;
  max_fare_cap?: number;
}): AmbulanceFareBreakdown {
  const distance_km = Math.max(0, Number(params.distance_km) || 0);
  const base_price = Number(params.base_price) || 0;
  const per_km_price = Number(params.per_km_price) || 0;
  const min_fare = Number(params.min_fare) || 0;
  let list = Math.max(min_fare, base_price + distance_km * per_km_price);
  const minCap = Number(params.min_fare_cap) || 0;
  const maxCap = Number(params.max_fare_cap) || 0;
  if (minCap > 0) list = Math.max(list, minCap);
  if (maxCap > 0) list = Math.min(list, maxCap);
  list = Math.round(list * 100) / 100;
  const discount_percent = clampDiscountPercent(params.discount_percent);
  const sale_fare = Math.round(list * (1 - discount_percent / 100) * 100) / 100;
  return {
    base_price,
    per_km_price,
    min_fare,
    distance_km,
    discount_percent,
    list_fare: list,
    sale_fare,
    saved: Math.max(0, Math.round((list - sale_fare) * 100) / 100),
  };
}

export { clampDiscountPercent, formatCareMoney };
