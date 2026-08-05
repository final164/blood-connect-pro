import { useEffect, useMemo, useState } from "react";
import { ClipboardList, X, Minus, Plus } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import { getProfile } from "@/lib/api";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import { HospitalTypeahead } from "@/components/hospital/HospitalTypeahead";
import type { District, Hospital } from "@/lib/api";
import { ensureCommunityBloodRequest } from "@/components/community/CommunityContactGateSheet";
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
  type RequestFormOptions,
} from "@/lib/request-form-options";
import {
  DEFAULT_MESSAGING_SETTINGS,
  fetchMessagingSettings,
} from "@/lib/messaging-settings";
import {
  clearCommunityRequestDraft,
  communityRequestDraftFilled,
  communityRequestDraftSummary,
  loadCommunityRequestDraft,
  saveCommunityRequestDraft,
  type CommunityRequestDraft,
} from "@/lib/community-request-draft";
import { toast } from "sonner";

const field =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70";

function emptyForm(blood: string = "O+") {
  return {
    patient_name: "",
    blood_group: (blood as (typeof BLOOD_GROUPS)[number]) || "O+",
    bags_needed: 1,
    needed_by: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
    urgency: "normal" as "normal" | "urgent" | "critical",
    notes: "",
    contact_phone: "",
    whatsapp_phone: "",
  };
}

/** Button like Send SMS — opens full request form to fill & save for icon autofill. */
export function CommunitySavedRequestDropdown({
  defaultDistrict,
  defaultUpazila,
  draft,
  onDraftChange,
}: {
  defaultDistrict: District | null;
  defaultUpazila?: string;
  draft: CommunityRequestDraft | null;
  onDraftChange: (d: CommunityRequestDraft | null) => void;
}) {
  const { lang } = useI18n();
  const [sheetOpen, setSheetOpen] = useState(false);
  const filled = communityRequestDraftFilled(draft);

  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className="w-full flex items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 bg-primary/5 px-3 py-2.5 text-xs font-semibold text-primary hover:bg-primary/10 transition"
      >
        <ClipboardList className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">
          {filled && draft
            ? lang === "bn"
              ? `Save request · ${communityRequestDraftSummary(draft, lang)}`
              : `Save request · ${communityRequestDraftSummary(draft, lang)}`
            : lang === "bn"
              ? "Save request (ঐচ্ছিক)"
              : "Save request (optional)"}
        </span>
      </button>

      <CommunityRequestDraftSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        defaultDistrict={defaultDistrict}
        defaultUpazila={defaultUpazila ?? ""}
        draft={draft}
        onSaved={(d) => {
          onDraftChange(d);
          setSheetOpen(false);
        }}
        onCleared={() => {
          onDraftChange(null);
          setSheetOpen(false);
        }}
      />
    </>
  );
}

function CommunityRequestDraftSheet({
  open,
  onClose,
  defaultDistrict,
  defaultUpazila,
  draft,
  onSaved,
  onCleared,
}: {
  open: boolean;
  onClose: () => void;
  defaultDistrict: District | null;
  defaultUpazila: string;
  draft: CommunityRequestDraft | null;
  onSaved: (d: CommunityRequestDraft) => void;
  onCleared: () => void;
}) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [opts, setOpts] = useState<RequestFormOptions>(DEFAULT_REQUEST_FORM_OPTIONS);
  const [district, setDistrict] = useState<District | null>(defaultDistrict);
  const [upazila, setUpazila] = useState(defaultUpazila);
  const [hospital, setHospital] = useState<Hospital | null>(null);
  const [categories, setCategories] = useState<NeedReasonCategory[]>([]);
  const [reasonDisplayLang, setReasonDisplayLang] = useState<"bn" | "en">(lang);
  const [reasonKey, setReasonKey] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [setDateTime, setSetDateTime] = useState(true);
  const [form, setForm] = useState(emptyForm());
  const [postOnSave, setPostOnSave] = useState(
    DEFAULT_MESSAGING_SETTINGS.community_save_posts_to_feed,
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const existing = draft ?? (user?.id ? loadCommunityRequestDraft(user.id) : null);
    if (existing && communityRequestDraftFilled(existing)) {
      setDistrict(existing.district ?? defaultDistrict);
      setUpazila(existing.upazila || defaultUpazila);
      setHospital(existing.hospital);
      setReasonKey(existing.reasonKey);
      setCustomReason(existing.customReason);
      setSetDateTime(existing.setDateTime);
      setForm({
        patient_name: existing.patient_name,
        blood_group: (existing.blood_group as (typeof BLOOD_GROUPS)[number]) || "O+",
        bags_needed: existing.bags_needed,
        needed_by: existing.needed_by,
        urgency: existing.urgency,
        notes: existing.notes,
        contact_phone: existing.contact_phone || "",
        whatsapp_phone: existing.whatsapp_phone || "",
      });
    } else {
      setDistrict(defaultDistrict);
      setUpazila(defaultUpazila);
      setHospital(null);
      setReasonKey("");
      setCustomReason("");
      setSetDateTime(true);
      setForm(emptyForm());
      if (user?.id) {
        void getProfile(user.id).then((p) => {
          const phone = (p?.phone as string | null)?.trim() || "";
          if (phone) {
            setForm((f) => ({
              ...f,
              contact_phone: f.contact_phone || phone,
              whatsapp_phone: f.whatsapp_phone || phone,
            }));
          }
        });
      }
    }
    void fetchRequestFormOptions().then(setOpts);
    void fetchMessagingSettings().then((m) => setPostOnSave(m.community_save_posts_to_feed));
    void fetchNeedReasonCatalog().then((c: NeedReasonCatalog) => {
      setCategories(activeNeedReasons(c));
      setReasonDisplayLang(resolveNeedReasonLang(c.display_lang, lang));
    });
  }, [open, defaultDistrict, defaultUpazila, lang, draft, user?.id]);

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

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.id) {
      return toast.error(lang === "bn" ? "লগইন প্রয়োজন" : "Login required");
    }
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
    if (req("contact_phone") && !form.contact_phone.trim()) {
      return toast.error(lang === "bn" ? "যোগাযোগ নম্বর দিন" : "Enter contact number");
    }
    if (req("whatsapp") && !form.whatsapp_phone.trim()) {
      return toast.error(lang === "bn" ? "WhatsApp নম্বর দিন" : "Enter WhatsApp number");
    }

    const draftInput = {
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
      contact_phone: form.contact_phone.trim(),
      whatsapp_phone: form.whatsapp_phone.trim(),
      feed_request_id: draft?.feed_request_id ?? null,
      district,
      hospital,
    };

    if (postOnSave) {
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
        notes: form.notes.trim() || null,
        need_reason_key: reasonKey,
        need_reason_label: reasonLabel,
        contact_phone: form.contact_phone.trim() || null,
        whatsapp_phone: form.whatsapp_phone.trim() || null,
        channel: "saved",
        existingRequestId: draft?.feed_request_id,
      });
      setBusy(false);

      if (error) {
        const saved = saveCommunityRequestDraft(user.id, draftInput);
        toast.error(
          lang === "bn"
            ? `ড্রাফট সেভ হয়েছে, কিন্তু পোস্ট ব্যর্থ: ${error.message}`
            : `Draft saved, but post failed: ${error.message}`,
        );
        onSaved(saved);
        return;
      }

      const saved = saveCommunityRequestDraft(user.id, {
        ...draftInput,
        feed_request_id: id || draft?.feed_request_id || null,
      });
      toast.success(
        created
          ? lang === "bn"
            ? "সেভ হয়েছে এবং ফিডে পোস্ট হয়েছে"
            : "Saved and posted to the feed"
          : lang === "bn"
            ? "ড্রাফট আপডেট হয়েছে — আগের পোস্টই আছে (ডুপ্লিকেট নয়)"
            : "Draft updated — same feed post kept (no duplicate)",
      );
      onSaved(saved);
      return;
    }

    const saved = saveCommunityRequestDraft(user.id, draftInput);
    toast.success(
      lang === "bn"
        ? "রিকোয়েস্ট সেভ হয়েছে — আইকনে ক্লিক করলে অটোফিল হবে"
        : "Request saved — icons will autofill",
    );
    onSaved(saved);
  }

  function clear() {
    if (!user?.id) return;
    clearCommunityRequestDraft(user.id);
    toast.success(lang === "bn" ? "মুছে ফেলা হয়েছে" : "Cleared");
    onCleared();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="fixed inset-x-0 top-0 z-10 mx-auto w-full sm:max-w-lg md:max-w-2xl max-h-[92dvh] flex flex-col overflow-hidden rounded-b-2xl border border-t-0 bg-background shadow-xl animate-top-sheet-down safe-top">
        <div className="flex items-center justify-between gap-2 border-b bg-background px-4 py-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate">
              {lang === "bn" ? "Save request (ঐচ্ছিক)" : "Save request (optional)"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {postOnSave
                ? lang === "bn"
                  ? "সেভ করলে ড্রাফট থাকবে এবং ফিডেও পোস্ট হবে"
                  : "Saving keeps a draft and also posts to the feed"
                : lang === "bn"
                  ? "সব তথ্য পূরণ করে সেভ করুন — পরে আইকনে ক্লিক করলে অটোফিল হবে"
                  : "Fill all fields and save — icons will autofill later"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-xl grid place-items-center text-muted-foreground hover:bg-muted shrink-0"
            aria-label={t("cancel")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => void save(e)} className="p-4 space-y-3 pb-8 overflow-y-auto min-h-0 flex-1">
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
          <UpazilaSelect district={district} value={upazila} onChange={setUpazila} />
          <HospitalTypeahead
            key={district?.id ?? "d"}
            value={hospital}
            onChange={(h) => {
              setHospital(h);
              setUpazila(h?.upazila?.trim() ?? "");
            }}
            districtId={district?.id}
            districtSlug={district?.slug}
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
                        ? "bg-urgent text-white border-transparent"
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

          <div className="flex gap-2">
            {communityRequestDraftFilled(draft) && (
              <button
                type="button"
                onClick={clear}
                className="rounded-xl border px-4 py-3.5 text-sm font-semibold text-destructive"
              >
                {lang === "bn" ? "মুছুন" : "Clear"}
              </button>
            )}
            <button
              type="submit"
              disabled={busy}
              className="flex-1 rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy
                ? "…"
                : lang === "bn"
                  ? postOnSave
                    ? "সেভ ও পোস্ট"
                    : "সেভ করুন"
                  : postOnSave
                    ? "Save & post"
                    : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
