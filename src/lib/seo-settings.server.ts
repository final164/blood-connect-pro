import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_SEO_SETTINGS,
  normalizeSeoSettings,
  type SeoSettings,
} from "@/lib/seo-settings";

export async function fetchSeoSettingsServer(): Promise<SeoSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("seo_settings")
      .eq("id", 1)
      .maybeSingle();
    if (error) return DEFAULT_SEO_SETTINGS;
    const row = data as { seo_settings?: unknown } | null;
    return normalizeSeoSettings(row?.seo_settings);
  } catch {
    return DEFAULT_SEO_SETTINGS;
  }
}
