import type { CareLabInvoice } from "@/lib/care-lab-invoice";
import { labInvoiceLineName, labInvoicePatientName, labInvoicePatientPhone } from "@/lib/care-lab-invoice";
import type { CareSerialInvoice } from "@/lib/care-invoice";
import {
  invoiceDoctorName,
  invoiceLocationLine,
  invoiceScheduleLine,
} from "@/lib/care-invoice";
import { formatDateTimeWindow } from "@/lib/care-time-window";
import {
  formatLabDeliveryScheduleOrPending,
  labSchedulePendingLabel,
} from "@/lib/care-lab-schedule";
import type { CareOperationInvoice } from "@/lib/care-operation-invoice";
import { operationInvoiceName } from "@/lib/care-operation-invoice";
import { priceItemLabel } from "@/lib/care-operations-api";
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

export type CareInvoiceSerialRow = {
  id: string;
  serial_no: string;
  online_serial_no: number | null;
  doctor_name: string;
  specialty: string;
  session_date: string;
  schedule_time: string;
  fee: number;
  discount: number;
  discount_percent: number | null;
  is_second_visit: boolean;
};

export type CareInvoiceSerialExtra = {
  bmdc: string | null;
  qualifications: string | null;
  chamber: string | null;
};

export type CareInvoiceAmbulanceRow = {
  id: string;
  reference_code: string;
  service_name: string;
  mode: string;
  distance_km: string;
  amount: number;
  discount: number;
  discount_percent: number | null;
};

export type CareInvoiceAmbulanceExtra = {
  pickup: string | null;
  dropoff: string | null;
  distance_km: string | null;
  mode: string | null;
  plate_no: string | null;
  driver_name: string | null;
  driver_phone: string | null;
};

export type CareInvoiceOperationRow = {
  id: string;
  code: string;
  name: string;
  amount: number;
  discount: number;
  discount_percent: number | null;
  /** Breakdown lines are indented under the package line and never re-totalled. */
  is_breakdown?: boolean;
};

export type CareInvoiceOperationExtra = {
  schedule_datetime: string | null;
  admission_date: string | null;
  clinic: string | null;
  includes: string | null;
  prep: string | null;
  desk_note: string | null;
  doctors: { name: string; role: string; bmdc_no: string | null; qualifications: string | null }[];
};

export type CareInvoiceViewModel = {
  kind: "lab" | "serial" | "ambulance" | "operation";
  org_id: string;
  invoice_no: string;
  reg_no: string;
  lab_id: string;
  date: string;
  delivery_datetime: string | null;
  /** Sample collection window, lab invoices only. */
  collection_datetime?: string | null;
  patient_name: string;
  patient_phone: string;
  patient_age: string | null;
  patient_sex: string | null;
  patient_address: string | null;
  referred_by: string | null;
  payment_status: "pending" | "paid" | "waived";
  lines: CareInvoiceViewLine[];
  serial_rows?: CareInvoiceSerialRow[];
  serial_extra?: CareInvoiceSerialExtra;
  ambulance_rows?: CareInvoiceAmbulanceRow[];
  ambulance_extra?: CareInvoiceAmbulanceExtra;
  operation_rows?: CareInvoiceOperationRow[];
  operation_extra?: CareInvoiceOperationExtra;
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
      delivery_date: formatLabDeliveryScheduleOrPending(l, lang),
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
    delivery_datetime:
      formatDateTimeWindow(inv.delivery_date, inv.delivery_start, inv.delivery_end, lang) ??
      labSchedulePendingLabel(lang),
    collection_datetime: formatDateTimeWindow(
      inv.collection_date,
      inv.collection_start,
      inv.collection_end,
      lang,
    ),
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
  const doc = invoiceDoctorName(inv, lang);
  const specialty = lang === "bn" ? inv.specialty_bn || inv.specialty_en || "—" : inv.specialty_en || inv.specialty_bn || "—";
  const amountReceived = inv.amount_received;
  const age = inv.guest_age;
  const address = inv.guest_address;
  const feeOriginal = inv.fee_original != null && inv.fee_original > fee ? inv.fee_original : fee;
  const lineDiscount = round2(Math.max(0, feeOriginal - fee));
  const serialNo =
    inv.serial_no != null
      ? String(inv.serial_no)
      : inv.status === "pending_approval"
        ? lang === "bn"
          ? "অনুমোদন বাকি"
          : "Pending"
        : "—";

  return {
    kind: "serial",
    org_id: inv.org_id,
    invoice_no: inv.invoice_no,
    reg_no: inv.invoice_no,
    lab_id: inv.claim_code || "—",
    date: fmtDate(inv.session_date || inv.created_at),
    delivery_datetime: null,
    patient_name: name,
    patient_phone: phone,
    patient_age: age != null ? String(age) : null,
    patient_sex: inv.guest_sex ?? null,
    patient_address: address ?? null,
    referred_by: inv.referred_by ?? null,
    payment_status: inv.payment_status,
    lines: [],
    serial_rows: [
      {
        id: inv.serial_id,
        serial_no: serialNo,
        online_serial_no: inv.online_serial_no,
        doctor_name: doc || "—",
        specialty,
        session_date: fmtDate(inv.session_date),
        schedule_time: invoiceScheduleLine(inv),
        fee: round2(feeOriginal),
        discount: lineDiscount,
        discount_percent:
          lineDiscount > 0 && feeOriginal > 0 ? round2((lineDiscount / feeOriginal) * 100) : null,
        is_second_visit: inv.is_second_visit,
      },
    ],
    serial_extra: {
      bmdc: inv.doctor_bmdc,
      qualifications: inv.doctor_qualifications,
      chamber: invoiceLocationLine(inv, lang) || null,
    },
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

export function mapOperationInvoiceToViewModel(
  inv: CareOperationInvoice,
  template: ResolvedCareInvoiceTemplate,
  lang: "bn" | "en",
): CareInvoiceViewModel {
  const bn = lang === "bn";
  const name = operationInvoiceName(inv, lang);
  const list = inv.price_original != null && inv.price_original > inv.price ? inv.price_original : inv.price;
  const discount = round2(Math.max(0, list - inv.price));

  const rows: CareInvoiceOperationRow[] = [
    {
      id: inv.booking_id,
      code: inv.operation_code || inv.reference_code,
      name,
      amount: round2(list),
      discount,
      discount_percent:
        discount > 0 && list > 0
          ? inv.discount_percent && inv.discount_percent > 0
            ? inv.discount_percent
            : round2((discount / list) * 100)
          : null,
    },
    ...inv.price_items.map((item) => ({
      id: item.id,
      code: "",
      name: priceItemLabel(item, lang),
      amount: round2(item.amount),
      discount: 0,
      discount_percent: null,
      is_breakdown: true,
    })),
  ];

  const clinic = [bn ? inv.location_name_bn || inv.location_name : inv.location_name, inv.org_address]
    .filter(Boolean)
    .join(", ");

  return {
    kind: "operation",
    org_id: inv.org_id,
    invoice_no: inv.invoice_no,
    reg_no: inv.invoice_no,
    lab_id: inv.reference_code,
    date: fmtDate(inv.created_at),
    delivery_datetime: null,
    patient_name: inv.patient_name || (bn ? "রোগী" : "Patient"),
    patient_phone: inv.patient_phone || "—",
    patient_age: inv.guest_age,
    patient_sex: inv.guest_sex,
    patient_address: inv.guest_address,
    referred_by: inv.referred_by,
    payment_status: inv.payment_status,
    lines: [],
    operation_rows: rows,
    operation_extra: {
      schedule_datetime:
        formatDateTimeWindow(inv.scheduled_date, inv.scheduled_start, inv.scheduled_end, lang) ??
        (inv.scheduled_date ? fmtDate(inv.scheduled_date) : null),
      admission_date: inv.admission_date ? fmtDate(inv.admission_date) : null,
      clinic: clinic || null,
      includes: (bn ? inv.includes_bn : inv.includes_en) || inv.includes_bn || inv.includes_en || null,
      prep: (bn ? inv.prep_bn : inv.prep_en) || inv.prep_bn || inv.prep_en || null,
      desk_note: inv.desk_note,
      doctors: inv.doctors,
    },
    money: computeInvoiceMoney({
      subtotal: round2(list),
      discountAmount: discount,
      vatPercent: template.defaults.vat_percent,
      paymentStatus: inv.payment_status,
      amountReceived: inv.amount_received,
    }),
    amount_received: inv.amount_received,
  };
}

function ambulanceModeLabel(mode: string, lang: "bn" | "en"): string {
  if (mode === "emergency") return lang === "bn" ? "জরুরি" : "Emergency";
  if (mode === "scheduled") return lang === "bn" ? "শিডিউল" : "Scheduled";
  return mode;
}

export function mapAmbulanceInvoiceToViewModel(
  inv: AmbulanceInvoice,
  template: ResolvedCareInvoiceTemplate,
  lang: "bn" | "en",
): CareInvoiceViewModel {
  const name = inv.guest_name || inv.patient_name || (lang === "bn" ? "রোগী" : "Patient");
  const phone = inv.guest_phone || inv.patient_phone || "—";
  const amountReceived = inv.amount_received;
  const distanceLabel =
    inv.distance_km != null && Number.isFinite(Number(inv.distance_km))
      ? `${Number(inv.distance_km)} km`
      : "—";

  const ambulance_rows: CareInvoiceAmbulanceRow[] = inv.lines.map((line) => {
    const svc =
      lang === "bn"
        ? line.service_name_bn || line.service_name_en || line.mode
        : line.service_name_en || line.service_name_bn || line.mode;
    const subtotal =
      line.fare_original != null && line.fare_original > line.final_fare ? line.fare_original : line.final_fare;
    const discount_amount =
      line.fare_original != null && line.fare_original > line.final_fare
        ? line.fare_original - line.final_fare
        : 0;
    return {
      id: line.request_id,
      reference_code: line.reference_code,
      service_name: svc,
      mode: ambulanceModeLabel(line.mode, lang),
      distance_km: distanceLabel,
      amount: round2(subtotal),
      discount: round2(discount_amount),
      discount_percent:
        discount_amount > 0
          ? line.discount_percent != null && line.discount_percent > 0
            ? line.discount_percent
            : subtotal > 0
              ? round2((discount_amount / subtotal) * 100)
              : null
          : null,
    };
  });

  const subtotal = round2(ambulance_rows.reduce((n, l) => n + l.amount, 0));
  const discount_amount = round2(ambulance_rows.reduce((n, l) => n + l.discount, 0));

  const pickup = [inv.pickup_address, inv.pickup_upazila].filter(Boolean).join(", ") || null;

  return {
    kind: "ambulance",
    org_id: inv.org_id || "",
    invoice_no: inv.invoice_no,
    reg_no: inv.invoice_no,
    lab_id: inv.reference_code,
    date: fmtDate(inv.created_at),
    delivery_datetime: null,
    patient_name: name,
    patient_phone: phone,
    patient_age: inv.guest_age != null ? String(inv.guest_age) : null,
    patient_sex: inv.guest_sex ?? null,
    patient_address: inv.guest_address || inv.pickup_address,
    referred_by: inv.referred_by ?? null,
    payment_status: inv.payment_status,
    lines: [],
    ambulance_rows,
    ambulance_extra: {
      pickup,
      dropoff: [inv.dropoff_address, inv.dropoff_upazila].filter(Boolean).join(", ") || null,
      distance_km: inv.distance_km != null ? String(inv.distance_km) : null,
      mode: ambulanceModeLabel(inv.mode, lang),
      plate_no: inv.plate_no,
      driver_name: inv.driver_name,
      driver_phone: inv.driver_phone,
    },
    money: computeInvoiceMoney({
      subtotal,
      discountAmount: discount_amount,
      vatPercent: template.defaults.vat_percent,
      paymentStatus: inv.payment_status,
      amountReceived,
    }),
    amount_received: amountReceived,
  };
}
