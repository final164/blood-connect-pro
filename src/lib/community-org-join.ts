import { supabase } from "@/integrations/supabase/client";

async function callRpc(fn: string, args: Record<string, unknown>) {
  const rpc = supabase.rpc as unknown as (
    name: string,
    params: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
  const { data, error } = await rpc(fn, args);
  if (error) throw new Error(error.message);
  return data;
}

export type OrgJoinState = {
  member: boolean;
  status: "pending" | "approved" | "rejected" | "member" | null;
};

export type OrgJoinRequestRow = {
  id: string;
  org_id: string;
  user_id: string;
  message: string | null;
  status: string;
  requester_name: string | null;
  requester_phone: string | null;
  requester_blood_group: string | null;
  created_at: string;
};

const MIGRATION = "20261021130000_community_org_join_requests.sql";

export function orgJoinErrorMessage(err: unknown, lang: "bn" | "en") {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const code = raw.toLowerCase();
  if (/not_authenticated/.test(code)) {
    return lang === "bn" ? "আগে লগইন করুন" : "Sign in first";
  }
  if (/org_not_found/.test(code)) {
    return lang === "bn" ? "সংস্থা পাওয়া যায়নি" : "Organization not found";
  }
  if (/not_allowed/.test(code)) {
    return lang === "bn" ? "অনুমতি নেই" : "No permission";
  }
  if (/request_not_pending|request_not_found/.test(code)) {
    return lang === "bn" ? "এই অনুরোধ আর খোলা নেই" : "This request is no longer open";
  }
  if (/function|schema cache|does not exist|community_org_join/i.test(code)) {
    return lang === "bn"
      ? `ডাটাবেস আপডেট লাগবে। Supabase-এ ${MIGRATION} চালান।`
      : `Database update required. Run ${MIGRATION} in Supabase.`;
  }
  return raw || (lang === "bn" ? "কিছু একটা ভুল হয়েছে" : "Something went wrong");
}

export async function fetchMyOrgJoinState(orgId: string): Promise<OrgJoinState> {
  const data = await callRpc("my_org_join_state", { p_org_id: orgId });
  const row = (data ?? {}) as { member?: boolean; status?: string | null };
  const status = row.status;
  return {
    member: row.member === true || status === "member",
    status:
      status === "pending" || status === "approved" || status === "rejected" || status === "member"
        ? status
        : null,
  };
}

export async function requestJoinCommunityOrg(orgId: string, message?: string) {
  const data = await callRpc("request_join_community_org", {
    p_org_id: orgId,
    p_message: message?.trim() || null,
  });
  return (data ?? {}) as {
    status?: string;
    already_member?: boolean;
    already_pending?: boolean;
    request_id?: string;
  };
}

export async function listOrgJoinRequests(orgId: string): Promise<OrgJoinRequestRow[]> {
  const data = await callRpc("list_org_join_requests", { p_org_id: orgId });
  return (Array.isArray(data) ? data : []) as OrgJoinRequestRow[];
}

export async function reviewOrgJoinRequest(requestId: string, approve: boolean) {
  const data = await callRpc("review_community_org_join_request", {
    p_request_id: requestId,
    p_approve: approve,
  });
  return data as { status?: string } | null;
}
