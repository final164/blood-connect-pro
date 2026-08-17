import { supabase } from "@/integrations/supabase/client";
import { fetchSerial, fetchSession } from "@/lib/care-api";

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
  const serial = await fetchSerial(serialId);
  if (!serial) return null;

  const sess = await fetchSession(serial.session_id);
  if (!sess) return null;

  const [schRes, docRes, orgRes, locRes, profileRes, affRes] = await Promise.all([
    supabase
      .from("care_schedules")
      .select("start_time, end_time")
      .eq("id", sess.schedule_id)
      .maybeSingle(),
    supabase
      .from("care_doctors")
      .select("full_name, full_name_bn, qualifications, bmdc_no, specialty_id, care_specialties(name_bn, name_en)")
      .eq("id", sess.doctor_id)
      .maybeSingle(),
    supabase
      .from("care_orgs")
      .select("id, name, name_bn, phone, address, upazila, district_id")
      .eq("id", sess.org_id)
      .maybeSingle(),
    supabase
      .from("care_locations")
      .select("name, name_bn, address, phone")
      .eq("id", sess.location_id)
      .maybeSingle(),
    serial.patient_id
      ? supabase.from("profiles").select("full_name, phone").eq("id", serial.patient_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("care_affiliations")
      .select("fee_amount")
      .eq("org_id", sess.org_id)
      .eq("doctor_id", sess.doctor_id)
      .eq("location_id", sess.location_id)
      .eq("is_active", true)
      .maybeSingle(),
  ]);

  const sch = schRes.data as { start_time?: string; end_time?: string } | null;
  const doc = docRes.data as Record<string, unknown> | null;
  const org = orgRes.data as Record<string, unknown> | null;
  const loc = locRes.data as Record<string, unknown> | null;
  const profile = profileRes.data as { full_name?: string; phone?: string } | null;
  const spec = doc?.care_specialties as { name_bn?: string; name_en?: string } | null;

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

  const feeFromAff = num((affRes.data as { fee_amount?: number } | null)?.fee_amount);

  return {
    serial_id: serial.id,
    serial_no: serial.serial_no,
    claim_code: serial.claim_code,
    invoice_no: serial.invoice_no || `BLC-${serial.id.slice(0, 8).toUpperCase()}`,
    fee_amount: serial.fee_amount != null ? num(serial.fee_amount) : feeFromAff,
    payment_status: (serial.payment_status || "pending") as CareSerialInvoice["payment_status"],
    source: serial.source,
    status: serial.status,
    created_at: serial.created_at,
    session_date: sess.session_date,
    schedule_start: sch?.start_time ?? null,
    schedule_end: sch?.end_time ?? null,
    patient_name: profile?.full_name ?? null,
    patient_phone: profile?.phone ?? null,
    guest_name: serial.guest_name,
    guest_phone: serial.guest_phone,
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
    district_name: districtName,
    district_name_bn: districtNameBn,
    location_name: str(loc?.name),
    location_name_bn: (loc?.name_bn as string) ?? null,
    location_address: (loc?.address as string) ?? null,
    location_phone: (loc?.phone as string) ?? null,
  };
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
  w.document.write(buildCareInvoiceDocument(el.innerHTML, false));
  w.document.write(`<script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
}

function careInvoiceCaptureStyles(forPdf: boolean) {
  return `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Segoe UI",system-ui,sans-serif;color:#111827;background:#fff;padding:${forPdf ? "16px" : "24px"}}
  .invoice{max-width:720px;margin:0 auto;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;background:#fff}
  .head{background:linear-gradient(135deg,#b91c1c,#dc2626);color:#fff;padding:20px 24px}
  .head h1{font-size:20px;font-weight:800}
  .head p{font-size:12px;opacity:.9;margin-top:4px}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px 24px;background:#fef2f2;border-bottom:1px solid #fecaca}
  .meta div{font-size:12px}
  .meta strong{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#991b1b;margin-bottom:2px}
  section{padding:16px 24px;border-bottom:1px solid #f3f4f6}
  section h2{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280;margin-bottom:8px}
  .row{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:4px 0}
  .serial-box{text-align:center;padding:20px;background:#fff;border-bottom:1px solid #f3f4f6}
  .serial-num{font-size:56px;font-weight:900;color:#b91c1c;line-height:1}
  table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
  th,td{padding:10px 8px;text-align:left;border-bottom:1px solid #f3f4f6}
  th{font-size:10px;text-transform:uppercase;color:#6b7280}
  td:last-child,th:last-child{text-align:right}
  .total{font-size:16px;font-weight:800;color:#111827}
  .foot{padding:16px 24px;font-size:11px;color:#6b7280;line-height:1.5;background:#f9fafb}
  .badge{display:inline-block;padding:2px 8px;border-radius:999px;font-size:10px;font-weight:700;background:#fef3c7;color:#92400e}
  .badge.paid{background:#dcfce7;color:#166534}
  @media print{body{padding:0}.no-print{display:none!important}}
`;
}

function buildCareInvoiceDocument(bodyHtml: string, forPdf: boolean) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Invoice</title>
<style>${careInvoiceCaptureStyles(forPdf)}</style></head><body><div class="invoice">${bodyHtml}</div>`;
}

/** Isolated iframe document for html2canvas (parent Tailwind oklch() breaks capture). */
async function mountInvoiceForPdfCapture(bodyHtml: string): Promise<{
  root: HTMLElement;
  cleanup: () => void;
}> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:800px;height:2400px;border:0;opacity:0;pointer-events:none";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    iframe.remove();
    throw new Error("Could not create PDF frame");
  }

  doc.open();
  doc.write(`${buildCareInvoiceDocument(bodyHtml, true)}</body></html>`);
  doc.close();

  await new Promise<void>((resolve) => {
    if (doc.readyState === "complete") {
      resolve();
      return;
    }
    iframe.onload = () => resolve();
    win.requestAnimationFrame(() => resolve());
  });

  const root = doc.querySelector(".invoice") as HTMLElement | null;
  if (!root) {
    iframe.remove();
    throw new Error("Invoice not found");
  }

  return {
    root,
    cleanup: () => iframe.remove(),
  };
}

/** Renders invoice DOM to a downloadable PDF file. */
export async function downloadCareSerialInvoicePdf(
  elementId: string,
  filename: string,
): Promise<void> {
  const el = document.getElementById(elementId);
  if (!el) throw new Error("Invoice not found");

  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const { root, cleanup } = await mountInvoiceForPdfCapture(el.innerHTML);
  let canvas;
  try {
    canvas = await html2canvas(root, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: root.scrollWidth,
      windowHeight: root.scrollHeight,
      scrollX: 0,
      scrollY: 0,
    });
  } finally {
    cleanup();
  }

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const margin = 10;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2;
  const imgWidth = contentWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL("image/png", 1);

  let heightLeft = imgHeight;
  let position = margin;

  pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
  heightLeft -= contentHeight;

  while (heightLeft > 0) {
    pdf.addPage();
    position = margin - (imgHeight - heightLeft);
    pdf.addImage(imgData, "PNG", margin, position, imgWidth, imgHeight);
    heightLeft -= contentHeight;
  }

  const safeName = filename.replace(/[^\w.-]+/g, "_");
  pdf.save(safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`);
}
