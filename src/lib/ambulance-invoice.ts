import { supabase } from "@/integrations/supabase/client";
import { fetchAmbulanceRequest, type AmbulanceRequest } from "@/lib/ambulance-api";
import { formatCareMoney, paymentStatusLabel } from "@/lib/care-invoice";

export type AmbulanceInvoiceLine = {
  request_id: string;
  reference_code: string;
  service_name_bn: string | null;
  service_name_en: string | null;
  mode: string;
  final_fare: number;
  fare_original: number | null;
  discount_percent: number | null;
};

export type AmbulanceInvoice = {
  request_id: string;
  invoice_group_id: string | null;
  reference_code: string;
  invoice_no: string;
  mode: string;
  status: string;
  payment_status: "pending" | "paid" | "waived";
  estimated_fare: number;
  final_fare: number;
  fare_original: number | null;
  discount_percent: number | null;
  distance_km: number | null;
  created_at: string;
  patient_name: string | null;
  patient_phone: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_age: number | null;
  guest_sex: string | null;
  guest_address: string | null;
  referred_by: string | null;
  amount_received: number | null;
  pickup_address: string | null;
  pickup_upazila: string | null;
  dropoff_address: string | null;
  dropoff_upazila: string | null;
  service_name_bn: string | null;
  service_name_en: string | null;
  org_id: string | null;
  org_name: string;
  org_name_bn: string | null;
  org_phone: string | null;
  org_address: string | null;
  plate_no: string | null;
  driver_name: string | null;
  driver_phone: string | null;
  lines: AmbulanceInvoiceLine[];
};

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

async function fetchGroupRequests(primary: AmbulanceRequest): Promise<AmbulanceRequest[]> {
  const groupId = primary.invoice_group_id;
  if (!groupId || groupId === primary.id) {
    return [primary];
  }

  const { data, error } = await supabase
    .from("ambulance_requests")
    .select(
      "id, org_id, patient_id, guest_name, guest_phone, guest_age, guest_sex, guest_address, referred_by, mode, service_type_id, reference_code, invoice_no, invoice_group_id, payment_status, amount_received, estimated_fare, final_fare, fare_original, discount_percent, distance_km, created_at, status, assigned_vehicle_id, assigned_driver_id, pickup_address, pickup_upazila, dropoff_address, dropoff_upazila",
    )
    .eq("invoice_group_id", groupId)
    .order("created_at", { ascending: true });

  if (error) {
    if (/invoice_group_id|guest_age|amount_received/i.test(error.message ?? "")) {
      return [primary];
    }
    throw new Error(error.message);
  }

  const rows = (data ?? []) as AmbulanceRequest[];
  return rows.length > 0 ? rows : [primary];
}

export async function fetchAmbulanceInvoice(requestId: string): Promise<AmbulanceInvoice | null> {
  const primary = await fetchAmbulanceRequest(requestId);
  if (!primary) return null;

  const group = await fetchGroupRequests(primary);
  const serviceIds = [...new Set(group.map((r) => r.service_type_id).filter(Boolean))] as string[];

  const [svcMap, orgRes, vehRes, drvRes, profileRes] = await Promise.all([
    serviceIds.length
      ? supabase.from("ambulance_service_types").select("id, name_bn, name_en").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    primary.org_id
      ? supabase.from("care_orgs").select("id, name, name_bn, phone, address").eq("id", primary.org_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    primary.assigned_vehicle_id
      ? supabase.from("ambulance_vehicles").select("plate_no, label").eq("id", primary.assigned_vehicle_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    primary.assigned_driver_id
      ? supabase.from("ambulance_drivers").select("full_name, phone").eq("id", primary.assigned_driver_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    primary.patient_id
      ? supabase.from("profiles").select("full_name, phone").eq("id", primary.patient_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const typeById = new Map(
    ((svcMap.data ?? []) as { id: string; name_bn?: string; name_en?: string }[]).map((t) => [t.id, t]),
  );

  const lines: AmbulanceInvoiceLine[] = group.map((row) => {
    const svc = row.service_type_id ? typeById.get(row.service_type_id) : null;
    const fare = num(row.final_fare ?? row.estimated_fare);
    const disc = row.discount_percent != null ? Number(row.discount_percent) : null;
    const original = row.fare_original != null ? num(row.fare_original) : null;
    return {
      request_id: row.id,
      reference_code: row.reference_code,
      service_name_bn: svc?.name_bn ?? null,
      service_name_en: svc?.name_en ?? null,
      mode: row.mode,
      final_fare: fare,
      fare_original: original != null && disc != null && disc > 0 ? original : null,
      discount_percent: disc != null && disc > 0 ? disc : null,
    };
  });

  const subtotal = lines.reduce((n, l) => n + (l.fare_original != null && l.fare_original > l.final_fare ? l.fare_original : l.final_fare), 0);
  const totalFare = lines.reduce((n, l) => n + l.final_fare, 0);
  const totalOriginal = lines.reduce((n, l) => n + (l.fare_original ?? l.final_fare), 0);
  const hasDiscount = totalOriginal > totalFare;

  const org = orgRes.data as Record<string, unknown> | null;
  const veh = vehRes.data as { plate_no?: string } | null;
  const drv = drvRes.data as { full_name?: string; phone?: string } | null;
  const profile = profileRes.data as { full_name?: string; phone?: string } | null;

  const firstSvc = primary.service_type_id ? typeById.get(primary.service_type_id) : null;

  return {
    request_id: primary.id,
    invoice_group_id: primary.invoice_group_id ?? null,
    reference_code: primary.reference_code,
    invoice_no: primary.invoice_no || `BLA-${primary.id.slice(0, 8).toUpperCase()}`,
    mode: primary.mode,
    status: primary.status,
    payment_status: primary.payment_status,
    estimated_fare: num(primary.estimated_fare),
    final_fare: round2(totalFare),
    fare_original: hasDiscount ? round2(totalOriginal) : null,
    discount_percent: hasDiscount && subtotal > 0 ? round2(((totalOriginal - totalFare) / totalOriginal) * 100) : null,
    distance_km: primary.distance_km,
    created_at: primary.created_at,
    patient_name: profile?.full_name ?? null,
    patient_phone: profile?.phone ?? null,
    guest_name: primary.guest_name,
    guest_phone: primary.guest_phone,
    guest_age: primary.guest_age ?? null,
    guest_sex: primary.guest_sex ?? null,
    guest_address: primary.guest_address ?? null,
    referred_by: primary.referred_by ?? null,
    amount_received: primary.amount_received != null ? num(primary.amount_received) : null,
    pickup_address: primary.pickup_address,
    pickup_upazila: primary.pickup_upazila,
    dropoff_address: primary.dropoff_address,
    dropoff_upazila: primary.dropoff_upazila,
    service_name_bn: firstSvc?.name_bn ?? lines[0]?.service_name_bn ?? null,
    service_name_en: firstSvc?.name_en ?? lines[0]?.service_name_en ?? null,
    org_id: primary.org_id,
    org_name: String(org?.name ?? "Ambulance Service"),
    org_name_bn: (org?.name_bn as string) ?? null,
    org_phone: (org?.phone as string) ?? null,
    org_address: (org?.address as string) ?? null,
    plate_no: veh?.plate_no ?? null,
    driver_name: drv?.full_name ?? null,
    driver_phone: drv?.phone ?? null,
    lines,
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function ambulanceInvoicePatientName(inv: AmbulanceInvoice, lang: "bn" | "en"): string {
  return inv.patient_name || inv.guest_name || (lang === "bn" ? "রোগী" : "Patient");
}

export function ambulanceInvoicePatientPhone(inv: AmbulanceInvoice): string {
  return inv.patient_phone || inv.guest_phone || "—";
}

export function ambulanceInvoiceOrgName(inv: AmbulanceInvoice, lang: "bn" | "en"): string {
  return lang === "bn" ? inv.org_name_bn || inv.org_name : inv.org_name;
}

export function ambulanceInvoiceServiceName(inv: AmbulanceInvoice, lang: "bn" | "en"): string {
  if (inv.lines.length > 1) {
    return inv.lines
      .map((l) => (lang === "bn" ? l.service_name_bn || l.service_name_en : l.service_name_en || l.service_name_bn) || "—")
      .join(", ");
  }
  return lang === "bn" ? inv.service_name_bn || inv.service_name_en || "—" : inv.service_name_en || inv.service_name_bn || "—";
}

export { formatCareMoney, paymentStatusLabel };

export async function setAmbulanceInvoicePayment(
  requestId: string,
  status: AmbulanceInvoice["payment_status"],
  amountReceived?: number | null,
) {
  const { setAmbulancePayment } = await import("@/lib/ambulance-api");
  return setAmbulancePayment(requestId, status, amountReceived);
}
