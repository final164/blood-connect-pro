import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n, ensureCmsSeed } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { fetchAllDistrictsAdmin, fetchAllHospitalsAdmin, type District, type Hospital } from "@/lib/api";
import { BANGLADESH_HOSPITALS } from "@/data/bangladesh-hospitals";
import { ARCHITECTURE_MARKDOWN } from "@/lib/architecture-doc";
import {
  LayoutDashboard,
  MapPinned,
  Type,
  Building2,
  Users,
  Settings2,
  FileText,
  Download,
  Plus,
  Trash2,
  Save,
  Shield,
  HeartPulse,
  LogOut,
  ExternalLink,
  Ban,
  CheckCircle2,
  Hospital as HospitalIcon,
  Bell,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — BloodLink" }] }),
  component: AdminPage,
});

type Tab =
  | "overview"
  | "users"
  | "requests"
  | "districts"
  | "hospitals"
  | "cms"
  | "community"
  | "notifications"
  | "settings"
  | "architecture";

function AdminPage() {
  const { user, loading, isAdmin, signOut, refreshAdmin } = useAuth();
  const navigate = useNavigate();
  const { t, lang, reloadCms } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void refreshAdmin();
  }, [refreshAdmin]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    const timer = setTimeout(() => {
      if (!isAdmin && user.email !== "blood@gmail.com") {
        navigate({ to: "/" });
      } else {
        setReady(true);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [loading, user, isAdmin, navigate]);

  if (loading || !user || !ready) {
    return (
      <div className="min-h-dvh grid place-items-center bg-slate-950 text-slate-200">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400">{t("loading")}</p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "overview", label: t("overview"), icon: LayoutDashboard },
    { id: "users", label: t("users"), icon: Users },
    { id: "requests", label: t("manageRequests"), icon: HeartPulse },
    { id: "districts", label: t("district"), icon: MapPinned },
    { id: "hospitals", label: t("hospitals"), icon: HospitalIcon },
    { id: "cms", label: t("cms"), icon: Type },
    { id: "community", label: t("community"), icon: Building2 },
    { id: "notifications", label: t("notifications"), icon: Bell },
    { id: "settings", label: t("settings"), icon: Settings2 },
    { id: "architecture", label: t("architecture"), icon: FileText },
  ];

  return (
    <div className="min-h-dvh flex bg-slate-950 text-slate-100">
      {/* Admin sidebar — always desktop-style; stacks on small screens */}
      <aside className="w-full sm:w-64 shrink-0 border-b sm:border-b-0 sm:border-r border-slate-800 bg-slate-900 flex sm:flex-col sm:h-dvh sm:sticky sm:top-0">
        <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-2.5 shrink-0">
          <div className="h-9 w-9 rounded-lg bg-rose-600 grid place-items-center">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold truncate">{t("adminPanel")}</p>
            <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-x-auto sm:overflow-y-auto p-2 flex sm:flex-col gap-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`shrink-0 sm:w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs sm:text-sm font-medium transition ${
                  active ? "bg-rose-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="hidden sm:block p-3 border-t border-slate-800 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
          >
            <ExternalLink className="h-4 w-4" />
            {t("openApp")}
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            {t("logout")}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <h1 className="text-sm sm:text-base font-semibold">{tabs.find((x) => x.id === tab)?.label}</h1>
          <div className="flex items-center gap-2 sm:hidden">
            <Link to="/" className="text-xs text-slate-400">{t("openApp")}</Link>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <div className="max-w-6xl mx-auto">
            {!isAdmin && user.email === "blood@gmail.com" && (
              <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Admin email detected — granting role…
                <GrantSelfAdmin onDone={refreshAdmin} />
              </div>
            )}
            {tab === "overview" && <Overview />}
            {tab === "users" && <UsersAdmin />}
            {tab === "requests" && <RequestsAdmin />}
            {tab === "districts" && <DistrictsAdmin />}
            {tab === "hospitals" && <HospitalsAdmin />}
            {tab === "cms" && <CmsAdmin onSaved={reloadCms} />}
            {tab === "community" && <CommunityAdmin />}
            {tab === "notifications" && <NotificationsAdmin />}
            {tab === "settings" && <SettingsAdmin />}
            {tab === "architecture" && <ArchitectureAdmin />}
          </div>
        </main>
      </div>
    </div>
  );
}

function GrantSelfAdmin({ onDone }: { onDone: () => Promise<void> }) {
  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .upsert({ user_id: user.id, role: "admin" })
      .then(() => onDone());
  }, [user, onDone]);
  return null;
}

function Overview() {
  const { t } = useI18n();
  const [stats, setStats] = useState({ users: 0, requests: 0, open: 0, orgs: 0, districts: 0 });
  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("blood_requests").select("id", { count: "exact", head: true }),
      supabase.from("blood_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
      supabase.from("community_orgs").select("id", { count: "exact", head: true }),
      supabase.from("districts").select("id", { count: "exact", head: true }),
    ]).then(([u, r, o, org, d]) => {
      setStats({
        users: u.count ?? 0,
        requests: r.count ?? 0,
        open: o.count ?? 0,
        orgs: org.count ?? 0,
        districts: d.count ?? 0,
      });
    });
  }, []);

  const cards = [
    { label: t("users"), value: stats.users },
    { label: t("manageRequests"), value: stats.requests },
    { label: t("emptyRequests").includes("নেই") ? "Open" : "Open", value: stats.open },
    { label: t("district"), value: stats.districts },
    { label: t("community"), value: stats.orgs },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
          <p className="text-xs text-slate-400">{c.label}</p>
          <p className="text-2xl font-bold mt-1 text-white">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

function UsersAdmin() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});

  async function load() {
    const [{ data: profiles }, { data: roleRows }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, blood_group, city, is_available, created_at").order("created_at", { ascending: false }).limit(200),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setRows(profiles ?? []);
    const map: Record<string, string[]> = {};
    for (const r of roleRows ?? []) {
      map[r.user_id] = [...(map[r.user_id] ?? []), r.role];
    }
    setRoles(map);
  }

  useEffect(() => {
    load();
  }, []);

  async function setRole(userId: string, role: "admin" | "moderator" | "user") {
    if (role === "user") {
      await supabase.from("user_roles").delete().eq("user_id", userId).in("role", ["admin", "moderator"]);
      await supabase.from("user_roles").upsert({ user_id: userId, role: "user" });
    } else {
      const { error } = await supabase.from("user_roles").upsert({ user_id: userId, role });
      if (error) return toast.error(error.message);
    }
    toast.success(t("saved"));
    load();
  }

  async function toggleAvailable(id: string, value: boolean) {
    await supabase.from("profiles").update({ is_available: value }).eq("id", id);
    load();
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-slate-800/60 text-xs text-slate-400">
          <tr>
            <th className="text-left p-3">Name</th>
            <th className="text-left p-3">Blood</th>
            <th className="text-left p-3">Role</th>
            <th className="text-left p-3">Available</th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr key={u.id} className="border-t border-slate-800">
              <td className="p-3">
                <p className="font-medium">{u.full_name ?? "—"}</p>
                <p className="text-[10px] text-slate-500 font-mono">{u.id.slice(0, 8)}</p>
              </td>
              <td className="p-3">{u.blood_group ?? "—"}</td>
              <td className="p-3 text-xs">{(roles[u.id] ?? ["user"]).join(", ")}</td>
              <td className="p-3">
                <button
                  type="button"
                  onClick={() => toggleAvailable(u.id, !u.is_available)}
                  className={`text-xs px-2 py-1 rounded-md ${u.is_available ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"}`}
                >
                  {u.is_available ? "ON" : "OFF"}
                </button>
              </td>
              <td className="p-3 text-right space-x-2 whitespace-nowrap">
                <button type="button" onClick={() => setRole(u.id, "admin")} className="text-xs text-rose-400 hover:underline">
                  Admin
                </button>
                <button type="button" onClick={() => setRole(u.id, "user")} className="text-xs text-slate-400 hover:underline">
                  User
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestsAdmin() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from("blood_requests")
      .select("id, patient_name, blood_group, hospital_name, status, urgency, created_at, city")
      .order("created_at", { ascending: false })
      .limit(150);
    setRows(data ?? []);
  }

  useEffect(() => {
    load();
    const ch = supabase
      .channel("admin-req")
      .on("postgres_changes", { event: "*", schema: "public", table: "blood_requests" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("blood_requests").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  async function remove(id: string) {
    if (!confirm("Delete request?")) return;
    await supabase.from("blood_requests").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3 flex flex-wrap items-center gap-3 justify-between">
          <div className="min-w-0">
            <p className="font-medium text-sm">
              <span className="text-rose-400 font-bold mr-2">{r.blood_group}</span>
              {r.patient_name}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {r.hospital_name} · {r.city} · {r.status} · {r.urgency}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setStatus(r.id, "fulfilled")} className="p-2 rounded-lg bg-emerald-500/15 text-emerald-300" title="Fulfilled">
              <CheckCircle2 className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setStatus(r.id, "cancelled")} className="p-2 rounded-lg bg-amber-500/15 text-amber-300" title="Cancel">
              <Ban className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => remove(r.id)} className="p-2 rounded-lg bg-rose-500/15 text-rose-300" title="Delete">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-slate-400">{t("emptyRequests")}</p>}
    </div>
  );
}

function DistrictsAdmin() {
  const { t } = useI18n();
  const [rows, setRows] = useState<District[]>([]);
  const [form, setForm] = useState({ name_bn: "", name_en: "", slug: "" });

  async function load() {
    setRows(await fetchAllDistrictsAdmin());
  }
  useEffect(() => {
    load().catch((e) => toast.error(e.message));
  }, []);

  async function add() {
    const slug = form.slug || form.name_en.toLowerCase().replace(/\s+/g, "-");
    const { error } = await supabase.from("districts").insert({
      name_bn: form.name_bn,
      name_en: form.name_en,
      slug,
      sort_order: rows.length + 1,
    });
    if (error) return toast.error(error.message);
    setForm({ name_bn: "", name_en: "", slug: "" });
    load();
  }

  async function toggle(d: District) {
    await supabase.from("districts").update({ is_active: !d.is_active }).eq("id", d.id);
    load();
  }

  async function remove(id: string) {
    if (!confirm("Delete?")) return;
    await supabase.from("districts").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 grid md:grid-cols-4 gap-2">
        <input className={ainp} placeholder="Name (BN)" value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} />
        <input className={ainp} placeholder="Name (EN)" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        <input className={ainp} placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <button type="button" onClick={add} className="rounded-lg bg-rose-600 text-white text-sm font-semibold flex items-center justify-center gap-1">
          <Plus className="h-4 w-4" /> {t("save")}
        </button>
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-xs text-slate-400">
            <tr>
              <th className="text-left p-3">BN</th>
              <th className="text-left p-3">EN</th>
              <th className="text-left p-3">Active</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id} className="border-t border-slate-800">
                <td className="p-3">{d.name_bn}</td>
                <td className="p-3">{d.name_en}</td>
                <td className="p-3">
                  <button type="button" onClick={() => toggle(d)} className={`text-xs font-semibold px-2 py-1 rounded-md ${d.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800"}`}>
                    {d.is_active ? "ON" : "OFF"}
                  </button>
                </td>
                <td className="p-3 text-right">
                  <button type="button" onClick={() => remove(d.id)} className="text-rose-400 p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HospitalsAdmin() {
  const { t, lang } = useI18n();
  const [rows, setRows] = useState<Hospital[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [q, setQ] = useState("");
  const [dbReady, setDbReady] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [form, setForm] = useState({
    name_bn: "",
    name_en: "",
    slug: "",
    district_id: "",
    hospital_type: "government" as "government" | "private" | "clinic" | "diagnostic",
  });

  async function load() {
    try {
      const [h, d] = await Promise.all([fetchAllHospitalsAdmin(), fetchAllDistrictsAdmin()]);
      setRows(h);
      setDistricts(d);
      const { error } = await supabase.from("hospitals").select("id").limit(1);
      setDbReady(!error);
    } catch (e) {
      setDbReady(false);
      toast.error((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function seedAll() {
    setSeeding(true);
    try {
      const { error: probe } = await supabase.from("hospitals").select("id").limit(1);
      if (probe) {
        toast.error(
          lang === "bn"
            ? "আগে SQL Editor-এ hospitals migration রান করুন"
            : "Run hospitals migration in SQL Editor first",
        );
        setDbReady(false);
        return;
      }
      const bySlug = new Map(districts.map((d) => [d.slug, d.id]));
      const payload = BANGLADESH_HOSPITALS.map((h, i) => ({
        name_bn: h.name_bn,
        name_en: h.name_en,
        slug: h.slug,
        district_id: bySlug.get(h.districtSlug)!,
        hospital_type: h.type,
        is_active: true,
        sort_order: i + 1,
      })).filter((r) => r.district_id);

      const chunk = 60;
      for (let i = 0; i < payload.length; i += chunk) {
        const slice = payload.slice(i, i + chunk);
        const { error } = await supabase.from("hospitals").upsert(slice, { onConflict: "district_id,slug" });
        if (error) {
          for (const row of slice) {
            await supabase.from("hospitals").insert(row);
          }
        }
      }
      toast.success(`${payload.length} hospitals seeded`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  async function add() {
    if (!form.district_id || !form.name_en) return toast.error("District + EN name required");
    const slug = form.slug || form.name_en.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { error } = await supabase.from("hospitals").insert({
      name_bn: form.name_bn || form.name_en,
      name_en: form.name_en,
      slug,
      district_id: form.district_id,
      hospital_type: form.hospital_type,
    });
    if (error) return toast.error(error.message);
    setForm({ name_bn: "", name_en: "", slug: "", district_id: form.district_id, hospital_type: "government" });
    load();
  }

  async function toggle(h: Hospital) {
    if (h.id.startsWith("seed:")) return;
    await supabase.from("hospitals").update({ is_active: !h.is_active }).eq("id", h.id);
    load();
  }

  async function remove(id: string) {
    if (id.startsWith("seed:")) return;
    if (!confirm("Delete hospital?")) return;
    await supabase.from("hospitals").delete().eq("id", id);
    load();
  }

  const filtered = rows.filter((h) => {
    if (!q.trim()) return true;
    const s = q.toLowerCase();
    return h.name_en.toLowerCase().includes(s) || h.name_bn.includes(q) || (h.district_slug ?? "").includes(s);
  });

  return (
    <div className="space-y-4">
      {!dbReady && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100 space-y-2">
          <p>
            {lang === "bn"
              ? "DB টেবিল নেই — Typeahead এখন bundled catalog ব্যবহার করছে। Supabase SQL Editor-এ এই ফাইল রান করুন:"
              : "DB table missing — typeahead uses bundled catalog. Run in Supabase SQL Editor:"}
          </p>
          <code className="block text-xs bg-black/30 p-2 rounded">supabase/migrations/20260728020000_hospitals_catalog.sql</code>
          <p className="text-xs opacity-80">
            Catalog size: {BANGLADESH_HOSPITALS.length} government + private hospitals across 64 districts.
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <input className={`${ainp} max-w-xs`} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          type="button"
          disabled={seeding}
          onClick={seedAll}
          className="rounded-lg bg-rose-600 text-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {seeding ? t("saving") : `Seed all (${BANGLADESH_HOSPITALS.length})`}
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 grid md:grid-cols-3 gap-2">
        <select className={ainp} value={form.district_id} onChange={(e) => setForm({ ...form, district_id: e.target.value })}>
          <option value="">District…</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name_en}
            </option>
          ))}
        </select>
        <select
          className={ainp}
          value={form.hospital_type}
          onChange={(e) => setForm({ ...form, hospital_type: e.target.value as "government" | "private" | "clinic" | "diagnostic" })}
        >
          <option value="government">{t("government")}</option>
          <option value="private">{t("private")}</option>
          <option value="clinic">{t("clinic")}</option>
          <option value="diagnostic">{t("diagnostic")}</option>
        </select>
        <input className={ainp} placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <input className={ainp} placeholder="Name EN" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        <input className={ainp} placeholder="Name BN" value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} />
        <button type="button" onClick={add} className="rounded-lg bg-rose-600 text-white text-sm font-semibold flex items-center justify-center gap-1">
          <Plus className="h-4 w-4" /> {t("save")}
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Showing {filtered.length} / {rows.length || BANGLADESH_HOSPITALS.length}
      </p>

      <div className="rounded-xl border border-slate-800 bg-slate-900 overflow-x-auto max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-xs text-slate-400 sticky top-0">
            <tr>
              <th className="text-left p-3">Hospital</th>
              <th className="text-left p-3">District</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Active</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((h) => (
              <tr key={h.id} className="border-t border-slate-800">
                <td className="p-3">
                  <p className="font-medium">{lang === "bn" ? h.name_bn : h.name_en}</p>
                  <p className="text-[10px] text-slate-500">{lang === "bn" ? h.name_en : h.name_bn}</p>
                </td>
                <td className="p-3 text-xs">{h.district_slug ?? "—"}</td>
                <td className="p-3 text-xs uppercase">{h.hospital_type}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => toggle(h)}
                    className={`text-xs px-2 py-1 rounded-md ${h.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800"}`}
                  >
                    {h.is_active ? "ON" : "OFF"}
                  </button>
                </td>
                <td className="p-3 text-right">
                  {!h.id.startsWith("seed:") && (
                    <button type="button" onClick={() => remove(h.id)} className="text-rose-400 p-1">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CmsAdmin({ onSaved }: { onSaved: () => Promise<void> }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<{ key: string; value_bn: string; value_en: string; category: string }[]>([]);
  const [q, setQ] = useState("");

  async function load() {
    const { data, error } = await supabase.from("cms_strings").select("*").order("key");
    if (error) toast.error(error.message);
    else setRows((data as any) ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function seed() {
    await ensureCmsSeed(async (seedRows) => {
      const { error } = await supabase.from("cms_strings").upsert(seedRows);
      if (error) throw error;
    });
    toast.success(t("saved"));
    await load();
    await onSaved();
  }

  async function save(row: (typeof rows)[0]) {
    const { error } = await supabase.from("cms_strings").upsert(row);
    if (error) toast.error(error.message);
    else {
      toast.success(t("saved"));
      await onSaved();
    }
  }

  const filtered = rows.filter(
    (r) => !q || r.key.includes(q) || r.value_bn.includes(q) || r.value_en.includes(q),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <input
          className={`${ainp} max-w-xs`}
          placeholder="Search keys…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button type="button" onClick={seed} className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold hover:bg-slate-700">
          Seed / sync all UI keys
        </button>
      </div>
      <p className="text-xs text-slate-400">
        App copy is loaded from this table. Edit BN/EN — no hardcoded product text in the UI.
      </p>
      {filtered.map((r, i) => (
        <div key={r.key} className="rounded-xl border border-slate-800 bg-slate-900 p-3 grid lg:grid-cols-[180px_1fr_1fr_auto] gap-2 items-start">
          <code className="text-xs font-mono text-rose-300/90 pt-2 break-all">{r.key}</code>
          <textarea
            className={ainp}
            rows={2}
            value={r.value_bn}
            onChange={(e) => {
              const next = [...rows];
              const idx = rows.findIndex((x) => x.key === r.key);
              next[idx] = { ...r, value_bn: e.target.value };
              setRows(next);
            }}
          />
          <textarea
            className={ainp}
            rows={2}
            value={r.value_en}
            onChange={(e) => {
              const next = [...rows];
              const idx = rows.findIndex((x) => x.key === r.key);
              next[idx] = { ...r, value_en: e.target.value };
              setRows(next);
            }}
          />
          <button type="button" onClick={() => save(rows.find((x) => x.key === r.key) ?? r)} className="rounded-lg bg-rose-600 p-2.5 text-white">
            <Save className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}

function CommunityAdmin() {
  const { t } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", name_bn: "", phone: "", email: "", website: "", description: "", description_bn: "" });

  async function load() {
    const { data } = await supabase.from("community_orgs").select("*").order("sort_order");
    setRows(data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    const { error } = await supabase.from("community_orgs").insert(form);
    if (error) return toast.error(error.message);
    setForm({ name: "", name_bn: "", phone: "", email: "", website: "", description: "", description_bn: "" });
    load();
  }

  async function toggle(id: string, is_active: boolean) {
    await supabase.from("community_orgs").update({ is_active: !is_active }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    await supabase.from("community_orgs").delete().eq("id", id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 grid md:grid-cols-3 gap-2">
        {(["name", "name_bn", "phone", "email", "website", "description", "description_bn"] as const).map((k) => (
          <input key={k} className={ainp} placeholder={k} value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
        ))}
        <button type="button" onClick={add} className="rounded-lg bg-rose-600 text-white text-sm font-semibold md:col-span-3 py-2.5">
          <Plus className="h-4 w-4 inline mr-1" />
          {t("save")}
        </button>
      </div>
      <ul className="space-y-2">
        {rows.map((o) => (
          <li key={o.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3 flex justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">{o.name}</p>
              <p className="text-xs text-slate-400">{o.phone} {o.email}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => toggle(o.id, o.is_active)} className="text-xs text-slate-300">
                {o.is_active ? "ON" : "OFF"}
              </button>
              <button type="button" onClick={() => remove(o.id)} className="text-rose-400">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function NotificationsAdmin() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    else setRows(data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function broadcast() {
    if (!title.trim() || !user) return;
    setBusy(true);
    const { data: profiles, error: pErr } = await supabase.from("profiles").select("id");
    if (pErr) {
      setBusy(false);
      return toast.error(pErr.message);
    }
    const chunk = (profiles ?? []).map((p) => ({
      user_id: p.id,
      actor_id: user.id,
      type: "system" as const,
      title: title.trim(),
      body: body.trim() || null,
      is_read: false,
    }));
    // Insert in batches of 100
    for (let i = 0; i < chunk.length; i += 100) {
      const { error } = await supabase.from("notifications").insert(chunk.slice(i, i + 100));
      if (error) {
        setBusy(false);
        return toast.error(error.message);
      }
    }
    setBusy(false);
    setTitle("");
    setBody("");
    toast.success(lang === "bn" ? "সব ইউজারকে পাঠানো হয়েছে" : "Broadcast sent");
    load();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) toast.error(error.message);
    else setRows((r) => r.filter((x) => x.id !== id));
  }

  async function clearAll() {
    if (!confirm(lang === "bn" ? "সব নোটিফিকেশন ডিলিট?" : "Delete all notifications?")) return;
    const { error } = await supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) toast.error(error.message);
    else {
      setRows([]);
      toast.success("Cleared");
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Bell className="h-4 w-4 text-rose-400" />
          {lang === "bn" ? "সিস্টেম ব্রডকাস্ট" : "System broadcast"}
        </h3>
        <input
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
          placeholder={lang === "bn" ? "শিরোনাম" : "Title"}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm min-h-[80px]"
          placeholder={lang === "bn" ? "বার্তা (ঐচ্ছিক)" : "Message (optional)"}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy || !title.trim()}
            onClick={() => void broadcast()}
            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {busy ? "…" : lang === "bn" ? "সবকে পাঠান" : "Send to all"}
          </button>
          <button
            type="button"
            onClick={() => void clearAll()}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400"
          >
            {lang === "bn" ? "সব মুছুন" : "Clear all"}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-slate-800 text-xs text-slate-400 flex justify-between">
          <span>{lang === "bn" ? "সাম্প্রতিক নোটিফিকেশন" : "Recent notifications"}</span>
          <span>{rows.length}</span>
        </div>
        <ul className="divide-y divide-slate-800 max-h-[28rem] overflow-auto">
          {rows.map((n) => (
            <li key={n.id} className="px-4 py-3 flex items-start gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">
                  <span className="text-rose-400/90 text-[10px] uppercase mr-2">{n.type}</span>
                  {n.title}
                </p>
                {n.body && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>}
                <p className="text-[10px] text-slate-500 mt-1">
                  → {n.user_id.slice(0, 8)}… · {new Date(n.created_at).toLocaleString()}
                  {!n.is_read && <span className="ml-2 text-amber-400">unread</span>}
                </p>
              </div>
              <button type="button" onClick={() => void remove(n.id)} className="text-rose-400 shrink-0">
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-slate-500">No notifications</li>
          )}
        </ul>
      </div>
    </div>
  );
}

function SettingsAdmin() {
  const { t } = useI18n();
  const [s, setS] = useState<any>({
    app_name: "BloodLink",
    emergency_hotline: "",
    about_bn: "",
    about_en: "",
    brand_primary: "#C62828",
    maintenance_mode: false,
  });

  useEffect(() => {
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle().then(({ data }) => data && setS(data));
  }, []);

  async function save() {
    const { error } = await supabase.from("app_settings").upsert({ ...s, id: 1 });
    if (error) toast.error(error.message);
    else toast.success(t("saved"));
  }

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3 max-w-xl">
      {(["app_name", "emergency_hotline", "brand_primary"] as const).map((k) => (
        <div key={k}>
          <label className="text-xs text-slate-400">{k}</label>
          <input className={ainp} value={s[k] ?? ""} onChange={(e) => setS({ ...s, [k]: e.target.value })} />
        </div>
      ))}
      <div>
        <label className="text-xs text-slate-400">about_bn</label>
        <textarea className={ainp} rows={3} value={s.about_bn ?? ""} onChange={(e) => setS({ ...s, about_bn: e.target.value })} />
      </div>
      <div>
        <label className="text-xs text-slate-400">about_en</label>
        <textarea className={ainp} rows={3} value={s.about_en ?? ""} onChange={(e) => setS({ ...s, about_en: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!s.maintenance_mode} onChange={(e) => setS({ ...s, maintenance_mode: e.target.checked })} />
        Maintenance mode
      </label>
      <button type="button" onClick={save} className="rounded-lg bg-rose-600 text-white px-4 py-2.5 text-sm font-semibold">
        {t("save")}
      </button>
    </div>
  );
}

function ArchitectureAdmin() {
  const { t } = useI18n();
  const [md, setMd] = useState(ARCHITECTURE_MARKDOWN);

  useEffect(() => {
    supabase.from("app_settings").select("architecture_md").eq("id", 1).maybeSingle().then(({ data }) => {
      if (data?.architecture_md) setMd(data.architecture_md);
    });
  }, []);

  function downloadPdf() {
    const w = window.open("", "_blank");
    if (!w) return;
    const html = md
      .replace(/^### (.*$)/gim, "<h3>$1</h3>")
      .replace(/^## (.*$)/gim, "<h2>$1</h2>")
      .replace(/^# (.*$)/gim, "<h1>$1</h1>")
      .replace(/^\- (.*$)/gim, "<li>$1</li>")
      .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
      .replace(/\n/g, "<br/>");
    w.document.write(`<!DOCTYPE html><html><head><title>BloodLink Architecture</title>
      <style>body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:20px;line-height:1.6;color:#1a1a1a}
      h1{color:#C62828} h2{margin-top:1.5em;border-bottom:1px solid #ddd;padding-bottom:.3em}
      @media print{button{display:none}}</style></head><body>
      <button onclick="window.print()" style="padding:8px 16px;background:#C62828;color:#fff;border:0;border-radius:8px;cursor:pointer;margin-bottom:20px">Download / Print PDF</button>
      ${html}</body></html>`);
    w.document.close();
  }

  return (
    <div className="space-y-3">
      <button type="button" onClick={downloadPdf} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 text-white px-4 py-2.5 text-sm font-semibold">
        <Download className="h-4 w-4" />
        PDF
      </button>
      <article className="rounded-xl border border-slate-800 bg-slate-900 p-5 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
        {md}
      </article>
    </div>
  );
}

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/40 placeholder:text-slate-500";
