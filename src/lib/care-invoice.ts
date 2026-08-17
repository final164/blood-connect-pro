import { supabase } from "@/integrations/supabase/client";

export type CareSerialInvoice = {
  serial_id: string;
  serial_no: number;
  claim_code: string;
  invoice_no: string;
  fee_amount: number;
  payment_status: "pending" | "paid" | "waived";
  source: string;
  status: string;
  created_at: string;
  session_date: string;
  schedule_start: string | null;
  schedule_end: string | null;
  patient_name: string | null;
  patient_phone: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  doctor_name: string;
  doctor_name_bn: string | null;
  doctor_qualifications: string | null;
  doctor_bmdc: string | null;
  specialty_bn: string | null;
  specialty_en: string | null;
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
};

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function str(v: unknown): string {
  return v != null ? String(v) : "";
}

export function formatCareMoney(amount: number, lang: "bn" | "en" = "bn"): string {
  const formatted = amount.toLocaleString("en-BD", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return lang === "bn" ? `৳${formatted}` : `BDT ${formatted}`;
}

export function paymentStatusLabel(status: CareSerialInvoice["payment_status"], lang: "bn" | "en"): string {
  const map = {
    pending: { bn: "পরিশোধ বাকি", en: "Pending" },
    paid: { bn: "পরিশোধিত", en: "Paid" },
    waived: { bn: "মওকুফ", en: "Waived" },
  } as const;
  return map[status][lang];
}

export async function fetchCareSerialInvoice(serialId: string): Promise<CareSerialInvoice | null> {
  const { data, error } = await supabase
    .from("care_serials")
    .select(
      `
      id, serial_no, claim_code, invoice_no, fee_amount, payment_status, source, status, created_at,
      guest_name, guest_phone, patient_id,
      profiles:patient_id ( full_name, phone ),
      care_sessions (
        session_date, schedule_id, org_id, location_id, doctor_id,
        care_schedules ( start_time, end_time ),
        care_doctors ( full_name, full_name_bn, qualifications, bmdc_no, care_specialties ( name_bn, name_en ) ),
        care_orgs ( id, name, name_bn, phone, address, upazila, district_id, districts ( name, name_bn ) ),
        care_locations ( name, name_bn, address, phone )
      )
    `,
    )
    .eq("id", serialId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Record<string, unknown>;
  const sess = row.care_sessions as Record<string, unknown> | null;
  if (!sess) return null;

  const sch = sess.care_schedules as { start_time?: string; end_time?: string } | null;
  const doc = sess.care_doctors as Record<string, unknown> | null;
  const spec = doc?.care_specialties as { name_bn?: string; name_en?: string } | null;
  const org = sess.care_orgs as Record<string, unknown> | null;
  const dist = org?.districts as { name?: string; name_bn?: string } | null;
  const loc = sess.care_locations as Record<string, unknown> | null;
  const profile = row.profiles as { full_name?: string; phone?: string } | null;

  const feeFromAff = await lookupAffiliationFee(
    str(sess.org_id),
    str(sess.doctor_id),
    str(sess.location_id),
  );

  return {
    serial_id: str(row.id),
    serial_no: num(row.serial_no),
    claim_code: str(row.claim_code),
    invoice_no: str(row.invoice_no) || `BLC-${str(row.id).slice(0, 8).toUpperCase()}`,
    fee_amount: row.fee_amount != null ? num(row.fee_amount) : feeFromAff,
    payment_status: (str(row.payment_status) || "pending") as CareSerialInvoice["payment_status"],
    source: str(row.source),
    status: str(row.status),
    created_at: str(row.created_at),
    session_date: str(sess.session_date),
    schedule_start: sch?.start_time ?? null,
    schedule_end: sch?.end_time ?? null,
    patient_name: profile?.full_name ?? null,
    patient_phone: profile?.phone ?? null,
    guest_name: (row.guest_name as string) ?? null,
    guest_phone: (row.guest_phone as string) ?? null,
    doctor_name: str(doc?.full_name),
    doctor_name_bn: (doc?.full_name_bn as string) ?? null,
    doctor_qualifications: (doc?.qualifications as string) ?? null,
    doctor_bmdc: (doc?.bmdc_no as string) ?? null,
    specialty_bn: spec?.name_bn ?? null,
    specialty_en: spec?.name_en ?? null,
    org_id: str(org?.id),
    org_name: str(org?.name),
    org_name_bn: (org?.name_bn as string) ?? null,
    org_phone: (org?.phone as string) ?? null,
    org_address: (org?.address as string) ?? null,
    org_upazila: (org?.upazila as string) ?? null,
    district_name: dist?.name ?? null,
    district_name_bn: dist?.name_bn ?? null,
    location_name: str(loc?.name),
    location_name_bn: (loc?.name_bn as string) ?? null,
    location_address: (loc?.address as string) ?? null,
    location_phone: (loc?.phone as string) ?? null,
  };
}

async function lookupAffiliationFee(orgId: string, doctorId: string, locationId: string): Promise<number> {
  const { data } = await supabase
    .from("care_affiliations")
    .select("fee_amount")
    .eq("org_id", orgId)
    .eq("doctor_id", doctorId)
    .eq("location_id", locationId)
    .eq("is_active", true)
    .maybeSingle();
  return num((data as { fee_amount?: number } | null)?.fee_amount);
}

export function invoicePatientName(inv: CareSerialInvoice, lang: "bn" | "en"): string {
  const name = inv.patient_name || inv.guest_name;
  if (name) return name;
  return lang === "bn" ? "রোগী" : "Patient";
}

export function invoicePatientPhone(inv: CareSerialInvoice): string {
  return inv.patient_phone || inv.guest_phone || "—";
}

export function invoiceOrgName(inv: CareSerialInvoice, lang: "bn" | "en"): string {
  if (lang === "bn") return inv.org_name_bn || inv.org_name;
  return inv.org_name;
}

export function invoiceDoctorName(inv: CareSerialInvoice, lang: "bn" | "en"): string {
  if (lang === "bn") return inv.doctor_name_bn || inv.doctor_name;
  return inv.doctor_name;
}

export function invoiceLocationLine(inv: CareSerialInvoice, lang: "bn" | "en"): string {
  const loc = lang === "bn" ? inv.location_name_bn || inv.location_name : inv.location_name;
  const addr = inv.location_address || inv.org_address;
  const upa = inv.org_upazila;
  const dist = lang === "bn" ? inv.district_name_bn || inv.district_name : inv.district_name;
  return [loc, addr, upa, dist].filter(Boolean).join(", ");
}

export function invoiceScheduleLine(inv: CareSerialInvoice): string {
  const start = inv.schedule_start ? String(inv.schedule_start).slice(0, 5) : "";
  const end = inv.schedule_end ? String(inv.schedule_end).slice(0, 5) : "";
  if (start && end) return `${start} – ${end}`;
  return start || end || "—";
}

export async function setSerialPaymentStatus(serialId: string, status: CareSerialInvoice["payment_status"]) {
  const { data, error } = await supabase.rpc("care_set_serial_payment", {
    _serial_id: serialId,
    _payment_status: status,
  } as never);
  if (error) throw new Error(error.message);
  return data;
}

export function printCareSerialInvoice(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Invoice</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Segoe UI",system-ui,sans-serif;color:#111827;background:#fff;padding:24px}
  .invoice{max-width:720px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden}
  .head{background:linear-gradient(135deg,#b91c1c,#dc2626);color:#fff;padding:20px 24px}
  .head h1{font-size:20px;font-weight:800}
  .head p{font-size:12px;opacity:.9;margin-top:4px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px 24px;background:#fef2f2;border-bottom:1px solid #fecaca}
  .meta div{font-size:12px}
  .meta strong{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#991b1b;margin-bottom:2px}
  section{padding:16px 24px;border-bottom:1px solid #f3f4f6}
  section h2{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:8px}
  .row{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:4px 0}
  .serial-box{text-align:center;padding:20px;background:#fff}
  .serial-num{font-size:56px;font-weight:900;color:#b91c1c;line-height:1}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
  th,td{padding:10px 8px;text-align:left;border-bottom:1px solid #f3f4f6}
  th{font-size:10px;text-transform:uppercase;color:#6b7280}
  td:last-child,th:last-child{text-align:right}
  .total{font-size:16px;font-weight:800;color:#111827}
  .foot{padding:16px 24px;font-size:11px;color:#6b7280;line-height:1.5}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;background:#fef3c7;color:#92400e}
  .badge.paid{background:#dcfce7;color:#166534}
  @media print{body{padding:0}.no-print{display:none!important}}
</style></head><body>`);
  w.document.write(el.innerHTML);
  w.document.write(`<script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
}
