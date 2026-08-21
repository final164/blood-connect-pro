import { supabase } from "@/integrations/supabase/client";

export type AmbulanceRequest = {
  id: string;
  org_id: string | null;
  patient_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  mode: "emergency" | "scheduled";
  scheduled_at: string | null;
  service_type_id: string | null;
  equipment_ids: string[];
  priority_id: string | null;
  status: string;
  assigned_vehicle_id: string | null;
  assigned_driver_id: string | null;
  reference_code: string;
  invoice_no: string | null;
  payment_status: "pending" | "paid" | "waived";
  estimated_fare: number | null;
  final_fare: number | null;
  fare_original?: number | null;
  discount_percent?: number | null;
  distance_km: number | null;
  source: string;
  notes: string | null;
  patient_condition: string | null;
  pickup_address: string | null;
  pickup_district_id: string | null;
  pickup_upazila: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  dropoff_address: string | null;
  dropoff_district_id: string | null;
  dropoff_upazila: string | null;
  dropoff_lat: number | null;
  dropoff_lng: number | null;
  extra_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AmbulanceVehicle = {
  id: string;
  org_id: string;
  service_type_id: string | null;
  plate_no: string;
  label: string | null;
  equipment_ids: string[];
  capacity: number;
  gps_phone: string | null;
  status: "available" | "busy" | "offline";
  is_active: boolean;
};

export type AmbulanceDriver = {
  id: string;
  org_id: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  license_no: string | null;
  is_active: boolean;
};

export type AmbulanceOffering = {
  id: string;
  org_id: string;
  service_type_id: string;
  base_price: number;
  per_km_price: number;
  min_fare: number;
  discount_percent: number;
  home_pickup: boolean;
  is_active: boolean;
};

export type AmbulanceCoverageArea = {
  id: string;
  org_id: string;
  district_id: string | null;
  upazilas: string[];
  radius_km: number | null;
  is_active: boolean;
};

export type CreateAmbulanceRequestPayload = {
  mode?: "emergency" | "scheduled";
  org_id?: string;
  service_type_id?: string;
  equipment_ids?: string[];
  scheduled_at?: string;
  guest_name?: string;
  guest_phone?: string;
  patient_id?: string;
  notes?: string;
  patient_condition?: string;
  pickup_address?: string;
  pickup_district_id?: string;
  pickup_upazila?: string;
  pickup_lat?: number;
  pickup_lng?: number;
  dropoff_address?: string;
  dropoff_district_id?: string;
  dropoff_upazila?: string;
  dropoff_lat?: number;
  dropoff_lng?: number;
  distance_km?: number;
  source?: "app" | "walk_in" | "phone";
  extra_fields?: Record<string, unknown>;
};

const REQUEST_SELECT =
  "id, org_id, patient_id, guest_name, guest_phone, mode, scheduled_at, service_type_id, equipment_ids, priority_id, status, assigned_vehicle_id, assigned_driver_id, reference_code, invoice_no, payment_status, estimated_fare, final_fare, fare_original, discount_percent, distance_km, source, notes, patient_condition, pickup_address, pickup_district_id, pickup_upazila, pickup_lat, pickup_lng, dropoff_address, dropoff_district_id, dropoff_upazila, dropoff_lat, dropoff_lng, extra_fields, created_at, updated_at";

const REQUEST_SELECT_LEGACY =
  "id, org_id, patient_id, guest_name, guest_phone, mode, scheduled_at, service_type_id, equipment_ids, priority_id, status, assigned_vehicle_id, assigned_driver_id, reference_code, invoice_no, payment_status, estimated_fare, final_fare, distance_km, source, notes, patient_condition, pickup_address, pickup_district_id, pickup_upazila, pickup_lat, pickup_lng, dropoff_address, dropoff_district_id, dropoff_upazila, dropoff_lat, dropoff_lng, extra_fields, created_at, updated_at";

function missing(err: { message?: string; code?: string }) {
  return err.code === "PGRST205" || /does not exist/i.test(err.message ?? "");
}

export async function createAmbulanceRequest(payload: CreateAmbulanceRequestPayload): Promise<AmbulanceRequest> {
  const { data, error } = await supabase.rpc("ambulance_create_request", { _payload: payload } as never);
  if (error) throw new Error(error.message);
  return data as AmbulanceRequest;
}

export async function fetchAmbulanceRequest(id: string): Promise<AmbulanceRequest | null> {
  const primary = await supabase.from("ambulance_requests").select(REQUEST_SELECT).eq("id", id).maybeSingle();
  if (primary.error && /fare_original|discount_percent/i.test(primary.error.message ?? "")) {
    const legacy = await supabase.from("ambulance_requests").select(REQUEST_SELECT_LEGACY).eq("id", id).maybeSingle();
    if (legacy.error) throw new Error(legacy.error.message);
    return (legacy.data as AmbulanceRequest) ?? null;
  }
  if (primary.error) throw new Error(primary.error.message);
  return (primary.data as AmbulanceRequest) ?? null;
}

export async function fetchMyAmbulanceRequests(): Promise<AmbulanceRequest[]> {
  const primary = await supabase
    .from("ambulance_requests")
    .select(REQUEST_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);
  if (primary.error && /fare_original|discount_percent/i.test(primary.error.message ?? "")) {
    const legacy = await supabase
      .from("ambulance_requests")
      .select(REQUEST_SELECT_LEGACY)
      .order("created_at", { ascending: false })
      .limit(50);
    if (legacy.error) {
      if (missing(legacy.error)) return [];
      throw new Error(legacy.error.message);
    }
    return (legacy.data ?? []) as AmbulanceRequest[];
  }
  if (primary.error) {
    if (missing(primary.error)) return [];
    throw new Error(primary.error.message);
  }
  return (primary.data ?? []) as AmbulanceRequest[];
}

export async function fetchOrgAmbulanceRequests(orgId: string, statusFilter?: string[]): Promise<AmbulanceRequest[]> {
  let q = supabase.from("ambulance_requests").select(REQUEST_SELECT).eq("org_id", orgId).order("created_at", { ascending: false }).limit(100);
  if (statusFilter?.length) q = q.in("status", statusFilter);
  const primary = await q;
  if (primary.error && /fare_original|discount_percent/i.test(primary.error.message ?? "")) {
    let q2 = supabase.from("ambulance_requests").select(REQUEST_SELECT_LEGACY).eq("org_id", orgId).order("created_at", { ascending: false }).limit(100);
    if (statusFilter?.length) q2 = q2.in("status", statusFilter);
    const legacy = await q2;
    if (legacy.error) throw new Error(legacy.error.message);
    return (legacy.data ?? []) as AmbulanceRequest[];
  }
  if (primary.error) throw new Error(primary.error.message);
  return (primary.data ?? []) as AmbulanceRequest[];
}

export async function fetchOpenAmbulancePool(): Promise<AmbulanceRequest[]> {
  const primary = await supabase
    .from("ambulance_requests")
    .select(REQUEST_SELECT)
    .is("org_id", null)
    .eq("status", "requested")
    .order("created_at", { ascending: false })
    .limit(50);
  if (primary.error && /fare_original|discount_percent/i.test(primary.error.message ?? "")) {
    const legacy = await supabase
      .from("ambulance_requests")
      .select(REQUEST_SELECT_LEGACY)
      .is("org_id", null)
      .eq("status", "requested")
      .order("created_at", { ascending: false })
      .limit(50);
    if (legacy.error) throw new Error(legacy.error.message);
    return (legacy.data ?? []) as AmbulanceRequest[];
  }
  if (primary.error) throw new Error(primary.error.message);
  return (primary.data ?? []) as AmbulanceRequest[];
}

export async function acceptAmbulanceRequest(requestId: string, orgId: string): Promise<AmbulanceRequest> {
  const { data, error } = await supabase.rpc("ambulance_accept_request", {
    _request_id: requestId,
    _org_id: orgId,
  } as never);
  if (error) throw new Error(error.message);
  return data as AmbulanceRequest;
}

export async function assignAmbulanceRequest(
  requestId: string,
  vehicleId: string,
  driverId: string,
): Promise<AmbulanceRequest> {
  const { data, error } = await supabase.rpc("ambulance_assign_request", {
    _request_id: requestId,
    _vehicle_id: vehicleId,
    _driver_id: driverId,
  } as never);
  if (error) throw new Error(error.message);
  return data as AmbulanceRequest;
}

export async function setAmbulanceRequestStatus(
  requestId: string,
  status: string,
  meta?: Record<string, unknown>,
): Promise<AmbulanceRequest> {
  const { data, error } = await supabase.rpc("ambulance_set_request_status", {
    _request_id: requestId,
    _status: status,
    _meta: meta ?? {},
  } as never);
  if (error) throw new Error(error.message);
  return data as AmbulanceRequest;
}

export async function calculateAmbulanceFare(orgId: string, serviceTypeId: string, distanceKm = 5): Promise<number | null> {
  const breakdown = await fetchAmbulanceFareBreakdown(orgId, serviceTypeId, distanceKm);
  return breakdown?.sale_fare ?? null;
}

export async function fetchAmbulanceFareBreakdown(
  orgId: string,
  serviceTypeId: string,
  distanceKm = 5,
): Promise<import("@/lib/ambulance-price").AmbulanceFareBreakdown | null> {
  const { data, error } = await supabase.rpc("ambulance_fare_breakdown", {
    _org_id: orgId,
    _service_type_id: serviceTypeId,
    _distance_km: distanceKm,
  } as never);
  if (!error && data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    return {
      base_price: Number(d.base_price) || 0,
      per_km_price: Number(d.per_km_price) || 0,
      min_fare: Number(d.min_fare) || 0,
      distance_km: Number(d.distance_km) || distanceKm,
      discount_percent: Number(d.discount_percent) || 0,
      list_fare: Number(d.list_fare) || 0,
      sale_fare: Number(d.sale_fare) || 0,
      saved: Number(d.saved) || 0,
    };
  }
  const offerings = await fetchOrgOfferings(orgId);
  const off = offerings.find((o) => o.service_type_id === serviceTypeId && o.is_active);
  if (!off) {
    const { data: sale, error: e2 } = await supabase.rpc("ambulance_calculate_fare", {
      _org_id: orgId,
      _service_type_id: serviceTypeId,
      _distance_km: distanceKm,
    } as never);
    if (e2 || sale == null) return null;
    const n = Number(sale);
    return {
      base_price: 0,
      per_km_price: 0,
      min_fare: 0,
      distance_km: distanceKm,
      discount_percent: 0,
      list_fare: n,
      sale_fare: n,
      saved: 0,
    };
  }
  const { computeAmbulanceFare } = await import("@/lib/ambulance-price");
  return computeAmbulanceFare({
    base_price: off.base_price,
    per_km_price: off.per_km_price,
    min_fare: off.min_fare,
    discount_percent: off.discount_percent,
    distance_km: distanceKm,
  });
}

export async function setAmbulancePayment(requestId: string, paymentStatus: AmbulanceRequest["payment_status"]) {
  const { data, error } = await supabase.rpc("ambulance_set_payment", {
    _request_id: requestId,
    _payment_status: paymentStatus,
  } as never);
  if (error) throw new Error(error.message);
  return data as AmbulanceRequest;
}

export async function fetchOrgVehicles(orgId: string): Promise<AmbulanceVehicle[]> {
  const { data, error } = await supabase
    .from("ambulance_vehicles")
    .select("id, org_id, service_type_id, plate_no, label, equipment_ids, capacity, gps_phone, status, is_active")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AmbulanceVehicle[];
}

export async function fetchOrgDrivers(orgId: string): Promise<AmbulanceDriver[]> {
  const { data, error } = await supabase
    .from("ambulance_drivers")
    .select("id, org_id, user_id, full_name, phone, license_no, is_active")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as AmbulanceDriver[];
}

export async function fetchOrgOfferings(orgId: string): Promise<AmbulanceOffering[]> {
  const primary = await supabase
    .from("ambulance_service_offerings")
    .select("id, org_id, service_type_id, base_price, per_km_price, min_fare, discount_percent, home_pickup, is_active")
    .eq("org_id", orgId);
  if (primary.error && /discount_percent/i.test(primary.error.message ?? "")) {
    const legacy = await supabase
      .from("ambulance_service_offerings")
      .select("id, org_id, service_type_id, base_price, per_km_price, min_fare, home_pickup, is_active")
      .eq("org_id", orgId);
    if (legacy.error) throw new Error(legacy.error.message);
    return ((legacy.data ?? []) as Omit<AmbulanceOffering, "discount_percent">[]).map((o) => ({
      ...o,
      discount_percent: 0,
    }));
  }
  if (primary.error) throw new Error(primary.error.message);
  return ((primary.data ?? []) as AmbulanceOffering[]).map((o) => ({
    ...o,
    discount_percent: Number(o.discount_percent) || 0,
  }));
}

export async function fetchOrgCoverage(orgId: string): Promise<AmbulanceCoverageArea[]> {
  const { data, error } = await supabase
    .from("ambulance_coverage_areas")
    .select("id, org_id, district_id, upazilas, radius_km, is_active")
    .eq("org_id", orgId);
  if (error) throw new Error(error.message);
  return (data ?? []) as AmbulanceCoverageArea[];
}

export async function fetchListedAmbulanceProviders(districtId?: string) {
  const { data: kind } = await supabase.from("care_vendor_types").select("id").eq("slug", "ambulance").maybeSingle();
  if (!kind?.id) return [];
  let q = supabase
    .from("care_orgs")
    .select("id, name, name_bn, phone, district_id, upazila, address, is_verified, is_listed, featured")
    .eq("org_kind_id", kind.id)
    .eq("is_active", true)
    .eq("is_listed", true)
    .eq("is_verified", true);
  if (districtId) q = q.eq("district_id", districtId);
  const { data, error } = await q.order("featured", { ascending: false }).order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchRequestEvents(requestId: string) {
  const { data, error } = await supabase
    .from("ambulance_request_events")
    .select("id, event_type, from_status, to_status, meta, created_at, actor_id")
    .eq("request_id", requestId)
    .order("created_at");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export function subscribeAmbulanceRequests(orgId: string, onChange: () => void) {
  const channel = supabase
    .channel(`ambulance-org-${orgId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ambulance_requests", filter: `org_id=eq.${orgId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export function subscribeAmbulanceRequest(requestId: string, onChange: () => void) {
  const channel = supabase
    .channel(`ambulance-req-${requestId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "ambulance_requests", filter: `id=eq.${requestId}` },
      () => onChange(),
    )
    .subscribe();
  return () => {
    void supabase.removeChannel(channel);
  };
}

export async function setVehicleStatus(vehicleId: string, status: AmbulanceVehicle["status"]) {
  const { data, error } = await supabase.rpc("ambulance_set_vehicle_status", {
    _vehicle_id: vehicleId,
    _status: status,
  } as never);
  if (error) throw new Error(error.message);
  return data as AmbulanceVehicle;
}

export async function triggerAutoAssign(requestId: string) {
  const { data, error } = await supabase.rpc("ambulance_auto_assign", { _request_id: requestId } as never);
  if (error) throw new Error(error.message);
  return data as AmbulanceRequest | null;
}
