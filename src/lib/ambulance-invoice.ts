import { supabase } from "@/integrations/supabase/client";
import { fetchAmbulanceRequest } from "@/lib/ambulance-api";
import { formatCareMoney, paymentStatusLabel } from "@/lib/care-invoice";

export type AmbulanceInvoice = {
  request_id: string;
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
};

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export async function fetchAmbulanceInvoice(requestId: string): Promise<AmbulanceInvoice | null> {
  const req = await fetchAmbulanceRequest(requestId);
  if (!req) return null;

  const [svcRes, orgRes, vehRes, drvRes, profileRes] = await Promise.all([
    req.service_type_id
      ? supabase.from("ambulance_service_types").select("name_bn, name_en").eq("id", req.service_type_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    req.org_id
      ? supabase.from("care_orgs").select("id, name, name_bn, phone, address").eq("id", req.org_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    req.assigned_vehicle_id
      ? supabase.from("ambulance_vehicles").select("plate_no, label").eq("id", req.assigned_vehicle_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    req.assigned_driver_id
      ? supabase.from("ambulance_drivers").select("full_name, phone").eq("id", req.assigned_driver_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    req.patient_id
      ? supabase.from("profiles").select("full_name, phone").eq("id", req.patient_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const svc = svcRes.data as { name_bn?: string; name_en?: string } | null;
  const org = orgRes.data as Record<string, unknown> | null;
  const veh = vehRes.data as { plate_no?: string } | null;
  const drv = drvRes.data as { full_name?: string; phone?: string } | null;
  const profile = profileRes.data as { full_name?: string; phone?: string } | null;

  const fare = num(req.final_fare ?? req.estimated_fare);
  const disc = req.discount_percent != null ? Number(req.discount_percent) : null;
  const original = req.fare_original != null ? num(req.fare_original) : null;

  return {
    request_id: req.id,
    reference_code: req.reference_code,
    invoice_no: req.invoice_no || `BLA-${req.id.slice(0, 8).toUpperCase()}`,
    mode: req.mode,
    status: req.status,
    payment_status: req.payment_status,
    estimated_fare: num(req.estimated_fare),
    final_fare: fare,
    fare_original: original != null && disc != null && disc > 0 ? original : null,
    discount_percent: disc != null && disc > 0 ? disc : null,
    distance_km: req.distance_km,
    created_at: req.created_at,
    patient_name: profile?.full_name ?? null,
    patient_phone: profile?.phone ?? null,
    guest_name: req.guest_name,
    guest_phone: req.guest_phone,
    guest_age: (req as { guest_age?: number | null }).guest_age ?? null,
    guest_sex: (req as { guest_sex?: string | null }).guest_sex ?? null,
    guest_address: (req as { guest_address?: string | null }).guest_address ?? null,
    referred_by: (req as { referred_by?: string | null }).referred_by ?? null,
    amount_received:
      (req as { amount_received?: number | null }).amount_received != null
        ? num((req as { amount_received?: number | null }).amount_received)
        : null,
    pickup_address: req.pickup_address,
    pickup_upazila: req.pickup_upazila,
    dropoff_address: req.dropoff_address,
    dropoff_upazila: req.dropoff_upazila,
    service_name_bn: svc?.name_bn ?? null,
    service_name_en: svc?.name_en ?? null,
    org_id: req.org_id,
    org_name: String(org?.name ?? "Ambulance Service"),
    org_name_bn: (org?.name_bn as string) ?? null,
    org_phone: (org?.phone as string) ?? null,
    org_address: (org?.address as string) ?? null,
    plate_no: veh?.plate_no ?? null,
    driver_name: drv?.full_name ?? null,
    driver_phone: drv?.phone ?? null,
  };
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
