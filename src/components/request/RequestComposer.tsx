import { useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { HospitalTypeahead } from "@/components/hospital/HospitalTypeahead";
import type { District, Hospital } from "@/lib/api";
import {
  DEFAULT_REQUEST_FORM_OPTIONS,
  fetchRequestFormOptions,
  type RequestFormOptions,
} from "@/lib/request-form-options";
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
  const [opts, setOpts] = useState<RequestFormOptions>(DEFAULT_REQUEST_FORM_OPTIONS);
  const [district, setDistrict] = useState<District | null>(defaultDistrict);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [form, setForm] = useState({
    patient_name: "",
    blood_group: "O+" as (typeof BLOOD_GROUPS)[number],
    bags_needed: 1,
    contact_phone: "",
    whatsapp_phone: "",
    needed_by: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
    urgency: "normal" as "normal" | "urgent" | "critical",
    notes: "",
  });

  useEffect(() => setDistrict(defaultDistrict), [defaultDistrict]);
  useEffect(() => {
    fetchRequestFormOptions().then(setOpts);
  }, []);

  function req(key: keyof RequestFormOptions) {
    return !opts[key];
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (req("district") && !district) {
      toast.error(lang === "bn" ? "জেলা নির্বাচন করুন" : "Select a district");
      return;
    }
    if (req("hospital") && !hospital) {
      toast.error(lang === "bn" ? "হাসপাতালের নাম দিন" : "Enter a hospital name");
      return;
    }
    if (req("patient_name") && !form.patient_name.trim()) {
      toast.error(lang === "bn" ? "রোগীর নাম দিন" : "Enter patient name");
      return;
    }
    if (req("contact_phone") && !form.contact_phone.trim()) {
      toast.error(lang === "bn" ? "যোগাযোগ নম্বর দিন" : "Enter contact number");
      return;
    }
    if (req("whatsapp") && !form.whatsapp_phone.trim()) {
      toast.error(lang === "bn" ? "WhatsApp নম্বর দিন" : "Enter WhatsApp number");
      return;
    }

    setBusy(true);
    const hospitalName = hospital
      ? lang === "bn"
        ? hospital.name_bn
        : hospital.name_en
      : lang === "bn"
        ? "উল্লেখ নেই"
        : "Not specified";

    const payload: Record<string, unknown> = {
      patient_name: form.patient_name.trim() || (lang === "bn" ? "রোগী" : "Patient"),
      blood_group: form.blood_group,
      bags_needed: Math.max(1, form.bags_needed),
      contact_phone: form.contact_phone.trim() || null,
      whatsapp_phone: form.whatsapp_phone.trim() || null,
      hospital_name: hospitalName,
      requester_id: user.id,
      district_id: district?.id ?? null,
      city: district ? (lang === "bn" ? district.name_bn : district.name_en) : "",
      needed_by: new Date(form.needed_by || Date.now() + 86400000).toISOString(),
      urgency: form.urgency,
      notes: form.notes.trim() || null,
    };
    if (hospital?.id && !hospital.id.startsWith("custom:") && !hospital.id.startsWith("seed:")) {
      payload.hospital_id = hospital.id;
    }

    let { error } = await supabase.from("blood_requests").insert(payload);
    if (error && /whatsapp_phone/i.test(error.message)) {
      delete payload.whatsapp_phone;
      ({ error } = await supabase.from("blood_requests").insert(payload));
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "রিকোয়েস্ট ফিডে পোস্ট হয়েছে" : "Request posted to feed");
    setHospital(null);
    setForm({
      patient_name: "",
      blood_group: "O+",
      bags_needed: 1,
      contact_phone: "",
      whatsapp_phone: "",
      needed_by: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
      urgency: "normal",
      notes: "",
    });
    onCreated();
  }

  const ph = (bn: string, en: string) => (lang === "bn" ? bn : en);

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-primary/15 bg-card p-4 space-y-3 shadow-[0_8px_30px_-12px_rgba(198,40,40,0.25)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-tight">{t("createRequest")}</h2>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-xs font-medium text-muted-foreground hover:text-foreground">
            {t("cancel")}
          </button>
        )}
      </div>

      <input
        className={field}
        placeholder={ph("রোগীর নাম", "Patient name")}
        value={form.patient_name}
        onChange={(e) => setForm({ ...form, patient_name: e.target.value })}
        required={req("patient_name")}
      />

      <div className="grid grid-cols-2 gap-2.5">
        <select
          className={field}
          value={form.blood_group}
          onChange={(e) => setForm({ ...form, blood_group: e.target.value as (typeof BLOOD_GROUPS)[number] })}
          required={req("blood_group")}
        >
          {BLOOD_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 rounded-xl border bg-background px-1.5 py-1">
          <button
            type="button"
            aria-label="Decrease bags"
            className="h-9 w-9 rounded-lg grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setForm({ ...form, bags_needed: Math.max(1, form.bags_needed - 1) })}
          >
            <Minus className="h-4 w-4" />
          </button>
          <input
            className="flex-1 min-w-0 bg-transparent text-center text-sm font-semibold outline-none"
            type="number"
            min={1}
            value={form.bags_needed}
            onChange={(e) => setForm({ ...form, bags_needed: Math.max(1, Number(e.target.value) || 1) })}
            placeholder={ph("ব্যাগ", "Bags")}
            aria-label={t("bagsNeeded")}
          />
          <button
            type="button"
            aria-label="Increase bags"
            className="h-9 w-9 rounded-lg grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => setForm({ ...form, bags_needed: form.bags_needed + 1 })}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <DistrictTypeahead
        value={district}
        onChange={(d) => {
          setDistrict(d);
          setHospital(null);
        }}
        required={req("district")}
        placeholder={ph("জেলা খুঁজুন…", "Search district…")}
      />

      <HospitalTypeahead
        value={hospital}
        onChange={setHospital}
        districtId={district?.id}
        districtSlug={district?.slug}
        required={req("hospital")}
        placeholder={ph("হাসপাতাল খুঁজুন…", "Search hospital…")}
      />

      <input
        className={field}
        placeholder={
          opts.contact_phone
            ? ph("যোগাযোগ নম্বর (ঐচ্ছিক)", "Contact number (optional)")
            : ph("যোগাযোগ নম্বর", "Contact number")
        }
        value={form.contact_phone}
        onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
        required={req("contact_phone")}
        inputMode="tel"
      />

      <input
        className={field}
        placeholder={
          opts.whatsapp
            ? ph("WhatsApp নম্বর (ঐচ্ছিক)", "WhatsApp number (optional)")
            : ph("WhatsApp নম্বর", "WhatsApp number")
        }
        value={form.whatsapp_phone}
        onChange={(e) => setForm({ ...form, whatsapp_phone: e.target.value })}
        required={req("whatsapp")}
        inputMode="tel"
      />

      <input
        className={field}
        type="datetime-local"
        value={form.needed_by}
        onChange={(e) => setForm({ ...form, needed_by: e.target.value })}
        required={req("needed_by")}
        title={ph("কতক্ষণে দরকার", "Needed by")}
      />

      <div className="grid grid-cols-3 gap-1.5">
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

      <textarea
        className={field}
        rows={2}
        placeholder={
          opts.notes ? ph("নোট (ঐচ্ছিক)", "Notes (optional)") : ph("নোট", "Notes")
        }
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        required={req("notes")}
      />

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

const field =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70";
