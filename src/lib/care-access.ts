import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_CARE_ROLE_PERMISSIONS,
  type CarePermissionKey,
  slugifyRoleName,
} from "@/lib/care-permissions";

export type CareOrgRole = {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  name_bn: string | null;
  is_system: boolean;
  permissions: string[];
};

export type CareMembership = {
  id: string;
  org_id: string;
  user_id: string;
  role: string;
  role_id: string | null;
  care_org_roles?: CareOrgRole | null;
  care_orgs?: {
    id: string;
    name: string;
    name_bn: string | null;
    is_active: boolean;
    is_verified: boolean;
    org_kind_id: string | null;
    phone: string | null;
  } | null;
};

export function membershipPermissions(m: CareMembership | null | undefined): Set<string> {
  const fromRole = m?.care_org_roles?.permissions;
  if (Array.isArray(fromRole) && fromRole.length) return new Set(fromRole);
  const slug = (m?.role || "reception").toLowerCase();
  const fallback = DEFAULT_CARE_ROLE_PERMISSIONS[slug] ?? DEFAULT_CARE_ROLE_PERMISSIONS.reception;
  return new Set(fallback);
}

export function careHasPermission(m: CareMembership | null | undefined, key: CarePermissionKey) {
  return membershipPermissions(m).has(key);
}

export async function fetchMyCareMemberships(): Promise<CareMembership[]> {
  const { data, error } = await supabase
    .from("care_org_members")
    .select(
      "id, org_id, user_id, role, role_id, care_org_roles(id, org_id, slug, name, name_bn, is_system, permissions), care_orgs(id, name, name_bn, is_active, is_verified, org_kind_id, phone)",
    );
  if (error) {
    if (/care_org_members|schema cache|does not exist/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data as unknown as CareMembership[]) ?? []).map((r) => {
    const role = Array.isArray(r.care_org_roles) ? r.care_org_roles[0] : r.care_org_roles;
    const org = Array.isArray(r.care_orgs) ? r.care_orgs[0] : r.care_orgs;
    return {
      ...r,
      care_orgs: org ?? null,
      care_org_roles: role
        ? {
            ...role,
            permissions: Array.isArray(role.permissions) ? role.permissions : [],
          }
        : null,
    };
  });
}

export async function ensureCareDefaultRoles(orgId: string) {
  const { error } = await supabase.rpc("ensure_care_default_roles", { _org_id: orgId } as never);
  if (error && !/does not exist|schema cache/i.test(error.message)) {
    throw new Error(error.message);
  }
}

export async function fetchCareOrgRoles(orgId: string): Promise<CareOrgRole[]> {
  await ensureCareDefaultRoles(orgId);
  const { data, error } = await supabase
    .from("care_org_roles")
    .select("id, org_id, slug, name, name_bn, is_system, permissions")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw new Error(error.message);
  return ((data as CareOrgRole[]) ?? []).map((r) => ({
    ...r,
    permissions: Array.isArray(r.permissions) ? r.permissions : [],
  }));
}

export async function createCareOrgRole(params: {
  orgId: string;
  name: string;
  nameBn?: string;
  permissions: string[];
}) {
  const slug = slugifyRoleName(params.name);
  const { data, error } = await supabase
    .from("care_org_roles")
    .insert({
      org_id: params.orgId,
      slug,
      name: params.name.trim(),
      name_bn: params.nameBn?.trim() || null,
      is_system: false,
      permissions: params.permissions,
    } as never)
    .select("id, org_id, slug, name, name_bn, is_system, permissions")
    .single();
  if (error) throw new Error(error.message);
  return data as CareOrgRole;
}

export async function updateCareOrgRole(params: {
  roleId: string;
  name?: string;
  nameBn?: string | null;
  permissions?: string[];
}) {
  const patch: Record<string, unknown> = {};
  if (params.name != null) patch.name = params.name;
  if (params.nameBn !== undefined) patch.name_bn = params.nameBn;
  if (params.permissions) patch.permissions = params.permissions;
  const { error } = await supabase.from("care_org_roles").update(patch as never).eq("id", params.roleId);
  if (error) throw new Error(error.message);
}

export async function addCareMember(params: {
  orgId: string;
  userId: string;
  role: string;
  roleId?: string | null;
}) {
  const { error } = await supabase.from("care_org_members").insert({
    org_id: params.orgId,
    user_id: params.userId,
    role: params.role,
    role_id: params.roleId ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

export async function removeCareMember(id: string) {
  const { error } = await supabase.from("care_org_members").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function orgPanelsFromKind(
  kind: { panels?: string[] | null } | null | undefined,
): Set<string> {
  const panels = kind?.panels?.length ? kind.panels : ["desk"];
  return new Set(panels);
}
