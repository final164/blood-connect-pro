import { supabase } from "@/integrations/supabase/client";

export type CareDoctorListItem = {
  id: string;
  full_name: string;
  full_name_bn: string | null;
  bmdc_no: string | null;
  qualifications: string | null;
  photo_url: string | null;
  specialty_id: string | null;
  specialty_name_bn: string | null;
  specialty_name_en: string | null;
  chambers: {
    affiliation_id: string;
    org_id: string;
    org_name: string;
    org_name_bn: string | null;
    location_id: string;
    location_name: string;
    location_name_bn: string | null;
    district_id: string | null;
    upazila: string | null;
    fee_amount: number | null;
  }[];
};

export type CareScheduleRow = {
  id: string;
  affiliation_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  max_serial: number;
  start_number: number;
  allow_app_booking: boolean;
  allow_walk_in: boolean;
  booking_window_hours: number;
  slot_minutes: number;
  is_active: boolean;
};

export type CareSessionRow = {
  id: string;
  schedule_id: string;
  org_id: string;
  location_id: string;
  doctor_id: string;
  session_date: string;
  status: string;
  max_serial: number;
  start_number: number;
  last_issued: number;
  now_serving: number | null;
};

export type CareSerialRow = {
  id: string;
  session_id: string;
  serial_no: number;
  patient_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  source: string;
  status: string;
  claim_code: string;
  invoice_no?: string | null;
  fee_amount?: number | null;
  payment_status?: "pending" | "paid" | "waived";
  called_at: string | null;
  created_at: string;
};

function missing(error: { message?: string } | null) {
  return !!error && /does not exist|schema cache|relation/i.test(error.message ?? "");
}

export async function searchCareDoctors(opts: {
  q?: string;
  specialtyId?: string;
  districtId?: string;
  upazila?: string;
}): Promise<CareDoctorListItem[]> {
  const { data, error } = await supabase
    .from("care_doctors")
    .select(
      `
      id, full_name, full_name_bn, bmdc_no, qualifications, photo_url, specialty_id,
      care_specialties ( name_bn, name_en ),
      care_affiliations (
        id, fee_amount, is_active, org_id, location_id,
        care_orgs ( id, name, name_bn, is_verified, is_listed, is_active, district_id ),
        care_locations ( id, name, name_bn, district_id, upazila )
      )
    `,
    )
    .eq("is_active", true)
    .order("full_name")
    .limit(80);

  if (error) {
    if (missing(error)) return [];
    throw new Error(error.message);
  }

  const q = opts.q?.trim().toLowerCase() ?? "";
  const upazila = opts.upazila?.trim().toLowerCase() ?? "";

  const items: CareDoctorListItem[] = [];
  for (const raw of data ?? []) {
    const d = raw as Record<string, unknown>;
    const spec = d.care_specialties as { name_bn?: string; name_en?: string } | null;
    if (opts.specialtyId && d.specialty_id !== opts.specialtyId) continue;
    const affs = Array.isArray(d.care_affiliations) ? d.care_affiliations : [];
    const chambers = [];
    for (const a of affs as Record<string, unknown>[]) {
      if (a.is_active === false) continue;
      const org = a.care_orgs as {
        id: string;
        name: string;
        name_bn: string | null;
        is_verified?: boolean;
        is_listed?: boolean;
        is_active?: boolean;
        district_id?: string | null;
      } | null;
      const loc = a.care_locations as {
        id: string;
        name: string;
        name_bn: string | null;
        district_id?: string | null;
        upazila?: string | null;
      } | null;
      if (!org || org.is_verified === false || org.is_listed === false || org.is_active === false) continue;
      if (opts.districtId && org.district_id !== opts.districtId && loc?.district_id !== opts.districtId) {
        continue;
      }
      if (upazila && !(loc?.upazila ?? "").toLowerCase().includes(upazila)) continue;
      chambers.push({
        affiliation_id: String(a.id),
        org_id: org.id,
        org_name: org.name,
        org_name_bn: org.name_bn,
        location_id: loc?.id ?? String(a.location_id),
        location_name: loc?.name ?? "",
        location_name_bn: loc?.name_bn ?? null,
        district_id: loc?.district_id ?? org.district_id ?? null,
        upazila: loc?.upazila ?? null,
        fee_amount: a.fee_amount != null ? Number(a.fee_amount) : null,
      });
    }
    if (!chambers.length) continue;
    const name = `${d.full_name ?? ""} ${d.full_name_bn ?? ""} ${d.bmdc_no ?? ""} ${spec?.name_en ?? ""} ${spec?.name_bn ?? ""} ${chambers.map((c) => c.org_name).join(" ")}`.toLowerCase();
    if (q && !name.includes(q)) continue;
    items.push({
      id: String(d.id),
      full_name: String(d.full_name ?? ""),
      full_name_bn: (d.full_name_bn as string) ?? null,
      bmdc_no: (d.bmdc_no as string) ?? null,
      qualifications: (d.qualifications as string) ?? null,
      photo_url: (d.photo_url as string) ?? null,
      specialty_id: (d.specialty_id as string) ?? null,
      specialty_name_bn: spec?.name_bn ?? null,
      specialty_name_en: spec?.name_en ?? null,
      chambers,
    });
  }
  return items;
}

export async function fetchCareDoctor(id: string) {
  const list = await searchCareDoctors({});
  const found = list.find((d) => d.id === id);
  if (!found) {
    const { data, error } = await supabase
      .from("care_doctors")
      .select(
        "id, full_name, full_name_bn, bmdc_no, qualifications, photo_url, bio, bio_bn, specialty_id, care_specialties(name_bn, name_en)",
      )
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    const d = data as Record<string, unknown>;
    const spec = d.care_specialties as { name_bn?: string; name_en?: string } | null;
    return {
      id: String(d.id),
      full_name: String(d.full_name ?? ""),
      full_name_bn: (d.full_name_bn as string) ?? null,
      bmdc_no: (d.bmdc_no as string) ?? null,
      qualifications: (d.qualifications as string) ?? null,
      photo_url: (d.photo_url as string) ?? null,
      bio: (d.bio as string) ?? null,
      bio_bn: (d.bio_bn as string) ?? null,
      specialty_id: (d.specialty_id as string) ?? null,
      specialty_name_bn: spec?.name_bn ?? null,
      specialty_name_en: spec?.name_en ?? null,
      chambers: [] as CareDoctorListItem["chambers"],
    };
  }
  const { data } = await supabase.from("care_doctors").select("bio, bio_bn").eq("id", id).maybeSingle();
  return { ...found, bio: (data as { bio?: string } | null)?.bio ?? null, bio_bn: (data as { bio_bn?: string } | null)?.bio_bn ?? null };
}

export async function fetchSchedulesForAffiliations(affiliationIds: string[]): Promise<CareScheduleRow[]> {
  if (!affiliationIds.length) return [];
  const { data, error } = await supabase
    .from("care_schedules")
    .select(
      "id, affiliation_id, weekday, start_time, end_time, max_serial, start_number, allow_app_booking, allow_walk_in, booking_window_hours, slot_minutes, is_active",
    )
    .in("affiliation_id", affiliationIds)
    .eq("is_active", true)
    .order("weekday");
  if (error) {
    if (missing(error)) return [];
    throw new Error(error.message);
  }
  return (data as CareScheduleRow[]) ?? [];
}

export async function ensureCareSession(scheduleId: string, date: string): Promise<string> {
  const { data, error } = await supabase.rpc("care_ensure_session", {
    _schedule_id: scheduleId,
    _date: date,
  } as never);
  if (error) throw new Error(error.message);
  return data as string;
}

export async function fetchSession(id: string): Promise<CareSessionRow | null> {
  const { data, error } = await supabase
    .from("care_sessions")
    .select(
      "id, schedule_id, org_id, location_id, doctor_id, session_date, status, max_serial, start_number, last_issued, now_serving",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CareSessionRow) ?? null;
}

export async function fetchSessionByScheduleDate(scheduleId: string, date: string) {
  const { data, error } = await supabase
    .from("care_sessions")
    .select(
      "id, schedule_id, org_id, location_id, doctor_id, session_date, status, max_serial, start_number, last_issued, now_serving",
    )
    .eq("schedule_id", scheduleId)
    .eq("session_date", date)
    .maybeSingle();
  if (error) {
    if (missing(error)) return null;
    throw new Error(error.message);
  }
  return (data as CareSessionRow) ?? null;
}

export async function issueCareSerial(params: {
  sessionId: string;
  source?: "app" | "walk_in";
  guestName?: string;
  guestPhone?: string;
}): Promise<CareSerialRow> {
  const { data, error } = await supabase.rpc("care_issue_serial", {
    _session_id: params.sessionId,
    _guest_name: params.guestName ?? null,
    _guest_phone: params.guestPhone ?? null,
    _source: params.source ?? "app",
  } as never);
  if (error) throw new Error(error.message);
  return data as CareSerialRow;
}

export async function fetchMySerials(): Promise<(CareSerialRow & { session?: CareSessionRow | null })[]> {
  const { data, error } = await supabase
    .from("care_serials")
    .select(
      "id, session_id, serial_no, patient_id, guest_name, guest_phone, source, status, claim_code, invoice_no, fee_amount, payment_status, called_at, created_at, care_sessions(id, schedule_id, org_id, location_id, doctor_id, session_date, status, max_serial, start_number, last_issued, now_serving)",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    if (missing(error)) return [];
    throw new Error(error.message);
  }
  return ((data as Record<string, unknown>[]) ?? []).map((row) => ({
    ...(row as unknown as CareSerialRow),
    session: (row.care_sessions as CareSessionRow) ?? null,
  }));
}

export async function fetchSerial(id: string) {
  const { data, error } = await supabase
    .from("care_serials")
    .select(
      "id, session_id, serial_no, patient_id, guest_name, guest_phone, source, status, claim_code, invoice_no, fee_amount, payment_status, called_at, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as CareSerialRow) ?? null;
}

export async function fetchSessionQueue(sessionId: string): Promise<CareSerialRow[]> {
  const { data, error } = await supabase
    .from("care_serials")
    .select(
      "id, session_id, serial_no, patient_id, guest_name, guest_phone, source, status, claim_code, invoice_no, fee_amount, payment_status, called_at, created_at",
    )
    .eq("session_id", sessionId)
    .order("serial_no");
  if (error) throw new Error(error.message);
  return (data as CareSerialRow[]) ?? [];
}

export async function setSessionStatus(sessionId: string, status: string) {
  const { data, error } = await supabase.rpc("care_set_session_status", {
    _session_id: sessionId,
    _status: status,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareSessionRow;
}

export async function callNextSerial(sessionId: string) {
  const { data, error } = await supabase.rpc("care_call_next", { _session_id: sessionId } as never);
  if (error) throw new Error(error.message);
  return data as CareSerialRow;
}

export async function setSerialStatus(serialId: string, status: string) {
  const { data, error } = await supabase.rpc("care_set_serial_status", {
    _serial_id: serialId,
    _status: status,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareSerialRow;
}

export async function fetchOrgDoctors(orgId: string) {
  const { data, error } = await supabase
    .from("care_affiliations")
    .select(
      "id, doctor_id, location_id, fee_amount, is_active, care_doctors(id, full_name, full_name_bn, bmdc_no, specialty_id), care_locations(id, name, name_bn)",
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchOrgLocations(orgId: string) {
  const { data, error } = await supabase
    .from("care_locations")
    .select("id, org_id, name, name_bn, district_id, upazila, address, phone, is_active, sort_order")
    .eq("org_id", orgId)
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchOrgSessions(orgId: string, date: string) {
  const { data, error } = await supabase
    .from("care_sessions")
    .select(
      "id, schedule_id, org_id, location_id, doctor_id, session_date, status, max_serial, start_number, last_issued, now_serving",
    )
    .eq("org_id", orgId)
    .eq("session_date", date)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data as CareSessionRow[]) ?? [];
}

export function nextDatesForWeekday(weekday: number, count = 4): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  for (let i = 0; i < 21 && out.length < count; i++) {
    const cur = new Date(d);
    cur.setDate(d.getDate() + i);
    if (cur.getDay() === weekday) {
      out.push(cur.toISOString().slice(0, 10));
    }
  }
  return out;
}

export const WEEKDAY_BN = ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহস্পতি", "শুক্র", "শনি"];
export const WEEKDAY_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function queueAhead(serialNo: number, tickets: CareSerialRow[]) {
  return tickets.filter(
    (t) =>
      t.serial_no < serialNo &&
      ["booked", "checked_in", "called", "in_consult"].includes(t.status),
  ).length;
}

export function subscribeSession(
  sessionId: string,
  onChange: () => void,
): () => void {
  const ch = supabase
    .channel(`care-session-${sessionId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "care_sessions", filter: `id=eq.${sessionId}` },
      onChange,
    )
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "care_serials", filter: `session_id=eq.${sessionId}` },
      onChange,
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(ch);
  };
}
