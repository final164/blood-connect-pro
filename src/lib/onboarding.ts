/** Required fields after first registration before using the app */
export type OnboardingProfile = {
  blood_group?: string | null;
  gender?: string | null;
  district_id?: string | null;
  area?: string | null;
  date_of_birth?: string | null;
} | null;

export function isProfileComplete(profile: OnboardingProfile): boolean {
  if (!profile) return false;
  const gender = (profile.gender ?? "").trim().toLowerCase();
  return !!(
    profile.blood_group &&
    (gender === "male" || gender === "female") &&
    profile.district_id &&
    (profile.area ?? "").trim()
  );
}

/** Approximate DOB from age (Jan 1 of birth year) — age is optional onboarding field */
export function dateOfBirthFromAge(age: number): string | null {
  if (!Number.isFinite(age) || age < 1 || age > 120) return null;
  const year = new Date().getFullYear() - Math.floor(age);
  return `${year}-01-01`;
}

export function ageFromDateOfBirth(dob: string | null | undefined): string {
  if (!dob) return "";
  const y = Number(String(dob).slice(0, 4));
  if (!Number.isFinite(y)) return "";
  const age = new Date().getFullYear() - y;
  if (age < 1 || age > 120) return "";
  return String(age);
}
