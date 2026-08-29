import { supabase } from "@/integrations/supabase/client";

export type CareDoctorOption = {
  id: string;
  full_name: string;
  full_name_bn?: string | null;
  bmdc_no?: string | null;
  doctor_code?: string | null;
  qualifications?: string | null;
  photo_url?: string | null;
  specialty_id?: string | null;
  specialty_name_bn?: string | null;
  specialty_name_en?: string | null;
  /** How many clinics this doctor is affiliated with. */
  org_count?: number | null;
  /** True when already affiliated with the org that ran the search. */
  in_org?: boolean | null;
  registration_status?: string | null;
  has_account?: boolean | null;
};

/** Free-text entries carry this prefix until they are committed to the DB. */
export const CUSTOM_DOCTOR_PREFIX = "custom:";

export function customDoctor(name: string): CareDoctorOption {
  const trimmed = name.trim();
  return { id: `${CUSTOM_DOCTOR_PREFIX}${trimmed}`, full_name: trimmed };
}

export function isCustomDoctor(doctor: CareDoctorOption | null | undefined): boolean {
  return !!doctor?.id.startsWith(CUSTOM_DOCTOR_PREFIX);
}

export function doctorDisplayName(doctor: CareDoctorOption, lang: "bn" | "en"): string {
  if (lang === "bn") return doctor.full_name_bn || doctor.full_name;
  return doctor.full_name;
}

/** Matches any substring of the name or BMDC number, server-side. */
export async function searchCareDoctors(
  q: string,
  opts?: { orgId?: string | null; limit?: number },
): Promise<CareDoctorOption[]> {
  const { data, error } = await supabase.rpc("care_doctors_search", {
    _q: q?.trim() || null,
    _limit: opts?.limit ?? 20,
    _org_id: opts?.orgId ?? null,
  } as never);
  if (error) {
    // Before the migration lands, fall back to a plain table scan.
    if (/care_doctors_search|could not find/i.test(error.message)) {
      const retry = await supabase
        .from("care_doctors")
        .select("id, full_name, full_name_bn, bmdc_no, qualifications, photo_url, specialty_id")
        .eq("is_active", true)
        .ilike("full_name", `%${q.trim()}%`)
        .order("full_name")
        .limit(opts?.limit ?? 20);
      if (retry.error) throw new Error(retry.error.message);
      return (retry.data ?? []) as CareDoctorOption[];
    }
    throw new Error(error.message);
  }
  return (data ?? []) as CareDoctorOption[];
}

/**
 * Resolves a typeahead selection to a real care_doctors id, creating the record
 * when the desk typed a name that is not in the catalog yet.
 */
export async function resolveDoctorId(
  doctor: CareDoctorOption,
  extra?: { bmdcNo?: string | null; specialtyId?: string | null; qualifications?: string | null },
): Promise<string> {
  if (!isCustomDoctor(doctor)) return doctor.id;
  const { data, error } = await supabase.rpc("care_find_or_create_doctor", {
    _full_name: doctor.full_name,
    _bmdc_no: extra?.bmdcNo ?? doctor.bmdc_no ?? null,
    _specialty_id: extra?.specialtyId ?? doctor.specialty_id ?? null,
    _qualifications: extra?.qualifications ?? doctor.qualifications ?? null,
  } as never);
  if (error) throw new Error(error.message);
  return String(data);
}

export type CareDoctorAdminRow = CareDoctorOption & {
  is_active: boolean;
  bio?: string | null;
  bio_bn?: string | null;
  created_at?: string;
  registration_status?: string | null;
  user_id?: string | null;
  doctor_code?: string | null;
  phone?: string | null;
  email?: string | null;
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  district_id?: string | null;
  nid_passport?: string | null;
  doctor_type?: string | null;
};

const ADMIN_DOCTOR_SELECT =
  "id, full_name, full_name_bn, bmdc_no, doctor_code, qualifications, photo_url, bio, bio_bn, specialty_id, is_active, created_at, registration_status, user_id, phone, email, title, first_name, last_name, date_of_birth, gender, district_id, nid_passport, doctor_type";

export async function fetchDoctorsForAdmin(
  q: string,
  limit = 80,
  statusFilter?: "all" | "pending" | "active" | "suspended",
): Promise<CareDoctorAdminRow[]> {
  let query = supabase
    .from("care_doctors")
    .select(ADMIN_DOCTOR_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);
  const needle = q.trim();
  if (needle) {
    query = query.or(
      `full_name.ilike.%${needle}%,bmdc_no.ilike.%${needle}%,doctor_code.ilike.%${needle}%,phone.ilike.%${needle}%`,
    );
  }
  if (statusFilter && statusFilter !== "all") {
    query = query.eq("registration_status", statusFilter);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as CareDoctorAdminRow[];
}

export async function createCareDoctorAdmin(input: {
  full_name: string;
  full_name_bn?: string | null;
  title?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  district_id?: string | null;
  nid_passport?: string | null;
  bmdc_no?: string | null;
  doctor_type?: string | null;
  phone?: string | null;
  email?: string | null;
  specialty_id?: string | null;
  qualifications?: string | null;
  photo_url?: string | null;
  bio?: string | null;
  bio_bn?: string | null;
  registration_status?: string;
}) {
  const { data, error } = await supabase.rpc("care_admin_create_doctor", {
    _full_name: input.full_name,
    _full_name_bn: input.full_name_bn ?? null,
    _title: input.title ?? null,
    _first_name: input.first_name ?? null,
    _last_name: input.last_name ?? null,
    _date_of_birth: input.date_of_birth || null,
    _gender: input.gender ?? null,
    _district_id: input.district_id ?? null,
    _nid_passport: input.nid_passport ?? null,
    _bmdc_no: input.bmdc_no ?? null,
    _doctor_type: input.doctor_type ?? null,
    _phone: input.phone ?? null,
    _email: input.email ?? null,
    _specialty_id: input.specialty_id ?? null,
    _qualifications: input.qualifications ?? null,
    _photo_url: input.photo_url ?? null,
    _bio: input.bio ?? null,
    _bio_bn: input.bio_bn ?? null,
    _registration_status: input.registration_status ?? "active",
  } as never);
  if (error) throw new Error(error.message);
  return data as CareDoctorAdminRow;
}

export async function setDoctorRegistrationStatus(doctorId: string, status: string) {
  const { data, error } = await supabase.rpc("care_admin_set_doctor_status", {
    _doctor_id: doctorId,
    _status: status,
  } as never);
  if (error) throw new Error(error.message);
  return data as CareDoctorAdminRow;
}

export async function updateCareDoctor(
  id: string,
  patch: Partial<
    Pick<
      CareDoctorAdminRow,
      | "full_name"
      | "full_name_bn"
      | "bmdc_no"
      | "qualifications"
      | "photo_url"
      | "bio"
      | "bio_bn"
      | "specialty_id"
      | "doctor_code"
      | "registration_status"
      | "phone"
      | "email"
      | "title"
      | "first_name"
      | "last_name"
      | "date_of_birth"
      | "gender"
      | "district_id"
      | "nid_passport"
      | "doctor_type"
    > & { is_active: boolean }
  >,
) {
  const { error } = await supabase.from("care_doctors").update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
}

export type CareDoctorVideoClaim = {
  id: string;
  doctor_id: string;
  user_id: string;
  status: string;
  requested_at: string;
  doctor_name?: string | null;
  doctor_code?: string | null;
};

export async function fetchPendingVideoClaims(): Promise<CareDoctorVideoClaim[]> {
  const { data, error } = await supabase
    .from("care_doctor_video_claims")
    .select("id, doctor_id, user_id, status, requested_at, care_doctors(full_name, doctor_code)")
    .eq("status", "pending")
    .order("requested_at", { ascending: false })
    .limit(50);
  if (error) {
    if (/care_doctor_video_claims|schema cache/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const d = r.care_doctors as { full_name?: string; doctor_code?: string } | null;
    return {
      id: String(r.id),
      doctor_id: String(r.doctor_id),
      user_id: String(r.user_id),
      status: String(r.status),
      requested_at: String(r.requested_at),
      doctor_name: d?.full_name ?? null,
      doctor_code: d?.doctor_code ?? null,
    };
  });
}

export async function respondVideoClaim(claimId: string, approve: boolean) {
  const { data, error } = await supabase.rpc("care_respond_video_claim", {
    _claim_id: claimId,
    _approve: approve,
  } as never);
  if (error) throw new Error(error.message);
  return data;
}

export async function requestVideoClaim(doctorId: string) {
  const { data, error } = await supabase.rpc("care_request_video_claim", {
    _doctor_id: doctorId,
  } as never);
  if (error) throw new Error(error.message);
  return data as { status: string; claim_id?: string; doctor_id?: string };
}

export async function fetchMyPendingVideoClaim(userId: string) {
  const { data, error } = await supabase
    .from("care_doctor_video_claims")
    .select("id, doctor_id, status, requested_at, care_doctors(full_name, doctor_code)")
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  if (error) {
    if (/care_doctor_video_claims|schema cache/i.test(error.message)) return null;
    throw new Error(error.message);
  }
  if (!data) return null;
  const d = (data as { care_doctors?: { full_name?: string; doctor_code?: string } }).care_doctors;
  return {
    id: String((data as { id: string }).id),
    doctor_id: String((data as { doctor_id: string }).doctor_id),
    status: String((data as { status: string }).status),
    requested_at: String((data as { requested_at: string }).requested_at),
    doctor_name: d?.full_name ?? null,
    doctor_code: d?.doctor_code ?? null,
  };
}

export async function requestDoctorLink(input: {
  doctorId: string;
  orgId: string;
  kind: "affiliation" | "operation";
  locationId?: string | null;
  offeringId?: string | null;
  role?: string | null;
  payload?: Record<string, unknown>;
}) {
  const { data, error } = await supabase.rpc("care_request_doctor_link", {
    _doctor_id: input.doctorId,
    _org_id: input.orgId,
    _kind: input.kind,
    _location_id: input.locationId ?? null,
    _offering_id: input.offeringId ?? null,
    _role: input.role ?? null,
    _payload: input.payload ?? {},
  } as never);
  if (error) throw new Error(error.message);
  return data;
}

export async function respondDoctorLink(requestId: string, approve: boolean) {
  const { data, error } = await supabase.rpc("care_respond_doctor_link", {
    _request_id: requestId,
    _approve: approve,
  } as never);
  if (error) throw new Error(error.message);
  return data;
}

export type CareDoctorClinicRow = {
  org_id: string;
  org_name: string;
  location_id: string;
  location_name: string;
  fee_amount: number | null;
};

/** Which clinics a doctor sits at, and the consultation fee at each. */
export async function fetchDoctorClinics(doctorId: string): Promise<CareDoctorClinicRow[]> {
  const { data, error } = await supabase
    .from("care_affiliations")
    .select("org_id, location_id, fee_amount, care_orgs(name, name_bn), care_locations(name, name_bn)")
    .eq("doctor_id", doctorId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => {
    const org = r.care_orgs as { name?: string; name_bn?: string } | null;
    const loc = r.care_locations as { name?: string; name_bn?: string } | null;
    return {
      org_id: String(r.org_id),
      org_name: org?.name ?? "",
      location_id: String(r.location_id),
      location_name: loc?.name ?? "",
      fee_amount: r.fee_amount != null ? Number(r.fee_amount) : null,
    };
  });
}

export type CareDoctorDuplicateGroup = {
  match_key: string;
  doctor_ids: string[];
  full_names: string[];
  n: number;
};

export async function fetchDoctorDuplicates(limit = 50): Promise<CareDoctorDuplicateGroup[]> {
  const { data, error } = await supabase.rpc("care_doctor_duplicates", { _limit: limit } as never);
  if (error) {
    if (/care_doctor_duplicates|could not find/i.test(error.message)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as CareDoctorDuplicateGroup[];
}

export async function mergeCareDoctors(keepId: string, dropId: string) {
  const { error } = await supabase.rpc("care_merge_doctors", {
    _keep_id: keepId,
    _drop_id: dropId,
  } as never);
  if (error) throw new Error(error.message);
}
