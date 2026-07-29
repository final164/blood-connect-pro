import { supabase } from "@/integrations/supabase/client";

export async function fetchSavedIdsForRequests(
  userId: string,
  requestIds: string[],
): Promise<Set<string>> {
  if (!requestIds.length) return new Set();
  const { data, error } = await supabase
    .from("request_saves")
    .select("request_id")
    .eq("user_id", userId)
    .in("request_id", requestIds);
  if (error) {
    if (/request_saves|relation|column/i.test(error.message)) return new Set();
    throw error;
  }
  return new Set((data ?? []).map((r: { request_id: string }) => r.request_id));
}

export async function fetchAllSavedRequestIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("request_saves")
    .select("request_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    if (/request_saves|relation|column/i.test(error.message)) return [];
    throw error;
  }
  return (data ?? []).map((r: { request_id: string }) => r.request_id);
}

export async function toggleSave(requestId: string, userId: string, currentlySaved: boolean) {
  if (currentlySaved) {
    return supabase
      .from("request_saves")
      .delete()
      .eq("request_id", requestId)
      .eq("user_id", userId);
  }
  return supabase.from("request_saves").insert({ request_id: requestId, user_id: userId });
}
