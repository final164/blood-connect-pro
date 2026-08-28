import { useEffect, useMemo, useState } from "react";
import { Merge, Save, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import {
  fetchDoctorClinics,
  fetchDoctorDuplicates,
  fetchDoctorsForAdmin,
  mergeCareDoctors,
  updateCareDoctor,
  type CareDoctorAdminRow,
  type CareDoctorClinicRow,
  type CareDoctorDuplicateGroup,
} from "@/lib/care-doctors-api";
import { fetchCareSpecialties, type CareSpecialty } from "@/lib/care-cms";
import { formatCareMoney } from "@/lib/care-invoice";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

/**
 * Global doctor registry. Doctors created from a desk with a custom name land
 * here, so this is where their BMDC number and qualifications get filled in,
 * and where duplicates created before care_find_or_create_doctor get merged.
 */
export function CareDoctorsAdmin({ canEdit, lang }: { canEdit: boolean; lang: "bn" | "en" }) {
  const bn = lang === "bn";
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<CareDoctorAdminRow[]>([]);
  const [specialties, setSpecialties] = useState<CareSpecialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dupes, setDupes] = useState<CareDoctorDuplicateGroup[]>([]);
  const [showDupes, setShowDupes] = useState(false);

  async function reload() {
    setLoading(true);
    try {
      const [list, specs] = await Promise.all([fetchDoctorsForAdmin(q, 60), fetchCareSpecialties()]);
      setRows(list);
      setSpecialties(specs);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const handle = setTimeout(() => void reload(), 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  async function loadDupes() {
    try {
      const list = await fetchDoctorDuplicates(50);
      setDupes(list);
      setShowDupes(true);
      if (!list.length) toast.success(bn ? "কোনো ডুপ্লিকেট নেই" : "No duplicates found");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={bn ? "নাম বা BMDC দিয়ে খুঁজুন…" : "Search by name or BMDC…"}
          className={`${ainp} max-w-xs`}
        />
        <button
          type="button"
          onClick={() => void loadDupes()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"
        >
          <Merge className="h-3.5 w-3.5" />
          {bn ? "ডুপ্লিকেট খুঁজুন" : "Find duplicates"}
        </button>
        <span className="text-[11px] text-slate-500">
          {loading
            ? bn
              ? "লোড হচ্ছে…"
              : "Loading…"
            : bn
              ? `${rows.length} জন ডাক্তার`
              : `${rows.length} doctors`}
        </span>
      </div>

      {showDupes && dupes.length > 0 && (
        <DuplicatePanel
          groups={dupes}
          rows={rows}
          lang={lang}
          canEdit={canEdit}
          onMerged={() => {
            void reload();
            void loadDupes();
          }}
        />
      )}

      <ul className="space-y-2">
        {rows.map((d) => (
          <DoctorRow
            key={d.id}
            doctor={d}
            specialties={specialties}
            lang={lang}
            canEdit={canEdit}
            expanded={openId === d.id}
            onToggle={() => setOpenId(openId === d.id ? null : d.id)}
            onSaved={() => void reload()}
          />
        ))}
        {!loading && rows.length === 0 && (
          <li className="rounded-lg border border-slate-800 px-3 py-6 text-center text-xs text-slate-500">
            {bn ? "কোনো ডাক্তার পাওয়া যায়নি" : "No doctors found"}
          </li>
        )}
      </ul>
    </div>
  );
}

function DoctorRow({
  doctor,
  specialties,
  lang,
  canEdit,
  expanded,
  onToggle,
  onSaved,
}: {
  doctor: CareDoctorAdminRow;
  specialties: CareSpecialty[];
  lang: "bn" | "en";
  canEdit: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const bn = lang === "bn";
  const [form, setForm] = useState(doctor);
  const [clinics, setClinics] = useState<CareDoctorClinicRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setForm(doctor), [doctor]);

  useEffect(() => {
    if (!expanded || clinics) return;
    void fetchDoctorClinics(doctor.id)
      .then(setClinics)
      .catch(() => setClinics([]));
  }, [expanded, clinics, doctor.id]);

  async function save() {
    setBusy(true);
    try {
      await updateCareDoctor(doctor.id, {
        full_name: form.full_name.trim(),
        full_name_bn: form.full_name_bn?.trim() || null,
        bmdc_no: form.bmdc_no?.trim() || null,
        qualifications: form.qualifications?.trim() || null,
        photo_url: form.photo_url?.trim() || null,
        bio: form.bio?.trim() || null,
        specialty_id: form.specialty_id || null,
        is_active: form.is_active,
      });
      toast.success(bn ? "সেভ হয়েছে" : "Saved");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-slate-800 bg-slate-900/40">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <Stethoscope className="h-4 w-4 shrink-0 text-rose-400" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-slate-100">
            {doctor.full_name}
          </span>
          <span className="block truncate text-[10px] text-slate-500">
            {[doctor.bmdc_no ? `BMDC ${doctor.bmdc_no}` : null, doctor.qualifications]
              .filter(Boolean)
              .join(" · ") || (bn ? "তথ্য অসম্পূর্ণ" : "Details missing")}
          </span>
        </span>
        {!doctor.is_active && (
          <span className="shrink-0 rounded-full border border-slate-700 px-2 py-0.5 text-[9px] text-slate-400">
            {bn ? "নিষ্ক্রিয়" : "inactive"}
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-800 px-3 py-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={bn ? "নাম" : "Name"}>
              <input
                className={ainp}
                value={form.full_name}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              />
            </Field>
            <Field label={bn ? "বাংলা নাম" : "Bengali name"}>
              <input
                className={ainp}
                value={form.full_name_bn ?? ""}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, full_name_bn: e.target.value })}
              />
            </Field>
            <Field label="BMDC">
              <input
                className={ainp}
                value={form.bmdc_no ?? ""}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, bmdc_no: e.target.value })}
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
            <Field label={bn ? "যোগ্যতা" : "Qualifications"}>
              <input
                className={ainp}
                value={form.qualifications ?? ""}
                disabled={!canEdit}
                placeholder="MBBS, FCPS (Surgery)"
                onChange={(e) => setForm({ ...form, qualifications: e.target.value })}
              />
            </Field>
            <Field label={bn ? "ছবির লিংক" : "Photo URL"}>
              <input
                className={ainp}
                value={form.photo_url ?? ""}
                disabled={!canEdit}
                onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
              />
            </Field>
          </div>

          <Field label={bn ? "পরিচিতি" : "Bio"}>
            <textarea
              className={ainp}
              rows={2}
              value={form.bio ?? ""}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, bio: e.target.value })}
            />
          </Field>

          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              checked={form.is_active}
              disabled={!canEdit}
              onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
            />
            {bn ? "সক্রিয়" : "Active"}
          </label>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {bn ? "কোন কোন প্রতিষ্ঠানে" : "Clinics"}
            </p>
            {clinics === null ? (
              <p className="text-[11px] text-slate-500">{bn ? "লোড হচ্ছে…" : "Loading…"}</p>
            ) : clinics.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                {bn ? "কোনো প্রতিষ্ঠানে যুক্ত নয়" : "Not affiliated anywhere"}
              </p>
            ) : (
              <ul className="mt-1 space-y-1">
                {clinics.map((c) => (
                  <li
                    key={`${c.org_id}-${c.location_id}`}
                    className="flex items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1 text-[11px] text-slate-300"
                  >
                    <span className="truncate">
                      {c.org_name}
                      {c.location_name ? ` · ${c.location_name}` : ""}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-400">
                      {c.fee_amount != null ? formatCareMoney(c.fee_amount, lang) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canEdit && (
            <button
              type="button"
              onClick={() => void save()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {bn ? "সেভ" : "Save"}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function DuplicatePanel({
  groups,
  rows,
  lang,
  canEdit,
  onMerged,
}: {
  groups: CareDoctorDuplicateGroup[];
  rows: CareDoctorAdminRow[];
  lang: "bn" | "en";
  canEdit: boolean;
  onMerged: () => void;
}) {
  const bn = lang === "bn";
  const [pending, setPending] = useState<{ keep: string; drop: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const nameById = useMemo(() => new Map(rows.map((r) => [r.id, r.full_name])), [rows]);

  async function confirmMerge() {
    if (!pending) return;
    setBusy(true);
    try {
      await mergeCareDoctors(pending.keep, pending.drop);
      toast.success(bn ? "মার্জ সম্পন্ন" : "Merged");
      setPending(null);
      onMerged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
      <p className="text-[11px] font-bold text-amber-300">
        {bn
          ? `${groups.length} সেট সম্ভাব্য ডুপ্লিকেট — প্রথমটিকে রেখে বাকিগুলো মার্জ করুন`
          : `${groups.length} possible duplicate sets — keep the first and merge the rest`}
      </p>
      <ul className="space-y-2">
        {groups.map((g) => {
          const [keepId, ...others] = g.doctor_ids;
          if (!keepId) return null;
          return (
            <li key={g.match_key} className="rounded border border-slate-800 bg-slate-900/60 p-2">
              <p className="text-[11px] font-semibold text-slate-200">
                {g.full_names[0] ?? g.match_key}{" "}
                <span className="text-slate-500">({g.n})</span>
              </p>
              <ul className="mt-1 space-y-1">
                {others.map((dropId, i) => (
                  <li key={dropId} className="flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] text-slate-400">
                      {g.full_names[i + 1] ?? dropId.slice(0, 8)}
                    </span>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() =>
                          setPending({
                            keep: keepId,
                            drop: dropId,
                            label: `${nameById.get(dropId) ?? g.full_names[i + 1] ?? dropId} → ${
                              nameById.get(keepId) ?? g.full_names[0] ?? keepId
                            }`,
                          })
                        }
                        className="shrink-0 rounded border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300 hover:bg-amber-500 hover:text-slate-900"
                      >
                        {bn ? "মার্জ" : "Merge"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{bn ? "ডাক্তার মার্জ করবেন?" : "Merge doctors?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.label}
              <br />
              {bn
                ? "সব অ্যাফিলিয়েশন, শিডিউল ও বুকিং রাখা রেকর্ডে সরে যাবে এবং ডুপ্লিকেট রেকর্ডটি মুছে যাবে। এটি ফেরানো যাবে না।"
                : "All affiliations, schedules and bookings move to the kept record and the duplicate is deleted. This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{bn ? "বাতিল" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmMerge()}>
              {bn ? "মার্জ করুন" : "Merge"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
