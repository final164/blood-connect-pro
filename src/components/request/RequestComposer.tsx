import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Minus, Plus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { BLOOD_GROUPS } from "@/lib/format";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import { HospitalTypeahead } from "@/components/hospital/HospitalTypeahead";
import type { District, Hospital } from "@/lib/api";
import { getProfile } from "@/lib/api";
import { clampPhoneDigits } from "@/lib/phone-auth";
import {
  DEFAULT_REQUEST_FORM_OPTIONS,
  fetchRequestFormOptions,
  type RequestFormOptions,
} from "@/lib/request-form-options";
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
  withPostTextStyle,
  type PostTextStyleId,
} from "@/lib/post-text-styles";
import { uploadAppImage, fetchGoogleDriveSettings, canPasteImageUrl, canUploadImageFile, normalizePastedImageUrl, type GoogleDriveSettings, DEFAULT_GOOGLE_DRIVE_SETTINGS } from "@/lib/google-drive";
import { resolveCarouselImageUrl } from "@/lib/feed-carousel";
import { saveCommunityRequestDraft } from "@/lib/community-request-draft";
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
  const [textStyleId, setTextStyleId] = useState<PostTextStyleId>("none");
  const [setDateTime, setSetDateTime] = useState(true);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageLinkDraft, setImageLinkDraft] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [driveCfg, setDriveCfg] = useState<GoogleDriveSettings>(DEFAULT_GOOGLE_DRIVE_SETTINGS);
  const imageRef = useRef<HTMLInputElement>(null);
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
    getProfile(user.id)
      .then((p) => {
        if (!p?.district_id) return;
        void supabase
          .from("districts")
          .select("id,name_bn,name_en,slug,is_active,sort_order")
          .eq("id", p.district_id)
          .maybeSingle()
          .then(({ data }) => {
            if (data) setDistrict(data as District);
          });
      })
      .catch(() => {});
  }, [user?.id, defaultDistrict]);
  useEffect(() => {
    fetchRequestFormOptions().then(setOpts);
    fetchNeedReasonCatalog().then((c: NeedReasonCatalog) => {
      setCategories(activeNeedReasons(c));
      setReasonDisplayLang(resolveNeedReasonLang(c.display_lang, lang));
    });
    fetchGoogleDriveSettings().then(setDriveCfg);
  }, [lang]);

  const isCustomHospital = !!hospital?.id.startsWith("custom:");

  const selectedCategory = useMemo(
    () => categories.find((c) => c.id === reasonKey) ?? null,
    [categories, reasonKey],
  );

  function setUrgency(u: "normal" | "urgent" | "critical") {
    setForm((prev) => ({ ...prev, urgency: u }));
    // Normal: date/time on by default. Urgent/Critical: hidden unless toggled.
    setSetDateTime(u === "normal");
  }

  function req(key: keyof RequestFormOptions) {
    return !opts[key];
  }

  async function onPickImage(file: File | undefined) {
    if (!file) return;
    if (!driveCfg.allow_post_image || !canUploadImageFile(driveCfg)) {
      return toast.error(lang === "bn" ? "ফাইল আপলোড বন্ধ আছে" : "File upload is disabled");
    }
    if (!file.type.startsWith("image/")) {
      return toast.error(lang === "bn" ? "শুধু ইমেজ ফাইল" : "Images only");
    }
    if (file.size > 8 * 1024 * 1024) {
      return toast.error(lang === "bn" ? "সর্বোচ্চ ৮ MB" : "Max 8 MB");
    }
    setImageBusy(true);
    try {
      const result = await uploadAppImage(file, "request", async (f) => {
        const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
        const path = `requests/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from("feed-carousel").upload(path, f, {
          cacheControl: "3600",
          upsert: false,
          contentType: f.type || "image/jpeg",
        });
        if (error) return { url: null, error: new Error(error.message) };
        const { data } = supabase.storage.from("feed-carousel").getPublicUrl(path);
        return { url: data.publicUrl, error: null };
      });
      if (!result.url) throw result.error ?? new Error("Upload failed");
      setImageUrl(resolveCarouselImageUrl(result.url));
      setImageLinkDraft("");
      toast.success(
        lang === "bn"
          ? result.via === "drive"
            ? "Drive-এ আপলোড হয়েছে"
            : "ইমেজ আপলোড হয়েছে"
          : result.via === "drive"
            ? "Uploaded to Drive"
            : "Image uploaded",
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setImageBusy(false);
      if (imageRef.current) imageRef.current.value = "";
    }
  }

  function applyImageLink() {
    if (!driveCfg.allow_post_image || !canPasteImageUrl(driveCfg)) return;
    const raw = imageLinkDraft.trim();
    if (!raw) {
      return toast.error(lang === "bn" ? "Drive/ইমেজ লিংক দিন" : "Enter a Drive/image link");
    }
    const url = normalizePastedImageUrl(raw);
    if (!url) {
      return toast.error(lang === "bn" ? "সঠিক লিংক দিন" : "Enter a valid link");
    }
    setImageUrl(url);
    toast.success(lang === "bn" ? "ইমেজ লিংক যোগ হয়েছে" : "Image link added");
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
      notes: withPostTextStyle(form.notes, textStyleId) || null,
      need_reason_key: reasonKey,
      need_reason_label: reasonLabel,
    };
    if (imageUrl) payload.image_url = imageUrl;
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
    if (error && /image_url/i.test(error.message)) {
      delete payload.image_url;
      ({ data: created, error } = await tryInsert(payload));
      if (!error) {
        toast.message(
          lang === "bn"
            ? "পোস্ট হয়েছে — ইমেজ কলাম নেই, scripts/google-drive-media.sql চালান"
            : "Posted without image — run scripts/google-drive-media.sql",
        );
      }
    }
    setBusy(false);
    if (error) return toast.error(error.message);
    const newId = (created as { id?: string } | null)?.id;
    if (!newId) return toast.error(lang === "bn" ? "পোস্ট তৈরি হয়েছে কিন্তু আইডি পাওয়া যায়নি" : "Posted but id missing");

    saveCommunityRequestDraft(user.id, {
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
      contact_phone: form.contact_phone.trim(),
      whatsapp_phone: form.whatsapp_phone.trim(),
      feed_request_id: newId,
      district,
      hospital,
    });

    toast.success(
      lang === "bn"
        ? "ফিডে পোস্ট হয়েছে · Save request-এও সেভ আছে"
        : "Posted to feed · also saved as Save request",
    );
    setHospital(null);
    setUpazila("");
    setReasonKey("");
    setCustomReason("");
    setTextStyleId("none");
    setSetDateTime(true);
    setImageUrl(null);
    setImageLinkDraft("");
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

      <div className={`grid gap-2 ${isCustomHospital ? "grid-cols-2" : "grid-cols-1"}`}>
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
        {isCustomHospital && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{t("upazila")}</label>
            <UpazilaSelect
              district={district}
              value={upazila}
              onChange={(v) => {
                setUpazila(v);
                setHospital((h) => (h ? { ...h, upazila: v || null } : h));
              }}
            />
          </div>
        )}
      </div>

      <HospitalTypeahead
        key={district?.id ?? "d"}
        value={hospital}
        onChange={(h) => {
          setHospital(h);
          setUpazila(h?.upazila?.trim() ?? "");
        }}
        districtId={district?.id}
        districtSlug={district?.slug}
        upazila={isCustomHospital ? upazila || undefined : undefined}
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
        onChange={(e) => setForm({ ...form, contact_phone: clampPhoneDigits(e.target.value) })}
        required={req("contact_phone")}
        inputMode="tel"
        maxLength={11}
      />

      <input
        className={field}
        placeholder={
          opts.whatsapp
            ? ph("WhatsApp নম্বর (ঐচ্ছিক)", "WhatsApp number (optional)")
            : ph("WhatsApp নম্বর", "WhatsApp number")
        }
        value={form.whatsapp_phone}
        onChange={(e) => setForm({ ...form, whatsapp_phone: clampPhoneDigits(e.target.value) })}
        required={req("whatsapp")}
        inputMode="tel"
        maxLength={11}
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

      <RequestNotesFields
        reasonKey={reasonKey}
        customReason={customReason}
        notes={form.notes}
        onReasonKeyChange={setReasonKey}
        onCustomReasonChange={setCustomReason}
        onNotesChange={(text) => setForm((prev) => ({ ...prev, notes: text }))}
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

      {driveCfg.allow_post_image && (
        <div className="space-y-2">
          <input
            ref={imageRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => void onPickImage(e.target.files?.[0])}
          />
          {imageUrl ? (
            <div className="relative overflow-hidden rounded-xl border">
              <img src={imageUrl} alt="" className="max-h-48 w-full object-cover" />
              <button
                type="button"
                onClick={() => {
                  setImageUrl(null);
                  setImageLinkDraft("");
                }}
                className="absolute top-2 right-2 h-8 w-8 rounded-full bg-black/55 text-white grid place-items-center"
                aria-label={t("cancel")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              {canPasteImageUrl(driveCfg) && (
                <div className="flex gap-2">
                  <input
                    className={field}
                    value={imageLinkDraft}
                    onChange={(e) => setImageLinkDraft(e.target.value)}
                    placeholder={ph(
                      "Google Drive / ইমেজ লিংক পেস্ট করুন",
                      "Paste Google Drive / image link",
                    )}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={applyImageLink}
                    className="shrink-0 rounded-xl border px-3 text-xs font-semibold"
                  >
                    {lang === "bn" ? "যোগ" : "Add"}
                  </button>
                </div>
              )}
              {canUploadImageFile(driveCfg) && (
                <button
                  type="button"
                  disabled={imageBusy || busy}
                  onClick={() => imageRef.current?.click()}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 py-3 text-xs font-medium text-muted-foreground hover:bg-muted/50 disabled:opacity-50"
                >
                  <ImagePlus className="h-4 w-4" />
                  {imageBusy
                    ? lang === "bn"
                      ? "আপলোড হচ্ছে…"
                      : "Uploading…"
                    : lang === "bn"
                      ? canPasteImageUrl(driveCfg)
                        ? "অথবা ফাইল আপলোড করুন"
                        : "ইমেজ আপলোড করুন (ঐচ্ছিক)"
                      : canPasteImageUrl(driveCfg)
                        ? "Or upload a file"
                        : "Upload image (optional)"}
                </button>
              )}
            </>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || imageBusy}
        className="w-full rounded-xl bg-primary py-3.5 text-sm font-semibold text-primary-foreground disabled:opacity-50 shadow-lg shadow-primary/25 hover:brightness-105 transition"
      >
        {busy ? t("saving") : t("postToFeed")}
      </button>
    </form>
  );
}

const field =
  "w-full rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/70";
