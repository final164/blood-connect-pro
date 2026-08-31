import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { UpazilaSelect } from "@/components/district/UpazilaSelect";
import type { District } from "@/lib/api";
import { fetchDistricts } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { formatCareMoney } from "@/lib/care-invoice";
import {
  clearAiSerialResume,
  loadAiSerialResume,
  rankDoctorsForSerial,
  saveAiSerialResume,
  type RankedSerialDoctor,
  type SerialRankMode,
} from "@/lib/care-ai-serial";
import { cn } from "@/lib/utils";

export type SerialBookSpecialty = {
  specialtyId: string;
  nameBn: string;
  nameEn: string;
  reason?: string | null;
};

type Step = "location" | "prefs" | "pick";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  specialty: SerialBookSpecialty | null;
  /** UI copy overrides from gemini settings */
  title?: string;
  bookCta?: string;
};

export function CareAiSerialBookSheet({
  open,
  onOpenChange,
  specialty,
  title,
  bookCta,
}: Props) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("location");
  const [district, setDistrict] = useState<District | null>(null);
  const [upazila, setUpazila] = useState("");
  const [mode, setMode] = useState<SerialRankMode>("best_value");
  const [ranked, setRanked] = useState<RankedSerialDoctor[]>([]);
  const [loadingRank, setLoadingRank] = useState(false);

  const specialtyLabel = specialty
    ? bn
      ? specialty.nameBn || specialty.nameEn
      : specialty.nameEn || specialty.nameBn
    : "";

  // Resume after auth / return
  useEffect(() => {
    if (!open) return;
    const resume = loadAiSerialResume();
    if (!resume || !specialty || resume.specialtyId !== specialty.specialtyId) return;
    if (resume.mode) setMode(resume.mode);
    if (resume.upazila) setUpazila(resume.upazila);
    if (resume.districtId) {
      void fetchDistricts("").then((list) => {
        const d = list.find((x) => x.id === resume.districtId) ?? null;
        if (d) {
          setDistrict(d);
          setStep(resume.mode ? "prefs" : "location");
        }
      });
    }
  }, [open, specialty?.specialtyId]);

  useEffect(() => {
    if (!open) {
      setStep("location");
      setRanked([]);
    }
  }, [open]);

  async function runRank() {
    if (!specialty || !district?.id) return;
    if (specialty) {
      saveAiSerialResume({
        specialtyId: specialty.specialtyId,
        specialtyNameBn: specialty.nameBn,
        specialtyNameEn: specialty.nameEn,
        reason: specialty.reason,
        districtId: district.id,
        districtNameEn: district.name_en,
        districtNameBn: district.name_bn,
        upazila,
        mode,
      });
    }
    setLoadingRank(true);
    try {
      const rows = await rankDoctorsForSerial({
        specialtyId: specialty.specialtyId,
        districtId: district.id,
        upazila: upazila || undefined,
        mode,
      });
      setRanked(rows);
      setStep("pick");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoadingRank(false);
    }
  }

  const sheetTitle = title ?? (bn ? "AI সিরিয়াল বুকিং" : "AI serial booking");

  function goPrefs() {
    if (!district?.id) {
      toast.error(bn ? "জেলা নির্বাচন করুন" : "Select a district");
      return;
    }
    setStep("prefs");
  }

  function goToDoctorSerial(d: RankedSerialDoctor) {
    clearAiSerialResume();
    onOpenChange(false);
    void navigate({ to: "/care/doctor/$id", params: { id: d.doctorId } });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[94vh] overflow-y-auto rounded-t-2xl px-0 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="px-4 text-left space-y-1">
          <SheetTitle>{sheetTitle}</SheetTitle>
          <SheetDescription>
            {specialtyLabel
              ? bn
                ? `${specialtyLabel} — জেলায় র‍্যাঙ্ক করে ডাক্তার বাছুন; সিরিয়াল সেই ডাক্তারের পেজ থেকে বুক করুন।`
                : `${specialtyLabel} — pick a ranked doctor; book serial on their page.`
              : bn
                ? "স্পেশালিটি নির্বাচন করুন"
                : "Select a specialty"}
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 py-3 space-y-4">
          {specialty?.reason ? (
            <p className="text-xs text-muted-foreground rounded-xl border bg-muted/30 px-3 py-2">
              {specialty.reason}
            </p>
          ) : null}

          {step === "location" && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  {bn ? "জেলা *" : "District *"}
                </label>
                <DistrictTypeahead
                  value={district}
                  onChange={(d) => {
                    setDistrict(d);
                    setUpazila("");
                  }}
                  required
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">
                  {bn ? "উপজেলা (ঐচ্ছিক)" : "Upazila (optional)"}
                </label>
                <UpazilaSelect district={district} value={upazila} onChange={setUpazila} />
              </div>
              <button
                type="button"
                disabled={!district?.id}
                onClick={goPrefs}
                className="w-full rounded-xl bg-sky-600 text-white py-2.5 text-sm font-bold disabled:opacity-50"
              >
                {bn ? "এগিয়ে যান" : "Continue"}
              </button>
            </div>
          )}

          {step === "prefs" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold">
                {bn ? "কী ধরনের ডাক্তার চান?" : "What kind of doctor?"}
              </p>
              <div className="grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("best_value")}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left text-sm",
                    mode === "best_value"
                      ? "border-sky-500 bg-sky-50 ring-1 ring-sky-500/30"
                      : "bg-card",
                  )}
                >
                  <p className="font-bold">{bn ? "কম টাকায় অভিজ্ঞ" : "Best value (low fee)"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {bn
                      ? "সবচেয়ে কম ভিজিট ফি; অভিজ্ঞতা টাইব্রেকার"
                      : "Lowest visit fee; experience as tie-breaker"}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("experience_first")}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left text-sm",
                    mode === "experience_first"
                      ? "border-sky-500 bg-sky-50 ring-1 ring-sky-500/30"
                      : "bg-card",
                  )}
                >
                  <p className="font-bold">{bn ? "সবচেয়ে অভিজ্ঞ" : "Most experienced"}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {bn
                      ? "বেশি অভিজ্ঞতা প্রাধান্য; তারপর কম ফি"
                      : "Highest experience first; then lower fee"}
                  </p>
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep("location")}
                  className="flex-1 rounded-xl border py-2.5 text-sm font-semibold"
                >
                  {bn ? "পিছনে" : "Back"}
                </button>
                <button
                  type="button"
                  disabled={loadingRank}
                  onClick={() => void runRank()}
                  className="flex-1 rounded-xl bg-sky-600 text-white py-2.5 text-sm font-bold disabled:opacity-50"
                >
                  {loadingRank ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : bn ? (
                    "ডাক্তার দেখুন"
                  ) : (
                    "Show doctors"
                  )}
                </button>
              </div>
            </div>
          )}

          {step === "pick" && (
            <div className="space-y-3">
              {!ranked.length ? (
                <div className="rounded-xl border border-dashed px-3 py-8 text-center space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {bn
                      ? "এই জেলায় অ্যাপ-বুকযোগ্য ডাক্তার পাওয়া যায়নি। অন্য জেলা চেষ্টা করুন বা ডাক্তার তালিকা থেকে বুক করুন।"
                      : "No app-bookable doctors in this district. Try another area or browse the doctor list."}
                  </p>
                  {specialty ? (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        void navigate({
                          to: "/care",
                          search: { tab: "doctors", specialty: specialty.specialtyId },
                        });
                      }}
                      className="rounded-lg bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold"
                    >
                      {bn ? "ডাক্তার তালিকা" : "Browse doctors"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    {bn
                      ? "ডাক্তার বেছে নিন — সিরিয়াল বুকিং পেজে যাবেন।"
                      : "Choose a doctor — opens their serial booking page."}
                  </p>
                  <ul className="space-y-2 max-h-[52vh] overflow-y-auto">
                    {ranked.map((d, i) => {
                      const name = bn ? d.fullNameBn || d.fullName : d.fullName;
                      return (
                        <li key={d.doctorId}>
                          <button
                            type="button"
                            onClick={() => goToDoctorSerial(d)}
                            className="w-full text-left rounded-xl border bg-card px-3 py-2.5 flex gap-2 hover:border-sky-500/60 hover:bg-sky-50/50"
                          >
                            <div className="h-11 w-11 rounded-xl overflow-hidden bg-muted shrink-0 grid place-items-center">
                              {d.photoUrl ? (
                                <img src={d.photoUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <Stethoscope className="h-4 w-4 text-sky-700" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold truncate">
                                {i === 0 ? "★ " : ""}
                                {name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {bn ? d.orgNameBn || d.orgName : d.orgName}
                                {d.experienceYears > 0
                                  ? ` · ${d.experienceYears}${bn ? " বছর" : " yrs"}`
                                  : ""}
                              </p>
                              <p className="text-xs font-semibold text-sky-800 mt-0.5">
                                {formatCareMoney(d.feeAmount, lang)}
                                <span className="ml-2 font-semibold text-teal-800">
                                  {bookCta ?? (bn ? "সিরিয়াল বুক →" : "Book serial →")}
                                </span>
                              </p>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              <button
                type="button"
                onClick={() => setStep("prefs")}
                className="w-full rounded-xl border py-2.5 text-sm font-semibold"
              >
                {bn ? "পিছনে" : "Back"}
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
