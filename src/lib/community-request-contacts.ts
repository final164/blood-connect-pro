import { supabase } from "@/integrations/supabase/client";

export type CommunityContactChannel = "call" | "sms" | "whatsapp" | "saved";

export type CommunityRequestContact = {
  id: string;
  request_id: string;
  org_id: string | null;
  community_donor_id: string | null;
  donor_name: string | null;
  donor_phone: string;
  channel: CommunityContactChannel;
  outcome: "initiated" | "donated" | "cancelled";
  contacted_by: string;
  matched_profile_id: string | null;
  bags: number | null;
  notes: string | null;
  donation_id: string | null;
  assigned_by: string | null;
  donated_at: string | null;
  created_at: string;
  updated_at: string;
};

export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** Strip legacy `[Community → …]` and `[PostStyle:…]` lines from notes for feed display. */
export function stripCommunityMetaFromNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (/^\s*\[Community\s*→/i.test(t)) return false;
      if (/^\s*\[PostStyle:[a-z0-9_-]+\]\s*$/i.test(t)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

export async function restoreExpiredDonorAvailability(): Promise<void> {
  try {
    await supabase.rpc("restore_expired_donor_availability");
  } catch {
    /* column/fn may not exist yet */
  }
}

/** Merge org-imported donor history into the signed-in profile (same phone). */
export async function linkOrgDonorHistoryToProfile(userId?: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc("link_org_donor_history_to_profile", {
      p_user_id: userId ?? null,
    });
    if (error) return 0;
    return typeof data === "number" ? data : Number(data) || 0;
  } catch {
    return 0;
  }
}

export async function logCommunityContact(params: {
  requestId: string;
  contactedBy: string;
  channel: CommunityContactChannel;
  donorName?: string | null;
  donorPhone: string;
  communityDonorId?: string | null;
  orgId?: string | null;
}): Promise<{ id: string | null; error: Error | null }> {
  const phone = params.donorPhone.trim();
  if (!phone || !params.requestId) return { id: null, error: null };

  const payload = {
    request_id: params.requestId,
    contacted_by: params.contactedBy,
    channel: params.channel,
    donor_name: params.donorName?.trim() || null,
    donor_phone: phone,
    community_donor_id: params.communityDonorId || null,
    org_id: params.orgId || null,
    outcome: "initiated" as const,
  };

  const { data, error } = await supabase
    .from("community_request_contacts")
    .insert(payload)
    .select("id")
    .maybeSingle();

  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { id: null, error: null };
    return { id: null, error: new Error(error.message) };
  }
  return { id: (data as { id?: string } | null)?.id ?? null, error: null };
}

export async function logCommunityContactsBulk(
  params: {
    requestId: string;
    contactedBy: string;
    channel: CommunityContactChannel;
    orgId?: string | null;
  },
  donors: Array<{ id?: string; full_name: string; phone: string; org_id?: string | null }>,
): Promise<void> {
  await Promise.all(
    donors.map((d) =>
      logCommunityContact({
        requestId: params.requestId,
        contactedBy: params.contactedBy,
        channel: params.channel,
        donorName: d.full_name,
        donorPhone: d.phone,
        communityDonorId: d.id ?? null,
        orgId: params.orgId || d.org_id || null,
      }),
    ),
  );
}

export async function fetchContactsForRequests(
  requestIds: string[],
): Promise<Record<string, CommunityRequestContact[]>> {
  const out: Record<string, CommunityRequestContact[]> = {};
  if (!requestIds.length) return out;
  const chunkSize = 150;
  for (let i = 0; i < requestIds.length; i += chunkSize) {
    const chunk = requestIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("community_request_contacts")
      .select("*")
      .in("request_id", chunk)
      .order("created_at", { ascending: false });
    if (error || !data) continue;
    for (const row of data as CommunityRequestContact[]) {
      (out[row.request_id] ??= []).push(row);
    }
  }
  return out;
}

export async function fetchContactsForOrg(orgId: string, limit = 200): Promise<CommunityRequestContact[]> {
  const { data, error } = await supabase
    .from("community_request_contacts")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data as CommunityRequestContact[]) ?? [];
}

export async function markContactDonated(contactId: string, bags = 1): Promise<{ error: Error | null }> {
  const { error } = await supabase.rpc("mark_community_donor_donated", {
    p_contact_id: contactId,
    p_bags: bags,
  });
  if (error) return { error: new Error(error.message) };
  return { error: null };
}

export function channelLabel(ch: string, lang: "bn" | "en"): string {
  if (ch === "call") return lang === "bn" ? "কল" : "Call";
  if (ch === "sms") return "SMS";
  if (ch === "whatsapp") return "WhatsApp";
  if (ch === "saved") return lang === "bn" ? "সেভ" : "Saved";
  return ch;
}
