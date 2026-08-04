import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n, ensureCmsSeed } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAllDistrictsAdmin,
  fetchDistrictsAdminPage,
  fetchHospitalsAdminPage,
  type District,
  type Hospital,
} from "@/lib/api";
import {
  bulkImportCommunityDonors,
  fetchCommunityDonorsByOrg,
  parseDonorImportFile,
  updateCommunityDonor,
  type CommunityDonorRow,
  type DonorGender,
  type DonorImportInput,
} from "@/lib/community-donor-import";
import { upazilaDisplayName } from "@/data/bangladesh-clinics";
import { seedUpazilasFromCatalog, fetchUpazilaOptions } from "@/lib/upazilas";
import { seedGeoNeighborsFromCatalog } from "@/lib/geo-neighbors-seed";
import { DistrictUpazilaPanel } from "@/components/admin/DistrictUpazilaPanel";
import { UsersAdmin } from "@/components/admin/UsersAdmin";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import { BLOOD_GROUPS } from "@/lib/format";
import { BANGLADESH_HOSPITALS } from "@/data/bangladesh-hospitals";
import { ARCHITECTURE_MARKDOWN } from "@/lib/architecture-doc";
import {
  DEFAULT_REQUEST_FORM_OPTIONS,
  REQUEST_FORM_OPTION_KEYS,
  type RequestFormOptions,
} from "@/lib/request-form-options";
import {
  DEFAULT_NOTIFICATION_SETTINGS,
  NOTIFICATION_SETTING_KEYS,
  invalidateNotificationSettingsCache,
  type NotificationSettings,
} from "@/lib/notification-settings";
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
  Upload,
  FileSpreadsheet,
  ChevronDown,
  Pencil,
  Moon,
  Sun,
  Flag,
} from "lucide-react";
import { toast } from "sonner";
import { isAdminIdentity } from "@/lib/phone-auth";
import { AdminAccessProvider, useAdminAccess } from "@/lib/admin-access-context";
import { AccessControlAdmin } from "@/components/admin/AccessControlAdmin";
import { UrgencyAnimationAdmin } from "@/components/admin/UrgencyAnimationAdmin";
import { FeedRankingAdmin } from "@/components/admin/FeedRankingAdmin";
import { NeedReasonAdmin } from "@/components/admin/NeedReasonAdmin";
import { MessagingSettingsAdmin } from "@/components/admin/MessagingSettingsAdmin";
import {
  DEFAULT_DONOR_CONTACT_SETTINGS,
  normalizeDonorContactSettings,
  type DonorContactSettings,
  type GenderContactFlags,
} from "@/lib/community-contact-settings";
import { UserMenuAdmin } from "@/components/admin/UserMenuAdmin";
import { FeedCarouselAdmin } from "@/components/admin/FeedCarouselAdmin";
import { FeedBannerAdmin } from "@/components/admin/FeedBannerAdmin";
import { LandingAdmin } from "@/components/admin/LandingAdmin";
import { DonationFlowAdmin } from "@/components/admin/DonationFlowAdmin";
import { GoogleDriveAdmin } from "@/components/admin/GoogleDriveAdmin";
import { ProfileLockAdmin } from "@/components/admin/ProfileLockAdmin";
import { ReportsAdmin } from "@/components/admin/ReportsAdmin";
import type { AdminModule } from "@/lib/admin-permissions";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — BloodLink" }] }),
  component: AdminPage,
});

type Tab =
  | "overview"
  | "users"
  | "requests"
  | "reports"
  | "districts"
  | "hospitals"
  | "cms"
  | "community"
  | "notifications"
  | "settings"
  | "architecture"
  | "access";

function AdminPage() {
  return (
    <AdminAccessProvider>
      <AdminPageInner />
    </AdminAccessProvider>
  );
}

function AdminPageInner() {
  const { user, loading, isAdmin, signOut, refreshAdmin } = useAuth();
  const { loading: aclLoading, isStaff, isSuper, can, canModule } = useAdminAccess();
  const navigate = useNavigate();
  const { t, lang, reloadCms } = useI18n();
  const [tab, setTab] = useState<Tab>("overview");
  const [ready, setReady] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    // Admin-only preference — default dark. Never touches user app `theme` / html.dark.
    const stored = typeof window !== "undefined" ? window.localStorage.getItem("admin-theme") : null;
    const next = stored !== "light";
    setDark(next);
    if (typeof window !== "undefined" && !stored) {
      window.localStorage.setItem("admin-theme", "dark");
    }
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    window.localStorage.setItem("admin-theme", next ? "dark" : "light");
  }

  useEffect(() => {
    void refreshAdmin();
  }, [refreshAdmin]);

  useEffect(() => {
    if (loading || aclLoading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    const timer = setTimeout(() => {
      if (!isStaff && !isAdmin && !isAdminIdentity(user.email)) {
        navigate({ to: "/home" });
      } else {
        setReady(true);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [loading, aclLoading, user, isStaff, isAdmin, navigate]);

  useEffect(() => {
    if (!ready) return;
    if (!canModule(tab as AdminModule) && tab !== "overview") {
      const first = (
        [
          "overview",
          "users",
          "requests",
          "reports",
          "districts",
          "hospitals",
          "cms",
          "community",
          "notifications",
          "settings",
          "architecture",
          "access",
        ] as Tab[]
      ).find((id) => canModule(id as AdminModule));
      if (first) setTab(first);
    }
  }, [ready, tab, canModule]);

  if (loading || aclLoading || !user || !ready) {
    return (
      <div className="min-h-dvh grid place-items-center bg-slate-950 text-slate-200">
        <div className="text-center space-y-3">
          <div className="h-8 w-8 mx-auto rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
          <p className="text-xs text-slate-400">{t("loading")}</p>
        </div>
      </div>
    );
  }

  const allTabs: { id: Tab; label: string; icon: typeof LayoutDashboard; module: AdminModule }[] = [
    { id: "overview", label: t("overview"), icon: LayoutDashboard, module: "overview" },
    { id: "users", label: t("users"), icon: Users, module: "users" },
    { id: "requests", label: t("manageRequests"), icon: HeartPulse, module: "requests" },
    {
      id: "reports",
      label: lang === "bn" ? "রিপোর্ট" : "Reports",
      icon: Flag,
      module: "reports",
    },
    { id: "districts", label: t("district"), icon: MapPinned, module: "districts" },
    { id: "hospitals", label: t("hospitals"), icon: HospitalIcon, module: "hospitals" },
    { id: "cms", label: t("cms"), icon: Type, module: "cms" },
    { id: "community", label: t("community"), icon: Building2, module: "community" },
    { id: "notifications", label: t("notifications"), icon: Bell, module: "notifications" },
    { id: "settings", label: t("settings"), icon: Settings2, module: "settings" },
    { id: "architecture", label: t("architecture"), icon: FileText, module: "architecture" },
    {
      id: "access",
      label: lang === "bn" ? "অ্যাক্সেস" : "Access",
      icon: Shield,
      module: "access",
    },
  ];
  const tabs = allTabs.filter((item) => canModule(item.module) || (item.id === "access" && can("access.view")));

  return (
    <div
      className={`admin-app h-dvh flex flex-col sm:flex-row overflow-hidden ${
        dark ? "admin-dark bg-[#0b1220] text-slate-100" : "admin-light bg-slate-100 text-slate-900"
      }`}
    >
      <aside
        className={`shrink-0 w-full sm:w-64 border-b sm:border-b-0 sm:border-r flex flex-col sm:h-full z-30 sm:shadow-none backdrop-blur-sm ${
          dark
            ? "border-white/5 bg-slate-900/80"
            : "border-slate-200/80 bg-white shadow-[0_1px_0_rgb(15_23_42/0.04)]"
        }`}
      >
        <div
          className={`px-3 sm:px-4 py-3 border-b flex items-center gap-2.5 shrink-0 safe-top ${
            dark ? "border-slate-800" : "border-slate-200"
          }`}
        >
          <div className="h-9 w-9 rounded-lg bg-rose-600 grid place-items-center shrink-0">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-sm font-bold truncate ${dark ? "text-slate-100" : "text-slate-900"}`}>
              {t("adminPanel")}
            </p>
            <p className={`text-[10px] truncate ${dark ? "text-slate-400" : "text-slate-500"}`}>
              {isSuper ? "Super Admin" : user.email}
            </p>
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              title={dark ? t("darkMode") : "Light"}
              className={`h-8 w-8 rounded-lg grid place-items-center ${
                dark
                  ? "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <div className="flex sm:hidden items-center gap-1">
              <Link
                to="/home"
                className={`text-[10px] px-2 py-1 rounded-md ${
                  dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {t("openApp")}
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className={`text-[10px] px-2 py-1 rounded-md ${
                  dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {t("logout")}
              </button>
            </div>
          </div>
        </div>
        <nav className="flex sm:flex-col gap-1 p-2 overflow-x-auto no-scrollbar sm:overflow-y-auto sm:flex-1 sm:min-h-0 shrink-0">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`shrink-0 sm:w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left text-[11px] sm:text-sm font-medium transition ${
                  active
                    ? "bg-rose-600 text-white shadow-sm shadow-rose-600/25"
                    : dark
                      ? "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap">{item.label}</span>
              </button>
            );
          })}
        </nav>
        <div
          className={`hidden sm:block p-3 border-t space-y-1 shrink-0 ${
            dark ? "border-slate-800" : "border-slate-200"
          }`}
        >
          <button
            type="button"
            onClick={toggleTheme}
            className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            {dark ? (lang === "bn" ? "লাইট মোড" : "Light mode") : t("darkMode")}
          </button>
          <Link
            to="/home"
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <ExternalLink className="h-4 w-4" />
            {t("openApp")}
          </Link>
          <button
            type="button"
            onClick={() => signOut()}
            className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
              dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <LogOut className="h-4 w-4" />
            {t("logout")}
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden">
        <header
          className={`shrink-0 z-20 border-b backdrop-blur-md px-3 sm:px-6 py-2.5 sm:py-3 ${
            dark ? "border-white/5 bg-[#0b1220]/90" : "border-slate-200/80 bg-white/80"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <h1
              className={`text-sm sm:text-base font-semibold truncate ${
                dark ? "text-slate-100" : "text-slate-900"
              }`}
            >
              {tabs.find((x) => x.id === tab)?.label}
            </h1>
            <button
              type="button"
              onClick={toggleTheme}
              className={`sm:hidden h-8 w-8 rounded-lg grid place-items-center ${
                dark ? "text-slate-400 hover:bg-slate-800" : "text-slate-500 hover:bg-slate-100"
              }`}
              title={dark ? t("darkMode") : "Light"}
            >
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>
        <main className="flex-1 p-3 sm:p-6 overflow-y-auto overflow-x-hidden min-h-0 safe-bottom overscroll-contain">
          <div className="max-w-6xl mx-auto w-full min-w-0">
            {!isAdmin && isAdminIdentity(user.email) && (
              <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                Admin account detected — granting role…
                <GrantSelfAdmin onDone={refreshAdmin} />
              </div>
            )}
            {tab === "overview" && can("overview.view") && <Overview />}
            {tab === "users" && can("users.view") && <UsersAdmin />}
            {tab === "requests" && can("requests.view") && <RequestsAdmin />}
            {tab === "reports" && can("reports.view") && <ReportsAdmin />}
            {tab === "districts" && can("districts.view") && <DistrictsAdmin />}
            {tab === "hospitals" && can("hospitals.view") && <HospitalsAdmin />}
            {tab === "cms" && can("cms.view") && <CmsAdmin onSaved={reloadCms} />}
            {tab === "community" && can("community.view") && <CommunityAdmin />}
            {tab === "notifications" && can("notifications.view") && <NotificationsAdmin />}
            {tab === "settings" && can("settings.view") && <SettingsAdmin />}
            {tab === "architecture" && can("architecture.view") && <ArchitectureAdmin />}
            {tab === "access" && can("access.view") && <AccessControlAdmin />}
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
    void (async () => {
      await supabase.from("user_roles").upsert({ user_id: user.id, role: "admin" });
      const { data: sa } = await supabase.from("admin_roles").select("id").eq("slug", "super-admin").maybeSingle();
      if (sa?.id) {
        await supabase.from("admin_user_roles").upsert({ user_id: user.id, role_id: sa.id });
      }
      await onDone();
    })();
  }, [user, onDone]);
  return null;
}

function Overview() {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState({
    users: 0,
    blocked: 0,
    available: 0,
    requests: 0,
    open: 0,
    fulfilled: 0,
    donors: 0,
    recipients: 0,
    orgs: 0,
    districts: 0,
    upazilas: 0,
    hospitals: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [
        users,
        blocked,
        available,
        requests,
        open,
        fulfilled,
        orgs,
        districts,
        hospitals,
        upazilas,
        donorRows,
        recipientRows,
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_blocked", true),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("is_available", true),
        supabase.from("blood_requests").select("id", { count: "exact", head: true }),
        supabase.from("blood_requests").select("id", { count: "exact", head: true }).eq("status", "open"),
        supabase.from("blood_requests").select("id", { count: "exact", head: true }).eq("status", "fulfilled"),
        supabase.from("community_orgs").select("id", { count: "exact", head: true }),
        supabase.from("districts").select("id", { count: "exact", head: true }),
        supabase.from("hospitals").select("id", { count: "exact", head: true }),
        supabase.from("upazilas").select("id", { count: "exact", head: true }),
        supabase.from("request_donation_offers").select("donor_id").eq("status", "confirmed").limit(5000),
        supabase.from("blood_requests").select("requester_id").eq("status", "fulfilled").limit(5000),
      ]);

      if (cancelled) return;

      const donorSet = new Set(
        (donorRows.data ?? []).map((r) => r.donor_id as string).filter(Boolean),
      );
      const recipientSet = new Set(
        (recipientRows.data ?? []).map((r) => r.requester_id as string).filter(Boolean),
      );

      setStats({
        users: users.count ?? 0,
        blocked: blocked.error ? 0 : (blocked.count ?? 0),
        available: available.count ?? 0,
        requests: requests.count ?? 0,
        open: open.count ?? 0,
        fulfilled: fulfilled.count ?? 0,
        donors: donorSet.size,
        recipients: recipientSet.size,
        orgs: orgs.count ?? 0,
        districts: districts.count ?? 0,
        upazilas: upazilas.error ? 0 : (upazilas.count ?? 0),
        hospitals: hospitals.count ?? 0,
      });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const cards = [
    { label: lang === "bn" ? "ইউজার" : "Users", value: stats.users },
    { label: lang === "bn" ? "ব্লকড" : "Blocked", value: stats.blocked },
    { label: lang === "bn" ? "উপলব্ধ ডোনার" : "Available", value: stats.available },
    { label: lang === "bn" ? "ডোনার" : "Donors", value: stats.donors },
    { label: lang === "bn" ? "রেসিপিয়েন্ট" : "Recipients", value: stats.recipients },
    { label: lang === "bn" ? "রিকোয়েস্ট" : "Requests", value: stats.requests },
    { label: lang === "bn" ? "ওপেন" : "Open", value: stats.open },
    { label: lang === "bn" ? "সম্পন্ন" : "Fulfilled", value: stats.fulfilled },
    { label: lang === "bn" ? "জেলা" : "Districts", value: stats.districts },
    { label: lang === "bn" ? "উপজেলা" : "Upazilas", value: stats.upazilas },
    { label: lang === "bn" ? "হাসপাতাল" : "Hospitals", value: stats.hospitals },
    { label: lang === "bn" ? "কমিউনিটি" : "Community", value: stats.orgs },
  ];

  return (
    <div className="space-y-3">
      {loading && (
        <p className="text-xs text-slate-500">{t("loading")}</p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-400">{c.label}</p>
            <p className="text-2xl font-bold mt-1 text-white tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function RequestsAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAdminAccess();
  const [rows, setRows] = useState<any[]>([]);

  async function load() {
    const { data } = await supabase
      .from("blood_requests")
      .select(
        "id, patient_name, blood_group, hospital_name, status, urgency, created_at, city, area, notes, contact_phone, need_reason_label",
      )
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
    if (!can("requests.edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const { error } = await supabase.from("blood_requests").update({ status }).eq("id", id);
    if (error) toast.error(error.message);
    else load();
  }

  async function remove(id: string) {
    if (!can("requests.delete")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
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
              {typeof r.notes === "string" && r.notes.includes("[Community") && (
                <span className="ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300">
                  Community
                </span>
              )}
            </p>
            <p className="text-xs text-slate-400 truncate">
              {r.hospital_name} · {[r.area, r.city].filter(Boolean).join(", ")} · {r.status} · {r.urgency}
            </p>
            {(r.need_reason_label || r.contact_phone || r.notes) && (
              <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">
                {[r.need_reason_label, r.contact_phone, r.notes].filter(Boolean).join(" · ")}
              </p>
            )}
            <p className="text-[10px] text-slate-600 mt-0.5">
              {r.created_at ? new Date(r.created_at).toLocaleString() : ""}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {can("requests.edit") && (
              <>
                <button type="button" onClick={() => setStatus(r.id, "fulfilled")} className="p-2 rounded-lg bg-emerald-500/15 text-emerald-300" title="Fulfilled">
                  <CheckCircle2 className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setStatus(r.id, "cancelled")} className="p-2 rounded-lg bg-amber-500/15 text-amber-300" title="Cancel">
                  <Ban className="h-4 w-4" />
                </button>
              </>
            )}
            {can("requests.delete") && (
              <button type="button" onClick={() => remove(r.id)} className="p-2 rounded-lg bg-rose-500/15 text-rose-300" title="Delete">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-slate-400">{t("emptyRequests")}</p>}
    </div>
  );
}

function DistrictsAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAdminAccess();
  const [rows, setRows] = useState<District[]>([]);
  const [form, setForm] = useState({ name_bn: "", name_en: "", slug: "" });
  const [expandedDistrictId, setExpandedDistrictId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [upazilaSeedVersion, setUpazilaSeedVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const PAGE = 20;

  const loadPage = useCallback(async (reset: boolean) => {
    if (reset) {
      setLoading(true);
      setHasMore(true);
    } else setLoadingMore(true);
    try {
      const offset = reset ? 0 : rowsRef.current.length;
      const { items, hasMore: more } = await fetchDistrictsAdminPage({ offset, limit: PAGE });
      setRows((prev) => (reset ? items : [...prev, ...items.filter((d) => !prev.some((p) => p.id === d.id))]));
      setHasMore(more);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    void loadPage(false).catch((e) => toast.error(e.message));
  }, [hasMore, loadPage, loading, loadingMore]);

  const sentinelRef = useInfiniteScroll(loadMore, { enabled: hasMore && !loading });

  useEffect(() => {
    void loadPage(true)
      .then(async () => {
        if (!can("districts.add")) return;
        try {
          const { count } = await supabase.from("upazilas").select("id", { count: "exact", head: true });
          if ((count ?? 0) === 0) {
            const all = await fetchAllDistrictsAdmin();
            if (!all.length) return;
            await seedUpazilasFromCatalog(all);
            try {
              await seedGeoNeighborsFromCatalog();
            } catch {
              /* proximity tables may not exist yet */
            }
            setUpazilaSeedVersion((v) => v + 1);
          }
        } catch {
          /* table may not exist yet */
        }
      })
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function add() {
    if (!can("districts.add")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const slug = form.slug || form.name_en.toLowerCase().replace(/\s+/g, "-");
    const { error } = await supabase.from("districts").insert({
      name_bn: form.name_bn,
      name_en: form.name_en,
      slug,
      sort_order: rows.length + 1,
    });
    if (error) return toast.error(error.message);
    setForm({ name_bn: "", name_en: "", slug: "" });
    void loadPage(true);
  }

  async function toggle(d: District) {
    if (!can("districts.toggle")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    await supabase.from("districts").update({ is_active: !d.is_active }).eq("id", d.id);
    setRows((prev) => prev.map((x) => (x.id === d.id ? { ...x, is_active: !d.is_active } : x)));
  }

  async function remove(id: string) {
    if (!can("districts.delete")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!confirm("Delete?")) return;
    await supabase.from("districts").delete().eq("id", id);
    if (expandedDistrictId === id) setExpandedDistrictId(null);
    setRows((prev) => prev.filter((x) => x.id !== id));
  }

  async function seedCatalog() {
    if (!can("districts.add")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    setSeeding(true);
    try {
      const all = await fetchAllDistrictsAdmin();
      const result = await seedUpazilasFromCatalog(all);
      let neighborMsg = "";
      try {
        const geo = await seedGeoNeighborsFromCatalog();
        neighborMsg =
          lang === "bn"
            ? ` · proximity: ${geo.districts} জেলা + ${geo.upazilas} উপজেলা এজ`
            : ` · proximity: ${geo.districts} district + ${geo.upazilas} upazila edges`;
      } catch (geoErr) {
        neighborMsg =
          lang === "bn"
            ? ` · proximity সিড স্কিপ (scripts/feed-proximity-ranking.sql চালান?)`
            : ` · proximity seed skipped (run scripts/feed-proximity-ranking.sql?)`;
        console.warn(geoErr);
      }
      toast.success(
        lang === "bn"
          ? `${result.total}টি উপজেলা — ${result.inserted}টি যোগ/আপডেট${neighborMsg}`
          : `${result.total} catalog upazilas — ${result.inserted} synced${neighborMsg}`,
      );
      setUpazilaSeedVersion((v) => v + 1);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {can("districts.add") && (
          <button
            type="button"
            disabled={seeding || rows.length === 0}
            onClick={seedCatalog}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            {seeding
              ? lang === "bn"
                ? "সিড হচ্ছে…"
                : "Seeding…"
              : lang === "bn"
                ? "ক্যাটালগ থেকে উপজেলা সিড"
                : "Seed upazilas from catalog"}
          </button>
        )}
        <p className="text-[11px] text-slate-500">
          {lang === "bn"
            ? "জেলার ▼ ক্লিক করলে আগের ক্যাটালগ উপজেলা + নতুন যোগ করা উপজেলা দেখা যাবে"
            : "Click ▼ on a district — bundled catalog upazilas plus any you add are all kept"}
        </p>
      </div>

      {can("districts.add") && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
          <input className={ainp} placeholder="Name (BN)" value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} />
          <input className={ainp} placeholder="Name (EN)" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
          <input className={ainp} placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
          <button type="button" onClick={add} className="rounded-lg bg-rose-600 text-white text-sm font-semibold flex items-center justify-center gap-1">
            <Plus className="h-4 w-4" /> {t("save")}
          </button>
        </div>
      )}
      <div className="rounded-xl border border-slate-800 bg-slate-900 admin-table-scroll">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-xs text-slate-400">
            <tr>
              <th className="text-left p-3 w-8" />
              <th className="text-left p-3">BN</th>
              <th className="text-left p-3">EN</th>
              <th className="text-left p-3">Active</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-slate-400 text-sm">
                  {t("loading")}
                </td>
              </tr>
            )}
            {rows.map((d) => (
              <Fragment key={d.id}>
                <tr className="border-t border-slate-800">
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setExpandedDistrictId(expandedDistrictId === d.id ? null : d.id)}
                      className="p-1 rounded-md hover:bg-slate-800 text-slate-400"
                      title={lang === "bn" ? "উপজেলা দেখুন" : "Show upazilas"}
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition ${expandedDistrictId === d.id ? "rotate-180" : ""}`}
                      />
                    </button>
                  </td>
                  <td className="p-3">{d.name_bn}</td>
                  <td className="p-3">{d.name_en}</td>
                  <td className="p-3">
                    {can("districts.toggle") ? (
                      <button type="button" onClick={() => toggle(d)} className={`text-xs font-semibold px-2 py-1 rounded-md ${d.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800"}`}>
                        {d.is_active ? "ON" : "OFF"}
                      </button>
                    ) : (
                      <span className="text-xs">{d.is_active ? "ON" : "OFF"}</span>
                    )}
                  </td>
                  <td className="p-3 text-right">
                    {can("districts.delete") && (
                      <button type="button" onClick={() => remove(d.id)} className="text-rose-400 p-1">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
                {expandedDistrictId === d.id && (
                  <tr className="border-t border-slate-800">
                    <td colSpan={5} className="p-0">
                      <DistrictUpazilaPanel key={`${d.id}-${upazilaSeedVersion}`} district={d} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        <InfiniteSentinel
          sentinelRef={sentinelRef}
          loading={loadingMore}
          hasMore={hasMore}
          label={lang === "bn" ? "আরও জেলা…" : "More districts…"}
        />
      </div>
    </div>
  );
}

function HospitalsAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAdminAccess();
  const [rows, setRows] = useState<Hospital[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [q, setQ] = useState("");
  const [dbReady, setDbReady] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalHint, setTotalHint] = useState(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const qRef = useRef(q);
  qRef.current = q;
  const PAGE = 25;
  const [form, setForm] = useState({
    name_bn: "",
    name_en: "",
    slug: "",
    district_id: "",
    upazila: "",
    hospital_type: "government" as "government" | "private" | "clinic" | "diagnostic",
  });

  const loadPage = useCallback(async (reset: boolean, search = qRef.current) => {
    if (reset) {
      setLoading(true);
      setHasMore(true);
    } else setLoadingMore(true);
    try {
      const offset = reset ? 0 : rowsRef.current.length;
      const { items, hasMore: more } = await fetchHospitalsAdminPage({
        offset,
        limit: PAGE,
        q: search,
      });
      setRows((prev) =>
        reset ? items : [...prev, ...items.filter((h) => !prev.some((p) => p.id === h.id))],
      );
      setHasMore(more);
      if (reset) setTotalHint(items.length + (more ? PAGE : 0));
      else setTotalHint((n) => Math.max(n, rowsRef.current.length + items.length));
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !hasMore) return;
    void loadPage(false).catch((e) => toast.error(e.message));
  }, [hasMore, loadPage, loading, loadingMore]);

  const sentinelRef = useInfiniteScroll(loadMore, { enabled: hasMore && !loading });

  useEffect(() => {
    void (async () => {
      try {
        const [{ error }, d] = await Promise.all([
          supabase.from("hospitals").select("id").limit(1),
          fetchAllDistrictsAdmin(),
        ]);
        setDbReady(!error);
        setDistricts(d);
        await loadPage(true, "");
      } catch (e) {
        setDbReady(false);
        toast.error((e as Error).message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchBoot = useRef(true);
  useEffect(() => {
    if (searchBoot.current) {
      searchBoot.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      void loadPage(true, q).catch((e) => toast.error(e.message));
    }, 220);
    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function seedAll() {
    if (!can("hospitals.seed")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
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
      const allDistricts = districts.length ? districts : await fetchAllDistrictsAdmin();
      const bySlug = new Map(allDistricts.map((d) => [d.slug, d.id]));
      const payload = BANGLADESH_HOSPITALS.map((h, i) => ({
        name_bn: h.name_bn,
        name_en: h.name_en,
        slug: h.slug,
        district_id: bySlug.get(h.districtSlug)!,
        hospital_type: h.type,
        upazila: h.upazila ?? null,
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
      setQ("");
      await loadPage(true, "");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSeeding(false);
    }
  }

  async function add() {
    if (!can("hospitals.add")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!form.district_id || !form.name_en) return toast.error("District + EN name required");
    const slug = form.slug || form.name_en.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const { error } = await supabase.from("hospitals").insert({
      name_bn: form.name_bn || form.name_en,
      name_en: form.name_en,
      slug,
      district_id: form.district_id,
      hospital_type: form.hospital_type,
      upazila: form.upazila.trim() || null,
    });
    if (error) return toast.error(error.message);
    setForm({
      name_bn: "",
      name_en: "",
      slug: "",
      district_id: form.district_id,
      upazila: form.upazila,
      hospital_type: "government",
    });
    void loadPage(true, q);
  }

  async function toggle(h: Hospital) {
    if (!can("hospitals.toggle")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (h.id.startsWith("seed:")) return;
    await supabase.from("hospitals").update({ is_active: !h.is_active }).eq("id", h.id);
    setRows((prev) => prev.map((x) => (x.id === h.id ? { ...x, is_active: !h.is_active } : x)));
  }

  async function remove(id: string) {
    if (!can("hospitals.delete")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (id.startsWith("seed:")) return;
    if (!confirm("Delete hospital?")) return;
    await supabase.from("hospitals").delete().eq("id", id);
    setRows((prev) => prev.filter((x) => x.id !== id));
  }

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

      <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center sm:justify-between">
        <input className={`${ainp} w-full sm:max-w-xs`} placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          type="button"
          disabled={seeding}
          onClick={seedAll}
          className="rounded-lg bg-rose-600 text-white px-3 py-2 text-xs font-semibold disabled:opacity-50"
        >
          {seeding ? t("saving") : `Seed all (${BANGLADESH_HOSPITALS.length})`}
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
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
        <input
          className={ainp}
          placeholder={lang === "bn" ? "উপজেলা (EN) যেমন: Kishoreganj Sadar" : "Upazila (EN) e.g. Kishoreganj Sadar"}
          value={form.upazila}
          onChange={(e) => setForm({ ...form, upazila: e.target.value })}
        />
        <input className={ainp} placeholder="Name EN" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
        <input className={ainp} placeholder="Name BN" value={form.name_bn} onChange={(e) => setForm({ ...form, name_bn: e.target.value })} />
        <button type="button" onClick={add} className="rounded-lg bg-rose-600 text-white text-sm font-semibold flex items-center justify-center gap-1">
          <Plus className="h-4 w-4" /> {t("save")}
        </button>
      </div>

      <p className="text-xs text-slate-400">
        Showing {rows.length}
        {hasMore ? "+" : ""}
        {totalHint > rows.length ? ` · ~${totalHint}+` : ""}
      </p>

      <div className="rounded-xl border border-slate-800 bg-slate-900 admin-table-scroll max-h-[60vh]">
        <table className="w-full text-sm">
          <thead className="bg-slate-800/60 text-xs text-slate-400 sticky top-0">
            <tr>
              <th className="text-left p-3">Hospital</th>
              <th className="text-left p-3">District</th>
              <th className="text-left p-3">Upazila</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Active</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400 text-sm">
                  {t("loading")}
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-6 text-center text-slate-400 text-sm">
                  {lang === "bn" ? "কোনো হাসপাতাল নেই" : "No hospitals"}
                </td>
              </tr>
            )}
            {rows.map((h) => (
              <tr key={h.id} className="border-t border-slate-800">
                <td className="p-3">
                  <p className="font-medium">{lang === "bn" ? h.name_bn : h.name_en}</p>
                  <p className="text-[10px] text-slate-500">{lang === "bn" ? h.name_en : h.name_bn}</p>
                </td>
                <td className="p-3 text-xs">{h.district_slug ?? "—"}</td>
                <td className="p-3 text-xs">{h.upazila ?? "—"}</td>
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
        <InfiniteSentinel
          sentinelRef={sentinelRef}
          loading={loadingMore}
          hasMore={hasMore}
          label={lang === "bn" ? "আরও হাসপাতাল…" : "More hospitals…"}
        />
      </div>
    </div>
  );
}

function CmsAdmin({ onSaved }: { onSaved: () => Promise<void> }) {
  const { t, lang } = useI18n();
  const { can } = useAdminAccess();
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
    if (!can("cms.seed")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    await ensureCmsSeed(async (seedRows) => {
      const { error } = await supabase.from("cms_strings").upsert(seedRows);
      if (error) throw error;
    });
    toast.success(t("saved"));
    await load();
    await onSaved();
  }

  async function save(row: (typeof rows)[0]) {
    if (!can("cms.edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
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
      <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center sm:justify-between">
        <input
          className={`${ainp} w-full sm:max-w-xs`}
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
        <div key={r.key} className="rounded-xl border border-slate-800 bg-slate-900 p-3 grid grid-cols-1 lg:grid-cols-[180px_1fr_1fr_auto] gap-2 items-start">
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

type CommunityOrg = {
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
};

const emptyOrgForm = () => ({
  name: "",
  name_bn: "",
  phone: "",
  email: "",
  website: "",
  description: "",
  description_bn: "",
});

function OrgEditForm({
  org,
  lang,
  t,
  onSave,
  onCancel,
}: {
  org: CommunityOrg;
  lang: "bn" | "en";
  t: (k: string) => string;
  onSave: (patch: ReturnType<typeof emptyOrgForm>) => Promise<void>;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState({
    name: org.name,
    name_bn: org.name_bn ?? "",
    phone: org.phone,
    email: org.email ?? "",
    website: org.website ?? "",
    description: org.description ?? "",
    description_bn: org.description_bn ?? "",
  });
  const [busy, setBusy] = useState(false);

  const optionalFields = [
    { key: "name_bn" as const, label: lang === "bn" ? "নাম (বাংলা)" : "Name (BN)" },
    { key: "email" as const, label: "Email" },
    { key: "website" as const, label: "Website" },
    { key: "description" as const, label: lang === "bn" ? "বিবরণ" : "Description" },
    { key: "description_bn" as const, label: lang === "bn" ? "বিবরণ (বাংলা)" : "Description (BN)" },
  ];

  return (
    <div className="space-y-2 border-t border-slate-800 pt-3 mt-1">
      <p className="text-xs font-semibold text-rose-400">{lang === "bn" ? "সংস্থা সম্পাদনা" : "Edit organization"}</p>
      <div className="grid md:grid-cols-2 gap-2">
        <input className={ainp} placeholder={lang === "bn" ? "নাম *" : "Name *"} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <input className={ainp} placeholder={lang === "bn" ? "ফোন *" : "Phone *"} value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
        {optionalFields.map((f) => (
          <input key={f.key} className={ainp} placeholder={f.label} value={draft[f.key]} onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })} />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onSave(draft).finally(() => setBusy(false));
          }}
          className="rounded-lg bg-rose-600 text-white text-xs font-semibold px-3 py-2 disabled:opacity-50"
        >
          {busy ? "…" : t("save")}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-700 text-xs px-3 py-2 text-slate-400">
          {lang === "bn" ? "বাতিল" : "Cancel"}
        </button>
      </div>
    </div>
  );
}

function OrgContactSettingsPanel({
  orgId,
  initial,
  lang,
  onSaved,
}: {
  orgId: string;
  initial: unknown;
  lang: "bn" | "en";
  onSaved: () => void;
}) {
  const { can } = useAdminAccess();
  const [settings, setSettings] = useState(() =>
    normalizeDonorContactSettings(initial ?? DEFAULT_DONOR_CONTACT_SETTINGS),
  );
  const [viewerTab, setViewerTab] = useState<"male" | "female">("male");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setSettings(normalizeDonorContactSettings(initial ?? DEFAULT_DONOR_CONTACT_SETTINGS));
  }, [orgId, initial]);

  function setFlag(
    donor: "male" | "female",
    key: keyof GenderContactFlags,
    value: boolean,
  ) {
    setSettings((prev) => ({
      ...prev,
      [viewerTab]: {
        ...prev[viewerTab],
        [donor]: { ...prev[viewerTab][donor], [key]: value },
      },
    }));
  }

  async function save() {
    if (!can("community.edit") && !can("community.donors_edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    setBusy(true);
    const { error } = await supabase
      .from("community_orgs")
      .update({ donor_contact_settings: settings })
      .eq("id", orgId);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "কন্টাক্ট সেটিংস সেভ" : "Contact settings saved");
    onSaved();
  }

  const iconLabels: Record<keyof GenderContactFlags, string> = {
    call: "Call icon",
    sms: "Send SMS / message",
    chat: "Chat (WhatsApp)",
  };

  return (
    <div className="border-t border-slate-800 mt-3 pt-3 space-y-3">
      <p className="text-xs font-semibold text-slate-400">
        {lang === "bn" ? "ডোনার কন্টাক্ট আইকন" : "Donor contact icons"}
      </p>
      <p className="text-[10px] text-slate-500 leading-relaxed">
        {lang === "bn"
          ? "লগইন ইউজার (Male/Female) কোন ডোনার (Male/Female) দেখলে কোন আইকন পাবে। ডিফল্ট: Female ডোনার — শুধু Chat; Male ডোনার — সব।"
          : "For each logged-in viewer gender, choose which icons they see on male vs female donors. Defaults: female donors — chat only; male donors — all."}
      </p>

      <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-slate-800 bg-slate-950 p-1">
        {(["male", "female"] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setViewerTab(v)}
            className={`rounded-lg px-2 py-2.5 text-[11px] font-semibold leading-snug transition ${
              viewerTab === v
                ? "bg-rose-600 text-white shadow"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            {v === "male"
              ? lang === "bn"
                ? "When logged-in user is Male"
                : "When logged-in user is Male"
              : lang === "bn"
                ? "When logged-in user is Female"
                : "When logged-in user is Female"}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-3">
        {(["male", "female"] as const).map((donor) => (
          <div key={donor} className="rounded-lg border border-slate-800 bg-slate-900/80 p-2.5 space-y-1.5">
            <p className="text-[11px] font-medium text-slate-300">
              {donor === "male"
                ? lang === "bn"
                  ? "Male ডোনারদের ওপর"
                  : "On Male donors"
                : lang === "bn"
                  ? "Female ডোনারদের ওপর"
                  : "On Female donors"}
            </p>
            {(Object.keys(iconLabels) as (keyof GenderContactFlags)[]).map((key) => (
              <label
                key={key}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-[11px] text-slate-400 hover:bg-slate-950/50 cursor-pointer"
              >
                <span>{iconLabels[key]}</span>
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-rose-500"
                  checked={settings[viewerTab][donor][key]}
                  onChange={(e) => setFlag(donor, key, e.target.checked)}
                />
              </label>
            ))}
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="rounded-lg bg-rose-600 text-white text-xs font-semibold px-3 py-2 disabled:opacity-50"
      >
        {busy ? "…" : lang === "bn" ? "কন্টাক্ট সেটিংস সেভ" : "Save contact settings"}
      </button>
    </div>
  );
}

function OrgDonorsPanel({
  orgId,
  districts,
  lang,
  refreshKey,
}: {
  orgId: string;
  districts: District[];
  lang: "bn" | "en";
  refreshKey: number;
}) {
  const { can } = useAdminAccess();
  const [donors, setDonors] = useState<CommunityDonorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    blood_group: "",
    gender: "" as "" | DonorGender,
    district_id: "",
    upazila: "",
    address: "",
    is_active: true,
  });
  const [busy, setBusy] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setDonors(await fetchCommunityDonorsByOrg(orgId));
    } catch (e) {
      toast.error((e as Error).message);
      setDonors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, refreshKey]);

  function startEdit(d: CommunityDonorRow) {
    setEditingId(d.id);
    setEditForm({
      full_name: d.full_name,
      phone: d.phone,
      blood_group: d.blood_group ?? "",
      gender: (d.gender === "male" || d.gender === "female" ? d.gender : "") as "" | DonorGender,
      district_id: d.district_id ?? "",
      upazila: d.upazila ?? "",
      address: d.address ?? "",
      is_active: d.is_active,
    });
  }

  async function saveEdit() {
    if (!can("community.donors_edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!editingId || !editForm.full_name.trim() || !editForm.phone.trim()) {
      return toast.error(lang === "bn" ? "নাম ও ফোন বাধ্যতামূলক" : "Name and phone required");
    }
    setBusy(true);
    try {
      await updateCommunityDonor(
        editingId,
        {
          full_name: editForm.full_name,
          phone: editForm.phone,
          blood_group: editForm.blood_group || null,
          gender: editForm.gender || null,
          district_id: editForm.district_id || null,
          upazila: editForm.upazila || null,
          address: editForm.address || null,
          is_active: editForm.is_active,
        },
        districts,
      );
      toast.success(lang === "bn" ? "সেভ হয়েছে" : "Saved");
      setEditingId(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeDonor(id: string) {
    if (!can("community.donors_delete")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!confirm(lang === "bn" ? "এই রক্তদাতা ডিলিট করবেন?" : "Delete this donor?")) return;
    const { error } = await supabase.from("community_donors").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "bn" ? "ডিলিট হয়েছে" : "Deleted");
      await load();
    }
  }

  const editDistrict = districts.find((d) => d.id === editForm.district_id);
  const [upazilaOptions, setUpazilaOptions] = useState<{ en: string; bn: string }[]>([]);

  useEffect(() => {
    if (!editDistrict) {
      setUpazilaOptions([]);
      return;
    }
    let cancelled = false;
    fetchUpazilaOptions(editDistrict)
      .then((list) => {
        if (!cancelled) setUpazilaOptions(list);
      })
      .catch(() => {
        if (!cancelled) setUpazilaOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editDistrict?.id, editDistrict?.slug]);

  return (
    <div className="border-t border-slate-800 mt-3 pt-3 space-y-2">
      <p className="text-xs font-semibold text-slate-400 flex items-center justify-between">
        <span>{lang === "bn" ? "রক্তদাতা তালিকা" : "Blood donors"}</span>
        <span className="text-[10px]">{donors.length}</span>
      </p>
      {loading && <p className="text-xs text-slate-500 py-4 text-center">{lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}</p>}
      {!loading && donors.length === 0 && (
        <p className="text-xs text-slate-500 py-4 text-center">{lang === "bn" ? "কোনো রক্তদাতা নেই" : "No donors yet"}</p>
      )}
      {!loading && donors.length > 0 && (
        <div className="rounded-lg border border-slate-800 admin-table-scroll">
            <table className="w-full text-[11px]">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-2 py-1.5 text-left">{lang === "bn" ? "নাম" : "Name"}</th>
                  <th className="px-2 py-1.5 text-left">{lang === "bn" ? "ফোন" : "Phone"}</th>
                  <th className="px-2 py-1.5">BG</th>
                  <th className="px-2 py-1.5">{lang === "bn" ? "লিঙ্গ" : "Gender"}</th>
                  <th className="px-2 py-1.5 text-left">{lang === "bn" ? "জেলা" : "District"}</th>
                  <th className="px-2 py-1.5 text-left">{lang === "bn" ? "উপজেলা" : "Upazila"}</th>
                  <th className="px-2 py-1.5 text-left">{lang === "bn" ? "ঠিকানা" : "Address"}</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {donors.map((d) =>
                  editingId === d.id ? (
                    <tr key={d.id} className="border-t border-slate-800 bg-slate-950/80">
                      <td colSpan={8} className="p-2">
                        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          <input className={ainp} placeholder={lang === "bn" ? "নাম *" : "Name *"} value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
                          <input className={ainp} placeholder={lang === "bn" ? "ফোন *" : "Phone *"} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                          <select className={ainp} value={editForm.blood_group} onChange={(e) => setEditForm({ ...editForm, blood_group: e.target.value })}>
                            <option value="">{lang === "bn" ? "রক্তের গ্রুপ" : "Blood group"}</option>
                            {BLOOD_GROUPS.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                          <select
                            className={ainp}
                            value={editForm.gender}
                            onChange={(e) =>
                              setEditForm({ ...editForm, gender: e.target.value as "" | DonorGender })
                            }
                          >
                            <option value="">{lang === "bn" ? "লিঙ্গ" : "Gender"}</option>
                            <option value="male">{lang === "bn" ? "পুরুষ" : "Male"}</option>
                            <option value="female">{lang === "bn" ? "মহিলা" : "Female"}</option>
                          </select>
                          <select
                            className={ainp}
                            value={editForm.district_id}
                            onChange={(e) => setEditForm({ ...editForm, district_id: e.target.value, upazila: "" })}
                          >
                            <option value="">{lang === "bn" ? "জেলা" : "District"}</option>
                            {districts.map((dist) => (
                              <option key={dist.id} value={dist.id}>
                                {lang === "bn" ? dist.name_bn : dist.name_en}
                              </option>
                            ))}
                          </select>
                          <select
                            className={ainp}
                            value={editForm.upazila}
                            disabled={!editForm.district_id}
                            onChange={(e) => setEditForm({ ...editForm, upazila: e.target.value })}
                          >
                            <option value="">{lang === "bn" ? "উপজেলা" : "Upazila"}</option>
                            {upazilaOptions.map((u) => (
                              <option key={u.en} value={u.en}>
                                {lang === "bn" ? u.bn : u.en}
                              </option>
                            ))}
                          </select>
                          <input className={ainp} placeholder={lang === "bn" ? "ঠিকানা" : "Address"} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                          <label className="flex items-center gap-2 text-xs text-slate-400 px-1">
                            <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })} />
                            {lang === "bn" ? "সক্রিয়" : "Active"}
                          </label>
                        </div>
                        <div className="flex gap-2 mt-2">
                          <button type="button" disabled={busy} onClick={() => void saveEdit()} className="rounded-lg bg-emerald-600 text-white text-xs px-3 py-1.5 disabled:opacity-50">
                            {busy ? "…" : lang === "bn" ? "সেভ" : "Save"}
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-700 text-xs px-3 py-1.5 text-slate-400">
                            {lang === "bn" ? "বাতিল" : "Cancel"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={d.id} className="border-t border-slate-800 hover:bg-slate-950/40">
                      <td className="px-2 py-1.5 font-medium">{d.full_name}</td>
                      <td className="px-2 py-1.5">{d.phone}</td>
                      <td className="px-2 py-1.5 text-center">{d.blood_group || "—"}</td>
                      <td className="px-2 py-1.5 text-center">
                        {d.gender === "male"
                          ? lang === "bn"
                            ? "পুরুষ"
                            : "Male"
                          : d.gender === "female"
                            ? lang === "bn"
                              ? "মহিলা"
                              : "Female"
                            : "—"}
                      </td>
                      <td className="px-2 py-1.5">{lang === "bn" ? d.districts?.name_bn : d.districts?.name_en || "—"}</td>
                      <td className="px-2 py-1.5">
                        {upazilaDisplayName(d.upazila, d.districts?.slug ?? null, lang) || "—"}
                      </td>
                      <td className="px-2 py-1.5 max-w-[8rem] truncate" title={d.address ?? ""}>{d.address || "—"}</td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1 justify-end">
                          {can("community.donors_edit") && (
                            <button type="button" onClick={() => startEdit(d)} className="text-slate-400 hover:text-white p-1">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {can("community.donors_delete") && (
                            <button type="button" onClick={() => void removeDonor(d.id)} className="text-rose-400 p-1">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
        </div>
      )}
    </div>
  );
}

function CommunityAdmin() {
  const { t, lang } = useI18n();
  const { can } = useAdminAccess();
  const [rows, setRows] = useState<any[]>([]);
  const [form, setForm] = useState({
    name: "",
    name_bn: "",
    phone: "",
    email: "",
    website: "",
    description: "",
    description_bn: "",
  });
  const [importOrgId, setImportOrgId] = useState("");
  const [importDistrict, setImportDistrict] = useState<District | null>(null);
  const [importUpazila, setImportUpazila] = useState("");
  const [importGender, setImportGender] = useState<"" | DonorGender>("");
  const [importPreview, setImportPreview] = useState<DonorImportInput[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [showQuickAddOrg, setShowQuickAddOrg] = useState(false);
  const [quickOrg, setQuickOrg] = useState({ name: "", phone: "" });
  const [quickOrgBusy, setQuickOrgBusy] = useState(false);
  const [districts, setDistricts] = useState<District[]>([]);
  const [expandedOrgId, setExpandedOrgId] = useState<string | null>(null);
  const [editingOrgId, setEditingOrgId] = useState<string | null>(null);
  const [donorRefreshKey, setDonorRefreshKey] = useState(0);

  async function load() {
    const { data } = await supabase.from("community_orgs").select("*").order("sort_order");
    setRows(data ?? []);
    if (!importOrgId && data?.[0]?.id) setImportOrgId(data[0].id);
  }

  useEffect(() => {
    load();
    fetchAllDistrictsAdmin().then(setDistricts);
  }, []);

  async function add() {
    if (!can("community.add")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!form.name.trim() || !form.phone.trim()) {
      return toast.error(lang === "bn" ? "নাম ও ফোন বাধ্যতামূলক" : "Name and phone are required");
    }
    const { error } = await supabase.from("community_orgs").insert({
      name: form.name.trim(),
      name_bn: form.name_bn.trim() || null,
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      website: form.website.trim() || null,
      description: form.description.trim() || null,
      description_bn: form.description_bn.trim() || null,
    });
    if (error) return toast.error(error.message);
    setForm({ name: "", name_bn: "", phone: "", email: "", website: "", description: "", description_bn: "" });
    toast.success(t("saved"));
    load();
  }

  async function saveOrg(orgId: string, draft: ReturnType<typeof emptyOrgForm>): Promise<void> {
    if (!can("community.edit")) {
      toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
      return;
    }
    if (!draft.name.trim() || !draft.phone.trim()) {
      toast.error(lang === "bn" ? "নাম ও ফোন বাধ্যতামূলক" : "Name and phone are required");
      return;
    }
    const { error } = await supabase
      .from("community_orgs")
      .update({
        name: draft.name.trim(),
        name_bn: draft.name_bn.trim() || null,
        phone: draft.phone.trim(),
        email: draft.email.trim() || null,
        website: draft.website.trim() || null,
        description: draft.description.trim() || null,
        description_bn: draft.description_bn.trim() || null,
      })
      .eq("id", orgId);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("saved"));
    setEditingOrgId(null);
    load();
  }

  async function toggle(id: string, is_active: boolean) {
    if (!can("community.toggle")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    await supabase.from("community_orgs").update({ is_active: !is_active }).eq("id", id);
    load();
  }

  async function remove(id: string) {
    if (!can("community.delete")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const { error } = await supabase.from("community_orgs").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      if (expandedOrgId === id) setExpandedOrgId(null);
      if (editingOrgId === id) setEditingOrgId(null);
      load();
    }
  }

  async function onFilePick(file: File | null) {
    if (!file) return;
    try {
      const parsed = await parseDonorImportFile(file);
      setImportPreview(parsed);
      toast.success(
        lang === "bn" ? `${parsed.length}টি রো পড়া হয়েছে` : `${parsed.length} row(s) parsed`,
      );
    } catch (e) {
      toast.error((e as Error).message);
      setImportPreview([]);
    }
  }

  async function quickAddOrg() {
    if (!can("community.add")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!quickOrg.name.trim() || !quickOrg.phone.trim()) {
      return toast.error(lang === "bn" ? "নাম ও ফোন বাধ্যতামূলক" : "Name and phone are required");
    }
    setQuickOrgBusy(true);
    const { data, error } = await supabase
      .from("community_orgs")
      .insert({
        name: quickOrg.name.trim(),
        phone: quickOrg.phone.trim(),
      })
      .select("id")
      .single();
    setQuickOrgBusy(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "সংস্থা যোগ হয়েছে" : "Organization added");
    setQuickOrg({ name: "", phone: "" });
    setShowQuickAddOrg(false);
    await load();
    if (data?.id) setImportOrgId(data.id);
  }

  async function runImport() {
    if (!can("community.import")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!importDistrict) {
      return toast.error(lang === "bn" ? "জেলা সিলেক্ট করুন" : "Select a district");
    }
    if (!importOrgId) {
      return toast.error(lang === "bn" ? "সংস্থা সিলেক্ট করুন" : "Select an organization");
    }
    if (!importPreview.length) {
      return toast.error(lang === "bn" ? "ফাইল আপলোড করুন" : "Upload a file first");
    }
    const missingGender = importPreview.some((r) => !r.gender?.trim()) && !importGender;
    if (missingGender) {
      return toast.error(
        lang === "bn"
          ? "লিঙ্গ সিলেক্ট করুন অথবা ফাইলে gender (male/female) দিন"
          : "Select gender or include gender (male/female) in the file",
      );
    }
    setImportBusy(true);
    const result = await bulkImportCommunityDonors(
      importOrgId,
      importPreview,
      {
        districtId: importDistrict.id,
        upazila: importUpazila || null,
        gender: importGender || null,
      },
      districts,
    );
    setImportBusy(false);
    if (result.errors.length) toast.error(result.errors[0]!);
    toast.success(
      lang === "bn"
        ? `${result.inserted} জন রক্তদাতা যোগ হয়েছে`
        : `${result.inserted} donor(s) imported`,
    );
    setImportPreview([]);
    setDonorRefreshKey((k) => k + 1);
  }

  const optionalFields = [
    { key: "name_bn" as const, label: lang === "bn" ? "নাম (বাংলা)" : "Name (BN)" },
    { key: "email" as const, label: "Email" },
    { key: "website" as const, label: "Website" },
    { key: "description" as const, label: lang === "bn" ? "বিবরণ" : "Description" },
    { key: "description_bn" as const, label: lang === "bn" ? "বিবরণ (বাংলা)" : "Description (BN)" },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">{lang === "bn" ? "নতুন সংস্থা" : "Add organization"}</h3>
        <p className="text-[10px] text-slate-500">
          {lang === "bn" ? "শুধু নাম ও ফোন বাধ্যতামূলক — বাকি সব ঐচ্ছিক" : "Only name & phone required — rest optional"}
        </p>
        <div className="grid md:grid-cols-2 gap-2">
          <input
            className={ainp}
            placeholder={lang === "bn" ? "নাম *" : "Name *"}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className={ainp}
            placeholder={lang === "bn" ? "ফোন *" : "Phone *"}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          {optionalFields.map((f) => (
            <input
              key={f.key}
              className={ainp}
              placeholder={`${f.label} (${lang === "bn" ? "ঐচ্ছিক" : "optional"})`}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            />
          ))}
        </div>
        <button type="button" onClick={() => void add()} className="rounded-lg bg-rose-600 text-white text-sm font-semibold px-4 py-2.5">
          <Plus className="h-4 w-4 inline mr-1" />
          {t("save")}
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Upload className="h-4 w-4 text-rose-400" />
          {lang === "bn" ? "বাল্ক রক্তদাতা ইমপোর্ট" : "Bulk donor import"}
        </h3>
        <p className="text-[10px] text-slate-500 leading-relaxed">
          {lang === "bn"
            ? "আগে জেলা, উপজেলা ও লিঙ্গ দিন, তারপর সংস্থা সিলেক্ট করে CSV / Excel / JSON আপলোড করুন। ফাইল কলাম: Name, Phone, blood_group, gender (male/female), Address (ঐচ্ছিক)। ফাইলে gender না থাকলে ফর্মের লিঙ্গ সব রোতে প্রয়োগ হবে।"
            : "Set District, Upazila & Gender first, then pick an organization and upload CSV / Excel / JSON. File columns: Name, Phone, blood_group, gender (male/female), Address (optional). Form gender is used when a row has no gender."}
        </p>
        <div className="flex flex-wrap gap-2 text-xs">
          <a href="/samples/community-donors-sample.csv" download className="text-rose-400 hover:underline flex items-center gap-1">
            <Download className="h-3 w-3" /> Sample CSV (10)
          </a>
          <a href="/samples/community-donors-sample.xlsx" download className="text-rose-400 hover:underline flex items-center gap-1">
            <FileSpreadsheet className="h-3 w-3" /> Sample Excel (10)
          </a>
          <a href="/samples/community-donors-sample.json" download className="text-rose-400 hover:underline flex items-center gap-1">
            <FileSpreadsheet className="h-3 w-3" /> Sample JSON (10)
          </a>
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">{lang === "bn" ? "জেলা *" : "District *"}</label>
            <DistrictTypeahead
              value={importDistrict}
              onChange={(d) => {
                setImportDistrict(d);
                setImportUpazila("");
              }}
              placeholder={lang === "bn" ? "জেলা খুঁজুন…" : "Search district…"}
              variant="admin"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">{lang === "bn" ? "উপজেলা" : "Upazila"}</label>
            <UpazilaSelect
              district={importDistrict}
              value={importUpazila}
              onChange={setImportUpazila}
              variant="admin"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-slate-400">{lang === "bn" ? "লিঙ্গ" : "Gender"}</label>
            <div className="grid grid-cols-2 gap-1.5">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setImportGender((cur) => (cur === g ? "" : g))}
                  className={`rounded-lg border px-2 py-2.5 text-xs font-semibold transition ${
                    importGender === g
                      ? "border-rose-500 bg-rose-600/20 text-rose-300"
                      : "border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500"
                  }`}
                >
                  {g === "male"
                    ? lang === "bn"
                      ? "পুরুষ"
                      : "Male"
                    : lang === "bn"
                      ? "মহিলা"
                      : "Female"}
                </button>
              ))}
            </div>
            <p className="text-[9px] text-slate-500">
              {lang === "bn"
                ? "ফাইলে gender থাকলে সেটা প্রাধান্য পাবে"
                : "File gender overrides this default"}
            </p>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] text-slate-400">{lang === "bn" ? "সংস্থা *" : "Organization *"}</label>
          <select
            className={ainp}
            value={showQuickAddOrg ? "__add__" : importOrgId}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "__add__") {
                setShowQuickAddOrg(true);
                return;
              }
              setShowQuickAddOrg(false);
              setImportOrgId(v);
            }}
          >
            <option value="">{lang === "bn" ? "সংস্থা সিলেক্ট…" : "Select organization…"}</option>
            {can("community.add") && (
              <option value="__add__">
                {lang === "bn" ? "+ নতুন সংস্থা যোগ করুন" : "+ Add new organization"}
              </option>
            )}
            {rows.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          {showQuickAddOrg && (
            <div className="rounded-lg border border-rose-900/50 bg-slate-950/80 p-3 space-y-2">
              <p className="text-[10px] text-slate-400">
                {lang === "bn" ? "ম্যানুয়ালি সংস্থা যোগ করুন (নাম ও ফোন বাধ্যতামূলক)" : "Add organization manually (name & phone required)"}
              </p>
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  className={ainp}
                  placeholder={lang === "bn" ? "সংস্থার নাম *" : "Organization name *"}
                  value={quickOrg.name}
                  onChange={(e) => setQuickOrg({ ...quickOrg, name: e.target.value })}
                />
                <input
                  className={ainp}
                  placeholder={lang === "bn" ? "ফোন *" : "Phone *"}
                  value={quickOrg.phone}
                  onChange={(e) => setQuickOrg({ ...quickOrg, phone: e.target.value })}
                  inputMode="tel"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={quickOrgBusy}
                  onClick={() => void quickAddOrg()}
                  className="rounded-lg bg-rose-600 text-white text-xs font-semibold px-3 py-2 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5 inline mr-1" />
                  {quickOrgBusy ? "…" : lang === "bn" ? "যোগ করুন" : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAddOrg(false);
                    setQuickOrg({ name: "", phone: "" });
                  }}
                  className="rounded-lg border border-slate-700 text-slate-300 text-xs px-3 py-2"
                >
                  {lang === "bn" ? "বাতিল" : "Cancel"}
                </button>
              </div>
            </div>
          )}
        </div>
        <input
          type="file"
          accept=".csv,.json,.xlsx,.xls"
          className="block w-full text-xs text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-rose-600 file:px-3 file:py-2 file:text-white"
          onChange={(e) => void onFilePick(e.target.files?.[0] ?? null)}
        />
        {importPreview.length > 0 && (
          <div className="rounded-lg border border-slate-800 overflow-hidden max-h-40 overflow-auto">
            <table className="w-full text-[10px]">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-2 py-1 text-left">Name</th>
                  <th className="px-2 py-1 text-left">Phone</th>
                  <th className="px-2 py-1 text-center">BG</th>
                  <th className="px-2 py-1 text-center">Gender</th>
                  <th className="px-2 py-1 text-left">Address</th>
                </tr>
              </thead>
              <tbody>
                {importPreview.slice(0, 8).map((r, i) => (
                  <tr key={i} className="border-t border-slate-800">
                    <td className="px-2 py-1">{r.name}</td>
                    <td className="px-2 py-1">{r.phone}</td>
                    <td className="px-2 py-1 text-center">{r.blood_group || "—"}</td>
                    <td className="px-2 py-1 text-center">{r.gender || importGender || "—"}</td>
                    <td className="px-2 py-1">{r.address || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {importPreview.length > 8 && (
              <p className="text-[10px] text-slate-500 px-2 py-1">+{importPreview.length - 8} more…</p>
            )}
          </div>
        )}
        <button
          type="button"
          disabled={importBusy || !importPreview.length || !importOrgId || !importDistrict}
          onClick={() => void runImport()}
          className="rounded-lg bg-emerald-600 text-white text-sm font-semibold px-4 py-2.5 disabled:opacity-50"
        >
          {importBusy ? "…" : lang === "bn" ? "ইমপোর্ট করুন" : "Import donors"}
        </button>
      </div>

      <ul className="space-y-2">
        {rows.map((o: CommunityOrg) => (
          <li key={o.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
            <div className="flex items-start gap-2">
              <button
                type="button"
                onClick={() => {
                  setExpandedOrgId((cur) => (cur === o.id ? null : o.id));
                  setEditingOrgId(null);
                }}
                className="flex min-w-0 flex-1 items-start gap-2 text-left"
              >
                <ChevronDown
                  className={`h-4 w-4 shrink-0 mt-0.5 text-slate-400 transition ${expandedOrgId === o.id ? "rotate-180" : ""}`}
                />
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{o.name}</p>
                  {o.name_bn && <p className="text-xs text-slate-500">{o.name_bn}</p>}
                  <p className="text-xs text-slate-400 mt-0.5">{o.phone}</p>
                  {o.email && <p className="text-[10px] text-slate-500">{o.email}</p>}
                </div>
              </button>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setEditingOrgId((cur) => (cur === o.id ? null : o.id));
                    setExpandedOrgId(o.id);
                  }}
                  className="p-1.5 text-slate-400 hover:text-white"
                  title={lang === "bn" ? "সম্পাদনা" : "Edit"}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => void toggle(o.id, o.is_active)} className="text-xs text-slate-300 px-2 py-1">
                  {o.is_active ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!confirm(lang === "bn" ? "সংস্থা ও এর সব রক্তদাতা ডিলিট হবে। চালিয়ে যাবেন?" : "Delete org and all its donors?")) return;
                    void remove(o.id);
                  }}
                  className="text-rose-400 p-1.5"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {editingOrgId === o.id && (
              <OrgEditForm
                org={o}
                lang={lang}
                t={t}
                onSave={(draft) => saveOrg(o.id, draft)}
                onCancel={() => setEditingOrgId(null)}
              />
            )}

            {expandedOrgId === o.id && editingOrgId !== o.id && (
              <>
                <OrgContactSettingsPanel
                  orgId={o.id}
                  initial={o.donor_contact_settings}
                  lang={lang}
                  onSaved={() => void load()}
                />
                <OrgDonorsPanel orgId={o.id} districts={districts} lang={lang} refreshKey={donorRefreshKey} />
              </>
            )}
          </li>
        ))}
        {rows.length === 0 && (
          <li className="rounded-xl border border-dashed border-slate-800 py-10 text-center text-sm text-slate-500">
            {lang === "bn" ? "কোনো সংস্থা নেই" : "No organizations yet"}
          </li>
        )}
      </ul>
    </div>
  );
}

function NotificationsAdmin() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const [rows, setRows] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [ns, setNs] = useState<NotificationSettings>({ ...DEFAULT_NOTIFICATION_SETTINGS });
  const [nsBusy, setNsBusy] = useState(false);

  async function load() {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) toast.error(error.message);
    else setRows(data ?? []);
  }

  async function loadSettings() {
    const { data } = await supabase.from("app_settings").select("notification_settings").eq("id", 1).maybeSingle();
    if (data?.notification_settings) {
      setNs({ ...DEFAULT_NOTIFICATION_SETTINGS, ...(data.notification_settings as NotificationSettings) });
    }
  }

  useEffect(() => {
    load();
    loadSettings();
  }, []);

  async function saveSettings() {
    if (!can("notifications.settings")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    setNsBusy(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ id: 1, notification_settings: ns });
    setNsBusy(false);
    if (error) toast.error(error.message);
    else {
      invalidateNotificationSettingsCache();
      toast.success(lang === "bn" ? "নোটিফিকেশন সেটিংস সেভ হয়েছে" : "Notification settings saved");
    }
  }

  function setNsKey<K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) {
    setNs((prev) => ({ ...prev, [key]: value }));
  }

  async function purgeNow() {
    if (!can("notifications.purge")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const { error } = await supabase.rpc("purge_expired_notifications");
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "bn" ? "পুরানো নোটিফিকেশন মুছে ফেলা হয়েছে" : "Expired notifications purged");
      load();
    }
  }

  async function broadcast() {
    if (!can("notifications.broadcast")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
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
    if (!can("notifications.delete")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) toast.error(error.message);
    else setRows((r) => r.filter((x) => x.id !== id));
  }

  async function clearAll() {
    if (!can("notifications.delete")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!confirm(lang === "bn" ? "সব নোটিফিকেশন ডিলিট?" : "Delete all notifications?")) return;
    const { error } = await supabase.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    if (error) toast.error(error.message);
    else {
      setRows([]);
      toast.success("Cleared");
    }
  }

  const settingLabels: Record<Exclude<keyof NotificationSettings, "web_push_hook_secret">, { bn: string; en: string }> = {
    retention_days: { bn: "নোটিফিকেশন রাখার দিন", en: "Notification retention (days)" },
    enable_managed_button: { bn: "৩-ডট মেনু: ম্যানেজড/সম্পন্ন", en: "3-dot menu: mark managed" },
    enable_critical_droplet_animation: {
      bn: "(পুরনো) Critical ফোঁটা — নতুন কন্ট্রোল: Settings → Urgency animation",
      en: "(Legacy) Critical droplet — use Settings → Urgency animation",
    },
    enable_push: { bn: "ডিভাইস পুশ সক্রিয়", en: "Enable device push" },
    push_new_request: { bn: "নতুন রিকোয়েস্টে পুশ", en: "Push for new requests" },
    push_interactions: { bn: "লাইক/কমেন্ট/শেয়ারে পুশ", en: "Push for likes/comments/shares" },
    match_district_for_alerts: { bn: "জেলা মিলে অ্যালার্ট", en: "Alert by matching district" },
    match_blood_group_for_alerts: { bn: "রক্তের গ্রুপ মিলে অ্যালার্ট", en: "Alert by matching blood group" },
    auto_feed_district: { bn: "ফিডে অটো জেলা ফিল্টার", en: "Auto district filter in feed" },
    auto_feed_blood_group: { bn: "ফিডে অটো ব্লাড গ্রুপ ফিল্টার", en: "Auto blood group filter in feed" },
  };

  function generateWebhookSecret() {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const secret = btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    setNsKey("web_push_hook_secret", secret);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-rose-400" />
          {lang === "bn" ? "নোটিফিকেশন কন্ট্রোল" : "Notification controls"}
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {NOTIFICATION_SETTING_KEYS.filter(
            (k) =>
              k !== "retention_days" &&
              k !== "web_push_hook_secret" &&
              k !== "enable_critical_droplet_animation",
          ).map((key) => (
            <label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
              <span className="text-slate-300">{lang === "bn" ? settingLabels[key].bn : settingLabels[key].en}</span>
              <input
                type="checkbox"
                checked={!!ns[key]}
                onChange={(e) => setNsKey(key, e.target.checked as NotificationSettings[typeof key])}
                className="h-4 w-4 accent-rose-500"
              />
            </label>
          ))}
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-2">
          <p className="text-xs font-medium text-slate-300">
            {lang === "bn" ? "অ্যাপ বন্ধ থাকলে Web Push" : "Web Push (app fully closed)"}
          </p>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {lang === "bn"
              ? "VAPID keys + send-push edge function deploy করুন। WEBHOOK_SECRET এখানে ও Supabase secrets-এ একই রাখুন।"
              : "Deploy send-push edge function with VAPID keys. Use the same WEBHOOK_SECRET here and in Supabase secrets."}
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-mono"
              placeholder={lang === "bn" ? "Web Push webhook secret" : "Web Push webhook secret"}
              value={ns.web_push_hook_secret ?? ""}
              onChange={(e) => setNsKey("web_push_hook_secret", e.target.value)}
            />
            <button
              type="button"
              onClick={generateWebhookSecret}
              className="shrink-0 rounded-lg border border-slate-700 px-3 py-2 text-[10px] text-slate-300"
            >
              {lang === "bn" ? "জেনারেট" : "Generate"}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">
            {lang === "bn" ? settingLabels.retention_days.bn : settingLabels.retention_days.en}
          </label>
          <input
            type="number"
            min={1}
            max={365}
            className="w-full max-w-[8rem] rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            value={ns.retention_days}
            onChange={(e) => setNsKey("retention_days", Math.max(1, Number(e.target.value) || 1))}
          />
          <p className="text-[10px] text-slate-500 mt-1">
            {lang === "bn"
              ? "এত দিন পর নোটিফিকেশন অটো ডিলিট হবে"
              : "Notifications auto-delete after this many days"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={nsBusy}
            onClick={() => void saveSettings()}
            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {nsBusy ? "…" : lang === "bn" ? "সেটিংস সেভ" : "Save settings"}
          </button>
          <button
            type="button"
            onClick={() => void purgeNow()}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-400"
          >
            {lang === "bn" ? "এখনই পুরানো মুছুন" : "Purge expired now"}
          </button>
        </div>
      </div>

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
  const { t, lang } = useI18n();
  const { can } = useAdminAccess();
  const [settingsTab, setSettingsTab] = useState<
    | "urgency"
    | "feed"
    | "carousel"
    | "banner"
    | "landing"
    | "reasons"
    | "donations"
    | "menu"
    | "form"
    | "profilelock"
    | "messaging"
    | "drive"
    | "app"
  >("urgency");
  const [s, setS] = useState<any>({
    app_name: "BloodLink",
    emergency_hotline: "",
    about_bn: "",
    about_en: "",
    brand_primary: "#C62828",
    maintenance_mode: false,
    request_form_options: { ...DEFAULT_REQUEST_FORM_OPTIONS },
  });

  useEffect(() => {
    supabase
      .from("app_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setS({
          ...data,
          request_form_options: {
            ...DEFAULT_REQUEST_FORM_OPTIONS,
            ...(data.request_form_options ?? {}),
          },
        });
      });
  }, []);

  async function save() {
    if (!can("settings.edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const { error } = await supabase.from("app_settings").upsert({ ...s, id: 1 });
    if (error) toast.error(error.message);
    else toast.success(t("saved"));
  }

  function setOpt(key: keyof RequestFormOptions, optional: boolean) {
    setS((prev: any) => ({
      ...prev,
      request_form_options: { ...prev.request_form_options, [key]: optional },
    }));
  }

  const labels: Record<keyof RequestFormOptions, { bn: string; en: string }> = {
    patient_name: { bn: "রোগীর নাম", en: "Patient name" },
    blood_group: { bn: "রক্তের গ্রুপ", en: "Blood group" },
    bags_needed: { bn: "ব্যাগ সংখ্যা", en: "Bags needed" },
    district: { bn: "জেলা", en: "District" },
    hospital: { bn: "হাসপাতাল", en: "Hospital" },
    contact_phone: { bn: "যোগাযোগ নম্বর", en: "Contact phone" },
    whatsapp: { bn: "WhatsApp নম্বর", en: "WhatsApp number" },
    needed_by: { bn: "দরকারের সময়", en: "Needed by" },
    urgency: { bn: "জরুরিতা", en: "Urgency" },
    notes: { bn: "নোট", en: "Notes" },
  };

  const navItems = [
    { id: "urgency" as const, bn: "জরুরিতা অ্যানিমেশন", en: "Urgency animation" },
    { id: "feed" as const, bn: "ফিড র‍্যাঙ্কিং", en: "Feed ranking" },
    { id: "carousel" as const, bn: "ইমেজ ক্যারোজেল", en: "Image carousel" },
    { id: "banner" as const, bn: "ফুল ব্যানার", en: "Full banner" },
    { id: "landing" as const, bn: "ল্যান্ডিং / Frontpage", en: "Landing / Frontpage" },
    { id: "reasons" as const, bn: "রোগের কারণ", en: "Need reasons" },
    { id: "donations" as const, bn: "রক্তদান ফ্লো", en: "Donation flow" },
    { id: "menu" as const, bn: "ইউজার মেনু", en: "User menu" },
    { id: "form" as const, bn: "রিকোয়েস্ট ফর্ম", en: "Request form" },
    { id: "profilelock" as const, bn: "প্রোফাইল লক", en: "Profile lock" },
    { id: "messaging" as const, bn: "SMS ও আইকন", en: "SMS & icons" },
    { id: "drive" as const, bn: "Google Drive", en: "Google Drive" },
    { id: "app" as const, bn: "অ্যাপ", en: "App" },
  ];

  return (
    <div className="space-y-4 max-w-4xl">
      <nav className="flex gap-1 overflow-x-auto no-scrollbar rounded-xl border border-slate-800 bg-slate-950 p-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setSettingsTab(item.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              settingsTab === item.id
                ? "bg-rose-600 text-white shadow"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            {lang === "bn" ? item.bn : item.en}
          </button>
        ))}
      </nav>

      {settingsTab === "urgency" && <UrgencyAnimationAdmin />}
      {settingsTab === "feed" && <FeedRankingAdmin />}
      {settingsTab === "carousel" && <FeedCarouselAdmin />}
      {settingsTab === "banner" && <FeedBannerAdmin />}
      {settingsTab === "landing" && <LandingAdmin />}
      {settingsTab === "reasons" && <NeedReasonAdmin />}
      {settingsTab === "donations" && <DonationFlowAdmin />}
      {settingsTab === "menu" && <UserMenuAdmin />}
      {settingsTab === "profilelock" && <ProfileLockAdmin />}
      {settingsTab === "messaging" && <MessagingSettingsAdmin />}
      {settingsTab === "drive" && <GoogleDriveAdmin />}

      {settingsTab === "form" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3 max-w-2xl">
          <h3 className="text-sm font-semibold">
            {lang === "bn" ? "নতুন রিকোয়েস্ট — অপশনাল ফিল্ড" : "New request — optional fields"}
          </h3>
          <p className="text-xs text-slate-400">
            {lang === "bn"
              ? "চেক থাকলে ফিল্ডটি ঐচ্ছিক। আনচেক = বাধ্যতামূলক।"
              : "Checked = optional. Unchecked = required."}
          </p>
          <ul className="space-y-2">
            {REQUEST_FORM_OPTION_KEYS.map((key) => (
              <li
                key={key}
                className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2"
              >
                <span className="text-sm">{lang === "bn" ? labels[key].bn : labels[key].en}</span>
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={!!s.request_form_options?.[key]}
                    onChange={(e) => setOpt(key, e.target.checked)}
                  />
                  {lang === "bn" ? "ঐচ্ছিক" : "Optional"}
                </label>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-rose-600 text-white px-4 py-2.5 text-sm font-semibold"
          >
            {t("save")}
          </button>
        </div>
      )}

      {settingsTab === "app" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          {(["app_name", "emergency_hotline", "brand_primary"] as const).map((k) => (
            <div key={k}>
              <label className="text-xs text-slate-400">{k}</label>
              <input
                className={ainp}
                value={s[k] ?? ""}
                onChange={(e) => setS({ ...s, [k]: e.target.value })}
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-slate-400">about_bn</label>
            <textarea
              className={ainp}
              rows={3}
              value={s.about_bn ?? ""}
              onChange={(e) => setS({ ...s, about_bn: e.target.value })}
            />
          </div>
          <div>
            <label className="text-xs text-slate-400">about_en</label>
            <textarea
              className={ainp}
              rows={3}
              value={s.about_en ?? ""}
              onChange={(e) => setS({ ...s, about_en: e.target.value })}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!!s.maintenance_mode}
              onChange={(e) => setS({ ...s, maintenance_mode: e.target.checked })}
            />
            Maintenance mode
          </label>
          <button
            type="button"
            onClick={save}
            className="rounded-lg bg-rose-600 text-white px-4 py-2.5 text-sm font-semibold"
          >
            {t("save")}
          </button>
        </div>
      )}
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
