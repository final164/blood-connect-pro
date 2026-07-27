import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { HospitalTypeahead } from "@/components/hospital/HospitalTypeahead";
import type { District, Hospital } from "@/lib/api";
import { toast } from "sonner";

export function RequestComposer({
  defaultDistrict,
  onCreated,
  onCancel,
}: {
  defaultDistrict: District | null;
  onCreated: () => void;
  onCancel?: () => void;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [district, setDistrict] = useState<District | null>(defaultDistrict);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [form, setForm] = useState({
    patient_name: "",
    blood_group: "O+" as (typeof BLOOD_GROUPS)[number],
    bags_needed: 1,
    contact_phone: "",
    needed_by: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
    urgency: "normal" as "normal" | "urgent" | "critical",
    notes: "",
  });

  useEffect(() => setDistrict(defaultDistrict), [defaultDistrict]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!district) {
      toast.error(lang === "bn" ? "জেলা নির্বাচন করুন" : "Select a district");
      return;
    }
    if (!hospital) {
      toast.error(lang === "bn" ? "হাসপাতাল নির্বাচন করুন" : "Select a hospital");
      return;
    }
    setBusy(true);
    const hospitalName = lang === "bn" ? hospital.name_bn : hospital.name_en;
    const payload: Record<string, unknown> = {
      ...form,
      hospital_name: hospitalName,
      requester_id: user.id,
      district_id: district.id,
      city: lang === "bn" ? district.name_bn : district.name_en,
      needed_by: new Date(form.needed_by).toISOString(),
    };
    if (hospital.id && !hospital.id.startsWith("seed:")) {
      payload.hospital_id = hospital.id;
    }
    const { error } = await supabase.from("blood_requests").insert(payload);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "রিকোয়েস্ট ফিডে পোস্ট হয়েছে" : "Request posted to feed");
    setHospital(null);
    setForm({
      patient_name: "",
      blood_group: "O+",
      bags_needed: 1,
      contact_phone: "",
      needed_by: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
      urgency: "normal",
      notes: "",
    });
    onCreated();
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-primary/15 bg-card p-4 space-y-3 shadow-[0_8px_30px_-12px_rgba(198,40,40,0.25)]"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold tracking-tight">{t("createRequest")}</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {lang === "bn" ? "ফিডে সরাসরি প্রকাশ হবে" : "Publishes live on the feed"}
          </p>
        </div>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs font-medium text-muted-foreground hover:text-foreground">
            {t("cancel")}
          </button>
        )}
      </div>

      <Field label={t("patientName")}>
        <input className={field} value={form.patient_name} onChange={(e) => setForm({ ...form, patient_name: e.target.value })} required />
      </Field>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label={t("bloodGroup")}>
          <select
            className={field}
            value={form.blood_group}
            onChange={(e) => setForm({ ...form, blood_group: e.target.value as (typeof BLOOD_GROUPS)[number] })}
          >
            {BLOOD_GROUPS.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </Field>
        <Field label={t("bagsNeeded")}>
          <input
            className={field}
            type="number"
            min={1}
            value={form.bags_needed}
            onChange={(e) => setForm({ ...form, bags_needed: Math.max(1, Number(e.target.value) || 1) })}
          />
        </Field>
      </div>

      <Field label={t("district")}>
        <DistrictTypeahead
          value={district}
          onChange={(d) => {
            setDistrict(d);
            setHospital(null);
          }}
          required
        />
      </Field>

      <Field label={t("hospital")}>
        <HospitalTypeahead
          value={hospital}
          onChange={setHospital}
          districtId={district?.id}
          districtSlug={district?.slug}
          required
        />
      </Field>

      <div className="grid grid-cols-2 gap-2.5">
        <Field label={t("contact")}>
          <input className={field} value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} required />
        </Field>
        <Field label={t("neededBy")}>
          <input className={field} type="datetime-local" value={form.needed_by} onChange={(e) => setForm({ ...form, needed_by: e.target.value })} />
        </Field>
      </div>

      <div>
        <label className="text-[11px] font-medium text-muted-foreground">{t("urgency")}</label>
        <div className="grid grid-cols-3 gap-1.5 mt-1">
          {(["normal", "urgent", "critical"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setForm({ ...form, urgency: u })}
              className={`rounded-xl py-2.5 text-xs font-semibold border transition ${
                form.urgency === u
                  ? u === "critical"
                    ? "bg-destructive text-destructive-foreground border-destructive"
                    : u === "urgent"
                      ? "bg-[color:var(--urgent)] text-white border-transparent"
                      : "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {t(u)}
            </button>
          ))}
        </div>
      </div>

      <Field label={t("notes")}>
        <textarea className={field} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </Field>

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 shadow-lg shadow-primary/25 hover:brightness-105 transition"
      >
        {busy ? t("saving") : t("postToFeed")}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">{label}</label>
      {children}
    </div>
  );
}

const field =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25";
