import { supabase } from "@/integrations/supabase/client";

export type AmbulanceServiceType = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string;
  icon: string;
  is_active: boolean;
  sort_order: number;
};

export type AmbulanceEquipmentOption = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string;
  is_active: boolean;
  sort_order: number;
};

export type AmbulanceStatusRow = {
  slug: string;
  label_bn: string;
  label_en: string;
  color: string;
  is_terminal: boolean;
  is_active: boolean;
  sort_order: number;
};

export type AmbulanceTransitionRow = {
  id: string;
  from_status: string;
  to_status: string;
  actor_role: string;
  is_active: boolean;
};

export type AmbulancePriorityLevel = {
  id: string;
  slug: string;
  name_bn: string;
  name_en: string;
  sla_minutes: number;
  is_active: boolean;
  sort_order: number;
};

export type AmbulanceFormField = {
  field_key: string;
  label_bn: string;
  label_en: string;
  field_type: string;
  is_enabled: boolean;
  is_required: boolean;
  sort_order: number;
};

export type AmbulanceNotifTemplate = {
  slug: string;
  title_bn: string;
  title_en: string;
  body_bn: string;
  body_en: string;
  channel: string;
  is_active: boolean;
};

export async function fetchAmbulanceServiceTypes() {
  const { data, error } = await supabase
    .from("ambulance_service_types")
    .select("id, slug, name_bn, name_en, icon, is_active, sort_order")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as AmbulanceServiceType[];
}

export async function fetchAmbulanceEquipmentOptions() {
  const { data, error } = await supabase
    .from("ambulance_equipment_options")
    .select("id, slug, name_bn, name_en, is_active, sort_order")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as AmbulanceEquipmentOption[];
}

export async function fetchAmbulanceRequestStatuses() {
  const { data, error } = await supabase
    .from("ambulance_request_statuses")
    .select("slug, label_bn, label_en, color, is_terminal, is_active, sort_order")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as AmbulanceStatusRow[];
}

export async function fetchAmbulanceStatusTransitions() {
  const { data, error } = await supabase
    .from("ambulance_status_transitions")
    .select("id, from_status, to_status, actor_role, is_active")
    .order("from_status");
  if (error) throw new Error(error.message);
  return (data ?? []) as AmbulanceTransitionRow[];
}

export async function fetchAmbulancePriorityLevels() {
  const { data, error } = await supabase
    .from("ambulance_priority_levels")
    .select("id, slug, name_bn, name_en, sla_minutes, is_active, sort_order")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as AmbulancePriorityLevel[];
}

export async function fetchAmbulanceFormFields() {
  const { data, error } = await supabase
    .from("ambulance_form_fields")
    .select("field_key, label_bn, label_en, field_type, is_enabled, is_required, sort_order")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return (data ?? []) as AmbulanceFormField[];
}

export async function fetchAmbulanceNotifTemplates() {
  const { data, error } = await supabase
    .from("ambulance_notif_templates")
    .select("slug, title_bn, title_en, body_bn, body_en, channel, is_active");
  if (error) throw new Error(error.message);
  return (data ?? []) as AmbulanceNotifTemplate[];
}

export async function fetchAmbulanceProviders() {
  const { data: kinds, error: kErr } = await supabase
    .from("care_vendor_types")
    .select("id")
    .eq("slug", "ambulance")
    .maybeSingle();
  if (kErr) throw new Error(kErr.message);
  if (!kinds?.id) return [];

  const { data, error } = await supabase
    .from("care_orgs")
    .select(
      "id, name, name_bn, phone, district_id, upazila, address, is_active, is_verified, is_listed, kyc_status, featured, created_at, districts(name, name_bn)",
    )
    .eq("org_kind_id", kinds.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAmbulanceAudit(limit = 50) {
  const { data, error } = await supabase
    .from("ambulance_request_events")
    .select("id, request_id, org_id, actor_id, event_type, from_status, to_status, meta, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function fetchAmbulanceOverviewStats() {
  const today = new Date().toISOString().slice(0, 10);
  const [providers, openReq, doneToday] = await Promise.all([
    fetchAmbulanceProviders(),
    supabase.from("ambulance_requests").select("id", { count: "exact", head: true }).not("status", "in", '("completed","cancelled","rejected")'),
    supabase
      .from("ambulance_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("updated_at", `${today}T00:00:00`),
  ]);
  return {
    providers: providers.length,
    listed: providers.filter((p) => (p as { is_listed?: boolean }).is_listed).length,
    openRequests: openReq.count ?? 0,
    completedToday: doneToday.count ?? 0,
  };
}
