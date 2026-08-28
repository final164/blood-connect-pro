import { supabase } from "@/integrations/supabase/client";
import { fetchOperationBooking } from "@/lib/care-operations-api";
import type { CareOperationPriceItem } from "@/lib/care-operations-api";

export type CareOperationInvoiceDoctor = {
  name: string;
  role: string;
  bmdc_no: string | null;
  qualifications: string | null;
};

export type CareOperationInvoice = {
  booking_id: string;
  reference_code: string;
  invoice_no: string;
  status: string;
  price: number;
  price_original: number | null;
  discount_percent: number | null;
  payment_status: "pending" | "paid" | "waived";
  amount_received: number | null;
  created_at: string;
  requested_date: string | null;
  scheduled_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  admission_date: string | null;
  desk_note: string | null;
  patient_note: string | null;
  operation_code: string | null;
  operation_name_bn: string | null;
  operation_name_en: string | null;
  prep_bn: string | null;
  prep_en: string | null;
  includes_bn: string | null;
  includes_en: string | null;
  price_note: string | null;
  price_items: CareOperationPriceItem[];
  doctors: CareOperationInvoiceDoctor[];
  patient_name: string | null;
  patient_phone: string | null;
  guest_age: string | null;
  guest_sex: string | null;
  guest_address: string | null;
  referred_by: string | null;
  org_id: string;
  org_name: string;
  org_name_bn: string | null;
  org_phone: string | null;
  org_address: string | null;
  location_name: string | null;
  location_name_bn: string | null;
};

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchCareOperationInvoice(
  bookingId: string,
): Promise<CareOperationInvoice | null> {
  const booking = await fetchOperationBooking(bookingId);
  if (!booking) return null;

  const [orgRes, locRes, catRes, offRes, itemsRes, docsRes, profileRes] = await Promise.all([
    supabase
      .from("care_orgs")
      .select("id, name, name_bn, phone, address")
      .eq("id", booking.org_id)
      .maybeSingle(),
    supabase
      .from("care_locations")
      .select("name, name_bn")
      .eq("id", booking.location_id)
      .maybeSingle(),
    supabase
      .from("care_operation_catalog")
      .select("code, name_bn, name_en, prep_bn, prep_en")
      .eq("id", booking.catalog_id)
      .maybeSingle(),
    supabase
      .from("care_operation_offerings")
      .select("includes_bn, includes_en, price_note")
      .eq("id", booking.offering_id)
      .maybeSingle(),
    supabase
      .from("care_operation_price_items")
      .select("id, offering_id, kind, label_bn, label_en, amount, sort_order")
      .eq("offering_id", booking.offering_id)
      .order("sort_order"),
    supabase
      .from("care_operation_booking_doctors")
      .select("doctor_id, role, doctor_name_snapshot, care_doctors(full_name, bmdc_no, qualifications)")
      .eq("booking_id", booking.id),
    booking.patient_id
      ? supabase.from("profiles").select("full_name, phone").eq("id", booking.patient_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const org = orgRes.data as Record<string, unknown> | null;
  const loc = locRes.data as Record<string, unknown> | null;
  const cat = catRes.data as Record<string, unknown> | null;
  const off = offRes.data as Record<string, unknown> | null;
  const profile = profileRes.data as { full_name?: string; phone?: string } | null;

  const price_items = ((itemsRes.data ?? []) as unknown as Record<string, unknown>[]).map((i) => ({
    ...(i as unknown as CareOperationPriceItem),
    amount: num(i.amount),
  }));

  const doctors: CareOperationInvoiceDoctor[] = (
    (docsRes.data ?? []) as unknown as Record<string, unknown>[]
  ).map((d) => {
    const doc = d.care_doctors as Record<string, unknown> | null;
    return {
      name: (doc?.full_name as string) || (d.doctor_name_snapshot as string) || "—",
      role: String(d.role ?? "lead_surgeon"),
      bmdc_no: (doc?.bmdc_no as string) ?? null,
      qualifications: (doc?.qualifications as string) ?? null,
    };
  });

  return {
    booking_id: booking.id,
    reference_code: booking.reference_code,
    invoice_no: booking.invoice_no || `BLO-${booking.id.slice(0, 8).toUpperCase()}`,
    status: booking.status,
    price: num(booking.price),
    price_original:
      booking.price_original != null && num(booking.price_original) > num(booking.price)
        ? num(booking.price_original)
        : null,
    discount_percent:
      booking.discount_percent != null && num(booking.discount_percent) > 0
        ? num(booking.discount_percent)
        : null,
    payment_status: booking.payment_status || "pending",
    amount_received: booking.amount_received != null ? num(booking.amount_received) : null,
    created_at: booking.created_at,
    requested_date: booking.requested_date,
    scheduled_date: booking.scheduled_date,
    scheduled_start: booking.scheduled_start,
    scheduled_end: booking.scheduled_end,
    admission_date: booking.admission_date,
    desk_note: booking.desk_note,
    patient_note: booking.patient_note,
    operation_code: (cat?.code as string) ?? null,
    operation_name_bn: (cat?.name_bn as string) ?? null,
    operation_name_en: (cat?.name_en as string) ?? null,
    prep_bn: (cat?.prep_bn as string) ?? null,
    prep_en: (cat?.prep_en as string) ?? null,
    includes_bn: (off?.includes_bn as string) ?? null,
    includes_en: (off?.includes_en as string) ?? null,
    price_note: (off?.price_note as string) ?? null,
    price_items,
    doctors,
    patient_name: booking.guest_name || profile?.full_name || null,
    patient_phone: booking.guest_phone || profile?.phone || null,
    guest_age: booking.guest_age,
    guest_sex: booking.guest_sex,
    guest_address: booking.guest_address,
    referred_by: booking.referred_by,
    org_id: booking.org_id,
    org_name: String(org?.name ?? ""),
    org_name_bn: (org?.name_bn as string) ?? null,
    org_phone: (org?.phone as string) ?? null,
    org_address: (org?.address as string) ?? null,
    location_name: (loc?.name as string) ?? null,
    location_name_bn: (loc?.name_bn as string) ?? null,
  };
}

export function operationInvoiceName(inv: CareOperationInvoice, lang: "bn" | "en"): string {
  if (lang === "bn") return inv.operation_name_bn || inv.operation_name_en || inv.operation_code || "—";
  return inv.operation_name_en || inv.operation_name_bn || inv.operation_code || "—";
}
