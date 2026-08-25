import { supabase } from "@/integrations/supabase/client";
import { fetchSerial, fetchSession } from "@/lib/care-api";

export type CareSerialInvoice = {
  serial_id: string;
  serial_no: number | null;
  online_serial_no: number | null;
  claim_code: string;
  invoice_no: string;
  fee_amount: number;
  fee_original: number | null;
  is_second_visit: boolean;
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
  guest_age: number | null;
  guest_sex: string | null;
  guest_address: string | null;
  referred_by: string | null;
  amount_received: number | null;
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

export function isInvoiceAwaitingSerial(inv: Pick<CareSerialInvoice, "status" | "serial_no">) {
  return inv.status === "pending_approval" || (inv.serial_no == null && inv.status !== "cancelled");
}

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
    online_serial_no: serial.online_serial_no ?? null,
    claim_code: serial.claim_code,
    invoice_no: serial.invoice_no || `BLC-${serial.id.slice(0, 8).toUpperCase()}`,
    fee_amount: serial.fee_amount != null ? num(serial.fee_amount) : feeFromAff,
    fee_original:
      serial.fee_original != null && num(serial.fee_original) > (serial.fee_amount != null ? num(serial.fee_amount) : feeFromAff)
        ? num(serial.fee_original)
        : null,
    is_second_visit: !!serial.is_second_visit,
    payment_status: (serial.payment_status || "pending") as CareSerialInvoice["payment_status"],
    source: serial.source,
    status: serial.status,
    created_at: serial.created_at,
    session_date: sess.session_date,
    schedule_start: sch?.start_time ?? null,
    schedule_end: sch?.end_time ?? null,
    patient_name: serial.guest_name || profile?.full_name || null,
    patient_phone: serial.guest_phone || profile?.phone || null,
    guest_name: serial.guest_name,
    guest_phone: serial.guest_phone,
    guest_age: serial.guest_age ?? null,
    guest_sex: (serial as { guest_sex?: string | null }).guest_sex ?? null,
    guest_address: serial.guest_address ?? null,
    referred_by: (serial as { referred_by?: string | null }).referred_by ?? null,
    amount_received:
      (serial as { amount_received?: number | null }).amount_received != null
        ? num((serial as { amount_received?: number | null }).amount_received)
        : null,
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

export async function setSerialPaymentStatus(
  serialId: string,
  status: CareSerialInvoice["payment_status"],
  amountReceived?: number | null,
) {
  let { data, error } = await supabase.rpc("care_set_serial_payment", {
    _serial_id: serialId,
    _payment_status: status,
    _amount_received: amountReceived ?? null,
  } as never);
  if (error && /_amount_received|could not find|function public\.care_set_serial_payment/i.test(error.message)) {
    ({ data, error } = await supabase.rpc("care_set_serial_payment", {
      _serial_id: serialId,
      _payment_status: status,
    } as never));
  }
  if (error) throw new Error(error.message);
  return data;
}

export function printCareSerialInvoice(elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(buildCareInvoiceDocument(el.innerHTML, "print"));
  w.document.write(`<script>window.onload=function(){window.print();}</script></body></html>`);
  w.document.close();
}

/** Strip embedded component styles so capture theme (print B&W / PDF color) wins. */
function stripEmbeddedStyles(html: string) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, "");
}

function careInvoiceCaptureStyles(mode: "print" | "pdf") {
  const color = mode === "pdf";
  const ink = color ? "#1e293b" : "#111";
  const border = color ? "#0f766e" : "#111";
  const soft = color ? "#f0fdfa" : "#fff";
  const headBg = color ? "linear-gradient(135deg,#0f766e 0%,#115e59 55%,#134e4a 100%)" : "transparent";
  const titleBg = color ? "#ccfbf1" : "#fff";
  const titleBorder = color ? "#0f766e" : "#111";
  const thBg = color ? "#0f766e" : "#fff";
  const thColor = color ? "#fff" : "#111";
  const rowAlt = color ? "#f8fafc" : "#fff";
  const discColor = color ? "#047857" : "#111";
  const payableBg = color ? "#ecfdf5" : "transparent";
  const payableColor = color ? "#065f46" : "#111";
  const rule = color ? "#0f766e" : "#111";
  const footBorder = color ? "#99f6e4" : "#999";

  return `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:"Times New Roman",Times,serif;color:${ink};background:#fff;padding:${color ? "12px" : "20px"}}
  .invoice,.cash-memo{max-width:720px;margin:0 auto;background:#fff;color:${ink}}
  .cash-memo{border:2px solid ${border};padding:14px 16px;${color ? "box-shadow:0 8px 24px rgba(15,118,110,.12);border-radius:4px;" : ""}}
  .cm-head{display:flex;gap:12px;align-items:flex-start;margin-bottom:8px;${color ? `padding:10px 12px;border-radius:4px;background:${headBg};color:#fff;` : ""}}
  .cm-logo{width:64px;height:64px;object-fit:contain;flex-shrink:0;${color ? "background:#fff;border-radius:8px;padding:4px;" : ""}}
  .cm-logo-fallback{width:64px;height:64px;border:2px solid ${color ? "#fff" : "#111"};border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:22px;${color ? "background:rgba(255,255,255,.2);color:#fff;" : "background:#fafafa"}}
  .cm-head-text{flex:1;text-align:center;min-width:0}
  .cm-org{font-size:20px;font-weight:800;letter-spacing:.02em;text-transform:uppercase;${color ? "color:#fff;" : ""}}
  .cm-addr,.cm-contact{font-size:12px;margin-top:2px;${color ? "color:#ccfbf1;" : ""}}
  .cm-rule{border-top:2px solid ${rule};margin:8px 0}
  .cm-title-box{display:flex;justify-content:center;margin:8px 0 10px}
  .cm-title-box span{border:1px solid ${titleBorder};padding:4px 18px;font-weight:700;font-size:14px;background:${titleBg};${color ? "color:#115e59;border-radius:4px;" : ""}}
  .cm-meta{font-size:12px;margin-bottom:10px;${color ? `background:${soft};padding:8px 10px;border-radius:4px;border:1px solid #99f6e4;` : ""}}
  .cm-meta-row{display:flex;flex-wrap:wrap;gap:8px 16px;margin:3px 0}
  .cm-grow{flex:1 1 12rem}
  .cm-meta b{font-weight:700;${color ? "color:#0f766e;" : ""}}
  .cm-table{width:100%;border-collapse:collapse;font-size:12px;margin:8px 0 12px}
  .cm-table th,.cm-table td{border-top:1px solid ${color ? "#99f6e4" : "#111"};border-bottom:1px solid ${color ? "#99f6e4" : "#111"};padding:6px 4px;text-align:left;vertical-align:top}
  .cm-table thead th{border-top:2px solid ${border};border-bottom:2px solid ${border};font-weight:700;background:${thBg};color:${thColor}}
  .cm-table tbody tr:nth-child(even) td{background:${rowAlt}}
  .cm-table .cm-sl{width:2.2rem}
  .cm-table .cm-name{width:34%}
  .cm-table .cm-amt,.cm-table th.cm-amt,.cm-table .cm-disc,.cm-table th.cm-disc{text-align:right;white-space:nowrap}
  .cm-table .cm-disc{width:5.5rem;color:${discColor};font-weight:${color ? "600" : "400"}}
  .cm-table .cm-amt{width:4.5rem}
  .cm-table-serial{font-size:${color ? "11px" : "11px"}}
  .cm-table-ambulance{font-size:${color ? "11px" : "11px"}}
  .cm-serial-online{font-size:.85em;opacity:.85}
  .cm-serial-extra{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:11px;margin:-4px 0 10px;${color ? "padding:6px 8px;background:#f8fafc;border:1px solid #99f6e4;border-radius:4px;" : ""}}
  .cm-serial-extra b{font-weight:700;${color ? "color:#0f766e;" : ""}}
  .cm-amb-extra{display:flex;flex-wrap:wrap;gap:8px 16px;font-size:11px;margin:-4px 0 10px;${color ? "padding:6px 8px;background:#f8fafc;border:1px solid #99f6e4;border-radius:4px;" : ""}}
  .cm-amb-extra b{font-weight:700;${color ? "color:#0f766e;" : ""}}
  .cm-disc-pct{display:inline;font-size:inherit;opacity:.85;margin-left:2px;font-weight:500}
  .cm-bottom{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-top:8px;flex-wrap:wrap}
  .cm-bottom-serial,.cm-bottom-ambulance{justify-content:flex-end}
  .cm-delivery{flex:1;font-size:12px}
  .cm-slots{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}
  .cm-slot{display:inline-flex;align-items:center;gap:4px}
  .cm-check{width:12px;height:12px;border:1px solid ${border};display:inline-block}
  .cm-totals{min-width:12rem;font-size:12px;${color ? "padding:8px 10px;border:1px solid #99f6e4;border-radius:4px;background:#fff;" : ""}}
  .cm-tot-row{display:flex;justify-content:space-between;gap:12px;padding:3px 0}
  .cm-tot-row.cm-disc-total span:last-child{color:${discColor};font-weight:600}
  .cm-strong{font-weight:800;margin-top:2px;${color ? `background:${payableBg};color:${payableColor};padding:4px 6px;margin:4px -6px 0;border-radius:3px;` : ""}}
  .cm-sign{margin-top:28px;text-align:right;font-size:12px}
  .cm-sign-line{display:inline-block;width:10rem;border-top:1px solid ${border};margin-bottom:4px}
  .cm-foot{margin-top:16px;font-size:11px;border-top:1px solid ${footBorder};padding-top:8px}
  .cm-thanks{font-weight:600;margin-bottom:4px;${color ? "color:#0f766e;" : ""}}
  .cm-disclaimer{margin-bottom:8px;line-height:1.35}
  .cm-foot-meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:10px;color:${color ? "#64748b" : "#333"}}
  .head{background:#111;color:#fff;padding:16px}
  .head h1{font-size:18px;font-weight:800}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px;border-bottom:1px solid #ddd}
  section{padding:12px;border-bottom:1px solid #eee}
  table{width:100%;border-collapse:collapse;font-size:12px}
  th,td{padding:8px 6px;border-bottom:1px solid #ddd;text-align:left}
  td:last-child,th:last-child{text-align:right}
  .foot{padding:12px;font-size:11px;color:#444}
  @media print{body{padding:0}.no-print{display:none!important}}
`;
}

function buildCareInvoiceDocument(bodyHtml: string, mode: "print" | "pdf") {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>Cash Memo</title>
<style>${careInvoiceCaptureStyles(mode)}</style></head><body>${stripEmbeddedStyles(bodyHtml)}`;
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
  doc.write(`${buildCareInvoiceDocument(bodyHtml, "pdf")}</body></html>`);
  doc.close();

  await new Promise<void>((resolve) => {
    if (doc.readyState === "complete") {
      resolve();
      return;
    }
    iframe.onload = () => resolve();
    win.requestAnimationFrame(() => resolve());
  });

  const root =
    (doc.querySelector(".cash-memo") as HTMLElement | null) ||
    (doc.querySelector(".invoice") as HTMLElement | null);
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
