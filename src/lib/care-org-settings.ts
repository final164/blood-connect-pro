import { supabase } from "@/integrations/supabase/client";
import { fetchCarePolicies, type CareFeatureFlags } from "@/lib/care-cms";
import {
  parseOrgInvoiceSettings,
  type CareOrgInvoiceSettings,
} from "@/lib/care-invoice-settings";

export type CareSerialBookingFieldKey = "name" | "phone" | "age" | "address";

export type CareSerialBookingFields = Record<CareSerialBookingFieldKey, boolean>;

/** Stored under care_orgs.settings.serial */
export type CareOrgSerialSettings = {
  /** When set, overrides platform desk_serial_approval */
  desk_serial_approval?: boolean;
  /** Desk form: create serial from patient demographics */
  manual_patient_serial?: boolean;
  booking_fields?: Partial<CareSerialBookingFields>;
};

export type CareOrgFaqItem = {
  id: string;
  question_bn: string;
  question_en: string;
  answer_bn: string;
  answer_en: string;
};

/** Stored under care_orgs.settings.about */
export type CareOrgAboutSettings = {
  about_bn?: string;
  about_en?: string;
  gallery?: string[];
  faqs?: CareOrgFaqItem[];
};

export type CareOrgSettings = {
  serial?: CareOrgSerialSettings;
  invoice?: CareOrgInvoiceSettings;
  about?: CareOrgAboutSettings;
};

/** Resolved effective settings for UI / booking */
export type EffectiveDeskSerialSettings = {
  desk_serial_approval: boolean;
  manual_patient_serial: boolean;
  allow_org_override: boolean;
  booking_fields: CareSerialBookingFields;
  /** True when chamber may edit these in desk Settings */
  orgCanEdit: boolean;
};

export const DEFAULT_BOOKING_FIELDS: CareSerialBookingFields = {
  name: true,
  phone: true,
  age: true,
  address: true,
};

function bool(v: unknown, fallback: boolean) {
  return typeof v === "boolean" ? v : fallback;
}

export function bookingFieldsFromFlags(flags: CareFeatureFlags): CareSerialBookingFields {
  return {
    name: bool(flags.desk_booking_field_name, true),
    phone: bool(flags.desk_booking_field_phone, true),
    age: bool(flags.desk_booking_field_age, true),
    address: bool(flags.desk_booking_field_address, true),
  };
}

export function mergeBookingFields(
  base: CareSerialBookingFields,
  override?: Partial<CareSerialBookingFields> | null,
): CareSerialBookingFields {
  return {
    name: override?.name ?? base.name,
    phone: override?.phone ?? base.phone,
    age: override?.age ?? base.age,
    address: override?.address ?? base.address,
  };
}

export function resolveDeskSerialSettings(
  flags: CareFeatureFlags,
  orgSettings?: CareOrgSettings | null,
): EffectiveDeskSerialSettings {
  const allow = bool(flags.desk_allow_org_serial_settings, true);
  const orgSerial = orgSettings?.serial ?? {};
  const platformFields = bookingFieldsFromFlags(flags);

  const desk_serial_approval =
    allow && typeof orgSerial.desk_serial_approval === "boolean"
      ? orgSerial.desk_serial_approval
      : bool(flags.desk_serial_approval, false);

  const platformManual = bool(flags.desk_manual_patient_serial, true);
  // Default ON: missing org override = enabled
  const orgManual =
    allow && typeof orgSerial.manual_patient_serial === "boolean"
      ? orgSerial.manual_patient_serial
      : true;
  const manual_patient_serial = platformManual && orgManual;

  const booking_fields =
    allow && orgSerial.booking_fields
      ? mergeBookingFields(platformFields, orgSerial.booking_fields)
      : platformFields;

  return {
    desk_serial_approval,
    manual_patient_serial,
    allow_org_override: allow,
    booking_fields,
    orgCanEdit: allow,
  };
}

export function parseOrgAboutSettings(raw: unknown): CareOrgAboutSettings {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const gallery = Array.isArray(o.gallery)
    ? o.gallery.map((u) => String(u).trim()).filter(Boolean)
    : [];
  const faqsRaw = Array.isArray(o.faqs) ? o.faqs : [];
  const faqs: CareOrgFaqItem[] = faqsRaw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const f = item as Record<string, unknown>;
      return {
        id: String(f.id || crypto.randomUUID()),
        question_bn: String(f.question_bn ?? ""),
        question_en: String(f.question_en ?? ""),
        answer_bn: String(f.answer_bn ?? ""),
        answer_en: String(f.answer_en ?? ""),
      };
    })
    .filter((f): f is CareOrgFaqItem => !!f);
  return {
    about_bn: typeof o.about_bn === "string" ? o.about_bn : undefined,
    about_en: typeof o.about_en === "string" ? o.about_en : undefined,
    gallery,
    faqs,
  };
}

export function parseOrgSettings(raw: unknown): CareOrgSettings {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const serialRaw = o.serial;
  const invoice = parseOrgInvoiceSettings(o.invoice);
  let serial: CareOrgSerialSettings | undefined;
  if (serialRaw && typeof serialRaw === "object") {
    const s = serialRaw as Record<string, unknown>;
    const bf = s.booking_fields;
    serial = {
      desk_serial_approval: typeof s.desk_serial_approval === "boolean" ? s.desk_serial_approval : undefined,
      manual_patient_serial: typeof s.manual_patient_serial === "boolean" ? s.manual_patient_serial : undefined,
      booking_fields:
        bf && typeof bf === "object"
          ? {
              name: typeof (bf as CareSerialBookingFields).name === "boolean" ? (bf as CareSerialBookingFields).name : undefined,
              phone: typeof (bf as CareSerialBookingFields).phone === "boolean" ? (bf as CareSerialBookingFields).phone : undefined,
              age: typeof (bf as CareSerialBookingFields).age === "boolean" ? (bf as CareSerialBookingFields).age : undefined,
              address:
                typeof (bf as CareSerialBookingFields).address === "boolean"
                  ? (bf as CareSerialBookingFields).address
                  : undefined,
            }
          : undefined,
    };
  }
  return {
    serial: serial ?? {},
    invoice: Object.keys(invoice).length ? invoice : {},
    about: parseOrgAboutSettings(o.about),
  };
}

export async function fetchOrgSettings(orgId: string): Promise<CareOrgSettings> {
  const { data, error } = await supabase.from("care_orgs").select("settings").eq("id", orgId).maybeSingle();
  if (error) {
    if (/does not exist|column/i.test(error.message)) return {};
    throw new Error(error.message);
  }
  return parseOrgSettings((data as { settings?: unknown } | null)?.settings);
}

export async function fetchEffectiveDeskSerialSettings(orgId: string): Promise<EffectiveDeskSerialSettings> {
  const [{ flags }, orgSettings] = await Promise.all([fetchCarePolicies(), fetchOrgSettings(orgId)]);
  return resolveDeskSerialSettings(flags, orgSettings);
}

export async function saveOrgSerialSettings(
  orgId: string,
  serial: CareOrgSerialSettings,
  existing?: CareOrgSettings | null,
): Promise<void> {
  const base = existing ?? (await fetchOrgSettings(orgId));
  const next: CareOrgSettings = {
    ...base,
    serial: {
      ...base.serial,
      ...serial,
      booking_fields: {
        ...base.serial?.booking_fields,
        ...serial.booking_fields,
      },
    },
  };
  const { error } = await supabase.from("care_orgs").update({ settings: next } as never).eq("id", orgId);
  if (error) throw new Error(error.message);
}

export async function saveOrgInvoiceSettings(
  orgId: string,
  invoice: CareOrgInvoiceSettings,
  existing?: CareOrgSettings | null,
): Promise<void> {
  const base = existing ?? (await fetchOrgSettings(orgId));
  const next: CareOrgSettings = {
    ...base,
    invoice: {
      ...base.invoice,
      ...invoice,
      phones: invoice.phones ?? base.invoice?.phones,
      labels: { ...base.invoice?.labels, ...invoice.labels },
      style: { ...base.invoice?.style, ...invoice.style },
      visibility: { ...base.invoice?.visibility, ...invoice.visibility },
    },
  };
  const { error } = await supabase.from("care_orgs").update({ settings: next } as never).eq("id", orgId);
  if (error) throw new Error(error.message);
}

export async function fetchOrgSettingsMap(orgIds: string[]): Promise<Record<string, CareOrgSettings>> {
  const ids = Array.from(new Set(orgIds.filter(Boolean)));
  if (!ids.length) return {};
  const { data, error } = await supabase.from("care_orgs").select("id, settings").in("id", ids);
  if (error) {
    if (/does not exist|column/i.test(error.message)) return {};
    throw new Error(error.message);
  }
  const out: Record<string, CareOrgSettings> = {};
  for (const row of (data as { id: string; settings?: unknown }[]) ?? []) {
    out[row.id] = parseOrgSettings(row.settings);
  }
  return out;
}

export function fieldLabel(key: CareSerialBookingFieldKey, lang: "bn" | "en") {
  const map: Record<CareSerialBookingFieldKey, { bn: string; en: string }> = {
    name: { bn: "নাম", en: "Name" },
    phone: { bn: "মোবাইল", en: "Mobile" },
    age: { bn: "বয়স", en: "Age" },
    address: { bn: "ঠিকানা", en: "Address" },
  };
  return lang === "bn" ? map[key].bn : map[key].en;
}
