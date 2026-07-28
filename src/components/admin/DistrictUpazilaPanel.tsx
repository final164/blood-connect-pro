import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import type { District } from "@/lib/api";
import {
  createUpazila,
  deleteUpazila,
  ensureUpazilasForDistrict,
  fetchUpazilasForDistrict,
  updateUpazila,
  type Upazila,
} from "@/lib/upazilas";
import { Plus, Trash2, Pencil, Save, X } from "lucide-react";
import { toast } from "sonner";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

export function DistrictUpazilaPanel({ district }: { district: District }) {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const [rows, setRows] = useState<Upazila[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name_bn: "", name_en: "", slug: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name_bn: "", name_en: "", slug: "" });

  async function load() {
    setLoading(true);
    try {
      if (can("districts.add")) {
        await ensureUpazilasForDistrict(district);
      }
      setRows(await fetchUpazilasForDistrict(district.id, true));
    } catch (e) {
      toast.error((e as Error).message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [district.id]);

  async function add() {
    if (!can("districts.add")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!form.name_bn.trim() || !form.name_en.trim()) {
      return toast.error(lang === "bn" ? "বাংলা ও ইংরেজি নাম দিন" : "BN and EN names required");
    }
    try {
      await createUpazila({
        district_id: district.id,
        name_bn: form.name_bn,
        name_en: form.name_en,
        slug: form.slug || undefined,
        sort_order: rows.length + 1,
      });
      setForm({ name_bn: "", name_en: "", slug: "" });
      await load();
      toast.success(lang === "bn" ? "উপজেলা যোগ হয়েছে" : "Upazila added");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function saveEdit(id: string) {
    if (!can("districts.edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    try {
      await updateUpazila(id, {
        name_bn: editForm.name_bn.trim(),
        name_en: editForm.name_en.trim(),
        slug: editForm.slug.trim() || undefined,
      });
      setEditingId(null);
      await load();
      toast.success(lang === "bn" ? "সেভ হয়েছে" : "Saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function toggle(u: Upazila) {
    if (!can("districts.toggle")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    try {
      await updateUpazila(u.id, { is_active: !u.is_active });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function remove(id: string) {
    if (!can("districts.delete")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!confirm(lang === "bn" ? "এই উপজেলা ডিলিট করবেন?" : "Delete this upazila?")) return;
    try {
      await deleteUpazila(id);
      await load();
      toast.success(lang === "bn" ? "ডিলিট হয়েছে" : "Deleted");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="bg-slate-950/60 px-4 py-3 border-t border-slate-800">
      <p className="text-[11px] font-semibold text-slate-400 mb-2">
        {lang === "bn" ? "উপজেলা" : "Upazilas"} ({rows.length})
      </p>

      {can("districts.add") && (
        <div className="grid sm:grid-cols-4 gap-2 mb-3">
          <input
            className={ainp}
            placeholder={lang === "bn" ? "নাম (বাংলা)" : "Name (BN)"}
            value={form.name_bn}
            onChange={(e) => setForm({ ...form, name_bn: e.target.value })}
          />
          <input
            className={ainp}
            placeholder={lang === "bn" ? "নাম (ইংরেজি)" : "Name (EN)"}
            value={form.name_en}
            onChange={(e) => setForm({ ...form, name_en: e.target.value })}
          />
          <input
            className={ainp}
            placeholder="slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
          />
          <button
            type="button"
            onClick={add}
            className="rounded-lg bg-rose-600 text-white text-xs font-semibold flex items-center justify-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            {lang === "bn" ? "যোগ" : "Add"}
          </button>
        </div>
      )}

      {loading && (
        <p className="text-xs text-slate-500 py-3 text-center">{lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}</p>
      )}

      {!loading && rows.length === 0 && (
        <p className="text-xs text-slate-500 py-3 text-center">
          {lang === "bn" ? "কোনো উপজেলা নেই — যোগ করুন বা ক্যাটালগ সিড করুন" : "No upazilas — add one or seed from catalog"}
        </p>
      )}

      {!loading && rows.length > 0 && (
        <div className="rounded-lg border border-slate-800 admin-table-scroll">
          <table className="w-full text-[11px]">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="text-left px-2 py-1.5">{lang === "bn" ? "বাংলা" : "BN"}</th>
                <th className="text-left px-2 py-1.5">{lang === "bn" ? "ইংরেজি" : "EN"}</th>
                <th className="text-left px-2 py-1.5">slug</th>
                <th className="text-left px-2 py-1.5">{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map((u) =>
                editingId === u.id ? (
                  <tr key={u.id} className="border-t border-slate-800 bg-slate-900/80">
                    <td className="p-1.5">
                      <input className={ainp} value={editForm.name_bn} onChange={(e) => setEditForm({ ...editForm, name_bn: e.target.value })} />
                    </td>
                    <td className="p-1.5">
                      <input className={ainp} value={editForm.name_en} onChange={(e) => setEditForm({ ...editForm, name_en: e.target.value })} />
                    </td>
                    <td className="p-1.5">
                      <input className={ainp} value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} />
                    </td>
                    <td colSpan={2} className="p-1.5">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => saveEdit(u.id)} className="p-1.5 rounded-md bg-emerald-600/20 text-emerald-300">
                          <Save className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => setEditingId(null)} className="p-1.5 rounded-md bg-slate-800 text-slate-400">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.id} className="border-t border-slate-800">
                    <td className="px-2 py-1.5">{u.name_bn}</td>
                    <td className="px-2 py-1.5">{u.name_en}</td>
                    <td className="px-2 py-1.5 text-slate-400">{u.slug}</td>
                    <td className="px-2 py-1.5">
                      {can("districts.toggle") ? (
                        <button
                          type="button"
                          onClick={() => toggle(u)}
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${u.is_active ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-800 text-slate-400"}`}
                        >
                          {u.is_active ? "ON" : "OFF"}
                        </button>
                      ) : (
                        <span className="text-[10px]">{u.is_active ? "ON" : "OFF"}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      <div className="flex justify-end gap-1">
                        {can("districts.edit") && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingId(u.id);
                              setEditForm({ name_bn: u.name_bn, name_en: u.name_en, slug: u.slug });
                            }}
                            className="p-1 text-slate-400 hover:text-slate-200"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {can("districts.delete") && (
                          <button type="button" onClick={() => remove(u.id)} className="p-1 text-rose-400">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
