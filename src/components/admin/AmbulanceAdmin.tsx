import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchAmbulanceAudit,
  fetchAmbulanceEquipmentOptions,
  fetchAmbulanceFormFields,
  fetchAmbulanceNotifTemplates,
  fetchAmbulanceOverviewStats,
  fetchAmbulancePriorityLevels,
  fetchAmbulanceProviders,
  fetchAmbulanceRequestStatuses,
  fetchAmbulanceServiceTypes,
  fetchAmbulanceStatusTransitions,
  type AmbulanceEquipmentOption,
  type AmbulanceFormField,
  type AmbulanceNotifTemplate,
  type AmbulancePriorityLevel,
  type AmbulanceServiceType,
  type AmbulanceStatusRow,
  type AmbulanceTransitionRow,
} from "@/lib/ambulance-cms";
import {
  DEFAULT_AMBULANCE_SETTINGS,
  fetchAmbulanceSettings,
  saveAmbulanceSettings,
  type AmbulanceSettings,
} from "@/lib/ambulance-settings";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

type Sub =
  | "overview"
  | "providers"
  | "services"
  | "equipment"
  | "statuses"
  | "priorities"
  | "form"
  | "features"
  | "notifications"
  | "audit";

export function AmbulanceAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const [sub, setSub] = useState<Sub>("overview");
  const canEdit = can("ambulance.edit");
  const canProviders = can("ambulance.providers") || canEdit;

  const tabs: { id: Sub; bn: string; en: string }[] = [
    { id: "overview", bn: "ওভারভিউ", en: "Overview" },
    { id: "providers", bn: "প্রোভাইডার", en: "Providers" },
    { id: "services", bn: "সার্ভিস টাইপ", en: "Service types" },
    { id: "equipment", bn: "ইকুইপমেন্ট", en: "Equipment" },
    { id: "statuses", bn: "স্ট্যাটাস / ফ্লো", en: "Statuses / workflow" },
    { id: "priorities", bn: "অগ্রাধিকার / SLA", en: "Priority / SLA" },
    { id: "form", bn: "রিকোয়েস্ট ফর্ম", en: "Request form" },
    { id: "features", bn: "ফিচার / প্রাইসিং", en: "Features / pricing" },
    { id: "notifications", bn: "নোটিফিকেশন", en: "Notifications" },
    { id: "audit", bn: "অডিট", en: "Audit" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        {lang === "bn"
          ? "অ্যাম্বুলেন্স সার্ভিস — সব ক্যাটালগ, ফ্লো ও সেটিংস এডমিন থেকে কন্ট্রোল। কোডে হার্ডকোড নেই।"
          : "Ambulance Service — catalogs, workflow and settings controlled from admin. Nothing hardcoded."}
      </p>
      <div className="flex flex-wrap gap-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSub(t.id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              sub === t.id ? "bg-rose-600 text-white" : "border border-slate-700 text-slate-300"
            }`}
          >
            {lang === "bn" ? t.bn : t.en}
          </button>
        ))}
      </div>
      {sub === "overview" && <OverviewPanel lang={lang} />}
      {sub === "providers" && <ProvidersPanel lang={lang} canEdit={canProviders} />}
      {sub === "services" && <ServiceTypesPanel lang={lang} canEdit={canEdit} />}
      {sub === "equipment" && <EquipmentPanel lang={lang} canEdit={canEdit} />}
      {sub === "statuses" && <StatusesPanel lang={lang} canEdit={canEdit} />}
      {sub === "priorities" && <PrioritiesPanel lang={lang} canEdit={canEdit} />}
      {sub === "form" && <FormFieldsPanel lang={lang} canEdit={canEdit} />}
      {sub === "features" && <FeaturesPanel lang={lang} canEdit={canEdit} />}
      {sub === "notifications" && <NotificationsPanel lang={lang} canEdit={canEdit} />}
      {sub === "audit" && can("ambulance.audit") && <AuditPanel lang={lang} />}
    </div>
  );
}

function OverviewPanel({ lang }: { lang: "bn" | "en" }) {
  const [stats, setStats] = useState<{ providers: number; listed: number; openRequests: number; completedToday: number } | null>(null);
  useEffect(() => {
    void fetchAmbulanceOverviewStats().then(setStats).catch(() => setStats(null));
  }, []);
  if (!stats) return <p className="text-xs text-slate-400">{lang === "bn" ? "লোড…" : "Loading…"}</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        [lang === "bn" ? "প্রোভাইডার" : "Providers", stats.providers],
        [lang === "bn" ? "তালিকাভুক্ত" : "Listed", stats.listed],
        [lang === "bn" ? "খোলা রিকোয়েস্ট" : "Open requests", stats.openRequests],
        [lang === "bn" ? "আজ সম্পন্ন" : "Completed today", stats.completedToday],
      ].map(([label, val]) => (
        <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          <p className="text-[10px] uppercase text-slate-500">{label}</p>
          <p className="text-2xl font-black text-rose-400 tabular-nums">{val}</p>
        </div>
      ))}
    </div>
  );
}

function ProvidersPanel({ lang, canEdit }: { lang: "bn" | "en"; canEdit: boolean }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  async function reload() {
    setRows((await fetchAmbulanceProviders()) as Record<string, unknown>[]);
  }
  useEffect(() => {
    void reload();
  }, []);
  async function patch(id: string, patch: Record<string, unknown>) {
    if (!canEdit) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    const { error } = await supabase.from("care_orgs").update(patch as never).eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "bn" ? "আপডেট" : "Updated");
      await reload();
    }
  }
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={String(r.id)} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs flex flex-wrap items-center gap-2">
          <span className="font-bold text-slate-100">{String(r.name_bn || r.name)}</span>
          <span className="text-slate-500">{String(r.kyc_status)}</span>
          {canEdit && (
            <>
              <button type="button" className="text-rose-400" onClick={() => void patch(String(r.id), { is_listed: !r.is_listed })}>
                {r.is_listed ? (lang === "bn" ? "আনলিস্ট" : "Unlist") : lang === "bn" ? "তালিকা" : "List"}
              </button>
              <button type="button" className="text-rose-400" onClick={() => void patch(String(r.id), { kyc_status: "verified", is_verified: true, is_listed: true })}>
                {lang === "bn" ? "ভেরিফাই" : "Verify"}
              </button>
            </>
          )}
        </li>
      ))}
      {rows.length === 0 && <li className="text-xs text-slate-500">{lang === "bn" ? "কোনো প্রোভাইডার নেই" : "No providers"}</li>}
    </ul>
  );
}

function ServiceTypesPanel({ lang, canEdit }: { lang: "bn" | "en"; canEdit: boolean }) {
  const [rows, setRows] = useState<AmbulanceServiceType[]>([]);
  const [slug, setSlug] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [nameEn, setNameEn] = useState("");
  useEffect(() => {
    void fetchAmbulanceServiceTypes().then(setRows);
  }, []);
  async function save(row: AmbulanceServiceType) {
    if (!canEdit) return;
    const { error } = await supabase.from("ambulance_service_types").upsert(row as never);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "bn" ? "সেভ" : "Saved");
      setRows(await fetchAmbulanceServiceTypes());
    }
  }
  async function add() {
    if (!slug.trim() || !nameBn.trim()) return;
    await save({ id: crypto.randomUUID(), slug: slug.trim(), name_bn: nameBn, name_en: nameEn || nameBn, icon: "Ambulance", is_active: true, sort_order: rows.length * 10 + 10 });
    setSlug("");
    setNameBn("");
    setNameEn("");
  }
  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="grid gap-2 sm:grid-cols-4">
          <input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug" className={ainp} />
          <input value={nameBn} onChange={(e) => setNameBn(e.target.value)} placeholder={lang === "bn" ? "নাম (বাং)" : "Name BN"} className={ainp} />
          <input value={nameEn} onChange={(e) => setNameEn(e.target.value)} placeholder="Name EN" className={ainp} />
          <button type="button" onClick={() => void add()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">
            {lang === "bn" ? "যোগ" : "Add"}
          </button>
        </div>
      )}
      <ul className="space-y-1">
        {rows.map((r, i) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 px-2 py-1.5 text-xs">
            <span className="font-mono text-slate-500">{r.slug}</span>
            <input value={r.name_bn} disabled={!canEdit} onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, name_bn: e.target.value } : x)))} className={ainp + " max-w-40"} />
            <input value={r.name_en} disabled={!canEdit} onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, name_en: e.target.value } : x)))} className={ainp + " max-w-40"} />
            {canEdit && (
              <button type="button" onClick={() => void save(r)} className="text-rose-400">
                <Save className="h-3.5 w-3.5" />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function EquipmentPanel({ lang, canEdit }: { lang: "bn" | "en"; canEdit: boolean }) {
  const [rows, setRows] = useState<AmbulanceEquipmentOption[]>([]);
  useEffect(() => {
    void fetchAmbulanceEquipmentOptions().then(setRows);
  }, []);
  async function save(row: AmbulanceEquipmentOption) {
    if (!canEdit) return;
    const { error } = await supabase.from("ambulance_equipment_options").upsert(row as never);
    if (error) toast.error(error.message);
    else setRows(await fetchAmbulanceEquipmentOptions());
  }
  return (
    <ul className="space-y-1">
      {rows.map((r, i) => (
        <li key={r.id} className="flex gap-2 text-xs items-center">
          <span className="font-mono text-slate-500 w-24">{r.slug}</span>
          <input value={r.name_bn} disabled={!canEdit} onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, name_bn: e.target.value } : x)))} className={ainp} />
          {canEdit && (
            <button type="button" onClick={() => void save(r)} className="text-rose-400">
              <Save className="h-3.5 w-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function StatusesPanel({ lang, canEdit }: { lang: "bn" | "en"; canEdit: boolean }) {
  const [statuses, setStatuses] = useState<AmbulanceStatusRow[]>([]);
  const [transitions, setTransitions] = useState<AmbulanceTransitionRow[]>([]);
  useEffect(() => {
    void Promise.all([fetchAmbulanceRequestStatuses(), fetchAmbulanceStatusTransitions()]).then(([s, t]) => {
      setStatuses(s);
      setTransitions(t);
    });
  }, []);
  async function saveStatus(row: AmbulanceStatusRow) {
    if (!canEdit) return;
    const { error } = await supabase.from("ambulance_request_statuses").upsert(row as never);
    if (error) toast.error(error.message);
    else setStatuses(await fetchAmbulanceRequestStatuses());
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div>
        <h3 className="text-xs font-bold text-slate-300 mb-2">{lang === "bn" ? "স্ট্যাটাস" : "Statuses"}</h3>
        <ul className="space-y-1">
          {statuses.map((r, i) => (
            <li key={r.slug} className="flex gap-2 text-xs items-center">
              <span className="font-mono w-24">{r.slug}</span>
              <input value={r.label_bn} disabled={!canEdit} onChange={(e) => setStatuses((p) => p.map((x, j) => (j === i ? { ...x, label_bn: e.target.value } : x)))} className={ainp} />
              {canEdit && (
                <button type="button" onClick={() => void saveStatus(r)} className="text-rose-400">
                  <Save className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="text-xs font-bold text-slate-300 mb-2">{lang === "bn" ? "ট্রানজিশন" : "Transitions"}</h3>
        <ul className="space-y-1 text-[11px] text-slate-400 font-mono">
          {transitions.map((t) => (
            <li key={t.id}>
              {t.from_status} → {t.to_status} ({t.actor_role})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PrioritiesPanel({ lang, canEdit }: { lang: "bn" | "en"; canEdit: boolean }) {
  const [rows, setRows] = useState<AmbulancePriorityLevel[]>([]);
  useEffect(() => {
    void fetchAmbulancePriorityLevels().then(setRows);
  }, []);
  async function save(row: AmbulancePriorityLevel) {
    if (!canEdit) return;
    const { error } = await supabase.from("ambulance_priority_levels").upsert(row as never);
    if (error) toast.error(error.message);
    else setRows(await fetchAmbulancePriorityLevels());
  }
  return (
    <ul className="space-y-1">
      {rows.map((r, i) => (
        <li key={r.id} className="flex gap-2 text-xs items-center flex-wrap">
          <span className="font-mono w-20">{r.slug}</span>
          <input value={r.name_bn} disabled={!canEdit} onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, name_bn: e.target.value } : x)))} className={ainp + " max-w-32"} />
          <input type="number" value={r.sla_minutes} disabled={!canEdit} onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, sla_minutes: Number(e.target.value) } : x)))} className={ainp + " w-20"} />
          <span className="text-slate-500">{lang === "bn" ? "মিনিট SLA" : "min SLA"}</span>
          {canEdit && (
            <button type="button" onClick={() => void save(r)} className="text-rose-400">
              <Save className="h-3.5 w-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function FormFieldsPanel({ lang, canEdit }: { lang: "bn" | "en"; canEdit: boolean }) {
  const [rows, setRows] = useState<AmbulanceFormField[]>([]);
  useEffect(() => {
    void fetchAmbulanceFormFields().then(setRows);
  }, []);
  async function save(row: AmbulanceFormField) {
    if (!canEdit) return;
    const { error } = await supabase.from("ambulance_form_fields").upsert(row as never);
    if (error) toast.error(error.message);
    else setRows(await fetchAmbulanceFormFields());
  }
  return (
    <ul className="space-y-1">
      {rows.map((r, i) => (
        <li key={r.field_key} className="flex flex-wrap gap-2 text-xs items-center">
          <span className="font-mono text-slate-500">{r.field_key}</span>
          <input value={r.label_bn} disabled={!canEdit} onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, label_bn: e.target.value } : x)))} className={ainp + " max-w-36"} />
          <label className="flex items-center gap-1">
            <input type="checkbox" disabled={!canEdit} checked={r.is_enabled} onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, is_enabled: e.target.checked } : x)))} />
            {lang === "bn" ? "চালু" : "On"}
          </label>
          <label className="flex items-center gap-1">
            <input type="checkbox" disabled={!canEdit} checked={r.is_required} onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, is_required: e.target.checked } : x)))} />
            {lang === "bn" ? "আবশ্যক" : "Required"}
          </label>
          {canEdit && (
            <button type="button" onClick={() => void save(r)} className="text-rose-400">
              <Save className="h-3.5 w-3.5" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function FeaturesPanel({ lang, canEdit }: { lang: "bn" | "en"; canEdit: boolean }) {
  const [settings, setSettings] = useState<AmbulanceSettings>(DEFAULT_AMBULANCE_SETTINGS);
  useEffect(() => {
    void fetchAmbulanceSettings().then(setSettings);
  }, []);
  async function save() {
    if (!canEdit) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    try {
      await saveAmbulanceSettings(settings);
      toast.success(lang === "bn" ? "সেভ হয়েছে" : "Saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  const Toggle = ({ k, label }: { k: keyof AmbulanceSettings["features"]; label: string }) => (
    <label className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 px-3 py-2 text-xs">
      <span>{label}</span>
      <input
        type="checkbox"
        disabled={!canEdit}
        checked={settings.features[k]}
        onChange={(e) => setSettings((s) => ({ ...s, features: { ...s.features, [k]: e.target.checked } }))}
      />
    </label>
  );
  return (
    <div className="space-y-4 max-w-xl">
      <div className="grid gap-2">
        <Toggle k="emergency_enabled" label={lang === "bn" ? "জরুরি বুকিং" : "Emergency booking"} />
        <Toggle k="scheduled_enabled" label={lang === "bn" ? "শিডিউল বুকিং" : "Scheduled booking"} />
        <Toggle k="auto_assign" label={lang === "bn" ? "অটো অ্যাসাইন" : "Auto assign vehicle"} />
        <Toggle k="require_quote_approval" label={lang === "bn" ? "কোট অনুমোদন" : "Require quote approval"} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs">
          {lang === "bn" ? "সার্চ রেডিয়াস (কিমি)" : "Search radius (km)"}
          <input type="number" disabled={!canEdit} value={settings.coverage.default_search_radius_km} onChange={(e) => setSettings((s) => ({ ...s, coverage: { ...s.coverage, default_search_radius_km: Number(e.target.value) } }))} className={ainp + " mt-1"} />
        </label>
        <label className="text-xs">
          {lang === "bn" ? "কমিশন %" : "Commission %"}
          <input type="number" disabled={!canEdit} value={settings.pricing.platform_commission_pct} onChange={(e) => setSettings((s) => ({ ...s, pricing: { ...s.pricing, platform_commission_pct: Number(e.target.value) } }))} className={ainp + " mt-1"} />
        </label>
        <label className="text-xs">
          {lang === "bn" ? "মিন ফেয়ার ক্যাপ (০=বন্ধ)" : "Min fare cap (0=off)"}
          <input type="number" disabled={!canEdit} value={settings.pricing.min_fare_cap} onChange={(e) => setSettings((s) => ({ ...s, pricing: { ...s.pricing, min_fare_cap: Number(e.target.value) } }))} className={ainp + " mt-1"} />
        </label>
        <label className="text-xs">
          {lang === "bn" ? "ম্যাক্স ফেয়ার ক্যাপ (০=বন্ধ)" : "Max fare cap (0=off)"}
          <input type="number" disabled={!canEdit} value={settings.pricing.max_fare_cap} onChange={(e) => setSettings((s) => ({ ...s, pricing: { ...s.pricing, max_fare_cap: Number(e.target.value) } }))} className={ainp + " mt-1"} />
        </label>
      </div>
      <p className="text-[11px] text-slate-500">
        {lang === "bn"
          ? "প্রতি-অর্গ ডিস্কাউন্ট % অ্যাম্বুলেন্স ডেস্ক → রেট ও ডিস্কাউন্ট থেকে নিয়ন্ত্রণ করুন। প্ল্যাটফর্ম ক্যাপ সব ভাড়ায় প্রয়োগ হয়।"
          : "Per-org discount % is controlled on Ambulance desk → Rates & offers. Platform caps apply to all fares."}
      </p>
      {canEdit && (
        <button type="button" onClick={() => void save()} className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white">
          {lang === "bn" ? "সেভ" : "Save settings"}
        </button>
      )}
    </div>
  );
}

function NotificationsPanel({ lang, canEdit }: { lang: "bn" | "en"; canEdit: boolean }) {
  const [rows, setRows] = useState<AmbulanceNotifTemplate[]>([]);
  useEffect(() => {
    void fetchAmbulanceNotifTemplates().then(setRows);
  }, []);
  async function save(row: AmbulanceNotifTemplate) {
    if (!canEdit) return;
    const { error } = await supabase.from("ambulance_notif_templates").upsert(row as never);
    if (error) toast.error(error.message);
    else setRows(await fetchAmbulanceNotifTemplates());
  }
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={r.slug} className="rounded-lg border border-slate-800 p-2 space-y-1">
          <p className="font-mono text-[10px] text-slate-500">{r.slug}</p>
          <input value={r.body_bn} disabled={!canEdit} onChange={(e) => setRows((p) => p.map((x, j) => (j === i ? { ...x, body_bn: e.target.value } : x)))} className={ainp} />
          {canEdit && (
            <button type="button" onClick={() => void save(r)} className="text-rose-400 text-xs">
              {lang === "bn" ? "সেভ" : "Save"}
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

function AuditPanel({ lang }: { lang: "bn" | "en" }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    void fetchAmbulanceAudit(80).then(setRows);
  }, []);
  return (
    <ul className="space-y-1 text-[11px] font-mono text-slate-400 max-h-96 overflow-y-auto">
      {rows.map((r) => (
        <li key={String(r.id)} className="border-b border-slate-800 py-1">
          {String(r.created_at)} · {String(r.event_type)} · {String(r.from_status)}→{String(r.to_status)}
        </li>
      ))}
      {rows.length === 0 && <li>{lang === "bn" ? "কোনো ইভেন্ট নেই" : "No events"}</li>}
    </ul>
  );
}
