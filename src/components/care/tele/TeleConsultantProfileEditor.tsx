import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { fetchCareSpecialties, type CareSpecialty } from "@/lib/care-cms";
import {
  saveMyConsultantProfile,
  uploadDoctorPhoto,
  type TeleVideoDoctor,
} from "@/lib/tele-api";
import type { CareDoctorProfile } from "@/lib/care-doctor-auth";
import { Link } from "@tanstack/react-router";

const field =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-500/30";

function tagsToText(tags: string[] | null | undefined) {
  return (tags ?? []).filter(Boolean).join(", ");
}

function textToTags(raw: string) {
  return raw
    .split(/[,،\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

type Props = {
  doctorId: string;
  bn: boolean;
  careProfile: CareDoctorProfile | null;
  teleProfile: TeleVideoDoctor | null;
  onSaved?: (tele: TeleVideoDoctor | null) => void;
  compact?: boolean;
};

export function TeleConsultantProfileEditor({
  doctorId,
  bn,
  careProfile,
  teleProfile,
  onSaved,
  compact,
}: Props) {
  const photoRef = useRef<HTMLInputElement>(null);
  const [specialties, setSpecialties] = useState<CareSpecialty[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [fullNameBn, setFullNameBn] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [bmdc, setBmdc] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [aboutBn, setAboutBn] = useState("");
  const [aboutEn, setAboutEn] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [workplaceBn, setWorkplaceBn] = useState("");
  const [workplaceEn, setWorkplaceEn] = useState("");
  const [heroUrl, setHeroUrl] = useState("");
  const [fee, setFee] = useState("");
  const [followUpFee, setFollowUpFee] = useState("");
  const [followUpDays, setFollowUpDays] = useState("7");
  const [avgMinutes, setAvgMinutes] = useState("15");
  const [tagsBn, setTagsBn] = useState("");
  const [tagsEn, setTagsEn] = useState("");
  const [noticeBn, setNoticeBn] = useState("");
  const [noticeEn, setNoticeEn] = useState("");
  const [instructionsBn, setInstructionsBn] = useState("");
  const [instructionsEn, setInstructionsEn] = useState("");
  const [helpline, setHelpline] = useState("");
  const [chamberBn, setChamberBn] = useState("");
  const [chamberEn, setChamberEn] = useState("");
  const [doctorCode, setDoctorCode] = useState("");
  const [instantEnabled, setInstantEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [schedulePublic, setSchedulePublic] = useState(true);

  useEffect(() => {
    void fetchCareSpecialties(true).then(setSpecialties).catch(() => undefined);
  }, []);

  useEffect(() => {
    setFullName(teleProfile?.full_name || careProfile?.full_name || "");
    setFullNameBn(teleProfile?.full_name_bn || careProfile?.full_name || "");
    setQualifications(teleProfile?.qualifications || careProfile?.qualifications || "");
    setPhotoUrl(teleProfile?.photo_url || careProfile?.photo_url || "");
    setBmdc(teleProfile?.bmdc_no || careProfile?.bmdc_no || "");
    setSpecialtyId(teleProfile?.specialty_id || careProfile?.specialty_id || "");
    setPhone(careProfile?.phone || "");
    setEmail(careProfile?.email || "");
    setAboutBn(teleProfile?.about_bn || careProfile?.bio || "");
    setAboutEn(teleProfile?.about_en || "");
    setExperienceYears(
      teleProfile?.experience_years != null ? String(teleProfile.experience_years) : "",
    );
    setWorkplaceBn(teleProfile?.workplace_bn || "");
    setWorkplaceEn(teleProfile?.workplace_en || "");
    setHeroUrl(teleProfile?.hero_image_url || "");
    setFee(teleProfile?.fee_amount != null ? String(teleProfile.fee_amount) : "");
    setFollowUpFee(teleProfile?.follow_up_fee != null ? String(teleProfile.follow_up_fee) : "");
    setFollowUpDays(String(teleProfile?.follow_up_days ?? 7));
    setAvgMinutes(String(teleProfile?.avg_consult_minutes ?? teleProfile?.slot_minutes ?? 15));
    setTagsBn(tagsToText(teleProfile?.specialty_tags_bn));
    setTagsEn(tagsToText(teleProfile?.specialty_tags_en));
    setNoticeBn(teleProfile?.notice_bn || "");
    setNoticeEn(teleProfile?.notice_en || "");
    setInstructionsBn(teleProfile?.instructions_bn || "");
    setInstructionsEn(teleProfile?.instructions_en || "");
    setHelpline(teleProfile?.helpline || "");
    setChamberBn(teleProfile?.chamber_address_bn || "");
    setChamberEn(teleProfile?.chamber_address_en || "");
    setDoctorCode(teleProfile?.doctor_code || careProfile?.doctor_code || "");
    setInstantEnabled(teleProfile?.instant_enabled !== false);
    setVideoEnabled(teleProfile?.video_enabled !== false);
    setSchedulePublic(teleProfile?.schedule_public !== false);
  }, [careProfile, teleProfile]);

  async function onPhoto(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error(bn ? "শুধু ছবি আপলোড করুন" : "Upload an image file");
      return;
    }
    setUploading(true);
    try {
      const url = await uploadDoctorPhoto(file);
      setPhotoUrl(url);
      if (!heroUrl) setHeroUrl(url);
      toast.success(bn ? "ছবি আপলোড হয়েছে" : "Photo uploaded");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  async function save() {
    if (!fullName.trim()) {
      toast.error(bn ? "নাম আবশ্যক" : "Name is required");
      return;
    }
    setSaving(true);
    try {
      const tele = await saveMyConsultantProfile({
        doctorId,
        care: {
          full_name: fullName.trim(),
          full_name_bn: fullNameBn.trim() || null,
          qualifications: qualifications.trim() || null,
          photo_url: photoUrl.trim() || null,
          bmdc_no: bmdc.trim() || null,
          specialty_id: specialtyId || null,
          bio: aboutEn.trim() || null,
          bio_bn: aboutBn.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
        },
        tele: {
          about_bn: aboutBn.trim() || null,
          about_en: aboutEn.trim() || null,
          experience_years: experienceYears.trim() ? Number(experienceYears) : null,
          workplace_bn: workplaceBn.trim() || null,
          workplace_en: workplaceEn.trim() || null,
          hero_image_url: (heroUrl || photoUrl).trim() || null,
          fee_amount: fee.trim() ? Number(fee) : null,
          follow_up_fee: followUpFee.trim() ? Number(followUpFee) : null,
          follow_up_days: followUpDays.trim() ? Number(followUpDays) : 7,
          avg_consult_minutes: avgMinutes.trim() ? Number(avgMinutes) : 15,
          specialty_tags_bn: textToTags(tagsBn),
          specialty_tags_en: textToTags(tagsEn),
          notice_bn: noticeBn.trim() || null,
          notice_en: noticeEn.trim() || null,
          instructions_bn: instructionsBn.trim() || null,
          instructions_en: instructionsEn.trim() || null,
          helpline: helpline.trim() || null,
          chamber_address_bn: chamberBn.trim() || null,
          chamber_address_en: chamberEn.trim() || null,
          doctor_code: doctorCode.trim() || null,
          instant_enabled: instantEnabled,
          video_enabled: videoEnabled,
          schedule_public: schedulePublic,
        },
      });
      toast.success(bn ? "প্রোফাইল সংরক্ষিত" : "Profile saved");
      onSaved?.(tele);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const previewImg = heroUrl || photoUrl;
  const rating =
    teleProfile && teleProfile.rating_count > 0
      ? `${teleProfile.rating_avg.toFixed(1)} (${teleProfile.rating_count})`
      : bn
        ? "এখনো নেই"
        : "None yet";

  return (
    <div className={compact ? "space-y-4" : "space-y-5"}>
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold">{bn ? "পাবলিক প্রোফাইল" : "Public profile"}</h2>
            <p className="text-xs text-muted-foreground">
              {bn
                ? "রোগীরা ভিডিও ডাক্তার পেজে যা দেখবে — এখান থেকে এডিট করুন"
                : "What patients see on your video doctor page — edit here"}
            </p>
          </div>
          {teleProfile && (
            <Link
              to="/care/video/doctor/$id"
              params={{ id: doctorId }}
              className="shrink-0 text-[11px] font-semibold text-sky-700"
            >
              {bn ? "প্রিভিউ →" : "Preview →"}
            </Link>
          )}
        </div>

        <div className="flex gap-3 items-start">
          <div className="relative shrink-0">
            {previewImg ? (
              <img
                src={previewImg}
                alt=""
                className="h-20 w-20 rounded-xl object-cover border bg-muted"
              />
            ) : (
              <div className="h-20 w-20 rounded-xl border bg-muted grid place-items-center text-[10px] text-muted-foreground">
                {bn ? "ছবি নেই" : "No photo"}
              </div>
            )}
            <button
              type="button"
              disabled={uploading}
              onClick={() => photoRef.current?.click()}
              className="absolute -bottom-1 -right-1 rounded-lg border bg-card p-1.5 shadow-sm disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onPhoto(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <input
              className={field}
              value={fullNameBn}
              onChange={(e) => setFullNameBn(e.target.value)}
              placeholder={bn ? "নাম (বাংলা)" : "Name (Bangla)"}
            />
            <input
              className={field}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={bn ? "নাম (ইংরেজি)" : "Name (English)"}
            />
            <input
              className={field}
              value={qualifications}
              onChange={(e) => setQualifications(e.target.value)}
              placeholder="MBBS, FCPS (Medicine)"
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "বিশেষত্ব" : "Specialty"}
            </span>
            <select
              className={field}
              value={specialtyId}
              onChange={(e) => setSpecialtyId(e.target.value)}
            >
              <option value="">{bn ? "নির্বাচন করুন" : "Select"}</option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {bn ? s.name_bn : s.name_en}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">BMDC</span>
            <input className={field} value={bmdc} onChange={(e) => setBmdc(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "অভিজ্ঞতা (বছর)" : "Experience (years)"}
            </span>
            <input
              className={field}
              type="number"
              min={0}
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "ডাক্তার কোড" : "Doctor code"}
            </span>
            <input
              className={field}
              value={doctorCode}
              onChange={(e) => setDoctorCode(e.target.value)}
              placeholder="TD001"
            />
          </label>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "কর্মরত (বাংলা)" : "Workplace (Bangla)"}
            </span>
            <input
              className={field}
              value={workplaceBn}
              onChange={(e) => setWorkplaceBn(e.target.value)}
              placeholder="ঢাকা মেডিকেল কলেজ হাসপাতাল"
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "কর্মরত (ইংরেজি)" : "Workplace (English)"}
            </span>
            <input
              className={field}
              value={workplaceEn}
              onChange={(e) => setWorkplaceEn(e.target.value)}
            />
          </label>
        </div>

        <div className="rounded-xl border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>
            {bn ? "রেটিং" : "Rating"}: {rating}
          </span>
          <span>
            {bn ? "রোগী" : "Patients"}: {teleProfile?.patients_attended ?? 0}
          </span>
          <span>
            {bn ? "যোগদান" : "Joined"}:{" "}
            {teleProfile?.joined_at
              ? new Date(teleProfile.joined_at).toLocaleDateString(bn ? "bn-BD" : "en-GB")
              : "—"}
          </span>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-bold">{bn ? "ফি ও সেটিংস" : "Fees & settings"}</h3>
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "কনসালটেশন ফি (৳)" : "Consultation fee (৳)"}
            </span>
            <input
              className={field}
              type="number"
              min={0}
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "ফলো-আপ ফি (৳)" : "Follow-up fee (৳)"}
            </span>
            <input
              className={field}
              type="number"
              min={0}
              value={followUpFee}
              onChange={(e) => setFollowUpFee(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "ফলো-আপ দিন" : "Follow-up days"}
            </span>
            <input
              className={field}
              type="number"
              min={1}
              value={followUpDays}
              onChange={(e) => setFollowUpDays(e.target.value)}
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "গড় সময় (মিনিট)" : "Avg time (min)"}
            </span>
            <input
              className={field}
              type="number"
              min={5}
              value={avgMinutes}
              onChange={(e) => setAvgMinutes(e.target.value)}
            />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "হেল্পলাইন" : "Helpline"}
            </span>
            <input
              className={field}
              value={helpline}
              onChange={(e) => setHelpline(e.target.value)}
              placeholder="09612…"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-4 text-xs">
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={videoEnabled}
              onChange={(e) => setVideoEnabled(e.target.checked)}
            />
            {bn ? "ভিডিও প্রোফাইল সক্রিয়" : "Video profile enabled"}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={instantEnabled}
              onChange={(e) => setInstantEnabled(e.target.checked)}
            />
            {bn ? "তাৎক্ষণিক কনসালট" : "Instant consult"}
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={schedulePublic}
              onChange={(e) => setSchedulePublic(e.target.checked)}
            />
            {bn ? "শিডিউল পাবলিক" : "Public schedule"}
          </label>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-bold">{bn ? "ডাক্তার সম্পর্কে" : "About doctor"}</h3>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">বাংলা</span>
          <textarea
            className={field}
            rows={4}
            value={aboutBn}
            onChange={(e) => setAboutBn(e.target.value)}
            placeholder="অভিজ্ঞতা, সেবা ও বিশেষত্ব…"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">English</span>
          <textarea
            className={field}
            rows={4}
            value={aboutEn}
            onChange={(e) => setAboutEn(e.target.value)}
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "ট্যাগ (বাংলা, কমা দিয়ে)" : "Tags (Bangla, comma)"}
            </span>
            <input
              className={field}
              value={tagsBn}
              onChange={(e) => setTagsBn(e.target.value)}
              placeholder="মেডিসিন, ডায়াবেটিস"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "ট্যাগ (ইংরেজি)" : "Tags (English)"}
            </span>
            <input
              className={field}
              value={tagsEn}
              onChange={(e) => setTagsEn(e.target.value)}
              placeholder="medicine, diabetes"
            />
          </label>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-bold">{bn ? "নোটিশ ও নির্দেশনা" : "Notice & instructions"}</h3>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">
            {bn ? "গুরুত্বপূর্ণ নোটিশ (বাংলা)" : "Important notice (Bangla)"}
          </span>
          <textarea
            className={field}
            rows={2}
            value={noticeBn}
            onChange={(e) => setNoticeBn(e.target.value)}
            placeholder="এই সেবা জরুরি…"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">
            {bn ? "নোটিশ (ইংরেজি)" : "Notice (English)"}
          </span>
          <textarea
            className={field}
            rows={2}
            value={noticeEn}
            onChange={(e) => setNoticeEn(e.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">
            {bn ? "ভিডিও কল নির্দেশনা (বাংলা)" : "Video call instructions (Bangla)"}
          </span>
          <textarea
            className={field}
            rows={3}
            value={instructionsBn}
            onChange={(e) => setInstructionsBn(e.target.value)}
            placeholder={"• শান্ত পরিবেশ\n• হেডফোন ব্যবহার\n• রিপোর্ট প্রস্তুত রাখুন"}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold text-muted-foreground">
            {bn ? "নির্দেশনা (ইংরেজি)" : "Instructions (English)"}
          </span>
          <textarea
            className={field}
            rows={3}
            value={instructionsEn}
            onChange={(e) => setInstructionsEn(e.target.value)}
          />
        </label>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <h3 className="text-sm font-bold">{bn ? "যোগাযোগ ও চেম্বার" : "Contact & chamber"}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "মোবাইল" : "Mobile"}
            </span>
            <input className={field} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="space-y-1">
            <span className="text-[11px] font-semibold text-muted-foreground">Email</span>
            <input className={field} value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "চেম্বার ঠিকানা (বাংলা)" : "Chamber address (Bangla)"}
            </span>
            <input className={field} value={chamberBn} onChange={(e) => setChamberBn(e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "চেম্বার ঠিকানা (ইংরেজি)" : "Chamber address (English)"}
            </span>
            <input className={field} value={chamberEn} onChange={(e) => setChamberEn(e.target.value)} />
          </label>
          <label className="space-y-1 sm:col-span-2">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {bn ? "হিরো/কভার ছবি URL (ঐচ্ছিক)" : "Hero/cover image URL (optional)"}
            </span>
            <input
              className={field}
              value={heroUrl}
              onChange={(e) => setHeroUrl(e.target.value)}
              placeholder={bn ? "খালি রাখলে প্রোফাইল ছবি ব্যবহার হবে" : "Falls back to profile photo"}
            />
          </label>
        </div>
      </div>

      <button
        type="button"
        disabled={saving}
        onClick={() => void save()}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 sm:w-auto"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {bn ? "প্রোফাইল সেভ করুন" : "Save profile"}
      </button>
    </div>
  );
}
