import { useEffect, useState } from "react";
import { Download, ChevronDown, FileSpreadsheet, Pencil, Plus, Trash2, Upload, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { District } from "@/lib/api";
import { BLOOD_GROUPS } from "@/lib/format";
import { resolveUpazilaLabel, upazilaDisplayName } from "@/data/bangladesh-clinics";
import { fetchUpazilaOptions } from "@/lib/upazilas";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import {
  bulkImportCommunityDonors,
  fetchCommunityDonorsByOrg,
  normalizeGender,
  parseDonorImportFile,
  updateCommunityDonor,
  type CommunityDonorRow,
  type DonorGender,
  type DonorImportInput,
} from "@/lib/community-donor-import";
import { toast } from "sonner";

const field =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25";

const emptyManualForm = () => ({
  full_name: "",
  phone: "",
  blood_group: "",
  gender: "" as "" | DonorGender,
  district_id: "",
  upazila: "",
  address: "",
});

export function OrgDonorsManager({
  orgId,
  districts,
  lang,
  canEdit,
  canDelete,
  canImport,
}: {
  orgId: string;
  districts: District[];
  lang: "bn" | "en";
  canEdit: boolean;
  canDelete: boolean;
  canImport: boolean;
}) {
  const [donors, setDonors] = useState<CommunityDonorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    blood_group: "",
    gender: "" as "" | DonorGender,
    district_id: "",
    upazila: "",
    address: "",
    is_active: true,
  });
  const [busy, setBusy] = useState(false);
  const [importDistrict, setImportDistrict] = useState<District | null>(null);
  const [importUpazila, setImportUpazila] = useState("");
  const [importGender, setImportGender] = useState<"" | DonorGender>("");
  const [importPreview, setImportPreview] = useState<DonorImportInput[]>([]);
  const [importBusy, setImportBusy] = useState(false);
  const [upazilaOptions, setUpazilaOptions] = useState<{ en: string; bn: string }[]>([]);
  const [manualForm, setManualForm] = useState(emptyManualForm);
  const [manualDistrict, setManualDistrict] = useState<District | null>(null);
  const [manualBusy, setManualBusy] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setDonors(await fetchCommunityDonorsByOrg(orgId));
    } catch (e) {
      toast.error((e as Error).message);
      setDonors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [orgId]);

  const editDistrict = districts.find((d) => d.id === editForm.district_id);

  useEffect(() => {
    if (!editDistrict) {
      setUpazilaOptions([]);
      return;
    }
    let cancelled = false;
    fetchUpazilaOptions(editDistrict)
      .then((list) => {
        if (!cancelled) setUpazilaOptions(list);
      })
      .catch(() => {
        if (!cancelled) setUpazilaOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [editDistrict?.id, editDistrict?.slug]);

  function startEdit(d: CommunityDonorRow) {
    setEditingId(d.id);
    setEditForm({
      full_name: d.full_name,
      phone: d.phone,
      blood_group: d.blood_group ?? "",
      gender: (d.gender === "male" || d.gender === "female" ? d.gender : "") as "" | DonorGender,
      district_id: d.district_id ?? "",
      upazila: d.upazila ?? "",
      address: d.address ?? "",
      is_active: d.is_active,
    });
  }

  async function saveEdit() {
    if (!canEdit) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!editingId || !editForm.full_name.trim() || !editForm.phone.trim()) {
      return toast.error(lang === "bn" ? "নাম ও ফোন বাধ্যতামূলক" : "Name and phone required");
    }
    setBusy(true);
    try {
      await updateCommunityDonor(
        editingId,
        {
          full_name: editForm.full_name,
          phone: editForm.phone,
          blood_group: editForm.blood_group || null,
          gender: editForm.gender || null,
          district_id: editForm.district_id || null,
          upazila: editForm.upazila || null,
          address: editForm.address || null,
          is_active: editForm.is_active,
        },
        districts,
      );
      toast.success(lang === "bn" ? "সেভ হয়েছে" : "Saved");
      setEditingId(null);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeDonor(id: string) {
    if (!canDelete) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!confirm(lang === "bn" ? "এই রক্তদাতা ডিলিট করবেন?" : "Delete this donor?")) return;
    const { error } = await supabase.from("community_donors").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success(lang === "bn" ? "ডিলিট হয়েছে" : "Deleted");
      await load();
    }
  }

  async function onFilePick(file: File | null) {
    if (!file) return;
    try {
      const parsed = await parseDonorImportFile(file);
      setImportPreview(parsed);
      toast.success(
        lang === "bn" ? `${parsed.length}টি রো পড়া হয়েছে` : `${parsed.length} row(s) parsed`,
      );
    } catch (e) {
      toast.error((e as Error).message);
      setImportPreview([]);
    }
  }

  async function runImport() {
    if (!canImport) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!importDistrict) {
      return toast.error(lang === "bn" ? "জেলা সিলেক্ট করুন" : "Select a district");
    }
    if (!importPreview.length) {
      return toast.error(lang === "bn" ? "ফাইল আপলোড করুন" : "Upload a file first");
    }
    const missingGender = importPreview.some((r) => !r.gender?.trim()) && !importGender;
    if (missingGender) {
      return toast.error(
        lang === "bn"
          ? "লিঙ্গ সিলেক্ট করুন অথবা ফাইলে gender দিন"
          : "Select gender or include gender in the file",
      );
    }
    setImportBusy(true);
    const result = await bulkImportCommunityDonors(
      orgId,
      importPreview,
      {
        districtId: importDistrict.id,
        upazila: importUpazila || null,
        gender: importGender || null,
      },
      districts,
    );
    setImportBusy(false);
    if (result.errors.length) toast.error(result.errors[0]!);
    toast.success(
      lang === "bn"
        ? `${result.inserted} জন রক্তদাতা যোগ হয়েছে`
        : `${result.inserted} donor(s) imported`,
    );
    setImportPreview([]);
    await load();
  }

  async function addManualDonor() {
    if (!canEdit) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!manualForm.full_name.trim() || !manualForm.phone.trim()) {
      return toast.error(lang === "bn" ? "নাম ও ফোন বাধ্যতামূলক" : "Name and phone are required");
    }
    const digits = manualForm.phone.replace(/\D/g, "");
    if (digits.length < 10) {
      return toast.error(lang === "bn" ? "সঠিক ফোন নম্বর দিন" : "Enter a valid phone number");
    }
    const gender = normalizeGender(manualForm.gender);
    if (!gender) {
      return toast.error(lang === "bn" ? "লিঙ্গ সিলেক্ট করুন" : "Select gender");
    }
    if (!manualDistrict) {
      return toast.error(lang === "bn" ? "জেলা সিলেক্ট করুন" : "Select a district");
    }
    setManualBusy(true);
    const upazila = resolveUpazilaLabel(manualForm.upazila, manualDistrict.slug ?? null);
    const { error } = await supabase.from("community_donors").insert({
      org_id: orgId,
      full_name: manualForm.full_name.trim(),
      phone: manualForm.phone.trim(),
      blood_group: manualForm.blood_group || null,
      gender,
      district_id: manualDistrict.id,
      upazila,
      address: manualForm.address.trim() || null,
      is_active: true,
    });
    setManualBusy(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "রক্তদাতা যোগ হয়েছে" : "Donor added");
    setManualForm(emptyManualForm());
    setManualDistrict(null);
    await load();
  }

  return (
    <div className="space-y-4">
      {canImport && (
        <div className="rounded-xl border bg-card p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Upload className="h-4 w-4 text-primary" />
            {lang === "bn" ? "বাল্ক ইমপোর্ট" : "Bulk import"}
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <a href="/samples/community-donors-sample.csv" download className="text-primary hover:underline flex items-center gap-1">
              <Download className="h-3 w-3" /> CSV
            </a>
            <a href="/samples/community-donors-sample.xlsx" download className="text-primary hover:underline flex items-center gap-1">
              <FileSpreadsheet className="h-3 w-3" /> Excel
            </a>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            <DistrictTypeahead
              value={importDistrict}
              onChange={(d) => {
                setImportDistrict(d);
                setImportUpazila("");
              }}
              placeholder={lang === "bn" ? "জেলা *" : "District *"}
            />
            <UpazilaSelect district={importDistrict} value={importUpazila} onChange={setImportUpazila} />
            <select
              className={field}
              value={importGender}
              onChange={(e) => setImportGender(e.target.value as "" | DonorGender)}
            >
              <option value="">{lang === "bn" ? "লিঙ্গ" : "Gender"}</option>
              <option value="male">{lang === "bn" ? "পুরুষ" : "Male"}</option>
              <option value="female">{lang === "bn" ? "মহিলা" : "Female"}</option>
            </select>
          </div>
          <input
            type="file"
            accept=".csv,.xlsx,.xls,.json"
            onChange={(e) => void onFilePick(e.target.files?.[0] ?? null)}
            className="text-xs"
          />
          {importPreview.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {lang === "bn" ? `${importPreview.length}টি রো প্রস্তুত` : `${importPreview.length} rows ready`}
            </p>
          )}
          <button
            type="button"
            disabled={importBusy || !importPreview.length}
            onClick={() => void runImport()}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {importBusy ? "…" : lang === "bn" ? "ইমপোর্ট" : "Import"}
          </button>
        </div>
      )}

      {canEdit && (
        <div className="rounded-xl border bg-card overflow-hidden">
          <button
            type="button"
            onClick={() => setManualOpen((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-muted/50 transition"
            aria-expanded={manualOpen}
          >
            <UserPlus className="h-4 w-4 text-primary shrink-0" />
            <span className="flex-1 text-sm font-semibold">
              {lang === "bn" ? "ম্যানুয়ালি যোগ করুন" : "Add donor manually"}
            </span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${manualOpen ? "rotate-180" : ""}`}
            />
          </button>
          {manualOpen && (
            <div className="border-t px-4 py-3 space-y-3">
              <div className="grid sm:grid-cols-2 gap-2">
                <input
                  className={field}
                  placeholder={lang === "bn" ? "নাম *" : "Name *"}
                  value={manualForm.full_name}
                  onChange={(e) => setManualForm({ ...manualForm, full_name: e.target.value })}
                />
                <input
                  className={field}
                  placeholder={lang === "bn" ? "ফোন *" : "Phone *"}
                  value={manualForm.phone}
                  onChange={(e) => setManualForm({ ...manualForm, phone: e.target.value })}
                  inputMode="tel"
                />
                <select
                  className={field}
                  value={manualForm.blood_group}
                  onChange={(e) => setManualForm({ ...manualForm, blood_group: e.target.value })}
                >
                  <option value="">{lang === "bn" ? "রক্তের গ্রুপ" : "Blood group"}</option>
                  {BLOOD_GROUPS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <select
                  className={field}
                  value={manualForm.gender}
                  onChange={(e) => setManualForm({ ...manualForm, gender: e.target.value as "" | DonorGender })}
                >
                  <option value="">{lang === "bn" ? "লিঙ্গ *" : "Gender *"}</option>
                  <option value="male">{lang === "bn" ? "পুরুষ" : "Male"}</option>
                  <option value="female">{lang === "bn" ? "মহিলা" : "Female"}</option>
                </select>
                <DistrictTypeahead
                  value={manualDistrict}
                  onChange={(d) => {
                    setManualDistrict(d);
                    setManualForm((prev) => ({ ...prev, district_id: d?.id ?? "", upazila: "" }));
                  }}
                  placeholder={lang === "bn" ? "জেলা *" : "District *"}
                />
                <UpazilaSelect
                  district={manualDistrict}
                  value={manualForm.upazila}
                  onChange={(v) => setManualForm({ ...manualForm, upazila: v })}
                />
                <input
                  className={`${field} sm:col-span-2`}
                  placeholder={lang === "bn" ? "ঠিকানা (ঐচ্ছিক)" : "Address (optional)"}
                  value={manualForm.address}
                  onChange={(e) => setManualForm({ ...manualForm, address: e.target.value })}
                />
              </div>
              <button
                type="button"
                disabled={manualBusy}
                onClick={() => void addManualDonor()}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {manualBusy ? "…" : lang === "bn" ? "যোগ করুন" : "Add donor"}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="px-3 py-2 border-b flex justify-between text-xs font-semibold">
          <span>{lang === "bn" ? "রক্তদাতা" : "Donors"}</span>
          <span className="text-muted-foreground">{donors.length}</span>
        </div>
        {loading && (
          <p className="text-xs text-muted-foreground py-8 text-center">
            {lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}
          </p>
        )}
        {!loading && donors.length === 0 && (
          <p className="text-xs text-muted-foreground py-8 text-center">
            {lang === "bn" ? "কোনো রক্তদাতা নেই" : "No donors yet"}
          </p>
        )}
        {!loading && donors.length > 0 && (
          <ul className="divide-y max-h-[60vh] overflow-y-auto">
            {donors.map((d) =>
              editingId === d.id ? (
                <li key={d.id} className="p-3 space-y-2 bg-muted/30">
                  <div className="grid sm:grid-cols-2 gap-2">
                    <input className={field} value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} placeholder="Name" />
                    <input className={field} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Phone" />
                    <select className={field} value={editForm.blood_group} onChange={(e) => setEditForm({ ...editForm, blood_group: e.target.value })}>
                      <option value="">BG</option>
                      {BLOOD_GROUPS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    <select className={field} value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as "" | DonorGender })}>
                      <option value="">Gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                    </select>
                    <select className={field} value={editForm.district_id} onChange={(e) => setEditForm({ ...editForm, district_id: e.target.value, upazila: "" })}>
                      <option value="">District</option>
                      {districts.map((dist) => (
                        <option key={dist.id} value={dist.id}>{lang === "bn" ? dist.name_bn : dist.name_en}</option>
                      ))}
                    </select>
                    <select className={field} value={editForm.upazila} disabled={!editForm.district_id} onChange={(e) => setEditForm({ ...editForm, upazila: e.target.value })}>
                      <option value="">Upazila</option>
                      {upazilaOptions.map((u) => (
                        <option key={u.en} value={u.en}>{lang === "bn" ? u.bn : u.en}</option>
                      ))}
                    </select>
                    <input className={field} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Address" />
                  </div>
                  <div className="flex gap-2">
                    <button type="button" disabled={busy} onClick={() => void saveEdit()} className="rounded-lg bg-primary text-primary-foreground text-xs px-3 py-1.5">
                      {lang === "bn" ? "সেভ" : "Save"}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border text-xs px-3 py-1.5">
                      {lang === "bn" ? "বাতিল" : "Cancel"}
                    </button>
                  </div>
                </li>
              ) : (
                <li key={d.id} className="px-3 py-2.5 flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.full_name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {d.phone} · {d.blood_group || "—"} ·{" "}
                      {d.gender === "male" ? (lang === "bn" ? "পুরুষ" : "Male") : d.gender === "female" ? (lang === "bn" ? "মহিলা" : "Female") : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {[upazilaDisplayName(d.upazila, d.districts?.slug ?? null, lang), lang === "bn" ? d.districts?.name_bn : d.districts?.name_en]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {canEdit && (
                      <button type="button" onClick={() => startEdit(d)} className="h-8 w-8 rounded-lg hover:bg-muted grid place-items-center text-muted-foreground">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" onClick={() => void removeDonor(d.id)} className="h-8 w-8 rounded-lg hover:bg-destructive/10 grid place-items-center text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ),
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
