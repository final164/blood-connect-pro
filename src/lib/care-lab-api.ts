import { supabase } from "@/integrations/supabase/client";
import {
  clampDiscountPercent,
  offeringHasDiscount,
  offeringListPrice,
  offeringSalePrice,
} from "@/lib/care-lab-price";

export type CareOffering = {
  id: string;
  org_id: string;
  location_id: string;
  catalog_id: string;
  /** List / MRP price */
  price: number;
  /** 0–100; sale = price × (1 − discount/100) */
  discount_percent: number;
  booking_mode: string;
  default_capacity: number;
  home_collection: boolean;
  is_active: boolean;
  catalog?: {
    code: string;
    name_bn: string;
    name_en: string;
    prep_bn: string | null;
    prep_en: string | null;
    fasting_notes_bn: string | null;
    fasting_notes_en: string | null;
    sample_type: string | null;
    category_id: string | null;
  } | null;
  org?: { id: string; name: string; name_bn: string | null; district_id: string | null } | null;
  location?: { id: string; name: string; name_bn: string | null; upazila: string | null; district_id: string | null } | null;
};

export {
  clampDiscountPercent,
  offeringHasDiscount,
  offeringListPrice,
  offeringSalePrice,
};

export type CareLabCalendar = {
  id: string;
  offering_id: string;
  location_id: string;
  cal_date: string;
  slot_start: string | null;
  slot_end: string | null;
  capacity: number;
  reserved_count: number;
  is_open: boolean;
};

export type CareLabBooking = {
  id: string;
  calendar_id: string;
  offering_id: string;
  org_id: string;
  location_id: string;
  patient_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  source: string;
  status: string;
  reference_code: string;
  invoice_no?: string | null;
  invoice_group_id?: string | null;
  payment_status?: "pending" | "paid" | "waived";
  price: number;
  price_original?: number | null;
  discount_percent?: number | null;
  created_at: string;
};

export type CareLabFacility = {
  id: string;
  name: string;
  name_bn: string | null;
  district_id: string | null;
  address: string | null;
  upazila: string | null;
  phone: string | null;
  kind_slug: string | null;
  kind_name_bn: string | null;
  kind_name_en: string | null;
  offering_count: number;
  from_price: number;
};

export type CareLabBundleResult = {
  invoice_group_id: string;
  invoice_no: string;
  primary_booking_id: string;
  count: number;
  bookings: CareLabBooking[];
};

function missing(error: { message?: string } | null) {
  return !!error && /does not exist|schema cache|relation/i.test(error.message ?? "");
}

export async function searchTestOfferings(opts: {
  q?: string;
  districtId?: string;
  upazila?: string;
  categoryId?: string;
  catalogIds?: string[];
  orgId?: string;
}): Promise<CareOffering[]> {
  const selectWithDisc = `
      id, org_id, location_id, catalog_id, price, discount_percent, booking_mode, default_capacity, home_collection, is_active,
      care_test_catalog ( code, name_bn, name_en, prep_bn, prep_en, fasting_notes_bn, fasting_notes_en, sample_type, category_id ),
      care_orgs ( id, name, name_bn, district_id, address, upazila, phone, is_verified, is_listed, is_active, org_kind_id ),
      care_locations ( id, name, name_bn, upazila, district_id )
    `;
  const selectNoDisc = `
      id, org_id, location_id, catalog_id, price, booking_mode, default_capacity, home_collection, is_active,
      care_test_catalog ( code, name_bn, name_en, prep_bn, prep_en, fasting_notes_bn, fasting_notes_en, sample_type, category_id ),
      care_orgs ( id, name, name_bn, district_id, address, upazila, phone, is_verified, is_listed, is_active, org_kind_id ),
      care_locations ( id, name, name_bn, upazila, district_id )
    `;
  let qy = supabase.from("care_test_offerings").select(selectWithDisc).eq("is_active", true);
  if (opts.catalogIds?.length) qy = qy.in("catalog_id", opts.catalogIds);
  if (opts.orgId) qy = qy.eq("org_id", opts.orgId);
  let { data, error } = await qy.limit(opts.catalogIds?.length || opts.orgId ? 500 : 200);
  if (error && /discount_percent/i.test(error.message)) {
    let q2 = supabase.from("care_test_offerings").select(selectNoDisc).eq("is_active", true);
    if (opts.catalogIds?.length) q2 = q2.in("catalog_id", opts.catalogIds);
    if (opts.orgId) q2 = q2.eq("org_id", opts.orgId);
    const retry = await q2.limit(opts.catalogIds?.length || opts.orgId ? 500 : 200);
    data = retry.data as typeof data;
    error = retry.error;
  }
  if (error) {
    if (missing(error)) return [];
    throw new Error(error.message);
  }
  const q = opts.q?.trim().toLowerCase() ?? "";
  const upazila = opts.upazila?.trim().toLowerCase() ?? "";
  const out: CareOffering[] = [];
  for (const raw of data ?? []) {
    const row = raw as Record<string, unknown>;
    const org = row.care_orgs as {
      id: string;
      name: string;
      name_bn: string | null;
      district_id: string | null;
      address?: string | null;
      upazila?: string | null;
      phone?: string | null;
      is_verified?: boolean;
      is_listed?: boolean;
      is_active?: boolean;
    } | null;
    const cat = row.care_test_catalog as CareOffering["catalog"];
    const loc = row.care_locations as CareOffering["location"];
    if (!org || org.is_verified === false || org.is_listed === false || org.is_active === false) continue;
    if (opts.districtId && org.district_id !== opts.districtId && loc?.district_id !== opts.districtId) continue;
    if (upazila && !(loc?.upazila ?? org.upazila ?? "").toLowerCase().includes(upazila)) continue;
    if (opts.categoryId && cat?.category_id !== opts.categoryId) continue;
    const hay = `${cat?.code ?? ""} ${cat?.name_bn ?? ""} ${cat?.name_en ?? ""} ${org.name} ${org.name_bn ?? ""}`.toLowerCase();
    if (q && !hay.includes(q)) continue;
    out.push({
      id: String(row.id),
      org_id: String(row.org_id),
      location_id: String(row.location_id),
      catalog_id: String(row.catalog_id),
      price: Number(row.price ?? 0),
      discount_percent: clampDiscountPercent(row.discount_percent),
      booking_mode: String(row.booking_mode ?? "day_quota"),
      default_capacity: Number(row.default_capacity ?? 40),
      home_collection: !!row.home_collection,
      is_active: true,
      catalog: cat,
      org,
      location: loc,
    });
  }
  // Prefer cheapest sale price for stable UX
  out.sort((a, b) => offeringSalePrice(a) - offeringSalePrice(b));
  return out;
}

/** Verified labs / clinics / hospital labs that have active test offerings. */
export async function searchLabFacilities(opts: {
  q?: string;
  districtId?: string;
  categoryId?: string;
}): Promise<CareLabFacility[]> {
  const offerings = await searchTestOfferings({
    q: opts.q,
    districtId: opts.districtId,
    categoryId: opts.categoryId,
  });

  const orgMeta = new Map<
    string,
    {
      org: NonNullable<CareOffering["org"]> & {
        address?: string | null;
        upazila?: string | null;
        phone?: string | null;
      };
      count: number;
      from: number;
    }
  >();

  for (const o of offerings) {
    if (!o.org) continue;
    const prev = orgMeta.get(o.org_id);
    const sale = offeringSalePrice(o);
    if (!prev) {
      orgMeta.set(o.org_id, { org: o.org as never, count: 1, from: sale });
    } else {
      prev.count += 1;
      prev.from = Math.min(prev.from, sale);
    }
  }

  const orgIds = [...orgMeta.keys()];
  if (!orgIds.length) return [];

  const { data: orgs, error } = await supabase
    .from("care_orgs")
    .select(
      "id, name, name_bn, district_id, address, upazila, phone, org_kind_id, care_vendor_types(slug, name_bn, name_en)",
    )
    .in("id", orgIds)
    .eq("is_verified", true)
    .eq("is_listed", true)
    .eq("is_active", true);
  if (error && !missing(error)) {
    return [...orgMeta.entries()]
      .map(([id, m]) => ({
        id,
        name: m.org.name,
        name_bn: m.org.name_bn,
        district_id: m.org.district_id,
        address: m.org.address ?? null,
        upazila: m.org.upazila ?? null,
        phone: m.org.phone ?? null,
        kind_slug: null,
        kind_name_bn: null,
        kind_name_en: null,
        offering_count: m.count,
        from_price: m.from,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const out: CareLabFacility[] = [];
  for (const raw of orgs ?? []) {
    const row = raw as Record<string, unknown>;
    const id = String(row.id);
    const meta = orgMeta.get(id);
    if (!meta) continue;
    const kind = row.care_vendor_types as {
      slug?: string;
      name_bn?: string;
      name_en?: string;
    } | null;
    out.push({
      id,
      name: String(row.name ?? meta.org.name),
      name_bn: (row.name_bn as string | null) ?? meta.org.name_bn,
      district_id: (row.district_id as string | null) ?? meta.org.district_id,
      address: (row.address as string | null) ?? null,
      upazila: (row.upazila as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      kind_slug: kind?.slug ?? null,
      kind_name_bn: kind?.name_bn ?? null,
      kind_name_en: kind?.name_en ?? null,
      offering_count: meta.count,
      from_price: meta.from,
    });
  }

  out.sort((a, b) => (a.name_bn || a.name).localeCompare(b.name_bn || b.name, "bn"));
  return out;
}

export async function fetchLabFacility(orgId: string): Promise<CareLabFacility | null> {
  const list = await searchLabFacilities({});
  const hit = list.find((f) => f.id === orgId);
  if (hit) return hit;

  const { data, error } = await supabase
    .from("care_orgs")
    .select(
      "id, name, name_bn, district_id, address, upazila, phone, is_verified, is_listed, is_active, care_vendor_types(slug, name_bn, name_en)",
    )
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as Record<string, unknown>;
  if (row.is_verified === false || row.is_listed === false || row.is_active === false) return null;
  const kind = row.care_vendor_types as { slug?: string; name_bn?: string; name_en?: string } | null;
  const offerings = await searchTestOfferings({ orgId });
  return {
    id: String(row.id),
    name: String(row.name),
    name_bn: (row.name_bn as string | null) ?? null,
    district_id: (row.district_id as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    upazila: (row.upazila as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    kind_slug: kind?.slug ?? null,
    kind_name_bn: kind?.name_bn ?? null,
    kind_name_en: kind?.name_en ?? null,
    offering_count: offerings.length,
    from_price: offerings.length ? Math.min(...offerings.map(offeringSalePrice)) : 0,
  };
}

export async function fetchOffering(id: string): Promise<CareOffering | null> {
  const rows = await searchTestOfferings({});
  return rows.find((r) => r.id === id) ?? null;
}

export async function fetchLabCalendars(offeringId: string, fromDate: string, toDate: string) {
  const { data, error } = await supabase
    .from("care_lab_calendars")
    .select("id, offering_id, location_id, cal_date, slot_start, slot_end, capacity, reserved_count, is_open")
    .eq("offering_id", offeringId)
    .gte("cal_date", fromDate)
    .lte("cal_date", toDate)
    .eq("is_open", true)
    .order("cal_date");
  if (error) {
    if (missing(error)) return [];
    throw new Error(error.message);
  }
  return (data as CareLabCalendar[]) ?? [];
}

export async function ensurePatientLabDay(offeringId: string, date?: string): Promise<CareLabCalendar> {
  const { data, error } = await supabase.rpc("care_ensure_patient_lab_day", {
    _offering_id: offeringId,
    ...(date ? { _date: date } : {}),
  } as never);
  if (error) throw new Error(error.message);
  return data as CareLabCalendar;
}

export async function reserveLabSlot(params: {
  calendarId: string;
  source?: "app" | "walk_in";
  guestName?: string;
  guestPhone?: string;
}): Promise<CareLabBooking> {
  const { data, error } = await supabase.rpc("care_reserve_lab", {
    _calendar_id: params.calendarId,
    _guest_name: params.guestName ?? null,
    _guest_phone: params.guestPhone ?? null,
    _source: params.source ?? "app",
  } as never);
  if (error) throw new Error(error.message);
  return data as CareLabBooking;
}

/** Reserve multiple same-clinic slots under one invoice. Requires migration RPC. */
export async function reserveLabBundle(params: {
  calendarIds: string[];
  source?: "app" | "walk_in";
  guestName?: string;
  guestPhone?: string;
}): Promise<CareLabBundleResult> {
  const ids = [...new Set(params.calendarIds.filter(Boolean))];
  if (ids.length === 0) throw new Error("Select at least one test");
  if (ids.length === 1) {
    const booking = await reserveLabSlot({
      calendarId: ids[0],
      source: params.source,
      guestName: params.guestName,
      guestPhone: params.guestPhone,
    });
    return {
      invoice_group_id: booking.invoice_group_id || booking.id,
      invoice_no: booking.invoice_no || `BLT-${booking.id.slice(0, 8).toUpperCase()}`,
      primary_booking_id: booking.id,
      count: 1,
      bookings: [booking],
    };
  }

  const { data, error } = await supabase.rpc("care_reserve_lab_bundle", {
    _calendar_ids: ids,
    _guest_name: params.guestName ?? null,
    _guest_phone: params.guestPhone ?? null,
    _source: params.source ?? "app",
  } as never);
  if (error) {
    if (/care_reserve_lab_bundle|does not exist|schema cache/i.test(error.message)) {
      throw new Error(
        "Multi-test invoice is not enabled on the server yet. Please apply the latest database migration.",
      );
    }
    throw new Error(error.message);
  }
  const raw = data as Record<string, unknown>;
  return {
    invoice_group_id: String(raw.invoice_group_id),
    invoice_no: String(raw.invoice_no),
    primary_booking_id: String(raw.primary_booking_id),
    count: Number(raw.count ?? ids.length),
    bookings: (Array.isArray(raw.bookings) ? raw.bookings : []) as CareLabBooking[],
  };
}

export async function fetchMyLabBookings(): Promise<(CareLabBooking & { offering?: CareOffering["catalog"] })[]> {
  const selectWithGroup =
    "id, calendar_id, offering_id, org_id, location_id, patient_id, guest_name, guest_phone, source, status, reference_code, invoice_no, invoice_group_id, payment_status, price, price_original, discount_percent, created_at, care_test_offerings(care_test_catalog(code, name_bn, name_en))";
  const selectNoGroup =
    "id, calendar_id, offering_id, org_id, location_id, patient_id, guest_name, guest_phone, source, status, reference_code, invoice_no, payment_status, price, price_original, discount_percent, created_at, care_test_offerings(care_test_catalog(code, name_bn, name_en))";

  let { data, error } = await supabase
    .from("care_lab_bookings")
    .select(selectWithGroup)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error && /invoice_group_id/i.test(error.message)) {
    const retry = await supabase
      .from("care_lab_bookings")
      .select(selectNoGroup)
      .order("created_at", { ascending: false })
      .limit(80);
    data = retry.data as typeof data;
    error = retry.error;
  }
  if (error) {
    if (missing(error)) return [];
    throw new Error(error.message);
  }
  return ((data as Record<string, unknown>[]) ?? []).map((row) => {
    const off = row.care_test_offerings as { care_test_catalog?: CareOffering["catalog"] } | null;
    return {
      ...(row as unknown as CareLabBooking),
      offering: off?.care_test_catalog ?? null,
    };
  });
}

export async function fetchLabBooking(id: string) {
  let { data, error } = await supabase
    .from("care_lab_bookings")
    .select(
      "id, calendar_id, offering_id, org_id, location_id, patient_id, guest_name, guest_phone, source, status, reference_code, invoice_no, invoice_group_id, payment_status, price, price_original, discount_percent, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error && /invoice_group_id/i.test(error.message)) {
    const retry = await supabase
      .from("care_lab_bookings")
      .select(
        "id, calendar_id, offering_id, org_id, location_id, patient_id, guest_name, guest_phone, source, status, reference_code, invoice_no, payment_status, price, price_original, discount_percent, created_at",
      )
      .eq("id", id)
      .maybeSingle();
    data = retry.data as typeof data;
    error = retry.error;
  }
  if (error) throw new Error(error.message);
  if (!data) return null;
  return data as CareLabBooking;
}

/** All bookings that share the same invoice (group or single). */
export async function fetchLabBookingsForInvoice(bookingId: string): Promise<CareLabBooking[]> {
  const primary = await fetchLabBooking(bookingId);
  if (!primary) return [];

  const groupId = primary.invoice_group_id;
  if (groupId) {
    const { data, error } = await supabase
      .from("care_lab_bookings")
      .select(
        "id, calendar_id, offering_id, org_id, location_id, patient_id, guest_name, guest_phone, source, status, reference_code, invoice_no, invoice_group_id, payment_status, price, price_original, discount_percent, created_at",
      )
      .eq("invoice_group_id", groupId)
      .order("created_at", { ascending: true });
    if (!error && data?.length) return data as CareLabBooking[];
  }

  if (primary.invoice_no) {
    const { data, error } = await supabase
      .from("care_lab_bookings")
      .select(
        "id, calendar_id, offering_id, org_id, location_id, patient_id, guest_name, guest_phone, source, status, reference_code, invoice_no, invoice_group_id, payment_status, price, price_original, discount_percent, created_at",
      )
      .eq("invoice_no", primary.invoice_no)
      .order("created_at", { ascending: true });
    if (!error && data?.length) return data as CareLabBooking[];
  }

  return [primary];
}

export async function setLabBookingStatus(id: string, status: string) {
  const { data, error } = await supabase.rpc("care_set_lab_booking_status", {
    _booking_id: id,
    _status: status,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareLabBooking;
}

export async function fetchOrgOfferings(orgId: string) {
  const { data, error } = await supabase
    .from("care_test_offerings")
    .select(
      "id, org_id, location_id, catalog_id, price, discount_percent, booking_mode, default_capacity, home_collection, is_active, care_test_catalog(code, name_bn, name_en), care_locations(name, name_bn)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) {
    // Graceful fallback before migration is applied
    if (/discount_percent/i.test(error.message)) {
      const retry = await supabase
        .from("care_test_offerings")
        .select(
          "id, org_id, location_id, catalog_id, price, booking_mode, default_capacity, home_collection, is_active, care_test_catalog(code, name_bn, name_en), care_locations(name, name_bn)",
        )
        .eq("org_id", orgId)
        .order("created_at", { ascending: false });
      if (retry.error) throw new Error(retry.error.message);
      return (retry.data ?? []).map((r) => ({ ...r, discount_percent: 0 }));
    }
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function fetchOrgLabBookings(orgId: string, date: string) {
  const { data: cals, error: cErr } = await supabase
    .from("care_lab_calendars")
    .select("id")
    .eq("cal_date", date);
  if (cErr) throw new Error(cErr.message);
  const ids = (cals ?? []).map((c: { id: string }) => c.id);
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("care_lab_bookings")
    .select(
      "id, calendar_id, offering_id, org_id, location_id, patient_id, guest_name, guest_phone, source, status, reference_code, invoice_no, payment_status, price, price_original, discount_percent, created_at, care_test_offerings(care_test_catalog(code, name_bn, name_en))",
    )
    .eq("org_id", orgId)
    .in("calendar_id", ids)
    .order("created_at");
  if (error) {
    if (/price_original|discount_percent/i.test(error.message)) {
      const retry = await supabase
        .from("care_lab_bookings")
        .select(
          "id, calendar_id, offering_id, org_id, location_id, patient_id, guest_name, guest_phone, source, status, reference_code, invoice_no, payment_status, price, created_at, care_test_offerings(care_test_catalog(code, name_bn, name_en))",
        )
        .eq("org_id", orgId)
        .in("calendar_id", ids)
        .order("created_at");
      if (retry.error) throw new Error(retry.error.message);
      return retry.data ?? [];
    }
    throw new Error(error.message);
  }
  return data ?? [];
}

export async function generateLabDay(offeringId: string, date: string, capacity?: number) {
  const { data, error } = await supabase.rpc("care_generate_lab_day", {
    _offering_id: offeringId,
    _date: date,
    _capacity: capacity ?? null,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareLabCalendar;
}

export function remainingSeats(cal: CareLabCalendar) {
  return Math.max(0, cal.capacity - cal.reserved_count);
}

export function subscribeLabCalendar(offeringId: string, onChange: () => void) {
  const ch = supabase
    .channel(`care-lab-${offeringId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "care_lab_calendars", filter: `offering_id=eq.${offeringId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "care_lab_bookings", filter: `offering_id=eq.${offeringId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(ch);
  };
}
