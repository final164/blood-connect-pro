import { supabase } from "@/integrations/supabase/client";
import {
  fetchOrgSettings,
  type CareOrgAboutSettings,
  type CareOrgFaqItem,
  type CareOrgSettings,
} from "@/lib/care-org-settings";

export type { CareOrgAboutSettings, CareOrgFaqItem };

export type CareOrgPublicProfile = {
  id: string;
  name: string;
  name_bn: string | null;
  description: string | null;
  description_bn: string | null;
  logo_url: string | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  upazila: string | null;
  about: CareOrgAboutSettings;
};

export function newFaqItem(): CareOrgFaqItem {
  return {
    id: crypto.randomUUID(),
    question_bn: "",
    question_en: "",
    answer_bn: "",
    answer_en: "",
  };
}

export async function saveOrgAboutSettings(
  orgId: string,
  about: CareOrgAboutSettings,
  existing?: CareOrgSettings | null,
): Promise<void> {
  const base = existing ?? (await fetchOrgSettings(orgId));
  const next: CareOrgSettings = {
    ...base,
    about: {
      about_bn: about.about_bn ?? "",
      about_en: about.about_en ?? "",
      gallery: about.gallery ?? [],
      faqs: about.faqs ?? [],
    },
  };
  const { error } = await supabase.from("care_orgs").update({ settings: next } as never).eq("id", orgId);
  if (error) throw new Error(error.message);
}

export async function saveOrgLogoUrl(orgId: string, logoUrl: string | null) {
  const { error } = await supabase
    .from("care_orgs")
    .update({ logo_url: logoUrl } as never)
    .eq("id", orgId);
  if (error) throw new Error(error.message);
}

export async function uploadCareOrgImage(file: File): Promise<string> {
  const { uploadAppImage } = await import("@/lib/google-drive");
  const result = await uploadAppImage(file, "media", async (f) => {
    const ext = (f.name.split(".").pop() || "jpg").toLowerCase();
    const path = `care-org/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("feed-carousel").upload(path, f, {
      cacheControl: "3600",
      upsert: false,
      contentType: f.type || "image/jpeg",
    });
    if (error) return { url: null, error };
    const { data } = supabase.storage.from("feed-carousel").getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  });
  if (result.error || !result.url) {
    throw result.error ?? new Error("Upload failed");
  }
  return result.url;
}

export async function fetchCareOrgPublicProfile(orgId: string): Promise<CareOrgPublicProfile | null> {
  const { data, error } = await supabase
    .from("care_orgs")
    .select(
      "id, name, name_bn, description, description_bn, logo_url, website, phone, email, address, upazila, settings",
    )
    .eq("id", orgId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Record<string, unknown>;
  const { parseOrgSettings } = await import("@/lib/care-org-settings");
  const settings = parseOrgSettings(row.settings);
  return {
    id: String(row.id),
    name: String(row.name ?? ""),
    name_bn: (row.name_bn as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    description_bn: (row.description_bn as string | null) ?? null,
    logo_url: (row.logo_url as string | null) ?? null,
    website: (row.website as string | null) ?? null,
    phone: (row.phone as string | null) ?? null,
    email: (row.email as string | null) ?? null,
    address: (row.address as string | null) ?? null,
    upazila: (row.upazila as string | null) ?? null,
    about: settings.about ?? {},
  };
}
