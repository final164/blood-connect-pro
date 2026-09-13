import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Ambulance,
  ClipboardList,
  Droplets,
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
import { fetchBloodDonorAiSettings } from "@/lib/blood-donor-ai-settings";
import { cn } from "@/lib/utils";

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

const PATIENT_ACCENTS: Record<
  string,
  { border: string; text: string; iconBg: string }
> = {
  dashboard: {
    border: "border-sky-200",
    text: "text-sky-800",
    iconBg: "bg-sky-50 text-sky-700 border-sky-200",
  },
  doctors: {
    border: "border-teal-200",
    text: "text-teal-800",
    iconBg: "bg-teal-50 text-teal-700 border-teal-200",
  },
  ai_tests: {
    border: "border-violet-200",
    text: "text-violet-800",
    iconBg: "bg-violet-50 text-violet-700 border-violet-200",
  },
  tests: {
    border: "border-cyan-200",
    text: "text-cyan-800",
    iconBg: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  home_doctor: {
    border: "border-teal-200",
    text: "text-teal-900",
    iconBg: "bg-teal-50 text-teal-800 border-teal-200",
  },
  home_diagnostic: {
    border: "border-emerald-200",
    text: "text-emerald-900",
    iconBg: "bg-emerald-50 text-emerald-800 border-emerald-200",
  },
  operations: {
    border: "border-rose-200",
    text: "text-rose-800",
    iconBg: "bg-rose-50 text-rose-700 border-rose-200",
  },
  bookings: {
    border: "border-amber-200",
    text: "text-amber-900",
    iconBg: "bg-amber-50 text-amber-800 border-amber-200",
  },
  ambulance: {
    border: "border-orange-200",
    text: "text-orange-800",
    iconBg: "bg-orange-50 text-orange-700 border-orange-200",
  },
  video: {
    border: "border-blue-200",
    text: "text-blue-800",
    iconBg: "bg-blue-50 text-blue-700 border-blue-200",
  },
  desk: {
    border: "border-slate-200",
    text: "text-slate-800",
    iconBg: "bg-slate-50 text-slate-700 border-slate-200",
  },
  lab: {
    border: "border-indigo-200",
    text: "text-indigo-800",
    iconBg: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
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
  const [showDonorAi, setShowDonorAi] = useState(false);

  useEffect(() => {
    void fetchCareHubModules().then((rows) => setModules(rows.filter((m) => m.is_enabled !== false)));
    void fetchMyCareMemberships().then((ms) => setHasStaff(ms.length > 0));
    void fetchCarePolicies().then(({ flags }) => {
      setHomeDoctorOn(flags.home_doctor === true);
      setHomeDiagOn(flags.home_diagnostic === true || flags.home_collection === true);
    });
    void fetchBloodDonorAiSettings().then((s) => {
      setShowDonorAi(s.enabled && s.entry_points.care_hub);
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

  function renderItem(m: CareHubModule) {
    const Icon = ICONS[m.icon] ?? LayoutGrid;
    const label = lang === "bn" ? m.label_bn : m.label_en;
    const href = moduleHref(m);
    const isInternal = href.startsWith("/care?tab=");
    const tab = isInternal ? href.split("tab=")[1] : m.slug;
    const active = activeTab === tab;
    const accent = PATIENT_ACCENTS[m.slug] ?? PATIENT_ACCENTS.dashboard;

    const classNameItem = cn(
      "group inline-flex shrink-0 items-center gap-1.5 rounded-xl border bg-background px-2.5 py-2 text-left shadow-sm transition",
      active ? "border-primary bg-primary/5 text-primary ring-1 ring-primary/20" : cn(accent.border, accent.text),
    );

    const inner = (
      <>
        <span
          className={cn(
            "grid h-6 w-6 place-items-center rounded-md border",
            active ? "bg-primary/10 text-primary border-primary/30" : accent.iconBg,
          )}
        >
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </span>
        <span className="text-xs font-bold leading-none whitespace-nowrap">{label}</span>
      </>
    );

    if (isInternal) {
      return (
        <button
          key={m.id}
          type="button"
          onClick={() => void navigate({ to: "/care", search: { tab } })}
          className={classNameItem}
        >
          {inner}
        </button>
      );
    }

    return (
      <Link key={m.id} to={href} className={classNameItem}>
        {inner}
      </Link>
    );
  }

  if (visible.length === 0 && !showDonorAi) return null;

  if (variant === "grid") {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 ${className}`}>
        {showDonorAi && (
          <Link
            to="/ai/donors"
            className="group inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-background px-2.5 py-2 text-left text-rose-800 shadow-sm"
          >
            <span className="grid h-6 w-6 place-items-center rounded-md border bg-rose-50 text-rose-700 border-rose-200">
              <Droplets className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <span className="text-xs font-bold leading-none whitespace-nowrap">
              {lang === "bn" ? "ডোনার AI" : "Donor AI"}
            </span>
          </Link>
        )}
        {visible.map(renderItem)}
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-2.5 px-0.5">
        <button
          type="button"
          onClick={() => void navigate({ to: "/care", search: { tab: "dashboard" } })}
          className="h-8 w-8 shrink-0 rounded-xl bg-primary/10 text-primary grid place-items-center"
          title={lang === "bn" ? "কেয়ার হাব" : "Care hub"}
        >
          <LayoutGrid className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void navigate({ to: "/care", search: { tab: "dashboard" } })}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-sm font-extrabold tracking-tight truncate">
            {lang === "bn" ? "কেয়ার হাব" : "Care hub"}
          </p>
        </button>
        <Link
          to="/care/doctor/register"
          className="shrink-0 rounded-full bg-rose-50 text-rose-800 px-2.5 py-1 text-[10px] font-extrabold hover:bg-rose-100"
        >
          {lang === "bn" ? "ডাক্তার জয়েন" : "Join as doctor"}
        </Link>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar -mx-0.5 px-0.5">
        {showDonorAi && (
          <Link
            to="/ai/donors"
            className="group inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-rose-200 bg-background px-2.5 py-2 text-left text-rose-800 shadow-sm transition"
          >
            <span className="grid h-6 w-6 place-items-center rounded-md border bg-rose-50 text-rose-700 border-rose-200">
              <Droplets className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
            <span className="text-xs font-bold leading-none whitespace-nowrap">
              {lang === "bn" ? "ডোনার AI" : "Donor AI"}
            </span>
          </Link>
        )}
        {visible.map(renderItem)}
      </div>
    </div>
  );
}
