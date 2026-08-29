import { supabase } from "@/integrations/supabase/client";
import {
  isValidEmail,
  isValidPassword,
  loginWithEmailPassword,
  normalizeEmail,
  registerWithEmailPassword,
  resolveFreeUsername,
  suggestUsername,
} from "@/lib/email-auth";
import { fetchCareDoctorOnboarding, type CareDoctorFieldKey } from "@/lib/care-cms";
import { clampPhoneDigits, isValidPhone, normalizePhone } from "@/lib/phone-auth";

export type DoctorRegistrationInput = {
  title: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  districtId: string | null;
  nidPassport: string;
  bmdcNo: string;
  doctorType: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
  specialtyId: string | null;
  qualifications: string;
  acceptTerms: boolean;
};

export type CareDoctorProfile = {
  id: string;
  doctor_code: string | null;
  full_name: string;
  title: string | null;
  first_name: string | null;
  last_name: string | null;
  bmdc_no: string | null;
  doctor_type: string | null;
  phone: string | null;
  email: string | null;
  specialty_id: string | null;
  registration_status: string;
  user_id: string | null;
  photo_url: string | null;
  qualifications: string | null;
};

export function doctorFieldEnabled(
  fields: Record<CareDoctorFieldKey, { enabled: boolean }>,
  key: CareDoctorFieldKey,
) {
  return fields[key]?.enabled !== false;
}

export function doctorFieldRequired(
  fields: Record<CareDoctorFieldKey, { enabled: boolean; required: boolean }>,
  key: CareDoctorFieldKey,
) {
  return fields[key]?.enabled !== false && fields[key]?.required === true;
}

export async function fetchMyDoctorProfile(): Promise<CareDoctorProfile | null> {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("care_doctors")
    .select(
      "id, doctor_code, full_name, title, first_name, last_name, bmdc_no, doctor_type, phone, email, specialty_id, registration_status, user_id, photo_url, qualifications",
    )
    .eq("user_id", uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CareDoctorProfile | null) ?? null;
}

export async function registerDoctorAccount(input: DoctorRegistrationInput): Promise<CareDoctorProfile> {
  const settings = await fetchCareDoctorOnboarding();
  const f = settings.fields;

  const email = normalizeEmail(input.email);
  const phone = normalizePhone(clampPhoneDigits(input.phone));
  const firstName = input.firstName.trim();
  const lastName = input.lastName.trim();
  const fullName = [input.title.trim(), firstName, lastName].filter(Boolean).join(" ").trim();

  if (doctorFieldRequired(f, "terms") && !input.acceptTerms) {
    throw new Error("TERMS_REQUIRED");
  }
  if (doctorFieldRequired(f, "first_name") && !firstName) throw new Error("NAME_REQUIRED");
  if (doctorFieldRequired(f, "last_name") && !lastName) throw new Error("NAME_REQUIRED");
  if (doctorFieldRequired(f, "email") && !isValidEmail(email)) throw new Error("INVALID_EMAIL");
  if (doctorFieldRequired(f, "mobile") && !isValidPhone(phone)) throw new Error("INVALID_PHONE");
  if (doctorFieldRequired(f, "password")) {
    if (!isValidPassword(input.password)) throw new Error("WEAK_PASSWORD");
    if (input.password !== input.confirmPassword) throw new Error("PASSWORDS_DO_NOT_MATCH");
  }
  if (doctorFieldRequired(f, "bmdc") && !input.bmdcNo.trim()) throw new Error("BMDC_REQUIRED");
  if (doctorFieldRequired(f, "date_of_birth") && !input.dateOfBirth) throw new Error("DOB_REQUIRED");
  if (doctorFieldRequired(f, "gender") && !input.gender.trim()) throw new Error("GENDER_REQUIRED");
  if (doctorFieldRequired(f, "district") && !input.districtId) throw new Error("DISTRICT_REQUIRED");
  if (doctorFieldRequired(f, "nid_passport") && !input.nidPassport.trim()) throw new Error("NID_REQUIRED");
  if (doctorFieldRequired(f, "doctor_type") && !input.doctorType.trim()) throw new Error("TYPE_REQUIRED");

  const username = await resolveFreeUsername(suggestUsername(email || fullName || "doctor"));
  await registerWithEmailPassword({
    fullName,
    username,
    email,
    password: input.password,
    confirmPassword: input.confirmPassword,
  });

  const { data, error } = await supabase.rpc("care_register_doctor", {
    _title: input.title.trim() || null,
    _first_name: firstName || null,
    _last_name: lastName || null,
    _date_of_birth: input.dateOfBirth || null,
    _gender: input.gender.trim() || null,
    _district_id: input.districtId || null,
    _nid_passport: input.nidPassport.trim() || null,
    _bmdc_no: input.bmdcNo.trim() || null,
    _doctor_type: input.doctorType.trim() || null,
    _phone: phone || null,
    _email: email || null,
    _specialty_id: input.specialtyId || null,
    _qualifications: input.qualifications.trim() || null,
  } as never);

  if (error) throw new Error(error.message);
  return data as CareDoctorProfile;
}

export async function loginDoctor(email: string, password: string) {
  await loginWithEmailPassword({ email, password });
  const profile = await fetchMyDoctorProfile();
  if (!profile) throw new Error("NOT_A_DOCTOR");
  if (profile.registration_status === "suspended") throw new Error("DOCTOR_SUSPENDED");
  return profile;
}

export function doctorAuthErrorMessage(raw: string, lang: "bn" | "en"): string {
  const code = raw.replace(/^Error:\s*/i, "").trim();
  const bn = lang === "bn";
  switch (code) {
    case "TERMS_REQUIRED":
      return bn ? "শর্তাবলী মেনে নিন" : "Please accept the terms";
    case "NAME_REQUIRED":
      return bn ? "নাম দিন" : "Enter your name";
    case "INVALID_EMAIL":
      return bn ? "সঠিক ইমেইল দিন" : "Enter a valid email";
    case "INVALID_PHONE":
      return bn ? "সঠিক মোবাইল নম্বর দিন" : "Enter a valid mobile number";
    case "WEAK_PASSWORD":
      return bn ? "পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে" : "Password must be at least 8 characters";
    case "PASSWORDS_DO_NOT_MATCH":
      return bn ? "পাসওয়ার্ড মিলছে না" : "Passwords do not match";
    case "BMDC_REQUIRED":
      return bn ? "BMDC নম্বর দিন" : "BMDC number is required";
    case "DOB_REQUIRED":
      return bn ? "জন্ম তারিখ দিন" : "Date of birth is required";
    case "GENDER_REQUIRED":
      return bn ? "লিঙ্গ নির্বাচন করুন" : "Select gender";
    case "DISTRICT_REQUIRED":
      return bn ? "জেলা নির্বাচন করুন" : "Select district";
    case "NID_REQUIRED":
      return bn ? "NID / পাসপোর্ট দিন" : "NID / passport is required";
    case "TYPE_REQUIRED":
      return bn ? "ডাক্তারের ধরন নির্বাচন করুন" : "Select doctor type";
    case "NOT_A_DOCTOR":
      return bn
        ? "এই অ্যাকাউন্টে ডাক্তার প্রোফাইল নেই — আগে রেজিস্টার করুন"
        : "No doctor profile on this account — please register first";
    case "DOCTOR_SUSPENDED":
      return bn ? "আপনার অ্যাকাউন্ট সাসপেন্ড করা হয়েছে" : "Your doctor account is suspended";
    default:
      return code || (bn ? "কিছু সমস্যা হয়েছে" : "Something went wrong");
  }
}
