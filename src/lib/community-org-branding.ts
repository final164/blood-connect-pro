import { supabase } from "@/integrations/supabase/client";
import {
  canPasteImageUrl,
  canUploadImageFile,
  fetchGoogleDriveSettings,
  normalizePastedImageUrl,
  uploadImageToGoogleDrive,
} from "@/lib/google-drive";

export type CommunityOrgBranding = {
  id: string;
  name: string;
  name_bn: string | null;
  description: string | null;
  description_bn: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo_url: string | null;
  cover_url: string | null;
  is_verified: boolean | null;
  is_active: boolean | null;
  portal_content?: unknown;
  donor_count?: number;
};

export function communityOrgPublicPath(orgId: string) {
  return `/org/public/${orgId}`;
}

export function communityOrgPublicUrl(orgId: string) {
  if (typeof window === "undefined") return communityOrgPublicPath(orgId);
  return `${window.location.origin}${communityOrgPublicPath(orgId)}`;
}

/**
 * Upload org logo/cover to Google Drive only — no Supabase storage.
 * DB stores only the resulting public link (tiny text cost).
 */
export async function uploadCommunityOrgImage(
  file: File,
  lang: "bn" | "en" = "en",
): Promise<string> {
  const settings = await fetchGoogleDriveSettings();
  if (!settings.enabled) {
    throw new Error(
      lang === "bn"
        ? "Google Drive চালু নেই। Admin → Google Drive থেকে এনেবল করুন।"
        : "Google Drive is not enabled. Enable it in Admin → Google Drive.",
    );
  }
  if (!canUploadImageFile(settings)) {
    throw new Error(
      lang === "bn"
        ? "ফাইল আপলোড বন্ধ আছে — Drive লিংক পেস্ট করুন।"
        : "File upload is disabled — paste a Drive link instead.",
    );
  }
  const folderOk = !!(settings.folder_id || settings.folder_media);
  if (!folderOk) {
    throw new Error(
      lang === "bn"
        ? "Drive ফোল্ডার সেট নেই। Admin → Google Drive-এ Media ফোল্ডার দিন।"
        : "No Drive folder configured. Set Media folder in Admin → Google Drive.",
    );
  }

  const drive = await uploadImageToGoogleDrive(file, "media");
  if (drive.error || !drive.url) {
    throw (
      drive.error ??
      new Error(lang === "bn" ? "Google Drive আপলোড ব্যর্থ" : "Google Drive upload failed")
    );
  }
  return drive.url;
}

/** Paste a Drive / image URL — nothing is uploaded; only the link is saved. */
export async function resolveCommunityOrgImageUrl(
  raw: string,
  lang: "bn" | "en" = "en",
): Promise<string> {
  const settings = await fetchGoogleDriveSettings();
  if (!canPasteImageUrl(settings)) {
    throw new Error(
      lang === "bn"
        ? "লিংক পেস্ট বন্ধ আছে। Admin → Google Drive-এ ইমেজ মোড চেক করুন।"
        : "Pasting image links is disabled. Check image mode in Admin → Google Drive.",
    );
  }
  const url = normalizePastedImageUrl(raw);
  if (!url) {
    throw new Error(
      lang === "bn" ? "সঠিক ইমেজ বা Google Drive লিংক দিন" : "Enter a valid image or Google Drive link",
    );
  }
  return url;
}

export async function updateCommunityOrgBranding(
  orgId: string,
  patch: { logo_url?: string | null; cover_url?: string | null },
) {
  const { error } = await supabase.from("community_orgs").update(patch).eq("id", orgId);
  if (!error) return;
  if (patch.cover_url !== undefined && /cover_url/i.test(error.message)) {
    const { cover_url: _c, ...rest } = patch;
    if (Object.keys(rest).length) {
      const retry = await supabase.from("community_orgs").update(rest).eq("id", orgId);
      if (retry.error) throw new Error(retry.error.message);
    }
    throw new Error(
      "Cover photo needs the cover_url column — apply migration 20261018220000_community_org_cover_url.sql",
    );
  }
  throw new Error(error.message);
}

export async function fetchCommunityOrgPublicProfile(
  orgId: string,
): Promise<CommunityOrgBranding | null> {
  const withPortal =
    "id, name, name_bn, description, description_bn, phone, email, website, logo_url, cover_url, is_verified, is_active, portal_content";
  const withCover =
    "id, name, name_bn, description, description_bn, phone, email, website, logo_url, cover_url, is_verified, is_active";
  const noCover =
    "id, name, name_bn, description, description_bn, phone, email, website, logo_url, is_verified, is_active";
  let { data, error } = await supabase
    .from("community_orgs")
    .select(withPortal)
    .eq("id", orgId)
    .maybeSingle();
  if (error) {
    const mid = await supabase.from("community_orgs").select(withCover).eq("id", orgId).maybeSingle();
    if (!mid.error) {
      data = mid.data as typeof data;
      error = null;
    } else {
      const fallback = await supabase
        .from("community_orgs")
        .select(noCover)
        .eq("id", orgId)
        .maybeSingle();
      if (fallback.error) throw new Error(fallback.error.message);
      data = fallback.data as typeof data;
      error = null;
    }
  }
  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as CommunityOrgBranding;
  if (row.is_active === false) return null;
  return { ...row, cover_url: row.cover_url ?? null };
}
