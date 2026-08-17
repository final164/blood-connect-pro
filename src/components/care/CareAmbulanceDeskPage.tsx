import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Ambulance, LogOut, Truck, Users, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { careHasPermission, fetchMyCareMemberships, type CareMembership } from "@/lib/care-access";
import type { CarePermissionKey } from "@/lib/care-permissions";
import {
  acceptAmbulanceRequest,
  assignAmbulanceRequest,
  createAmbulanceRequest,
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
      void navigate({ to: authPath });
      return;
    }
    void fetchMyCareMemberships().then((rows) => {
      const active = rows.filter((r) => r.care_orgs?.is_active !== false);
      if (!active.length) {
        toast.error(lang === "bn" ? "মেম্বারশিপ নেই" : "No membership");
        void navigate({ to: portalMode ? "/care/auth" : "/care" });
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
    void navigate({ to: authPath });
  }

  if (!ready || !orgId || !membership) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const tabs: { id: AmbTab; label: string; show: boolean }[] = [
    { id: "dispatch", label: lang === "bn" ? "ডিসপ্যাচ" : "Dispatch", show: can("ambulance.dispatch.view") },
    { id: "fleet", label: lang === "bn" ? "ফ্লিট" : "Fleet", show: can("ambulance.fleet.manage") },
    { id: "pricing", label: lang === "bn" ? "প্রাইসিং" : "Pricing", show: can("ambulance.pricing.manage") },
    { id: "history", label: lang === "bn" ? "হিস্ট্রি" : "History", show: can("ambulance.requests.view") },
    { id: "invoices", label: lang === "bn" ? "ইনভয়েস" : "Invoices", show: can("ambulance.requests.view") },
  ];

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-20 border-b bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-600/10 text-orange-700">
            <Ambulance className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {lang === "bn" ? "অ্যাম্বুলেন্স প্যানেল" : "Ambulance panel"}
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
          {tabs.filter((t) => t.show).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${tab === t.id ? "bg-orange-600 text-white" : "border text-muted-foreground"}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-4">
        {tab === "dispatch" && <DispatchPanel orgId={orgId} canManage={can("ambulance.dispatch.manage")} lang={lang} />}
        {tab === "fleet" && <FleetPanel orgId={orgId} lang={lang} />}
        {tab === "pricing" && <PricingPanel orgId={orgId} lang={lang} />}
        {tab === "history" && <HistoryPanel orgId={orgId} lang={lang} />}
        {tab === "invoices" && <InvoicesPanel orgId={orgId} lang={lang} canManage={can("ambulance.dispatch.manage")} />}
      </main>
    </div>
  );
}

function DispatchPanel({ orgId, canManage, lang }: { orgId: string; canManage: boolean; lang: "bn" | "en" }) {
  const [rows, setRows] = useState<AmbulanceRequest[]>([]);
  const [pool, setPool] = useState<AmbulanceRequest[]>([]);
  const [vehicles, setVehicles] = useState<AmbulanceVehicle[]>([]);
  const [drivers, setDrivers] = useState<AmbulanceDriver[]>([]);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [pickup, setPickup] = useState("");
  const [assignReqId, setAssignReqId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [invoiceReqId, setInvoiceReqId] = useState<string | null>(null);

  async function reload() {
    const [orgRows, poolRows, veh, drv] = await Promise.all([
      fetchOrgAmbulanceRequests(orgId),
      fetchOpenAmbulancePool(),
      fetchOrgVehicles(orgId),
      fetchOrgDrivers(orgId),
    ]);
    setRows(orgRows.filter((r) => !["completed", "cancelled", "rejected"].includes(r.status)));
    setPool(poolRows);
    setVehicles(veh.filter((v) => v.is_active));
    setDrivers(drv.filter((d) => d.is_active));
    if (veh[0] && !vehicleId) setVehicleId(veh[0].id);
    if (drv[0] && !driverId) setDriverId(drv[0].id);
  }

  useEffect(() => {
    void reload();
    return subscribeAmbulanceRequests(orgId, () => void reload());
  }, [orgId]);

  async function walkIn() {
    try {
      await createAmbulanceRequest({
        org_id: orgId,
        source: "walk_in",
        mode: "emergency",
        guest_name: guestName || undefined,
        guest_phone: guestPhone || undefined,
        pickup_address: pickup || undefined,
      });
      setGuestName("");
      setGuestPhone("");
      setPickup("");
      toast.success(lang === "bn" ? "ওয়াক-ইন তৈরি" : "Walk-in created");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
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
      toast.success(status);
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

  const nextStatus: Record<string, string> = {
    accepted: "assigned",
    assigned: "dispatched",
    dispatched: "on_scene",
    on_scene: "transporting",
    transporting: "completed",
  };

  function RequestCard({ r, poolMode }: { r: AmbulanceRequest; poolMode?: boolean }) {
    const next = nextStatus[r.status];
    return (
      <li className="rounded-xl border bg-card px-3 py-2 text-sm space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-bold text-orange-700">{r.reference_code}</span>
          <span className="text-[10px] uppercase text-muted-foreground">{r.mode} · {r.status}</span>
          {r.estimated_fare != null && <span className="text-xs tabular-nums">৳{r.estimated_fare}</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{r.pickup_address || "—"} → {r.dropoff_address || "—"}</p>
        <div className="flex flex-wrap gap-2">
          {canManage && poolMode && (
            <button type="button" className="text-[11px] font-semibold text-primary" onClick={() => void accept(r.id)}>
              {lang === "bn" ? "গ্রহণ" : "Accept"}
            </button>
          )}
          {canManage && r.status === "accepted" && (
            <button type="button" className="text-[11px] font-semibold" onClick={() => setAssignReqId(r.id)}>
              {lang === "bn" ? "অ্যাসাইন" : "Assign"}
            </button>
          )}
          {canManage && next && (
            <button type="button" className="text-[11px] font-semibold" onClick={() => void advance(r.id, next)}>
              → {next}
            </button>
          )}
          {canManage && !["completed", "cancelled"].includes(r.status) && (
            <button type="button" className="text-[11px] text-destructive" onClick={() => void advance(r.id, "cancelled")}>
              {lang === "bn" ? "বাতিল" : "Cancel"}
            </button>
          )}
          <button type="button" className="text-[11px] font-semibold text-primary" onClick={() => setInvoiceReqId(r.id)}>
            {lang === "bn" ? "ইনভয়েস" : "Invoice"}
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="rounded-2xl border p-3 grid gap-2 sm:grid-cols-4">
          <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder={lang === "bn" ? "নাম" : "Name"} className="rounded-xl border px-3 py-2 text-sm" />
          <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder={lang === "bn" ? "ফোন" : "Phone"} className="rounded-xl border px-3 py-2 text-sm" />
          <input value={pickup} onChange={(e) => setPickup(e.target.value)} placeholder={lang === "bn" ? "Pickup" : "Pickup"} className="rounded-xl border px-3 py-2 text-sm" />
          <button type="button" onClick={() => void walkIn()} className="rounded-xl bg-orange-600 text-white px-3 py-2 text-xs font-semibold">
            {lang === "bn" ? "ওয়াক-ইন" : "Walk-in"}
          </button>
        </div>
      )}
      {pool.length > 0 && (
        <div>
          <h2 className="text-xs font-bold uppercase text-muted-foreground mb-2">{lang === "bn" ? "ওপেন পুল" : "Open pool"}</h2>
          <ul className="space-y-2">{pool.map((r) => <RequestCard key={r.id} r={r} poolMode />)}</ul>
        </div>
      )}
      <div>
        <h2 className="text-xs font-bold uppercase text-muted-foreground mb-2">{lang === "bn" ? "সক্রিয় রিকোয়েস্ট" : "Active requests"}</h2>
        <ul className="space-y-2">
          {rows.map((r) => <RequestCard key={r.id} r={r} />)}
          {rows.length === 0 && <li className="text-xs text-muted-foreground text-center py-6">{lang === "bn" ? "কিছু নেই" : "None"}</li>}
        </ul>
      </div>
      <Dialog open={!!assignReqId} onOpenChange={(o) => !o && setAssignReqId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{lang === "bn" ? "গাড়ি অ্যাসাইন" : "Assign vehicle"}</DialogTitle></DialogHeader>
          <select value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
            {vehicles.map((v) => <option key={v.id} value={v.id}>{v.plate_no} · {v.status}</option>)}
          </select>
          <select value={driverId} onChange={(e) => setDriverId(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm">
            {drivers.map((d) => <option key={d.id} value={d.id}>{d.full_name}</option>)}
          </select>
          <button type="button" onClick={() => void doAssign()} className="rounded-xl bg-orange-600 text-white px-4 py-2 text-sm font-semibold w-full">
            {lang === "bn" ? "নিশ্চিত" : "Confirm"}
          </button>
        </DialogContent>
      </Dialog>
      <Dialog open={!!invoiceReqId} onOpenChange={(o) => !o && setInvoiceReqId(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lang === "bn" ? "ইনভয়েস" : "Invoice"}</DialogTitle></DialogHeader>
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
  const [dName, setDName] = useState("");
  const [dPhone, setDPhone] = useState("");

  async function reload() {
    const [v, d, t] = await Promise.all([fetchOrgVehicles(orgId), fetchOrgDrivers(orgId), fetchAmbulanceServiceTypes()]);
    setVehicles(v);
    setDrivers(d);
    setTypes(t);
  }
  useEffect(() => { void reload(); }, [orgId]);

  async function addVehicle() {
    if (!plate.trim()) return;
    const { error } = await supabase.from("ambulance_vehicles").insert({
      org_id: orgId,
      plate_no: plate.trim(),
      service_type_id: types[0]?.id ?? null,
    } as never);
    if (error) toast.error(error.message);
    else { setPlate(""); await reload(); }
  }

  async function addDriver() {
    if (!dName.trim() || !dPhone.trim()) return;
    const { error } = await supabase.from("ambulance_drivers").insert({
      org_id: orgId,
      full_name: dName.trim(),
      phone: dPhone.trim(),
    } as never);
    if (error) toast.error(error.message);
    else { setDName(""); setDPhone(""); await reload(); }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <h2 className="text-xs font-bold flex items-center gap-1"><Truck className="h-3.5 w-3.5" />{lang === "bn" ? "গাড়ি" : "Vehicles"}</h2>
        <div className="flex gap-2">
          <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder={lang === "bn" ? "নম্বর প্লেট" : "Plate"} className="rounded-xl border px-3 py-2 text-sm flex-1" />
          <button type="button" onClick={() => void addVehicle()} className="rounded-xl bg-orange-600 text-white px-3 py-2 text-xs font-semibold">{lang === "bn" ? "যোগ" : "Add"}</button>
        </div>
        <ul className="space-y-1">
          {vehicles.map((v) => (
            <li key={v.id} className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
              <span className="font-mono font-bold">{v.plate_no}</span>
              <span className="text-xs text-muted-foreground">{v.status}</span>
              <select value={v.status} onChange={(e) => void setVehicleStatus(v.id, e.target.value as AmbulanceVehicle["status"]).then(reload)} className="ml-auto text-xs rounded border px-2 py-1">
                <option value="available">{lang === "bn" ? "উপলব্ধ" : "Available"}</option>
                <option value="busy">{lang === "bn" ? "ব্যস্ত" : "Busy"}</option>
                <option value="offline">{lang === "bn" ? "অফলাইন" : "Offline"}</option>
              </select>
            </li>
          ))}
        </ul>
      </div>
      <div className="space-y-2">
        <h2 className="text-xs font-bold flex items-center gap-1"><Users className="h-3.5 w-3.5" />{lang === "bn" ? "ড্রাইভার" : "Drivers"}</h2>
        <div className="flex gap-2 flex-wrap">
          <input value={dName} onChange={(e) => setDName(e.target.value)} placeholder={lang === "bn" ? "নাম" : "Name"} className="rounded-xl border px-3 py-2 text-sm" />
          <input value={dPhone} onChange={(e) => setDPhone(e.target.value)} placeholder={lang === "bn" ? "ফোন" : "Phone"} className="rounded-xl border px-3 py-2 text-sm" />
          <button type="button" onClick={() => void addDriver()} className="rounded-xl bg-orange-600 text-white px-3 py-2 text-xs font-semibold">{lang === "bn" ? "যোগ" : "Add"}</button>
        </div>
        <ul className="space-y-1">
          {drivers.map((d) => (
            <li key={d.id} className="rounded-xl border px-3 py-2 text-sm">{d.full_name} · {d.phone}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PricingPanel({ orgId, lang }: { orgId: string; lang: "bn" | "en" }) {
  const [offerings, setOfferings] = useState<AmbulanceOffering[]>([]);
  const [types, setTypes] = useState<{ id: string; name_bn: string; name_en: string }[]>([]);
  const [typeId, setTypeId] = useState("");
  const [base, setBase] = useState("500");
  const [perKm, setPerKm] = useState("30");

  async function reload() {
    const [o, t] = await Promise.all([fetchOrgOfferings(orgId), fetchAmbulanceServiceTypes()]);
    setOfferings(o);
    setTypes(t);
    if (t[0] && !typeId) setTypeId(t[0].id);
  }
  useEffect(() => { void reload(); }, [orgId]);

  async function add() {
    if (!typeId) return;
    const { error } = await supabase.from("ambulance_service_offerings").upsert({
      org_id: orgId,
      service_type_id: typeId,
      base_price: Number(base) || 0,
      per_km_price: Number(perKm) || 0,
      min_fare: Number(base) || 0,
    } as never);
    if (error) toast.error(error.message);
    else await reload();
  }

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border p-3 grid gap-2 sm:grid-cols-2">
        <select value={typeId} onChange={(e) => setTypeId(e.target.value)} className="rounded-xl border px-3 py-2 text-sm">
          {types.map((t) => <option key={t.id} value={t.id}>{lang === "bn" ? t.name_bn : t.name_en}</option>)}
        </select>
        <input value={base} onChange={(e) => setBase(e.target.value)} placeholder={lang === "bn" ? "বেস" : "Base"} className="rounded-xl border px-3 py-2 text-sm" />
        <input value={perKm} onChange={(e) => setPerKm(e.target.value)} placeholder={lang === "bn" ? "প্রতি কিমি" : "Per km"} className="rounded-xl border px-3 py-2 text-sm" />
        <button type="button" onClick={() => void add()} className="rounded-xl bg-orange-600 text-white px-3 py-2 text-xs font-semibold">{lang === "bn" ? "সেভ অফার" : "Save offering"}</button>
      </div>
      <ul className="space-y-1">
        {offerings.map((o) => {
          const t = types.find((x) => x.id === o.service_type_id);
          return (
            <li key={o.id} className="rounded-xl border px-3 py-2 text-sm">
              {lang === "bn" ? t?.name_bn : t?.name_en} · ৳{o.base_price} + ৳{o.per_km_price}/km
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function HistoryPanel({ orgId, lang }: { orgId: string; lang: "bn" | "en" }) {
  const [rows, setRows] = useState<AmbulanceRequest[]>([]);
  useEffect(() => {
    void fetchOrgAmbulanceRequests(orgId).then(setRows);
  }, [orgId]);
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {rows.map((r) => (
        <li key={r.id} className="px-3 py-2 text-sm flex justify-between gap-2">
          <span className="font-mono text-xs">{r.reference_code}</span>
          <span className="text-muted-foreground">{r.status}</span>
          <span className="text-xs tabular-nums">{r.final_fare ?? r.estimated_fare ?? "—"}</span>
        </li>
      ))}
    </ul>
  );
}

function InvoicesPanel({ orgId, lang, canManage }: { orgId: string; lang: "bn" | "en"; canManage: boolean }) {
  const [rows, setRows] = useState<AmbulanceRequest[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  useEffect(() => {
    void fetchOrgAmbulanceRequests(orgId).then((r) => setRows(r.filter((x) => x.invoice_no)));
  }, [orgId]);
  if (sel) {
    return (
      <div className="space-y-3">
        <button type="button" onClick={() => setSel(null)} className="text-xs font-semibold">{lang === "bn" ? "← ফিরে" : "← Back"}</button>
        <CareAmbulanceInvoiceCard requestId={sel} canManagePayment={canManage} />
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id}>
          <button type="button" onClick={() => setSel(r.id)} className="w-full rounded-xl border px-3 py-2 text-sm text-left flex justify-between">
            <span className="font-mono">{r.invoice_no}</span>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </button>
        </li>
      ))}
    </ul>
  );
}
