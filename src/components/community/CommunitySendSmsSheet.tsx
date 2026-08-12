import { useEffect, useMemo, useState } from "react";
import { MessageSquare, X, ChevronRight, ChevronLeft, Minus, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import { BLOOD_GROUPS } from "@/lib/format";
import { getProfile } from "@/lib/api";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import { HospitalTypeahead } from "@/components/hospital/HospitalTypeahead";
import type { District, Hospital } from "@/lib/api";
import type { CommunityDonorRow } from "@/lib/community-donor-import";
import {
  contactFlagsForViewerDonor,
  normalizeDonorContactSettings,
  type DonorContactSettings,
} from "@/lib/community-contact-settings";
import {
  applySmsTemplate,
  buildSmsHref,
  DEFAULT_MESSAGING_SETTINGS,
  fetchMessagingSettings,
  type MessagingSettings,
} from "@/lib/messaging-settings";
import { ensureCommunityBloodRequest } from "@/components/community/CommunityContactGateSheet";
import {
  activeNeedReasons,
  fetchNeedReasonCatalog,
  isCustomNeedReason,
  pickLocalized,
  resolveNeedReasonLang,
  type NeedReasonCatalog,
  type NeedReasonCategory,
} from "@/lib/need-reason-catalog";
import { RequestNotesFields } from "@/components/request/RequestNotesFields";
import {
  extractPostNotes,
  withPostTextStyle,
  type PostTextStyleId,
} from "@/lib/post-text-styles";
import {
  DEFAULT_REQUEST_FORM_OPTIONS,
  fetchRequestFormOptions,
  type RequestFormOptions,
} from "@/lib/request-form-options";
import {
  communityRequestDraftFilled,
  loadCommunityRequestDraft,
  saveCommunityRequestDraft,
  type CommunityRequestDraft,
} from "@/lib/community-request-draft";
import { logCommunityContactsBulk } from "@/lib/community-request-contacts";
import { toast } from "sonner";

function orgSettings(d: CommunityDonorRow): DonorContactSettings {
  const raw = (d.community_orgs as { donor_contact_settings?: unknown } | null | undefined)
    ?.donor_contact_settings;
  return normalizeDonorContactSettings(raw);
}

function donorGenderKey(g: string | null | undefined): "male" | "female" {
  return (g ?? "").trim().toLowerCase() === "female" ? "female" : "male";
}

function viewerGenderKey(g: string | null | undefined): "male" | "female" {
  return (g ?? "").trim().toLowerCase() === "female" ? "female" : "male";
}

/** Male viewer → only male donors. Female viewer → male + female. Also requires org SMS flag. */
export function isSmsPickEligible(
  d: CommunityDonorRow,
  viewerGender: string | null | undefined,
): boolean {
  if (!d.phone?.trim()) return false;
  const viewer = viewerGenderKey(viewerGender);
  const donor = donorGenderKey(d.gender);
  if (viewer === "male" && donor === "female") return false;
  const flags = contactFlagsForViewerDonor(orgSettings(d), viewerGender, d.gender);
  return flags.sms;
}

const field =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70";

export function CommunitySendSmsSheet({
  open,
  onClose,
  donors,
  defaultDistrict,
  defaultUpazila,
  viewerGender,
  onDraftSaved,
}: {
  open: boolean;
  onClose: () => void;
  donors: CommunityDonorRow[];
  defaultDistrict: District | null;
  defaultUpazila: string;
  viewerGender?: string | null;
  onDraftSaved?: (draft: CommunityRequestDraft) => void;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [opts, setOpts] = useState<RequestFormOptions>(DEFAULT_REQUEST_FORM_OPTIONS);
  const [district, setDistrict] = useState<District | null>(defaultDistrict);
  const [upazila, setUpazila] = useState(defaultUpazila);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [categories, setCategories] = useState<NeedReasonCategory[]>([]);
  const [reasonDisplayLang, setReasonDisplayLang] = useState<"bn" | "en">(lang);
  const [reasonKey, setReasonKey] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [textStyleId, setTextStyleId] = useState<PostTextStyleId>("none");
  const [setDateTime, setSetDateTime] = useState(true);
  const [myPhone, setMyPhone] = useState<string | null>(null);
  const [form, setForm] = useState({
    patient_name: "",
    blood_group: "O+" as (typeof BLOOD_GROUPS)[number],
    bags_needed: 1,
    needed_by: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
    urgency: "normal" as "normal" | "urgent" | "critical",
    notes: "",
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [msgSettings, setMsgSettings] = useState<MessagingSettings>(DEFAULT_MESSAGING_SETTINGS);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setBusy(false);
    const saved = user?.id ? loadCommunityRequestDraft(user.id) : null;
    if (saved && communityRequestDraftFilled(saved)) {
      setDistrict(saved.district ?? defaultDistrict);
      setUpazila(saved.upazila || defaultUpazila);
      setHospital(saved.hospital);
      setReasonKey(saved.reasonKey);
      setCustomReason(saved.customReason);
      setSetDateTime(saved.setDateTime);
      {
        const parsed = extractPostNotes(saved.notes);
        setTextStyleId(parsed.styleId);
        setForm({
          patient_name: saved.patient_name,
          blood_group: (saved.blood_group as (typeof BLOOD_GROUPS)[number]) || "O+",
          bags_needed: saved.bags_needed,
          needed_by: saved.needed_by,
          urgency: saved.urgency,
          notes: parsed.text,
        });
      }
    } else {
      setDistrict(defaultDistrict);
      setUpazila(defaultUpazila);
      setHospital(null);
      setReasonKey("");
      setCustomReason("");
      setTextStyleId("none");
      setSetDateTime(true);
      setForm({
        patient_name: "",
        blood_group: "O+",
        bags_needed: 1,
        needed_by: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
        urgency: "normal",
        notes: "",
      });
    }
    setSelected(new Set());
    void fetchMessagingSettings().then(setMsgSettings);
    void fetchRequestFormOptions().then(setOpts);
    void fetchNeedReasonCatalog().then((c: NeedReasonCatalog) => {
      setCategories(activeNeedReasons(c));
      setReasonDisplayLang(resolveNeedReasonLang(c.display_lang, lang));
    });
    if (user?.id) {
      void getProfile(user.id).then((p) => setMyPhone((p?.phone as string | null) ?? null));
    }
  }, [open, defaultDistrict, defaultUpazila, lang, user?.id]);

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === reasonKey) ?? null,
    [categories, reasonKey],
  );
  const maxDonors = msgSettings.max_sms_donors;

  const smsEligible = useMemo(
    () => donors.filter((d) => isSmsPickEligible(d, viewerGender)),
    [donors, viewerGender],
  );

  function req(key: keyof RequestFormOptions) {
    return !opts[key];
  }

  function setUrgency(u: "normal" | "urgent" | "critical") {
    setForm((prev) => ({ ...prev, urgency: u }));
    setSetDateTime(u === "normal");
  }

  const ph = (bn: string, en: string) => (lang === "bn" ? bn : en);

  function goSelect() {
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
    if (!smsEligible.length) {
      return toast.error(
        lang === "bn"
          ? "এই ফিল্টারে SMS পাঠানোর যোগ্য কোনো রক্তদাতা নেই"
          : "No SMS-eligible donors in this filter",
      );
    }
    setStep(2);
  }

  function buildBody(requestId?: string | null): string {
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

  async function send() {
    if (!user) {
      return toast.error(lang === "bn" ? "লগইন প্রয়োজন" : "Login required");
    }
    const picks = smsEligible.filter((d) => selected.has(d.id));
    if (!picks.length) {
      return toast.error(lang === "bn" ? "কমপক্ষে একজন সিলেক্ট করুন" : "Select at least one donor");
    }
    if (picks.length > maxDonors) {
      return toast.error(
        lang === "bn"
          ? `সর্বোচ্চ ${maxDonors} জন সিলেক্ট করা যাবে`
          : `You can select at most ${maxDonors} donor(s)`,
      );
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
    const neededBy =
      setDateTime && form.needed_by
        ? new Date(form.needed_by).toISOString()
        : form.urgency === "normal"
          ? new Date(Date.now() + 24 * 3600 * 1000).toISOString()
          : new Date().toISOString();

    setBusy(true);
    const donorSummary = picks.map((d) => `${d.full_name} (${d.phone})`).join(", ");
    const prev = loadCommunityRequestDraft(user.id);
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
      needed_by: neededBy,
      urgency: form.urgency,
      notes: withPostTextStyle(form.notes, textStyleId) || null,
      need_reason_key: reasonKey,
      need_reason_label: reasonLabel,
      contact_phone: prev?.contact_phone?.trim() || myPhone,
      whatsapp_phone: prev?.whatsapp_phone?.trim() || null,
      donorName: donorSummary.slice(0, 180),
      donorPhone: picks[0]?.phone ?? "",
      channel: "sms",
      org_id: picks.every((d) => d.org_id === picks[0]?.org_id) ? (picks[0]?.org_id ?? null) : null,
      existingRequestId: prev?.feed_request_id,
    });
    setBusy(false);

    if (error) return toast.error(error.message);

    if (id) {
      void logCommunityContactsBulk(
        {
          requestId: id,
          contactedBy: user.id,
          channel: "sms",
          orgId: picks.every((d) => d.org_id === picks[0]?.org_id) ? picks[0]?.org_id ?? null : null,
        },
        picks,
      );
    }

    const draft = saveCommunityRequestDraft(user.id, {
      patient_name: form.patient_name.trim(),
      blood_group: form.blood_group,
      bags_needed: Math.max(1, form.bags_needed),
      needed_by: form.needed_by,
      urgency: form.urgency,
      notes: withPostTextStyle(form.notes, textStyleId),
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

    const href = buildSmsHref(
      picks.map((d) => d.phone),
      buildBody(id),
    );
    if (!href) return toast.error(lang === "bn" ? "ফোন নম্বর নেই" : "No phone numbers");
    toast.success(
      created
        ? lang === "bn"
          ? "রিকোয়েস্ট সেভ হয়েছে — SMS খুলছে"
          : "Request saved — opening SMS"
        : lang === "bn"
          ? "একই রিকোয়েস্ট দিয়ে SMS খুলছে"
          : "Opening SMS with the same request",
    );
    window.location.href = href;
    onClose();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= maxDonors) {
        toast.error(
          lang === "bn"
            ? `সর্বোচ্চ ${maxDonors} জন সিলেক্ট করা যাবে`
            : `Max ${maxDonors} donor(s)`,
        );
        return prev;
      }
      next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const capped = smsEligible.slice(0, maxDonors);
    if (selected.size === capped.length && capped.every((d) => selected.has(d.id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(capped.map((d) => d.id)));
      if (smsEligible.length > maxDonors) {
        toast.message(
          lang === "bn"
            ? `প্রথম ${maxDonors} জন সিলেক্ট হয়েছে`
            : `Selected first ${maxDonors} donor(s)`,
        );
      }
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full sm:max-w-lg md:max-w-2xl max-h-[92vh] overflow-auto rounded-t-2xl sm:rounded-2xl border bg-card shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-card/95 px-4 py-3 backdrop-blur">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="h-4 w-4 text-primary shrink-0" />
            <h2 className="text-sm font-semibold truncate">
              {step === 1
                ? lang === "bn"
                  ? "SMS — রিকোয়েস্ট ফর্ম"
                  : "SMS — request form"
                : lang === "bn"
                  ? "ডোনার সিলেক্ট"
                  : "Select donors"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted grid place-items-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {step === 1 ? (
          <div className="p-4 space-y-3">
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
                  onChange={(e) =>
                    setForm({ ...form, bags_needed: Math.max(1, Number(e.target.value) || 1) })
                  }
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
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t("district")}</label>
                <DistrictTypeahead
                  value={district}
                  onChange={(d) => {
                    setDistrict(d);
                    setUpazila("");
                    setHospital(null);
                  }}
                  required={req("district")}
                  placeholder={t("district")}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">{t("upazila")}</label>
                <UpazilaSelect
                  district={district}
                  value={upazila}
                  onChange={(v) => {
                    setUpazila(v);
                    setHospital(null);
                  }}
                />
              </div>
            </div>

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
              />
            )}

            <RequestNotesFields
              reasonKey={reasonKey}
              customReason={customReason}
              notes={form.notes}
              onReasonKeyChange={setReasonKey}
              onCustomReasonChange={setCustomReason}
              onNotesChange={(text) => setForm((f) => ({ ...f, notes: text }))}
              textStyleId={textStyleId}
              onTextStyleChange={setTextStyleId}
              categories={categories}
              reasonDisplayLang={reasonDisplayLang}
              uiLang={lang}
              notesOptional={opts.notes}
              ph={ph}
              fieldClassName={field}
              preview={{
                patient_name: form.patient_name,
                blood_group: form.blood_group,
                bags_needed: form.bags_needed,
                hospital_name: hospital
                  ? lang === "bn"
                    ? hospital.name_bn
                    : hospital.name_en
                  : undefined,
                area: upazila || null,
                districtName: lang === "bn" ? district?.name_bn : district?.name_en,
                needed_by: setDateTime && form.needed_by ? form.needed_by : undefined,
              }}
            />

            <button
              type="button"
              onClick={goSelect}
              className="w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold py-3 flex items-center justify-center gap-1"
            >
              {lang === "bn" ? "Next — pick donor" : "Next — pick donor"}
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <button type="button" onClick={() => setStep(1)} className="flex items-center gap-1 hover:text-foreground">
                <ChevronLeft className="h-3.5 w-3.5" />
                {lang === "bn" ? "ফর্ম" : "Form"}
              </button>
              <button type="button" onClick={toggleAll} className="text-primary font-medium">
                {selected.size > 0 &&
                selected.size === Math.min(smsEligible.length, maxDonors) &&
                [...selected].every((id) => smsEligible.some((d) => d.id === id))
                  ? lang === "bn"
                    ? "সব সরান"
                    : "Clear all"
                  : lang === "bn"
                    ? "সব সিলেক্ট"
                    : "Select all"}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {lang === "bn"
                ? `সর্বোচ্চ ${maxDonors} জন · ${selected.size} সিলেক্ট`
                : `Max ${maxDonors} · ${selected.size} selected`}
            </p>
            <ul className="max-h-[50vh] overflow-auto space-y-1.5 rounded-xl border p-2">
              {smsEligible.map((d) => (
                <li key={d.id}>
                  <label className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={() => toggle(d.id)}
                      className="h-4 w-4 accent-primary"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium break-words">{d.full_name}</p>
                      <p className="text-[10px] text-muted-foreground break-words">
                        {d.blood_group || "—"} · {d.phone}
                        {d.gender
                          ? ` · ${d.gender === "male" ? (lang === "bn" ? "পুরুষ" : "Male") : lang === "bn" ? "মহিলা" : "Female"}`
                          : ""}
                      </p>
                    </div>
                  </label>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => void send()}
              disabled={!selected.size || busy}
              className="w-full rounded-xl bg-primary text-primary-foreground text-sm font-semibold py-3 disabled:opacity-50"
            >
              {busy
                ? t("saving")
                : lang === "bn"
                  ? "রিকোয়েস্ট সেভ করে SMS খুলুন"
                  : "Save request & open SMS"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
