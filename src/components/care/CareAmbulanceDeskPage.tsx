import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Ambulance,
  Clock3,
  LogOut,
  MapPin,
  Phone,
  Receipt,
  Search,
  Siren,
  Truck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { careHasPermission, fetchMyCareMemberships, type CareMembership } from "@/lib/care-access";
import type { CarePermissionKey } from "@/lib/care-permissions";
import {
  acceptAmbulanceRequest,
  assignAmbulanceRequest,
  createAmbulanceRequest,
  fetchAmbulanceFareBreakdown,
  fetchOpenAmbulancePool,
  fetchOrgAmbulanceRequests,
  fetchOrgDrivers,
  fetchOrgOfferings,
  fetchOrgVehicles,
  setAmbulanceRequestStatus,
  setVehicleStatus,
  subscribeAmbulanceRequests,
  triggerAutoAssign,
  type AmbulanceDriver,
  type AmbulanceOffering,
  type AmbulanceRequest,
  type AmbulanceVehicle,
} from "@/lib/ambulance-api";
import { fetchAmbulanceServiceTypes } from "@/lib/ambulance-cms";
import { clampDiscountPercent, computeAmbulanceFare, formatCareMoney } from "@/lib/ambulance-price";
import { CareLabPriceDisplay } from "@/components/care/CareLabPriceDisplay";
import { AmbulanceServiceTypeSelect } from "@/components/ambulance/AmbulanceServiceTypeSelect";
import { supabase } from "@/integrations/supabase/client";
import { CareAmbulanceInvoiceCard } from "@/components/care/CareAmbulanceInvoice";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type AmbTab = "dispatch" | "fleet" | "pricing" | "history" | "invoices";

type CareAmbulanceDeskPageProps = {
  portalMode?: boolean;
};

const STATUS_FLOW: Record<string, string> = {
  accepted: "assigned",
  assigned: "dispatched",
  dispatched: "on_scene",
  on_scene: "transporting",
  transporting: "completed",
};

function statusLabel(status: string, lang: "bn" | "en") {
  const map: Record<string, [string, string]> = {
    requested: ["অনুরোধ", "Requested"],
    quoted: ["কোট", "Quoted"],
    accepted: ["গৃহীত", "Accepted"],
    assigned: ["অ্যাসাইন", "Assigned"],
    dispatched: ["ডিসপ্যাচ", "Dispatched"],
    on_scene: ["লোকেশনে", "On scene"],
    transporting: ["ট্রান্সপোর্ট", "Transporting"],
    completed: ["সম্পন্ন", "Completed"],
    cancelled: ["বাতিল", "Cancelled"],
    rejected: ["প্রত্যাখ্যান", "Rejected"],
  };
  const pair = map[status];
  if (!pair) return status;
  return lang === "bn" ? pair[0] : pair[1];
}

function statusTone(status: string) {
  if (status === "completed") return "bg-emerald-500/15 text-emerald-800 border-emerald-500/30";
  if (status === "cancelled" || status === "rejected") return "bg-rose-500/10 text-rose-700 border-rose-500/25";
  if (status === "requested" || status === "quoted") return "bg-amber-500/15 text-amber-900 border-amber-500/30";
  if (status === "transporting" || status === "on_scene") return "bg-sky-500/15 text-sky-800 border-sky-500/30";
  return "bg-orange-500/15 text-orange-800 border-orange-500/30";
}

export function CareAmbulanceDeskPage({ portalMode = false }: CareAmbulanceDeskPageProps) {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { lang } = useI18n();
  const authPath = portalMode ? "/care/auth" : "/auth";
  const homePath = portalMode ? "/care/portal" : "/care";
  const [memberships, setMemberships] = useState<CareMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<AmbTab>("dispatch");
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
        toast.error(lang === "bn" ? "মেম্বারশিপ নেই" : "No membership");
        void navigate({ to: portalMode ? "/care/auth" : "/care", search: portalMode ? { mode: undefined, next: undefined } : undefined } as never);
        return;
      }
      setMemberships(active);
      setOrgId((prev) => prev ?? active[0]!.org_id);
      setReady(true);
    });
  }, [loading, user, navigate, lang, authPath, portalMode]);

  const membership = useMemo(() => memberships.find((m) => m.org_id === orgId) ?? null, [memberships, orgId]);
  const can = (key: CarePermissionKey) => careHasPermission(membership, key);
  const org = membership?.care_orgs;
  const orgName = lang === "bn" ? org?.name_bn || org?.name : org?.name;

  async function handleSignOut() {
    await signOut();
    void navigate({ to: authPath, search: {} } as never);
  }

  if (!ready || !orgId || !membership) {
    return (
      <div className="min-h-dvh grid place-items-center bg-[radial-gradient(ellipse_at_top,_#fff7ed_0%,_hsl(var(--background))_55%)]">
        <div className="h-8 w-8 rounded-full border-2 border-orange-600 border-t-transparent animate-spin" />
      </div>
    );
  }

  const tabs: { id: AmbTab; label: string; show: boolean }[] = [
    { id: "dispatch", label: lang === "bn" ? "ডিসপ্যাচ" : "Dispatch", show: can("ambulance.dispatch.view") },
    { id: "fleet", label: lang === "bn" ? "ফ্লিট" : "Fleet", show: can("ambulance.fleet.manage") },
    { id: "pricing", label: lang === "bn" ? "রেট ও ডিস্কাউন্ট" : "Rates & offers", show: can("ambulance.pricing.manage") },
    { id: "history", label: lang === "bn" ? "হিস্ট্রি" : "History", show: can("ambulance.requests.view") },
    { id: "invoices", label: lang === "bn" ? "ইনভয়েস" : "Invoices", show: can("ambulance.requests.view") },
  ];

  return (
    <div className="min-h-dvh bg-[radial-gradient(ellipse_at_top,_#fff7ed_0%,_hsl(var(--background))_52%)]">
      <header className="sticky top-0 z-20 border-b border-orange-900/10 bg-card/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <PageBackButton fallbackTo={homePath} shape="xl" />
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-orange-600 to-amber-600 text-white shadow-sm shadow-orange-600/30">
            <Ambulance className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-orange-700/80">
              {lang === "bn" ? "অ্যাম্বুলেন্স কমান্ড ডেস্ক" : "Ambulance command desk"}
            </p>
            <h1 className="truncate text-base font-bold tracking-tight">{orgName}</h1>
          </div>
          {memberships.length > 1 && (
            <select
              className="max-w-44 rounded-xl border border-orange-200 bg-background px-2 py-2 text-xs"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            >
              {memberships.map((m) => (
                <option key={m.org_id} value={m.org_id}>
                  {lang === "bn" ? m.care_orgs?.name_bn || m.care_orgs?.name : m.care_orgs?.name}
                </option>
              ))}
            </select>
          )}
          <Link to={homePath} className="rounded-xl border px-2.5 py-2 text-xs font-medium hover:bg-muted">
            {portalMode ? (lang === "bn" ? "পোর্টাল" : "Portal") : lang === "bn" ? "কেয়ার" : "Care"}
          </Link>
          <button type="button" onClick={() => void handleSignOut()} className="h-9 w-9 grid place-items-center rounded-xl border hover:bg-muted" aria-label="Sign out">
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-2">
          {tabs
            .filter((t) => t.show)
            .map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  tab === t.id
                    ? "bg-orange-600 text-white shadow-sm shadow-orange-600/25"
                    : "border border-orange-200/80 text-muted-foreground hover:bg-orange-50"
                }`}
              >
                {t.label}
              </button>
            ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4">
        {tab === "dispatch" && <DispatchPanel orgId={orgId} canManage={can("ambulance.dispatch.manage")} lang={lang} />}
        {tab === "fleet" && <FleetPanel orgId={orgId} lang={lang} />}
        {tab === "pricing" && <PricingPanel orgId={orgId} lang={lang} />}
        {tab === "history" && <HistoryPanel orgId={orgId} lang={lang} />}
        {tab === "invoices" && <InvoicesPanel orgId={orgId} lang={lang} canManage={can("ambulance.dispatch.manage")} />}
      </main>
    </div>
  );
}

function FareChip({ r, lang }: { r: AmbulanceRequest; lang: "bn" | "en" }) {
  const sale = r.final_fare ?? r.estimated_fare;
  if (sale == null) return null;
  const list = r.fare_original;
  const disc = r.discount_percent;
  if (list != null && disc != null && Number(disc) > 0 && Number(list) > Number(sale)) {
    return (
      <CareLabPriceDisplay
        listPrice={Number(list)}
        salePrice={Number(sale)}
        discountPercent={Number(disc)}
        lang={lang}
        variant="inline"
      />
    );
  }
  return <span className="text-xs font-semibold tabular-nums text-emerald-700">{formatCareMoney(Number(sale), lang)}</span>;
}

function DispatchPanel({ orgId, canManage, lang }: { orgId: string; canManage: boolean; lang: "bn" | "en" }) {
  const [rows, setRows] = useState<AmbulanceRequest[]>([]);
  const [pool, setPool] = useState<AmbulanceRequest[]>([]);
  const [vehicles, setVehicles] = useState<AmbulanceVehicle[]>([]);
  const [drivers, setDrivers] = useState<AmbulanceDriver[]>([]);
  const [types, setTypes] = useState<{ id: string; name_bn: string; name_en: string }[]>([]);
  const [offerings, setOfferings] = useState<AmbulanceOffering[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [pickup, setPickup] = useState("");
  const [dropoff, setDropoff] = useState("");
  const [condition, setCondition] = useState("");
  const [mode, setMode] = useState<"emergency" | "scheduled">("emergency");
  const [serviceTypeId, setServiceTypeId] = useState("");
  const [distanceKm, setDistanceKm] = useState("8");
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof fetchAmbulanceFareBreakdown>>>(null);
  const [assignReqId, setAssignReqId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [invoiceReqId, setInvoiceReqId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [orgRows, poolRows, veh, drv, t, off] = await Promise.all([
      fetchOrgAmbulanceRequests(orgId),
      fetchOpenAmbulancePool(),
      fetchOrgVehicles(orgId),
      fetchOrgDrivers(orgId),
      fetchAmbulanceServiceTypes(),
      fetchOrgOfferings(orgId),
    ]);
    setRows(orgRows.filter((r) => !["completed", "cancelled", "rejected"].includes(r.status)));
    setPool(poolRows);
    setVehicles(veh.filter((v) => v.is_active));
    setDrivers(drv.filter((d) => d.is_active));
    setTypes(t.filter((x) => x.is_active));
    setOfferings(off.filter((o) => o.is_active));
    if (t[0] && !serviceTypeId) setServiceTypeId(t[0].id);
    if (veh[0] && !vehicleId) setVehicleId(veh[0].id);
    if (drv[0] && !driverId) setDriverId(drv[0].id);
  }

  useEffect(() => {
    void reload();
    return subscribeAmbulanceRequests(orgId, () => void reload());
  }, [orgId]);

  useEffect(() => {
    if (!serviceTypeId) {
      setPreview(null);
      return;
    }
    const off = offerings.find((o) => o.service_type_id === serviceTypeId);
    if (off) {
      setPreview(
        computeAmbulanceFare({
          base_price: off.base_price,
          per_km_price: off.per_km_price,
          min_fare: off.min_fare,
          discount_percent: off.discount_percent,
          distance_km: Number(distanceKm) || 0,
        }),
      );
      return;
    }
    void fetchAmbulanceFareBreakdown(orgId, serviceTypeId, Number(distanceKm) || 5).then(setPreview);
  }, [orgId, serviceTypeId, distanceKm, offerings]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((r) =>
      [r.reference_code, r.guest_name, r.guest_phone, r.pickup_address, r.dropoff_address, r.status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle)),
    );
  }, [rows, q]);

  const stats = useMemo(() => {
    const emergency = rows.filter((r) => r.mode === "emergency").length;
    const available = vehicles.filter((v) => v.status === "available").length;
    const pendingPay = rows.filter((r) => r.payment_status === "pending").length;
    return { active: rows.length, emergency, available, pendingPay, pool: pool.length };
  }, [rows, vehicles, pool]);

  async function walkIn() {
    if (!pickup.trim()) {
      toast.error(lang === "bn" ? "পিকআপ ঠিকানা দিন" : "Pickup address required");
      return;
    }
    if (!serviceTypeId) {
      toast.error(lang === "bn" ? "সার্ভিস টাইপ বেছে নিন" : "Select a service type");
      return;
    }
    setBusy(true);
    try {
      await createAmbulanceRequest({
        org_id: orgId,
        source: "walk_in",
        mode,
        guest_name: guestName || undefined,
        guest_phone: guestPhone || undefined,
        pickup_address: pickup || undefined,
        dropoff_address: dropoff || undefined,
        patient_condition: condition || undefined,
        service_type_id: serviceTypeId,
        distance_km: Number(distanceKm) || 5,
      });
      setGuestName("");
      setGuestPhone("");
      setPickup("");
      setDropoff("");
      setCondition("");
      toast.success(lang === "bn" ? "ওয়াক-ইন তৈরি হয়েছে" : "Walk-in created");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function accept(id: string) {
    try {
      await acceptAmbulanceRequest(id, orgId);
      await triggerAutoAssign(id);
      toast.success(lang === "bn" ? "গৃহীত" : "Accepted");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function advance(id: string, status: string) {
    try {
      await setAmbulanceRequestStatus(id, status);
      toast.success(statusLabel(status, lang));
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function doAssign() {
    if (!assignReqId || !vehicleId) return;
    try {
      await assignAmbulanceRequest(assignReqId, vehicleId, driverId);
      setAssignReqId(null);
      toast.success(lang === "bn" ? "অ্যাসাইন হয়েছে" : "Assigned");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function RequestCard({ r, poolMode }: { r: AmbulanceRequest; poolMode?: boolean }) {
    const next = STATUS_FLOW[r.status];
    const ageMin = Math.max(0, Math.round((Date.now() - new Date(r.created_at).getTime()) / 60000));
    return (
      <li className="rounded-2xl border border-orange-900/10 bg-card/95 px-3.5 py-3 text-sm shadow-sm space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-orange-700">{r.reference_code}</span>
          <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${statusTone(r.status)}`}>
            {statusLabel(r.status, lang)}
          </span>
          {r.mode === "emergency" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-red-600/10 px-1.5 py-0.5 text-[10px] font-bold text-red-700">
              <Siren className="h-3 w-3" />
              {lang === "bn" ? "জরুরি" : "Emergency"}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock3 className="h-3 w-3" />
            {ageMin}m
          </span>
        </div>
        <p className="text-xs text-muted-foreground flex gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 text-orange-600" />
          <span>
            <span className="text-foreground/90">{r.pickup_address || "—"}</span>
            <span className="mx-1 opacity-50">→</span>
            {r.dropoff_address || "—"}
          </span>
        </p>
        {(r.guest_name || r.guest_phone) && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
            <Phone className="h-3 w-3" />
            {[r.guest_name, r.guest_phone].filter(Boolean).join(" · ")}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <FareChip r={r} lang={lang} />
          {r.distance_km != null && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{r.distance_km} km</span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 pt-0.5">
          {canManage && poolMode && (
            <button type="button" className="rounded-lg bg-orange-600 px-2.5 py-1 text-[11px] font-semibold text-white" onClick={() => void accept(r.id)}>
              {lang === "bn" ? "গ্রহণ" : "Accept"}
            </button>
          )}
          {canManage && r.status === "accepted" && (
            <button type="button" className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold" onClick={() => setAssignReqId(r.id)}>
              {lang === "bn" ? "অ্যাসাইন" : "Assign"}
            </button>
          )}
          {canManage && next && (
            <button type="button" className="rounded-lg border border-orange-200 px-2.5 py-1 text-[11px] font-semibold text-orange-800" onClick={() => void advance(r.id, next)}>
              → {statusLabel(next, lang)}
            </button>
          )}
          {canManage && !["completed", "cancelled"].includes(r.status) && (
            <button type="button" className="rounded-lg px-2.5 py-1 text-[11px] font-semibold text-destructive" onClick={() => void advance(r.id, "cancelled")}>
              {lang === "bn" ? "বাতিল" : "Cancel"}
            </button>
          )}
          <button type="button" className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold text-primary" onClick={() => setInvoiceReqId(r.id)}>
            {lang === "bn" ? "ইনভয়েস" : "Invoice"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: lang === "bn" ? "সক্রিয়" : "Active", value: stats.active },
          { label: lang === "bn" ? "জরুরি" : "Emergency", value: stats.emergency },
          { label: lang === "bn" ? "ওপেন পুল" : "Open pool", value: stats.pool },
          { label: lang === "bn" ? "গাড়ি খালি" : "Units free", value: stats.available },
          { label: lang === "bn" ? "পেন্ডিং পে" : "Unpaid", value: stats.pendingPay },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-orange-900/10 bg-card/80 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{s.label}</p>
            <p className="text-xl font-black tabular-nums text-orange-800">{s.value}</p>
          </div>
        ))}
      </div>

      {canManage && (
        <section className="rounded-2xl border border-orange-900/10 bg-card p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-bold">{lang === "bn" ? "ওয়াক-ইন / ফোন ডিসপ্যাচ" : "Walk-in / phone dispatch"}</h2>
            <div className="flex rounded-full border p-0.5 text-[11px] font-semibold">
              {(["emergency", "scheduled"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMode(m)}
                  className={`rounded-full px-2.5 py-1 ${mode === m ? "bg-orange-600 text-white" : "text-muted-foreground"}`}
                >
                  {m === "emergency" ? (lang === "bn" ? "জরুরি" : "Emergency") : lang === "bn" ? "শিডিউল" : "Scheduled"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={lang === "bn" ? "রোগীর নাম" : "Patient name"} className="rounded-xl border px-3 py-2 text-sm" />
            <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder={lang === "bn" ? "ফোন" : "Phone"} className="rounded-xl border px-3 py-2 text-sm" />
            <div className="sm:col-span-2 lg:col-span-3">
              <AmbulanceServiceTypeSelect
                types={types}
                offerings={offerings}
                value={serviceTypeId}
                onChange={setServiceTypeId}
                lang={lang}
              />
            </div>
            <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder={lang === "bn" ? "পিকআপ ঠিকানা *" : "Pickup address *"} className="rounded-xl border px-3 py-2 text-sm sm:col-span-2" />
            <input value={dropoff} onChange={(e) => setDropoff(e.target.value)} placeholder={lang === "bn" ? "ড্রপঅফ" : "Dropoff"} className="rounded-xl border px-3 py-2 text-sm" />
            <input value={condition} onChange={(e) => setCondition(e.target.value)} placeholder={lang === "bn" ? "রোগীর অবস্থা" : "Patient condition"} className="rounded-xl border px-3 py-2 text-sm sm:col-span-2" />
            <label className="text-xs text-muted-foreground">
              {lang === "bn" ? "দূরত্ব (কিমি)" : "Distance (km)"}
              <input type="number" min={0} step={0.5} value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground" />
            </label>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-orange-50/80 border border-orange-100 px-3 py-2.5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-orange-800/70">{lang === "bn" ? "আনুমানিক ভাড়া" : "Estimated fare"}</p>
              {preview ? (
                <CareLabPriceDisplay
                  listPrice={preview.list_fare}
                  salePrice={preview.sale_fare}
                  discountPercent={preview.discount_percent}
                  lang={lang}
                  variant="inline"
                />
              ) : (
                <p className="text-xs text-muted-foreground">{lang === "bn" ? "সার্ভিস রেট সেট করুন" : "Set service rates first"}</p>
              )}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void walkIn()}
              className="rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm disabled:opacity-60"
            >
              {lang === "bn" ? "রিকোয়েস্ট তৈরি" : "Create request"}
            </button>
          </div>
        </section>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={lang === "bn" ? "রেফ / নাম / ফোন / ঠিকানা খুঁজুন" : "Search ref / name / phone / address"}
          className="w-full rounded-xl border bg-card py-2.5 pl-9 pr-3 text-sm"
        />
      </div>

      {pool.length > 0 && (
        <div>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            {lang === "bn" ? "ওপেন পুল" : "Open pool"} · {pool.length}
          </h2>
          <ul className="space-y-2">{pool.map((r) => <RequestCard key={r.id} r={r} poolMode />)}</ul>
        </div>
      )}

      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {lang === "bn" ? "সক্রিয় রিকোয়েস্ট" : "Active board"} · {filtered.length}
        </h2>
        <ul className="space-y-2">
          {filtered.map((r) => (
            <RequestCard key={r.id} r={r} />
          ))}
          {filtered.length === 0 && (
            <li className="rounded-2xl border border-dashed py-10 text-center text-xs text-muted-foreground">
              {lang === "bn" ? "এখন কোনো সক্রিয় রিকোয়েস্ট নেই" : "No active requests"}
            </li>
          )}
        </ul>
      </div>

      <Dialog open={!!assignReqId} onOpenChange={(o) => !o && setAssignReqId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{lang === "bn" ? "গাড়ি ও ড্রাইভার অ্যাসাইন" : "Assign unit & driver"}</DialogTitle>
          </DialogHeader>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate_no} · {v.label || "—"} · {v.status}
              </option>
            ))}
          </select>
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
            {drivers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.full_name} · {d.phone}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void doAssign()} className="w-full rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white">
            {lang === "bn" ? "নিশ্চিত করুন" : "Confirm assign"}
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!invoiceReqId} onOpenChange={(o) => !o && setInvoiceReqId(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{lang === "bn" ? "ইনভয়েস" : "Invoice"}</DialogTitle>
          </DialogHeader>
          {invoiceReqId && <CareAmbulanceInvoiceCard requestId={invoiceReqId} canManagePayment={canManage} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FleetPanel({ orgId, lang }: { orgId: string; lang: "bn" | "en" }) {
  const [vehicles, setVehicles] = useState<AmbulanceVehicle[]>([]);
  const [drivers, setDrivers] = useState<AmbulanceDriver[]>([]);
  const [types, setTypes] = useState<{ id: string; name_bn: string; name_en: string }[]>([]);
  const [plate, setPlate] = useState("");
  const [label, setLabel] = useState("");
  const [typeId, setTypeId] = useState("");
  const [dName, setDName] = useState("");
  const [dPhone, setDPhone] = useState("");
  const [dLicense, setDLicense] = useState("");

  async function reload() {
    const [v, d, t] = await Promise.all([fetchOrgVehicles(orgId), fetchOrgDrivers(orgId), fetchAmbulanceServiceTypes()]);
    setVehicles(v);
    setDrivers(d);
    setTypes(t);
    if (t[0] && !typeId) setTypeId(t[0].id);
  }
  useEffect(() => {
    void reload();
  }, [orgId]);

  async function addVehicle() {
    if (!plate.trim()) return;
    const { error } = await supabase.from("ambulance_vehicles").insert({
      org_id: orgId,
      plate_no: plate.trim(),
      label: label.trim() || null,
      service_type_id: typeId || types[0]?.id || null,
    } as never);
    if (error) toast.error(error.message);
    else {
      setPlate("");
      setLabel("");
      toast.success(lang === "bn" ? "গাড়ি যোগ" : "Vehicle added");
      await reload();
    }
  }

  async function addDriver() {
    if (!dName.trim() || !dPhone.trim()) return;
    const { error } = await supabase.from("ambulance_drivers").insert({
      org_id: orgId,
      full_name: dName.trim(),
      phone: dPhone.trim(),
      license_no: dLicense.trim() || null,
    } as never);
    if (error) toast.error(error.message);
    else {
      setDName("");
      setDPhone("");
      setDLicense("");
      toast.success(lang === "bn" ? "ড্রাইভার যোগ" : "Driver added");
      await reload();
    }
  }

  async function toggleDriver(d: AmbulanceDriver) {
    const { error } = await supabase.from("ambulance_drivers").update({ is_active: !d.is_active } as never).eq("id", d.id);
    if (error) toast.error(error.message);
    else await reload();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="space-y-3 rounded-2xl border border-orange-900/10 bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-bold">
          <Truck className="h-4 w-4 text-orange-600" />
          {lang === "bn" ? "ফ্লিট" : "Fleet"} · {vehicles.length}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder={lang === "bn" ? "নম্বর প্লেট" : "Plate"} className="rounded-xl border px-3 py-2 text-sm" />
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={lang === "bn" ? "লেবেল" : "Label"} className="rounded-xl border px-3 py-2 text-sm" />
          <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm sm:col-span-2">
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {lang === "bn" ? t.name_bn : t.name_en}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void addVehicle()} className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white sm:col-span-2">
            {lang === "bn" ? "গাড়ি যোগ করুন" : "Add vehicle"}
          </button>
        </div>
        <ul className="space-y-2">
          {vehicles.map((v) => {
            const t = types.find((x) => x.id === v.service_type_id);
            return (
              <li key={v.id} className="flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-mono font-bold">{v.plate_no}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {[v.label, lang === "bn" ? t?.name_bn : t?.name_en].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <select
                  value={v.status}
                  onChange={(e) => void setVehicleStatus(v.id, e.target.value as AmbulanceVehicle["status"]).then(reload)}
                  className="rounded-lg border px-2 py-1 text-xs"
                >
                  <option value="available">{lang === "bn" ? "উপলব্ধ" : "Available"}</option>
                  <option value="busy">{lang === "bn" ? "ব্যস্ত" : "Busy"}</option>
                  <option value="offline">{lang === "bn" ? "অফলাইন" : "Offline"}</option>
                </select>
              </li>
            );
          })}
        </ul>
      </section>
      <section className="space-y-3 rounded-2xl border border-orange-900/10 bg-card p-4 shadow-sm">
        <h2 className="flex items-center gap-1.5 text-sm font-bold">
          <Users className="h-4 w-4 text-orange-600" />
          {lang === "bn" ? "ড্রাইভার" : "Drivers"} · {drivers.length}
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <input value={dName} onChange={(e) => setDName(e.target.value)} placeholder={lang === "bn" ? "নাম" : "Name"} className="rounded-xl border px-3 py-2 text-sm" />
          <input value={dPhone} onChange={(e) => setDPhone(e.target.value)} placeholder={lang === "bn" ? "ফোন" : "Phone"} className="rounded-xl border px-3 py-2 text-sm" />
          <input value={dLicense} onChange={(e) => setDLicense(e.target.value)} placeholder={lang === "bn" ? "লাইসেন্স" : "License"} className="rounded-xl border px-3 py-2 text-sm sm:col-span-2" />
          <button type="button" onClick={() => void addDriver()} className="rounded-xl bg-orange-600 px-3 py-2 text-xs font-semibold text-white sm:col-span-2">
            {lang === "bn" ? "ড্রাইভার যোগ" : "Add driver"}
          </button>
        </div>
        <ul className="space-y-2">
          {drivers.map((d) => (
            <li key={d.id} className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{d.full_name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {d.phone}
                  {d.license_no ? ` · ${d.license_no}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggleDriver(d)}
                className={`rounded-lg px-2 py-1 text-[10px] font-bold uppercase ${d.is_active ? "bg-emerald-500/15 text-emerald-800" : "bg-muted text-muted-foreground"}`}
              >
                {d.is_active ? (lang === "bn" ? "সক্রিয়" : "Active") : lang === "bn" ? "অফ" : "Off"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PricingPanel({ orgId, lang }: { orgId: string; lang: "bn" | "en" }) {
  const [offerings, setOfferings] = useState<AmbulanceOffering[]>([]);
  const [types, setTypes] = useState<{ id: string; name_bn: string; name_en: string; slug?: string }[]>([]);
  const [typeId, setTypeId] = useState("");
  const [base, setBase] = useState("800");
  const [perKm, setPerKm] = useState("35");
  const [minFare, setMinFare] = useState("500");
  const [discount, setDiscount] = useState("10");
  const [sampleKm, setSampleKm] = useState("10");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function reload() {
    const [o, t] = await Promise.all([fetchOrgOfferings(orgId), fetchAmbulanceServiceTypes()]);
    setOfferings(o);
    setTypes(t);
    if (t[0] && !typeId) setTypeId(t[0].id);
  }
  useEffect(() => {
    void reload();
  }, [orgId]);

  const draftPreview = useMemo(
    () =>
      computeAmbulanceFare({
        base_price: Number(base) || 0,
        per_km_price: Number(perKm) || 0,
        min_fare: Number(minFare) || 0,
        discount_percent: clampDiscountPercent(discount),
        distance_km: Number(sampleKm) || 0,
      }),
    [base, perKm, minFare, discount, sampleKm],
  );

  function loadEdit(o: AmbulanceOffering) {
    setEditingId(o.id);
    setTypeId(o.service_type_id);
    setBase(String(o.base_price));
    setPerKm(String(o.per_km_price));
    setMinFare(String(o.min_fare));
    setDiscount(String(o.discount_percent ?? 0));
  }

  function resetForm() {
    setEditingId(null);
    setBase("800");
    setPerKm("35");
    setMinFare("500");
    setDiscount("10");
  }

  async function save() {
    if (!typeId) return;
    setBusy(true);
    const payload = {
      org_id: orgId,
      service_type_id: typeId,
      base_price: Number(base) || 0,
      per_km_price: Number(perKm) || 0,
      min_fare: Number(minFare) || 0,
      discount_percent: clampDiscountPercent(discount),
      is_active: true,
      home_pickup: true,
    };
    const { error } = await supabase.from("ambulance_service_offerings").upsert(payload as never, {
      onConflict: "org_id,service_type_id",
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "bn" ? "রেট সেভ হয়েছে" : "Rates saved");
      resetForm();
      await reload();
    }
  }

  async function toggleActive(o: AmbulanceOffering) {
    const { error } = await supabase
      .from("ambulance_service_offerings")
      .update({ is_active: !o.is_active } as never)
      .eq("id", o.id);
    if (error) toast.error(error.message);
    else await reload();
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-orange-900/10 bg-card p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold">{editingId ? (lang === "bn" ? "রেট এডিট" : "Edit rates") : lang === "bn" ? "নতুন / আপডেট অফার" : "New / update offering"}</h2>
            <p className="text-[11px] text-muted-foreground">
              {lang === "bn"
                ? "লিস্ট ভাড়া = max(মিন, বেস + কিমি×রেট)। ডিস্কাউন্ট % পুরো ভাড়ায় প্রযোজ্য।"
                : "List fare = max(min, base + km×rate). Discount % applies to the full fare."}
            </p>
          </div>
          {editingId && (
            <button type="button" onClick={resetForm} className="text-xs font-semibold text-muted-foreground">
              {lang === "bn" ? "নতুন ফর্ম" : "New form"}
            </button>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-3">
            {lang === "bn" ? "সার্ভিস টাইপ" : "Service type"}
            <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground">
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {lang === "bn" ? t.name_bn : t.name_en}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs text-muted-foreground">
            {lang === "bn" ? "বেস (৳)" : "Base (৳)"}
            <input value={base} onChange={(e) => setBase(e.target.value)} type="number" min={0} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            {lang === "bn" ? "প্রতি কিমি" : "Per km"}
            <input value={perKm} onChange={(e) => setPerKm(e.target.value)} type="number" min={0} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            {lang === "bn" ? "মিনিমাম ভাড়া" : "Min fare"}
            <input value={minFare} onChange={(e) => setMinFare(e.target.value)} type="number" min={0} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            {lang === "bn" ? "ডিস্কাউন্ট %" : "Discount %"}
            <input value={discount} onChange={(e) => setDiscount(e.target.value)} type="number" min={0} max={100} step={0.5} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground" />
          </label>
          <label className="text-xs text-muted-foreground">
            {lang === "bn" ? "প্রিভিউ কিমি" : "Preview km"}
            <input value={sampleKm} onChange={(e) => setSampleKm(e.target.value)} type="number" min={0} step={0.5} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm text-foreground" />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200/60 bg-gradient-to-r from-rose-50 to-orange-50 px-3 py-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-rose-800/70">
              {lang === "bn" ? "রোগী যা দেখবে" : "Patient sees"} · {sampleKm} km
            </p>
            <CareLabPriceDisplay
              listPrice={draftPreview.list_fare}
              salePrice={draftPreview.sale_fare}
              discountPercent={draftPreview.discount_percent}
              lang={lang}
              variant="card"
            />
            {draftPreview.saved > 0 && (
              <p className="mt-1 text-[11px] text-emerald-700">
                {lang === "bn" ? "সাশ্রয়" : "You save"} {formatCareMoney(draftPreview.saved, lang)}
              </p>
            )}
          </div>
          <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-60">
            {lang === "bn" ? "সেভ রেট" : "Save rates"}
          </button>
        </div>
      </section>

      <ul className="space-y-2">
        {offerings.map((o) => {
          const t = types.find((x) => x.id === o.service_type_id);
          const sample = computeAmbulanceFare({
            base_price: o.base_price,
            per_km_price: o.per_km_price,
            min_fare: o.min_fare,
            discount_percent: o.discount_percent,
            distance_km: Number(sampleKm) || 10,
          });
          return (
            <li
              key={o.id}
              className={`rounded-2xl border px-3.5 py-3 ${o.is_active ? "border-orange-900/10 bg-card" : "border-dashed bg-muted/30 opacity-80"}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-sm">{lang === "bn" ? t?.name_bn : t?.name_en}</p>
                  <p className="text-[11px] text-muted-foreground tabular-nums">
                    ৳{o.base_price} + ৳{o.per_km_price}/km · min ৳{o.min_fare}
                  </p>
                </div>
                <CareLabPriceDisplay
                  listPrice={sample.list_fare}
                  salePrice={sample.sale_fare}
                  discountPercent={o.discount_percent}
                  lang={lang}
                  variant="inline"
                />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" onClick={() => loadEdit(o)} className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold">
                  {lang === "bn" ? "এডিট" : "Edit"}
                </button>
                <button type="button" onClick={() => void toggleActive(o)} className="rounded-lg border px-2.5 py-1 text-[11px] font-semibold">
                  {o.is_active ? (lang === "bn" ? "নিষ্ক্রিয়" : "Deactivate") : lang === "bn" ? "সক্রিয়" : "Activate"}
                </button>
              </div>
            </li>
          );
        })}
        {offerings.length === 0 && (
          <li className="rounded-2xl border border-dashed py-10 text-center text-xs text-muted-foreground">
            {lang === "bn" ? "এখনো কোনো রেট নেই — উপরের ফর্ম দিয়ে যোগ করুন" : "No rates yet — add via the form above"}
          </li>
        )}
      </ul>
    </div>
  );
}

function HistoryPanel({ orgId, lang }: { orgId: string; lang: "bn" | "en" }) {
  const [rows, setRows] = useState<AmbulanceRequest[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    void fetchOrgAmbulanceRequests(orgId).then(setRows);
  }, [orgId]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      const needle = q.trim().toLowerCase();
      if (!needle) return true;
      return [r.reference_code, r.invoice_no, r.guest_name, r.guest_phone, r.pickup_address]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(needle));
    });
  }, [rows, q, status]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === "bn" ? "খুঁজুন" : "Search"} className="w-full rounded-xl border bg-card py-2 pl-9 pr-3 text-sm" />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
          <option value="all">{lang === "bn" ? "সব স্ট্যাটাস" : "All statuses"}</option>
          {["requested", "accepted", "assigned", "dispatched", "on_scene", "transporting", "completed", "cancelled"].map((s) => (
            <option key={s} value={s}>
              {statusLabel(s, lang)}
            </option>
          ))}
        </select>
      </div>
      <ul className="divide-y rounded-2xl border border-orange-900/10 bg-card overflow-hidden">
        {filtered.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="font-mono text-xs font-bold text-orange-700">{r.reference_code}</p>
              <p className="truncate text-[11px] text-muted-foreground">{r.pickup_address || "—"}</p>
            </div>
            <span className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${statusTone(r.status)}`}>{statusLabel(r.status, lang)}</span>
            <FareChip r={r} lang={lang} />
          </li>
        ))}
        {filtered.length === 0 && <li className="py-10 text-center text-xs text-muted-foreground">{lang === "bn" ? "কিছু নেই" : "None"}</li>}
      </ul>
    </div>
  );
}

function InvoicesPanel({ orgId, lang, canManage }: { orgId: string; lang: "bn" | "en"; canManage: boolean }) {
  const [rows, setRows] = useState<AmbulanceRequest[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [payFilter, setPayFilter] = useState<"all" | "pending" | "paid">("all");

  useEffect(() => {
    void fetchOrgAmbulanceRequests(orgId).then((r) => setRows(r.filter((x) => x.invoice_no)));
  }, [orgId]);

  const list = useMemo(() => {
    const seen = new Set<string>();
    const base = payFilter === "all" ? rows : rows.filter((r) => r.payment_status === payFilter);
    return base.filter((r) => {
      const key = r.invoice_group_id || r.invoice_no || r.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [rows, payFilter]);

  if (sel) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setSel(null)} className="text-xs font-semibold">
          {lang === "bn" ? "← ফিরে" : "← Back"}
        </button>
        <CareAmbulanceInvoiceCard requestId={sel} canManagePayment={canManage} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-1 rounded-full border p-0.5 w-fit text-[11px] font-semibold">
        {(["all", "pending", "paid"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setPayFilter(f)}
            className={`rounded-full px-3 py-1 ${payFilter === f ? "bg-orange-600 text-white" : "text-muted-foreground"}`}
          >
            {f === "all" ? (lang === "bn" ? "সব" : "All") : f === "pending" ? (lang === "bn" ? "বাকি" : "Unpaid") : lang === "bn" ? "পেইড" : "Paid"}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSel(r.id)}
              className="flex w-full items-center justify-between gap-2 rounded-2xl border border-orange-900/10 bg-card px-3.5 py-3 text-left text-sm hover:bg-orange-50/50"
            >
              <div>
                <p className="font-mono text-xs font-bold">{r.invoice_no}</p>
                <p className="text-[11px] text-muted-foreground">
                  {r.reference_code} · {statusLabel(r.status, lang)} · {r.payment_status}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <FareChip r={r} lang={lang} />
                <Receipt className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          </li>
        ))}
        {list.length === 0 && (
          <li className="rounded-2xl border border-dashed py-10 text-center text-xs text-muted-foreground">
            {lang === "bn" ? "ইনভয়েস নেই" : "No invoices"}
          </li>
        )}
      </ul>
    </div>
  );
}
