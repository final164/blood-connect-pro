import { supabase } from "@/integrations/supabase/client";

export type CareOperationCategory = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string;
  sort_order: number;
};

export type CareOperationCatalogItem = {
  id: string;
  code: string;
  name_bn: string;
  name_en: string;
  category_id: string | null;
  specialty_id: string | null;
  description_bn: string | null;
  description_en: string | null;
  prep_bn: string | null;
  prep_en: string | null;
  typical_duration_minutes: number | null;
  typical_stay_days: number | null;
  is_active: boolean;
  sort_order: number;
};

export type CareOperationPriceItem = {
  id: string;
  offering_id: string;
  kind: "surgeon" | "ot" | "anesthesia" | "bed" | "investigation" | "medicine" | "other";
  label_bn: string | null;
  label_en: string | null;
  amount: number;
  sort_order: number;
};

export type CareOperationDoctorRole = "lead_surgeon" | "assistant" | "anesthetist" | "consultant";

export type CareOperationOfferingDoctor = {
  id: string;
  offering_id: string;
  doctor_id: string;
  role: CareOperationDoctorRole;
  sort_order: number;
  doctor?: { full_name: string; full_name_bn?: string | null; bmdc_no?: string | null } | null;
};

export type CareOperationOffering = {
  id: string;
  org_id: string;
  location_id: string;
  catalog_id: string;
  package_price: number;
  price_original: number | null;
  discount_percent: number | null;
  price_note: string | null;
  includes_bn: string | null;
  includes_en: string | null;
  is_active: boolean;
  catalog?: Pick<CareOperationCatalogItem, "code" | "name_bn" | "name_en" | "prep_bn" | "prep_en"> & {
    typical_duration_minutes?: number | null;
    typical_stay_days?: number | null;
    specialty_id?: string | null;
  };
  org?: { name: string; name_bn: string | null; district_id: string | null; upazila: string | null };
  location?: { name: string; name_bn: string | null };
  doctors?: CareOperationOfferingDoctor[];
  price_items?: CareOperationPriceItem[];
};

export type CareOperationBooking = {
  id: string;
  offering_id: string;
  org_id: string;
  location_id: string;
  catalog_id: string;
  patient_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_age: string | null;
  guest_sex: string | null;
  guest_address: string | null;
  referred_by: string | null;
  source: string;
  status: string;
  requested_date: string | null;
  scheduled_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  admission_date: string | null;
  price: number;
  price_original: number | null;
  discount_percent: number | null;
  invoice_no: string | null;
  reference_code: string;
  payment_status: "pending" | "paid" | "waived";
  amount_received: number | null;
  patient_note: string | null;
  desk_note: string | null;
  created_at: string;
};

const OFFERING_COLS =
  "id, org_id, location_id, catalog_id, package_price, price_original, discount_percent, price_note, includes_bn, includes_en, is_active";
const BOOKING_COLS =
  "id, offering_id, org_id, location_id, catalog_id, patient_id, guest_name, guest_phone, guest_age, guest_sex, guest_address, referred_by, source, status, requested_date, scheduled_date, scheduled_start, scheduled_end, admission_date, price, price_original, discount_percent, invoice_no, reference_code, payment_status, amount_received, patient_note, desk_note, created_at";

/** True when the operations migration has not been applied yet. */
function moduleMissing(error: { message: string; code?: string }) {
  return /care_operation|does not exist|schema cache/i.test(error.message);
}

// ─── Catalog (admin) ────────────────────────────────────────────────────────

export async function fetchOperationCategories(): Promise<CareOperationCategory[]> {
  const { data, error } = await supabase
    .from("care_operation_categories")
    .select("id, slug, name_bn, name_en, sort_order")
    .order("sort_order");
  if (error) {
    if (moduleMissing(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as CareOperationCategory[];
}

export async function fetchOperationCatalog(opts?: {
  activeOnly?: boolean;
}): Promise<CareOperationCatalogItem[]> {
  let query = supabase
    .from("care_operation_catalog")
    .select(
      "id, code, name_bn, name_en, category_id, specialty_id, description_bn, description_en, prep_bn, prep_en, typical_duration_minutes, typical_stay_days, is_active, sort_order",
    )
    .order("sort_order");
  if (opts?.activeOnly) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) {
    if (moduleMissing(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as CareOperationCatalogItem[];
}

export async function upsertOperationCatalogItem(item: Partial<CareOperationCatalogItem>) {
  const { error } = await supabase.from("care_operation_catalog").upsert(item as never, {
    onConflict: "code",
  });
  if (error) throw new Error(error.message);
}

export async function deleteOperationCatalogItem(id: string) {
  const { error } = await supabase.from("care_operation_catalog").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Offerings (desk) ───────────────────────────────────────────────────────

const CATALOG_JOIN =
  "care_operation_catalog(code, name_bn, name_en, prep_bn, prep_en, typical_duration_minutes, typical_stay_days, specialty_id)";
const DOCTORS_JOIN =
  "care_operation_offering_doctors(id, offering_id, doctor_id, role, sort_order, care_doctors(full_name, full_name_bn, bmdc_no))";
const ITEMS_JOIN =
  "care_operation_price_items(id, offering_id, kind, label_bn, label_en, amount, sort_order)";

function mapOffering(row: Record<string, unknown>): CareOperationOffering {
  const doctors = (row.care_operation_offering_doctors ?? []) as Record<string, unknown>[];
  const items = (row.care_operation_price_items ?? []) as Record<string, unknown>[];
  const org = row.care_orgs as CareOperationOffering["org"] | null;
  const loc = row.care_locations as CareOperationOffering["location"] | null;
  return {
    ...(row as unknown as CareOperationOffering),
    package_price: Number(row.package_price ?? 0),
    price_original: row.price_original != null ? Number(row.price_original) : null,
    discount_percent: row.discount_percent != null ? Number(row.discount_percent) : null,
    catalog: (row.care_operation_catalog ?? undefined) as CareOperationOffering["catalog"],
    org: org ?? undefined,
    location: loc ?? undefined,
    doctors: doctors
      .map((d) => ({
        ...(d as unknown as CareOperationOfferingDoctor),
        doctor: (d.care_doctors ?? null) as CareOperationOfferingDoctor["doctor"],
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
    price_items: items
      .map((i) => ({ ...(i as unknown as CareOperationPriceItem), amount: Number(i.amount ?? 0) }))
      .sort((a, b) => a.sort_order - b.sort_order),
  };
}

export async function fetchOrgOperationOfferings(orgId: string): Promise<CareOperationOffering[]> {
  const { data, error } = await supabase
    .from("care_operation_offerings")
    .select(
      `${OFFERING_COLS}, ${CATALOG_JOIN}, ${DOCTORS_JOIN}, ${ITEMS_JOIN}, care_locations(name, name_bn)`,
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) {
    if (moduleMissing(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapOffering);
}

export async function fetchOperationOffering(id: string): Promise<CareOperationOffering | null> {
  const { data, error } = await supabase
    .from("care_operation_offerings")
    .select(
      `${OFFERING_COLS}, ${CATALOG_JOIN}, ${DOCTORS_JOIN}, ${ITEMS_JOIN}, care_locations(name, name_bn), care_orgs(name, name_bn, district_id, upazila)`,
    )
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (moduleMissing(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapOffering(data as unknown as Record<string, unknown>);
}

/** Public browse with doctor / clinic / district / specialty filters. */
export async function searchOperationOfferings(opts?: {
  q?: string;
  doctorId?: string | null;
  orgId?: string | null;
  districtId?: string | null;
  specialtyId?: string | null;
  catalogId?: string | null;
  limit?: number;
}): Promise<CareOperationOffering[]> {
  let query = supabase
    .from("care_operation_offerings")
    .select(
      `${OFFERING_COLS}, ${CATALOG_JOIN}, ${DOCTORS_JOIN}, ${ITEMS_JOIN}, care_locations(name, name_bn), care_orgs(name, name_bn, district_id, upazila, is_verified, is_listed, is_active)`,
    )
    .eq("is_active", true)
    .limit(opts?.limit ?? 60);
  if (opts?.orgId) query = query.eq("org_id", opts.orgId);
  if (opts?.catalogId) query = query.eq("catalog_id", opts.catalogId);

  const { data, error } = await query;
  if (error) {
    if (moduleMissing(error)) return [];
    throw new Error(error.message);
  }

  const needle = opts?.q?.trim().toLowerCase() ?? "";
  return ((data ?? []) as unknown as Record<string, unknown>[])
    .map(mapOffering)
    .filter((o) => {
      const org = o.org as (CareOperationOffering["org"] & { is_listed?: boolean }) | undefined;
      if (opts?.districtId && org?.district_id !== opts.districtId) return false;
      if (opts?.specialtyId && o.catalog?.specialty_id !== opts.specialtyId) return false;
      if (opts?.doctorId && !o.doctors?.some((d) => d.doctor_id === opts.doctorId)) return false;
      if (!needle) return true;
      const hay = [
        o.catalog?.code,
        o.catalog?.name_bn,
        o.catalog?.name_en,
        org?.name,
        org?.name_bn,
        ...(o.doctors ?? []).map((d) => d.doctor?.full_name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    })
    .sort((a, b) => a.package_price - b.package_price);
}

/** Every clinic where this doctor operates, with the price at each. */
export async function fetchDoctorOperations(doctorId: string): Promise<CareOperationOffering[]> {
  const { data, error } = await supabase
    .from("care_operation_offering_doctors")
    .select(
      `offering_id, role, care_operation_offerings(${OFFERING_COLS}, ${CATALOG_JOIN}, ${ITEMS_JOIN}, care_locations(name, name_bn), care_orgs(name, name_bn, district_id, upazila))`,
    )
    .eq("doctor_id", doctorId);
  if (error) {
    if (moduleMissing(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as Record<string, unknown>[])
    .map((r) => r.care_operation_offerings as Record<string, unknown> | null)
    .filter((r): r is Record<string, unknown> => !!r && r.is_active !== false)
    .map(mapOffering)
    .sort((a, b) => a.package_price - b.package_price);
}

export async function saveOperationOffering(input: {
  id?: string;
  orgId: string;
  locationId: string;
  catalogId: string;
  packagePrice: number;
  priceOriginal?: number | null;
  discountPercent?: number | null;
  priceNote?: string | null;
  includesBn?: string | null;
  includesEn?: string | null;
  isActive?: boolean;
}): Promise<string> {
  const payload = {
    org_id: input.orgId,
    location_id: input.locationId,
    catalog_id: input.catalogId,
    package_price: input.packagePrice,
    price_original: input.priceOriginal ?? null,
    discount_percent: input.discountPercent ?? 0,
    price_note: input.priceNote ?? null,
    includes_bn: input.includesBn ?? null,
    includes_en: input.includesEn ?? null,
    is_active: input.isActive !== false,
  };
  const { data, error } = await supabase
    .from("care_operation_offerings")
    .upsert((input.id ? { id: input.id, ...payload } : payload) as never, {
      onConflict: "org_id,location_id,catalog_id",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return String((data as { id: string }).id);
}

export async function deleteOperationOffering(id: string) {
  const { error } = await supabase.from("care_operation_offerings").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function replaceOperationPriceItems(
  offeringId: string,
  items: { kind: CareOperationPriceItem["kind"]; label_bn?: string | null; amount: number }[],
) {
  const del = await supabase.from("care_operation_price_items").delete().eq("offering_id", offeringId);
  if (del.error) throw new Error(del.error.message);
  if (!items.length) return;
  const { error } = await supabase.from("care_operation_price_items").insert(
    items.map((i, idx) => ({
      offering_id: offeringId,
      kind: i.kind,
      label_bn: i.label_bn ?? null,
      amount: i.amount,
      sort_order: idx * 10,
    })) as never,
  );
  if (error) throw new Error(error.message);
}

export async function addOperationOfferingDoctor(
  offeringId: string,
  doctorId: string,
  role: CareOperationDoctorRole,
  sortOrder = 0,
) {
  const { error } = await supabase.from("care_operation_offering_doctors").upsert(
    {
      offering_id: offeringId,
      doctor_id: doctorId,
      role,
      sort_order: sortOrder,
    } as never,
    { onConflict: "offering_id,doctor_id" },
  );
  if (error) throw new Error(error.message);
}

export async function removeOperationOfferingDoctor(id: string) {
  const { error } = await supabase.from("care_operation_offering_doctors").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ─── Bookings ───────────────────────────────────────────────────────────────

export type CareOperationBookingRow = CareOperationBooking & {
  catalog?: { code: string; name_bn: string; name_en: string } | null;
  location?: { name: string; name_bn: string | null } | null;
  org?: { name: string; name_bn: string | null } | null;
  doctors?: { doctor_id: string | null; role: string; doctor_name_snapshot: string | null }[];
};

const BOOKING_JOINS =
  "care_operation_catalog(code, name_bn, name_en), care_locations(name, name_bn), care_orgs(name, name_bn), care_operation_booking_doctors(doctor_id, role, doctor_name_snapshot)";

function mapBooking(row: Record<string, unknown>): CareOperationBookingRow {
  return {
    ...(row as unknown as CareOperationBooking),
    price: Number(row.price ?? 0),
    price_original: row.price_original != null ? Number(row.price_original) : null,
    amount_received: row.amount_received != null ? Number(row.amount_received) : null,
    catalog: (row.care_operation_catalog ?? null) as CareOperationBookingRow["catalog"],
    location: (row.care_locations ?? null) as CareOperationBookingRow["location"],
    org: (row.care_orgs ?? null) as CareOperationBookingRow["org"],
    doctors: (row.care_operation_booking_doctors ?? []) as CareOperationBookingRow["doctors"],
  };
}

export async function requestOperation(input: {
  offeringId: string;
  requestedDate?: string | null;
  guestName?: string | null;
  guestPhone?: string | null;
  guestAge?: string | null;
  guestSex?: string | null;
  guestAddress?: string | null;
  referredBy?: string | null;
  patientNote?: string | null;
  source?: string;
  doctorIds?: string[] | null;
}): Promise<CareOperationBooking> {
  const { data, error } = await supabase.rpc("care_request_operation", {
    _offering_id: input.offeringId,
    _requested_date: input.requestedDate || null,
    _guest_name: input.guestName || null,
    _guest_phone: input.guestPhone || null,
    _guest_age: input.guestAge || null,
    _guest_sex: input.guestSex || null,
    _guest_address: input.guestAddress || null,
    _referred_by: input.referredBy || null,
    _patient_note: input.patientNote || null,
    _source: input.source || "online",
    _doctor_ids: input.doctorIds?.length ? input.doctorIds : null,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareOperationBooking;
}

export async function fetchMyOperationBookings(): Promise<CareOperationBookingRow[]> {
  const { data, error } = await supabase
    .from("care_operation_bookings")
    .select(`${BOOKING_COLS}, ${BOOKING_JOINS}`)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    if (moduleMissing(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapBooking);
}

export async function fetchOperationBooking(id: string): Promise<CareOperationBookingRow | null> {
  const { data, error } = await supabase
    .from("care_operation_bookings")
    .select(`${BOOKING_COLS}, ${BOOKING_JOINS}`)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (moduleMissing(error)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  return mapBooking(data as unknown as Record<string, unknown>);
}

export async function fetchOrgOperationBookings(
  orgId: string,
  opts?: { status?: string; date?: string; limit?: number },
): Promise<CareOperationBookingRow[]> {
  let query = supabase
    .from("care_operation_bookings")
    .select(`${BOOKING_COLS}, ${BOOKING_JOINS}`)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(opts?.limit ?? 50);
  if (opts?.status && opts.status !== "all") query = query.eq("status", opts.status);
  if (opts?.date) query = query.eq("scheduled_date", opts.date);
  const { data, error } = await query;
  if (error) {
    if (moduleMissing(error)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapBooking);
}

export async function setOperationSchedule(input: {
  bookingId: string;
  scheduledDate: string;
  scheduledStart?: string | null;
  scheduledEnd?: string | null;
  admissionDate?: string | null;
  deskNote?: string | null;
}) {
  const { data, error } = await supabase.rpc("care_set_operation_schedule", {
    _booking_id: input.bookingId,
    _scheduled_date: input.scheduledDate,
    _scheduled_start: input.scheduledStart || null,
    _scheduled_end: input.scheduledEnd || null,
    _admission_date: input.admissionDate || null,
    _desk_note: input.deskNote || null,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareOperationBooking;
}

export async function setOperationStatus(bookingId: string, status: string) {
  const { data, error } = await supabase.rpc("care_set_operation_status", {
    _booking_id: bookingId,
    _status: status,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareOperationBooking;
}

export async function setOperationPayment(
  bookingId: string,
  paymentStatus: "pending" | "paid" | "waived",
  amountReceived?: number | null,
) {
  const { data, error } = await supabase.rpc("care_set_operation_payment", {
    _booking_id: bookingId,
    _payment_status: paymentStatus,
    _amount_received: amountReceived ?? null,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareOperationBooking;
}

// ─── Labels ─────────────────────────────────────────────────────────────────

export const OPERATION_FLOW = ["requested", "confirmed", "in_progress", "completed"] as const;

export function operationStatusLabel(status: string, lang: "bn" | "en") {
  const map: Record<string, { bn: string; en: string }> = {
    requested: { bn: "অনুরোধ", en: "Requested" },
    confirmed: { bn: "নিশ্চিত", en: "Confirmed" },
    in_progress: { bn: "চলছে", en: "In progress" },
    completed: { bn: "সম্পন্ন", en: "Completed" },
    cancelled: { bn: "বাতিল", en: "Cancelled" },
    no_show: { bn: "আসেননি", en: "No-show" },
  };
  const row = map[status];
  if (!row) return status;
  return lang === "bn" ? row.bn : row.en;
}

export function operationStatusTone(status: string) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  if (status === "cancelled" || status === "no_show")
    return "bg-destructive/10 text-destructive border-destructive/30";
  if (status === "confirmed" || status === "in_progress")
    return "bg-sky-500/10 text-sky-700 border-sky-500/30";
  return "bg-amber-500/10 text-amber-800 border-amber-500/30";
}

export function priceItemLabel(item: CareOperationPriceItem, lang: "bn" | "en") {
  if (lang === "bn" && item.label_bn) return item.label_bn;
  if (lang === "en" && item.label_en) return item.label_en;
  const map: Record<CareOperationPriceItem["kind"], { bn: string; en: string }> = {
    surgeon: { bn: "সার্জন ফি", en: "Surgeon fee" },
    ot: { bn: "অপারেশন থিয়েটার", en: "OT charge" },
    anesthesia: { bn: "অ্যানেস্থেশিয়া", en: "Anaesthesia" },
    bed: { bn: "কেবিন / বেড", en: "Cabin / bed" },
    investigation: { bn: "পরীক্ষা-নিরীক্ষা", en: "Investigations" },
    medicine: { bn: "ঔষধ", en: "Medicine" },
    other: { bn: "অন্যান্য", en: "Other" },
  };
  const row = map[item.kind];
  return lang === "bn" ? row.bn : row.en;
}

export function operationDoctorRoleLabel(role: string, lang: "bn" | "en") {
  const map: Record<string, { bn: string; en: string }> = {
    lead_surgeon: { bn: "প্রধান সার্জন", en: "Lead surgeon" },
    assistant: { bn: "সহকারী", en: "Assistant" },
    anesthetist: { bn: "অ্যানেস্থেসিওলজিস্ট", en: "Anaesthetist" },
    consultant: { bn: "পরামর্শক", en: "Consultant" },
  };
  const row = map[role];
  if (!row) return role;
  return lang === "bn" ? row.bn : row.en;
}

export function operationName(
  catalog: { name_bn?: string | null; name_en?: string | null; code?: string | null } | null | undefined,
  lang: "bn" | "en",
) {
  if (!catalog) return "—";
  if (lang === "bn") return catalog.name_bn || catalog.name_en || catalog.code || "—";
  return catalog.name_en || catalog.name_bn || catalog.code || "—";
}
