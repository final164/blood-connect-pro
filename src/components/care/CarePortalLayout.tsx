import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Ambulance,
  Building2,
  ClipboardList,
  Hospital,
  Info,
  LayoutDashboard,
  LogOut,
  Microscope,
  PanelLeft,
  PanelLeftClose,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import {
  careHasPermission,
  fetchMyCareMemberships,
  orgPanelsFromKind,
  type CareMembership,
} from "@/lib/care-access";
import { fetchCareVendorTypes, type CareVendorType } from "@/lib/care-cms";
import type { CarePermissionKey } from "@/lib/care-permissions";
import { careOrgKycLabel } from "@/lib/care-vendor-auth";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const SIDEBAR_STORAGE_KEY = "care-portal-sidebar";
const DESKTOP_MQ = "(min-width: 768px)";

export type CarePortalLayoutValue = {
  ready: boolean;
  memberships: CareMembership[];
  orgId: string | null;
  setOrgId: (id: string) => void;
  membership: CareMembership | null;
  can: (key: CarePermissionKey) => boolean;
  panels: Set<string>;
  showDesk: boolean;
  showLab: boolean;
  showOperation: boolean;
  showAmbulance: boolean;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  /** Desktop shell chrome is active — hide duplicate page headers */
  desktopShell: boolean;
  bareLayout: boolean;
  signOutPortal: () => Promise<void>;
  lang: "bn" | "en";
  orgName: string;
};

const CarePortalLayoutContext = createContext<CarePortalLayoutValue | null>(null);

export function useCarePortalLayout(): CarePortalLayoutValue {
  const ctx = useContext(CarePortalLayoutContext);
  if (!ctx) throw new Error("useCarePortalLayout requires CarePortalLayoutProvider");
  return ctx;
}

export function useCarePortalLayoutOptional(): CarePortalLayoutValue | null {
  return useContext(CarePortalLayoutContext);
}

function readSidebarOpen(): boolean {
  try {
    const v = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (v === "0") return false;
    if (v === "1") return true;
  } catch {
    /* ignore */
  }
  return true;
}

export function CarePortalLayoutProvider({ children }: { children: ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const bareLayout = pathname.includes("/onboarding");
  const [isDesktop, setIsDesktop] = useState(false);

  const [memberships, setMemberships] = useState<CareMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [vendorTypes, setVendorTypes] = useState<CareVendorType[]>([]);
  const [ready, setReady] = useState(false);
  const [sidebarOpen, setSidebarOpenState] = useState(true);

  useEffect(() => {
    setSidebarOpenState(readSidebarOpen());
  }, []);

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_MQ);
    const update = () => setIsDesktop(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const setSidebarOpen = useCallback((open: boolean) => {
    setSidebarOpenState(open);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  const toggleSidebar = useCallback(() => {
    setSidebarOpen(!sidebarOpen);
  }, [setSidebarOpen, sidebarOpen]);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: "/care/auth", search: { mode: undefined, next: undefined } });
      return;
    }
    void Promise.all([fetchMyCareMemberships(), fetchCareVendorTypes()])
      .then(([rows, types]) => {
        const active = rows.filter((r) => r.care_orgs?.is_active !== false);
        if (!active.length) {
          toast.error(
            lang === "bn"
              ? "কেয়ার ভেন্ডর অ্যাকাউন্ট নেই — নিবন্ধন করুন"
              : "No care vendor account — please register",
          );
          void navigate({ to: "/care/auth", search: { mode: "register", next: undefined } });
          return;
        }
        setMemberships(active);
        setOrgId((prev) => prev ?? active[0]!.org_id);
        setVendorTypes(types);
        setReady(true);
      })
      .catch((e) => {
        toast.error((e as Error).message);
        void navigate({ to: "/care/auth", search: { mode: undefined, next: undefined } });
      });
  }, [loading, user, navigate, lang]);

  const membership = useMemo(
    () => memberships.find((m) => m.org_id === orgId) ?? null,
    [memberships, orgId],
  );

  const panels = useMemo(() => {
    const kindId = membership?.care_orgs?.org_kind_id;
    const kind = vendorTypes.find((t) => t.id === kindId);
    if (!kind) return new Set(["desk", "lab", "operation"]);
    return orgPanelsFromKind(kind);
  }, [membership, vendorTypes]);

  const can = useCallback(
    (key: CarePermissionKey) => careHasPermission(membership, key),
    [membership],
  );

  const canOpenOverview = can("overview.view") || membership?.role === "owner";
  const showDesk =
    panels.has("desk") &&
    (canOpenOverview || can("queue.view") || membership?.role === "owner");
  const showLab =
    panels.has("lab") &&
    (canOpenOverview || can("lab.checkin") || membership?.role === "owner");
  const showOperation =
    panels.has("operation") &&
    (canOpenOverview ||
      can("operation.view") ||
      can("operation.manage") ||
      can("operation.schedule") ||
      membership?.role === "owner");
  const showAmbulance =
    panels.has("ambulance") &&
    (canOpenOverview || can("ambulance.dispatch.view") || membership?.role === "owner");

  const org = membership?.care_orgs;
  const orgName = (lang === "bn" ? org?.name_bn || org?.name : org?.name) || "";

  const desktopShell = ready && !bareLayout && isDesktop;

  const signOutPortal = useCallback(async () => {
    await signOut();
    void navigate({ to: "/care/auth", search: { mode: undefined, next: undefined } });
  }, [signOut, navigate]);

  const value = useMemo<CarePortalLayoutValue>(
    () => ({
      ready,
      memberships,
      orgId,
      setOrgId,
      membership,
      can,
      panels,
      showDesk,
      showLab,
      showOperation,
      showAmbulance,
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      desktopShell,
      bareLayout,
      signOutPortal,
      lang,
      orgName,
    }),
    [
      ready,
      memberships,
      orgId,
      membership,
      can,
      panels,
      showDesk,
      showLab,
      showOperation,
      showAmbulance,
      sidebarOpen,
      setSidebarOpen,
      toggleSidebar,
      desktopShell,
      bareLayout,
      signOutPortal,
      lang,
      orgName,
    ],
  );

  return (
    <CarePortalLayoutContext.Provider value={value}>{children}</CarePortalLayoutContext.Provider>
  );
}

type NavItem = {
  to: string;
  labelBn: string;
  labelEn: string;
  icon: typeof LayoutDashboard;
  show: boolean;
  match: (path: string) => boolean;
};

function CarePortalDesktopSidebar() {
  const {
    lang,
    orgName,
    membership,
    memberships,
    orgId,
    setOrgId,
    showDesk,
    showLab,
    showOperation,
    showAmbulance,
    toggleSidebar,
    signOutPortal,
  } = useCarePortalLayout();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const org = membership?.care_orgs;
  const kycLabel = careOrgKycLabel(org, lang);
  const verified = !!org?.is_verified;

  const items: NavItem[] = [
    {
      to: "/care/portal",
      labelBn: "ওভারভিউ",
      labelEn: "Overview",
      icon: LayoutDashboard,
      show: true,
      match: (p) => p === "/care/portal" || p === "/care/portal/",
    },
    {
      to: "/care/portal/desk",
      labelBn: "চেম্বার ডেস্ক",
      labelEn: "Chamber desk",
      icon: ClipboardList,
      show: showDesk,
      match: (p) => p.startsWith("/care/portal/desk"),
    },
    {
      to: "/care/portal/lab",
      labelBn: "ল্যাব ডেস্ক",
      labelEn: "Lab desk",
      icon: Microscope,
      show: showLab,
      match: (p) => p.startsWith("/care/portal/lab"),
    },
    {
      to: "/care/portal/operation",
      labelBn: "অপারেশন ডেস্ক",
      labelEn: "Operation desk",
      icon: Hospital,
      show: showOperation,
      match: (p) => p.startsWith("/care/portal/operation"),
    },
    {
      to: "/care/portal/ambulance",
      labelBn: "অ্যাম্বুলেন্স",
      labelEn: "Ambulance",
      icon: Ambulance,
      show: showAmbulance,
      match: (p) => p.startsWith("/care/portal/ambulance"),
    },
    {
      to: "/care/portal/about",
      labelBn: "প্রতিষ্ঠান সম্পর্কে",
      labelEn: "About institute",
      icon: Info,
      show: true,
      match: (p) => p.startsWith("/care/portal/about"),
    },
    {
      to: "/care/portal/onboarding",
      labelBn: "প্রোফাইল / KYC",
      labelEn: "Profile / KYC",
      icon: Building2,
      show: true,
      match: (p) => p.startsWith("/care/portal/onboarding"),
    },
  ];

  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-slate-200 bg-card md:flex dark:border-slate-800">
      <div className="flex items-start gap-2.5 border-b border-slate-200 px-3 py-3.5 dark:border-slate-800">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-teal-700/20 bg-teal-700 text-white">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "কেয়ার পোর্টাল" : "Care portal"}
          </p>
          <p className="truncate text-sm font-bold text-foreground">{orgName || "—"}</p>
          <p
            className={cn(
              "mt-0.5 truncate text-[10px] font-medium",
              verified ? "text-emerald-700" : "text-amber-700",
            )}
          >
            {kycLabel}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleSidebar}
          title={lang === "bn" ? "সাইডবার লুকান" : "Hide sidebar"}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-200 text-muted-foreground hover:bg-muted hover:text-foreground dark:border-slate-700"
        >
          <PanelLeftClose className="h-4 w-4" />
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
        {items
          .filter((item) => item.show)
          .map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                search={item.to.includes("onboarding") ? {} : undefined}
                className={cn(
                  "relative flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm font-medium transition",
                  active
                    ? "border-teal-700/30 bg-teal-700/10 text-teal-900 dark:text-teal-100"
                    : "border-transparent text-muted-foreground hover:border-slate-200 hover:bg-muted/60 hover:text-foreground dark:hover:border-slate-700",
                )}
              >
                {active ? (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-teal-700" />
                ) : null}
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{lang === "bn" ? item.labelBn : item.labelEn}</span>
              </Link>
            );
          })}
      </nav>

      <div className="space-y-2 border-t border-slate-200 p-3 dark:border-slate-800">
        {memberships.length > 1 && orgId ? (
          <select
            className="w-full rounded-lg border border-slate-200 bg-background px-2 py-2 text-xs dark:border-slate-700"
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
          >
            {memberships.map((m) => (
              <option key={m.org_id} value={m.org_id}>
                {lang === "bn" ? m.care_orgs?.name_bn || m.care_orgs?.name : m.care_orgs?.name}
              </option>
            ))}
          </select>
        ) : null}
        <button
          type="button"
          onClick={() => void signOutPortal()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-2.5 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground dark:border-slate-700"
        >
          <LogOut className="h-3.5 w-3.5" />
          {lang === "bn" ? "লগআউট" : "Sign out"}
        </button>
      </div>
    </aside>
  );
}

function desktopPageTitle(pathname: string, lang: "bn" | "en") {
  if (pathname.startsWith("/care/portal/desk")) {
    return lang === "bn" ? "চেম্বার ডেস্ক" : "Chamber desk";
  }
  if (pathname.startsWith("/care/portal/operation")) {
    return lang === "bn" ? "অপারেশন ডেস্ক" : "Operation desk";
  }
  if (pathname.startsWith("/care/portal/lab")) {
    return lang === "bn" ? "ল্যাব ডেস্ক" : "Lab desk";
  }
  if (pathname.startsWith("/care/portal/ambulance")) {
    return lang === "bn" ? "অ্যাম্বুলেন্স ডেস্ক" : "Ambulance desk";
  }
  if (pathname.startsWith("/care/portal/about")) {
    return lang === "bn" ? "প্রতিষ্ঠান সম্পর্কে" : "About institute";
  }
  if (pathname.startsWith("/care/portal/tele")) {
    return lang === "bn" ? "ভিডিও ডেস্ক" : "Tele desk";
  }
  return lang === "bn" ? "ওভারভিউ" : "Overview";
}

function CarePortalDesktopTopBar() {
  const { lang, orgName, sidebarOpen, toggleSidebar } = useCarePortalLayout();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const title = desktopPageTitle(pathname, lang);

  return (
    <header className="hidden shrink-0 items-center gap-3 border-b border-slate-200 bg-card px-4 py-2.5 md:flex dark:border-slate-800">
      {!sidebarOpen ? (
        <button
          type="button"
          onClick={toggleSidebar}
          title={lang === "bn" ? "সাইডবার দেখান" : "Show sidebar"}
          className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-muted-foreground hover:bg-muted hover:text-foreground dark:border-slate-700"
        >
          <PanelLeft className="h-4 w-4" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
        <p className="truncate text-sm font-bold">{orgName}</p>
      </div>
    </header>
  );
}

export function CarePortalShell() {
  const { ready, bareLayout, desktopShell, sidebarOpen } = useCarePortalLayout();

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
      </div>
    );
  }

  if (bareLayout) {
    return (
      <div className="min-h-dvh bg-background">
        <Outlet />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-dvh bg-background",
        desktopShell && "md:flex md:h-dvh md:overflow-hidden",
      )}
    >
      {desktopShell && sidebarOpen ? <CarePortalDesktopSidebar /> : null}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          desktopShell && "md:h-full md:overflow-hidden",
        )}
      >
        {desktopShell ? <CarePortalDesktopTopBar /> : null}
        <div className={cn("min-w-0 flex-1", desktopShell && "md:overflow-y-auto")}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export function CarePortalLayout() {
  return (
    <CarePortalLayoutProvider>
      <CarePortalShell />
    </CarePortalLayoutProvider>
  );
}
