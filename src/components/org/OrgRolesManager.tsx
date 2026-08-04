import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Shield, Trash2 } from "lucide-react";
import {
  createOrgRole,
  deleteOrgRole,
  fetchOrgRoles,
  updateOrgRole,
  type OrgRoleRow,
} from "@/lib/org-access";
import {
  ORG_PERMISSION_CATALOG,
  orgPermissionsByGroup,
  type OrgPermissionKey,
} from "@/lib/org-permissions";
import { toast } from "sonner";

export function OrgRolesManager({
  orgId,
  lang,
  canManage,
  variant = "app",
}: {
  orgId: string;
  lang: "bn" | "en";
  canManage: boolean;
  variant?: "app" | "admin";
}) {
  const [roles, setRoles] = useState<OrgRoleRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState("");
  const byGroup = useMemo(() => orgPermissionsByGroup(), []);

  const border = variant === "admin" ? "border-slate-800" : "border-border";
  const card = variant === "admin" ? "bg-slate-900 text-slate-100" : "bg-card";
  const muted = variant === "admin" ? "text-slate-400" : "text-muted-foreground";
  const inp =
    variant === "admin"
      ? "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs"
      : "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25";

  async function load() {
    setLoading(true);
    try {
      const rows = await fetchOrgRoles(orgId);
      setRoles(rows);
      setSelectedId((prev) => prev ?? rows[0]?.id ?? null);
    } catch (e) {
      toast.error((e as Error).message);
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [orgId]);

  const selected = roles.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) {
      setName("");
      setNameBn("");
      setPerms(new Set());
      return;
    }
    setName(selected.name);
    setNameBn(selected.name_bn ?? "");
    setPerms(new Set(selected.permissions));
  }, [selected?.id, selected?.name, selected?.name_bn, selected?.permissions?.join(",")]);

  function togglePerm(key: string) {
    if (!canManage) return;
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function save() {
    if (!canManage || !selected) return;
    setBusy(true);
    try {
      await updateOrgRole({
        roleId: selected.id,
        name,
        nameBn,
        permissions: [...perms] as OrgPermissionKey[],
      });
      toast.success(lang === "bn" ? "রোল সেভ হয়েছে" : "Role saved");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    if (!canManage) return;
    if (!newName.trim()) {
      return toast.error(lang === "bn" ? "রোলের নাম দিন" : "Enter a role name");
    }
    setBusy(true);
    try {
      const row = await createOrgRole({
        orgId,
        name: newName.trim(),
        permissions: ["overview.view", "donors.view", "requests.view"],
      });
      setNewName("");
      toast.success(lang === "bn" ? "রোল তৈরি হয়েছে" : "Role created");
      await load();
      setSelectedId(row.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!canManage || !selected) return;
    if (selected.is_system) {
      return toast.error(
        lang === "bn" ? "সিস্টেম রোল ডিলিট করা যায় না" : "System roles cannot be deleted",
      );
    }
    if (!confirm(lang === "bn" ? "এই রোল ডিলিট করবেন?" : "Delete this role?")) return;
    setBusy(true);
    try {
      await deleteOrgRole(selected.id);
      setSelectedId(null);
      toast.success(lang === "bn" ? "ডিলিট হয়েছে" : "Deleted");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`rounded-xl border ${border} ${card} p-3 space-y-3`}>
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">
            {lang === "bn" ? "রোল ও পারমিশন" : "Roles & permissions"}
          </p>
          <p className={`text-[10px] ${muted}`}>
            {lang === "bn"
              ? "প্রতিটি রোলে কী কী অ্যাক্সেস থাকবে সেট করুন; নতুন রোলও তৈরি করা যায়"
              : "Configure what each role can do; create custom roles"}
          </p>
        </div>
      </div>

      {loading && <p className={`text-xs ${muted}`}>…</p>}

      <div className="flex flex-wrap gap-1.5">
        {roles.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setSelectedId(r.id)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold border transition ${
              selectedId === r.id
                ? "bg-primary text-primary-foreground border-primary"
                : variant === "admin"
                  ? "border-slate-700 text-slate-300 hover:bg-slate-800"
                  : "border-border hover:bg-muted"
            }`}
          >
            {lang === "bn" ? r.name_bn || r.name : r.name}
            {r.is_system ? " *" : ""}
          </button>
        ))}
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[140px] space-y-1">
            <label className={`text-[10px] ${muted}`}>
              {lang === "bn" ? "নতুন রোল" : "New role"}
            </label>
            <input
              className={inp}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder={lang === "bn" ? "যেমন: Manager" : "e.g. Manager"}
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void create()}
            className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" />
            {lang === "bn" ? "তৈরি" : "Create"}
          </button>
        </div>
      )}

      {selected && (
        <div className="space-y-3 border-t pt-3" style={{ borderColor: "inherit" }}>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className={`text-[10px] ${muted}`}>Name (EN)</label>
              <input
                className={inp}
                value={name}
                disabled={!canManage}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className={`text-[10px] ${muted}`}>Name (BN)</label>
              <input
                className={inp}
                value={nameBn}
                disabled={!canManage}
                onChange={(e) => setNameBn(e.target.value)}
              />
            </div>
          </div>
          <p className={`text-[10px] ${muted}`}>
            slug: <code>{selected.slug}</code>
            {selected.is_system
              ? lang === "bn"
                ? " · সিস্টেম রোল"
                : " · system role"
              : ""}
          </p>

          <div className="space-y-3">
            {[...byGroup.entries()].map(([group, list]) => (
              <div key={group}>
                <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${muted}`}>
                  {group}
                </p>
                <div className="space-y-1">
                  {list.map((p) => (
                    <label
                      key={p.key}
                      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                        canManage ? "cursor-pointer hover:bg-black/5 dark:hover:bg-white/5" : ""
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={perms.has(p.key)}
                        disabled={!canManage}
                        onChange={() => togglePerm(p.key)}
                        className="rounded border"
                      />
                      <span>{lang === "bn" ? p.label_bn : p.label_en}</span>
                      <span className={`ml-auto text-[10px] ${muted}`}>{p.key}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                {lang === "bn" ? "সেভ" : "Save"}
              </button>
              {!selected.is_system && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void remove()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/40 px-3 py-2 text-xs font-semibold text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  {lang === "bn" ? "ডিলিট" : "Delete"}
                </button>
              )}
            </div>
          )}

          {!canManage && (
            <p className={`text-[10px] ${muted}`}>
              {lang === "bn"
                ? "শুধু দেখা যাচ্ছে — এডিট করতে roles.manage লাগবে"
                : "Read-only — roles.manage required to edit"}
            </p>
          )}
        </div>
      )}

      {!loading && roles.length === 0 && (
        <p className={`text-xs ${muted}`}>
          {lang === "bn"
            ? "রোল লোড হয়নি — SQL স্ক্রিপ্ট চালান: community-org-roles.sql"
            : "No roles — run SQL: community-org-roles.sql"}
        </p>
      )}

      {/* keep catalog referenced for tree-shake awareness */}
      <span className="hidden">{ORG_PERMISSION_CATALOG.length}</span>
    </div>
  );
}
