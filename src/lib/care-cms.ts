import { supabase } from "@/integrations/supabase/client";

export type CareHubModule = {
  id: string;
  slug: string;
  label_bn: string;
  label_en: string;
  icon: string;
  href: string;
  audience: string;
  is_enabled: boolean;
  sort_order: number;
};

export type CareSpecialty = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string;
  is_active: boolean;
  sort_order: number;
};

export type CareVendorType = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string;
  panels: string[];
  is_active: boolean;
  sort_order: number;
};

export type CareStatusRow = {
  slug: string;
  label_bn: string;
  label_en: string;
  is_terminal: boolean;
  is_active: boolean;
  sort_order: number;
};

export type CareTestCategory = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string;
  is_active: boolean;
  sort_order: number;
};

export type CareTestCatalogItem = {
  id: string;
  category_id: string | null;
  code: string;
  name_bn: string;
  name_en: string;
  sample_type: string | null;
  fasting_notes_bn: string | null;
  fasting_notes_en: string | null;
  prep_bn: string | null;
  prep_en: string | null;
  default_tat_hours: number | null;
  is_package: boolean;
  is_active: boolean;
  sort_order: number;
};

export type CareBookingPolicies = {
  booking_window_hours: number;
  cancel_cutoff_hours: number;
  allow_cash: boolean;
  allow_online: boolean;
  allow_multi_test_cart: boolean;
  allow_vendor_price: boolean;
  no_show_requeue: boolean;
};

export type CareFeatureFlags = {
  home_collection: boolean;
  reviews: boolean;
  payment: boolean;
  report_vault: boolean;
};

export const FALLBACK_HUB_MODULES: CareHubModule[] = [
  {
    id: "doctors",
    slug: "doctors",
    label_bn: "ডাক্তার সিরিয়াল",
    label_en: "Doctor serial",
    icon: "Stethoscope",
    href: "/care?tab=doctors",
    audience: "patient",
    is_enabled: true,
    sort_order: 10,
  },
  {
    id: "tests",
    slug: "tests",
    label_bn: "ল্যাব টেস্ট",
    label_en: "Lab tests",
    icon: "FlaskConical",
    href: "/care?tab=tests",
    audience: "patient",
    is_enabled: true,
    sort_order: 20,
  },
  {
    id: "bookings",
    slug: "bookings",
    label_bn: "আমার বুকিং",
    label_en: "My bookings",
    icon: "Ticket",
    href: "/care?tab=bookings",
    audience: "patient",
    is_enabled: true,
    sort_order: 30,
  },
  {
    id: "desk",
    slug: "desk",
    label_bn: "চেম্বার ডেস্ক",
    label_en: "Chamber desk",
    icon: "ClipboardList",
    href: "/care/portal/desk",
    audience: "staff",
    is_enabled: true,
    sort_order: 40,
  },
  {
    id: "lab",
    slug: "lab",
    label_bn: "ল্যাব ডেস্ক",
    label_en: "Lab desk",
    icon: "Microscope",
    href: "/care/portal/lab",
    audience: "staff",
    is_enabled: true,
    sort_order: 50,
  },
];

const DEFAULT_POLICIES: CareBookingPolicies = {
  booking_window_hours: 12,
  cancel_cutoff_hours: 2,
  allow_cash: true,
  allow_online: false,
  allow_multi_test_cart: true,
  allow_vendor_price: true,
  no_show_requeue: true,
};

const DEFAULT_FLAGS: CareFeatureFlags = {
  home_collection: false,
  reviews: false,
  payment: false,
  report_vault: false,
};

function missingTable(error: { message?: string } | null) {
  return !!error && /does not exist|schema cache|relation/i.test(error.message ?? "");
}

export async function fetchCareHubModules(audience?: string): Promise<CareHubModule[]> {
  const { data, error } = await supabase
    .from("care_hub_modules")
    .select("id, slug, label_bn, label_en, icon, href, audience, is_enabled, sort_order")
    .eq("is_enabled", true)
    .order("sort_order");
  if (error || !data) {
    if (error && !missingTable(error)) console.warn(error.message);
    return FALLBACK_HUB_MODULES.filter((m) => !audience || m.audience === audience || m.audience === "both");
  }
  const rows = (data as CareHubModule[]).filter(
    (m) => !audience || m.audience === audience || m.audience === "both",
  );
  return rows.length ? rows : FALLBACK_HUB_MODULES;
}

export async function fetchCareSpecialties(activeOnly = true): Promise<CareSpecialty[]> {
  let q = supabase
    .from("care_specialties")
    .select("id, slug, name_bn, name_en, is_active, sort_order")
    .order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as CareSpecialty[];
}

export async function fetchCareVendorTypes(activeOnly = true): Promise<CareVendorType[]> {
  let q = supabase
    .from("care_vendor_types")
    .select("id, slug, name_bn, name_en, panels, is_active, sort_order")
    .order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error || !data) return [];
  return ((data as CareVendorType[]) ?? []).map((r) => ({
    ...r,
    panels: Array.isArray(r.panels) ? r.panels : ["desk"],
  }));
}

export async function fetchSerialStatuses(): Promise<CareStatusRow[]> {
  const { data, error } = await supabase
    .from("care_serial_statuses")
    .select("slug, label_bn, label_en, is_terminal, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error || !data) return [];
  return data as CareStatusRow[];
}

export async function fetchLabBookingStatuses(): Promise<CareStatusRow[]> {
  const { data, error } = await supabase
    .from("care_lab_booking_statuses")
    .select("slug, label_bn, label_en, is_terminal, is_active, sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error || !data) return [];
  return data as CareStatusRow[];
}

export async function fetchTestCategories(activeOnly = true): Promise<CareTestCategory[]> {
  let q = supabase
    .from("care_test_categories")
    .select("id, slug, name_bn, name_en, is_active, sort_order")
    .order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as CareTestCategory[];
}

export async function fetchTestCatalog(activeOnly = true): Promise<CareTestCatalogItem[]> {
  let q = supabase
    .from("care_test_catalog")
    .select(
      "id, category_id, code, name_bn, name_en, sample_type, fasting_notes_bn, fasting_notes_en, prep_bn, prep_en, default_tat_hours, is_package, is_active, sort_order",
    )
    .order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error || !data) return [];
  return data as CareTestCatalogItem[];
}

export async function fetchCarePolicies(): Promise<{
  policies: CareBookingPolicies;
  flags: CareFeatureFlags;
}> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("care_booking_policies, care_feature_flags")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return { policies: DEFAULT_POLICIES, flags: DEFAULT_FLAGS };
  const row = data as {
    care_booking_policies?: Partial<CareBookingPolicies>;
    care_feature_flags?: Partial<CareFeatureFlags>;
  };
  return {
    policies: { ...DEFAULT_POLICIES, ...(row.care_booking_policies ?? {}) },
    flags: { ...DEFAULT_FLAGS, ...(row.care_feature_flags ?? {}) },
  };
}

export async function saveCarePolicies(policies: CareBookingPolicies, flags: CareFeatureFlags) {
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    care_booking_policies: policies,
    care_feature_flags: flags,
  } as never);
  if (error) throw new Error(error.message);
}

export function locName(
  row: { name?: string | null; name_bn?: string | null; name_en?: string | null },
  lang: "bn" | "en",
) {
  if (lang === "bn") return row.name_bn || row.name || row.name_en || "";
  return row.name_en || row.name || row.name_bn || "";
}
