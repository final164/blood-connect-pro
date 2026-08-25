import type { CareLabInvoice } from "@/lib/care-lab-invoice";
import { labInvoiceLineName, labInvoicePatientName, labInvoicePatientPhone } from "@/lib/care-lab-invoice";
import type { CareSerialInvoice } from "@/lib/care-invoice";
import type { AmbulanceInvoice } from "@/lib/ambulance-invoice";
import type { ResolvedCareInvoiceTemplate } from "@/lib/care-invoice-settings";

export type CareInvoiceMoney = {
  subtotal: number;
  discount_percent: number;
  discount_amount: number;
  vat_percent: number;
  vat_amount: number;
  payable: number;
  received: number;
  due: number;
};

export type CareInvoiceViewLine = {
  id: string;
  test_id: string;
  name: string;
  delivery_date: string;
  /** List / original unit price (before discount) */
  amount: number;
  /** Per-line discount amount (list − net) */
  discount: number;
  /** Optional percent shown beside line discount */
  discount_percent: number | null;
};

export type CareInvoiceViewModel = {
  kind: "lab" | "serial" | "ambulance";
  org_id: string;
  invoice_no: string;
  reg_no: string;
  lab_id: string;
  date: string;
  delivery_datetime: string | null;
  patient_name: string;
  patient_phone: string;
  patient_age: string | null;
  patient_sex: string | null;
  patient_address: string | null;
  referred_by: string | null;
  payment_status: "pending" | "paid" | "waived";
  lines: CareInvoiceViewLine[];
  money: CareInvoiceMoney;
  amount_received: number | null;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export function computeInvoiceMoney(opts: {
  subtotal: number;
  discountPercent?: number | null;
  discountAmount?: number | null;
  vatPercent: number;
  paymentStatus: "pending" | "paid" | "waived";
  amountReceived?: number | null;
}): CareInvoiceMoney {
  const subtotal = Math.max(0, opts.subtotal);
  let discount_amount = opts.discountAmount != null ? Math.max(0, opts.discountAmount) : 0;
  let discount_percent = opts.discountPercent != null ? Math.max(0, opts.discountPercent) : 0;
  if (discount_amount <= 0 && discount_percent > 0) {
    discount_amount = round2((subtotal * discount_percent) / 100);
  } else if (discount_percent <= 0 && discount_amount > 0 && subtotal > 0) {
    discount_percent = round2((discount_amount / subtotal) * 100);
  }
  const afterDisc = Math.max(0, subtotal - discount_amount);
  const vat_percent = Math.max(0, opts.vatPercent);
  const vat_amount = round2((afterDisc * vat_percent) / 100);
  const payable = round2(afterDisc + vat_amount);

  let received = 0;
  let due = payable;
  if (opts.paymentStatus === "waived") {
    received = 0;
    due = 0;
  } else if (opts.amountReceived != null && Number.isFinite(opts.amountReceived)) {
    received = Math.max(0, round2(opts.amountReceived));
    due = Math.max(0, round2(payable - received));
  } else if (opts.paymentStatus === "paid") {
    received = payable;
    due = 0;
  } else {
    received = 0;
    due = payable;
  }

  return {
    subtotal: round2(subtotal),
    discount_percent,
    discount_amount,
    vat_percent,
    vat_amount,
    payable,
    received,
    due,
  };
}

function fmtDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    // already yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      const [y, m, day] = raw.slice(0, 10).split("-");
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const mi = Number(m) - 1;
      return `${day}-${months[mi] ?? m}-${y}`;
    }
    return raw;
  }
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
}

export function mapLabInvoiceToViewModel(
  inv: CareLabInvoice,
  template: ResolvedCareInvoiceTemplate,
  lang: "bn" | "en",
): CareInvoiceViewModel {
  const lines: CareInvoiceViewLine[] = inv.lines.map((l) => {
    const list =
      l.price_original != null && l.price_original > l.price ? l.price_original : l.price;
    const discount = round2(Math.max(0, list - l.price));
    const discount_percent =
      discount > 0 && list > 0
        ? l.discount_percent != null && l.discount_percent > 0
          ? l.discount_percent
          : round2((discount / list) * 100)
        : null;
    return {
      id: l.booking_id,
      test_id: l.test_code || l.reference_code || "—",
      name: labInvoiceLineName(l, lang),
      delivery_date: fmtDate(l.test_date),
      amount: round2(list),
      discount,
      discount_percent,
    };
  });
  const subtotal = round2(lines.reduce((n, l) => n + l.amount, 0));
  const discount_amount = round2(lines.reduce((n, l) => n + l.discount, 0));

  return {
    kind: "lab",
    org_id: inv.org_id,
    invoice_no: inv.invoice_no,
    reg_no: inv.invoice_no,
    lab_id: inv.reference_code,
    date: fmtDate(inv.test_date || inv.created_at),
    delivery_datetime: inv.test_date
      ? `${fmtDate(inv.test_date)}${inv.slot_end ? ` ${String(inv.slot_end).slice(0, 5)}` : ""}`
      : null,
    patient_name: labInvoicePatientName(inv, lang),
    patient_phone: labInvoicePatientPhone(inv),
    patient_age: inv.guest_age ?? null,
    patient_sex: inv.guest_sex ?? null,
    patient_address: inv.guest_address ?? null,
    referred_by: inv.referred_by ?? null,
    payment_status: inv.payment_status,
    lines,
    money: computeInvoiceMoney({
      subtotal,
      discountAmount: discount_amount,
      vatPercent: template.defaults.vat_percent,
      paymentStatus: inv.payment_status,
      amountReceived: inv.amount_received,
    }),
    amount_received: inv.amount_received,
  };
}

export function mapSerialInvoiceToViewModel(
  inv: CareSerialInvoice,
  template: ResolvedCareInvoiceTemplate,
  lang: "bn" | "en",
): CareInvoiceViewModel {
  const name = inv.guest_name || inv.patient_name || (lang === "bn" ? "রোগী" : "Patient");
  const phone = inv.guest_phone || inv.patient_phone || "—";
  const fee = inv.fee_amount;
  const doc =
    lang === "bn"
      ? inv.doctor_name_bn || inv.doctor_name
      : inv.doctor_name;
  const amountReceived = inv.amount_received;
  const age = inv.guest_age;
  const address = inv.guest_address;
  const feeOriginal = inv.fee_original != null && inv.fee_original > fee ? inv.fee_original : fee;
  const lineDiscount = round2(Math.max(0, feeOriginal - fee));

  return {
    kind: "serial",
    org_id: inv.org_id,
    invoice_no: inv.invoice_no,
    reg_no: inv.invoice_no,
    lab_id: inv.claim_code || String(inv.online_serial_no ?? inv.serial_no ?? "—"),
    date: fmtDate(inv.session_date || inv.created_at),
    delivery_datetime: inv.session_date ? fmtDate(inv.session_date) : null,
    patient_name: name,
    patient_phone: phone,
    patient_age: age != null ? String(age) : null,
    patient_sex: inv.guest_sex ?? null,
    patient_address: address ?? null,
    referred_by: inv.referred_by || doc || null,
    payment_status: inv.payment_status,
    lines: [
      {
        id: inv.serial_id,
        test_id: String(inv.serial_no ?? inv.online_serial_no ?? "—"),
        name:
          lang === "bn"
            ? `ডাক্তার সিরিয়াল · ${doc}`
            : `Doctor serial · ${doc}`,
        delivery_date: fmtDate(inv.session_date),
        amount: round2(feeOriginal),
        discount: lineDiscount,
        discount_percent:
          lineDiscount > 0 && feeOriginal > 0 ? round2((lineDiscount / feeOriginal) * 100) : null,
      },
    ],
    money: computeInvoiceMoney({
      subtotal: feeOriginal,
      discountAmount: lineDiscount,
      vatPercent: template.defaults.vat_percent,
      paymentStatus: inv.payment_status,
      amountReceived,
    }),
    amount_received: amountReceived,
  };
}

export function mapAmbulanceInvoiceToViewModel(
  inv: AmbulanceInvoice,
  template: ResolvedCareInvoiceTemplate,
  lang: "bn" | "en",
): CareInvoiceViewModel {
  const name = inv.guest_name || inv.patient_name || (lang === "bn" ? "রোগী" : "Patient");
  const phone = inv.guest_phone || inv.patient_phone || "—";
  const svc =
    lang === "bn"
      ? inv.service_name_bn || inv.service_name_en || inv.mode
      : inv.service_name_en || inv.service_name_bn || inv.mode;
  const subtotal =
    inv.fare_original != null && inv.fare_original > inv.final_fare ? inv.fare_original : inv.final_fare;
  const discount_amount =
    inv.fare_original != null && inv.fare_original > inv.final_fare
      ? inv.fare_original - inv.final_fare
      : 0;
  const amountReceived = inv.amount_received;

  return {
    kind: "ambulance",
    org_id: inv.org_id || "",
    invoice_no: inv.invoice_no,
    reg_no: inv.invoice_no,
    lab_id: inv.reference_code,
    date: fmtDate(inv.created_at),
    delivery_datetime: fmtDate(inv.created_at),
    patient_name: name,
    patient_phone: phone,
    patient_age: inv.guest_age != null ? String(inv.guest_age) : null,
    patient_sex: inv.guest_sex ?? null,
    patient_address: inv.guest_address || inv.pickup_address,
    referred_by: inv.referred_by ?? null,
    payment_status: inv.payment_status,
    lines: [
      {
        id: inv.request_id,
        test_id: inv.mode,
        name: svc,
        delivery_date: fmtDate(inv.created_at),
        amount: round2(subtotal),
        discount: round2(discount_amount),
        discount_percent:
          discount_amount > 0
            ? inv.discount_percent != null && inv.discount_percent > 0
              ? inv.discount_percent
              : subtotal > 0
                ? round2((discount_amount / subtotal) * 100)
                : null
            : null,
      },
    ],
    money: computeInvoiceMoney({
      subtotal,
      discountPercent: inv.discount_percent,
      discountAmount: discount_amount,
      vatPercent: template.defaults.vat_percent,
      paymentStatus: inv.payment_status,
      amountReceived,
    }),
    amount_received: amountReceived,
  };
}
