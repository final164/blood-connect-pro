import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import { getProfile } from "@/lib/api";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import { HospitalTypeahead } from "@/components/hospital/HospitalTypeahead";
import type { District, Hospital } from "@/lib/api";
import type { CommunityDonorRow } from "@/lib/community-donor-import";
import {
  applySmsTemplate,
  buildSmsHref,
  DEFAULT_MESSAGING_SETTINGS,
  fetchMessagingSettings,
  type MessagingSettings,
} from "@/lib/messaging-settings";
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
import {
  DEFAULT_REQUEST_FORM_OPTIONS,
  fetchRequestFormOptions,
  whatsappHref,
  type RequestFormOptions,
} from "@/lib/request-form-options";
import {
  communityRequestDraftFilled,
  loadCommunityRequestDraft,
  saveCommunityRequestDraft,
  type CommunityRequestDraft,
} from "@/lib/community-request-draft";
import { logCommunityContact } from "@/lib/community-request-contacts";
import { toast } from "sonner";

export type CommunityContactChannel = "call" | "sms" | "whatsapp";

const field =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70";

function channelLabel(ch: CommunityContactChannel, lang: "bn" | "en") {
  if (ch === "call") return lang === "bn" ? "কল" : "Call";
  if (ch === "sms") return "SMS";
  return "WhatsApp";
}

/** Create a feed/admin-visible blood request from community contact flow.
 *  Donor contact meta is NOT written into notes — logged in community_request_contacts.
 */
export async function createCommunityBloodRequest(params: {
  userId: string;
  patient_name: string;
  blood_group: string;
  bags_needed: number;
  hospital_name: string;
  hospital_id?: string | null;
  district_id: string | null;
  city: string;
  area: string | null;
  needed_by: string;
  urgency: "normal" | "urgent" | "critical";
  notes: string | null;
  need_reason_key: string;
  need_reason_label: string;
  contact_phone: string | null;
  whatsapp_phone?: string | null;
  donorName?: string;
  donorPhone?: string;
  channel?: CommunityContactChannel | "saved";
  org_id?: string | null;
}): Promise<{ id: string | null; error: Error | null }> {
  const notes = params.notes?.trim() || null;

  const payload: Record<string, unknown> = {
    patient_name: params.patient_name,
    blood_group: params.blood_group,
    bags_needed: params.bags_needed,
    hospital_name: params.hospital_name,
    requester_id: params.userId,
    district_id: params.district_id,
    city: params.city,
    area: params.area,
    needed_by: params.needed_by,
    urgency: params.urgency,
    notes,
    need_reason_key: params.need_reason_key,
    need_reason_label: params.need_reason_label,
    contact_phone: params.contact_phone,
    from_community: true,
  };
  if (params.whatsapp_phone?.trim()) payload.whatsapp_phone = params.whatsapp_phone.trim();
  if (params.hospital_id) payload.hospital_id = params.hospital_id;
  if (params.org_id) payload.org_id = params.org_id;

  async function tryInsert(body: Record<string, unknown>) {
    return supabase.from("blood_requests").insert(body).select("id").single();
  }

  let { data, error } = await tryInsert(payload);
  if (error && /from_community/i.test(error.message)) {
    delete payload.from_community;
    ({ data, error } = await tryInsert(payload));
  }
  if (error && /need_reason_/i.test(error.message)) {
    delete payload.need_reason_key;
    delete payload.need_reason_label;
    ({ data, error } = await tryInsert(payload));
  }
  if (error && /hospital_id/i.test(error.message)) {
    delete payload.hospital_id;
    ({ data, error } = await tryInsert(payload));
  }
  if (error && /org_id/i.test(error.message)) {
    delete payload.org_id;
    ({ data, error } = await tryInsert(payload));
  }
  if (error && /whatsapp_phone/i.test(error.message)) {
    delete payload.whatsapp_phone;
    ({ data, error } = await tryInsert(payload));
  }
  if (error) return { id: null, error: new Error(error.message) };
  return { id: (data as { id?: string } | null)?.id ?? null, error: null };
}

/**
 * Create a feed post once per saved draft. If `existingRequestId` still exists, reuse it
 * so phone/WhatsApp/SMS to more donors does not spam the feed.
 */
export async function ensureCommunityBloodRequest(
  params: Parameters<typeof createCommunityBloodRequest>[0] & {
    existingRequestId?: string | null;
  },
): Promise<{ id: string | null; created: boolean; error: Error | null }> {
  const existingId = params.existingRequestId?.trim() || null;
  if (existingId) {
    const { data } = await supabase
      .from("blood_requests")
      .select("id")
      .eq("id", existingId)
      .maybeSingle();
    if (data?.id) return { id: data.id, created: false, error: null };
  }
  const { id, error } = await createCommunityBloodRequest(params);
  return { id, created: Boolean(id), error };
}

/** SMS / WhatsApp body from a saved community draft + feed request link. */
export function buildCommunityDraftMessageBody(opts: {
  draft: CommunityRequestDraft;
  template: string;
  lang: "bn" | "en";
  requestId: string | null;
}): string {
  const { draft, template, lang, requestId } = opts;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const link = requestId ? `${origin}/home?requestId=${requestId}` : origin;
  const distName = draft.district
    ? lang === "bn"
      ? draft.district.name_bn
      : draft.district.name_en
    : "";
  const hospitalName = draft.hospital
    ? lang === "bn"
      ? draft.hospital.name_bn
      : draft.hospital.name_en
    : "";
  return applySmsTemplate(template, {
    blood_group: draft.blood_group,
    patient_name: draft.patient_name.trim(),
    hospital: hospitalName,
    upazila: draft.upazila.trim(),
    district: distName,
    bags: draft.bags_needed,
    urgency: draft.urgency,
    notes: draft.notes.trim(),
    reason: draft.customReason.trim() || draft.reasonKey,
    link,
    location: [hospitalName, draft.upazila.trim(), distName].filter(Boolean).join(" · "),
  });
}

export function openCommunityContactChannel(
  channel: CommunityContactChannel,
  phone: string,
  body: string,
) {
  const digits = phone.replace(/[^\d+]/g, "");
  if (!digits) return;
  if (channel === "call") {
    window.location.href = `tel:${phone.replace(/\s/g, "")}`;
    return;
  }
  if (channel === "sms") {
    const href = buildSmsHref([phone], body);
    if (href) window.location.href = href;
    return;
  }
  const base = whatsappHref(phone);
  if (!base) return;
  const sep = base.includes("?") ? "&" : "?";
  window.open(`${base}${sep}text=${encodeURIComponent(body)}`, "_blank", "noopener,noreferrer");
}

export function CommunityContactGateSheet({
  open,
  onClose,
  donor,
  channel,
  defaultDistrict,
  onDraftSaved,
}: {
  open: boolean;
  onClose: () => void;
  donor: CommunityDonorRow | null;
  channel: CommunityContactChannel | null;
  defaultDistrict: District | null;
  onDraftSaved?: (draft: CommunityRequestDraft) => void;
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
  const [myPhone, setMyPhone] = useState<string | null>(null);
  const [msgSettings, setMsgSettings] = useState<MessagingSettings>(DEFAULT_MESSAGING_SETTINGS);
  const [form, setForm] = useState({
    patient_name: "",
    blood_group: "O+" as (typeof BLOOD_GROUPS)[number],
    bags_needed: 1,
    needed_by: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
    urgency: "normal" as "normal" | "urgent" | "critical",
    notes: "",
  });

  useEffect(() => {
    if (!open) return;
    const saved = user?.id ? loadCommunityRequestDraft(user.id) : null;
    if (saved && communityRequestDraftFilled(saved)) {
      setDistrict(saved.district ?? defaultDistrict);
      setUpazila(saved.upazila);
      setHospital(saved.hospital);
      setReasonKey(saved.reasonKey);
      setCustomReason(saved.customReason);
      setSetDateTime(saved.setDateTime);
      setForm({
        patient_name: saved.patient_name,
        blood_group: (saved.blood_group as (typeof BLOOD_GROUPS)[number]) || "O+",
        bags_needed: saved.bags_needed,
        needed_by: saved.needed_by,
        urgency: saved.urgency,
        notes: saved.notes,
      });
    } else {
      setDistrict(defaultDistrict);
      setUpazila("");
      setHospital(null);
      setReasonKey("");
      setCustomReason("");
      setSetDateTime(true);
      setForm({
        patient_name: "",
        blood_group: (donor?.blood_group as (typeof BLOOD_GROUPS)[number]) || "O+",
        bags_needed: 1,
        needed_by: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
        urgency: "normal",
        notes: "",
      });
    }
    void fetchMessagingSettings().then(setMsgSettings);
    void fetchRequestFormOptions().then(setOpts);
    void fetchNeedReasonCatalog().then((c: NeedReasonCatalog) => {
      setCategories(activeNeedReasons(c));
      setReasonDisplayLang(resolveNeedReasonLang(c.display_lang, lang));
    });
    if (user?.id) {
      void getProfile(user.id).then((p) => {
        setMyPhone((p?.phone as string | null) ?? null);
      });
    }
  }, [open, defaultDistrict, lang, donor?.blood_group, user?.id]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === reasonKey) ?? null,
    [categories, reasonKey],
  );
  const suggestionChips = selectedCategory?.suggestions ?? [];

  function req(key: keyof RequestFormOptions) {
    return !opts[key];
  }

  function setUrgency(u: "normal" | "urgent" | "critical") {
    setForm((prev) => ({ ...prev, urgency: u }));
    setSetDateTime(u === "normal");
  }

  const ph = (bn: string, en: string) => (lang === "bn" ? bn : en);

  function resolveNeededByIso() {
    if (setDateTime && form.needed_by) return new Date(form.needed_by).toISOString();
    if (form.urgency === "normal") return new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    return new Date().toISOString();
  }

  function buildBody(requestId: string | null): string {
    const tpl = lang === "bn" ? msgSettings.community_sms_bn : msgSettings.community_sms_en;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = requestId ? `${origin}/home?requestId=${requestId}` : origin;
    const distName = district ? (lang === "bn" ? district.name_bn : district.name_en) : "";
    const hospitalName = hospital
      ? lang === "bn"
        ? hospital.name_bn
        : hospital.name_en
      : "";
    const reasonLabel = isCustomNeedReason(reasonKey)
      ? customReason.trim()
      : selectedCategory
        ? pickLocalized(selectedCategory.label, reasonDisplayLang)
        : "";
    return applySmsTemplate(tpl, {
      blood_group: form.blood_group,
      patient_name: form.patient_name.trim(),
      hospital: hospitalName,
      upazila: upazila.trim(),
      district: distName,
      bags: form.bags_needed,
      urgency: form.urgency,
      notes: form.notes.trim(),
      reason: reasonLabel,
      link,
      location: [hospitalName, upazila.trim(), distName].filter(Boolean).join(" · "),
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !donor || !channel) return;

    if (!reasonKey) {
      return toast.error(lang === "bn" ? "রক্তের প্রয়োজনের কারণ নির্বাচন করুন" : "Select why blood is needed");
    }
    if (isCustomNeedReason(reasonKey) && !customReason.trim()) {
      return toast.error(lang === "bn" ? "কাস্টম কারণ লিখুন" : "Enter a custom reason");
    }
    if (req("district") && !district) {
      return toast.error(lang === "bn" ? "জেলা নির্বাচন করুন" : "Select a district");
    }
    if (req("hospital") && !hospital) {
      return toast.error(lang === "bn" ? "হাসপাতালের নাম দিন" : "Enter a hospital name");
    }
    if (req("patient_name") && !form.patient_name.trim()) {
      return toast.error(lang === "bn" ? "রোগীর নাম দিন" : "Enter patient name");
    }

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

    setBusy(true);
    const prev = user.id ? loadCommunityRequestDraft(user.id) : null;
    const { id, created, error } = await ensureCommunityBloodRequest({
      userId: user.id,
      patient_name: form.patient_name.trim() || (lang === "bn" ? "রোগী" : "Patient"),
      blood_group: form.blood_group,
      bags_needed: Math.max(1, form.bags_needed),
      hospital_name: hospitalName,
      hospital_id:
        hospital?.id && !hospital.id.startsWith("custom:") && !hospital.id.startsWith("seed:")
          ? hospital.id
          : null,
      district_id: district?.id ?? null,
      city: district ? (lang === "bn" ? district.name_bn : district.name_en) : "",
      area: upazila.trim() || null,
      needed_by: resolveNeededByIso(),
      urgency: form.urgency,
      notes: form.notes.trim() || null,
      need_reason_key: reasonKey,
      need_reason_label: reasonLabel,
      contact_phone: prev?.contact_phone?.trim() || myPhone,
      whatsapp_phone: prev?.whatsapp_phone?.trim() || null,
      donorName: donor.full_name,
      donorPhone: donor.phone,
      channel,
      org_id: donor.org_id || null,
      existingRequestId: prev?.feed_request_id,
    });
    setBusy(false);

    if (error) return toast.error(error.message);

    if (id && channel !== "saved") {
      void logCommunityContact({
        requestId: id,
        contactedBy: user.id,
        channel,
        donorName: donor.full_name,
        donorPhone: donor.phone,
        communityDonorId: donor.id,
        orgId: donor.org_id || null,
      });
    }

    if (user.id) {
      const draft = saveCommunityRequestDraft(user.id, {
        patient_name: form.patient_name.trim(),
        blood_group: form.blood_group,
        bags_needed: Math.max(1, form.bags_needed),
        needed_by: form.needed_by,
        urgency: form.urgency,
        notes: form.notes.trim(),
        setDateTime,
        reasonKey,
        customReason: customReason.trim(),
        upazila: upazila.trim(),
        contact_phone: prev?.contact_phone?.trim() || myPhone || "",
        whatsapp_phone: prev?.whatsapp_phone?.trim() || "",
        feed_request_id: id || prev?.feed_request_id || null,
        district,
        hospital,
      });
      onDraftSaved?.(draft);
    }

    toast.success(
      created
        ? lang === "bn"
          ? "রিকোয়েস্ট তৈরি হয়েছে — এখন যোগাযোগ খুলছে"
          : "Request created — opening contact"
        : lang === "bn"
          ? "একই রিকোয়েস্ট দিয়ে যোগাযোগ খুলছে"
          : "Opening contact with the same request",
    );

    const body = buildBody(id);
    openCommunityContactChannel(channel, donor.phone, body);
    onClose();
  }

  if (!open || !donor || !channel) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/45 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg md:max-w-2xl max-h-[92dvh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border bg-background shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-background/95 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate">
              {lang === "bn" ? "আগে রিকোয়েস্ট পূরণ করুন" : "Fill request first"}
            </h2>
            <p className="text-[11px] text-muted-foreground truncate">
              {donor.full_name} · {channelLabel(channel, lang)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl grid place-items-center text-muted-foreground hover:bg-muted"
            aria-label={t("cancel")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void submit(e)} className="p-4 space-y-3">
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {lang === "bn"
              ? "কমিউনিটি রক্তদাতার সাথে কল/SMS/WhatsApp করার আগে রিকোয়েস্ট ফর্ম পূরণ করতে হবে। সেভ হলে অ্যাডমিন Manage requests-এ দেখাবে এবং পোস্টের তথ্য দিয়ে মেসেজ যাবে।"
              : "Before call/SMS/WhatsApp, fill this request. It appears in Admin → Manage requests, and the message uses your post details."}
          </p>

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
              onChange={(e) =>
                setForm({ ...form, blood_group: e.target.value as (typeof BLOOD_GROUPS)[number] })
              }
            >
              {BLOOD_GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1 rounded-xl border px-2">
              <button
                type="button"
                className="h-8 w-8 grid place-items-center"
                onClick={() => setForm((f) => ({ ...f, bags_needed: Math.max(1, f.bags_needed - 1) }))}
              >
                <Minus className="h-4 w-4" />
              </button>
              <span className="flex-1 text-center text-sm font-semibold tabular-nums">
                {form.bags_needed}
              </span>
              <button
                type="button"
                className="h-8 w-8 grid place-items-center"
                onClick={() => setForm((f) => ({ ...f, bags_needed: f.bags_needed + 1 }))}
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <DistrictTypeahead
            value={district}
            onChange={(d) => {
              setDistrict(d);
              setUpazila("");
              setHospital(null);
            }}
            required={req("district")}
          />
          <UpazilaSelect
            district={district}
            value={upazila}
            onChange={(v) => {
              setUpazila(v);
              setHospital(null);
            }}
          />
          <HospitalTypeahead
            key={`${district?.id ?? "d"}:${upazila.trim() || "all"}`}
            value={hospital}
            onChange={(h) => {
              setHospital(h);
              if (h?.upazila?.trim()) setUpazila(h.upazila.trim());
            }}
            districtId={district?.id}
            districtSlug={district?.slug}
            upazila={upazila.trim() || undefined}
            required={req("hospital")}
            placeholder={ph("হাসপাতাল / ক্লিনিক / ডায়াগনস্টিক…", "Hospital / clinic / diagnostic…")}
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
                      onClick={() => setForm((f) => ({ ...f, notes: text }))}
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
            className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy
              ? t("saving")
              : lang === "bn"
                ? `রিকোয়েস্ট সেভ করে ${channelLabel(channel, lang)} খুলুন`
                : `Save request & open ${channelLabel(channel, lang)}`}
          </button>
        </form>
      </div>
    </div>
  );
}
