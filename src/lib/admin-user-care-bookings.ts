import { supabase } from "@/integrations/supabase/client";

export type AdminUserCareBookingKind =
  | "serial"
  | "lab"
  | "video"
  | "operation"
  | "home"
  | "ambulance";

export type AdminUserCareBooking = {
  kind: AdminUserCareBookingKind;
  id: string;
  title: string;
  status: string;
  at: string;
  ref: string | null;
};

function pushRow(
  out: AdminUserCareBooking[],
  row: Omit<AdminUserCareBooking, "at"> & { at?: string | null },
) {
  if (!row.at) return;
  out.push({ ...row, at: row.at });
}

/** Care patient bookings for Admin → Users expand panel (admin/staff RLS). */
export async function fetchAdminUserCareBookings(userId: string): Promise<AdminUserCareBooking[]> {
  const [serials, labs, tele, ops, home, amb] = await Promise.all([
    supabase
      .from("care_serials")
      .select("id, serial_no, status, created_at")
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("care_lab_bookings")
      .select("id, reference_code, status, created_at, scheduled_date")
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("tele_bookings")
      .select("id, reference_code, status, slot_start, created_at")
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("care_operation_bookings")
      .select("id, reference_code, status, scheduled_date, created_at")
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("care_home_visit_bookings")
      .select("id, status, slot_start, created_at")
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("ambulance_requests")
      .select("id, reference_code, status, mode, scheduled_at, created_at")
      .eq("patient_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const out: AdminUserCareBooking[] = [];

  if (!serials.error) {
    for (const s of serials.data ?? []) {
      const no = s.serial_no != null ? String(s.serial_no) : "—";
      pushRow(out, {
        kind: "serial",
        id: s.id,
        title: `Serial #${no}`,
        status: String(s.status ?? ""),
        at: s.created_at,
        ref: null,
      });
    }
  }

  if (!labs.error) {
    for (const b of labs.data ?? []) {
      pushRow(out, {
        kind: "lab",
        id: b.id,
        title: "Lab test",
        status: String(b.status ?? ""),
        at: (b.scheduled_date as string | null) || b.created_at,
        ref: (b.reference_code as string | null) ?? null,
      });
    }
  }

  if (!tele.error) {
    for (const b of tele.data ?? []) {
      pushRow(out, {
        kind: "video",
        id: b.id,
        title: "Video consult",
        status: String(b.status ?? ""),
        at: (b.slot_start as string | null) || b.created_at,
        ref: (b.reference_code as string | null) ?? null,
      });
    }
  }

  if (!ops.error) {
    for (const b of ops.data ?? []) {
      pushRow(out, {
        kind: "operation",
        id: b.id,
        title: "Operation",
        status: String(b.status ?? ""),
        at: (b.scheduled_date as string | null) || b.created_at,
        ref: (b.reference_code as string | null) ?? null,
      });
    }
  }

  if (!home.error) {
    for (const b of home.data ?? []) {
      pushRow(out, {
        kind: "home",
        id: b.id,
        title: "Home visit",
        status: String(b.status ?? ""),
        at: (b.slot_start as string | null) || b.created_at,
        ref: null,
      });
    }
  }

  if (!amb.error) {
    for (const b of amb.data ?? []) {
      pushRow(out, {
        kind: "ambulance",
        id: b.id,
        title: b.mode === "emergency" ? "Ambulance (emergency)" : "Ambulance",
        status: String(b.status ?? ""),
        at: (b.scheduled_at as string | null) || b.created_at,
        ref: (b.reference_code as string | null) ?? null,
      });
    }
  }

  out.sort((a, b) => b.at.localeCompare(a.at));
  return out;
}

export function careBookingKindLabel(kind: AdminUserCareBookingKind, lang: "bn" | "en"): string {
  const map: Record<AdminUserCareBookingKind, { bn: string; en: string }> = {
    serial: { bn: "সিরিয়াল", en: "Serial" },
    lab: { bn: "ল্যাব", en: "Lab" },
    video: { bn: "ভিডিও", en: "Video" },
    operation: { bn: "অপারেশন", en: "Operation" },
    home: { bn: "হোম ভিজিট", en: "Home visit" },
    ambulance: { bn: "অ্যাম্বুলেন্স", en: "Ambulance" },
  };
  return lang === "bn" ? map[kind].bn : map[kind].en;
}
