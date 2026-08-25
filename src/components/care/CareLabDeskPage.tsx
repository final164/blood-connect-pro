import { Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronRight,
  FlaskConical,
  LogOut,
  Microscope,
  Phone,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useHideOnScroll } from "@/hooks/useHideOnScroll";
import { InfiniteSentinel } from "@/components/InfiniteSentinel";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";
import { careHasPermission, fetchMyCareMemberships, type CareMembership } from "@/lib/care-access";
import type { CarePermissionKey } from "@/lib/care-permissions";
import { fetchLabDeskPageSize, fetchTestCatalog } from "@/lib/care-cms";
import {
  fetchOrgLabBookings,
  fetchOrgOfferings,
  generateLabDay,
  remainingSeats,
  fetchLabCalendars,
  setLabBookingStatus,
  fetchLabBookingsForInvoice,
} from "@/lib/care-lab-api";
import {
  clampDiscountPercent,
  offeringSalePrice,
} from "@/lib/care-lab-price";
import { CareLabPriceDisplay } from "@/components/care/CareLabPriceDisplay";
import { fetchOrgLocations } from "@/lib/care-api";
import { supabase } from "@/integrations/supabase/client";
import { CareLabInvoiceCard } from "@/components/care/CareLabInvoice";
import { formatCareMoney } from "@/lib/care-invoice";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type LabTab = "today" | "offerings" | "calendar" | "checkin";

type CareLabDeskPageProps = {
  portalMode?: boolean;
};

type DeskBookingRow = Record<string, unknown> & {
  id: string;
  offering_id?: string | null;
  guest_name?: string | null;
  guest_phone?: string | null;
  profile_name?: string | null;
  profile_phone?: string | null;
  status?: string;
  source?: string | null;
  reference_code?: string;
  invoice_no?: string | null;
  invoice_group_id?: string | null;
  payment_status?: string | null;
  price?: number | null;
  price_original?: number | null;
  discount_percent?: number | null;
  created_at?: string;
  care_test_offerings?: {
    care_test_catalog?: { name_bn?: string; name_en?: string; code?: string };
  } | null;
};

const LAB_FLOW = ["reserved", "checked_in", "sample_taken", "completed"] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function patientName(r: DeskBookingRow, lang: "bn" | "en") {
  return (
    String(r.guest_name || "").trim() ||
    String(r.profile_name || "").trim() ||
    (lang === "bn" ? "রোগী" : "Patient")
  );
}

function patientPhone(r: DeskBookingRow) {
  return String(r.guest_phone || r.profile_phone || "").trim() || "—";
}

function bookingDateLabel(r: DeskBookingRow, fallbackDate: string) {
  const raw = String(r.created_at || "");
  if (raw.length >= 10) return raw.slice(0, 10);
  return fallbackDate;
}

function statusStepIndex(status: string) {
  if (status === "confirmed") return 0;
  const i = LAB_FLOW.indexOf(status as (typeof LAB_FLOW)[number]);
  return i >= 0 ? i : status === "cancelled" || status === "no_show" ? -1 : 0;
}

function statusLabel(status: string, lang: "bn" | "en") {
  const map: Record<string, { bn: string; en: string }> = {
    reserved: { bn: "বুকড", en: "Reserved" },
    confirmed: { bn: "কনফার্মড", en: "Confirmed" },
    checked_in: { bn: "চেক-ইন", en: "Checked in" },
    sample_taken: { bn: "নমুনা নেওয়া", en: "Sample taken" },
    completed: { bn: "সম্পন্ন", en: "Completed" },
    cancelled: { bn: "বাতিল", en: "Cancelled" },
    no_show: { bn: "নো-শো", en: "No-show" },
  };
  const row = map[status];
  if (!row) return status;
  return lang === "bn" ? row.bn : row.en;
}

function statusTone(status: string) {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  if (status === "cancelled" || status === "no_show") return "bg-destructive/10 text-destructive border-destructive/30";
  if (status === "checked_in" || status === "sample_taken") return "bg-sky-500/10 text-sky-700 border-sky-500/30";
  return "bg-amber-500/10 text-amber-800 border-amber-500/30";
}

function LabStepActions({
  status,
  lang,
  busy,
  disabled,
  onAdvance,
  compact = false,
}: {
  status: string;
  lang: "bn" | "en";
  busy?: boolean;
  disabled?: boolean;
  onAdvance: (status: string) => void;
  compact?: boolean;
}) {
  const st = status;
  if (st === "completed" || st === "cancelled" || st === "no_show") return null;

  const btn = compact
    ? "rounded-lg border-2 px-2 py-1.5 text-[10px] font-bold disabled:opacity-50 transition"
    : "rounded-lg border-2 px-2.5 py-1.5 text-[11px] font-bold disabled:opacity-50 transition";

  return (
    <div className={cn("flex flex-wrap gap-1.5", compact && "justify-end")}>
      {st !== "checked_in" && st !== "sample_taken" && (
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => onAdvance("checked_in")}
          className={cn(btn, "border-sky-500/40 bg-sky-500/5 text-sky-700 hover:bg-sky-500 hover:text-white")}
        >
          {lang === "bn" ? "চেক-ইন" : "Check-in"}
        </button>
      )}
      {st !== "sample_taken" && (
        <button
          type="button"
          disabled={busy || disabled}
          onClick={() => onAdvance("sample_taken")}
          className={cn(
            btn,
            "border-violet-500/40 bg-violet-500/5 text-violet-700 hover:bg-violet-500 hover:text-white",
          )}
        >
          {lang === "bn" ? "নমুনা" : "Sample"}
        </button>
      )}
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => onAdvance("completed")}
        className={cn(
          btn,
          "border-emerald-500/40 bg-emerald-500/5 text-emerald-700 hover:bg-emerald-500 hover:text-white",
        )}
      >
        {lang === "bn" ? "সম্পন্ন" : "Done"}
      </button>
      <button
        type="button"
        disabled={busy || disabled}
        onClick={() => onAdvance("no_show")}
        className={cn(
          btn,
          "border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive hover:text-white",
        )}
      >
        {lang === "bn" ? "নো-শো" : "No-show"}
      </button>
    </div>
  );
}

function LabProgressBar({
  status,
  lang,
}: {
  status: string;
  lang: "bn" | "en";
}) {
  const terminal = status === "cancelled" || status === "no_show";
  const step = statusStepIndex(status);
  const labels =
    lang === "bn"
      ? ["বুকড", "চেক-ইন", "নমুনা", "সম্পন্ন"]
      : ["Booked", "Check-in", "Sample", "Done"];

  if (terminal) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2.5">
        <div className="h-2 rounded-full bg-destructive/20 overflow-hidden">
          <div className="h-full w-full bg-destructive/70" />
        </div>
        <p className="mt-2 text-xs font-semibold text-destructive">{statusLabel(status, lang)}</p>
      </div>
    );
  }

  const pct = Math.round(((step + 1) / LAB_FLOW.length) * 100);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-muted-foreground">
          {lang === "bn" ? "অগ্রগতি" : "Progress"}
        </span>
        <span className="font-bold tabular-nums text-primary">{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="grid grid-cols-4 gap-1">
        {labels.map((label, i) => {
          const done = i <= step;
          const current = i === step;
          return (
            <div key={label} className="flex flex-col items-center gap-1 min-w-0">
              <span
                className={cn(
                  "h-6 w-6 rounded-full border grid place-items-center text-[10px] font-bold",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/25 text-muted-foreground",
                  current && "ring-2 ring-primary/30",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[9px] font-semibold truncate w-full text-center",
                  done ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CareLabDeskPage({ portalMode = false }: CareLabDeskPageProps) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const authPath = portalMode ? "/care/auth" : "/auth";
  const homePath = portalMode ? "/care/portal" : "/care";
  const [memberships, setMemberships] = useState<CareMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<LabTab>("today");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      void navigate({ to: authPath, search: {} } as never);
      return;
    }
    void fetchMyCareMemberships().then((rows) => {
      const active = rows.filter((r) => r.care_orgs?.is_active !== false);
      if (!active.length) {
        toast.error(lang === "bn" ? "ল্যাব মেম্বারশিপ নেই" : "No lab membership");
        void navigate({ to: portalMode ? "/care/auth" : "/care", search: portalMode ? { mode: undefined, next: undefined } : undefined } as never);
        return;
      }
      setMemberships(active);
      setOrgId((prev) => prev ?? active[0]!.org_id);
      setReady(true);
    });
  }, [loading, user, navigate, lang, authPath, portalMode]);

  async function handleSignOut() {
    await signOut();
    void navigate({ to: authPath, search: {} } as never);
  }

  const membership = useMemo(() => memberships.find((m) => m.org_id === orgId) ?? null, [memberships, orgId]);
  const can = (key: CarePermissionKey) => careHasPermission(membership, key);
  const org = membership?.care_orgs;
  const orgName = lang === "bn" ? org?.name_bn || org?.name : org?.name;
  const headerHidden = useHideOnScroll({ threshold: 12, topReveal: 48 });

  if (!ready || !orgId || !membership) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const tabs: { id: LabTab; label: string; show: boolean }[] = [
    { id: "today", label: lang === "bn" ? "আজকের বুকিং" : "Today", show: can("lab.checkin") || can("overview.view") },
    { id: "offerings", label: lang === "bn" ? "অফার" : "Offerings", show: can("lab.offerings") },
    { id: "calendar", label: lang === "bn" ? "ক্যালেন্ডার" : "Calendar", show: can("lab.calendar") },
    { id: "checkin", label: lang === "bn" ? "চেক-ইন" : "Check-in", show: can("lab.checkin") },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header
        className={cn(
          "sticky top-0 z-20 border-b bg-card",
          "transition-transform duration-200 ease-out will-change-transform",
          headerHidden ? "-translate-y-full pointer-events-none" : "translate-y-0",
        )}
        data-header-hidden={headerHidden ? "true" : "false"}
      >
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <PageBackButton fallbackTo={homePath} shape="xl" />
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Microscope className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {lang === "bn" ? "ল্যাব ডেস্ক" : "Lab desk"}
            </p>
            <h1 className="truncate text-base font-bold">{orgName}</h1>
          </div>
          {memberships.length > 1 && (
            <select className="max-w-40 rounded-xl border px-2 py-2 text-xs" value={orgId} onChange={(e) => setOrgId(e.target.value)}>
              {memberships.map((m) => (
                <option key={m.org_id} value={m.org_id}>
                  {lang === "bn" ? m.care_orgs?.name_bn || m.care_orgs?.name : m.care_orgs?.name}
                </option>
              ))}
            </select>
          )}
          <Link to={homePath} className="rounded-xl border px-2.5 py-2 text-xs font-medium">
            {portalMode ? (lang === "bn" ? "পোর্টাল" : "Portal") : lang === "bn" ? "কেয়ার" : "Care"}
          </Link>
          <button type="button" onClick={() => void handleSignOut()} className="h-9 w-9 grid place-items-center rounded-xl border">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                  tab === t.id ? "bg-primary text-primary-foreground" : "border text-muted-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4">
        {(tab === "today" || tab === "checkin") && (
          <TodayPanel orgId={orgId} canManage={can("lab.checkin")} lang={lang} chromeHidden={headerHidden} />
        )}
        {tab === "offerings" && <OfferingsPanel orgId={orgId} lang={lang} />}
        {tab === "calendar" && <CalendarPanel orgId={orgId} lang={lang} />}
      </main>
    </div>
  );
}

function TodayPanel({
  orgId,
  canManage,
  lang,
  chromeHidden = false,
}: {
  orgId: string;
  canManage: boolean;
  lang: "bn" | "en";
  chromeHidden?: boolean;
}) {
  const [date, setDate] = useState(todayIso());
  const [rows, setRows] = useState<DeskBookingRow[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const loadingMoreRef = useRef(false);
  const [offerings, setOfferings] = useState<{ id: string; label: string }[]>([]);
  const [invoiceBookingId, setInvoiceBookingId] = useState<string | null>(null);
  const [autoPrintInvoice, setAutoPrintInvoice] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<DeskBookingRow[]>([]);
  const [detailBusy, setDetailBusy] = useState(false);
  const [rowBusyId, setRowBusyId] = useState<string | null>(null);

  // Live filters (apply immediately)
  const [q, setQ] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterOfferingId, setFilterOfferingId] = useState("all");
  const [filterPayment, setFilterPayment] = useState("all");

  useEffect(() => {
    void fetchLabDeskPageSize().then(setPageSize);
  }, []);

  async function reloadOfferings() {
    const offs = (await fetchOrgOfferings(orgId)) as {
      id: string;
      care_test_catalog?: { code?: string; name_bn?: string; name_en?: string };
    }[];
    setOfferings(
      offs.map((o) => ({
        id: o.id,
        label: `${o.care_test_catalog?.code ?? ""} · ${lang === "bn" ? o.care_test_catalog?.name_bn : o.care_test_catalog?.name_en}`,
      })),
    );
  }

  async function reload() {
    setLoading(true);
    try {
      const [{ rows: page, hasMore: more }] = await Promise.all([
        fetchOrgLabBookings(orgId, date, { limit: pageSize, offset: 0 }),
        reloadOfferings(),
      ]);
      setRows(page as DeskBookingRow[]);
      setHasMore(more);
    } finally {
      setLoading(false);
    }
  }

  const loadMore = useCallback(() => {
    if (loadingMoreRef.current || !hasMore || loading) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    void fetchOrgLabBookings(orgId, date, { limit: pageSize, offset: rowsRef.current.length })
      .then(({ rows: page, hasMore: more }) => {
        setRows((prev) => {
          const seen = new Set(prev.map((r) => String(r.id)));
          const next = (page as DeskBookingRow[]).filter((r) => !seen.has(String(r.id)));
          return next.length ? [...prev, ...next] : prev;
        });
        setHasMore(more);
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => {
        setLoadingMore(false);
        loadingMoreRef.current = false;
      });
  }, [orgId, date, pageSize, hasMore, loading]);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, date, pageSize]);

  const sentinelRef = useInfiniteScroll(loadMore, {
    enabled: hasMore && !loading && !loadingMore,
    rootMargin: "320px",
  });
  useEffect(() => {
    if (!detailId) {
      setDetailRows([]);
      return;
    }
    let cancelled = false;
    void fetchLabBookingsForInvoice(detailId).then((list) => {
      if (cancelled) return;
      setDetailRows(
        list.map((b) => {
          const fromList = rows.find((r) => r.id === b.id);
          const raw = b as DeskBookingRow;
          return {
            ...raw,
            care_test_offerings:
              raw.care_test_offerings ?? fromList?.care_test_offerings ?? null,
            profile_name: fromList?.profile_name ?? null,
            profile_phone: fromList?.profile_phone ?? null,
          };
        }),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [detailId, rows]);

  async function advanceStatus(bookingId: string, status: string) {
    setDetailBusy(true);
    setRowBusyId(bookingId);
    try {
      await setLabBookingStatus(bookingId, status);
      await reload();
      if (detailId) {
        const list = await fetchLabBookingsForInvoice(detailId);
        setDetailRows(
          list.map((b) => {
            const fromList = rows.find((r) => r.id === b.id);
            const raw = b as DeskBookingRow;
            return {
              ...raw,
              care_test_offerings:
                raw.care_test_offerings ?? fromList?.care_test_offerings ?? null,
              profile_name: fromList?.profile_name ?? null,
              profile_phone: fromList?.profile_phone ?? null,
            };
          }),
        );
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDetailBusy(false);
      setRowBusyId(null);
    }
  }

  const filtersActive =
    q.trim() !== "" ||
    filterStatus !== "all" ||
    filterOfferingId !== "all" ||
    filterPayment !== "all";

  function resetFilters() {
    setQ("");
    setFilterStatus("all");
    setFilterOfferingId("all");
    setFilterPayment("all");
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      const st = String(r.status || "reserved");
      if (filterStatus !== "all" && st !== filterStatus) {
        if (!(filterStatus === "reserved" && st === "confirmed")) return false;
      }
      if (filterOfferingId !== "all" && String(r.offering_id || "") !== filterOfferingId) return false;
      if (filterPayment !== "all" && String(r.payment_status || "pending") !== filterPayment) return false;

      if (!needle) return true;
      const cat = r.care_test_offerings?.care_test_catalog;
      const hay = [
        patientName(r, lang),
        patientPhone(r),
        r.reference_code,
        r.invoice_no,
        cat?.code,
        cat?.name_bn,
        cat?.name_en,
        r.status,
        r.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q, lang, filterStatus, filterOfferingId, filterPayment]);

  // Keep fetching pages while filters leave the visible list empty
  useEffect(() => {
    if (!filtersActive || loading || loadingMore || !hasMore) return;
    if (filtered.length > 0) return;
    loadMore();
  }, [filtersActive, filtered.length, hasMore, loading, loadingMore, loadMore]);

  const statusOptions = [
    { value: "all", bn: "সব স্ট্যাটাস", en: "All status" },
    { value: "reserved", bn: "বুকড", en: "Booked" },
    { value: "checked_in", bn: "চেক-ইন", en: "Checked in" },
    { value: "sample_taken", bn: "নমুনা", en: "Sample" },
    { value: "completed", bn: "সম্পন্ন", en: "Completed" },
    { value: "no_show", bn: "নো-শো", en: "No-show" },
    { value: "cancelled", bn: "বাতিল", en: "Cancelled" },
  ];

  const detailPrimary =
    detailRows.find((r) => r.id === detailId) ?? detailRows[0] ?? rows.find((r) => r.id === detailId) ?? null;

  return (
    <div className="space-y-3">
      <div
        className={cn(
          "sticky top-[6.75rem] z-10 -mx-4 px-4 py-2 bg-background border-b",
          "transition-transform duration-200 ease-out will-change-transform",
          chromeHidden ? "-translate-y-[calc(100%+7rem)] pointer-events-none" : "translate-y-0",
        )}
        data-filter-hidden={chromeHidden ? "true" : "false"}
      >
        <div className="rounded-2xl border bg-card p-3 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "সার্চ ও ফিল্টার" : "Search & filters"}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            disabled={!filtersActive}
            className="rounded-lg border px-2.5 py-1 text-[11px] font-bold text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            {lang === "bn" ? "রিসেট" : "Reset"}
          </button>
        </div>

        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={lang === "bn" ? "নাম / ফোন / টেস্ট লিখুন…" : "Type name / phone / test…"}
          className="w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          autoComplete="off"
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-xl border bg-background px-2.5 py-2 text-xs font-semibold"
          />

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border bg-background px-2.5 py-2 text-xs font-semibold"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {lang === "bn" ? o.bn : o.en}
              </option>
            ))}
          </select>

          <select
            value={filterOfferingId}
            onChange={(e) => setFilterOfferingId(e.target.value)}
            className="rounded-xl border bg-background px-2.5 py-2 text-xs font-semibold"
          >
            <option value="all">{lang === "bn" ? "সব টেস্ট" : "All tests"}</option>
            {offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={filterPayment}
            onChange={(e) => setFilterPayment(e.target.value)}
            className="rounded-xl border bg-background px-2.5 py-2 text-xs font-semibold"
          >
            <option value="all">{lang === "bn" ? "সব পেমেন্ট" : "All payments"}</option>
            <option value="pending">{lang === "bn" ? "বাকি" : "Pending"}</option>
            <option value="paid">{lang === "bn" ? "পেইড" : "Paid"}</option>
            <option value="waived">{lang === "bn" ? "মওকুফ" : "Waived"}</option>
          </select>
        </div>

        <p className="text-[11px] text-muted-foreground">
          {lang === "bn"
            ? `${filtered.length}টি দেখাচ্ছে · ${rows.length} লোড${hasMore ? " · আরও আছে" : ""}`
            : `Showing ${filtered.length} · ${rows.length} loaded${hasMore ? " · more available" : ""}`}
          {filtersActive ? (lang === "bn" ? " · ফিল্টার অন" : " · filters on") : ""}
          {` · ${lang === "bn" ? `পেজ ${pageSize}` : `page ${pageSize}`}`}
        </p>
        </div>
      </div>

      <ul className="space-y-2">
        {loading && rows.length === 0 && (
          <li className="rounded-2xl border bg-card px-3 py-10 text-center text-xs text-muted-foreground">
            {lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}
          </li>
        )}
        {filtered.map((r) => {
          const cat = r.care_test_offerings?.care_test_catalog;
          const name = patientName(r, lang);
          const phone = patientPhone(r);
          const day = bookingDateLabel(r, date);
          const st = String(r.status || "reserved");
          return (
            <li
              key={String(r.id)}
              className="rounded-2xl border bg-card px-3 py-3 shadow-sm hover:border-primary/25 transition"
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 h-8 w-8 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                      <UserRound className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{name}</p>
                      <p className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {phone}
                        </span>
                        <span>·</span>
                        <span className="tabular-nums">{day}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pl-10">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold">
                      <FlaskConical className="h-3.5 w-3.5 text-primary" />
                      {lang === "bn" ? cat?.name_bn : cat?.name_en}
                    </span>
                    {r.price != null ? (
                      <CareLabPriceDisplay
                        listPrice={
                          r.price_original != null && Number(r.price_original) > Number(r.price)
                            ? Number(r.price_original)
                            : Number(r.price)
                        }
                        salePrice={Number(r.price)}
                        discountPercent={r.discount_percent}
                        lang={lang}
                        variant="inline"
                        className="text-[11px]"
                      />
                    ) : null}
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                        statusTone(st),
                      )}
                    >
                      {statusLabel(st, lang)}
                    </span>
                  </div>

                  <div className="pl-10 max-w-xs">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          st === "cancelled" || st === "no_show" ? "bg-destructive/70" : "bg-primary",
                        )}
                        style={{
                          width:
                            st === "cancelled" || st === "no_show"
                              ? "100%"
                              : `${Math.round(((statusStepIndex(st) + 1) / LAB_FLOW.length) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Mobile only: details sheet */}
                <button
                  type="button"
                  onClick={() => setDetailId(String(r.id))}
                  className="sm:hidden shrink-0 inline-flex items-center gap-1 rounded-xl border-2 border-primary/40 bg-primary/5 px-3 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition"
                >
                  {lang === "bn" ? "বিস্তারিত" : "Details"}
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>

                {/* Desktop / tablet: step buttons replace details icon */}
                <div className="hidden sm:flex shrink-0 flex-col items-end gap-2 min-w-[11.5rem]">
                  {canManage && st !== "completed" && st !== "cancelled" && st !== "no_show" ? (
                    <LabStepActions
                      status={st}
                      lang={lang}
                      compact
                      busy={rowBusyId === String(r.id)}
                      onAdvance={(next) => void advanceStatus(String(r.id), next)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setAutoPrintInvoice(false);
                        setInvoiceBookingId(String(r.id));
                      }}
                      className="inline-flex items-center gap-1 rounded-xl border-2 border-primary/40 bg-primary/5 px-3 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition"
                    >
                      {lang === "bn" ? "ইনভয়েস" : "Invoice"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
        {filtered.length === 0 && !loading && (
          <li className="rounded-2xl border bg-card px-3 py-10 text-center text-xs text-muted-foreground space-y-2">
            <p>
              {rows.length === 0
                ? lang === "bn"
                  ? "বুকিং নেই"
                  : "No bookings"
                : hasMore
                  ? lang === "bn"
                    ? "খুঁজছে…"
                    : "Searching…"
                  : lang === "bn"
                    ? "ফিল্টারে কোনো বুকিং মেলেনি"
                    : "No bookings match filters"}
            </p>
            {filtersActive && rows.length > 0 && !hasMore && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-bold text-primary"
              >
                {lang === "bn" ? "ফিল্টার রিসেট" : "Reset filters"}
              </button>
            )}
          </li>
        )}
      </ul>

      <InfiniteSentinel
        sentinelRef={sentinelRef}
        loading={loadingMore}
        hasMore={hasMore}
        label={lang === "bn" ? "আরও বুকিং লোড…" : "Loading more bookings…"}
      />
      <Sheet open={!!detailId} onOpenChange={(open) => !open && setDetailId(null)}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-2xl px-0">
          {detailPrimary && (
            <>
              <SheetHeader className="px-4 text-left space-y-1">
                <SheetTitle>{lang === "bn" ? "বুকিং ডিটেইলস" : "Booking details"}</SheetTitle>
                <SheetDescription>
                  {lang === "bn"
                    ? "রোগী, ইনভয়েস ও টেস্টের অগ্রগতি এক জায়গায়।"
                    : "Patient, invoice and test progress in one place."}
                </SheetDescription>
              </SheetHeader>

              <div className="px-4 py-4 space-y-4">
                <div className="rounded-2xl border bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="h-11 w-11 rounded-2xl bg-primary/15 text-primary grid place-items-center shrink-0">
                      <UserRound className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-bold">{patientName(detailPrimary, lang)}</p>
                      <p className="text-sm text-muted-foreground inline-flex items-center gap-1.5 mt-0.5">
                        <Phone className="h-3.5 w-3.5" />
                        {patientPhone(detailPrimary)}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                        {lang === "bn" ? "তারিখ" : "Date"} · {bookingDateLabel(detailPrimary, date)}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[10px] font-bold shrink-0",
                        statusTone(String(detailPrimary.status || "")),
                      )}
                    >
                      {statusLabel(String(detailPrimary.status || ""), lang)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-xl border bg-background/80 px-3 py-2">
                      <p className="text-muted-foreground font-semibold uppercase tracking-wide">
                        {lang === "bn" ? "রেফারেন্স" : "Reference"}
                      </p>
                      <p className="font-mono font-bold mt-0.5">{String(detailPrimary.reference_code || "—")}</p>
                    </div>
                    <div className="rounded-xl border bg-background/80 px-3 py-2">
                      <p className="text-muted-foreground font-semibold uppercase tracking-wide">
                        {lang === "bn" ? "ইনভয়েস" : "Invoice"}
                      </p>
                      <p className="font-mono font-bold mt-0.5 truncate">
                        {String(detailPrimary.invoice_no || detailPrimary.reference_code || "—")}
                      </p>
                    </div>
                  </div>
                </div>

                <LabProgressBar status={String(detailPrimary.status || "reserved")} lang={lang} />

                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    {lang === "bn"
                      ? `টেস্ট (${Math.max(detailRows.length, 1)})`
                      : `Tests (${Math.max(detailRows.length, 1)})`}
                  </p>
                  <ul className="space-y-2">
                    {(detailRows.length ? detailRows : [detailPrimary]).map((t) => {
                      const cat = t.care_test_offerings?.care_test_catalog;
                      const st = String(t.status || "reserved");
                      return (
                        <li key={String(t.id)} className="rounded-xl border px-3 py-2.5 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {lang === "bn" ? cat?.name_bn : cat?.name_en}
                              </p>
                              <p className="text-[10px] text-muted-foreground font-mono">
                                {String(t.reference_code || "")}
                              </p>
                            </div>
                            {t.price != null ? (
                              <span className="text-xs font-bold tabular-nums text-primary shrink-0">
                                {formatCareMoney(Number(t.price), lang)}
                              </span>
                            ) : null}
                          </div>
                          <LabProgressBar status={st} lang={lang} />
                          {canManage && (
                            <LabStepActions
                              status={st}
                              lang={lang}
                              busy={detailBusy}
                              onAdvance={(next) => void advanceStatus(String(t.id), next)}
                            />
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setAutoPrintInvoice(false);
                    setInvoiceBookingId(String(detailPrimary.id));
                  }}
                  className="w-full rounded-xl border-2 border-primary bg-primary/5 px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary hover:text-primary-foreground transition"
                >
                  {lang === "bn" ? "ইনভয়েস দেখুন / প্রিন্ট" : "View / print invoice"}
                </button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog
        open={!!invoiceBookingId}
        onOpenChange={(open) => {
          if (!open) {
            setInvoiceBookingId(null);
            setAutoPrintInvoice(false);
          }
        }}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lang === "bn" ? "টেস্ট বুকিং ইনভয়েস" : "Test booking invoice"}</DialogTitle>
          </DialogHeader>
          {invoiceBookingId && (
            <CareLabInvoiceCard
              bookingId={invoiceBookingId}
              canManagePayment={canManage}
              autoPrint={autoPrintInvoice}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OfferingsPanel({ orgId, lang }: { orgId: string; lang: "bn" | "en" }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [catalog, setCatalog] = useState<{ id: string; code: string; name_en: string; name_bn: string }[]>([]);
  const [locs, setLocs] = useState<{ id: string; name: string }[]>([]);
  const [catalogId, setCatalogId] = useState("");
  const [locId, setLocId] = useState("");
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [cap, setCap] = useState("40");
  const [mode, setMode] = useState("day_quota");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editDisc, setEditDisc] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  async function reload() {
    setRows((await fetchOrgOfferings(orgId)) as Record<string, unknown>[]);
    const locations = (await fetchOrgLocations(orgId)) as { id: string; name: string }[];
    setLocs(locations);
    if (!locId && locations[0]) setLocId(locations[0].id);
  }

  useEffect(() => {
    void reload();
    void fetchTestCatalog().then((c) => {
      setCatalog(c);
      if (c[0]) setCatalogId(c[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  const previewSale = offeringSalePrice({
    price: Number(price) || 0,
    discount_percent: clampDiscountPercent(discount),
  });

  async function add() {
    const list = Number(price);
    if (!Number.isFinite(list) || list < 0) {
      toast.error(lang === "bn" ? "সঠিক দাম দিন" : "Enter a valid price");
      return;
    }
    const disc = clampDiscountPercent(discount);
    const { error } = await supabase.from("care_test_offerings").insert({
      org_id: orgId,
      location_id: locId,
      catalog_id: catalogId,
      price: list,
      discount_percent: disc,
      booking_mode: mode,
      default_capacity: Number(cap) || 40,
    } as never);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "bn" ? "অফার যোগ হয়েছে" : "Offering added");
      setPrice("");
      setDiscount("");
      await reload();
    }
  }

  async function toggle(id: string, isActive: boolean) {
    const { error } = await supabase.from("care_test_offerings").update({ is_active: !isActive } as never).eq("id", id);
    if (error) toast.error(error.message);
    else await reload();
  }

  function startEdit(r: Record<string, unknown>) {
    setEditingId(String(r.id));
    setEditPrice(String(r.price ?? ""));
    setEditDisc(String(Number(r.discount_percent ?? 0) || ""));
  }

  async function saveEdit(id: string) {
    const list = Number(editPrice);
    if (!Number.isFinite(list) || list < 0) {
      toast.error(lang === "bn" ? "সঠিক দাম দিন" : "Enter a valid price");
      return;
    }
    const disc = clampDiscountPercent(editDisc);
    setSavingId(id);
    const { error } = await supabase
      .from("care_test_offerings")
      .update({ price: list, discount_percent: disc } as never)
      .eq("id", id);
    setSavingId(null);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "bn" ? "দাম ও ছাড় সেভ" : "Price & discount saved");
      setEditingId(null);
      await reload();
    }
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border bg-card p-3 space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
          {lang === "bn" ? "নতুন টেস্ট অফার" : "New test offering"}
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={catalogId} onChange={(e) => setCatalogId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            {catalog.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} · {lang === "bn" ? c.name_bn : c.name_en}
              </option>
            ))}
          </select>
          <select value={locId} onChange={(e) => setLocId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            {locs.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {lang === "bn" ? "মূল দাম (MRP) ৳" : "List price (MRP) ৳"}
            </span>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              placeholder="500"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-semibold text-muted-foreground">
              {lang === "bn" ? "ছাড় %" : "Discount %"}
            </span>
            <input
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              inputMode="decimal"
              placeholder="0–100"
              className="w-full rounded-xl border px-3 py-2 text-sm"
            />
          </label>
          <input value={cap} onChange={(e) => setCap(e.target.value)} placeholder="capacity" className="rounded-xl border px-3 py-2 text-sm" />
          <select value={mode} onChange={(e) => setMode(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
            <option value="day_quota">{lang === "bn" ? "দৈনিক কোটা" : "Day quota"}</option>
            <option value="slot">{lang === "bn" ? "সময় স্লট" : "Time slot"}</option>
          </select>
        </div>
        {(Number(price) > 0 || clampDiscountPercent(discount) > 0) && (
          <div className="rounded-xl border border-dashed bg-muted/30 px-3 py-2 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {lang === "bn" ? "রোগী দেখবে" : "Patient sees"}
            </span>
            <CareLabPriceDisplay
              listPrice={Number(price) || 0}
              salePrice={previewSale}
              discountPercent={clampDiscountPercent(discount)}
              lang={lang}
              variant="inline"
            />
          </div>
        )}
        <button
          type="button"
          onClick={() => void add()}
          className="w-full sm:w-auto rounded-xl bg-primary text-primary-foreground px-4 py-2 text-xs font-semibold"
        >
          {lang === "bn" ? "অফার যোগ" : "Add offering"}
        </button>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => {
          const cat = r.care_test_catalog as { name_bn?: string; name_en?: string; code?: string } | null;
          const list = Number(r.price ?? 0);
          const disc = clampDiscountPercent(r.discount_percent);
          const isEditing = editingId === String(r.id);
          return (
            <li key={String(r.id)} className="rounded-xl border px-3 py-2.5 text-sm space-y-2">
              <div className="flex items-start gap-2">
                <FlaskConical className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate">
                    {cat?.code} · {lang === "bn" ? cat?.name_bn : cat?.name_en}
                  </p>
                  {!isEditing ? (
                    <div className="mt-1">
                      <CareLabPriceDisplay
                        listPrice={list}
                        discountPercent={disc}
                        lang={lang}
                        variant="inline"
                      />
                    </div>
                  ) : (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <label className="block space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {lang === "bn" ? "মূল দাম ৳" : "List ৳"}
                        </span>
                        <input
                          value={editPrice}
                          onChange={(e) => setEditPrice(e.target.value)}
                          className="w-full rounded-lg border px-2.5 py-1.5 text-sm"
                        />
                      </label>
                      <label className="block space-y-1">
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {lang === "bn" ? "ছাড় %" : "Discount %"}
                        </span>
                        <input
                          value={editDisc}
                          onChange={(e) => setEditDisc(e.target.value)}
                          className="w-full rounded-lg border px-2.5 py-1.5 text-sm"
                        />
                      </label>
                      <div className="sm:col-span-2">
                        <CareLabPriceDisplay
                          listPrice={Number(editPrice) || 0}
                          discountPercent={clampDiscountPercent(editDisc)}
                          lang={lang}
                          variant="inline"
                        />
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {!isEditing ? (
                    <button
                      type="button"
                      className="text-[11px] font-semibold text-primary hover:underline"
                      onClick={() => startEdit(r)}
                    >
                      {lang === "bn" ? "দাম/ছাড়" : "Price/%"}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={savingId === String(r.id)}
                        className="text-[11px] font-semibold text-emerald-700"
                        onClick={() => void saveEdit(String(r.id))}
                      >
                        {savingId === String(r.id)
                          ? lang === "bn"
                            ? "সেভ…"
                            : "Saving…"
                          : lang === "bn"
                            ? "সেভ"
                            : "Save"}
                      </button>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground"
                        onClick={() => setEditingId(null)}
                      >
                        {lang === "bn" ? "বাতিল" : "Cancel"}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    className="text-[11px] font-semibold"
                    onClick={() => void toggle(String(r.id), !!r.is_active)}
                  >
                    {r.is_active ? (lang === "bn" ? "বন্ধ" : "Off") : lang === "bn" ? "চালু" : "On"}
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CalendarPanel({ orgId, lang }: { orgId: string; lang: "bn" | "en" }) {
  const [offerings, setOfferings] = useState<{ id: string; label: string }[]>([]);
  const [offeringId, setOfferingId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [cap, setCap] = useState("40");
  const [cals, setCals] = useState<Awaited<ReturnType<typeof fetchLabCalendars>>>([]);

  useEffect(() => {
    void fetchOrgOfferings(orgId).then((rows) => {
      const list = rows as {
        id: string;
        care_test_catalog?: { code?: string; name_bn?: string; name_en?: string };
      }[];
      setOfferings(
        list.map((o) => ({
          id: o.id,
          label: `${o.care_test_catalog?.code ?? ""} · ${lang === "bn" ? o.care_test_catalog?.name_bn : o.care_test_catalog?.name_en}`,
        })),
      );
      if (list[0]) setOfferingId(list[0].id);
    });
  }, [orgId, lang]);

  useEffect(() => {
    if (!offeringId) return;
    const to = new Date();
    to.setDate(to.getDate() + 14);
    void fetchLabCalendars(offeringId, todayIso(), to.toISOString().slice(0, 10)).then(setCals);
  }, [offeringId]);

  async function gen() {
    try {
      await generateLabDay(offeringId, date, Number(cap) || undefined);
      toast.success(lang === "bn" ? "ক্যালেন্ডার আপডেট" : "Calendar updated");
      const to = new Date();
      to.setDate(to.getDate() + 14);
      setCals(await fetchLabCalendars(offeringId, todayIso(), to.toISOString().slice(0, 10)));
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select value={offeringId} onChange={(e) => setOfferingId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
          {offerings.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border px-3 py-2 text-sm" />
        <input value={cap} onChange={(e) => setCap(e.target.value)} className="w-24 rounded-xl border px-3 py-2 text-sm" />
        <button type="button" onClick={() => void gen()} className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold">
          {lang === "bn" ? "দিন খুলুন" : "Open day"}
        </button>
      </div>
      <ul className="space-y-1">
        {cals.map((c) => (
          <li key={c.id} className="rounded-xl border px-3 py-2 text-sm flex justify-between">
            <span>{c.cal_date}</span>
            <span className="text-xs text-muted-foreground">
              {c.reserved_count}/{c.capacity}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
