import { supabase } from "@/integrations/supabase/client";

export type PostIconSettings = {
  like: boolean;
  comment: boolean;
  chat: boolean;
  phone: boolean;
  whatsapp: boolean;
  save: boolean;
  share: boolean;
};

export type MessagingSettings = {
  /** Community bulk / donor SMS body. Placeholders: {{blood_group}} {{patient_name}} {{hospital}} {{upazila}} {{district}} {{bags}} {{urgency}} {{notes}} {{reason}} {{link}} */
  community_sms_bn: string;
  community_sms_en: string;
  /** Feed share text (RequestCard). Same placeholders + {{location}} */
  share_sms_bn: string;
  share_sms_en: string;
  post_icons: PostIconSettings;
  /** Show “Send SMS” on community page */
  show_community_send_sms: boolean;
  /** Show “Save request” on community page */
  show_community_save_request: boolean;
  /** Button labels (community page) */
  community_send_sms_label_bn: string;
  community_send_sms_label_en: string;
  community_save_request_label_bn: string;
  community_save_request_label_en: string;
  /** When true, Community “Save request” also inserts a feed blood_request */
  community_save_posts_to_feed: boolean;
  /** Max donors selectable per bulk SMS */
  max_sms_donors: number;
  /** Show A+/B+/… chip filter under community header */
  show_community_blood_filter: boolean;
  /** Apply save-request blood group to donor list filter */
  community_apply_save_request_blood: boolean;
  /** Apply save-request district to donor list filter */
  community_apply_save_request_district: boolean;
  /** Apply save-request upazila to donor list filter */
  community_apply_save_request_upazila: boolean;
  /**
   * How long a saved community request stays on the button (hours).
   * Default 24 (1 day). 0 = never auto-clear.
   */
  community_save_request_ttl_hours: number;
  /** Put unavailable (cooldown) donors at the end of the list */
  community_sort_unavailable_last: boolean;
  /** Hide call/SMS/WhatsApp while donor is in cooldown */
  community_hide_contact_when_unavailable: boolean;
  /** Show “Not available” label on cooldown donors */
  community_show_unavailable_label: boolean;
  /** On signup with same phone as org-imported donor, merge donation history into profile */
  link_org_donor_on_signup: boolean;
  /** Include registered app users in Community list (matched by district/upazila) */
  community_include_app_users: boolean;
  /** Prefill Community district/upazila filters from the viewer's profile */
  community_default_to_viewer_location: boolean;
  /** Show a separator line under each feed post */
  feed_show_post_divider: boolean;
  /** Divider color (CSS color, e.g. #E4E6EB) */
  feed_post_divider_color: string;
  /** Divider thickness in px */
  feed_post_divider_height_px: number;
};

export const DEFAULT_POST_ICONS: PostIconSettings = {
  like: true,
  comment: true,
  chat: true,
  phone: true,
  whatsapp: true,
  save: true,
  share: true,
};

export const DEFAULT_MESSAGING_SETTINGS: MessagingSettings = {
  community_sms_bn:
    "{{blood_group}} রক্ত দরকার — {{patient_name}}\nহাসপাতাল: {{hospital}}\nস্থান: {{upazila}}, {{district}}\nব্যাগ: {{bags}}\nকারণ: {{reason}}\n{{notes}}\n{{link}}",
  community_sms_en:
    "{{blood_group}} blood needed — {{patient_name}}\nHospital: {{hospital}}\nPlace: {{upazila}}, {{district}}\nBags: {{bags}}\nReason: {{reason}}\n{{notes}}\n{{link}}",
  share_sms_bn: "{{blood_group}} রক্ত দরকার — {{patient_name}}, {{location}}\n{{link}}",
  share_sms_en: "{{blood_group}} blood needed — {{patient_name}}, {{location}}\n{{link}}",
  post_icons: { ...DEFAULT_POST_ICONS },
  show_community_send_sms: true,
  show_community_save_request: true,
  community_send_sms_label_bn: "Send SMS (ঐচ্ছিক)",
  community_send_sms_label_en: "Send SMS (optional)",
  community_save_request_label_bn: "Save request (ঐচ্ছিক)",
  community_save_request_label_en: "Save request (optional)",
  community_save_posts_to_feed: true,
  max_sms_donors: 10,
  show_community_blood_filter: true,
  community_apply_save_request_blood: true,
  community_apply_save_request_district: true,
  community_apply_save_request_upazila: true,
  community_save_request_ttl_hours: 24,
  community_sort_unavailable_last: true,
  community_hide_contact_when_unavailable: true,
  community_show_unavailable_label: true,
  link_org_donor_on_signup: true,
  community_include_app_users: true,
  community_default_to_viewer_location: true,
  feed_show_post_divider: true,
  feed_post_divider_color: "#E4E6EB",
  feed_post_divider_height_px: 8,
};

export type SmsTemplateVars = Record<string, string | number | null | undefined>;

export function applySmsTemplate(template: string, vars: SmsTemplateVars): string {
  return template
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const v = vars[key];
      if (v == null || v === "") return "";
      return String(v);
    })
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeIcons(raw: unknown): PostIconSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<PostIconSettings>;
  return {
    like: typeof r.like === "boolean" ? r.like : DEFAULT_POST_ICONS.like,
    comment: typeof r.comment === "boolean" ? r.comment : DEFAULT_POST_ICONS.comment,
    chat: typeof r.chat === "boolean" ? r.chat : DEFAULT_POST_ICONS.chat,
    phone: typeof r.phone === "boolean" ? r.phone : DEFAULT_POST_ICONS.phone,
    whatsapp: typeof r.whatsapp === "boolean" ? r.whatsapp : DEFAULT_POST_ICONS.whatsapp,
    save: typeof r.save === "boolean" ? r.save : DEFAULT_POST_ICONS.save,
    share: typeof r.share === "boolean" ? r.share : DEFAULT_POST_ICONS.share,
  };
}

export function normalizeMessagingSettings(raw: unknown): MessagingSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<MessagingSettings>;
  const max = Number(r.max_sms_donors);
  return {
    community_sms_bn:
      typeof r.community_sms_bn === "string" && r.community_sms_bn.trim()
        ? r.community_sms_bn
        : DEFAULT_MESSAGING_SETTINGS.community_sms_bn,
    community_sms_en:
      typeof r.community_sms_en === "string" && r.community_sms_en.trim()
        ? r.community_sms_en
        : DEFAULT_MESSAGING_SETTINGS.community_sms_en,
    share_sms_bn:
      typeof r.share_sms_bn === "string" && r.share_sms_bn.trim()
        ? r.share_sms_bn
        : DEFAULT_MESSAGING_SETTINGS.share_sms_bn,
    share_sms_en:
      typeof r.share_sms_en === "string" && r.share_sms_en.trim()
        ? r.share_sms_en
        : DEFAULT_MESSAGING_SETTINGS.share_sms_en,
    post_icons: normalizeIcons(r.post_icons),
    show_community_send_sms:
      typeof r.show_community_send_sms === "boolean"
        ? r.show_community_send_sms
        : DEFAULT_MESSAGING_SETTINGS.show_community_send_sms,
    show_community_save_request:
      typeof r.show_community_save_request === "boolean"
        ? r.show_community_save_request
        : DEFAULT_MESSAGING_SETTINGS.show_community_save_request,
    community_send_sms_label_bn: strLabel(
      r.community_send_sms_label_bn,
      DEFAULT_MESSAGING_SETTINGS.community_send_sms_label_bn,
    ),
    community_send_sms_label_en: strLabel(
      r.community_send_sms_label_en,
      DEFAULT_MESSAGING_SETTINGS.community_send_sms_label_en,
    ),
    community_save_request_label_bn: strLabel(
      r.community_save_request_label_bn,
      DEFAULT_MESSAGING_SETTINGS.community_save_request_label_bn,
    ),
    community_save_request_label_en: strLabel(
      r.community_save_request_label_en,
      DEFAULT_MESSAGING_SETTINGS.community_save_request_label_en,
    ),
    community_save_posts_to_feed:
      typeof r.community_save_posts_to_feed === "boolean"
        ? r.community_save_posts_to_feed
        : DEFAULT_MESSAGING_SETTINGS.community_save_posts_to_feed,
    max_sms_donors:
      Number.isFinite(max) && max >= 1
        ? Math.min(100, Math.floor(max))
        : DEFAULT_MESSAGING_SETTINGS.max_sms_donors,
    show_community_blood_filter:
      typeof r.show_community_blood_filter === "boolean"
        ? r.show_community_blood_filter
        : DEFAULT_MESSAGING_SETTINGS.show_community_blood_filter,
    community_apply_save_request_blood:
      typeof r.community_apply_save_request_blood === "boolean"
        ? r.community_apply_save_request_blood
        : DEFAULT_MESSAGING_SETTINGS.community_apply_save_request_blood,
    community_apply_save_request_district:
      typeof r.community_apply_save_request_district === "boolean"
        ? r.community_apply_save_request_district
        : DEFAULT_MESSAGING_SETTINGS.community_apply_save_request_district,
    community_apply_save_request_upazila:
      typeof r.community_apply_save_request_upazila === "boolean"
        ? r.community_apply_save_request_upazila
        : DEFAULT_MESSAGING_SETTINGS.community_apply_save_request_upazila,
    community_save_request_ttl_hours: (() => {
      const h = Number(r.community_save_request_ttl_hours);
      if (!Number.isFinite(h) || h < 0) {
        return DEFAULT_MESSAGING_SETTINGS.community_save_request_ttl_hours;
      }
      return Math.min(720, Math.floor(h));
    })(),
    community_sort_unavailable_last:
      typeof r.community_sort_unavailable_last === "boolean"
        ? r.community_sort_unavailable_last
        : DEFAULT_MESSAGING_SETTINGS.community_sort_unavailable_last,
    community_hide_contact_when_unavailable:
      typeof r.community_hide_contact_when_unavailable === "boolean"
        ? r.community_hide_contact_when_unavailable
        : DEFAULT_MESSAGING_SETTINGS.community_hide_contact_when_unavailable,
    community_show_unavailable_label:
      typeof r.community_show_unavailable_label === "boolean"
        ? r.community_show_unavailable_label
        : DEFAULT_MESSAGING_SETTINGS.community_show_unavailable_label,
    link_org_donor_on_signup:
      typeof r.link_org_donor_on_signup === "boolean"
        ? r.link_org_donor_on_signup
        : DEFAULT_MESSAGING_SETTINGS.link_org_donor_on_signup,
    community_include_app_users:
      typeof r.community_include_app_users === "boolean"
        ? r.community_include_app_users
        : DEFAULT_MESSAGING_SETTINGS.community_include_app_users,
    community_default_to_viewer_location:
      typeof r.community_default_to_viewer_location === "boolean"
        ? r.community_default_to_viewer_location
        : DEFAULT_MESSAGING_SETTINGS.community_default_to_viewer_location,
    feed_show_post_divider:
      typeof r.feed_show_post_divider === "boolean"
        ? r.feed_show_post_divider
        : DEFAULT_MESSAGING_SETTINGS.feed_show_post_divider,
    feed_post_divider_color: (() => {
      const c = typeof r.feed_post_divider_color === "string" ? r.feed_post_divider_color.trim() : "";
      return c || DEFAULT_MESSAGING_SETTINGS.feed_post_divider_color;
    })(),
    feed_post_divider_height_px: (() => {
      const h = Number(r.feed_post_divider_height_px);
      if (!Number.isFinite(h) || h < 0) {
        return DEFAULT_MESSAGING_SETTINGS.feed_post_divider_height_px;
      }
      return Math.min(48, Math.floor(h));
    })(),
  };
}

function strLabel(v: unknown, fallback: string) {
  return typeof v === "string" && v.trim() ? v.trim() : fallback;
}

let cached: MessagingSettings | null = null;
let cachedAt = 0;

export function invalidateMessagingSettingsCache() {
  cached = null;
  cachedAt = 0;
}

/** Sync peek at last fetched settings (or defaults). Used by local draft TTL. */
export function getCachedMessagingSettings(): MessagingSettings {
  return cached ?? DEFAULT_MESSAGING_SETTINGS;
}

export async function fetchMessagingSettings(force = false): Promise<MessagingSettings> {
  if (!force && cached && Date.now() - cachedAt < 60_000) return cached;
  const { data } = await supabase
    .from("app_settings")
    .select("messaging_settings")
    .eq("id", 1)
    .maybeSingle();
  cached = normalizeMessagingSettings(data?.messaging_settings);
  cachedAt = Date.now();
  return cached;
}

export async function saveMessagingSettings(settings: MessagingSettings): Promise<void> {
  const normalized = normalizeMessagingSettings(settings);
  const { error } = await supabase.from("app_settings").upsert({
    id: 1,
    messaging_settings: normalized,
  });
  if (error) throw error;
  cached = normalized;
  cachedAt = Date.now();
}

/** Build sms: URL. Multiple numbers: comma-separated (iOS); body works on most devices. */
export function buildSmsHref(phones: string[], body: string): string {
  const nums = phones.map((p) => p.replace(/[^\d+]/g, "")).filter(Boolean);
  if (!nums.length) return "";
  const to = nums.join(",");
  const q = encodeURIComponent(body);
  return `sms:${to}?&body=${q}`;
}
