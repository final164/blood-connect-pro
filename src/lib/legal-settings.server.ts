import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  DEFAULT_LEGAL_SETTINGS,
  normalizeLegalSettings,
  type LegalSettings,
} from "@/lib/legal-settings";

/** Service-role read so legal pages render for anonymous crawlers regardless of RLS. */
export async function fetchLegalSettingsServer(): Promise<LegalSettings> {
  try {
    const { data, error } = await supabaseAdmin
      .from("app_settings")
      .select("legal_settings")
      .eq("id", 1)
      .maybeSingle();
    if (error) return DEFAULT_LEGAL_SETTINGS;
    const row = data as { legal_settings?: unknown } | null;
    return normalizeLegalSettings(row?.legal_settings);
  } catch {
    return DEFAULT_LEGAL_SETTINGS;
  }
}
