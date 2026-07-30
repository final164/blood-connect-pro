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
  /** Max donors selectable per bulk SMS */
  max_sms_donors: number;
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
  max_sms_donors: 10,
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
    max_sms_donors:
      Number.isFinite(max) && max >= 1
        ? Math.min(100, Math.floor(max))
        : DEFAULT_MESSAGING_SETTINGS.max_sms_donors,
  };
}

let cached: MessagingSettings | null = null;
let cachedAt = 0;

export function invalidateMessagingSettingsCache() {
  cached = null;
  cachedAt = 0;
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
