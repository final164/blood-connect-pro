import { supabase } from "@/integrations/supabase/client";

export type TeleSettings = {
  tele_enabled: boolean;
  instant_enabled: boolean;
  require_payment_before_join: boolean;
  ai_summary_enabled: boolean;
  join_window_minutes: number;
  default_duration_minutes: number;
  default_slot_minutes: number;
  slot_horizon_days: number;
  consultant_can_edit_schedule: boolean;
  require_slot_for_named: boolean;
  cancel_cutoff_hours: number;
  vat_percent: number | null;
  trust_bullets_bn: string[];
  trust_bullets_en: string[];
  ui: {
    hub_title_bn: string;
    hub_title_en: string;
    hub_subtitle_bn: string;
    hub_subtitle_en: string;
    search_placeholder_bn: string;
    search_placeholder_en: string;
    instant_section_bn: string;
    instant_section_en: string;
    popular_section_bn: string;
    popular_section_en: string;
    specialist_section_bn: string;
    specialist_section_en: string;
    dept_section_bn: string;
    dept_section_en: string;
    my_bookings_bn: string;
    my_bookings_en: string;
    see_doctor_bn: string;
    see_doctor_en: string;
    disabled_message_bn: string;
    disabled_message_en: string;
    summary_disclaimer_bn: string;
    summary_disclaimer_en: string;
    slot_modal_title_bn: string;
    slot_modal_title_en: string;
    slot_select_hint_bn: string;
    slot_select_hint_en: string;
    slot_legend_available_bn: string;
    slot_legend_available_en: string;
    slot_legend_unavailable_bn: string;
    slot_legend_unavailable_en: string;
    slot_legend_selected_bn: string;
    slot_legend_selected_en: string;
    checkout_confirm_bn: string;
    checkout_confirm_en: string;
    join_cta_bn: string;
    join_cta_en: string;
  };
  instant_assign: {
    prefer_online: boolean;
    prefer_rating: boolean;
    max_wait_minutes: number;
  };
  zoom: {
    waiting_room: boolean;
    auto_recording: boolean;
    auto_transcript: boolean;
    configured: boolean;
  };
  transcript_retention_days: number;
};

export const DEFAULT_TELE_SETTINGS: TeleSettings = {
  tele_enabled: true,
  instant_enabled: true,
  require_payment_before_join: true,
  ai_summary_enabled: true,
  join_window_minutes: 15,
  default_duration_minutes: 20,
  default_slot_minutes: 15,
  slot_horizon_days: 14,
  consultant_can_edit_schedule: true,
  require_slot_for_named: true,
  cancel_cutoff_hours: 1,
  vat_percent: null,
  trust_bullets_bn: ["সকল ডাক্তার BMDC সনদপ্রাপ্ত", "অভিজ্ঞ কনসালট্যান্ট"],
  trust_bullets_en: ["All doctors are BMDC certified", "Experienced consultants"],
  ui: {
    hub_title_bn: "ভিডিও কনসালটেশন",
    hub_title_en: "Video Consultation",
    hub_subtitle_bn: "BMDC সনদপ্রাপ্ত ডাক্তারের সাথে নিরাপদ অনলাইন পরামর্শ",
    hub_subtitle_en: "Secure online consults with BMDC-certified doctors",
    search_placeholder_bn: "স্পেশালিটি বা নাম দিয়ে খুঁজুন",
    search_placeholder_en: "Search doctor by specialty or name",
    instant_section_bn: "তাৎক্ষণিক ভিডিও কনসালটেশন",
    instant_section_en: "Get instant video consultation",
    popular_section_bn: "জনপ্রিয় বিশেষজ্ঞ",
    popular_section_en: "Popular Specialists",
    specialist_section_bn: "বিশেষজ্ঞ কনসালট করুন",
    specialist_section_en: "Consult a specialist",
    dept_section_bn: "বিভাগ বা লক্ষণ বেছে নিন",
    dept_section_en: "Choose a department or symptom",
    my_bookings_bn: "আমার ভিডিও বুকিং",
    my_bookings_en: "My video bookings",
    see_doctor_bn: "ডাক্তার দেখুন ›",
    see_doctor_en: "See Doctor ›",
    disabled_message_bn: "ভিডিও কনসালটেশন বর্তমানে বন্ধ আছে।",
    disabled_message_en: "Video consultation is currently disabled.",
    summary_disclaimer_bn: "AI সহায়ক সারসংক্ষেপ — চিকিৎসকের প্রেসক্রিপশনই চূড়ান্ত",
    summary_disclaimer_en: "AI helper summary — the doctor prescription is final",
    slot_modal_title_bn: "উপলব্ধ সময় স্লট",
    slot_modal_title_en: "Available TimeSlots",
    slot_select_hint_bn: "আপনার অ্যাপয়েন্টমেন্ট সময় বেছে নিন",
    slot_select_hint_en: "Select your appointment time",
    slot_legend_available_bn: "উপলব্ধ",
    slot_legend_available_en: "Available",
    slot_legend_unavailable_bn: "নাই",
    slot_legend_unavailable_en: "Not available",
    slot_legend_selected_bn: "নির্বাচিত",
    slot_legend_selected_en: "Selected",
    checkout_confirm_bn: "বুকিং নিশ্চিত করুন",
    checkout_confirm_en: "Confirm booking",
    join_cta_bn: "Zoom-এ যোগ দিন",
    join_cta_en: "Join Zoom",
  },
  instant_assign: {
    prefer_online: true,
    prefer_rating: true,
    max_wait_minutes: 30,
  },
  zoom: {
    waiting_room: true,
    auto_recording: true,
    auto_transcript: true,
    configured: false,
  },
  transcript_retention_days: 90,
};

export type TeleOfferCard = {
  id: string;
  slug: string;
  title_bn: string;
  title_en: string;
  subtitle_bn: string | null;
  subtitle_en: string | null;
  image_url: string | null;
  specialty_id: string | null;
  list_price: number | null;
  sale_price: number;
  mode: string;
  href: string | null;
  is_active: boolean;
  sort_order: number;
};

export type TeleDoctorProfile = {
  doctor_id: string;
  video_enabled: boolean;
  instant_enabled: boolean;
  is_online: boolean;
  is_popular: boolean;
  about_bn: string | null;
  about_en: string | null;
  experience_years: number | null;
  workplace_bn: string | null;
  workplace_en: string | null;
  hero_image_url: string | null;
  fee_amount: number | null;
  rating_avg: number;
  rating_count: number;
  sort_order: number;
  slot_minutes: number;
  follow_up_fee: number | null;
  follow_up_days: number;
  avg_consult_minutes: number;
  doctor_code: string | null;
  patients_attended: number;
  joined_at: string | null;
  specialty_tags_bn: string[];
  specialty_tags_en: string[];
  notice_bn: string | null;
  notice_en: string | null;
  instructions_bn: string | null;
  instructions_en: string | null;
  helpline: string | null;
  chamber_address_bn: string | null;
  chamber_address_en: string | null;
  schedule_public: boolean;
};

export type TeleDoctorSlot = {
  id: string;
  doctor_id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type TeleFormularyItem = {
  id: string;
  kind: "medicine" | "test" | "advice";
  name_bn: string;
  name_en: string;
  default_dose: string | null;
  default_frequency: string | null;
  default_duration: string | null;
  is_active: boolean;
  sort_order: number;
};

function mergeTeleSettings(raw: unknown): TeleSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const ui = (r.ui && typeof r.ui === "object" ? r.ui : {}) as Record<string, string>;
  const ia = (r.instant_assign && typeof r.instant_assign === "object" ? r.instant_assign : {}) as Record<
    string,
    unknown
  >;
  const zoom = (r.zoom && typeof r.zoom === "object" ? r.zoom : {}) as Record<string, unknown>;
  return {
    ...DEFAULT_TELE_SETTINGS,
    ...r,
    tele_enabled: r.tele_enabled !== false,
    instant_enabled: r.instant_enabled !== false,
    require_payment_before_join: r.require_payment_before_join !== false,
    ai_summary_enabled: r.ai_summary_enabled !== false,
    join_window_minutes: Number(r.join_window_minutes ?? 15),
    default_duration_minutes: Number(r.default_duration_minutes ?? 20),
    default_slot_minutes: Number(r.default_slot_minutes ?? 15),
    slot_horizon_days: Number(r.slot_horizon_days ?? 14),
    consultant_can_edit_schedule: r.consultant_can_edit_schedule !== false,
    require_slot_for_named: r.require_slot_for_named !== false,
    cancel_cutoff_hours: Number(r.cancel_cutoff_hours ?? 1),
    vat_percent: r.vat_percent == null ? null : Number(r.vat_percent),
    trust_bullets_bn: Array.isArray(r.trust_bullets_bn)
      ? (r.trust_bullets_bn as string[])
      : DEFAULT_TELE_SETTINGS.trust_bullets_bn,
    trust_bullets_en: Array.isArray(r.trust_bullets_en)
      ? (r.trust_bullets_en as string[])
      : DEFAULT_TELE_SETTINGS.trust_bullets_en,
    ui: { ...DEFAULT_TELE_SETTINGS.ui, ...ui },
    instant_assign: {
      prefer_online: ia.prefer_online !== false,
      prefer_rating: ia.prefer_rating !== false,
      max_wait_minutes: Number(ia.max_wait_minutes ?? 30),
    },
    zoom: {
      waiting_room: zoom.waiting_room !== false,
      auto_recording: zoom.auto_recording !== false,
      auto_transcript: zoom.auto_transcript !== false,
      configured: !!zoom.configured,
    },
    transcript_retention_days: Number(r.transcript_retention_days ?? 90),
  } as TeleSettings;
}

export async function fetchTeleSettings(): Promise<TeleSettings> {
  const { data, error } = await supabase.from("app_settings").select("tele_settings").eq("id", 1).maybeSingle();
  if (error) throw new Error(error.message);
  return mergeTeleSettings((data as { tele_settings?: unknown } | null)?.tele_settings);
}

export async function saveTeleSettings(settings: TeleSettings): Promise<void> {
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    tele_settings: settings,
  } as never);
  if (error) throw new Error(error.message);
}

export async function fetchTeleOfferCards(activeOnly = true): Promise<TeleOfferCard[]> {
  let q = supabase.from("tele_offer_cards").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as TeleOfferCard[];
}

export async function upsertTeleOfferCard(row: Partial<TeleOfferCard> & { slug: string; title_bn: string; title_en: string }) {
  const { error } = await supabase.from("tele_offer_cards").upsert(row as never);
  if (error) throw new Error(error.message);
}

export async function deleteTeleOfferCard(id: string) {
  const { error } = await supabase.from("tele_offer_cards").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function fetchTeleFormulary(activeOnly = true): Promise<TeleFormularyItem[]> {
  let q = supabase.from("tele_formulary").select("*").order("sort_order");
  if (activeOnly) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as TeleFormularyItem[];
}

export async function upsertTeleFormulary(row: Partial<TeleFormularyItem> & { name_bn: string; name_en: string; kind: string }) {
  const { error } = await supabase.from("tele_formulary").upsert(row as never);
  if (error) throw new Error(error.message);
}

export async function deleteTeleFormulary(id: string) {
  const { error } = await supabase.from("tele_formulary").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
