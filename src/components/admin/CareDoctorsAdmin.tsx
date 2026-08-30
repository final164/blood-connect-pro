import { useEffect, useMemo, useState } from "react";
import { Check, Merge, Plus, Save, Stethoscope, Video, X } from "lucide-react";
import { toast } from "sonner";
import {
  createCareDoctorAdmin,
  fetchDoctorClinics,
  fetchDoctorDuplicates,
  fetchDoctorsForAdmin,
  fetchPendingVideoClaims,
  mergeCareDoctors,
  respondVideoClaim,
  setDoctorRegistrationStatus,
  updateCareDoctor,
  type CareDoctorAdminRow,
  type CareDoctorClinicRow,
  type CareDoctorDuplicateGroup,
  type CareDoctorVideoClaim,
} from "@/lib/care-doctors-api";
import {
  fetchCareDoctorOnboarding,
  fetchCareSpecialties,
  saveCareDoctorOnboarding,
  type CareDoctorOnboardingSettings,
  type CareSpecialty,
} from "@/lib/care-cms";
import { formatCareMoney } from "@/lib/care-invoice";
import { DoctorTypeSelect } from "@/components/care/DoctorTypeSelect";
import { DoctorIdDocumentFields } from "@/components/care/DoctorIdDocumentFields";
import type { CareIdDocumentKind } from "@/lib/care-doctor-id-document";
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

type StatusFilter = "all" | "pending" | "active" | "suspended";

export function CareDoctorsAdmin({ canEdit, lang }: { canEdit: boolean; lang: "bn" | "en" }) {
  const bn = lang === "bn";
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rows, setRows] = useState<CareDoctorAdminRow[]>([]);
  const [specialties, setSpecialties] = useState<CareSpecialty[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [dupes, setDupes] = useState<CareDoctorDuplicateGroup[]>([]);
  const [showDupes, setShowDupes] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [claims, setClaims] = useState<CareDoctorVideoClaim[]>([]);
  const [onboarding, setOnboarding] = useState<CareDoctorOnboardingSettings | null>(null);

  async function reload() {
    setLoading(true);
    try {
      const [list, specs, videoClaims, ob] = await Promise.all([
        fetchDoctorsForAdmin(q, 80, statusFilter),
        fetchCareSpecialties(),
        fetchPendingVideoClaims(),
        fetchCareDoctorOnboarding(),
      ]);
      setRows(list);
      setSpecialties(specs);
      setClaims(videoClaims);
      setOnboarding(ob);
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
  }, [q, statusFilter]);

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

  async function saveAutoFlags(patch: Partial<CareDoctorOnboardingSettings>) {
    if (!onboarding || !canEdit) return;
    const next = { ...onboarding, ...patch };
    setOnboarding(next);
    try {
      await saveCareDoctorOnboarding(next);
      toast.success(bn ? "সেভ" : "Saved");
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const pendingCount = rows.filter((r) => r.registration_status === "pending").length;

  return (
    <div className="space-y-3">
      {onboarding && (
        <div className="flex flex-wrap gap-3 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={onboarding.auto_approve_registration}
              onChange={(e) => void saveAutoFlags({ auto_approve_registration: e.target.checked })}
            />
            {bn ? "রেজিস্ট্রেশন অটো-অ্যাপ্রুভ" : "Auto-approve registration"}
          </label>
          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input
              type="checkbox"
              disabled={!canEdit}
              checked={onboarding.auto_approve_video_claim}
              onChange={(e) => void saveAutoFlags({ auto_approve_video_claim: e.target.checked })}
            />
            {bn ? "ভিডিও জয়েন অটো-অ্যাপ্রুভ" : "Auto-approve video join"}
          </label>
        </div>
      )}

      {claims.length > 0 && (
        <VideoClaimsPanel
          claims={claims}
          lang={lang}
          canEdit={canEdit}
          onChanged={() => void reload()}
        />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={bn ? "নাম, কোড, ফোন বা BMDC…" : "Name, code, phone or BMDC…"}
          className={`${ainp} max-w-xs`}
        />
        {(["all", "pending", "active", "suspended"] as StatusFilter[]).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border ${
              statusFilter === s
                ? "border-rose-500 bg-rose-600/20 text-rose-200"
                : "border-slate-700 text-slate-400"
            }`}
          >
            {s}
            {s === "pending" && pendingCount ? ` (${pendingCount})` : ""}
          </button>
        ))}
        {canEdit && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            {bn ? "ডাক্তার যোগ" : "Add doctor"}
          </button>
        )}
        <button
          type="button"
          onClick={() => void loadDupes()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white"
        >
          <Merge className="h-3.5 w-3.5" />
          {bn ? "ডুপ্লিকেট" : "Duplicates"}
        </button>
        <span className="text-[11px] text-slate-500">
          {loading ? (bn ? "লোড…" : "Loading…") : bn ? `${rows.length} জন` : `${rows.length}`}
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

      {showAdd && (
        <AddDoctorForm
          specialties={specialties}
          lang={lang}
          onCancel={() => setShowAdd(false)}
          onCreated={() => {
            setShowAdd(false);
            void reload();
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

function VideoClaimsPanel({
  claims,
  lang,
  canEdit,
  onChanged,
}: {
  claims: CareDoctorVideoClaim[];
  lang: "bn" | "en";
  canEdit: boolean;
  onChanged: () => void;
}) {
  const bn = lang === "bn";
  const [busyId, setBusyId] = useState<string | null>(null);

  async function respond(id: string, approve: boolean) {
    setBusyId(id);
    try {
      await respondVideoClaim(id, approve);
      toast.success(approve ? (bn ? "অনুমোদিত" : "Approved") : bn ? "প্রত্যাখ্যান" : "Rejected");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-lg border border-sky-700/40 bg-sky-950/30 p-3 space-y-2">
      <p className="text-[11px] font-bold text-sky-300 inline-flex items-center gap-1.5">
        <Video className="h-3.5 w-3.5" />
        {bn ? `ভিডিও জয়েন অনুরোধ (${claims.length})` : `Video join requests (${claims.length})`}
      </p>
      <ul className="space-y-1.5">
        {claims.map((c) => (
          <li
            key={c.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-800 px-2 py-1.5 text-[11px]"
          >
            <span className="text-slate-200">
              {c.doctor_name || c.doctor_id.slice(0, 8)}
              {c.doctor_code ? ` · ${c.doctor_code}` : ""}
              <span className="text-slate-500"> · user {c.user_id.slice(0, 8)}</span>
            </span>
            {canEdit && (
              <span className="flex gap-1">
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => void respond(c.id, true)}
                  className="rounded bg-emerald-600 px-2 py-0.5 font-bold text-white"
                >
                  <Check className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => void respond(c.id, false)}
                  className="rounded border border-slate-600 px-2 py-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AddDoctorForm({
  specialties,
  lang,
  onCancel,
  onCreated,
}: {
  specialties: CareSpecialty[];
  lang: "bn" | "en";
  onCancel: () => void;
  onCreated: () => void;
}) {
  const bn = lang === "bn";
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [fullNameBn, setFullNameBn] = useState("");
  const [title, setTitle] = useState("Dr.");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [idKind, setIdKind] = useState<CareIdDocumentKind | "">("nid");
  const [nid, setNid] = useState("");
  const [bmdc, setBmdc] = useState("");
  const [doctorType, setDoctorType] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [specId, setSpecId] = useState("");
  const [qual, setQual] = useState("");
  const [photo, setPhoto] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState("active");

  async function submit() {
    if (!fullName.trim() && !firstName.trim()) {
      toast.error(bn ? "নাম দিন" : "Name required");
      return;
    }
    setBusy(true);
    try {
      await createCareDoctorAdmin({
        full_name: fullName.trim() || `${title} ${firstName} ${lastName}`.trim(),
        full_name_bn: fullNameBn || null,
        title,
        first_name: firstName || null,
        last_name: lastName || null,
        date_of_birth: dob || null,
        gender: gender || null,
        district_id: null,
        nid_passport: nid || null,
        id_document_kind: idKind || null,
        bmdc_no: bmdc || null,
        doctor_type: doctorType || null,
        phone: phone || null,
        email: email || null,
        specialty_id: specId || null,
        qualifications: qual || null,
        photo_url: photo || null,
        bio: bio || null,
        registration_status: status,
      });
      toast.success(bn ? "ডাক্তার যোগ হয়েছে" : "Doctor added");
      onCreated();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-rose-700/40 bg-slate-900/60 p-3 space-y-2">
      <p className="text-[11px] font-bold text-rose-300">{bn ? "নতুন ডাক্তার" : "New doctor"}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label={bn ? "পূর্ণ নাম" : "Full name"}>
          <input className={ainp} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label={bn ? "বাংলা নাম" : "BN name"}>
          <input className={ainp} value={fullNameBn} onChange={(e) => setFullNameBn(e.target.value)} />
        </Field>
        <Field label="Title">
          <input className={ainp} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="First / Last">
          <div className="flex gap-1">
            <input className={ainp} placeholder="First" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            <input className={ainp} placeholder="Last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </Field>
        <Field label="DOB">
          <input type="date" className={ainp} value={dob} onChange={(e) => setDob(e.target.value)} />
        </Field>
        <Field label="Gender">
          <select className={ainp} value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">—</option>
            <option value="male">male</option>
            <option value="female">female</option>
            <option value="other">other</option>
          </select>
        </Field>
        <Field label="NID / Passport">
          <div className="sm:col-span-2">
            <DoctorIdDocumentFields
              kind={idKind}
              number={nid}
              onKindChange={setIdKind}
              onNumberChange={setNid}
              lang={lang}
              selectClassName={ainp}
              inputClassName={ainp}
            />
          </div>
        </Field>
        <Field label="BMDC">
          <input className={ainp} value={bmdc} onChange={(e) => setBmdc(e.target.value)} />
        </Field>
        <Field label={bn ? "ডাক্তারের ধরন" : "Doctor type"}>
          <DoctorTypeSelect
            className={ainp}
            value={doctorType}
            onChange={setDoctorType}
            lang={lang}
          />
        </Field>
        <Field label="Phone">
          <input className={ainp} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Email">
          <input className={ainp} value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Specialty">
          <select className={ainp} value={specId} onChange={(e) => setSpecId(e.target.value)}>
            <option value="">—</option>
            {specialties.map((s) => (
              <option key={s.id} value={s.id}>
                {bn ? s.name_bn : s.name_en}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Status">
          <select className={ainp} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">active</option>
            <option value="pending">pending</option>
            <option value="suspended">suspended</option>
          </select>
        </Field>
        <Field label="Qualifications">
          <input className={ainp} value={qual} onChange={(e) => setQual(e.target.value)} />
        </Field>
        <Field label="Photo URL">
          <input className={ainp} value={photo} onChange={(e) => setPhoto(e.target.value)} />
        </Field>
      </div>
      <Field label="Bio">
        <textarea className={ainp} rows={2} value={bio} onChange={(e) => setBio(e.target.value)} />
      </Field>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void submit()}
          className="rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white"
        >
          {bn ? "সেভ" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px]">
          {bn ? "বাতিল" : "Cancel"}
        </button>
      </div>
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
        bio_bn: form.bio_bn?.trim() || null,
        specialty_id: form.specialty_id || null,
        doctor_code: form.doctor_code?.trim() || null,
        registration_status: form.registration_status || "active",
        phone: form.phone?.trim() || null,
        email: form.email?.trim() || null,
        title: form.title?.trim() || null,
        first_name: form.first_name?.trim() || null,
        last_name: form.last_name?.trim() || null,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender?.trim() || null,
        district_id: form.district_id ?? null,
        nid_passport: form.nid_passport?.trim() || null,
        id_document_kind: form.id_document_kind?.trim() || null,
        doctor_type: form.doctor_type?.trim() || null,
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

  async function quickStatus(status: string) {
    setBusy(true);
    try {
      await setDoctorRegistrationStatus(doctor.id, status);
      toast.success(bn ? "স্ট্যাটাস আপডেট" : "Status updated");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-slate-800 bg-slate-900/40">
      <button type="button" onClick={onToggle} className="flex w-full items-center gap-2 px-3 py-2.5 text-left">
        <Stethoscope className="h-4 w-4 shrink-0 text-rose-400" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-slate-100">{doctor.full_name}</span>
          <span className="block truncate text-[10px] text-slate-500">
            {[doctor.doctor_code, doctor.bmdc_no ? `BMDC ${doctor.bmdc_no}` : null, doctor.phone]
              .filter(Boolean)
              .join(" · ") || (bn ? "তথ্য অসম্পূর্ণ" : "Details missing")}
          </span>
        </span>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] ${
            doctor.registration_status === "pending"
              ? "border-amber-600 text-amber-300"
              : doctor.registration_status === "suspended"
                ? "border-rose-700 text-rose-300"
                : "border-emerald-700 text-emerald-300"
          }`}
        >
          {doctor.registration_status || "active"}
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-800 px-3 py-3">
          {canEdit && doctor.registration_status === "pending" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void quickStatus("active")}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-bold text-white"
            >
              {bn ? "অনুমোদন করুন" : "Approve registration"}
            </button>
          )}
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={bn ? "নাম" : "Name"}>
              <input className={ainp} value={form.full_name} disabled={!canEdit} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </Field>
            <Field label={bn ? "বাংলা নাম" : "Bengali name"}>
              <input className={ainp} value={form.full_name_bn ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, full_name_bn: e.target.value })} />
            </Field>
            <Field label="Title / First / Last">
              <div className="flex gap-1">
                <input className={ainp} value={form.title ?? ""} disabled={!canEdit} placeholder="Dr." onChange={(e) => setForm({ ...form, title: e.target.value })} />
                <input className={ainp} value={form.first_name ?? ""} disabled={!canEdit} placeholder="First" onChange={(e) => setForm({ ...form, first_name: e.target.value })} />
                <input className={ainp} value={form.last_name ?? ""} disabled={!canEdit} placeholder="Last" onChange={(e) => setForm({ ...form, last_name: e.target.value })} />
              </div>
            </Field>
            <Field label="DOB">
              <input type="date" className={ainp} value={form.date_of_birth ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} />
            </Field>
            <Field label="Gender">
              <select className={ainp} value={form.gender ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                <option value="">—</option>
                <option value="male">male</option>
                <option value="female">female</option>
                <option value="other">other</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <DoctorIdDocumentFields
                kind={(form.id_document_kind as CareIdDocumentKind) || ""}
                number={form.nid_passport ?? ""}
                disabled={!canEdit}
                lang={lang}
                selectClassName={ainp}
                inputClassName={ainp}
                onKindChange={(k) => setForm({ ...form, id_document_kind: k || null })}
                onNumberChange={(v) => setForm({ ...form, nid_passport: v })}
              />
            </div>
            <Field label="BMDC">
              <input className={ainp} value={form.bmdc_no ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, bmdc_no: e.target.value })} />
            </Field>
            <Field label={bn ? "ডাক্তার কোড" : "Doctor code"}>
              <input className={ainp} value={form.doctor_code ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, doctor_code: e.target.value })} />
            </Field>
            <Field label={bn ? "ডাক্তারের ধরন" : "Doctor type"}>
              <DoctorTypeSelect
                className={ainp}
                value={form.doctor_type ?? ""}
                disabled={!canEdit}
                lang={lang}
                onChange={(v) => setForm({ ...form, doctor_type: v })}
              />
            </Field>
            <Field label="Phone">
              <input className={ainp} value={form.phone ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label="Email">
              <input className={ainp} value={form.email ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label={bn ? "স্ট্যাটাস" : "Status"}>
              <select className={ainp} value={form.registration_status ?? "active"} disabled={!canEdit} onChange={(e) => setForm({ ...form, registration_status: e.target.value })}>
                <option value="active">active</option>
                <option value="pending">pending</option>
                <option value="suspended">suspended</option>
              </select>
            </Field>
            <Field label={bn ? "স্পেশালিটি" : "Specialty"}>
              <select className={ainp} value={form.specialty_id ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, specialty_id: e.target.value || null })}>
                <option value="">{bn ? "নির্ধারিত নয়" : "Unset"}</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {bn ? s.name_bn : s.name_en}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={bn ? "যোগ্যতা" : "Qualifications"}>
              <input className={ainp} value={form.qualifications ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, qualifications: e.target.value })} />
            </Field>
            <Field label={bn ? "ছবির লিংক" : "Photo URL"}>
              <input className={ainp} value={form.photo_url ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} />
            </Field>
          </div>

          <Field label={bn ? "পরিচিতি" : "Bio"}>
            <textarea className={ainp} rows={2} value={form.bio ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
          </Field>
          <Field label={bn ? "পরিচিতি (বাংলা)" : "Bio (BN)"}>
            <textarea className={ainp} rows={2} value={form.bio_bn ?? ""} disabled={!canEdit} onChange={(e) => setForm({ ...form, bio_bn: e.target.value })} />
          </Field>

          <label className="flex items-center gap-2 text-[11px] text-slate-300">
            <input type="checkbox" checked={form.is_active} disabled={!canEdit} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
            {bn ? "সক্রিয়" : "Active"}
          </label>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {bn ? "কোন কোন প্রতিষ্ঠানে" : "Clinics"}
            </p>
            {clinics === null ? (
              <p className="text-[11px] text-slate-500">{bn ? "লোড…" : "Loading…"}</p>
            ) : clinics.length === 0 ? (
              <p className="text-[11px] text-slate-500">{bn ? "যুক্ত নয়" : "None"}</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {clinics.map((c) => (
                  <li key={`${c.org_id}-${c.location_id}`} className="flex justify-between gap-2 rounded border border-slate-800 px-2 py-1 text-[11px] text-slate-300">
                    <span className="truncate">{c.org_name}{c.location_name ? ` · ${c.location_name}` : ""}</span>
                    <span className="tabular-nums text-slate-400">
                      {c.fee_amount != null ? formatCareMoney(c.fee_amount, lang) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50">
                <Save className="h-3.5 w-3.5" />
                {bn ? "সেভ" : "Save"}
              </button>
              {doctor.registration_status !== "suspended" && (
                <button type="button" disabled={busy} onClick={() => void quickStatus("suspended")} className="rounded-lg border border-amber-700 px-3 py-1.5 text-[11px] text-amber-300">
                  {bn ? "সাসপেন্ড" : "Suspend"}
                </button>
              )}
            </div>
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
        {bn ? `${groups.length} সেট ডুপ্লিকেট` : `${groups.length} duplicate sets`}
      </p>
      <ul className="space-y-2">
        {groups.map((g) => {
          const [keepId, ...others] = g.doctor_ids;
          if (!keepId) return null;
          return (
            <li key={g.match_key} className="rounded border border-slate-800 bg-slate-900/60 p-2">
              <p className="text-[11px] font-semibold text-slate-200">
                {g.full_names[0] ?? g.match_key} <span className="text-slate-500">({g.n})</span>
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
                        className="shrink-0 rounded border border-amber-500/40 px-2 py-0.5 text-[10px] font-bold text-amber-300"
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
            <AlertDialogTitle>{bn ? "মার্জ?" : "Merge?"}</AlertDialogTitle>
            <AlertDialogDescription>{pending?.label}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{bn ? "বাতিল" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={() => void confirmMerge()}>
              {bn ? "মার্জ" : "Merge"}
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
