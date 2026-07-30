import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useAdminAccess } from "@/lib/admin-access-context";
import { useI18n } from "@/lib/i18n";
import {
  ADMIN_MODULES,
  ADMIN_PERMISSION_CATALOG,
  permissionsByModule,
  type AdminRoleRow,
  type OverrideEffect,
  type PermissionKey,
} from "@/lib/admin-permissions";
import { UsersGeoScopeEditor } from "@/components/admin/UsersGeoScopeEditor";
import {
  DEFAULT_USERS_GEO_SCOPE,
  normalizeUsersGeoScope,
  type UsersGeoScope,
} from "@/lib/users-geo-scope";
import { Copy, Plus, Shield, Trash2, UserCog } from "lucide-react";
import { toast } from "sonner";

type SubTab = "roles" | "assignments" | "overrides";

type ProfileLite = { id: string; full_name: string | null; phone: string | null };

export function AccessControlAdmin() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const { can, isSuper, refresh: refreshAccess } = useAdminAccess();
  const canManage = can("access.manage");
  const [sub, setSub] = useState<SubTab>("roles");
  const [roles, setRoles] = useState<AdminRoleRow[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [rolePerms, setRolePerms] = useState<Set<string>>(new Set());
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [userRoles, setUserRoles] = useState<{ user_id: string; role_id: string }[]>([]);
  const [overrides, setOverrides] = useState<
    { user_id: string; permission_key: string; effect: OverrideEffect }[]
  >([]);
  const [q, setQ] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [previewUserId, setPreviewUserId] = useState("");
  const [newRoleName, setNewRoleName] = useState("");
  const [busy, setBusy] = useState(false);
  const [geoScope, setGeoScope] = useState<UsersGeoScope>(DEFAULT_USERS_GEO_SCOPE);

  const byModule = useMemo(() => permissionsByModule(), []);
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? null;

  async function loadRoles() {
    const { data, error } = await supabase
      .from("admin_roles")
      .select("*")
      .order("name");
    if (error) {
      toast.error(error.message);
      setRoles([]);
      return;
    }
    setRoles((data as AdminRoleRow[]) ?? []);
    if (!selectedRoleId && data?.[0]?.id) setSelectedRoleId(data[0].id);
  }

  async function loadRolePerms(roleId: string) {
    const { data } = await supabase
      .from("admin_role_permissions")
      .select("permission_key")
      .eq("role_id", roleId);
    setRolePerms(new Set((data ?? []).map((r) => r.permission_key)));
  }

  async function loadAssignments() {
    const [{ data: profs }, { data: urs }, { data: ovs }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, phone")
        .order("full_name")
        .limit(300),
      supabase.from("admin_user_roles").select("user_id, role_id"),
      supabase.from("admin_user_permission_overrides").select("user_id, permission_key, effect"),
    ]);
    setProfiles((profs as ProfileLite[]) ?? []);
    setUserRoles(urs ?? []);
    setOverrides((ovs as typeof overrides) ?? []);
  }

  useEffect(() => {
    void loadRoles();
    void loadAssignments();
  }, []);

  useEffect(() => {
    if (selectedRoleId) void loadRolePerms(selectedRoleId);
  }, [selectedRoleId]);

  useEffect(() => {
    if (!selectedRoleId) return;
    const role = roles.find((r) => r.id === selectedRoleId);
    setGeoScope(normalizeUsersGeoScope(role?.users_geo_scope ?? DEFAULT_USERS_GEO_SCOPE));
  }, [selectedRoleId, roles]);

  const filteredProfiles = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return profiles.slice(0, 40);
    return profiles
      .filter(
        (p) =>
          (p.full_name ?? "").toLowerCase().includes(s) ||
          (p.phone ?? "").includes(s) ||
          p.id.toLowerCase().includes(s),
      )
      .slice(0, 40);
  }, [profiles, q]);

  async function createRole() {
    if (!canManage || !newRoleName.trim()) return;
    setBusy(true);
    const slug = newRoleName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || `role-${Date.now()}`;
    const { data, error } = await supabase
      .from("admin_roles")
      .insert({
        slug: `${slug}-${Date.now().toString(36).slice(-4)}`,
        name: newRoleName.trim(),
        name_bn: newRoleName.trim(),
        description: null,
        is_system: false,
        is_active: true,
        users_geo_scope: DEFAULT_USERS_GEO_SCOPE,
      })
      .select("*")
      .single();
    setBusy(false);
    if (error) return toast.error(error.message);
    setNewRoleName("");
    toast.success(lang === "bn" ? "রোল তৈরি হয়েছে" : "Role created");
    await loadRoles();
    if (data?.id) setSelectedRoleId(data.id);
  }

  async function cloneRole() {
    if (!canManage || !selectedRole) return;
    setBusy(true);
    const { data, error } = await supabase
      .from("admin_roles")
      .insert({
        slug: `${selectedRole.slug}-copy-${Date.now().toString(36).slice(-4)}`,
        name: `${selectedRole.name} (copy)`,
        name_bn: selectedRole.name_bn ? `${selectedRole.name_bn} (কপি)` : null,
        description: selectedRole.description,
        is_system: false,
        is_active: true,
        users_geo_scope: selectedRole.users_geo_scope ?? DEFAULT_USERS_GEO_SCOPE,
      })
      .select("*")
      .single();
    if (error || !data) {
      setBusy(false);
      return toast.error(error?.message ?? "Clone failed");
    }
    const keys = [...rolePerms];
    if (keys.length) {
      await supabase.from("admin_role_permissions").insert(
        keys.map((permission_key) => ({ role_id: data.id, permission_key })),
      );
    }
    setBusy(false);
    toast.success(lang === "bn" ? "রোল ক্লোন হয়েছে" : "Role cloned");
    await loadRoles();
    setSelectedRoleId(data.id);
  }

  async function saveGeoScope(next: UsersGeoScope) {
    if (!canManage || !selectedRoleId) return;
    if (selectedRole?.slug === "super-admin" && !isSuper) {
      return toast.error(lang === "bn" ? "সুপার অ্যাডমিন রোল এডিট করা যাবে না" : "Cannot edit Super Admin role");
    }
    setGeoScope(next);
    const { error } = await supabase
      .from("admin_roles")
      .update({ users_geo_scope: next } as never)
      .eq("id", selectedRoleId);
    if (error) {
      toast.error(error.message);
      return;
    }
    setRoles((prev) =>
      prev.map((r) => (r.id === selectedRoleId ? { ...r, users_geo_scope: next } : r)),
    );
    void refreshAccess();
  }

  async function deleteRole() {
    if (!canManage || !selectedRole || selectedRole.is_system) return;
    if (!confirm(lang === "bn" ? "এই রোল ডিলিট?" : "Delete this role?")) return;
    const { error } = await supabase.from("admin_roles").delete().eq("id", selectedRole.id);
    if (error) return toast.error(error.message);
    setSelectedRoleId(null);
    toast.success(lang === "bn" ? "ডিলিট হয়েছে" : "Deleted");
    await loadRoles();
  }

  async function togglePerm(key: string) {
    if (!canManage || !selectedRoleId) return;
    if (selectedRole?.slug === "super-admin" && !isSuper) {
      return toast.error(lang === "bn" ? "সুপার অ্যাডমিন রোল এডিট করা যাবে না" : "Cannot edit Super Admin role");
    }
    const has = rolePerms.has(key);
    if (has) {
      const { error } = await supabase
        .from("admin_role_permissions")
        .delete()
        .eq("role_id", selectedRoleId)
        .eq("permission_key", key);
      if (error) return toast.error(error.message);
      setRolePerms((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      const { error } = await supabase
        .from("admin_role_permissions")
        .insert({ role_id: selectedRoleId, permission_key: key });
      if (error) return toast.error(error.message);
      setRolePerms((prev) => new Set(prev).add(key));
    }
  }

  async function toggleModuleAll(module: string, enable: boolean) {
    if (!canManage || !selectedRoleId) return;
    const keys = ADMIN_PERMISSION_CATALOG.filter((p) => p.module === module).map((p) => p.key);
    if (enable) {
      const missing = keys.filter((k) => !rolePerms.has(k));
      if (!missing.length) return;
      const { error } = await supabase
        .from("admin_role_permissions")
        .upsert(missing.map((permission_key) => ({ role_id: selectedRoleId, permission_key })));
      if (error) return toast.error(error.message);
      setRolePerms((prev) => {
        const next = new Set(prev);
        missing.forEach((k) => next.add(k));
        return next;
      });
    } else {
      const { error } = await supabase
        .from("admin_role_permissions")
        .delete()
        .eq("role_id", selectedRoleId)
        .in("permission_key", keys);
      if (error) return toast.error(error.message);
      setRolePerms((prev) => {
        const next = new Set(prev);
        keys.forEach((k) => next.delete(k));
        return next;
      });
    }
  }

  async function assignRole(userId: string, roleId: string) {
    if (!canManage && !can("users.set_role")) return;
    const { error } = await supabase.from("admin_user_roles").upsert({
      user_id: userId,
      role_id: roleId,
      assigned_by: user?.id ?? null,
    });
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "রোল অ্যাসাইন হয়েছে" : "Role assigned");
    await loadAssignments();
    await refreshAccess();
  }

  async function unassignRole(userId: string, roleId: string) {
    if (!canManage && !can("users.set_role")) return;
    const role = roles.find((r) => r.id === roleId);
    const phone = profiles.find((p) => p.id === userId)?.phone ?? "";
    if (role?.slug === "super-admin" && (phone === "01700000000" || (userId === user?.id && isSuper))) {
      return toast.error(
        lang === "bn" ? "সুপার অ্যাডমিন রোল সরানো যাবে না" : "Cannot remove Super Admin role",
      );
    }
    const { error } = await supabase
      .from("admin_user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role_id", roleId);
    if (error) return toast.error(error.message);
    await loadAssignments();
    await refreshAccess();
  }

  async function setOverride(userId: string, key: string, effect: OverrideEffect | null) {
    if (!canManage) return;
    if (userId === user?.id && key === "access.manage" && effect === "deny") {
      return toast.error(lang === "bn" ? "নিজের access.manage deny করা যাবে না" : "Cannot deny your own access.manage");
    }
    if (effect === null) {
      const { error } = await supabase
        .from("admin_user_permission_overrides")
        .delete()
        .eq("user_id", userId)
        .eq("permission_key", key);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("admin_user_permission_overrides").upsert({
        user_id: userId,
        permission_key: key,
        effect,
      });
      if (error) return toast.error(error.message);
    }
    await loadAssignments();
  }

  const previewKeys = useMemo(() => {
    if (!previewUserId) return [];
    const roleIds = userRoles.filter((u) => u.user_id === previewUserId).map((u) => u.role_id);
    // Approximate preview from loaded rolePerms only for selected role — load all role perms lazily
    return { roleIds, overrides: overrides.filter((o) => o.user_id === previewUserId) };
  }, [previewUserId, userRoles, overrides]);

  const [previewEffective, setPreviewEffective] = useState<string[]>([]);

  useEffect(() => {
    async function calc() {
      if (!previewUserId) {
        setPreviewEffective([]);
        return;
      }
      const roleIds = userRoles.filter((u) => u.user_id === previewUserId).map((u) => u.role_id);
      if (!roleIds.length && !overrides.some((o) => o.user_id === previewUserId)) {
        setPreviewEffective([]);
        return;
      }
      const { data } = await supabase
        .from("admin_role_permissions")
        .select("permission_key")
        .in("role_id", roleIds.length ? roleIds : ["00000000-0000-0000-0000-000000000000"]);
      const set = new Set((data ?? []).map((r) => r.permission_key));
      for (const o of overrides.filter((x) => x.user_id === previewUserId)) {
        if (o.effect === "grant") set.add(o.permission_key);
        if (o.effect === "deny") set.delete(o.permission_key);
      }
      setPreviewEffective([...set].sort());
    }
    void calc();
  }, [previewUserId, userRoles, overrides]);

  const inp =
    "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/40";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-rose-600/20 text-rose-400 grid place-items-center shrink-0">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">
              {lang === "bn" ? "অ্যাক্সেস কন্ট্রোল (RBAC)" : "Access Control (RBAC)"}
            </h3>
            <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
              {lang === "bn"
                ? "রোল → পারমিশন ম্যাট্রিক্স → ইউজার অ্যাসাইনমেন্ট → grant/deny override। সুপার অ্যাডমিন সবসময় ফুল অ্যাক্সেস।"
                : "Roles → permission matrix → user assignment → grant/deny overrides. Super Admin always has full access."}
            </p>
            {!canManage && (
              <p className="text-[10px] text-amber-400 mt-2">
                {lang === "bn" ? "রিড-অনলি — access.manage নেই" : "Read-only — missing access.manage"}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-1 mt-4 rounded-xl bg-slate-950 p-1 overflow-x-auto no-scrollbar">
          {(
            [
              ["roles", lang === "bn" ? "রোল ও ম্যাট্রিক্স" : "Roles & matrix"],
              ["assignments", lang === "bn" ? "অ্যাসাইনমেন্ট" : "Assignments"],
              ["overrides", lang === "bn" ? "Overrides" : "Overrides"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSub(id)}
              className={`shrink-0 sm:flex-1 rounded-lg px-2.5 sm:px-3 py-2 text-[10px] sm:text-xs font-semibold transition whitespace-nowrap ${
                sub === id ? "bg-rose-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {sub === "roles" && (
        <div className="grid lg:grid-cols-[240px_1fr] gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500 px-1">
              {lang === "bn" ? "রোলসমূহ" : "Roles"}
            </p>
            <ul className="space-y-1 max-h-[28rem] overflow-auto">
              {roles.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedRoleId(r.id)}
                    className={`w-full text-left rounded-lg px-3 py-2 text-xs transition ${
                      selectedRoleId === r.id
                        ? "bg-rose-600/20 text-rose-200 border border-rose-500/30"
                        : "hover:bg-slate-800 text-slate-300"
                    }`}
                  >
                    <span className="font-semibold block">{lang === "bn" ? r.name_bn || r.name : r.name}</span>
                    <span className="text-[10px] text-slate-500">
                      {r.slug}
                      {r.is_system ? " · system" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {canManage && (
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <input
                  className={inp}
                  placeholder={lang === "bn" ? "নতুন রোলের নাম" : "New role name"}
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !newRoleName.trim()}
                  onClick={() => void createRole()}
                  className="w-full rounded-lg bg-rose-600 py-2 text-xs font-semibold disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" />
                  {lang === "bn" ? "রোল তৈরি" : "Create role"}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
            {!selectedRole ? (
              <p className="text-sm text-slate-500 py-8 text-center">
                {lang === "bn" ? "একটি রোল সিলেক্ট করুন" : "Select a role"}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold">
                      {lang === "bn" ? selectedRole.name_bn || selectedRole.name : selectedRole.name}
                    </h4>
                    <p className="text-[10px] text-slate-500">{selectedRole.description}</p>
                  </div>
                  {canManage && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void cloneRole()}
                        className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-300"
                      >
                        <Copy className="h-3 w-3 inline mr-1" />
                        Clone
                      </button>
                      {!selectedRole.is_system && (
                        <button
                          type="button"
                          onClick={() => void deleteRole()}
                          className="rounded-lg border border-rose-500/40 px-2.5 py-1.5 text-[10px] text-rose-400"
                        >
                          <Trash2 className="h-3 w-3 inline mr-1" />
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4 max-h-[32rem] overflow-auto pr-1">
                  {ADMIN_MODULES.map((mod) => {
                    const perms = byModule.get(mod.id) ?? [];
                    if (!perms.length) return null;
                    const allOn = perms.every((p) => rolePerms.has(p.key));
                    return (
                      <div key={mod.id} className="rounded-lg border border-slate-800 overflow-hidden">
                        <div className="flex items-center justify-between gap-2 bg-slate-950/80 px-3 py-2">
                          <p className="text-xs font-semibold">
                            {lang === "bn" ? mod.label_bn : mod.label_en}
                          </p>
                          {canManage && (
                            <button
                              type="button"
                              onClick={() => void toggleModuleAll(mod.id, !allOn)}
                              className="text-[10px] text-rose-400 hover:underline"
                            >
                              {allOn
                                ? lang === "bn"
                                  ? "সব অফ"
                                  : "Clear all"
                                : lang === "bn"
                                  ? "সব অন"
                                  : "Select all"}
                            </button>
                          )}
                        </div>
                        <ul className="divide-y divide-slate-800">
                          {perms.map((p) => (
                            <li key={p.key} className="flex items-center justify-between gap-3 px-3 py-2">
                              <div>
                                <p className="text-xs">{lang === "bn" ? p.label_bn : p.label_en}</p>
                                <p className="text-[10px] font-mono text-slate-500">{p.key}</p>
                              </div>
                              <input
                                type="checkbox"
                                disabled={!canManage}
                                checked={rolePerms.has(p.key)}
                                onChange={() => void togglePerm(p.key)}
                                className="h-4 w-4 accent-rose-500"
                              />
                            </li>
                          ))}
                        </ul>
                        {mod.id === "users" &&
                          (rolePerms.has("users.filter_district") ||
                            rolePerms.has("users.filter_upazila") ||
                            rolePerms.has("users.view")) && (
                            <div className="p-3 border-t border-slate-800">
                              <UsersGeoScopeEditor
                                value={geoScope}
                                onChange={(next) => void saveGeoScope(next)}
                                lang={lang}
                                disabled={!canManage}
                              />
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {sub === "assignments" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <UserCog className="h-4 w-4 text-rose-400" />
              {lang === "bn" ? "ইউজারকে রোল দিন" : "Assign roles to users"}
            </div>
            <input
              className={inp}
              placeholder={lang === "bn" ? "নাম / ফোন সার্চ…" : "Search name / phone…"}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="grid sm:grid-cols-2 gap-2">
              <select className={inp} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                <option value="">{lang === "bn" ? "ইউজার সিলেক্ট…" : "Select user…"}</option>
                {filteredProfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.phone || p.id.slice(0, 8)} {p.phone ? `· ${p.phone}` : ""}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-1.5">
                {roles
                  .filter((r) => r.is_active)
                  .map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      disabled={!assignUserId || (!canManage && !can("users.set_role"))}
                      onClick={() => void assignRole(assignUserId, r.id)}
                      className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] hover:border-rose-500/50 disabled:opacity-40"
                    >
                      + {lang === "bn" ? r.name_bn || r.name : r.name}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 admin-table-scroll">
            <table className="w-full text-xs">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="text-left p-3">{lang === "bn" ? "ইউজার" : "User"}</th>
                  <th className="text-left p-3">{lang === "bn" ? "রোল" : "Roles"}</th>
                </tr>
              </thead>
              <tbody>
                {profiles
                  .filter((p) => userRoles.some((u) => u.user_id === p.id))
                  .map((p) => {
                    const assigned = userRoles.filter((u) => u.user_id === p.id);
                    return (
                      <tr key={p.id} className="border-t border-slate-800">
                        <td className="p-3">
                          <p className="font-medium">{p.full_name || "—"}</p>
                          <p className="text-[10px] text-slate-500">{p.phone}</p>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1.5">
                            {assigned.map((a) => {
                              const r = roles.find((x) => x.id === a.role_id);
                              if (!r) return null;
                              return (
                                <span
                                  key={`${a.user_id}-${a.role_id}`}
                                  className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-1 text-[10px]"
                                >
                                  {lang === "bn" ? r.name_bn || r.name : r.name}
                                  {(canManage || can("users.set_role")) && (
                                    <button
                                      type="button"
                                      className="text-rose-400"
                                      onClick={() => void unassignRole(p.id, r.id)}
                                    >
                                      ×
                                    </button>
                                  )}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                {!userRoles.length && (
                  <tr>
                    <td colSpan={2} className="p-8 text-center text-slate-500">
                      {lang === "bn" ? "এখনো কোনো অ্যাসাইনমেন্ট নেই" : "No assignments yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
            <p className="text-xs font-semibold">
              {lang === "bn" ? "ইফেক্টিভ পারমিশন প্রিভিউ" : "Effective permissions preview"}
            </p>
            <select className={inp} value={previewUserId} onChange={(e) => setPreviewUserId(e.target.value)}>
              <option value="">{lang === "bn" ? "ইউজার সিলেক্ট…" : "Select user…"}</option>
              {profiles
                .filter((p) => userRoles.some((u) => u.user_id === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.phone || p.id.slice(0, 8)}
                  </option>
                ))}
            </select>
            <p className="text-[10px] text-slate-500">
              {previewEffective.length} permission(s)
              {typeof previewKeys === "object" && "roleIds" in previewKeys
                ? ` · ${previewKeys.roleIds.length} role(s)`
                : ""}
            </p>
            <div className="flex flex-wrap gap-1 max-h-40 overflow-auto">
              {previewEffective.map((k) => (
                <span key={k} className="rounded bg-slate-800 px-1.5 py-0.5 text-[9px] font-mono text-slate-300">
                  {k}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {sub === "overrides" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <p className="text-xs font-semibold">
            {lang === "bn" ? "ইউজার-লেভেল grant / deny" : "Per-user grant / deny"}
          </p>
          <p className="text-[10px] text-slate-500">
            {lang === "bn"
              ? "Deny রোল পারমিশন কেটে দেয়; Grant অতিরিক্ত দেয়।"
              : "Deny removes a role permission; Grant adds one beyond roles."}
          </p>
          {!canManage ? (
            <p className="text-xs text-amber-400">{lang === "bn" ? "শুধু access.manage দিয়ে এডিট" : "Requires access.manage"}</p>
          ) : (
            <>
              <select className={inp} value={assignUserId} onChange={(e) => setAssignUserId(e.target.value)}>
                <option value="">{lang === "bn" ? "ইউজার সিলেক্ট…" : "Select user…"}</option>
                {profiles.slice(0, 100).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.phone || p.id.slice(0, 8)}
                  </option>
                ))}
              </select>
              {assignUserId && (
                <div className="max-h-[28rem] overflow-auto space-y-2">
                  {ADMIN_PERMISSION_CATALOG.map((p) => {
                    const cur = overrides.find(
                      (o) => o.user_id === assignUserId && o.permission_key === p.key,
                    )?.effect;
                    return (
                      <div
                        key={p.key}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2"
                      >
                        <div>
                          <p className="text-xs">{lang === "bn" ? p.label_bn : p.label_en}</p>
                          <p className="text-[10px] font-mono text-slate-500">{p.key}</p>
                        </div>
                        <div className="flex gap-1">
                          {(["grant", "deny", null] as const).map((eff) => (
                            <button
                              key={String(eff)}
                              type="button"
                              onClick={() => void setOverride(assignUserId, p.key as PermissionKey, eff)}
                              className={`rounded-md px-2 py-1 text-[10px] border ${
                                cur === eff || (eff === null && !cur)
                                  ? eff === "grant"
                                    ? "bg-emerald-600/30 border-emerald-500/40 text-emerald-200"
                                    : eff === "deny"
                                      ? "bg-rose-600/30 border-rose-500/40 text-rose-200"
                                      : "bg-slate-700 border-slate-600"
                                  : "border-slate-700 text-slate-400"
                              }`}
                            >
                              {eff === null ? "—" : eff}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!!overrides.length && (
                <div className="border-t border-slate-800 pt-3">
                  <p className="text-[10px] text-slate-500 mb-2">
                    {overrides.length} active override(s)
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
