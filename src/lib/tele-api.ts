import { supabase } from "@/integrations/supabase/client";
import type { TeleDoctorProfile, TeleDoctorSlot } from "@/lib/tele-cms";

export type TeleBooking = {
  id: string;
  patient_id: string;
  mode: "named" | "instant";
  doctor_id: string | null;
  specialty_id: string | null;
  offer_card_id: string | null;
  slot_start: string | null;
  slot_end: string | null;
  fee_amount: number;
  vat_amount: number;
  net_amount: number;
  payment_status: string;
  status: string;
  patient_phone: string | null;
  patient_name: string | null;
  notes: string | null;
  assigned_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TeleVideoDoctor = TeleDoctorProfile & {
  full_name: string;
  full_name_bn: string | null;
  photo_url: string | null;
  bmdc_no: string | null;
  qualifications: string | null;
  specialty_id: string | null;
  specialty_name_bn: string | null;
  specialty_name_en: string | null;
};

export type TeleZoomMeeting = {
  id: string;
  booking_id: string;
  zoom_meeting_id: string | null;
  join_url: string | null;
  start_url: string | null;
  password: string | null;
  raw_status: string | null;
};

export type TeleAiSummary = {
  id: string;
  booking_id: string;
  summary_bn: string | null;
  summary_en: string | null;
  key_points: unknown;
  status: string;
};

async function mapVideoDoctors(
  profiles: TeleDoctorProfile[],
): Promise<TeleVideoDoctor[]> {
  if (!profiles.length) return [];
  const ids = profiles.map((p) => p.doctor_id);
  const { data: docs, error } = await supabase
    .from("care_doctors")
    .select("id, full_name, full_name_bn, photo_url, bmdc_no, qualifications, specialty_id, care_specialties ( name_bn, name_en )")
    .in("id", ids)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  const map = new Map((docs ?? []).map((d) => [d.id as string, d]));
  const out: TeleVideoDoctor[] = [];
  for (const p of profiles) {
    const d = map.get(p.doctor_id) as
      | {
          full_name: string;
          full_name_bn: string | null;
          photo_url: string | null;
          bmdc_no: string | null;
          qualifications: string | null;
          specialty_id: string | null;
          care_specialties: { name_bn: string; name_en: string } | null;
        }
      | undefined;
    if (!d) continue;
    out.push({
      ...p,
      full_name: d.full_name,
      full_name_bn: d.full_name_bn,
      photo_url: d.photo_url,
      bmdc_no: d.bmdc_no,
      qualifications: d.qualifications,
      specialty_id: d.specialty_id,
      specialty_name_bn: d.care_specialties?.name_bn ?? null,
      specialty_name_en: d.care_specialties?.name_en ?? null,
    });
  }
  return out;
}

export async function searchTeleDoctors(opts?: {
  q?: string;
  specialtyId?: string;
  popularOnly?: boolean;
  instantOnly?: boolean;
}): Promise<TeleVideoDoctor[]> {
  let qy = supabase.from("tele_doctor_profiles").select("*").eq("video_enabled", true).order("sort_order");
  if (opts?.popularOnly) qy = qy.eq("is_popular", true);
  if (opts?.instantOnly) qy = qy.eq("instant_enabled", true);
  const { data, error } = await qy.limit(80);
  if (error) throw new Error(error.message);
  let list = await mapVideoDoctors((data ?? []) as TeleDoctorProfile[]);
  if (opts?.specialtyId) list = list.filter((d) => d.specialty_id === opts.specialtyId);
  const q = opts?.q?.trim().toLowerCase();
  if (q) {
    list = list.filter((d) =>
      `${d.full_name} ${d.full_name_bn ?? ""} ${d.specialty_name_en ?? ""} ${d.specialty_name_bn ?? ""}`
        .toLowerCase()
        .includes(q),
    );
  }
  return list;
}

export async function fetchTeleDoctor(doctorId: string): Promise<TeleVideoDoctor | null> {
  const { data, error } = await supabase
    .from("tele_doctor_profiles")
    .select("*")
    .eq("doctor_id", doctorId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const mapped = await mapVideoDoctors([data as TeleDoctorProfile]);
  return mapped[0] ?? null;
}

export async function upsertTeleDoctorProfile(row: Partial<TeleDoctorProfile> & { doctor_id: string }) {
  const { error } = await supabase.from("tele_doctor_profiles").upsert({
    ...row,
    updated_at: new Date().toISOString(),
  } as never);
  if (error) throw new Error(error.message);
}

export async function fetchTeleDoctorSlots(doctorId: string): Promise<TeleDoctorSlot[]> {
  const { data, error } = await supabase
    .from("tele_doctor_slots")
    .select("*")
    .eq("doctor_id", doctorId)
    .eq("is_active", true)
    .order("weekday")
    .order("start_time");
  if (error) throw new Error(error.message);
  return (data ?? []) as TeleDoctorSlot[];
}

export async function replaceTeleDoctorSlots(
  doctorId: string,
  slots: { weekday: number; start_time: string; end_time: string }[],
) {
  await supabase.from("tele_doctor_slots").delete().eq("doctor_id", doctorId);
  if (!slots.length) return;
  const { error } = await supabase.from("tele_doctor_slots").insert(
    slots.map((s) => ({ ...s, doctor_id: doctorId, is_active: true })) as never,
  );
  if (error) throw new Error(error.message);
}

export async function createTeleBooking(input: {
  mode: "named" | "instant";
  doctorId?: string;
  specialtyId?: string;
  offerCardId?: string;
  slotStart?: string;
  slotEnd?: string;
  patientPhone?: string;
  patientName?: string;
}): Promise<TeleBooking> {
  const { data, error } = await supabase.rpc("tele_create_booking", {
    _mode: input.mode,
    _doctor_id: input.doctorId ?? null,
    _specialty_id: input.specialtyId ?? null,
    _offer_card_id: input.offerCardId ?? null,
    _slot_start: input.slotStart ?? null,
    _slot_end: input.slotEnd ?? null,
    _patient_phone: input.patientPhone ?? null,
    _patient_name: input.patientName ?? null,
  });
  if (error) throw new Error(error.message);
  return data as TeleBooking;
}

export async function setTelePayment(bookingId: string, status: "pending" | "paid" | "waived" | "refunded") {
  const { data, error } = await supabase.rpc("tele_set_payment", {
    _booking_id: bookingId,
    _status: status,
  });
  if (error) throw new Error(error.message);
  return data as TeleBooking;
}

export async function setTeleStatus(bookingId: string, status: string) {
  const { data, error } = await supabase.rpc("tele_set_status", {
    _booking_id: bookingId,
    _status: status,
  });
  if (error) throw new Error(error.message);
  return data as TeleBooking;
}

export async function assignInstantDoctor(bookingId: string) {
  const { data, error } = await supabase.rpc("tele_assign_instant_doctor", {
    _booking_id: bookingId,
  });
  if (error) throw new Error(error.message);
  return data as TeleBooking;
}

export async function fetchMyTeleBookings(userId: string): Promise<TeleBooking[]> {
  const { data, error } = await supabase
    .from("tele_bookings")
    .select("*")
    .eq("patient_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return (data ?? []) as TeleBooking[];
}

export async function fetchTeleBooking(id: string): Promise<TeleBooking | null> {
  const { data, error } = await supabase.from("tele_bookings").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as TeleBooking | null;
}

export async function fetchConsultantTeleQueue(doctorId: string): Promise<TeleBooking[]> {
  const { data, error } = await supabase
    .from("tele_bookings")
    .select("*")
    .eq("doctor_id", doctorId)
    .in("status", ["confirmed", "ready", "in_call", "pending_payment"])
    .order("slot_start", { ascending: true, nullsFirst: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return (data ?? []) as TeleBooking[];
}

export async function fetchAllTeleBookingsAdmin(): Promise<TeleBooking[]> {
  const { data, error } = await supabase
    .from("tele_bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return (data ?? []) as TeleBooking[];
}

export async function fetchTeleZoomMeeting(bookingId: string): Promise<TeleZoomMeeting | null> {
  const { data, error } = await supabase
    .from("tele_zoom_meetings")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as TeleZoomMeeting | null;
}

export async function fetchTeleAiSummary(bookingId: string): Promise<TeleAiSummary | null> {
  const { data, error } = await supabase
    .from("tele_ai_summaries")
    .select("*")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as TeleAiSummary | null;
}

export async function setDoctorOnline(doctorId: string, online: boolean) {
  const { error } = await supabase
    .from("tele_doctor_profiles")
    .update({ is_online: online, updated_at: new Date().toISOString() } as never)
    .eq("doctor_id", doctorId);
  if (error) throw new Error(error.message);
}

/** Link current login to an unlinked video doctor (consultant desk claim). */
export async function claimTeleDoctor(doctorId: string) {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const { teleLinkDoctorFn } = await import("@/lib/tele-link-doctor.server");
  const res = await teleLinkDoctorFn({
    data: { action: "claim", doctorId, accessToken: token },
  });
  return res.doctor as { id: string; user_id: string | null; full_name: string };
}

/** Admin: link any user UUID to a care doctor. */
export async function adminLinkTeleDoctor(doctorId: string, userId: string) {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Not authenticated");
  const { teleLinkDoctorFn } = await import("@/lib/tele-link-doctor.server");
  const res = await teleLinkDoctorFn({
    data: { action: "admin_link", doctorId, accessToken: token, userId },
  });
  return res.doctor;
}

export async function fetchUnlinkedVideoDoctors(): Promise<TeleVideoDoctor[]> {
  const all = await searchTeleDoctors({});
  if (!all.length) return [];
  const { data, error } = await supabase
    .from("care_doctors")
    .select("id, user_id")
    .in(
      "id",
      all.map((d) => d.doctor_id),
    );
  if (error) throw new Error(error.message);
  const linked = new Set(
    (data ?? []).filter((r) => (r as { user_id?: string | null }).user_id).map((r) => (r as { id: string }).id),
  );
  return all.filter((d) => !linked.has(d.doctor_id));
}

export async function fetchMyLinkedTeleDoctorId(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("care_doctors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as { id?: string } | null)?.id ?? null;
}

/** Call Zoom edge to ensure meeting exists; returns join/start urls. */
export async function ensureTeleZoomMeeting(bookingId: string, role: "patient" | "host") {
  const { data: session } = await supabase.auth.getSession();
  const token = session.session?.access_token;
  if (!token) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("zoom-meetings", {
    body: { action: "ensure", booking_id: bookingId, role },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return data as {
    join_url?: string;
    start_url?: string;
    password?: string;
    meeting_id?: string;
  };
}

export async function requestTeleSummarize(bookingId: string) {
  const { data, error } = await supabase.functions.invoke("tele-summarize", {
    body: { booking_id: bookingId },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(String(data.error));
  return data;
}

export async function submitTeleReview(input: {
  bookingId: string;
  doctorId: string;
  rating: number;
  comment?: string;
}) {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error("Not authenticated");
  const { error } = await supabase.from("tele_reviews").insert({
    booking_id: input.bookingId,
    doctor_id: input.doctorId,
    patient_id: user.user.id,
    rating: input.rating,
    comment: input.comment ?? null,
  } as never);
  if (error) throw new Error(error.message);
}

export const WEEKDAY_LABELS = {
  bn: ["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহ", "শুক্র", "শনি"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
} as const;
