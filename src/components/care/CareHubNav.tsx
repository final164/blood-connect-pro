import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Ambulance,
  ClipboardList,
  FlaskConical,
  Home,
  HousePlus,
  LayoutDashboard,
  LayoutGrid,
  Microscope,
  Scissors,
  Sparkles,
  Stethoscope,
  Ticket,
  Video,
} from "lucide-react";
import { fetchCareHubModules, fetchCarePolicies, type CareHubModule } from "@/lib/care-cms";
import { fetchMyCareMemberships } from "@/lib/care-access";

const ICONS: Record<string, typeof Stethoscope> = {
  Stethoscope,
  FlaskConical,
  Ticket,
  ClipboardList,
  Microscope,
  LayoutGrid,
  Ambulance,
  Sparkles,
  LayoutDashboard,
  Scissors,
  Video,
  Home,
  HousePlus,
};

const PATIENT_ACCENTS: Record<string, string> = {
  dashboard: "border-sky-200 text-sky-800 hover:bg-sky-50/90 hover:border-sky-400",
  doctors: "border-teal-200 text-teal-800 hover:bg-teal-50/90 hover:border-teal-400",
  ai_tests: "border-violet-200 text-violet-800 hover:bg-violet-50/90 hover:border-violet-400",
  tests: "border-cyan-200 text-cyan-800 hover:bg-cyan-50/90 hover:border-cyan-400",
  home_doctor: "border-teal-200 text-teal-900 hover:bg-teal-50/90 hover:border-teal-400",
  home_diagnostic: "border-emerald-200 text-emerald-900 hover:bg-emerald-50/90 hover:border-emerald-400",
  operations: "border-rose-200 text-rose-800 hover:bg-rose-50/90 hover:border-rose-400",
  bookings: "border-amber-200 text-amber-900 hover:bg-amber-50/90 hover:border-amber-400",
  ambulance: "border-orange-200 text-orange-800 hover:bg-orange-50/90 hover:border-orange-400",
  video: "border-blue-200 text-blue-800 hover:bg-blue-50/90 hover:border-blue-400",
  desk: "border-slate-200 text-slate-800 hover:bg-slate-50/90 hover:border-slate-400",
  lab: "border-indigo-200 text-indigo-800 hover:bg-indigo-50/90 hover:border-indigo-400",
};

function moduleHref(m: CareHubModule): string {
  if (m.href.includes("/desk")) return "/care/portal/desk";
  if (m.href.includes("/portal/lab")) return "/care/portal/lab";
  if (m.href.includes("/portal/ambulance")) return "/care/portal/ambulance";
  if (m.href.includes("/portal/tele") || m.slug === "tele_desk") return "/care/portal/tele";
  if (m.slug === "video" || m.href.includes("/care/video")) return "/care/video";
  if (m.slug === "ambulance" || m.href === "/ambulance") return "/ambulance";
  if (m.slug === "ai_tests" || m.href.includes("/care/ai-tests")) return "/care/ai-tests";
  if (m.href.startsWith("/care")) return m.href;
  return `/care?tab=${m.slug}`;
}

type CareHubNavProps = {
  lang: "bn" | "en";
  activeTab?: string;
  variant?: "strip" | "grid";
  includeDashboard?: boolean;
  className?: string;
};

export function CareHubNav({
  lang,
  activeTab,
  variant = "strip",
  includeDashboard = false,
  className = "",
}: CareHubNavProps) {
  const navigate = useNavigate();
  const [modules, setModules] = useState<CareHubModule[]>([]);
  const [hasStaff, setHasStaff] = useState(false);
  const [homeDoctorOn, setHomeDoctorOn] = useState(false);
  const [homeDiagOn, setHomeDiagOn] = useState(false);

  useEffect(() => {
    void fetchCareHubModules().then((rows) => setModules(rows.filter((m) => m.is_enabled !== false)));
    void fetchMyCareMemberships().then((ms) => setHasStaff(ms.length > 0));
    void fetchCarePolicies().then(({ flags }) => {
      setHomeDoctorOn(flags.home_doctor === true);
      setHomeDiagOn(flags.home_diagnostic === true || flags.home_collection === true);
    });
  }, []);

  const visible = useMemo(() => {
    return modules
      .filter((m) => {
        if (m.slug === "dashboard") return includeDashboard;
        if (m.slug === "home_doctor") return homeDoctorOn;
        if (m.slug === "home_diagnostic") return homeDiagOn;
        if (m.audience === "staff") return hasStaff;
        return m.audience === "patient" || m.audience === "both" || !m.audience;
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [modules, hasStaff, includeDashboard, homeDoctorOn, homeDiagOn]);

  const itemClass = (slug: string, active: boolean) => {
    const accent = PATIENT_ACCENTS[slug] ?? PATIENT_ACCENTS.dashboard;
    const base =
      "group inline-flex shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg border bg-background/80 px-2 py-1 text-center shadow-sm transition-all duration-150 min-w-[3.5rem]";
    if (active) {
      return `${base} border-primary bg-primary/5 text-primary ring-1 ring-primary/25 shadow-sm`;
    }
    return `${base} ${accent}`;
  };

  const iconWrap = (active: boolean) => {
    const accent = active
      ? "bg-primary/10 text-primary border-primary/30"
      : "bg-muted/40 text-foreground border-border/80";
    return `grid h-7 w-7 place-items-center rounded-md border ${accent} transition-colors group-hover:scale-[1.02]`;
  };

  function renderItem(m: CareHubModule) {
    const Icon = ICONS[m.icon] ?? LayoutGrid;
    const label = lang === "bn" ? m.label_bn : m.label_en;
    const href = moduleHref(m);
    const isInternal = href.startsWith("/care?tab=");
    const tab = isInternal ? href.split("tab=")[1] : m.slug;
    const active = activeTab === tab;

    const inner = (
      <>
        <span className={iconWrap(active)}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <span className="text-[9px] font-semibold leading-none max-w-[3.5rem] truncate">{label}</span>
      </>
    );

    if (isInternal) {
      return (
        <button
          key={m.id}
          type="button"
          onClick={() => void navigate({ to: "/care", search: { tab } })}
          className={itemClass(m.slug, active)}
        >
          {inner}
        </button>
      );
    }

    return (
      <Link key={m.id} to={href} className={itemClass(m.slug, active)}>
        {inner}
      </Link>
    );
  }

  if (visible.length === 0) return null;

  if (variant === "grid") {
    return <div className={`grid grid-cols-3 sm:grid-cols-4 gap-1.5 ${className}`}>{visible.map(renderItem)}</div>;
  }

  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-1 px-0.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {lang === "bn" ? "কেয়ার সেবা" : "Care services"}
        </p>
        <Link to="/care" search={{ tab: "dashboard" }} className="text-[9px] font-semibold text-primary hover:underline">
          {lang === "bn" ? "সব দেখুন" : "See all"}
        </Link>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 no-scrollbar -mx-0.5 px-0.5">{visible.map(renderItem)}</div>
    </div>
  );
}
