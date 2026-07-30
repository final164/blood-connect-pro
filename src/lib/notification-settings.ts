import { supabase } from "@/integrations/supabase/client";

export type NotificationSettings = {
  retention_days: number;
  enable_managed_button: boolean;
  enable_push: boolean;
  push_new_request: boolean;
  push_interactions: boolean;
  match_district_for_alerts: boolean;
  match_blood_group_for_alerts: boolean;
  auto_feed_district: boolean;
  auto_feed_blood_group: boolean;
  web_push_hook_secret?: string;
  enable_critical_droplet_animation: boolean;
};

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  retention_days: 1,
  enable_managed_button: true,
  enable_push: true,
  push_new_request: true,
  push_interactions: true,
  match_district_for_alerts: true,
  match_blood_group_for_alerts: true,
  auto_feed_district: false,
  auto_feed_blood_group: false,
  web_push_hook_secret: "",
  enable_critical_droplet_animation: true,
};

export const NOTIFICATION_SETTING_KEYS = Object.keys(
  DEFAULT_NOTIFICATION_SETTINGS,
) as (keyof NotificationSettings)[];

let cached: NotificationSettings | null = null;
let cachedAt = 0;

export function invalidateNotificationSettingsCache() {
  cached = null;
  cachedAt = 0;
}

export async function fetchNotificationSettings(force = false): Promise<NotificationSettings> {
  if (!force && cached && Date.now() - cachedAt < 60_000) return cached;
  const { data, error } = await supabase
    .from("app_settings")
    .select("notification_settings")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data?.notification_settings) {
    cached = { ...DEFAULT_NOTIFICATION_SETTINGS };
  } else {
    cached = { ...DEFAULT_NOTIFICATION_SETTINGS, ...(data.notification_settings as NotificationSettings) };
  }
  cachedAt = Date.now();
  return cached;
}

export function notificationPostUrl(requestId: string | null | undefined) {
  if (!requestId) return "/";
  return `/?requestId=${encodeURIComponent(requestId)}`;
}

export async function purgeExpiredNotificationsForUser(userId: string, retentionDays: number) {
  const days = Math.max(1, retentionDays);
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  await supabase.from("notifications").delete().eq("user_id", userId).lt("created_at", cutoff);
}
