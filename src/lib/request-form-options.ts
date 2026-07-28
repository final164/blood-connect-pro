import { supabase } from "@/integrations/supabase/client";

/** false = required, true = optional (admin-managed) */
export type RequestFormOptions = {
  patient_name: boolean;
  blood_group: boolean;
  bags_needed: boolean;
  district: boolean;
  hospital: boolean;
  contact_phone: boolean;
  whatsapp: boolean;
  needed_by: boolean;
  urgency: boolean;
  notes: boolean;
};

export const DEFAULT_REQUEST_FORM_OPTIONS: RequestFormOptions = {
  patient_name: false,
  blood_group: false,
  bags_needed: false,
  district: false,
  hospital: false,
  contact_phone: true,
  whatsapp: true,
  needed_by: true,
  urgency: false,
  notes: true,
};

export const REQUEST_FORM_OPTION_KEYS: (keyof RequestFormOptions)[] = [
  "patient_name",
  "blood_group",
  "bags_needed",
  "district",
  "hospital",
  "contact_phone",
  "whatsapp",
  "needed_by",
  "urgency",
  "notes",
];

export async function fetchRequestFormOptions(): Promise<RequestFormOptions> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("request_form_options")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data?.request_form_options) return { ...DEFAULT_REQUEST_FORM_OPTIONS };
  return { ...DEFAULT_REQUEST_FORM_OPTIONS, ...(data.request_form_options as RequestFormOptions) };
}

/** Normalize BD/local phone to wa.me digits */
export function whatsappHref(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0") && digits.length === 11) digits = `88${digits}`;
  else if (digits.length === 10 && digits.startsWith("1")) digits = `880${digits}`;
  else if (!digits.startsWith("880") && digits.length === 11 && digits.startsWith("1")) digits = `88${digits}`;
  return `https://wa.me/${digits}`;
}
