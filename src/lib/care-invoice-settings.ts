import { supabase } from "@/integrations/supabase/client";
import { fetchCarePoliciesCached } from "@/lib/care-cms";

export type LangPair = { bn: string; en: string };

export type CareInvoiceLabelKey =
  | "title"
  | "reg_no"
  | "lab_id"
  | "date"
  | "age"
  | "sex"
  | "patient_name"
  | "address"
  | "mobile"
  | "refd_by"
  | "col_sl"
  | "col_test_id"
  | "col_test_name"
  | "col_delivery"
  | "col_amount"
  | "col_discount"
  | "serial_claim_code"
  | "col_serial_sl"
  | "col_serial_no"
  | "col_serial_doctor"
  | "col_serial_specialty"
  | "col_serial_date"
  | "col_serial_time"
  | "col_serial_fee"
  | "col_serial_discount"
  | "serial_bmdc"
  | "serial_qualifications"
  | "serial_chamber"
  | "title_ambulance"
  | "ambulance_ref_code"
  | "col_amb_sl"
  | "col_amb_ref"
  | "col_amb_service"
  | "col_amb_mode"
  | "col_amb_distance"
  | "col_amb_fare"
  | "col_amb_discount"
  | "amb_pickup"
  | "amb_dropoff"
  | "amb_vehicle"
  | "amb_driver"
  | "amb_disclaimer"
  | "total"
  | "discount"
  | "vat"
  | "payable"
  | "received"
  | "due"
  | "delivery_time"
  | "signature"
  | "thanks"
  | "disclaimer"
  | "developed_by"
  | "print_datetime"
  | "page_of";

export type CareInvoiceLabels = Record<CareInvoiceLabelKey, LangPair>;

export type CareInvoiceVisibility = {
  age: boolean;
  sex: boolean;
  address: boolean;
  refd_by: boolean;
  lab_id: boolean;
  reg_no: boolean;
};

export type CareInvoiceStyle = {
  show_logo: boolean;
  show_vat: boolean;
  show_received_due: boolean;
  show_delivery_slots: boolean;
  show_signature: boolean;
  show_developer: boolean;
  show_print_datetime: boolean;
  dense_meta: boolean;
  font_scale: number;
};

export type CareInvoiceDefaults = {
  vat_percent: number;
  delivery_slot_labels: string[];
  currency_prefix: string;
};

export type CareInvoiceSettings = {
  labels: CareInvoiceLabels;
  style: CareInvoiceStyle;
  defaults: CareInvoiceDefaults;
  visibility: CareInvoiceVisibility;
};

/** Per-org overrides under care_orgs.settings.invoice */
export type CareOrgInvoiceSettings = {
  logo_url?: string | null;
  display_name?: string | null;
  display_name_bn?: string | null;
  address?: string | null;
  phones?: string[];
  email?: string | null;
  vat_percent?: number;
  thanks_bn?: string | null;
  thanks_en?: string | null;
  disclaimer_bn?: string | null;
  disclaimer_en?: string | null;
  signature_bn?: string | null;
  signature_en?: string | null;
  developed_by?: string | null;
  labels?: Partial<Record<CareInvoiceLabelKey, Partial<LangPair>>>;
  style?: Partial<CareInvoiceStyle>;
  visibility?: Partial<CareInvoiceVisibility>;
};

export type ResolvedCareInvoiceTemplate = CareInvoiceSettings & {
  letterhead: {
    logo_url: string | null;
    display_name: string;
    display_name_bn: string | null;
    address: string | null;
    phones: string[];
    email: string | null;
  };
  orgCanEdit: boolean;
};

export const DEFAULT_CARE_INVOICE_LABELS: CareInvoiceLabels = {
  title: { bn: "ক্যাশ মেমো / বিল", en: "Cash Memo / Bill" },
  reg_no: { bn: "রেজি. নং", en: "Reg. No" },
  lab_id: { bn: "ল্যাব আইডি", en: "Lab ID" },
  date: { bn: "তারিখ", en: "Date" },
  age: { bn: "বয়স", en: "Age" },
  sex: { bn: "লিঙ্গ", en: "Sex" },
  patient_name: { bn: "রোগীর নাম", en: "Patient Name" },
  address: { bn: "ঠিকানা", en: "Address" },
  mobile: { bn: "মোবাইল", en: "Mob" },
  refd_by: { bn: "প্রেরক", en: "Refd. by" },
  col_sl: { bn: "ক্রম", en: "Sl.#" },
  col_test_id: { bn: "টেস্ট আইডি", en: "Test ID" },
  col_test_name: { bn: "টেস্টের নাম", en: "Test Name" },
  col_delivery: { bn: "ডেলিভারি তারিখ", en: "Delivery Date" },
  col_amount: { bn: "মূল্য", en: "Amount" },
  col_discount: { bn: "ছাড়", en: "Discount" },
  serial_claim_code: { bn: "ক্লেইম কোড", en: "Claim Code" },
  col_serial_sl: { bn: "ক্রম", en: "Sl.#" },
  col_serial_no: { bn: "সিরিয়াল", en: "Serial No" },
  col_serial_doctor: { bn: "ডাক্তার", en: "Doctor" },
  col_serial_specialty: { bn: "বিশেষত্ব", en: "Specialty" },
  col_serial_date: { bn: "তারিখ", en: "Date" },
  col_serial_time: { bn: "সময়", en: "Time" },
  col_serial_fee: { bn: "ফি", en: "Fee" },
  col_serial_discount: { bn: "ছাড়", en: "Discount" },
  serial_bmdc: { bn: "BMDC", en: "BMDC" },
  serial_qualifications: { bn: "যোগ্যতা", en: "Qualifications" },
  serial_chamber: { bn: "চেম্বার", en: "Chamber" },
  title_ambulance: { bn: "অ্যাম্বুলেন্স ক্যাশ মেমো / বিল", en: "Ambulance Cash Memo / Bill" },
  ambulance_ref_code: { bn: "রেফারেন্স", en: "Reference" },
  col_amb_sl: { bn: "ক্রম", en: "Sl.#" },
  col_amb_ref: { bn: "রেফ", en: "Ref" },
  col_amb_service: { bn: "সার্ভিস", en: "Service" },
  col_amb_mode: { bn: "ধরন", en: "Mode" },
  col_amb_distance: { bn: "দূরত্ব", en: "Distance" },
  col_amb_fare: { bn: "ভাড়া", en: "Fare" },
  col_amb_discount: { bn: "ছাড়", en: "Discount" },
  amb_pickup: { bn: "পিকআপ", en: "Pickup" },
  amb_dropoff: { bn: "গন্তব্য", en: "Dropoff" },
  amb_vehicle: { bn: "যান", en: "Vehicle" },
  amb_driver: { bn: "ড্রাইভার", en: "Driver" },
  amb_disclaimer: {
    bn: "যাত্রার আগে রোগীর নাম, ঠিকানা ও যোগাযোগ যাচাই করে নিন।",
    en: "Please verify patient name, address and contact before the trip.",
  },
  total: { bn: "মোট টাকা", en: "Total Amount" },
  discount: { bn: "মোট ছাড়", en: "Total Discount" },
  vat: { bn: "ভ্যাট", en: "VAT" },
  payable: { bn: "পরিশোধযোগ্য", en: "Total Payable" },
  received: { bn: "গৃহীত", en: "Received" },
  due: { bn: "বাকি", en: "Due" },
  delivery_time: { bn: "রিপোর্ট ডেলিভারি সময়", en: "Report Delivery Time" },
  signature: { bn: "অনুমোদিত স্বাক্ষর", en: "Authorized Signature" },
  thanks: { bn: "ধন্যবাদসহ,", en: "With Thanks," },
  disclaimer: {
    bn: "পরীক্ষার আগে রোগীর নাম, বয়স ও অন্যান্য তথ্য যাচাই করে নিন।",
    en: "Please verify patient name, age and other details before the test.",
  },
  developed_by: { bn: "Developed By: BloodLink", en: "Developed By: BloodLink" },
  print_datetime: { bn: "প্রিন্ট তারিখ ও সময়", en: "Print Date & Time" },
  page_of: { bn: "পৃষ্ঠা", en: "Page" },
};

export const DEFAULT_CARE_INVOICE_STYLE: CareInvoiceStyle = {
  show_logo: true,
  show_vat: true,
  show_received_due: false,
  show_delivery_slots: true,
  show_signature: true,
  show_developer: true,
  show_print_datetime: true,
  dense_meta: true,
  font_scale: 1,
};

export const DEFAULT_CARE_INVOICE_DEFAULTS: CareInvoiceDefaults = {
  vat_percent: 0,
  delivery_slot_labels: ["4:00 PM", "8:00 PM"],
  currency_prefix: "Tk.",
};

export const DEFAULT_CARE_INVOICE_VISIBILITY: CareInvoiceVisibility = {
  age: true,
  sex: true,
  address: true,
  refd_by: true,
  lab_id: true,
  reg_no: true,
};

export const DEFAULT_CARE_INVOICE_SETTINGS: CareInvoiceSettings = {
  labels: DEFAULT_CARE_INVOICE_LABELS,
  style: DEFAULT_CARE_INVOICE_STYLE,
  defaults: DEFAULT_CARE_INVOICE_DEFAULTS,
  visibility: DEFAULT_CARE_INVOICE_VISIBILITY,
};

function pair(raw: unknown, fallback: LangPair): LangPair {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<LangPair>;
  return {
    bn: typeof r.bn === "string" && r.bn.trim() ? r.bn : fallback.bn,
    en: typeof r.en === "string" && r.en.trim() ? r.en : fallback.en,
  };
}

function normalizeLabels(raw: unknown): CareInvoiceLabels {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<CareInvoiceLabelKey, unknown>
  >;
  const out = { ...DEFAULT_CARE_INVOICE_LABELS };
  (Object.keys(DEFAULT_CARE_INVOICE_LABELS) as CareInvoiceLabelKey[]).forEach((k) => {
    out[k] = pair(r[k], DEFAULT_CARE_INVOICE_LABELS[k]);
  });
  return out;
}

function normalizeStyle(raw: unknown): CareInvoiceStyle {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<CareInvoiceStyle>;
  const scale = Number(r.font_scale);
  return {
    show_logo: r.show_logo !== false,
    show_vat: r.show_vat !== false,
    show_received_due: r.show_received_due !== false,
    show_delivery_slots: r.show_delivery_slots !== false,
    show_signature: r.show_signature !== false,
    show_developer: r.show_developer !== false,
    show_print_datetime: r.show_print_datetime !== false,
    dense_meta: r.dense_meta !== false,
    font_scale: Number.isFinite(scale) ? Math.min(1.4, Math.max(0.8, scale)) : 1,
  };
}

function normalizeDefaults(raw: unknown): CareInvoiceDefaults {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<CareInvoiceDefaults> & {
    delivery_slot_labels?: unknown;
  };
  const vat = Number(r.vat_percent);
  const slots = Array.isArray(r.delivery_slot_labels)
    ? r.delivery_slot_labels.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
    : DEFAULT_CARE_INVOICE_DEFAULTS.delivery_slot_labels;
  return {
    vat_percent: Number.isFinite(vat) ? Math.min(100, Math.max(0, vat)) : 0,
    delivery_slot_labels: slots.length ? slots : DEFAULT_CARE_INVOICE_DEFAULTS.delivery_slot_labels,
    currency_prefix:
      typeof r.currency_prefix === "string" && r.currency_prefix.trim()
        ? r.currency_prefix.trim()
        : "Tk.",
  };
}

function normalizeVisibility(raw: unknown): CareInvoiceVisibility {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<CareInvoiceVisibility>;
  return {
    age: r.age !== false,
    sex: r.sex !== false,
    address: r.address !== false,
    refd_by: r.refd_by !== false,
    lab_id: r.lab_id !== false,
    reg_no: r.reg_no !== false,
  };
}

export function normalizeCareInvoiceSettings(raw: unknown): CareInvoiceSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<CareInvoiceSettings>;
  return {
    labels: normalizeLabels(r.labels),
    style: normalizeStyle(r.style),
    defaults: normalizeDefaults(r.defaults),
    visibility: normalizeVisibility(r.visibility),
  };
}

export function parseOrgInvoiceSettings(raw: unknown): CareOrgInvoiceSettings {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const phones = Array.isArray(o.phones)
    ? o.phones.map((p) => String(p).trim()).filter(Boolean).slice(0, 6)
    : undefined;
  const vat = o.vat_percent != null ? Number(o.vat_percent) : undefined;
  return {
    logo_url: typeof o.logo_url === "string" ? o.logo_url : o.logo_url === null ? null : undefined,
    display_name: typeof o.display_name === "string" ? o.display_name : undefined,
    display_name_bn: typeof o.display_name_bn === "string" ? o.display_name_bn : undefined,
    address: typeof o.address === "string" ? o.address : undefined,
    phones,
    email: typeof o.email === "string" ? o.email : undefined,
    vat_percent: Number.isFinite(vat) ? Math.min(100, Math.max(0, vat!)) : undefined,
    thanks_bn: typeof o.thanks_bn === "string" ? o.thanks_bn : undefined,
    thanks_en: typeof o.thanks_en === "string" ? o.thanks_en : undefined,
    disclaimer_bn: typeof o.disclaimer_bn === "string" ? o.disclaimer_bn : undefined,
    disclaimer_en: typeof o.disclaimer_en === "string" ? o.disclaimer_en : undefined,
    signature_bn: typeof o.signature_bn === "string" ? o.signature_bn : undefined,
    signature_en: typeof o.signature_en === "string" ? o.signature_en : undefined,
    developed_by: typeof o.developed_by === "string" ? o.developed_by : undefined,
    labels:
      o.labels && typeof o.labels === "object"
        ? (o.labels as CareOrgInvoiceSettings["labels"])
        : undefined,
    style: o.style && typeof o.style === "object" ? (o.style as Partial<CareInvoiceStyle>) : undefined,
    visibility:
      o.visibility && typeof o.visibility === "object"
        ? (o.visibility as Partial<CareInvoiceVisibility>)
        : undefined,
  };
}

export function invoiceLabel(
  settings: CareInvoiceSettings,
  key: CareInvoiceLabelKey,
  lang: "bn" | "en",
): string {
  return settings.labels[key][lang];
}

let cached: CareInvoiceSettings | null = null;
let cachedAt = 0;

export function invalidateCareInvoiceSettingsCache() {
  cached = null;
  cachedAt = 0;
}

export async function fetchCareInvoiceSettings(force = false): Promise<CareInvoiceSettings> {
  if (!force && cached && Date.now() - cachedAt < 60_000) return cached;
  const { data, error } = await supabase
    .from("app_settings")
    .select("care_invoice_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) {
    cached = normalizeCareInvoiceSettings(null);
  } else {
    cached = normalizeCareInvoiceSettings(
      (data as { care_invoice_settings?: unknown }).care_invoice_settings,
    );
  }
  cachedAt = Date.now();
  return cached;
}

export async function saveCareInvoiceSettings(next: CareInvoiceSettings) {
  const normalized = normalizeCareInvoiceSettings(next);
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    care_invoice_settings: normalized,
  } as never);
  if (error) throw new Error(error.message);
  cached = normalized;
  cachedAt = Date.now();
  return normalized;
}

function mergeLabels(
  base: CareInvoiceLabels,
  override?: CareOrgInvoiceSettings["labels"],
): CareInvoiceLabels {
  if (!override) return base;
  const out = { ...base };
  (Object.keys(DEFAULT_CARE_INVOICE_LABELS) as CareInvoiceLabelKey[]).forEach((k) => {
    if (override[k]) out[k] = pair(override[k], base[k]);
  });
  return out;
}

export function resolveCareInvoiceTemplateFromParts(
  platform: CareInvoiceSettings,
  orgInvoice: CareOrgInvoiceSettings | null | undefined,
  orgRow: {
    name?: string | null;
    name_bn?: string | null;
    phone?: string | null;
    address?: string | null;
    logo_url?: string | null;
  } | null | undefined,
  allowOrgOverride: boolean,
): ResolvedCareInvoiceTemplate {
  const org = allowOrgOverride ? orgInvoice ?? {} : {};
  const style = normalizeStyle({ ...platform.style, ...(org.style ?? {}) });
  const visibility = normalizeVisibility({ ...platform.visibility, ...(org.visibility ?? {}) });
  const defaults = normalizeDefaults({
    ...platform.defaults,
    ...(typeof org.vat_percent === "number" ? { vat_percent: org.vat_percent } : {}),
  });
  const labels = mergeLabels(platform.labels, org.labels);
  if (org.thanks_bn || org.thanks_en) {
    labels.thanks = {
      bn: org.thanks_bn?.trim() || labels.thanks.bn,
      en: org.thanks_en?.trim() || labels.thanks.en,
    };
  }
  if (org.disclaimer_bn || org.disclaimer_en) {
    labels.disclaimer = {
      bn: org.disclaimer_bn?.trim() || labels.disclaimer.bn,
      en: org.disclaimer_en?.trim() || labels.disclaimer.en,
    };
  }
  if (org.signature_bn || org.signature_en) {
    labels.signature = {
      bn: org.signature_bn?.trim() || labels.signature.bn,
      en: org.signature_en?.trim() || labels.signature.en,
    };
  }
  if (org.developed_by?.trim()) {
    labels.developed_by = { bn: org.developed_by.trim(), en: org.developed_by.trim() };
  }

  const phonesFromOrg =
    org.phones?.length
      ? org.phones
      : orgRow?.phone
        ? String(orgRow.phone)
            .split(/[,;/|]+/)
            .map((p) => p.trim())
            .filter(Boolean)
        : [];

  return {
    labels,
    style,
    defaults,
    visibility,
    orgCanEdit: allowOrgOverride,
    letterhead: {
      logo_url: (org.logo_url ?? orgRow?.logo_url ?? null) || null,
      display_name: org.display_name?.trim() || orgRow?.name || "Clinic",
      display_name_bn: org.display_name_bn?.trim() || orgRow?.name_bn || null,
      address: org.address?.trim() || orgRow?.address || null,
      phones: phonesFromOrg,
      email: org.email?.trim() || null,
    },
  };
}

export async function resolveCareInvoiceTemplate(
  orgId: string,
  orgRow?: {
    name?: string | null;
    name_bn?: string | null;
    phone?: string | null;
    address?: string | null;
    logo_url?: string | null;
  } | null,
): Promise<ResolvedCareInvoiceTemplate> {
  const [platform, policies, orgRes] = await Promise.all([
    fetchCareInvoiceSettings(),
    fetchCarePoliciesCached(),
    supabase
      .from("care_orgs")
      .select("name, name_bn, phone, address, logo_url, settings")
      .eq("id", orgId)
      .maybeSingle(),
  ]);
  const allow = policies.flags.desk_allow_org_invoice_settings !== false;
  const rowData = orgRes.data as
    | {
        name?: string | null;
        name_bn?: string | null;
        phone?: string | null;
        address?: string | null;
        logo_url?: string | null;
        settings?: { invoice?: unknown };
      }
    | null;
  const row = orgRow ?? rowData;
  const orgInvoice = parseOrgInvoiceSettings(rowData?.settings?.invoice);
  return resolveCareInvoiceTemplateFromParts(platform, orgInvoice, row, allow);
}
