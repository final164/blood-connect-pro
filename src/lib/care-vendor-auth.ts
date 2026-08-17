import { supabase } from "@/integrations/supabase/client";
import { fetchMyCareMemberships, type CareMembership } from "@/lib/care-access";
import { fetchCareVendorTypes } from "@/lib/care-cms";

export type CareVendorRegisterInput = {
  orgName: string;
  orgNameBn?: string;
  orgPhone?: string;
  orgKindSlug: string;
  districtId?: string | null;
  upazila?: string;
  address?: string;
  locationName?: string;
};

export async function registerCareVendorOrg(input: CareVendorRegisterInput): Promise<string> {
  const { data, error } = await supabase.rpc("care_register_vendor", {
    _name: input.orgName.trim(),
    _name_bn: input.orgNameBn?.trim() || null,
    _org_phone: input.orgPhone?.trim() || null,
    _org_kind_slug: input.orgKindSlug || "chamber",
    _district_id: input.districtId || null,
    _upazila: input.upazila?.trim() || null,
    _address: input.address?.trim() || null,
    _location_name: input.locationName?.trim() || null,
  } as never);
  if (error) throw new Error(error.message);
  return data as string;
}

export async function markProfileAsCareVendor(userId: string) {
  await supabase.from("profiles").update({ account_kind: "care_vendor" } as never).eq("id", userId);
}

export async function getProfileAccountKind(userId: string): Promise<"patient" | "care_vendor"> {
  const { data } = await supabase
    .from("profiles")
    .select("account_kind")
    .eq("id", userId)
    .maybeSingle();
  const kind = (data as { account_kind?: string } | null)?.account_kind;
  return kind === "care_vendor" ? "care_vendor" : "patient";
}

/** Resolve default portal path from membership + vendor type panels */
export async function resolveCarePortalPath(membership?: CareMembership | null): Promise<string> {
  const rows = membership ? [membership] : await fetchMyCareMemberships();
  const active = rows.filter((r) => r.care_orgs?.is_active !== false);
  if (!active.length) return "/care/auth";

  const m = active[0]!;
  const kindId = m.care_orgs?.org_kind_id;
  if (!kindId) return "/care/portal/desk";

  const types = await fetchCareVendorTypes();
  const kind = types.find((t) => t.id === kindId);
  const panels = new Set(kind?.panels ?? ["desk"]);

  if (panels.has("desk") && !panels.has("lab")) return "/care/portal/desk";
  if (panels.has("lab") && !panels.has("desk")) return "/care/portal/lab";
  // mixed — prefer desk for chamber-first orgs
  if (panels.has("desk")) return "/care/portal/desk";
  return "/care/portal/lab";
}

export function careOrgKycLabel(
  org: { is_verified?: boolean; kyc_status?: string | null } | null | undefined,
  lang: "bn" | "en",
) {
  if (!org) return "";
  if (org.is_verified) return lang === "bn" ? "ভেরিফায়েড" : "Verified";
  const st = org.kyc_status ?? "pending";
  if (st === "rejected") return lang === "bn" ? "প্রত্যাখ্যাত" : "Rejected";
  return lang === "bn" ? "KYC পর্যালোচনাধীন" : "KYC under review";
}
