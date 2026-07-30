import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaTypeahead } from "@/components/district/UpazilaTypeahead";
import { HospitalTypeahead } from "@/components/hospital/HospitalTypeahead";
import type { District, Hospital } from "@/lib/api";
import { getProfile } from "@/lib/api";
import {
  DEFAULT_REQUEST_FORM_OPTIONS,
  fetchRequestFormOptions,
  type RequestFormOptions,
} from "@/lib/request-form-options";
import {
  NEED_REASON_CUSTOM_ID,
  activeNeedReasons,
  fetchNeedReasonCatalog,
  isCustomNeedReason,
  pickLocalized,
  resolveNeedReasonLang,
  type NeedReasonCatalog,
  type NeedReasonCategory,
} from "@/lib/need-reason-catalog";
import { toast } from "sonner";

export function RequestComposer({
  defaultDistrict,
  onCreated,
  onCancel,
  variant = "card",
}: {
  defaultDistrict: District | null;
  onCreated: (requestId: string) => void;
  onCancel?: () => void;
  variant?: "card" | "panel";
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<RequestFormOptions>(DEFAULT_REQUEST_FORM_OPTIONS);
  const [district, setDistrict] = useState<District | null>(defaultDistrict);
  const [upazila, setUpazila] = useState("");
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [categories, setCategories] = useState<NeedReasonCategory[]>([]);
  const [reasonDisplayLang, setReasonDisplayLang] = useState<"bn" | "en">(lang);
  const [reasonKey, setReasonKey] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [setDateTime, setSetDateTime] = useState(true);
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
    if (!user) return;
    // Do not auto-fill upazila — leave blank until hospital pick or manual select.
    if (defaultDistrict) return;
    getProfile(user.id).then((p) => {
      if (!p?.district_id) return;
      void supabase
        .from("districts")
        .select("id,name_bn,name_en,slug,is_active,sort_order")
        .eq("id", p.district_id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setDistrict(data as District);
        });
    });
  }, [user?.id, defaultDistrict]);
  useEffect(() => {
    fetchRequestFormOptions().then(setOpts);
    fetchNeedReasonCatalog().then((c: NeedReasonCatalog) => {
      setCategories(activeNeedReasons(c));
      setReasonDisplayLang(resolveNeedReasonLang(c.display_lang, lang));
    });
  }, [lang]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === reasonKey) ?? null,
    [categories, reasonKey],
  );
  const suggestionChips = selectedCategory?.suggestions ?? [];

  function setUrgency(u: "normal" | "urgent" | "critical") {
    setForm((prev) => ({ ...prev, urgency: u }));
    // Normal: date/time on by default. Urgent/Critical: hidden unless toggled.
    setSetDateTime(u === "normal");
  }

  function req(key: keyof RequestFormOptions) {
    return !opts[key];
  }

  function applySuggestion(text: string) {
    setForm((prev) => ({ ...prev, notes: text }));
  }

  function resolveNeededByIso() {
    if (setDateTime && form.needed_by) {
      return new Date(form.needed_by).toISOString();
    }
    // No scheduled time → ASAP for urgent/critical; soft +24h for normal
    if (form.urgency === "normal") {
      return new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    }
    return new Date().toISOString();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!reasonKey) {
      toast.error(lang === "bn" ? "রক্তের প্রয়োজনের কারণ নির্বাচন করুন" : "Select why blood is needed");
      return;
    }
    if (isCustomNeedReason(reasonKey) && !customReason.trim()) {
      toast.error(lang === "bn" ? "কাস্টম কারণ লিখুন" : "Enter a custom reason");
      return;
    }
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

    const reasonLabel = isCustomNeedReason(reasonKey)
      ? customReason.trim()
      : selectedCategory
        ? pickLocalized(selectedCategory.label, reasonDisplayLang)
        : customReason.trim();

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
      area: upazila.trim() || null,
      needed_by: resolveNeededByIso(),
      urgency: form.urgency,
      notes: form.notes.trim() || null,
      need_reason_key: reasonKey,
      need_reason_label: reasonLabel,
    };
    if (hospital?.id && !hospital.id.startsWith("custom:") && !hospital.id.startsWith("seed:")) {
      payload.hospital_id = hospital.id;
    }

    async function tryInsert(body: Record<string, unknown>) {
      return supabase.from("blood_requests").insert(body).select("id").single();
    }

    let { data: created, error } = await tryInsert(payload);
    if (error && /need_reason_/i.test(error.message)) {
      delete payload.need_reason_key;
      delete payload.need_reason_label;
      ({ data: created, error } = await tryInsert(payload));
    }
    if (error && /whatsapp_phone/i.test(error.message)) {
      delete payload.whatsapp_phone;
      ({ data: created, error } = await tryInsert(payload));
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    const newId = (created as { id?: string } | null)?.id;
    if (!newId) return toast.error(lang === "bn" ? "পোস্ট তৈরি হয়েছে কিন্তু আইডি পাওয়া যায়নি" : "Posted but id missing");
    toast.success(lang === "bn" ? "রিকোয়েস্ট ফিডে পোস্ট হয়েছে" : "Request posted to feed");
    setHospital(null);
    setReasonKey("");
    setCustomReason("");
    setSetDateTime(true);
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
    onCreated(newId);
  }

  const ph = (bn: string, en: string) => (lang === "bn" ? bn : en);
  const isPanel = variant === "panel";

  return (
    <form
      onSubmit={submit}
      className={
        isPanel
          ? "bg-background p-4 space-y-3"
          : "rounded-2xl border border-primary/15 bg-card p-4 space-y-3 shadow-[0_8px_30px_-12px_rgba(198,40,40,0.25)]"
      }
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold tracking-tight">{t("createRequest")}</h2>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className={
              isPanel
                ? "h-9 w-9 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground grid place-items-center transition"
                : "text-xs font-medium text-muted-foreground hover:text-foreground"
            }
            aria-label={t("cancel")}
          >
            {isPanel ? <X className="h-5 w-5" /> : t("cancel")}
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

      <div className="grid grid-cols-2 gap-2">
        <DistrictTypeahead
          value={district}
          onChange={(d) => {
            setDistrict(d);
            setUpazila("");
            setHospital(null);
          }}
          required={req("district")}
          placeholder={ph("জেলা খুঁজুন…", "Search district…")}
        />
        <UpazilaTypeahead
          key={district?.id ?? "none"}
          district={district}
          value={upazila}
          onChange={(v) => {
            setUpazila(v);
            setHospital(null);
          }}
          placeholder={ph("উপজেলা খুঁজুন…", "Search upazila…")}
        />
      </div>

      <HospitalTypeahead
        key={district?.id ?? "d"}
        value={hospital}
        onChange={(h) => {
          setHospital(h);
          if (h?.upazila?.trim()) setUpazila(h.upazila.trim());
        }}
        districtId={district?.id}
        districtSlug={district?.slug}
        upazila={upazila || null}
        required={req("hospital")}
        placeholder={ph("হাসপাতাল / ক্লিনিক / ডায়াগনস্টিক…", "Hospital / clinic / diagnostic…")}
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

      <div className="grid grid-cols-3 gap-1.5">
        {(["normal", "urgent", "critical"] as const).map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => setUrgency(u)}
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

      <label className="flex items-center justify-between gap-3 rounded-xl border bg-background px-3 py-2.5">
        <span className="text-xs font-medium text-foreground">
          {lang === "bn" ? "তারিখ ও সময় সেট করুন" : "Set date and time"}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={setDateTime}
          onClick={() => setSetDateTime((v) => !v)}
          className={`relative h-6 w-11 shrink-0 rounded-full transition ${
            setDateTime ? "bg-primary" : "bg-muted"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
              setDateTime ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </label>

      {setDateTime && (
        <input
          className={field}
          type="datetime-local"
          value={form.needed_by}
          onChange={(e) => setForm({ ...form, needed_by: e.target.value })}
          required={req("needed_by")}
          title={ph("কতক্ষণে দরকার", "Needed by")}
        />
      )}

      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          {reasonDisplayLang === "bn" ? "সমস্যার কারণ / রোগের ধরন" : "Reason / disease type"}
        </label>
        <select
          className={field}
          value={reasonKey}
          onChange={(e) => {
            setReasonKey(e.target.value);
            if (!isCustomNeedReason(e.target.value)) setCustomReason("");
          }}
          required
        >
          <option value="">
            {reasonDisplayLang === "bn" ? "কারণ নির্বাচন করুন…" : "Select a reason…"}
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {pickLocalized(c.label, reasonDisplayLang)}
            </option>
          ))}
          <option value={NEED_REASON_CUSTOM_ID}>
            {reasonDisplayLang === "bn" ? "কাস্টম (নিজে লিখুন)" : "Custom (write your own)"}
          </option>
        </select>

        {isCustomNeedReason(reasonKey) && (
          <input
            className={field}
            placeholder={
              reasonDisplayLang === "bn" ? "কাস্টম কারণ লিখুন…" : "Write custom reason…"
            }
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            required
          />
        )}
      </div>

      {suggestionChips.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            {reasonDisplayLang === "bn"
              ? "নোট সাজেশন — ট্যাপ করে নিন (চাইলে এডিট করুন)"
              : "Note suggestions — tap to use (edit anytime)"}
          </p>
          <div className="flex flex-col gap-1.5">
            {suggestionChips.map((s, i) => {
              const text = pickLocalized(s, reasonDisplayLang);
              const active = form.notes.trim() === text.trim();
              return (
                <button
                  key={`${reasonKey}-chip-${i}`}
                  type="button"
                  onClick={() => applySuggestion(text)}
                  className={`text-left rounded-xl border px-3 py-2 text-xs leading-relaxed transition ${
                    active
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  {text}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <textarea
        className={field}
        rows={3}
        placeholder={
          opts.notes
            ? ph(
                "নোট (ঐচ্ছিক) — সাজেশন থেকে নিন বা নিজে লিখুন",
                "Notes (optional) — pick a suggestion or write your own",
              )
            : ph("নোট — সাজেশন থেকে নিন বা নিজে লিখুন", "Notes — pick a suggestion or write your own")
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
