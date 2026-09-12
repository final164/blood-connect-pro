import { supabase } from "@/integrations/supabase/client";

export type RegisterCommunityOrgInput = {
  name: string;
  nameBn?: string;
  phone?: string;
  districtId?: string | null;
  email?: string;
  description?: string;
};

export type RegisterCommunityOrgResult = {
  orgId: string;
  kycStatus: "pending" | "verified" | "rejected" | string;
  autoApproved: boolean;
  alreadyMember: boolean;
};

export type CommunityOrgRegistrationSettings = {
  auto_approve_registration: boolean;
};

export const DEFAULT_COMMUNITY_ORG_REG_SETTINGS: CommunityOrgRegistrationSettings = {
  auto_approve_registration: false,
};

export function normalizeCommunityOrgRegistrationSettings(
  raw: unknown,
): CommunityOrgRegistrationSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<CommunityOrgRegistrationSettings>;
  return {
    auto_approve_registration: r.auto_approve_registration === true,
  };
}

export async function fetchCommunityOrgRegistrationSettings(
  force = false,
): Promise<CommunityOrgRegistrationSettings> {
  void force;
  const { data, error } = await supabase
    .from("app_settings")
    .select("community_org_registration_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return { ...DEFAULT_COMMUNITY_ORG_REG_SETTINGS };
  return normalizeCommunityOrgRegistrationSettings(
    (data as { community_org_registration_settings?: unknown }).community_org_registration_settings,
  );
}

export async function saveCommunityOrgRegistrationSettings(
  next: CommunityOrgRegistrationSettings,
) {
  const normalized = normalizeCommunityOrgRegistrationSettings(next);
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    community_org_registration_settings: normalized,
  } as never);
  return { error, settings: normalized };
}

/** Creates community org + owner membership (or returns existing owned org). */
export async function registerCommunityOrg(
  input: RegisterCommunityOrgInput,
): Promise<RegisterCommunityOrgResult> {
  const name = input.name.trim();
  if (!name) throw new Error("Organization name is required");
  const phone = input.phone?.trim();
  if (!phone) throw new Error("Organization phone is required");

  const { data, error } = await supabase.rpc("register_community_org", {
    p_name: name,
    p_name_bn: input.nameBn?.trim() || null,
    p_phone: phone,
    p_district_id: input.districtId || null,
    p_email: input.email?.trim() || null,
    p_description: input.description?.trim() || null,
  });

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Could not create organization");

  if (typeof data === "string") {
    return {
      orgId: data,
      kycStatus: "verified",
      autoApproved: true,
      alreadyMember: false,
    };
  }

  const row = data as Record<string, unknown>;
  const orgId = String(row.org_id ?? "");
  if (!orgId) throw new Error("Could not create organization");
  return {
    orgId,
    kycStatus: String(row.kyc_status ?? "pending"),
    autoApproved: row.auto_approved === true,
    alreadyMember: row.already_member === true,
  };
}

export function communityOrgKycLabel(status: string | null | undefined, lang: "bn" | "en") {
  const s = (status || "verified").toLowerCase();
  if (s === "pending") return lang === "bn" ? "অনুমোদনের অপেক্ষায়" : "Pending approval";
  if (s === "rejected") return lang === "bn" ? "প্রত্যাখ্যান" : "Rejected";
  return lang === "bn" ? "অনুমোদিত" : "Approved";
}
