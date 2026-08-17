import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCareHubModules,
  fetchCarePolicies,
  fetchCareSpecialties,
  fetchCareVendorOnboarding,
  fetchCareVendorTypes,
  fetchLabBookingStatuses,
  fetchSerialStatuses,
  fetchTestCatalog,
  fetchTestCategories,
  saveCarePolicies,
  saveCareVendorOnboarding,
  type CareBookingPolicies,
  type CareFeatureFlags,
  type CareHubModule,
  type CareSpecialty,
  type CareStatusRow,
  type CareTestCatalogItem,
  type CareTestCategory,
  type CareVendorFieldKey,
  type CareVendorOnboardingSettings,
  type CareVendorType,
} from "@/lib/care-cms";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

type Sub =
  | "orgs"
  | "onboarding"
  | "hub"
  | "vendors"
  | "specialties"
  | "tests"
  | "statuses"
  | "policies"
  | "notifs"
  | "audit";

export function CareAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const [sub, setSub] = useState<Sub>("orgs");
  const canEdit = can("care.edit");
  const canKyc = can("care.kyc") || can("care.orgs") || canEdit;

  const tabs: { id: Sub; bn: string; en: string }[] = [
    { id: "orgs", bn: "ভেন্ডর / KYC", en: "Vendors / KYC" },
    { id: "onboarding", bn: "অনবোর্ডিং ফিল্ড", en: "Onboarding fields" },
    { id: "hub", bn: "হাব মডিউল", en: "Hub modules" },
    { id: "vendors", bn: "ভেন্ডর টাইপ", en: "Vendor types" },
    { id: "specialties", bn: "স্পেশালিটি", en: "Specialties" },
    { id: "tests", bn: "টেস্ট ক্যাটালগ", en: "Test catalog" },
    { id: "statuses", bn: "স্ট্যাটাস", en: "Statuses" },
    { id: "policies", bn: "পলিসি / ফ্ল্যাগ", en: "Policies / flags" },
    { id: "notifs", bn: "নোটিফ টেমপ্লেট", en: "Notif templates" },
    { id: "audit", bn: "অডিট", en: "Audit" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">
        {lang === "bn"
          ? "কেয়ার CMS — স্পেশালিটি, টেস্ট, ভেন্ডর টাইপ, হাব ট্যাব কোডে হার্ডকোড নয়।"
          : "Care CMS — specialties, tests, vendor types and hub tabs are not hardcoded."}
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
      {sub === "orgs" && <OrgsPanel canKyc={canKyc} lang={lang} />}
      {sub === "onboarding" && <VendorOnboardingPanel canEdit={canEdit} lang={lang} />}
      {sub === "hub" && <HubPanel canEdit={canEdit} lang={lang} />}
      {sub === "vendors" && <VendorTypesPanel canEdit={canEdit} lang={lang} />}
      {sub === "specialties" && <SpecialtiesPanel canEdit={canEdit} lang={lang} />}
      {sub === "tests" && <TestsPanel canEdit={canEdit} lang={lang} />}
      {sub === "statuses" && <StatusesPanel canEdit={canEdit} lang={lang} />}
      {sub === "policies" && <PoliciesPanel canEdit={canEdit} lang={lang} />}
      {sub === "notifs" && <NotifsPanel canEdit={canEdit} lang={lang} />}
      {sub === "audit" && <AuditPanel lang={lang} />}
    </div>
  );
}

function OrgsPanel({ canKyc, lang }: { canKyc: boolean; lang: "bn" | "en" }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [name, setName] = useState("");
  const [kinds, setKinds] = useState<CareVendorType[]>([]);
  const [kindId, setKindId] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "pending" | "verified">("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function reload() {
    const { data, error } = await supabase
      .from("care_orgs")
      .select(
        "id, name, name_bn, phone, email, upazila, address, is_active, is_verified, is_listed, kyc_status, kyc_notes, featured, org_kind_id, profile_completed, profile_submitted_at, created_at, districts(name_bn, name_en)",
      )
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setRows((data as Record<string, unknown>[]) ?? []);
  }

  const filtered = rows.filter((r) => {
    const st = String(r.kyc_status ?? "");
    if (filter === "draft") return st === "draft";
    if (filter === "pending") return st === "pending";
    if (filter === "verified") return st === "verified" || r.is_verified;
    return true;
  });

  const counts = {
    draft: rows.filter((r) => r.kyc_status === "draft").length,
    pending: rows.filter((r) => r.kyc_status === "pending").length,
    verified: rows.filter((r) => r.is_verified).length,
  };

  useEffect(() => {
    void reload();
    void fetchCareVendorTypes(false).then((k) => {
      setKinds(k);
      if (k[0]) setKindId(k[0].id);
    });
  }, []);

  async function create() {
    if (!name.trim()) return;
    const { data, error } = await supabase
      .from("care_orgs")
      .insert({ name: name.trim(), org_kind_id: kindId || null, kyc_status: "pending" } as never)
      .select("id")
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await supabase.rpc("ensure_care_default_roles", { _org_id: (data as { id: string }).id } as never);
    setName("");
    await reload();
  }

  async function patch(id: string, body: Record<string, unknown>) {
    const { error } = await supabase.from("care_orgs").update(body as never).eq("id", id);
    if (error) toast.error(error.message);
    else await reload();
  }

  async function approve(id: string) {
    await patch(id, { kyc_status: "verified", is_verified: true, is_listed: true });
    toast.success(lang === "bn" ? "অনুমোদিত" : "Approved");
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", lang === "bn" ? "সব" : "All", rows.length],
            ["draft", lang === "bn" ? "খসড়া" : "Draft", counts.draft],
            ["pending", lang === "bn" ? "অপেক্ষমান" : "Pending", counts.pending],
            ["verified", lang === "bn" ? "অনুমোদিত" : "Verified", counts.verified],
          ] as const
        ).map(([id, label, n]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
              filter === id ? "bg-rose-600 text-white" : "border border-slate-700 text-slate-300"
            }`}
          >
            {label} ({n})
          </button>
        ))}
      </div>
      {canKyc && (
        <div className="flex flex-wrap gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={lang === "bn" ? "নতুন অর্গ নাম" : "New org name"} className={ainp + " max-w-xs"} />
          <select value={kindId} onChange={(e) => setKindId(e.target.value)} className={ainp + " max-w-[10rem]"}>
            {kinds.map((k) => (
              <option key={k.id} value={k.id}>
                {k.slug}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void create()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">
            {lang === "bn" ? "তৈরি" : "Create"}
          </button>
        </div>
      )}
      <div className="space-y-2">
        {filtered.map((r) => {
          const id = String(r.id);
          const open = expanded === id;
          const district = r.districts as { name_bn?: string; name_en?: string } | null;
          const kind = kinds.find((k) => k.id === r.org_kind_id);
          return (
            <div key={id} className="rounded-xl border border-slate-800 overflow-hidden">
              <button type="button" className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-slate-900/50" onClick={() => setExpanded(open ? null : id)}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-100 truncate">{String(r.name)}</p>
                  <p className="text-[11px] text-slate-400">{String(r.phone || "—")} · {kind?.slug ?? "—"}</p>
                </div>
                <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase bg-slate-800 text-slate-300">{String(r.kyc_status)}</span>
              </button>
              {open && (
                <div className="border-t border-slate-800 px-3 py-3 space-y-2 text-xs text-slate-300">
                  <p>{lang === "bn" ? "জেলা" : "District"}: {district?.name_en || district?.name_bn || "—"} · {String(r.upazila || "—")}</p>
                  <p>{lang === "bn" ? "ঠিকানা" : "Address"}: {String(r.address || "—")}</p>
                  <p>Submitted: {r.profile_submitted_at ? String(r.profile_submitted_at).slice(0, 19) : "—"}</p>
                  {canKyc && (
                    <div className="flex flex-wrap gap-2 items-center">
                      <select value={String(r.kyc_status)} onChange={(e) => void patch(id, { kyc_status: e.target.value, is_verified: e.target.value === "verified" })} className={ainp + " max-w-[8rem]"}>
                        <option value="draft">draft</option>
                        <option value="pending">pending</option>
                        <option value="verified">verified</option>
                        <option value="rejected">rejected</option>
                      </select>
                      {r.kyc_status === "pending" && (
                        <button type="button" onClick={() => void approve(id)} className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white">{lang === "bn" ? "অনুমোদন" : "Approve"}</button>
                      )}
                      <label className="inline-flex items-center gap-1"><input type="checkbox" checked={!!r.is_listed} onChange={(e) => void patch(id, { is_listed: e.target.checked })} />listed</label>
                      <label className="inline-flex items-center gap-1"><input type="checkbox" checked={!!r.is_active} onChange={(e) => void patch(id, { is_active: e.target.checked })} />active</label>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function VendorOnboardingPanel({ canEdit, lang }: { canEdit: boolean; lang: "bn" | "en" }) {
  const [settings, setSettings] = useState<CareVendorOnboardingSettings | null>(null);
  useEffect(() => {
    void fetchCareVendorOnboarding().then(setSettings);
  }, []);
  if (!settings) return null;
  const keys = Object.keys(settings.fields) as CareVendorFieldKey[];
  return (
    <div className="space-y-3 max-w-2xl">
      <p className="text-xs text-slate-400">{lang === "bn" ? "ভেন্ডর প্রোফাইল ফিল্ড নিয়ন্ত্রণ" : "Vendor profile field controls"}</p>
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-xs">
          <thead className="bg-slate-900 text-slate-400"><tr><th className="px-2 py-2 text-left">Field</th><th className="px-2 py-2 text-left">BN</th><th className="px-2 py-2 text-left">EN</th><th className="px-2 py-2">On</th><th className="px-2 py-2">Req</th></tr></thead>
          <tbody>
            {keys.map((key) => {
              const f = settings.fields[key];
              return (
                <tr key={key} className="border-t border-slate-800">
                  <td className="px-2 py-2 font-mono">{key}</td>
                  <td className="px-2 py-2"><input disabled={!canEdit} className={ainp} value={f.label_bn} onChange={(e) => setSettings((p) => p ? { ...p, fields: { ...p.fields, [key]: { ...f, label_bn: e.target.value } } } : p)} /></td>
                  <td className="px-2 py-2"><input disabled={!canEdit} className={ainp} value={f.label_en} onChange={(e) => setSettings((p) => p ? { ...p, fields: { ...p.fields, [key]: { ...f, label_en: e.target.value } } } : p)} /></td>
                  <td className="px-2 py-2"><input type="checkbox" disabled={!canEdit} checked={f.enabled} onChange={(e) => setSettings((p) => p ? { ...p, fields: { ...p.fields, [key]: { ...f, enabled: e.target.checked } } } : p)} /></td>
                  <td className="px-2 py-2"><input type="checkbox" disabled={!canEdit || !f.enabled} checked={f.required} onChange={(e) => setSettings((p) => p ? { ...p, fields: { ...p.fields, [key]: { ...f, required: e.target.checked } } } : p)} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {canEdit && (
        <button type="button" onClick={() => void saveCareVendorOnboarding(settings).then(() => toast.success(lang === "bn" ? "সেভ" : "Saved"))} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white">
          {lang === "bn" ? "সেভ" : "Save"}
        </button>
      )}
    </div>
  );
}

function HubPanel({ canEdit, lang }: { canEdit: boolean; lang: "bn" | "en" }) {
  const [rows, setRows] = useState<CareHubModule[]>([]);
  useEffect(() => {
    void supabase
      .from("care_hub_modules")
      .select("id, slug, label_bn, label_en, icon, href, audience, is_enabled, sort_order")
      .order("sort_order")
      .then(({ data }) => setRows((data as CareHubModule[]) ?? []));
  }, []);

  async function saveRow(row: CareHubModule) {
    const { error } = await supabase.from("care_hub_modules").upsert(row as never);
    if (error) toast.error(error.message);
    else toast.success(lang === "bn" ? "সেভ" : "Saved");
  }

  async function add() {
    const slug = `mod_${Date.now().toString(36)}`;
    const { error } = await supabase.from("care_hub_modules").insert({
      slug,
      label_bn: "নতুন",
      label_en: "New",
      icon: "LayoutGrid",
      href: "/care",
      audience: "patient",
      is_enabled: true,
      sort_order: (rows.at(-1)?.sort_order ?? 0) + 10,
    } as never);
    if (error) toast.error(error.message);
    else {
      const next = await fetchCareHubModules();
      void next;
      const { data } = await supabase.from("care_hub_modules").select("id, slug, label_bn, label_en, icon, href, audience, is_enabled, sort_order").order("sort_order");
      setRows((data as CareHubModule[]) ?? []);
    }
  }

  return (
    <div className="space-y-2">
      {canEdit && (
        <button type="button" onClick={() => void add()} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-200">
          <Plus className="h-3.5 w-3.5" /> {lang === "bn" ? "মডিউল" : "Module"}
        </button>
      )}
      {rows.map((r, idx) => (
        <div key={r.id} className="grid gap-1 sm:grid-cols-6 rounded-xl border border-slate-800 p-2">
          <input className={ainp} value={r.slug} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, slug: e.target.value } : x)))} />
          <input className={ainp} value={r.label_bn} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, label_bn: e.target.value } : x)))} />
          <input className={ainp} value={r.label_en} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, label_en: e.target.value } : x)))} />
          <input className={ainp} value={r.href} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, href: e.target.value } : x)))} />
          <input className={ainp} value={r.icon} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, icon: e.target.value } : x)))} />
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-300">
              <input type="checkbox" checked={r.is_enabled} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, is_enabled: e.target.checked } : x)))} /> on
            </label>
            {canEdit && (
              <button type="button" onClick={() => void saveRow(rows[idx]!)} className="text-rose-400">
                <Save className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function VendorTypesPanel({ canEdit, lang }: { canEdit: boolean; lang: "bn" | "en" }) {
  const [rows, setRows] = useState<CareVendorType[]>([]);
  useEffect(() => {
    void fetchCareVendorTypes(false).then(setRows);
  }, []);
  async function save(row: CareVendorType) {
    const { error } = await supabase.from("care_vendor_types").upsert({
      id: row.id,
      slug: row.slug,
      name_bn: row.name_bn,
      name_en: row.name_en,
      panels: row.panels,
      is_active: row.is_active,
      sort_order: row.sort_order,
    } as never);
    if (error) toast.error(error.message);
    else toast.success(lang === "bn" ? "সেভ" : "Saved");
  }
  async function add() {
    const { error } = await supabase.from("care_vendor_types").insert({
      slug: `type_${Date.now().toString(36)}`,
      name_bn: "নতুন",
      name_en: "New",
      panels: ["desk"],
      sort_order: 99,
    } as never);
    if (error) toast.error(error.message);
    else setRows(await fetchCareVendorTypes(false));
  }
  return (
    <div className="space-y-2">
      {canEdit && (
        <button type="button" onClick={() => void add()} className="rounded-lg border border-slate-700 px-2 py-1 text-xs">
          <Plus className="h-3.5 w-3.5 inline" /> {lang === "bn" ? "টাইপ" : "Type"}
        </button>
      )}
      {rows.map((r, idx) => (
        <div key={r.id} className="grid gap-1 sm:grid-cols-5 rounded-xl border border-slate-800 p-2">
          <input className={ainp} value={r.slug} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, slug: e.target.value } : x)))} />
          <input className={ainp} value={r.name_bn} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, name_bn: e.target.value } : x)))} />
          <input className={ainp} value={r.name_en} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, name_en: e.target.value } : x)))} />
          <input
            className={ainp}
            value={r.panels.join(",")}
            onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, panels: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) } : x)))}
          />
          {canEdit && (
            <button type="button" onClick={() => void save(rows[idx]!)} className="text-rose-400">
              <Save className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function SpecialtiesPanel({ canEdit, lang }: { canEdit: boolean; lang: "bn" | "en" }) {
  const [rows, setRows] = useState<CareSpecialty[]>([]);
  useEffect(() => {
    void fetchCareSpecialties(false).then(setRows);
  }, []);
  async function save(row: CareSpecialty) {
    const { error } = await supabase.from("care_specialties").upsert(row as never);
    if (error) toast.error(error.message);
    else toast.success(lang === "bn" ? "সেভ" : "Saved");
  }
  async function add() {
    const { error } = await supabase.from("care_specialties").insert({
      slug: `sp_${Date.now().toString(36)}`,
      name_bn: "নতুন",
      name_en: "New",
      sort_order: 99,
    } as never);
    if (error) toast.error(error.message);
    else setRows(await fetchCareSpecialties(false));
  }
  async function del(id: string) {
    const { error } = await supabase.from("care_specialties").delete().eq("id", id);
    if (error) toast.error(error.message);
    else setRows((p) => p.filter((x) => x.id !== id));
  }
  return (
    <div className="space-y-2">
      {canEdit && (
        <button type="button" onClick={() => void add()} className="rounded-lg border border-slate-700 px-2 py-1 text-xs">
          <Plus className="h-3.5 w-3.5 inline" />
        </button>
      )}
      {rows.map((r, idx) => (
        <div key={r.id} className="grid gap-1 sm:grid-cols-5 rounded-xl border border-slate-800 p-2">
          <input className={ainp} value={r.slug} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, slug: e.target.value } : x)))} />
          <input className={ainp} value={r.name_bn} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, name_bn: e.target.value } : x)))} />
          <input className={ainp} value={r.name_en} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, name_en: e.target.value } : x)))} />
          <label className="text-[11px] text-slate-300">
            <input type="checkbox" checked={r.is_active} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, is_active: e.target.checked } : x)))} /> active
          </label>
          {canEdit && (
            <div className="flex gap-2">
              <button type="button" onClick={() => void save(rows[idx]!)}>
                <Save className="h-3.5 w-3.5 text-rose-400" />
              </button>
              <button type="button" onClick={() => void del(r.id)}>
                <Trash2 className="h-3.5 w-3.5 text-slate-500" />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TestsPanel({ canEdit, lang }: { canEdit: boolean; lang: "bn" | "en" }) {
  const [cats, setCats] = useState<CareTestCategory[]>([]);
  const [items, setItems] = useState<CareTestCatalogItem[]>([]);
  useEffect(() => {
    void fetchTestCategories(false).then(setCats);
    void fetchTestCatalog(false).then(setItems);
  }, []);

  async function addCat() {
    const { error } = await supabase.from("care_test_categories").insert({
      slug: `cat_${Date.now().toString(36)}`,
      name_bn: "নতুন",
      name_en: "New",
      sort_order: 99,
    } as never);
    if (error) toast.error(error.message);
    else setCats(await fetchTestCategories(false));
  }
  async function addTest() {
    const { error } = await supabase.from("care_test_catalog").insert({
      code: `T${Date.now().toString(36).slice(-4).toUpperCase()}`,
      name_bn: "নতুন টেস্ট",
      name_en: "New test",
      category_id: cats[0]?.id ?? null,
      sort_order: 99,
    } as never);
    if (error) toast.error(error.message);
    else setItems(await fetchTestCatalog(false));
  }
  async function saveCat(c: CareTestCategory) {
    const { error } = await supabase.from("care_test_categories").upsert(c as never);
    if (error) toast.error(error.message);
  }
  async function saveItem(c: CareTestCatalogItem) {
    const { error } = await supabase.from("care_test_catalog").upsert(c as never);
    if (error) toast.error(error.message);
    else toast.success(lang === "bn" ? "সেভ" : "Saved");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300">{lang === "bn" ? "ক্যাটাগরি" : "Categories"}</h3>
        {canEdit && (
          <button type="button" onClick={() => void addCat()} className="text-xs text-rose-400">
            + cat
          </button>
        )}
      </div>
      {cats.map((c, idx) => (
        <div key={c.id} className="grid sm:grid-cols-4 gap-1">
          <input className={ainp} value={c.slug} onChange={(e) => setCats((p) => p.map((x, i) => (i === idx ? { ...x, slug: e.target.value } : x)))} />
          <input className={ainp} value={c.name_bn} onChange={(e) => setCats((p) => p.map((x, i) => (i === idx ? { ...x, name_bn: e.target.value } : x)))} />
          <input className={ainp} value={c.name_en} onChange={(e) => setCats((p) => p.map((x, i) => (i === idx ? { ...x, name_en: e.target.value } : x)))} />
          {canEdit && (
            <button type="button" onClick={() => void saveCat(cats[idx]!)} className="text-rose-400 text-xs">
              save
            </button>
          )}
        </div>
      ))}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-300">{lang === "bn" ? "টেস্ট" : "Tests"}</h3>
        {canEdit && (
          <button type="button" onClick={() => void addTest()} className="text-xs text-rose-400">
            + test
          </button>
        )}
      </div>
      {items.map((c, idx) => (
        <div key={c.id} className="rounded-xl border border-slate-800 p-2 grid sm:grid-cols-2 gap-1">
          <input className={ainp} value={c.code} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, code: e.target.value } : x)))} />
          <select
            className={ainp}
            value={c.category_id ?? ""}
            onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, category_id: e.target.value || null } : x)))}
          >
            <option value="">—</option>
            {cats.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.slug}
              </option>
            ))}
          </select>
          <input className={ainp} value={c.name_bn} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, name_bn: e.target.value } : x)))} />
          <input className={ainp} value={c.name_en} onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, name_en: e.target.value } : x)))} />
          <input className={ainp} value={c.prep_bn ?? ""} placeholder="prep bn" onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, prep_bn: e.target.value } : x)))} />
          <input className={ainp} value={c.prep_en ?? ""} placeholder="prep en" onChange={(e) => setItems((p) => p.map((x, i) => (i === idx ? { ...x, prep_en: e.target.value } : x)))} />
          {canEdit && (
            <button type="button" onClick={() => void saveItem(items[idx]!)} className="text-rose-400 text-xs">
              save
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function StatusesPanel({ canEdit, lang }: { canEdit: boolean; lang: "bn" | "en" }) {
  const [serial, setSerial] = useState<CareStatusRow[]>([]);
  const [lab, setLab] = useState<CareStatusRow[]>([]);
  useEffect(() => {
    void fetchSerialStatuses().then(setSerial);
    void fetchLabBookingStatuses().then(setLab);
  }, []);
  async function save(table: "care_serial_statuses" | "care_lab_booking_statuses", row: CareStatusRow) {
    const { error } = await supabase.from(table).upsert(row as never);
    if (error) toast.error(error.message);
    else toast.success(lang === "bn" ? "সেভ" : "Saved");
  }
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300">Serial</h3>
        {serial.map((r, idx) => (
          <div key={r.slug} className="grid grid-cols-3 gap-1">
            <span className="text-[11px] text-slate-400 self-center">{r.slug}</span>
            <input className={ainp} value={r.label_bn} onChange={(e) => setSerial((p) => p.map((x, i) => (i === idx ? { ...x, label_bn: e.target.value } : x)))} />
            {canEdit && (
              <button type="button" className="text-xs text-rose-400" onClick={() => void save("care_serial_statuses", serial[idx]!)}>
                save
              </button>
            )}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h3 className="text-xs font-bold text-slate-300">Lab</h3>
        {lab.map((r, idx) => (
          <div key={r.slug} className="grid grid-cols-3 gap-1">
            <span className="text-[11px] text-slate-400 self-center">{r.slug}</span>
            <input className={ainp} value={r.label_bn} onChange={(e) => setLab((p) => p.map((x, i) => (i === idx ? { ...x, label_bn: e.target.value } : x)))} />
            {canEdit && (
              <button type="button" className="text-xs text-rose-400" onClick={() => void save("care_lab_booking_statuses", lab[idx]!)}>
                save
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PoliciesPanel({ canEdit, lang }: { canEdit: boolean; lang: "bn" | "en" }) {
  const [policies, setPolicies] = useState<CareBookingPolicies | null>(null);
  const [flags, setFlags] = useState<CareFeatureFlags | null>(null);
  useEffect(() => {
    void fetchCarePolicies().then((r) => {
      setPolicies(r.policies);
      setFlags(r.flags);
    });
  }, []);
  if (!policies || !flags) return null;
  return (
    <div className="space-y-3 max-w-md">
      {(Object.keys(policies) as (keyof CareBookingPolicies)[]).map((k) => (
        <label key={k} className="flex items-center justify-between gap-3 text-xs text-slate-200">
          <span>{k}</span>
          {typeof policies[k] === "boolean" ? (
            <input
              type="checkbox"
              checked={policies[k] as boolean}
              onChange={(e) => setPolicies({ ...policies, [k]: e.target.checked })}
            />
          ) : (
            <input
              className={ainp + " w-24"}
              type="number"
              value={policies[k] as number}
              onChange={(e) => setPolicies({ ...policies, [k]: Number(e.target.value) })}
            />
          )}
        </label>
      ))}
      {(Object.keys(flags) as (keyof CareFeatureFlags)[]).map((k) => (
        <label key={k} className="flex items-center justify-between gap-3 text-xs text-slate-200">
          <span>flag: {k}</span>
          <input type="checkbox" checked={flags[k]} onChange={(e) => setFlags({ ...flags, [k]: e.target.checked })} />
        </label>
      ))}
      {canEdit && (
        <button
          type="button"
          onClick={() =>
            void saveCarePolicies(policies, flags)
              .then(() => toast.success(lang === "bn" ? "সেভ" : "Saved"))
              .catch((e) => toast.error((e as Error).message))
          }
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white"
        >
          {lang === "bn" ? "সেভ পলিসি" : "Save policies"}
        </button>
      )}
    </div>
  );
}

function NotifsPanel({ canEdit, lang }: { canEdit: boolean; lang: "bn" | "en" }) {
  const [rows, setRows] = useState<{ slug: string; title_bn: string; title_en: string; body_bn: string; body_en: string; is_active: boolean }[]>([]);
  useEffect(() => {
    void supabase
      .from("care_notif_templates")
      .select("slug, title_bn, title_en, body_bn, body_en, is_active")
      .then(({ data }) => setRows((data as typeof rows) ?? []));
  }, []);
  async function add() {
    const slug = `care_custom_${Date.now().toString(36)}`;
    const { error } = await supabase.from("care_notif_templates").insert({
      slug,
      title_bn: "নতুন",
      title_en: "New",
      body_bn: "",
      body_en: "",
    } as never);
    if (error) toast.error(error.message);
    else {
      const { data } = await supabase.from("care_notif_templates").select("slug, title_bn, title_en, body_bn, body_en, is_active");
      setRows((data as typeof rows) ?? []);
    }
  }
  async function save(row: (typeof rows)[number]) {
    const { error } = await supabase.from("care_notif_templates").upsert(row as never);
    if (error) toast.error(error.message);
    else toast.success(lang === "bn" ? "সেভ" : "Saved");
  }
  return (
    <div className="space-y-2">
      {canEdit && (
        <button type="button" onClick={() => void add()} className="text-xs text-rose-400">
          + template
        </button>
      )}
      {rows.map((r, idx) => (
        <div key={r.slug} className="rounded-xl border border-slate-800 p-2 grid sm:grid-cols-2 gap-1">
          <input className={ainp} value={r.slug} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, slug: e.target.value } : x)))} />
          <input className={ainp} value={r.title_en} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, title_en: e.target.value } : x)))} />
          <input className={ainp} value={r.title_bn} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, title_bn: e.target.value } : x)))} />
          <input className={ainp} value={r.body_bn} onChange={(e) => setRows((p) => p.map((x, i) => (i === idx ? { ...x, body_bn: e.target.value } : x)))} />
          {canEdit && (
            <button type="button" className="text-xs text-rose-400" onClick={() => void save(rows[idx]!)}>
              save
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function AuditPanel({ lang }: { lang: "bn" | "en" }) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    void supabase
      .from("care_audit_log")
      .select("id, org_id, actor_id, action, entity, entity_id, created_at")
      .order("created_at", { ascending: false })
      .limit(80)
      .then(({ data, error }) => {
        if (error) toast.error(error.message);
        else setRows((data as Record<string, unknown>[]) ?? []);
      });
  }, []);
  return (
    <ul className="space-y-1 text-xs text-slate-300">
      {rows.map((r) => (
        <li key={String(r.id)} className="rounded-lg border border-slate-800 px-2 py-1.5 font-mono">
          {String(r.created_at).slice(0, 19)} · {String(r.action)} · {String(r.entity)}
        </li>
      ))}
      {rows.length === 0 && <li className="text-slate-500">{lang === "bn" ? "অডিট খালি" : "No audit rows"}</li>}
    </ul>
  );
}
