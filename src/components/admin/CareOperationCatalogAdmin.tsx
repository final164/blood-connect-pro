import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Scissors, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  deleteOperationCatalogItem,
  fetchOperationCatalog,
  fetchOperationCategories,
  upsertOperationCatalogItem,
  type CareOperationCatalogItem,
  type CareOperationCategory,
} from "@/lib/care-operations-api";
import { fetchCareSpecialties, type CareSpecialty } from "@/lib/care-cms";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

type Draft = Partial<CareOperationCatalogItem>;

const emptyDraft: Draft = { code: "", name_bn: "", name_en: "", is_active: true, sort_order: 0 };

/**
 * Procedure catalog. Clinics pick from this list and attach their own package
 * price, so the names and preparation notes stay consistent platform-wide.
 */
export function CareOperationCatalogAdmin({ canEdit, lang }: { canEdit: boolean; lang: "bn" | "en" }) {
  const bn = lang === "bn";
  const [items, setItems] = useState<CareOperationCatalogItem[]>([]);
  const [categories, setCategories] = useState<CareOperationCategory[]>([]);
  const [specialties, setSpecialties] = useState<CareSpecialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [list, cats, specs] = await Promise.all([
        fetchOperationCatalog(),
        fetchOperationCategories(),
        fetchCareSpecialties(),
      ]);
      setItems(list);
      setCategories(cats);
      setSpecialties(specs);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((i) => {
      if (categoryFilter !== "all" && (i.category_id ?? "") !== categoryFilter) return false;
      if (!needle) return true;
      return [i.code, i.name_bn, i.name_en].filter(Boolean).join(" ").toLowerCase().includes(needle);
    });
  }, [items, q, categoryFilter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={bn ? "অপারেশন খুঁজুন…" : "Search operations…"}
          className={`${ainp} max-w-xs`}
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={`${ainp} max-w-[11rem]`}
        >
          <option value="all">{bn ? "সব ক্যাটাগরি" : "All categories"}</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {bn ? c.name_bn : c.name_en}
            </option>
          ))}
        </select>
        {canEdit && (
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            {bn ? "নতুন অপারেশন" : "New operation"}
          </button>
        )}
        <span className="text-[11px] text-slate-500">
          {loading ? (bn ? "লোড হচ্ছে…" : "Loading…") : `${filtered.length} / ${items.length}`}
        </span>
      </div>

      {creating && canEdit && (
        <CatalogForm
          draft={emptyDraft}
          categories={categories}
          specialties={specialties}
          lang={lang}
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void reload();
          }}
        />
      )}

      <ul className="space-y-2">
        {filtered.map((item) => (
          <li key={item.id} className="rounded-lg border border-slate-800 bg-slate-900/40">
            <button
              type="button"
              onClick={() => setOpenId(openId === item.id ? null : item.id)}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
            >
              <Scissors className="h-4 w-4 shrink-0 text-rose-400" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-slate-100">
                  {bn ? item.name_bn : item.name_en}
                </span>
                <span className="block truncate text-[10px] text-slate-500">
                  {item.code}
                  {item.typical_duration_minutes ? ` · ${item.typical_duration_minutes} min` : ""}
                  {item.typical_stay_days
                    ? ` · ${item.typical_stay_days} ${bn ? "দিন ভর্তি" : "day stay"}`
                    : ""}
                </span>
              </span>
              {!item.is_active && (
                <span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-[9px] text-slate-400">
                  {bn ? "নিষ্ক্রিয়" : "inactive"}
                </span>
              )}
            </button>
            {openId === item.id && (
              <div className="border-t border-slate-800 px-3 py-3">
                <CatalogForm
                  draft={item}
                  categories={categories}
                  specialties={specialties}
                  lang={lang}
                  canEdit={canEdit}
                  onSaved={() => void reload()}
                />
              </div>
            )}
          </li>
        ))}
        {!loading && filtered.length === 0 && (
          <li className="rounded-lg border border-slate-800 px-3 py-6 text-center text-xs text-slate-500">
            {bn ? "কোনো অপারেশন পাওয়া যায়নি" : "No operations found"}
          </li>
        )}
      </ul>
    </div>
  );
}

function CatalogForm({
  draft,
  categories,
  specialties,
  lang,
  canEdit = true,
  onSaved,
  onCancel,
}: {
  draft: Draft;
  categories: CareOperationCategory[];
  specialties: CareSpecialty[];
  lang: "bn" | "en";
  canEdit?: boolean;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const bn = lang === "bn";
  const [form, setForm] = useState<Draft>(draft);
  const [busy, setBusy] = useState(false);

  useEffect(() => setForm(draft), [draft]);

  async function save() {
    if (!form.code?.trim() || !form.name_bn?.trim() || !form.name_en?.trim()) {
      toast.error(bn ? "কোড ও দুই ভাষার নাম দিন" : "Code and both names are required");
      return;
    }
    setBusy(true);
    try {
      await upsertOperationCatalogItem({
        ...(form.id ? { id: form.id } : {}),
        code: form.code.trim().toUpperCase(),
        name_bn: form.name_bn.trim(),
        name_en: form.name_en.trim(),
        category_id: form.category_id || null,
        specialty_id: form.specialty_id || null,
        description_bn: form.description_bn?.trim() || null,
        description_en: form.description_en?.trim() || null,
        prep_bn: form.prep_bn?.trim() || null,
        prep_en: form.prep_en?.trim() || null,
        typical_duration_minutes: form.typical_duration_minutes
          ? Number(form.typical_duration_minutes)
          : null,
        typical_stay_days: form.typical_stay_days ? Number(form.typical_stay_days) : null,
        is_active: form.is_active !== false,
        sort_order: Number(form.sort_order ?? 0),
      });
      toast.success(bn ? "সেভ হয়েছে" : "Saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!form.id) return;
    setBusy(true);
    try {
      await deleteOperationCatalogItem(form.id);
      toast.success(bn ? "মুছে ফেলা হয়েছে" : "Deleted");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={bn ? "কোড" : "Code"}>
          <input
            className={ainp}
            value={form.code ?? ""}
            disabled={!canEdit}
            placeholder="OP-APPEN"
            onChange={(e) => setForm({ ...form, code: e.target.value })}
          />
        </Field>
        <Field label={bn ? "ক্যাটাগরি" : "Category"}>
          <select
            className={ainp}
            value={form.category_id ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, category_id: e.target.value || null })}
          >
            <option value="">{bn ? "নির্ধারিত নয়" : "Unset"}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {bn ? c.name_bn : c.name_en}
              </option>
            ))}
          </select>
        </Field>
        <Field label={bn ? "বাংলা নাম" : "Bengali name"}>
          <input
            className={ainp}
            value={form.name_bn ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, name_bn: e.target.value })}
          />
        </Field>
        <Field label={bn ? "ইংরেজি নাম" : "English name"}>
          <input
            className={ainp}
            value={form.name_en ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, name_en: e.target.value })}
          />
        </Field>
        <Field label={bn ? "স্পেশালিটি" : "Specialty"}>
          <select
            className={ainp}
            value={form.specialty_id ?? ""}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, specialty_id: e.target.value || null })}
          >
            <option value="">{bn ? "নির্ধারিত নয়" : "Unset"}</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {bn ? s.name_bn : s.name_en}
              </option>
            ))}
          </select>
        </Field>
        <Field label={bn ? "সাধারণ সময় (মিনিট)" : "Typical duration (min)"}>
          <input
            className={ainp}
            inputMode="numeric"
            value={form.typical_duration_minutes ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              setForm({
                ...form,
                typical_duration_minutes: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null,
              })
            }
          />
        </Field>
        <Field label={bn ? "ভর্তির দিন" : "Typical stay (days)"}>
          <input
            className={ainp}
            inputMode="numeric"
            value={form.typical_stay_days ?? ""}
            disabled={!canEdit}
            onChange={(e) =>
              setForm({
                ...form,
                typical_stay_days: e.target.value ? Number(e.target.value.replace(/\D/g, "")) : null,
              })
            }
          />
        </Field>
        <Field label={bn ? "সাজানোর ক্রম" : "Sort order"}>
          <input
            className={ainp}
            inputMode="numeric"
            value={form.sort_order ?? 0}
            disabled={!canEdit}
            onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value.replace(/\D/g, "")) })}
          />
        </Field>
      </div>

      <Field label={bn ? "প্রস্তুতি (বাংলা)" : "Preparation (Bengali)"}>
        <textarea
          className={ainp}
          rows={2}
          value={form.prep_bn ?? ""}
          disabled={!canEdit}
          onChange={(e) => setForm({ ...form, prep_bn: e.target.value })}
        />
      </Field>
      <Field label={bn ? "প্রস্তুতি (ইংরেজি)" : "Preparation (English)"}>
        <textarea
          className={ainp}
          rows={2}
          value={form.prep_en ?? ""}
          disabled={!canEdit}
          onChange={(e) => setForm({ ...form, prep_en: e.target.value })}
        />
      </Field>

      <label className="flex items-center gap-2 text-[11px] text-slate-300">
        <input
          type="checkbox"
          checked={form.is_active !== false}
          disabled={!canEdit}
          onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
        />
        {bn ? "সক্রিয়" : "Active"}
      </label>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {bn ? "সেভ" : "Save"}
          </button>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] font-semibold text-slate-300"
            >
              {bn ? "বাতিল" : "Cancel"}
            </button>
          )}
          {form.id && (
            <button
              type="button"
              onClick={() => void remove()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 px-3 py-1.5 text-[11px] font-bold text-red-400 disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {bn ? "মুছুন" : "Delete"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}
