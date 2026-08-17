import { useEffect, useState } from "react";
import { UserPlus, Trash2 } from "lucide-react";
import {
  assignOrgMember,
  fetchOrgMembers,
  fetchOrgRoles,
  findProfileByPhone,
  removeOrgMember,
  type OrgRoleRow,
} from "@/lib/org-access";
import { toast } from "sonner";
import { clampPhoneDigits } from "@/lib/phone-auth";

export function OrgMembersAdmin({
  orgId,
  lang,
  canEdit,
  variant = "admin",
}: {
  orgId: string;
  lang: "bn" | "en";
  canEdit: boolean;
  variant?: "app" | "admin";
}) {
  const [members, setMembers] = useState<
    Awaited<ReturnType<typeof fetchOrgMembers>>
  >([]);
  const [roles, setRoles] = useState<OrgRoleRow[]>([]);
  const [phone, setPhone] = useState("");
  const [roleId, setRoleId] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const isAdmin = variant === "admin";
  const border = isAdmin ? "border-slate-800" : "border-border";
  const muted = isAdmin ? "text-slate-400" : "text-muted-foreground";
  const muted2 = isAdmin ? "text-slate-500" : "text-muted-foreground";
  const inp = isAdmin
    ? "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs"
    : "w-full rounded-xl border bg-background px-3 py-2 text-sm";
  const sel = isAdmin
    ? "rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs min-w-[8rem]"
    : "rounded-xl border bg-background px-3 py-2 text-sm min-w-[8rem]";
  const rowBorder = isAdmin ? "border-slate-800" : "border-border";
  const btnAdd = isAdmin
    ? "rounded-lg bg-rose-600 text-white text-xs font-semibold px-3 py-2 flex items-center gap-1 disabled:opacity-50"
    : "rounded-xl bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 flex items-center gap-1 disabled:opacity-50";
  const delBtn = isAdmin
    ? "p-1.5 text-rose-400 hover:bg-rose-500/10 rounded-md"
    : "p-1.5 text-destructive hover:bg-destructive/10 rounded-md";

  async function load() {
    setLoading(true);
    try {
      const [m, r] = await Promise.all([fetchOrgMembers(orgId), fetchOrgRoles(orgId)]);
      setMembers(m);
      setRoles(r);
      setRoleId((prev) => prev || r.find((x) => x.slug === "editor")?.id || r[0]?.id || "");
    } catch (e) {
      toast.error((e as Error).message);
      setMembers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [orgId]);

  async function add() {
    if (!canEdit) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!phone.trim()) {
      return toast.error(lang === "bn" ? "ফোন নম্বর দিন" : "Enter a phone number");
    }
    if (!roleId) {
      return toast.error(lang === "bn" ? "রোল সিলেক্ট করুন" : "Select a role");
    }
    setBusy(true);
    try {
      const profile = await findProfileByPhone(phone);
      if (!profile) {
        toast.error(
          lang === "bn"
            ? "এই ফোনে কোনো ইউজার নেই — আগে অ্যাপে সাইনআপ করতে হবে"
            : "No user with this phone — they must sign up first",
        );
        return;
      }
      const role = roles.find((r) => r.id === roleId);
      await assignOrgMember({
        orgId,
        userId: profile.id,
        role: role?.slug ?? "editor",
        roleId,
      });
      toast.success(lang === "bn" ? "মেম্বার যোগ হয়েছে" : "Member assigned");
      setPhone("");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!canEdit) return;
    if (!confirm(lang === "bn" ? "মেম্বার সরবেন?" : "Remove member?")) return;
    try {
      await removeOrgMember(id);
      toast.success(lang === "bn" ? "সরানো হয়েছে" : "Removed");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function roleLabel(m: (typeof members)[number]) {
    const r = m.community_org_roles;
    if (r) return lang === "bn" ? r.name_bn || r.name : r.name;
    return m.role;
  }

  return (
    <div className={`${isAdmin ? "border-t border-slate-800 mt-3 pt-3" : ""} space-y-3`}>
      <p className={`text-xs font-semibold ${muted}`}>
        {lang === "bn" ? "অর্গানাইজেশন মেম্বার" : "Organization members"}
      </p>
      {canEdit && (
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1 flex-1 min-w-[140px]">
            <label className={`text-[10px] ${muted2}`}>
              {lang === "bn" ? "ফোন" : "Phone"}
            </label>
            <input
              className={inp}
              value={phone}
              onChange={(e) => setPhone(clampPhoneDigits(e.target.value))}
              placeholder="01XXXXXXXXX"
              inputMode="tel"
              maxLength={11}
            />
          </div>
          <div className="space-y-1">
            <label className={`text-[10px] ${muted2}`}>
              {lang === "bn" ? "রোল" : "Role"}
            </label>
            <select className={sel} value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {lang === "bn" ? r.name_bn || r.name : r.name}
                </option>
              ))}
            </select>
          </div>
          <button type="button" disabled={busy} onClick={() => void add()} className={btnAdd}>
            <UserPlus className="h-3.5 w-3.5" />
            {lang === "bn" ? "যোগ" : "Add"}
          </button>
        </div>
      )}
      {loading && <p className={`text-[10px] ${muted2}`}>…</p>}
      <ul className="space-y-1">
        {members.map((m) => (
          <li
            key={m.id}
            className={`flex items-center justify-between gap-2 rounded-lg border ${rowBorder} px-2.5 py-2 text-xs`}
          >
            <div className="min-w-0">
              <p className="font-medium truncate">
                {m.profiles?.full_name || m.user_id.slice(0, 8)}
              </p>
              <p className={`text-[10px] ${muted2}`}>
                {m.profiles?.phone || "—"} · {roleLabel(m)}
              </p>
            </div>
            {canEdit && (
              <button type="button" onClick={() => void remove(m.id)} className={delBtn}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
        {!loading && members.length === 0 && (
          <p className={`text-[10px] ${muted2}`}>
            {lang === "bn" ? "এখনো মেম্বার নেই" : "No members yet"}
          </p>
        )}
      </ul>
      {/* silence unused */}
      <span className="hidden">{border}</span>
    </div>
  );
}
