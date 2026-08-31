import { supabase } from "@/integrations/supabase/client";
import {
  bookCareAppSerial,
  fetchSchedulesForAffiliations,
  fetchSessionByScheduleDate,
  nextDatesForWeekday,
  searchCareDoctors,
  type CareDoctorListItem,
  type CareScheduleRow,
  type CareSerialRow,
} from "@/lib/care-api";

export type SerialRankMode = "best_value" | "experience_first";

export type RankedSerialDoctor = {
  doctorId: string;
  fullName: string;
  fullNameBn: string | null;
  photoUrl: string | null;
  qualifications: string | null;
  specialtyNameBn: string | null;
  specialtyNameEn: string | null;
  experienceYears: number;
  feeAmount: number;
  affiliationId: string;
  orgId: string;
  orgName: string;
  orgNameBn: string | null;
  locationName: string;
  locationNameBn: string | null;
  upazila: string | null;
  /** Preferred bookable schedule (cheapest chamber + soonest slots) */
  scheduleId: string;
  weekday: number;
  startTime: string;
  endTime: string;
  nextDates: string[];
};

export type SerialDateOption = {
  date: string;
  seatsLeft: number | null;
  available: boolean;
};

export const AI_SERIAL_RESUME_KEY = "care_ai_serial_resume_v1";

export type AiSerialResumeState = {
  specialtyId: string;
  specialtyNameBn?: string | null;
  specialtyNameEn?: string | null;
  reason?: string | null;
  districtId?: string;
  districtNameEn?: string;
  districtNameBn?: string | null;
  upazila?: string;
  mode?: SerialRankMode;
};

export function saveAiSerialResume(state: AiSerialResumeState) {
  try {
    sessionStorage.setItem(AI_SERIAL_RESUME_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export function loadAiSerialResume(): AiSerialResumeState | null {
  try {
    const raw = sessionStorage.getItem(AI_SERIAL_RESUME_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiSerialResumeState;
    if (!parsed?.specialtyId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearAiSerialResume() {
  try {
    sessionStorage.removeItem(AI_SERIAL_RESUME_KEY);
  } catch {
    /* ignore */
  }
}

async function fetchExperienceMap(doctorIds: string[]): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  if (!doctorIds.length) return map;
  const { data, error } = await supabase
    .from("tele_doctor_profiles")
    .select("doctor_id, experience_years")
    .in("doctor_id", doctorIds);
  if (error) {
    if (/tele_doctor_profiles|schema cache|does not exist/i.test(error.message)) return map;
    throw new Error(error.message);
  }
  for (const row of data ?? []) {
    const r = row as { doctor_id: string; experience_years?: number | null };
    map.set(r.doctor_id, Math.max(0, Number(r.experience_years) || 0));
  }
  return map;
}

function feeOf(chamber: CareDoctorListItem["chambers"][number]): number {
  return chamber.fee_amount != null && Number.isFinite(chamber.fee_amount)
    ? Number(chamber.fee_amount)
    : Number.POSITIVE_INFINITY;
}

/**
 * Rank doctors in district for AI serial booking.
 * best_value: lower fee first, then higher experience.
 * experience_first: higher experience first, then lower fee.
 */
export async function rankDoctorsForSerial(opts: {
  specialtyId: string;
  districtId: string;
  upazila?: string;
  mode: SerialRankMode;
  limit?: number;
}): Promise<RankedSerialDoctor[]> {
  const doctors = await searchCareDoctors({
    specialtyId: opts.specialtyId,
    districtId: opts.districtId,
    upazila: opts.upazila,
  });
  if (!doctors.length) return [];

  const expMap = await fetchExperienceMap(doctors.map((d) => d.id));
  const allAffIds = doctors.flatMap((d) => d.chambers.map((c) => c.affiliation_id));
  const schedules = await fetchSchedulesForAffiliations([...new Set(allAffIds)]);
  const bookableByAff = new Map<string, CareScheduleRow[]>();
  for (const s of schedules) {
    if (s.allow_app_booking === false) continue;
    const list = bookableByAff.get(s.affiliation_id) ?? [];
    list.push(s);
    bookableByAff.set(s.affiliation_id, list);
  }

  const ranked: RankedSerialDoctor[] = [];

  for (const d of doctors) {
    const chambersInDistrict = d.chambers
      .filter((c) => c.district_id === opts.districtId || !opts.districtId)
      .filter((c) => (bookableByAff.get(c.affiliation_id) ?? []).length > 0)
      .sort((a, b) => feeOf(a) - feeOf(b));
    if (!chambersInDistrict.length) continue;

    const chamber = chambersInDistrict[0];
    const scheds = (bookableByAff.get(chamber.affiliation_id) ?? []).slice().sort((a, b) => {
      const da = nextDatesForWeekday(a.weekday, 1)[0] ?? "9999";
      const db = nextDatesForWeekday(b.weekday, 1)[0] ?? "9999";
      return da.localeCompare(db) || a.start_time.localeCompare(b.start_time);
    });
    const schedule = scheds[0];
    if (!schedule) continue;

    const nextDates = nextDatesForWeekday(schedule.weekday, 5);
    ranked.push({
      doctorId: d.id,
      fullName: d.full_name,
      fullNameBn: d.full_name_bn,
      photoUrl: d.photo_url,
      qualifications: d.qualifications,
      specialtyNameBn: d.specialty_name_bn,
      specialtyNameEn: d.specialty_name_en,
      experienceYears: expMap.get(d.id) ?? 0,
      feeAmount: feeOf(chamber) === Number.POSITIVE_INFINITY ? 0 : feeOf(chamber),
      affiliationId: chamber.affiliation_id,
      orgId: chamber.org_id,
      orgName: chamber.org_name,
      orgNameBn: chamber.org_name_bn,
      locationName: chamber.location_name,
      locationNameBn: chamber.location_name_bn,
      upazila: chamber.upazila,
      scheduleId: schedule.id,
      weekday: schedule.weekday,
      startTime: schedule.start_time,
      endTime: schedule.end_time,
      nextDates,
    });
  }

  ranked.sort((a, b) => {
    if (opts.mode === "experience_first") {
      if (b.experienceYears !== a.experienceYears) return b.experienceYears - a.experienceYears;
      return a.feeAmount - b.feeAmount;
    }
    if (a.feeAmount !== b.feeAmount) return a.feeAmount - b.feeAmount;
    return b.experienceYears - a.experienceYears;
  });

  return ranked.slice(0, opts.limit ?? 8);
}

export async function listSerialDateOptions(
  scheduleId: string,
  weekday: number,
  count = 6,
): Promise<SerialDateOption[]> {
  const dates = nextDatesForWeekday(weekday, count);
  const out: SerialDateOption[] = [];
  for (const date of dates) {
    try {
      const session = await fetchSessionByScheduleDate(scheduleId, date);
      if (!session) {
        out.push({ date, seatsLeft: null, available: true });
        continue;
      }
      const seats = Math.max(0, Number(session.max_serial) - Number(session.last_issued ?? 0));
      const closed = ["cancelled", "completed", "closed"].includes(session.status);
      out.push({ date, seatsLeft: seats, available: !closed && seats > 0 });
    } catch {
      out.push({ date, seatsLeft: null, available: true });
    }
  }
  return out;
}

/** All bookable schedules for a ranked doctor (for alternate windows). */
export async function listSchedulesForRankedDoctor(
  affiliationId: string,
): Promise<CareScheduleRow[]> {
  const rows = await fetchSchedulesForAffiliations([affiliationId]);
  return rows.filter((s) => s.allow_app_booking !== false);
}

export async function confirmAiSerialBook(params: {
  scheduleId: string;
  date: string;
  guestName?: string;
  guestPhone?: string;
  guestAge?: number | null;
  guestAddress?: string;
}): Promise<CareSerialRow> {
  return bookCareAppSerial({
    scheduleId: params.scheduleId,
    date: params.date,
    guestName: params.guestName,
    guestPhone: params.guestPhone,
    guestAge: params.guestAge,
    guestAddress: params.guestAddress,
    isSecondVisit: false,
  });
}
