import { supabase } from "@/integrations/supabase/client";
import {
  fetchMyCareMemberships,
  type CareMembership,
} from "@/lib/care-access";
import {
  fetchCareVendorOnboarding,
  fetchCareVendorTypes,
  type CareVendorFieldKey,
  type CareVendorOnboardingSettings,
} from "@/lib/care-cms";

export type CareVendorProfileInput = {
  ownerName?: string;
  orgName?: string;
  orgNameBn?: string;
  orgKindSlug?: string;
  orgPhone?: string;
  email?: string;
  description?: string;
  descriptionBn?: string;
  districtId?: string | null;
  upazila?: string;
  address?: string;
  locationName?: string;
};

export type CareVendorOrg = {
  id: string;
  name: string;
  name_bn: string | null;
  phone: string | null;
  email?: string | null;
  description?: string | null;
  description_bn?: string | null;
  district_id?: string | null;
  upazila?: string | null;
  address?: string | null;
  org_kind_id?: string | null;
  is_active?: boolean;
  is_verified?: boolean;
  is_listed?: boolean;
  kyc_status?: string | null;
  profile_completed?: boolean;
  profile_submitted_at?: string | null;
  kyc_notes?: string | null;
  created_at?: string | null;
};

/** Phone + PIN only — creates stub org (kyc_status = draft) */
export async function registerCareVendorAccount(): Promise<string> {
  const { data, error } = await supabase.rpc("care_register_vendor_account");
  if (error) throw new Error(error.message);
  return data as string;
}

export async function saveCareVendorProfile(orgId: string, input: CareVendorProfileInput): Promise<void> {
  const { error } = await supabase.rpc("care_save_vendor_profile", {
    _org_id: orgId,
    _payload: {
      owner_name: input.ownerName?.trim() || null,
      org_name: input.orgName?.trim() || null,
      org_name_bn: input.orgNameBn?.trim() || null,
      org_kind_slug: input.orgKindSlug || null,
      org_phone: input.orgPhone?.trim() || null,
      email: input.email?.trim() || null,
      description: input.description?.trim() || null,
      description_bn: input.descriptionBn?.trim() || null,
      district_id: input.districtId || null,
      upazila: input.upazila?.trim() || null,
      address: input.address?.trim() || null,
      location_name: input.locationName?.trim() || null,
    },
  } as never);
  if (error) throw new Error(error.message);
}

export async function submitCareVendorProfile(orgId: string): Promise<void> {
  const { error } = await supabase.rpc("care_submit_vendor_profile", { _org_id: orgId } as never);
  if (error) throw new Error(error.message);
}

export async function fetchCareVendorOrg(orgId: string): Promise<CareVendorOrg | null> {
  const { data, error } = await supabase
    .from("care_orgs")
    .select(
      "id, name, name_bn, phone, email, description, description_bn, district_id, upazila, address, org_kind_id, is_active, is_verified, is_listed, kyc_status, profile_completed, profile_submitted_at, kyc_notes, created_at",
    )
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CareVendorOrg | null) ?? null;
}

export async function fetchOwnerCareOrgId(): Promise<string | null> {
  const rows = await fetchMyCareMemberships();
  const owner = rows.find((r) => r.role === "owner" && r.care_orgs?.is_active !== false);
  return owner?.org_id ?? null;
}

export function fieldEnabled(settings: CareVendorOnboardingSettings, key: CareVendorFieldKey) {
  return settings.fields[key]?.enabled !== false;
}

export function fieldRequired(settings: CareVendorOnboardingSettings, key: CareVendorFieldKey) {
  const f = settings.fields[key];
  return f?.enabled !== false && f?.required === true;
}

export function fieldLabel(settings: CareVendorOnboardingSettings, key: CareVendorFieldKey, lang: "bn" | "en") {
  const f = settings.fields[key];
  return lang === "bn" ? f?.label_bn || key : f?.label_en || key;
}

export function vendorProfileProgress(
  org: CareVendorOrg | null,
  ownerName: string | null | undefined,
  settings: CareVendorOnboardingSettings,
): { filled: number; total: number; percent: number } {
  let filled = 0;
  let total = 0;
  const check = (key: CareVendorFieldKey, ok: boolean) => {
    if (!fieldEnabled(settings, key)) return;
    total += 1;
    if (ok) filled += 1;
  };
  check("owner_name", !!(ownerName ?? "").trim());
  check("org_name", !!(org?.name ?? "").trim() && org?.name !== org?.phone);
  check("org_name_bn", !!(org?.name_bn ?? "").trim());
  check("org_kind", !!org?.org_kind_id);
  check("org_phone", !!(org?.phone ?? "").trim());
  check("email", !!(org?.email ?? "").trim());
  check("district", !!org?.district_id);
  check("upazila", !!(org?.upazila ?? "").trim());
  check("address", !!(org?.address ?? "").trim());
  check("description", !!(org?.description ?? "").trim());
  const percent = total ? Math.round((filled / total) * 100) : 0;
  return { filled, total, percent };
}

export async function resolveCarePortalPath(membership?: CareMembership | null): Promise<string> {
  const rows = membership ? [membership] : await fetchMyCareMemberships();
  const active = rows.filter((r) => r.care_orgs?.is_active !== false);
  if (!active.length) return "/care/auth";

  // Always land on portal overview so desk options appear as cards.
  return "/care/portal";
}

export function careOrgKycLabel(
  org: {
    is_verified?: boolean;
    kyc_status?: string | null;
    profile_completed?: boolean;
  } | null
    | undefined,
  lang: "bn" | "en",
) {
  if (!org) return "";
  if (org.is_verified) return lang === "bn" ? "অনুমোদিত ও ভেরিফায়েড" : "Approved & verified";
  const st = org.kyc_status ?? "pending";
  if (st === "draft") {
    return lang === "bn" ? "প্রোফাইল অসম্পূর্ণ" : "Profile incomplete";
  }
  if (st === "rejected") return lang === "bn" ? "প্রত্যাখ্যাত — সংশোধন করুন" : "Rejected — please update";
  if (st === "pending" && org.profile_completed) {
    return lang === "bn" ? "অ্যাডমিন অনুমোদনের অপেক্ষায়" : "Awaiting admin approval";
  }
  return lang === "bn" ? "KYC পর্যালোচনাধীন" : "KYC under review";
}

export async function loadVendorOnboardingBundle(orgId: string) {
  const [settings, org, types, memberships] = await Promise.all([
    fetchCareVendorOnboarding(),
    fetchCareVendorOrg(orgId),
    fetchCareVendorTypes(),
    fetchMyCareMemberships(),
  ]);
  const membership = memberships.find((m) => m.org_id === orgId) ?? null;
  return { settings, org, types, membership };
}
