import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
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
  type LucideIcon,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { fetchCareHubModules, fetchCarePolicies, type CareHubModule } from "@/lib/care-cms";
import { fetchMyCareMemberships } from "@/lib/care-access";

const ICONS: Record<string, LucideIcon> = {
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

const MENU_ORDER = [
  "doctors",
  "video",
  "ai_tests",
  "home_doctor",
  "home_diagnostic",
  "tests",
  "ambulance",
  "bookings",
  "operations",
];

export function careModuleHref(m: CareHubModule): string {
  if (m.href.includes("/desk")) return "/care/portal/desk";
  if (m.href.includes("/portal/lab")) return "/care/portal/lab";
  if (m.href.includes("/portal/ambulance")) return "/care/portal/ambulance";
  if (m.href.includes("/portal/tele") || m.slug === "tele_desk") return "/care/portal/tele";
  if (m.slug === "video" || m.href.includes("/care/video")) return "/care/video";
  if (m.slug === "ambulance" || m.href === "/ambulance") return "/ambulance";
  if (m.slug === "ai_tests" || m.href.includes("/care/ai-tests")) return "/care/ai-tests";
  if (m.slug === "home_doctor" || m.href.includes("/home-doctor")) return "/care/home-doctor";
  if (m.slug === "home_diagnostic" || m.href.includes("/home-diagnostic")) {
    return "/care/home-diagnostic";
  }
  if (m.href.startsWith("/care?tab=")) return m.href;
  if (m.href.startsWith("/care/")) return m.href;
  return `/care?tab=${m.slug}`;
}

function isNewTile(m: CareHubModule) {
  const slug = m.slug.toLowerCase();
  const bn = m.label_bn.toLowerCase();
  const en = m.label_en.toLowerCase();
  return slug === "new" || slug === "whats_new" || bn.includes("নতুন") || en.includes("new");
}

/** 3-column Care service tiles — shown on the Care dashboard. */
export function CareServicesGrid({ className = "" }: { className?: string }) {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const [modules, setModules] = useState<CareHubModule[]>([]);
  const [hasStaff, setHasStaff] = useState(false);
  const [homeDoctorOn, setHomeDoctorOn] = useState(false);
  const [homeDiagOn, setHomeDiagOn] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([fetchCareHubModules(), fetchMyCareMemberships(), fetchCarePolicies()]).then(
      ([rows, ms, { flags }]) => {
        if (cancelled) return;
        setModules(rows.filter((m) => m.is_enabled !== false));
        setHasStaff(ms.length > 0);
        setHomeDoctorOn(flags.home_doctor === true);
        setHomeDiagOn(flags.home_diagnostic === true || flags.home_collection === true);
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => {
    const filtered = modules.filter((m) => {
      if (m.slug === "dashboard") return false;
      if (m.slug === "home_doctor") return homeDoctorOn;
      if (m.slug === "home_diagnostic") return homeDiagOn;
      if (m.audience === "staff") return hasStaff;
      return m.audience === "patient" || m.audience === "both" || !m.audience;
    });
    const rank = (slug: string) => {
      const i = MENU_ORDER.indexOf(slug);
      return i >= 0 ? i : 100 + slug.charCodeAt(0);
    };
    return [...filtered].sort((a, b) => {
      const ra = rank(a.slug);
      const rb = rank(b.slug);
      if (ra !== rb) return ra - rb;
      return a.sort_order - b.sort_order;
    });
  }, [modules, hasStaff, homeDoctorOn, homeDiagOn]);

  function openModule(m: CareHubModule) {
    const href = careModuleHref(m);
    if (href.startsWith("/care?tab=")) {
      const tab = href.split("tab=")[1]?.split("&")[0] || m.slug;
      void navigate({ to: "/care", search: { tab } });
      return;
    }
    void navigate({ to: href as never });
  }

  if (loading) {
    return (
      <div className={`grid grid-cols-3 gap-2.5 ${className}`}>
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-[5.5rem] rounded-2xl border bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (visible.length === 0) return null;

  return (
    <div className={`grid grid-cols-3 gap-2.5 ${className}`}>
      {visible.map((m) => {
        const Icon = ICONS[m.icon] ?? LayoutGrid;
        const label = lang === "bn" ? m.label_bn : m.label_en;
        const neu = isNewTile(m);
        return (
          <button
            key={m.id}
            type="button"
            onClick={() => openModule(m)}
            className={[
              "flex flex-col items-center justify-center gap-2 rounded-2xl border bg-card px-2 py-3.5 text-center transition",
              "hover:bg-muted/40 active:scale-[0.98]",
              neu
                ? "border-primary/50 bg-primary/5 text-primary shadow-sm"
                : "border-border text-foreground",
            ].join(" ")}
          >
            <span
              className={[
                "grid h-10 w-10 place-items-center rounded-xl",
                neu ? "bg-primary/10 text-primary" : "bg-muted/60 text-foreground",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <span className="text-[11px] font-semibold leading-tight line-clamp-2 min-h-[1.6rem]">
              {label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
