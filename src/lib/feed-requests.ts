import { supabase } from "@/integrations/supabase/client";
import type { FeedRequest } from "@/components/request/RequestCard";
import { BLOOD_GROUPS } from "@/lib/format";
import { fetchSavedIdsForRequests } from "@/lib/request-saves";

export const FEED_PAGE_SIZE = 8;

export type FeedQuery = {
  bloodGroup?: string;
  districtId?: string | null;
  offset?: number;
  limit?: number;
  userId?: string | null;
};

/** Enrich request rows with requester + like/comment/save counts. */
export async function enrichFeedRequests(
  list: FeedRequest[],
  userId?: string | null,
): Promise<FeedRequest[]> {
  if (!list.length) return list;

  const requesterIds = [...new Set(list.map((r) => r.requester_id))];
  const requestIds = list.map((r) => r.id);

  if (requesterIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", requesterIds);
    const map = new Map((profiles ?? []).map((p) => [p.id, p]));
    for (const r of list) r.requester = map.get(r.requester_id) ?? null;
  }

  const [{ data: likes, error: likesErr }, myLikesRes, { data: comments, error: cmtErr }, savedSet] =
    await Promise.all([
      supabase.from("request_likes").select("request_id").in("request_id", requestIds),
      userId
        ? supabase
            .from("request_likes")
            .select("request_id")
            .eq("user_id", userId)
            .in("request_id", requestIds)
        : Promise.resolve({ data: [] as { request_id: string }[], error: null }),
      supabase.from("request_comments").select("request_id").in("request_id", requestIds),
      userId ? fetchSavedIdsForRequests(userId, requestIds) : Promise.resolve(new Set<string>()),
    ]);

  if (!likesErr && !cmtErr) {
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

export async function fetchFeedPage(q: FeedQuery): Promise<{
  items: FeedRequest[];
  hasMore: boolean;
}> {
  const limit = q.limit ?? FEED_PAGE_SIZE;
  const offset = q.offset ?? 0;

  let query = supabase
    .from("blood_requests")
    .select("*, districts(name_bn,name_en)")
    .eq("status", "open")
    .order("urgency", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (q.bloodGroup && q.bloodGroup !== "ALL") {
    query = query.eq("blood_group", q.bloodGroup as (typeof BLOOD_GROUPS)[number]);
  }
  if (q.districtId) query = query.eq("district_id", q.districtId);

  const { data, error } = await query;
  if (error) throw error;

  const list = (data ?? []).map((row: any) => ({
    ...row,
    district: row.districts,
  })) as FeedRequest[];

  const items = await enrichFeedRequests(list, q.userId);
  return { items, hasMore: list.length >= limit };
}
