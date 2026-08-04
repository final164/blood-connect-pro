import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ORG_ROLE_PERMISSIONS,
  type OrgPermissionKey,
  slugifyRoleName,
} from "@/lib/org-permissions";

export type OrgMemberRole = string;

export type OrgRoleRow = {
  id: string;
  org_id: string;
  slug: string;
  name: string;
  name_bn: string | null;
  is_system: boolean;
  permissions: string[];
  created_at: string;
};

export type OrgMembership = {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgMemberRole;
  role_id: string | null;
  created_at: string;
  community_org_roles?: OrgRoleRow | null;
  community_orgs?: {
    id: string;
    name: string;
    name_bn: string | null;
    phone: string;
    email: string | null;
    website: string | null;
    description: string | null;
    description_bn: string | null;
    is_active: boolean;
    donor_contact_settings?: unknown;
  } | null;
};

/** @deprecated Prefer membershipHasPermission — kept for simple write checks */
export function isOrgEditorRole(role: OrgMemberRole | null | undefined) {
  return role === "owner" || role === "editor";
}

export function membershipPermissions(m: OrgMembership | null | undefined): Set<string> {
  const fromRole = m?.community_org_roles?.permissions;
  if (Array.isArray(fromRole) && fromRole.length) return new Set(fromRole);
  const slug = (m?.role || "viewer").toLowerCase();
  const fallback = DEFAULT_ORG_ROLE_PERMISSIONS[slug] ?? DEFAULT_ORG_ROLE_PERMISSIONS.viewer;
  return new Set(fallback);
}

export function membershipHasPermission(
  m: OrgMembership | null | undefined,
  key: OrgPermissionKey,
) {
  return membershipPermissions(m).has(key);
}

export async function ensureOrgDefaultRoles(orgId: string) {
  const { error } = await supabase.rpc("ensure_org_default_roles", { _org_id: orgId });
  if (error) {
    // Fallback: insert defaults if RPC missing
    const rows = (["owner", "editor", "viewer"] as const).map((slug) => ({
      org_id: orgId,
      slug,
      name: slug === "owner" ? "Owner" : slug === "editor" ? "Editor" : "Viewer",
      name_bn: slug === "owner" ? "মালিক" : slug === "editor" ? "এডিটর" : "ভিউয়ার",
      is_system: true,
      permissions: DEFAULT_ORG_ROLE_PERMISSIONS[slug],
    }));
    await supabase.from("community_org_roles").upsert(rows, { onConflict: "org_id,slug" });
  }
}

export async function fetchOrgRoles(orgId: string): Promise<OrgRoleRow[]> {
  await ensureOrgDefaultRoles(orgId);
  const { data, error } = await supabase
    .from("community_org_roles")
    .select("id, org_id, slug, name, name_bn, is_system, permissions, created_at")
    .eq("org_id", orgId)
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return ((data as OrgRoleRow[]) ?? []).map((r) => ({
    ...r,
    permissions: Array.isArray(r.permissions) ? r.permissions : [],
  }));
}

export async function createOrgRole(params: {
  orgId: string;
  name: string;
  nameBn?: string;
  permissions: string[];
  slug?: string;
}) {
  const slug = params.slug?.trim() || slugifyRoleName(params.name);
  const { data, error } = await supabase
    .from("community_org_roles")
    .insert({
      org_id: params.orgId,
      slug,
      name: params.name.trim(),
      name_bn: params.nameBn?.trim() || null,
      is_system: false,
      permissions: params.permissions,
    })
    .select("id, org_id, slug, name, name_bn, is_system, permissions, created_at")
    .single();
  if (error) throw new Error(error.message);
  return data as OrgRoleRow;
}

export async function updateOrgRole(params: {
  roleId: string;
  name?: string;
  nameBn?: string | null;
  permissions?: string[];
}) {
  const patch: Record<string, unknown> = {};
  if (params.name !== undefined) patch.name = params.name.trim();
  if (params.nameBn !== undefined) patch.name_bn = params.nameBn?.trim() || null;
  if (params.permissions !== undefined) patch.permissions = params.permissions;
  const { error } = await supabase.from("community_org_roles").update(patch).eq("id", params.roleId);
  if (error) throw new Error(error.message);
}

export async function deleteOrgRole(roleId: string) {
  const { error } = await supabase.from("community_org_roles").delete().eq("id", roleId);
  if (error) throw new Error(error.message);
}

export async function fetchMyOrgMemberships(): Promise<OrgMembership[]> {
  const { data, error } = await supabase
    .from("community_org_members")
    .select(
      "id, org_id, user_id, role, role_id, created_at, community_org_roles(id, org_id, slug, name, name_bn, is_system, permissions, created_at), community_orgs(id, name, name_bn, phone, email, website, description, description_bn, is_active, donor_contact_settings)",
    )
    .order("created_at", { ascending: true });
  if (error) {
    // Older schema without role_id / community_org_roles
    const { data: legacy, error: e2 } = await supabase
      .from("community_org_members")
      .select(
        "id, org_id, user_id, role, created_at, community_orgs(id, name, name_bn, phone, email, website, description, description_bn, is_active, donor_contact_settings)",
      )
      .order("created_at", { ascending: true });
    if (e2) throw new Error(e2.message);
    return ((legacy as unknown as OrgMembership[]) ?? []).map((m) => ({
      ...m,
      role_id: null,
      community_org_roles: null,
    }));
  }
  return (data as unknown as OrgMembership[]) ?? [];
}

export async function fetchOrgMembers(orgId: string): Promise<
  (OrgMembership & {
    profiles?: { full_name: string | null; phone: string | null } | null;
  })[]
> {
  const { data, error } = await supabase
    .from("community_org_members")
    .select(
      "id, org_id, user_id, role, role_id, created_at, community_org_roles(id, org_id, slug, name, name_bn, is_system, permissions, created_at), profiles(full_name, phone)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: true });
  if (error) {
    const { data: legacy, error: e2 } = await supabase
      .from("community_org_members")
      .select("id, org_id, user_id, role, created_at, profiles(full_name, phone)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: true });
    if (e2) throw new Error(e2.message);
    return ((legacy as unknown as (OrgMembership & {
      profiles?: { full_name: string | null; phone: string | null } | null;
    })[]) ?? []).map((m) => ({ ...m, role_id: null, community_org_roles: null }));
  }
  return (data as unknown as (OrgMembership & {
    profiles?: { full_name: string | null; phone: string | null } | null;
  })[]) ?? [];
}

/** Find profile by phone for admin assign. Tries exact then digits-only match. */
export async function findProfileByPhone(phone: string): Promise<{
  id: string;
  full_name: string | null;
  phone: string | null;
} | null> {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const { data: byExact } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .eq("phone", trimmed)
    .maybeSingle();
  if (byExact) return byExact;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10) return null;

  const { data: cred } = await supabase
    .from("user_login_credentials")
    .select("user_id, phone")
    .eq("phone", digits)
    .maybeSingle();
  if (cred?.user_id) {
    const { data: p } = await supabase
      .from("profiles")
      .select("id, full_name, phone")
      .eq("id", cred.user_id)
      .maybeSingle();
    if (p) return p;
  }

  const { data: loose } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .ilike("phone", `%${digits.slice(-11)}%`)
    .limit(5);
  const hit = (loose ?? []).find((p) => (p.phone ?? "").replace(/\D/g, "").endsWith(digits.slice(-10)));
  return hit ?? null;
}

export async function assignOrgMember(params: {
  orgId: string;
  userId: string;
  role: OrgMemberRole;
  roleId?: string | null;
}) {
  let roleId = params.roleId ?? null;
  let roleSlug = params.role;
  if (!roleId) {
    const roles = await fetchOrgRoles(params.orgId);
    const hit = roles.find((r) => r.slug === params.role || r.id === params.role);
    roleId = hit?.id ?? null;
    roleSlug = hit?.slug ?? params.role;
  } else {
    const roles = await fetchOrgRoles(params.orgId);
    const hit = roles.find((r) => r.id === roleId);
    if (hit) roleSlug = hit.slug;
  }
  const payload: Record<string, unknown> = {
    org_id: params.orgId,
    user_id: params.userId,
    role: roleSlug,
  };
  if (roleId) payload.role_id = roleId;

  const { error } = await supabase.from("community_org_members").upsert(payload, {
    onConflict: "org_id,user_id",
  });
  if (error) throw new Error(error.message);
}

export async function removeOrgMember(memberId: string) {
  const { error } = await supabase.from("community_org_members").delete().eq("id", memberId);
  if (error) throw new Error(error.message);
}

export async function countOrgDonors(orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from("community_donors")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if (error) return 0;
  return count ?? 0;
}

export async function countOrgOpenRequests(orgId: string): Promise<number> {
  const { count, error } = await supabase
    .from("blood_requests")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("status", "open");
  if (error) return 0;
  return count ?? 0;
}
