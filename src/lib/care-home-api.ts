import { supabase } from "@/integrations/supabase/client";
import { fetchCarePolicies, type CareFeatureFlags } from "@/lib/care-cms";
import { publicBmdcNo } from "@/lib/care-api";

export type CareHomeLocation = {
  districtId: string;
  districtName?: string;
  districtNameBn?: string | null;
  upazila: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
};

export type CareHomeDoctorArea = {
  id: string;
  doctor_id: string;
  district_id: string;
  upazila: string | null;
  district?: { id: string; name: string; name_bn: string | null } | null;
};

export type CareHomeDoctorSlot = {
  id: string;
  doctor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type CareHomeDoctorProfile = {
  doctor_id: string;
  is_active: boolean;
  is_online: boolean;
  fee_amount: number;
  about_bn: string | null;
  about_en: string | null;
  visit_minutes: number;
  joined_at: string;
  updated_at: string;
};

export type CareHomeDoctorCard = CareHomeDoctorProfile & {
  full_name: string;
  full_name_bn: string | null;
  photo_url: string | null;
  bmdc_no: string | null;
  public_bmdc: string | null;
  qualifications: string | null;
  specialty_id: string | null;
  specialty_name_bn: string | null;
  specialty_name_en: string | null;
  areas: CareHomeDoctorArea[];
};

export type CareHomeVisitBooking = {
  id: string;
  patient_id: string;
  doctor_id: string;
  slot_start: string;
  slot_end: string;
  fee_amount: number;
  status: string;
  visit_district_id: string | null;
  visit_upazila: string | null;
  visit_address: string;
  visit_lat: number | null;
  visit_lng: number | null;
  patient_name: string | null;
  patient_phone: string | null;
  notes: string | null;
  reference_code: string;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  doctor?: {
    full_name: string;
    full_name_bn: string | null;
    photo_url: string | null;
    bmdc_no: string | null;
  } | null;
};

export const HOME_LOC_STORAGE_KEY = "care_home_location_v1";

export function loadCachedHomeLocation(): CareHomeLocation | null {
  try {
    const raw = sessionStorage.getItem(HOME_LOC_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CareHomeLocation;
    if (!parsed?.districtId || !parsed?.address) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCachedHomeLocation(loc: CareHomeLocation) {
  try {
    sessionStorage.setItem(HOME_LOC_STORAGE_KEY, JSON.stringify(loc));
  } catch {
    /* ignore */
  }
}

export async function fetchHomeCareFlags(): Promise<
  Pick<CareFeatureFlags, "home_doctor" | "home_diagnostic" | "home_collection">
> {
  const { flags } = await fetchCarePolicies();
  return {
    home_doctor: flags.home_doctor === true,
    home_diagnostic: flags.home_diagnostic === true,
    home_collection: flags.home_collection === true,
  };
}

export async function fetchGoogleMapsApiKey(): Promise<string | null> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("google_maps_api_key")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return null;
  const key = (data as { google_maps_api_key?: string | null }).google_maps_api_key;
  return key?.trim() || null;
}

export async function fetchMyHomeDoctorProfile(
  doctorId: string,
): Promise<CareHomeDoctorProfile | null> {
  const { data, error } = await supabase
    .from("care_home_doctor_profiles")
    .select("*")
    .eq("doctor_id", doctorId)
    .maybeSingle();
  if (error) {
    if (/care_home_doctor_profiles|schema cache|does not exist/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  return data as CareHomeDoctorProfile | null;
}

export async function fetchHomeDoctorAreas(doctorId: string): Promise<CareHomeDoctorArea[]> {
  const { data, error } = await supabase
    .from("care_home_doctor_areas")
    .select("id, doctor_id, district_id, upazila, districts(id, name_en, name_bn)")
    .eq("doctor_id", doctorId);
  if (error) {
    if (/care_home_doctor_areas|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const dist = r.districts as { id: string; name_en: string; name_bn: string | null } | null;
    return {
      id: String(r.id),
      doctor_id: String(r.doctor_id),
      district_id: String(r.district_id),
      upazila: (r.upazila as string | null) ?? null,
      district: dist
        ? { id: dist.id, name: dist.name_en, name_bn: dist.name_bn }
        : null,
    };
  });
}

export async function fetchHomeDoctorSlots(doctorId: string): Promise<CareHomeDoctorSlot[]> {
  const { data, error } = await supabase
    .from("care_home_doctor_slots")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("is_active", true)
    .order("weekday")
    .order("start_time");
  if (error) {
    if (/care_home_doctor_slots|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as CareHomeDoctorSlot[];
}

export async function joinHomeDoctor(input: {
  areas: { district_id: string; upazila?: string | null }[];
  feeAmount?: number;
  aboutBn?: string;
  aboutEn?: string;
  visitMinutes?: number;
}): Promise<CareHomeDoctorProfile> {
  const { data, error } = await supabase.rpc("care_home_doctor_join", {
    _areas: input.areas.map((a) => ({
      district_id: a.district_id,
      upazila: a.upazila ?? null,
    })),
    _fee_amount: input.feeAmount ?? 0,
    _about_bn: input.aboutBn ?? null,
    _about_en: input.aboutEn ?? null,
    _visit_minutes: input.visitMinutes ?? 30,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareHomeDoctorProfile;
}

export async function setHomeDoctorAreas(
  areas: { district_id: string; upazila?: string | null }[],
): Promise<number> {
  const { data, error } = await supabase.rpc("care_home_doctor_set_areas", {
    _areas: areas.map((a) => ({
      district_id: a.district_id,
      upazila: a.upazila ?? null,
    })),
  } as never);
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function replaceHomeDoctorSlots(
  slots: { weekday: number; start_time: string; end_time: string }[],
): Promise<number> {
  const { data, error } = await supabase.rpc("care_home_doctor_replace_slots", {
    _slots: slots.map((s) => ({
      weekday: s.weekday,
      start_time: s.start_time.length === 5 ? `${s.start_time}:00` : s.start_time,
      end_time: s.end_time.length === 5 ? `${s.end_time}:00` : s.end_time,
    })),
  } as never);
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function setHomeDoctorOnline(online: boolean): Promise<CareHomeDoctorProfile> {
  const { data, error } = await supabase.rpc("care_home_doctor_set_online", {
    _online: online,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareHomeDoctorProfile;
}

export async function updateHomeDoctorProfile(input: {
  feeAmount?: number;
  aboutBn?: string | null;
  aboutEn?: string | null;
  visitMinutes?: number;
  isActive?: boolean;
}): Promise<CareHomeDoctorProfile> {
  const { data, error } = await supabase.rpc("care_home_doctor_update_profile", {
    _fee_amount: input.feeAmount ?? null,
    _about_bn: input.aboutBn ?? null,
    _about_en: input.aboutEn ?? null,
    _visit_minutes: input.visitMinutes ?? null,
    _is_active: input.isActive ?? null,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareHomeDoctorProfile;
}

export async function searchHomeDoctors(params: {
  districtId: string;
  upazila?: string;
}): Promise<CareHomeDoctorCard[]> {
  const { data: areaRows, error: areaErr } = await supabase
    .from("care_home_doctor_areas")
    .select("doctor_id, district_id, upazila")
    .eq("district_id", params.districtId);
  if (areaErr) {
    if (/care_home_doctor_areas|schema cache/i.test(areaErr.message)) return [];
    throw new Error(areaErr.message);
  }

  const upazilaQ = (params.upazila ?? "").trim().toLowerCase();
  const doctorIds = [
    ...new Set(
      ((areaRows ?? []) as { doctor_id: string; upazila: string | null }[])
        .filter((a) => {
          if (!upazilaQ) return true;
          const u = (a.upazila ?? "").trim().toLowerCase();
          return !u || u === upazilaQ;
        })
        .map((a) => a.doctor_id),
    ),
  ];
  if (!doctorIds.length) return [];

  const { data: profiles, error: pErr } = await supabase
    .from("care_home_doctor_profiles")
    .select("*")
    .in("doctor_id", doctorIds)
    .eq("is_active", true);
  if (pErr) throw new Error(pErr.message);
  const activeIds = ((profiles ?? []) as CareHomeDoctorProfile[]).map((p) => p.doctor_id);
  if (!activeIds.length) return [];

  const { data: doctors, error: dErr } = await supabase
    .from("care_doctors")
    .select(
      "id, full_name, full_name_bn, photo_url, bmdc_no, qualifications, specialty_id, care_specialties(name_bn, name_en)",
    )
    .in("id", activeIds)
    .eq("is_active", true);
  if (dErr) throw new Error(dErr.message);

  const { data: allAreas } = await supabase
    .from("care_home_doctor_areas")
    .select("id, doctor_id, district_id, upazila, districts(id, name_en, name_bn)")
    .in("doctor_id", activeIds);
  const areasByDoctor = new Map<string, CareHomeDoctorArea[]>();
  for (const r of (allAreas ?? []) as Record<string, unknown>[]) {
    const id = String(r.doctor_id);
    const dist = r.districts as { id: string; name_en: string; name_bn: string | null } | null;
    const area: CareHomeDoctorArea = {
      id: String(r.id),
      doctor_id: id,
      district_id: String(r.district_id),
      upazila: (r.upazila as string | null) ?? null,
      district: dist ? { id: dist.id, name: dist.name_en, name_bn: dist.name_bn } : null,
    };
    const list = areasByDoctor.get(id) ?? [];
    list.push(area);
    areasByDoctor.set(id, list);
  }

  const profMap = new Map(
    ((profiles ?? []) as CareHomeDoctorProfile[]).map((p) => [p.doctor_id, p]),
  );

  return ((doctors ?? []) as Record<string, unknown>[])
    .map((d) => {
      const id = String(d.id);
      const prof = profMap.get(id);
      if (!prof) return null;
      const spec = d.care_specialties as { name_bn?: string; name_en?: string } | null;
      const bmdc = (d.bmdc_no as string | null) ?? null;
      return {
        ...prof,
        full_name: String(d.full_name ?? ""),
        full_name_bn: (d.full_name_bn as string | null) ?? null,
        photo_url: (d.photo_url as string | null) ?? null,
        bmdc_no: bmdc,
        public_bmdc: publicBmdcNo(bmdc),
        qualifications: (d.qualifications as string | null) ?? null,
        specialty_id: (d.specialty_id as string | null) ?? null,
        specialty_name_bn: spec?.name_bn ?? null,
        specialty_name_en: spec?.name_en ?? null,
        areas: areasByDoctor.get(id) ?? [],
      } satisfies CareHomeDoctorCard;
    })
    .filter((x): x is CareHomeDoctorCard => !!x)
    .sort((a, b) => Number(b.is_online) - Number(a.is_online) || a.full_name.localeCompare(b.full_name));
}

export async function fetchHomeDoctorCard(doctorId: string): Promise<CareHomeDoctorCard | null> {
  const prof = await fetchMyHomeDoctorProfile(doctorId);
  if (!prof || !prof.is_active) return null;
  const { data: d, error } = await supabase
    .from("care_doctors")
    .select(
      "id, full_name, full_name_bn, photo_url, bmdc_no, qualifications, specialty_id, care_specialties(name_bn, name_en)",
    )
    .eq("id", doctorId)
    .maybeSingle();
  if (error || !d) return null;
  const row = d as Record<string, unknown>;
  const spec = row.care_specialties as { name_bn?: string; name_en?: string } | null;
  const bmdc = (row.bmdc_no as string | null) ?? null;
  return {
    ...prof,
    full_name: String(row.full_name ?? ""),
    full_name_bn: (row.full_name_bn as string | null) ?? null,
    photo_url: (row.photo_url as string | null) ?? null,
    bmdc_no: bmdc,
    public_bmdc: publicBmdcNo(bmdc),
    qualifications: (row.qualifications as string | null) ?? null,
    specialty_id: (row.specialty_id as string | null) ?? null,
    specialty_name_bn: spec?.name_bn ?? null,
    specialty_name_en: spec?.name_en ?? null,
    areas: await fetchHomeDoctorAreas(doctorId),
  };
}

export async function fetchHomeDoctorBookedStarts(
  doctorId: string,
  fromIso: string,
  toIso: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("care_home_visit_bookings")
    .select("slot_start")
    .eq("doctor_id", doctorId)
    .gte("slot_start", fromIso)
    .lte("slot_start", toIso)
    .not("status", "in", "(cancelled,no_show)");
  if (error) {
    if (/care_home_visit_bookings|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as { slot_start?: string }[])
    .map((r) => r.slot_start)
    .filter((s): s is string => !!s);
}

export async function bookHomeVisit(input: {
  doctorId: string;
  slotStart: string;
  slotEnd: string;
  location: CareHomeLocation;
  patientName?: string;
  patientPhone?: string;
  notes?: string;
}): Promise<CareHomeVisitBooking> {
  const { data, error } = await supabase.rpc("care_home_visit_book", {
    _doctor_id: input.doctorId,
    _slot_start: input.slotStart,
    _slot_end: input.slotEnd,
    _visit_district_id: input.location.districtId,
    _visit_upazila: input.location.upazila || null,
    _visit_address: input.location.address,
    _visit_lat: input.location.lat ?? null,
    _visit_lng: input.location.lng ?? null,
    _patient_name: input.patientName ?? null,
    _patient_phone: input.patientPhone ?? null,
    _notes: input.notes ?? null,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareHomeVisitBooking;
}

export async function setHomeVisitStatus(
  bookingId: string,
  status: string,
): Promise<CareHomeVisitBooking> {
  const { data, error } = await supabase.rpc("care_home_visit_set_status", {
    _booking_id: bookingId,
    _status: status,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareHomeVisitBooking;
}

export async function fetchMyHomeVisits(): Promise<CareHomeVisitBooking[]> {
  const { data, error } = await supabase
    .from("care_home_visit_bookings")
    .select(
      "*, care_doctors(full_name, full_name_bn, photo_url, bmdc_no)",
    )
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) {
    if (/care_home_visit_bookings|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    ...(r as unknown as CareHomeVisitBooking),
    doctor: (r.care_doctors as CareHomeVisitBooking["doctor"]) ?? null,
  }));
}

export async function fetchHomeVisit(id: string): Promise<CareHomeVisitBooking | null> {
  const { data, error } = await supabase
    .from("care_home_visit_bookings")
    .select("*, care_doctors(full_name, full_name_bn, photo_url, bmdc_no)")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (/care_home_visit_bookings|schema cache/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    ...(r as unknown as CareHomeVisitBooking),
    doctor: (r.care_doctors as CareHomeVisitBooking["doctor"]) ?? null,
  };
}

export async function fetchDoctorHomeQueue(doctorId: string): Promise<CareHomeVisitBooking[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  const { data, error } = await supabase
    .from("care_home_visit_bookings")
    .select("*")
    .eq("doctor_id", doctorId)
    .gte("slot_start", start.toISOString())
    .lte("slot_start", end.toISOString())
    .not("status", "in", "(cancelled)")
    .order("slot_start");
  if (error) {
    if (/care_home_visit_bookings|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as CareHomeVisitBooking[];
}

export function homeVisitStatusLabel(status: string, lang: "bn" | "en"): string {
  const map: Record<string, { bn: string; en: string }> = {
    requested: { bn: "অনুরোধ", en: "Requested" },
    confirmed: { bn: "নিশ্চিত", en: "Confirmed" },
    en_route: { bn: "পথে", en: "En route" },
    completed: { bn: "সম্পন্ন", en: "Completed" },
    cancelled: { bn: "বাতিল", en: "Cancelled" },
    no_show: { bn: "আসেননি", en: "No-show" },
  };
  const row = map[status];
  if (!row) return status;
  return lang === "bn" ? row.bn : row.en;
}

export function homeVisitStatusTone(status: string): string {
  if (status === "completed") return "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";
  if (status === "cancelled" || status === "no_show")
    return "bg-destructive/10 text-destructive border-destructive/30";
  if (status === "en_route" || status === "confirmed")
    return "bg-sky-500/10 text-sky-700 border-sky-500/30";
  return "bg-amber-500/10 text-amber-800 border-amber-500/30";
}
