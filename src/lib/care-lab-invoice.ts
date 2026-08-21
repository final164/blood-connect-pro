import { supabase } from "@/integrations/supabase/client";
import { fetchLabBooking } from "@/lib/care-lab-api";

export type CareLabInvoice = {
  booking_id: string;
  reference_code: string;
  invoice_no: string;
  price: number;
  price_original: number | null;
  discount_percent: number | null;
  payment_status: "pending" | "paid" | "waived";
  source: string;
  status: string;
  created_at: string;
  test_date: string;
  slot_start: string | null;
  slot_end: string | null;
  test_code: string | null;
  test_name_bn: string | null;
  test_name_en: string | null;
  sample_type: string | null;
  prep_bn: string | null;
  prep_en: string | null;
  patient_name: string | null;
  patient_phone: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  org_id: string;
  org_name: string;
  org_name_bn: string | null;
  org_phone: string | null;
  org_address: string | null;
  org_upazila: string | null;
  district_name: string | null;
  district_name_bn: string | null;
  location_name: string;
  location_name_bn: string | null;
  location_address: string | null;
  location_phone: string | null;
  home_collection: boolean;
};

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

export async function fetchCareLabInvoice(bookingId: string): Promise<CareLabInvoice | null> {
  const booking = await fetchLabBooking(bookingId);
  if (!booking) return null;

  const [calRes, offRes, orgRes, locRes, profileRes] = await Promise.all([
    supabase
      .from("care_lab_calendars")
      .select("cal_date, slot_start, slot_end")
      .eq("id", booking.calendar_id)
      .maybeSingle(),
    supabase
      .from("care_test_offerings")
      .select("home_collection, care_test_catalog(code, name_bn, name_en, sample_type, prep_bn, prep_en)")
      .eq("id", booking.offering_id)
      .maybeSingle(),
    supabase
      .from("care_orgs")
      .select("id, name, name_bn, phone, address, upazila, district_id")
      .eq("id", booking.org_id)
      .maybeSingle(),
    supabase
      .from("care_locations")
      .select("name, name_bn, address, phone")
      .eq("id", booking.location_id)
      .maybeSingle(),
    booking.patient_id
      ? supabase.from("profiles").select("full_name, phone").eq("id", booking.patient_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const cal = calRes.data as { cal_date?: string; slot_start?: string | null; slot_end?: string | null } | null;
  const off = offRes.data as Record<string, unknown> | null;
  const cat = off?.care_test_catalog as Record<string, unknown> | null;
  const org = orgRes.data as Record<string, unknown> | null;
  const loc = locRes.data as Record<string, unknown> | null;
  const profile = profileRes.data as { full_name?: string; phone?: string } | null;

  let districtName: string | null = null;
  let districtNameBn: string | null = null;
  const districtId = org?.district_id as string | null | undefined;
  if (districtId) {
    const { data: dist } = await supabase
      .from("districts")
      .select("name, name_bn")
      .eq("id", districtId)
      .maybeSingle();
    districtName = (dist as { name?: string } | null)?.name ?? null;
    districtNameBn = (dist as { name_bn?: string } | null)?.name_bn ?? null;
  }

  return {
    booking_id: booking.id,
    reference_code: booking.reference_code,
    invoice_no: booking.invoice_no || `BLT-${booking.id.slice(0, 8).toUpperCase()}`,
    price: num(booking.price),
    price_original:
      booking.price_original != null && Number(booking.price_original) > Number(booking.price)
        ? num(booking.price_original)
        : null,
    discount_percent:
      booking.discount_percent != null && Number(booking.discount_percent) > 0
        ? num(booking.discount_percent)
        : null,
    payment_status: (booking.payment_status || "pending") as CareLabInvoice["payment_status"],
    source: booking.source,
    status: booking.status,
    created_at: booking.created_at,
    test_date: str(cal?.cal_date),
    slot_start: cal?.slot_start ?? null,
    slot_end: cal?.slot_end ?? null,
    test_code: (cat?.code as string) ?? null,
    test_name_bn: (cat?.name_bn as string) ?? null,
    test_name_en: (cat?.name_en as string) ?? null,
    sample_type: (cat?.sample_type as string) ?? null,
    prep_bn: (cat?.prep_bn as string) ?? null,
    prep_en: (cat?.prep_en as string) ?? null,
    patient_name: profile?.full_name ?? null,
    patient_phone: profile?.phone ?? null,
    guest_name: booking.guest_name,
    guest_phone: booking.guest_phone,
    org_id: str(org?.id),
    org_name: str(org?.name),
    org_name_bn: (org?.name_bn as string) ?? null,
    org_phone: (org?.phone as string) ?? null,
    org_address: (org?.address as string) ?? null,
    org_upazila: (org?.upazila as string) ?? null,
    district_name: districtName,
    district_name_bn: districtNameBn,
    location_name: str(loc?.name),
    location_name_bn: (loc?.name_bn as string) ?? null,
    location_address: (loc?.address as string) ?? null,
    location_phone: (loc?.phone as string) ?? null,
    home_collection: !!off?.home_collection,
  };
}

export function labInvoicePatientName(inv: CareLabInvoice, lang: "bn" | "en"): string {
  const name = inv.patient_name || inv.guest_name;
  if (name) return name;
  return lang === "bn" ? "রোগী" : "Patient";
}

export function labInvoicePatientPhone(inv: CareLabInvoice): string {
  return inv.patient_phone || inv.guest_phone || "—";
}

export function labInvoiceOrgName(inv: CareLabInvoice, lang: "bn" | "en"): string {
  if (lang === "bn") return inv.org_name_bn || inv.org_name;
  return inv.org_name;
}

export function labInvoiceTestName(inv: CareLabInvoice, lang: "bn" | "en"): string {
  if (lang === "bn") return inv.test_name_bn || inv.test_name_en || inv.test_code || "—";
  return inv.test_name_en || inv.test_name_bn || inv.test_code || "—";
}

export function labInvoiceLocationLine(inv: CareLabInvoice, lang: "bn" | "en"): string {
  const loc = lang === "bn" ? inv.location_name_bn || inv.location_name : inv.location_name;
  const addr = inv.location_address || inv.org_address;
  const upa = inv.org_upazila;
  const dist = lang === "bn" ? inv.district_name_bn || inv.district_name : inv.district_name;
  return [loc, addr, upa, dist].filter(Boolean).join(", ");
}

export function labInvoiceSlotLine(inv: CareLabInvoice): string {
  const start = inv.slot_start ? String(inv.slot_start).slice(0, 5) : "";
  const end = inv.slot_end ? String(inv.slot_end).slice(0, 5) : "";
  if (start && end) return `${start} – ${end}`;
  return start || end || "—";
}

export async function setLabPaymentStatus(bookingId: string, status: CareLabInvoice["payment_status"]) {
  const { data, error } = await supabase.rpc("care_set_lab_payment", {
    _booking_id: bookingId,
    _payment_status: status,
  } as never);
  if (error) throw new Error(error.message);
  return data;
}
