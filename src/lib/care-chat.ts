import { supabase } from "@/integrations/supabase/client";
import { fetchCarePoliciesCached } from "@/lib/care-cms";

const peerCache = new Map<string, { peerId: string | null; at: number }>();
const CACHE_MS = 5 * 60_000;

/** Admin flag: Care → Policies → patient_org_chat (default on). */
export async function isCareOrgChatEnabled(force = false): Promise<boolean> {
  const { flags } = await fetchCarePoliciesCached(force);
  return flags.patient_org_chat !== false;
}

/** Staff profile that receives patient DMs for this care org (owner → reception → any). */
export async function resolveCareOrgChatPeer(orgId: string, force = false): Promise<string | null> {
  if (!orgId) return null;
  if (!(await isCareOrgChatEnabled(force))) return null;

  const hit = peerCache.get(orgId);
  if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit.peerId;

  const { data, error } = await supabase.rpc("care_org_chat_peer", { _org_id: orgId } as never);
  if (error) {
    if (/does not exist|schema cache|function/i.test(error.message)) {
      peerCache.set(orgId, { peerId: null, at: Date.now() });
      return null;
    }
    console.warn("care_org_chat_peer", error.message);
    return null;
  }

  const peerId = typeof data === "string" && data ? data : null;
  peerCache.set(orgId, { peerId, at: Date.now() });
  return peerId;
}

export async function fetchCareOrgChatLabel(
  orgId: string,
  lang: "bn" | "en",
): Promise<string | null> {
  const { data, error } = await supabase
    .from("care_orgs")
    .select("name, name_bn")
    .eq("id", orgId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { name?: string | null; name_bn?: string | null };
  if (lang === "bn") return row.name_bn || row.name || null;
  return row.name || row.name_bn || null;
}

export function invalidateCareOrgChatPeerCache(orgId?: string) {
  if (orgId) peerCache.delete(orgId);
  else peerCache.clear();
}
