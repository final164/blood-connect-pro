import { supabase } from "@/integrations/supabase/client";
import type { FeedRequest } from "@/components/request/RequestCard";
import { fetchAllSavedRequestIds, fetchSavedIdsForRequests } from "@/lib/request-saves";

export type ActivityView =
  | "posts"
  | "liked"
  | "commented"
  | "shared"
  | "saved"
  | "donated"
  | "organizations";

export const ACTIVITY_VIEWS: ActivityView[] = [
  "posts",
  "liked",
  "commented",
  "shared",
  "saved",
  "donated",
  "organizations",
];

async function hydrateRequests(ids: string[], userId?: string): Promise<FeedRequest[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase
    .from("blood_requests")
    .select("*, districts(name_bn,name_en)")
    .in("id", ids);
  if (error) throw error;

  const byId = new Map(
    (data ?? []).map((row: any) => {
      const r = { ...row, district: row.districts } as FeedRequest;
      return [r.id, r];
    }),
  );
  // Preserve interaction order
  const list = ids.map((id) => byId.get(id)).filter(Boolean) as FeedRequest[];

  const requesterIds = [...new Set(list.map((r) => r.requester_id))];
  if (requesterIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", requesterIds);
    const map = new Map((profiles ?? []).map((p) => [p.id, p]));
    for (const r of list) r.requester = map.get(r.requester_id) ?? null;
  }

  const requestIds = list.map((r) => r.id);
  if (requestIds.length) {
    const [{ data: likes }, myLikesRes, { data: comments }, savedSet] = await Promise.all([
      supabase.from("request_likes").select("request_id").in("request_id", requestIds),
      userId
        ? supabase
            .from("request_likes")
            .select("request_id")
            .eq("user_id", userId)
            .in("request_id", requestIds)
        : Promise.resolve({ data: [] as { request_id: string }[] }),
      supabase.from("request_comments").select("request_id").in("request_id", requestIds),
      userId ? fetchSavedIdsForRequests(userId, requestIds) : Promise.resolve(new Set<string>()),
    ]);
    const likeMap = new Map<string, number>();
    (likes ?? []).forEach((l: { request_id: string }) =>
      likeMap.set(l.request_id, (likeMap.get(l.request_id) ?? 0) + 1),
    );
    const cMap = new Map<string, number>();
    (comments ?? []).forEach((c: { request_id: string }) =>
      cMap.set(c.request_id, (cMap.get(c.request_id) ?? 0) + 1),
    );
    const mine = new Set((myLikesRes.data ?? []).map((l: { request_id: string }) => l.request_id));
    for (const r of list) {
      r.like_count = likeMap.get(r.id) ?? 0;
      r.comment_count = cMap.get(r.id) ?? 0;
      r.liked = mine.has(r.id);
      r.saved = savedSet.has(r.id);
    }
  }
  return list;
}

async function distinctRequestIds(
  table: string,
  userCol: string,
  userId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from(table)
    .select("request_id")
    .eq(userCol, userId)
    .order("created_at", { ascending: false });
  if (error) {
    if (/relation|column|does not exist/i.test(error.message)) return [];
    throw error;
  }
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const row of data ?? []) {
    const id = (row as { request_id: string }).request_id;
    if (!seen.has(id)) {
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

export async function loadActivityRequests(
  view: Exclude<ActivityView, "organizations">,
  userId: string,
  opts?: { offset?: number; limit?: number },
): Promise<{ items: FeedRequest[]; hasMore: boolean }> {
  const limit = opts?.limit ?? 8;
  const offset = opts?.offset ?? 0;
  let ids: string[] = [];

  if (view === "posts") {
    const { data, error } = await supabase
      .from("blood_requests")
      .select("id")
      .eq("requester_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (error) throw error;
    ids = (data ?? []).map((r: { id: string }) => r.id);
    const items = await hydrateRequests(ids, userId);
    return { items, hasMore: ids.length >= limit };
  } else if (view === "liked") {
    ids = await distinctRequestIds("request_likes", "user_id", userId);
  } else if (view === "commented") {
    ids = await distinctRequestIds("request_comments", "user_id", userId);
  } else if (view === "shared") {
    ids = await distinctRequestIds("request_shares", "user_id", userId);
  } else if (view === "saved") {
    ids = await fetchAllSavedRequestIds(userId);
  } else if (view === "donated") {
    const { data, error } = await supabase
      .from("request_donation_offers")
      .select("request_id")
      .eq("donor_id", userId)
      .eq("status", "confirmed")
      .order("updated_at", { ascending: false });
    if (error) {
      if (/request_donation_offers|relation|column/i.test(error.message)) {
        const { data: dons } = await supabase
          .from("donations")
          .select("request_id")
          .eq("donor_id", userId)
          .order("created_at", { ascending: false });
        ids = [
          ...new Set(
            (dons ?? [])
              .map((d: { request_id: string | null }) => d.request_id)
              .filter(Boolean),
          ),
        ] as string[];
      } else throw error;
    } else {
      const seen = new Set<string>();
      for (const row of data ?? []) {
        const id = (row as { request_id: string }).request_id;
        if (!seen.has(id)) {
          seen.add(id);
          ids.push(id);
        }
      }
    }
  }

  const pageIds = ids.slice(offset, offset + limit);
  const items = await hydrateRequests(pageIds, userId);
  return { items, hasMore: offset + limit < ids.length };
}
