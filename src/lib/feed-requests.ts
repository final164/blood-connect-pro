import { supabase } from "@/integrations/supabase/client";
import type { FeedRequest } from "@/components/request/RequestCard";
import { BLOOD_GROUPS } from "@/lib/format";
import { fetchSavedIdsForRequests } from "@/lib/request-saves";

<<<<<<< HEAD
export const FEED_PAGE_SIZE = 8;
=======
/** Small pages → first post paints fast; more load on scroll. */
export const FEED_PAGE_SIZE = 3;
>>>>>>> main

export type FeedQuery = {
  bloodGroup?: string;
  districtId?: string | null;
  offset?: number;
  limit?: number;
  userId?: string | null;
};

/** Enrich request rows with requester + like/comment/save state. */
export async function enrichFeedRequests(
  list: FeedRequest[],
  userId?: string | null,
): Promise<FeedRequest[]> {
  if (!list.length) return list;

  const requesterIds = [...new Set(list.map((r) => r.requester_id))];
  const requestIds = list.map((r) => r.id);
<<<<<<< HEAD

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
      r.like_count = likeMap.get(r.id) ?? r.like_count ?? 0;
      r.comment_count = cMap.get(r.id) ?? r.comment_count ?? 0;
      r.liked = mine.has(r.id);
      r.saved = savedSet.has(r.id);
    }
  }

=======
  // Ranked RPC already returns counts — skip heavy full-table count scans.
  const needsCounts = list.some(
    (r) => typeof r.like_count !== "number" || typeof r.comment_count !== "number",
  );

  const profilesP = requesterIds.length
    ? supabase.from("profiles").select("id, full_name, avatar_url").in("id", requesterIds)
    : Promise.resolve({ data: [] as { id: string; full_name: string | null; avatar_url: string | null }[] });

  const myLikesP = userId
    ? supabase
        .from("request_likes")
        .select("request_id")
        .eq("user_id", userId)
        .in("request_id", requestIds)
    : Promise.resolve({ data: [] as { request_id: string }[] });

  const savedP = userId
    ? fetchSavedIdsForRequests(userId, requestIds)
    : Promise.resolve(new Set<string>());

  const likesP = needsCounts
    ? supabase.from("request_likes").select("request_id").in("request_id", requestIds)
    : Promise.resolve({ data: null as { request_id: string }[] | null, error: null });

  const commentsP = needsCounts
    ? supabase.from("request_comments").select("request_id").in("request_id", requestIds)
    : Promise.resolve({ data: null as { request_id: string }[] | null, error: null });

  const [{ data: profiles }, myLikesRes, savedSet, likesRes, commentsRes] = await Promise.all([
    profilesP,
    myLikesP,
    savedP,
    likesP,
    commentsP,
  ]);

  const map = new Map((profiles ?? []).map((p) => [p.id, p]));
  for (const r of list) r.requester = map.get(r.requester_id) ?? r.requester ?? null;

  const mine = new Set((myLikesRes.data ?? []).map((l: { request_id: string }) => l.request_id));

  if (needsCounts && !(likesRes as { error?: unknown }).error && !(commentsRes as { error?: unknown }).error) {
    const likeMap = new Map<string, number>();
    (likesRes.data ?? []).forEach((l: { request_id: string }) =>
      likeMap.set(l.request_id, (likeMap.get(l.request_id) ?? 0) + 1),
    );
    const cMap = new Map<string, number>();
    (commentsRes.data ?? []).forEach((c: { request_id: string }) =>
      cMap.set(c.request_id, (cMap.get(c.request_id) ?? 0) + 1),
    );
    for (const r of list) {
      r.like_count = likeMap.get(r.id) ?? r.like_count ?? 0;
      r.comment_count = cMap.get(r.id) ?? r.comment_count ?? 0;
    }
  }

  for (const r of list) {
    r.liked = mine.has(r.id);
    r.saved = savedSet.has(r.id);
    r.like_count = r.like_count ?? 0;
    r.comment_count = r.comment_count ?? 0;
  }

>>>>>>> main
  return list;
}

function mapRpcRow(row: Record<string, unknown>): FeedRequest {
  return {
    ...(row as unknown as FeedRequest),
    like_count: Number(row.like_count ?? 0),
    comment_count: Number(row.comment_count ?? 0),
    district:
      row.district_name_bn || row.district_name_en
        ? {
            name_bn: String(row.district_name_bn ?? ""),
            name_en: String(row.district_name_en ?? ""),
          }
        : null,
  };
}

async function fetchFeedPageLegacy(q: FeedQuery): Promise<{
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

/** Personalized ranked feed; optional hard blood/district filters still applied. */
export async function fetchFeedPage(q: FeedQuery): Promise<{
  items: FeedRequest[];
  hasMore: boolean;
}> {
  const limit = q.limit ?? FEED_PAGE_SIZE;
  const offset = q.offset ?? 0;
  const blood =
    q.bloodGroup && q.bloodGroup !== "ALL" ? q.bloodGroup : null;

  const { data, error } = await supabase.rpc("fetch_ranked_feed", {
    p_viewer: q.userId ?? null,
    p_limit: limit,
    p_offset: offset,
    p_blood: blood,
    p_district: q.districtId ?? null,
  });

  if (error) {
    if (/fetch_ranked_feed|function|schema cache/i.test(error.message)) {
      return fetchFeedPageLegacy(q);
    }
    throw error;
  }

  const rows = (data ?? []) as Record<string, unknown>[];
  const list = rows.map(mapRpcRow);
  const items = await enrichFeedRequests(list, q.userId);
  return { items, hasMore: rows.length >= limit };
}
