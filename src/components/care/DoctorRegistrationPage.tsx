import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { useI18n } from "@/lib/i18n";
import type { District } from "@/lib/api";
import {
  fetchCareDoctorOnboarding,
  fetchCareSpecialties,
  type CareDoctorFieldKey,
  type CareDoctorOnboardingSettings,
  type CareSpecialty,
} from "@/lib/care-cms";
import {
  doctorAuthErrorMessage,
  doctorFieldEnabled,
  doctorFieldRequired,
  registerDoctorAccount,
} from "@/lib/care-doctor-auth";
import { clampPhoneDigits } from "@/lib/phone-auth";
import { cn } from "@/lib/utils";

const TITLES = ["Dr.", "Prof.", "Prof. Dr.", "Mr.", "Ms.", "Mrs."];
const GENDERS = [
  { v: "male", bn: "পুরুষ", en: "Male" },
  { v: "female", bn: "মহিলা", en: "Female" },
  { v: "other", bn: "অন্যান্য", en: "Other" },
];
const DOCTOR_TYPES = [
  { v: "general", bn: "জেনারেল", en: "General" },
  { v: "specialist", bn: "স্পেশালিস্ট", en: "Specialist" },
  { v: "consultant", bn: "কনসালটেন্ট", en: "Consultant" },
  { v: "surgeon", bn: "সার্জন", en: "Surgeon" },
];

export function DoctorRegistrationPage() {
  const { lang, setLang } = useI18n();
  const bn = lang === "bn";
  const navigate = useNavigate();
  const [cfg, setCfg] = useState<CareDoctorOnboardingSettings | null>(null);
  const [specialties, setSpecialties] = useState<CareSpecialty[]>([]);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  const [title, setTitle] = useState("Dr.");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [district, setDistrict] = useState<District | null>(null);
  const [nid, setNid] = useState("");
  const [bmdc, setBmdc] = useState("");
  const [doctorType, setDoctorType] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [specialtyId, setSpecialtyId] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [terms, setTerms] = useState(false);

  useEffect(() => {
    void fetchCareDoctorOnboarding().then(setCfg);
    void fetchCareSpecialties().then(setSpecialties);
  }, []);

  function label(key: CareDoctorFieldKey) {
    const f = cfg?.fields[key];
    return bn ? f?.label_bn : f?.label_en;
  }

  function show(key: CareDoctorFieldKey) {
    return !cfg || doctorFieldEnabled(cfg.fields, key);
  }

  function req(key: CareDoctorFieldKey) {
    return !!cfg && doctorFieldRequired(cfg.fields, key);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!cfg) return;
    setBusy(true);
    try {
      const profile = await registerDoctorAccount({
        title,
        firstName,
        lastName,
        dateOfBirth: dob,
        gender,
        districtId: district?.id ?? null,
        nidPassport: nid,
        bmdcNo: bmdc,
        doctorType,
        phone,
        email,
        password,
        confirmPassword: password,
        specialtyId: specialtyId || null,
        qualifications,
        acceptTerms: terms,
      });
      setIssuedCode(profile.doctor_code);
      toast.success(bn ? "রেজিস্ট্রেশন সফল" : "Registration successful");
    } catch (err) {
      toast.error(doctorAuthErrorMessage((err as Error).message, lang));
    } finally {
      setBusy(false);
    }
  }

  if (issuedCode) {
    return (
      <div className="min-h-dvh bg-gradient-to-b from-sky-50 to-white px-4 py-8">
        <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 text-center shadow-sm space-y-4">
          <h1 className="text-xl font-bold text-slate-900">
            {bn ? "আপনার ডাক্তার কোড" : "Your doctor code"}
          </h1>
          <p className="text-3xl font-black tracking-wide text-sky-700">{issuedCode}</p>
          <p className="text-sm text-muted-foreground">
            {bn
              ? "চেম্বার/অপারেশন আপনাকে এই কোড দিয়ে যোগ করতে পারবে — আপনার অনুমোদন লাগবে।"
              : "Chambers/operations can add you with this code — your approval is required."}
          </p>
          <button
            type="button"
            onClick={() => void navigate({ to: "/care/doctor/portal" })}
            className="w-full rounded-xl bg-sky-600 py-3 text-sm font-bold text-white"
          >
            {bn ? "ড্যাশবোর্ডে যান" : "Go to dashboard"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-gradient-to-b from-sky-50 via-white to-sky-50/40">
      <div className="mx-auto max-w-lg px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <PageBackButton fallbackTo={{ to: "/care" }} shape="xl" />
          <button
            type="button"
            onClick={() => setLang(bn ? "en" : "bn")}
            className="text-xs font-semibold text-sky-700"
          >
            {bn ? "EN" : "বাং"}
          </button>
        </div>

        <h1 className="text-2xl font-black text-slate-900 mb-5">
          {bn ? "ডাক্তার রেজিস্ট্রেশন" : "Doctor Registration"}
        </h1>

        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3">
          {show("title") && (
            <Field label={label("title")} required={req("title")}>
              <select
                className={inp}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required={req("title")}
              >
                {TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <div className="grid grid-cols-2 gap-2">
            {show("first_name") && (
              <Field label={label("first_name")} required={req("first_name")}>
                <input
                  className={inp}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required={req("first_name")}
                />
              </Field>
            )}
            {show("last_name") && (
              <Field label={label("last_name")} required={req("last_name")}>
                <input
                  className={inp}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required={req("last_name")}
                />
              </Field>
            )}
          </div>

          {show("date_of_birth") && (
            <Field label={label("date_of_birth")} required={req("date_of_birth")}>
              <input
                type="date"
                className={inp}
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                required={req("date_of_birth")}
              />
            </Field>
          )}

          {show("gender") && (
            <Field label={label("gender")} required={req("gender")}>
              <select
                className={inp}
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                required={req("gender")}
              >
                <option value="">{bn ? "নির্বাচন করুন" : "Select"}</option>
                {GENDERS.map((g) => (
                  <option key={g.v} value={g.v}>
                    {bn ? g.bn : g.en}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {show("district") && (
            <Field label={label("district")} required={req("district")}>
              <DistrictTypeahead value={district} onChange={setDistrict} />
            </Field>
          )}

          {show("nid_passport") && (
            <Field label={label("nid_passport")} required={req("nid_passport")}>
              <input
                className={inp}
                value={nid}
                onChange={(e) => setNid(e.target.value)}
                required={req("nid_passport")}
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-2">
            {show("bmdc") && (
              <Field label={label("bmdc")} required={req("bmdc")}>
                <input
                  className={inp}
                  value={bmdc}
                  onChange={(e) => setBmdc(e.target.value)}
                  required={req("bmdc")}
                />
              </Field>
            )}
            {show("doctor_type") && (
              <Field label={label("doctor_type")} required={req("doctor_type")}>
                <select
                  className={inp}
                  value={doctorType}
                  onChange={(e) => setDoctorType(e.target.value)}
                  required={req("doctor_type")}
                >
                  <option value="">{bn ? "নির্বাচন" : "Select"}</option>
                  {DOCTOR_TYPES.map((t) => (
                    <option key={t.v} value={t.v}>
                      {bn ? t.bn : t.en}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>

          {show("specialty") && (
            <Field label={label("specialty")} required={req("specialty")}>
              <select
                className={inp}
                value={specialtyId}
                onChange={(e) => setSpecialtyId(e.target.value)}
                required={req("specialty")}
              >
                <option value="">{bn ? "ঐচ্ছিক" : "Optional"}</option>
                {specialties.map((s) => (
                  <option key={s.id} value={s.id}>
                    {bn ? s.name_bn : s.name_en}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {show("qualifications") && (
            <Field label={label("qualifications")} required={req("qualifications")}>
              <input
                className={inp}
                value={qualifications}
                onChange={(e) => setQualifications(e.target.value)}
                placeholder="MBBS, FCPS"
                required={req("qualifications")}
              />
            </Field>
          )}

          {show("mobile") && (
            <Field label={label("mobile")} required={req("mobile")}>
              <input
                className={inp}
                value={phone}
                onChange={(e) => setPhone(clampPhoneDigits(e.target.value))}
                inputMode="tel"
                maxLength={11}
                required={req("mobile")}
              />
            </Field>
          )}

          {show("email") && (
            <Field label={label("email")} required={req("email")}>
              <input
                type="email"
                className={inp}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required={req("email")}
              />
            </Field>
          )}

          {show("password") && (
            <Field label={label("password")} required={req("password")}>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  className={cn(inp, "pr-10")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required={req("password")}
                  minLength={8}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPw((v) => !v)}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </Field>
          )}

          {show("terms") && (
            <div className="pt-2 space-y-2">
              <p className="text-sm font-semibold text-slate-800">
                {bn ? "শর্তাবলী গ্রহণ" : "Accepting Terms & conditions"}
              </p>
              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  required={req("terms")}
                />
                <span>
                  {bn ? "আমি " : "I accept and agree "}
                  <Link to="/terms" className="text-rose-600 font-semibold">
                    {bn ? "সেবার শর্তাবলী" : "Terms of services"}
                  </Link>
                  {bn ? " ও " : " and "}
                  <Link to="/privacy" className="text-rose-600 font-semibold">
                    {bn ? "গোপনীয়তা নীতি" : "Privacy Policy"}
                  </Link>
                  {bn ? " মেনে নিচ্ছি।" : "."}
                </span>
              </label>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-2 w-full rounded-full bg-sky-600 py-3.5 text-sm font-black uppercase tracking-wide text-white disabled:opacity-60"
          >
            {busy ? (
              <Loader2 className="mx-auto h-5 w-5 animate-spin" />
            ) : bn ? (
              "সাইন আপ"
            ) : (
              "Sign Up"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {bn ? "আগে থেকে অ্যাকাউন্ট আছে? " : "Already have an account? "}
          <Link to="/care/doctor/auth" className="font-semibold text-sky-700">
            {bn ? "সাইন ইন" : "Sign in"}
          </Link>
        </p>
      </div>
    </div>
  );
}

const inp =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-sky-500/30";

function Field({
  label,
  required,
  children,
}: {
  label?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-slate-700">
        {label}
        {required ? <span className="text-rose-600"> *</span> : null}
      </span>
      {children}
    </label>
  );
}
