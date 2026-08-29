import { supabase } from "@/integrations/supabase/client";
import { respondDoctorLink } from "@/lib/care-doctors-api";

export type DoctorLinkRequest = {
  id: string;
  doctor_id: string;
  org_id: string;
  kind: "affiliation" | "operation";
  location_id: string | null;
  offering_id: string | null;
  role: string | null;
  payload: Record<string, unknown>;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  org_name?: string | null;
  org_name_bn?: string | null;
  location_name?: string | null;
};

export type DoctorAffiliationRow = {
  id: string;
  org_id: string;
  location_id: string;
  fee_amount: number | null;
  is_active: boolean;
  org_name: string;
  org_name_bn: string | null;
  location_name: string;
  location_name_bn: string | null;
};

export type DoctorSerialSummary = {
  session_id: string;
  session_date: string;
  org_name: string;
  location_name: string;
  serial_count: number;
  affiliation_id: string;
};

export type DoctorOperationRow = {
  id: string;
  role: string;
  offering_id: string;
  catalog_name: string;
  org_name: string;
  location_name: string;
};

export async function fetchDoctorLinkRequests(doctorId: string): Promise<DoctorLinkRequest[]> {
  const { data, error } = await supabase
    .from("care_doctor_link_requests")
    .select(
      "id, doctor_id, org_id, kind, location_id, offering_id, role, payload, status, created_at, care_orgs(name, name_bn), care_locations(name, name_bn)",
    )
    .eq("doctor_id", doctorId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    if (/care_doctor_link_requests|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const org = r.care_orgs as { name?: string; name_bn?: string } | null;
    const loc = r.care_locations as { name?: string; name_bn?: string } | null;
    return {
      id: String(r.id),
      doctor_id: String(r.doctor_id),
      org_id: String(r.org_id),
      kind: r.kind as DoctorLinkRequest["kind"],
      location_id: (r.location_id as string | null) ?? null,
      offering_id: (r.offering_id as string | null) ?? null,
      role: (r.role as string | null) ?? null,
      payload: (r.payload as Record<string, unknown>) ?? {},
      status: r.status as DoctorLinkRequest["status"],
      created_at: String(r.created_at),
      org_name: org?.name ?? null,
      org_name_bn: org?.name_bn ?? null,
      location_name: loc?.name ?? null,
    };
  });
}

export async function approveDoctorLink(requestId: string) {
  return respondDoctorLink(requestId, true);
}

export async function rejectDoctorLink(requestId: string) {
  return respondDoctorLink(requestId, false);
}

export async function fetchDoctorAffiliations(doctorId: string): Promise<DoctorAffiliationRow[]> {
  const { data, error } = await supabase
    .from("care_affiliations")
    .select(
      "id, org_id, location_id, fee_amount, is_active, care_orgs(name, name_bn), care_locations(name, name_bn)",
    )
    .eq("doctor_id", doctorId)
    .eq("is_active", true);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const org = r.care_orgs as { name?: string; name_bn?: string } | null;
    const loc = r.care_locations as { name?: string; name_bn?: string } | null;
    return {
      id: String(r.id),
      org_id: String(r.org_id),
      location_id: String(r.location_id),
      fee_amount: r.fee_amount != null ? Number(r.fee_amount) : null,
      is_active: !!r.is_active,
      org_name: org?.name ?? "",
      org_name_bn: org?.name_bn ?? null,
      location_name: loc?.name ?? "",
      location_name_bn: loc?.name_bn ?? null,
    };
  });
}

export async function fetchDoctorUpcomingSerials(doctorId: string): Promise<DoctorSerialSummary[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data: sessions, error } = await supabase
    .from("care_sessions")
    .select(
      "id, session_date, org_id, location_id, care_orgs(name, name_bn), care_locations(name, name_bn)",
    )
    .eq("doctor_id", doctorId)
    .gte("session_date", today)
    .order("session_date")
    .limit(30);
  if (error) throw new Error(error.message);
  const list = (sessions ?? []) as Record<string, unknown>[];
  if (!list.length) return [];

  const sessionIds = list.map((s) => String(s.id));
  const { data: serials } = await supabase
    .from("care_serials")
    .select("session_id")
    .in("session_id", sessionIds);
  const countMap = new Map<string, number>();
  for (const s of serials ?? []) {
    const sid = String((s as { session_id: string }).session_id);
    countMap.set(sid, (countMap.get(sid) ?? 0) + 1);
  }

  return list.map((s) => {
    const org = s.care_orgs as { name?: string; name_bn?: string } | null;
    const loc = s.care_locations as { name?: string; name_bn?: string } | null;
    return {
      session_id: String(s.id),
      session_date: String(s.session_date),
      org_name: org?.name ?? "",
      location_name: loc?.name ?? "",
      serial_count: countMap.get(String(s.id)) ?? 0,
      affiliation_id: "",
    };
  });
}

export async function fetchDoctorOperations(doctorId: string): Promise<DoctorOperationRow[]> {
  const { data, error } = await supabase
    .from("care_operation_offering_doctors")
    .select(
      "id, role, offering_id, care_operation_offerings(id, care_operation_catalog(name_bn, name_en), care_orgs(name, name_bn), care_locations(name, name_bn))",
    )
    .eq("doctor_id", doctorId)
    .limit(50);
  if (error) {
    if (/care_operation_offering_doctors|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const off = r.care_operation_offerings as Record<string, unknown> | null;
    const cat = off?.care_operation_catalog as { name_bn?: string; name_en?: string } | null;
    const org = off?.care_orgs as { name?: string; name_bn?: string } | null;
    const loc = off?.care_locations as { name?: string; name_bn?: string } | null;
    return {
      id: String(r.id),
      role: String(r.role ?? ""),
      offering_id: String(r.offering_id),
      catalog_name: cat?.name_en || cat?.name_bn || "",
      org_name: org?.name ?? "",
      location_name: loc?.name ?? "",
    };
  });
}
