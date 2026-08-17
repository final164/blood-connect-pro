import { supabase } from "@/integrations/supabase/client";

export type CareOffering = {
  id: string;
  org_id: string;
  location_id: string;
  catalog_id: string;
  price: number;
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
  payment_status?: "pending" | "paid" | "waived";
  price: number;
  created_at: string;
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
}): Promise<CareOffering[]> {
  let qy = supabase
    .from("care_test_offerings")
    .select(
      `
      id, org_id, location_id, catalog_id, price, booking_mode, default_capacity, home_collection, is_active,
      care_test_catalog ( code, name_bn, name_en, prep_bn, prep_en, fasting_notes_bn, fasting_notes_en, sample_type, category_id ),
      care_orgs ( id, name, name_bn, district_id, is_verified, is_listed, is_active ),
      care_locations ( id, name, name_bn, upazila, district_id )
    `,
    )
    .eq("is_active", true);
  if (opts.catalogIds?.length) qy = qy.in("catalog_id", opts.catalogIds);
  const { data, error } = await qy.limit(opts.catalogIds?.length ? 500 : 120);
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
      is_verified?: boolean;
      is_listed?: boolean;
      is_active?: boolean;
    } | null;
    const cat = row.care_test_catalog as CareOffering["catalog"];
    const loc = row.care_locations as CareOffering["location"];
    if (!org || org.is_verified === false || org.is_listed === false || org.is_active === false) continue;
    if (opts.districtId && org.district_id !== opts.districtId && loc?.district_id !== opts.districtId) continue;
    if (upazila && !(loc?.upazila ?? "").toLowerCase().includes(upazila)) continue;
    if (opts.categoryId && cat?.category_id !== opts.categoryId) continue;
    const hay = `${cat?.code ?? ""} ${cat?.name_bn ?? ""} ${cat?.name_en ?? ""} ${org.name}`.toLowerCase();
    if (q && !hay.includes(q)) continue;
    out.push({
      id: String(row.id),
      org_id: String(row.org_id),
      location_id: String(row.location_id),
      catalog_id: String(row.catalog_id),
      price: Number(row.price ?? 0),
      booking_mode: String(row.booking_mode ?? "day_quota"),
      default_capacity: Number(row.default_capacity ?? 40),
      home_collection: !!row.home_collection,
      is_active: true,
      catalog: cat,
      org,
      location: loc,
    });
  }
  return out;
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

export async function fetchMyLabBookings(): Promise<(CareLabBooking & { offering?: CareOffering["catalog"] })[]> {
  const { data, error } = await supabase
    .from("care_lab_bookings")
    .select(
      "id, calendar_id, offering_id, org_id, location_id, patient_id, guest_name, guest_phone, source, status, reference_code, invoice_no, payment_status, price, created_at, care_test_offerings(care_test_catalog(code, name_bn, name_en))",
    )
    .order("created_at", { ascending: false })
    .limit(50);
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
  const { data, error } = await supabase
    .from("care_lab_bookings")
    .select(
      "id, calendar_id, offering_id, org_id, location_id, patient_id, guest_name, guest_phone, source, status, reference_code, invoice_no, payment_status, price, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CareLabBooking) ?? null;
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
      "id, org_id, location_id, catalog_id, price, booking_mode, default_capacity, home_collection, is_active, care_test_catalog(code, name_bn, name_en), care_locations(name, name_bn)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
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
      "id, calendar_id, offering_id, org_id, location_id, patient_id, guest_name, guest_phone, source, status, reference_code, invoice_no, payment_status, price, created_at, care_test_offerings(care_test_catalog(code, name_bn, name_en))",
    )
    .eq("org_id", orgId)
    .in("calendar_id", ids)
    .order("created_at");
  if (error) throw new Error(error.message);
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
