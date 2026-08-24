import {
  ensurePatientLabDay,
  fetchLabCalendars,
  remainingSeats,
  reserveLabBundle,
  reserveLabSlot,
  searchTestOfferings,
  type CareLabBooking,
  type CareLabCalendar,
  type CareOffering,
} from "@/lib/care-lab-api";
import { offeringSalePrice } from "@/lib/care-lab-price";

export type BundleItem = {
  catalogId: string;
  offering: CareOffering;
};

export type BundleClinicGroup = {
  orgId: string;
  orgName: string;
  orgNameBn: string | null;
  items: BundleItem[];
  subtotal: number;
};

export type BundlePlan = {
  groups: BundleClinicGroup[];
  uncovered: string[];
  total: number;
};

export type BundleBookResult = {
  catalogId: string;
  offeringId: string;
  name: string;
  ok: boolean;
  error?: string;
  booking?: CareLabBooking;
};

function isoDateLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function nextFourteenDates(from = new Date()) {
  const out: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() + i);
    out.push(isoDateLocal(d));
  }
  return out;
}

function cheapestPerCatalog(offerings: CareOffering[]) {
  const map = new Map<string, CareOffering>();
  for (const o of offerings) {
    const prev = map.get(o.catalog_id);
    if (!prev || offeringSalePrice(o) < offeringSalePrice(prev)) map.set(o.catalog_id, o);
  }
  return map;
}

/** Greedy: org covering the most remaining tests; tie-break = lowest sum of those tests. */
export function packCheapestSameClinic(catalogIds: string[], offerings: CareOffering[]): BundlePlan {
  const remaining = new Set(catalogIds.filter(Boolean));
  const byOrg = new Map<string, CareOffering[]>();
  for (const o of offerings) {
    if (!remaining.has(o.catalog_id)) continue;
    const list = byOrg.get(o.org_id) ?? [];
    list.push(o);
    byOrg.set(o.org_id, list);
  }

  const groups: BundleClinicGroup[] = [];
  while (remaining.size) {
    let best: { orgId: string; picks: CareOffering[]; sum: number } | null = null;
    for (const [orgId, rows] of byOrg) {
      const cheap = cheapestPerCatalog(rows.filter((r) => remaining.has(r.catalog_id)));
      const picks = [...cheap.values()];
      if (!picks.length) continue;
      const sum = picks.reduce((n, p) => n + offeringSalePrice(p), 0);
      if (
        !best ||
        picks.length > best.picks.length ||
        (picks.length === best.picks.length && sum < best.sum)
      ) {
        best = { orgId, picks, sum };
      }
    }
    if (!best) break;
    const sample = best.picks[0];
    groups.push({
      orgId: best.orgId,
      orgName: sample.org?.name ?? "Clinic",
      orgNameBn: sample.org?.name_bn ?? null,
      items: best.picks.map((offering) => ({ catalogId: offering.catalog_id, offering })),
      subtotal: best.sum,
    });
    for (const p of best.picks) remaining.delete(p.catalog_id);
  }

  return {
    groups,
    uncovered: [...remaining],
    total: groups.reduce((n, g) => n + g.subtotal, 0),
  };
}

export async function loadBundlePlan(catalogIds: string[], districtId?: string): Promise<BundlePlan> {
  const ids = [...new Set(catalogIds.filter(Boolean))];
  if (!ids.length) return { groups: [], uncovered: [], total: 0 };
  const offerings = await searchTestOfferings({ catalogIds: ids, districtId });
  return packCheapestSameClinic(ids, offerings);
}

async function firstOpenCalendar(offering: CareOffering): Promise<CareLabCalendar> {
  const dates = nextFourteenDates();
  const existing = await fetchLabCalendars(offering.id, dates[0], dates[dates.length - 1]);
  const open = existing.find((c) => remainingSeats(c) > 0);
  if (open) return open;

  for (const date of dates) {
    const cal = await ensurePatientLabDay(offering.id, date);
    if (remainingSeats(cal) > 0) return cal;
  }
  throw new Error("No open slot");
}

export async function bookBundlePlan(plan: BundlePlan): Promise<BundleBookResult[]> {
  const results: BundleBookResult[] = [];
  for (const group of plan.groups) {
    try {
      const calendarIds: string[] = [];
      for (const item of group.items) {
        const cal = await firstOpenCalendar(item.offering);
        calendarIds.push(cal.id);
      }
      const bundle = await reserveLabBundle({ calendarIds, source: "app" });
      const byOffering = new Map(bundle.bookings.map((b) => [b.offering_id, b]));
      for (let i = 0; i < group.items.length; i++) {
        const item = group.items[i];
        const name = item.offering.catalog?.name_en || item.offering.catalog?.code || item.catalogId;
        const booking = byOffering.get(item.offering.id) ?? bundle.bookings[i];
        if (booking) {
          results.push({
            catalogId: item.catalogId,
            offeringId: item.offering.id,
            name,
            ok: true,
            booking,
          });
        } else {
          results.push({
            catalogId: item.catalogId,
            offeringId: item.offering.id,
            name,
            ok: false,
            error: "Booking missing from bundle response",
          });
        }
      }
    } catch (e) {
      // Fallback: reserve one-by-one if bundle RPC unavailable
      const msg = (e as Error).message;
      const useFallback = /Multi-test invoice is not enabled|care_reserve_lab_bundle/i.test(msg);
      if (!useFallback) {
        for (const item of group.items) {
          results.push({
            catalogId: item.catalogId,
            offeringId: item.offering.id,
            name: item.offering.catalog?.name_en || item.offering.catalog?.code || item.catalogId,
            ok: false,
            error: msg,
          });
        }
        continue;
      }
      for (const item of group.items) {
        const name = item.offering.catalog?.name_en || item.offering.catalog?.code || item.catalogId;
        try {
          const cal = await firstOpenCalendar(item.offering);
          const booking = await reserveLabSlot({ calendarId: cal.id, source: "app" });
          results.push({ catalogId: item.catalogId, offeringId: item.offering.id, name, ok: true, booking });
        } catch (err) {
          results.push({
            catalogId: item.catalogId,
            offeringId: item.offering.id,
            name,
            ok: false,
            error: (err as Error).message,
          });
        }
      }
    }
  }
  return results;
}
