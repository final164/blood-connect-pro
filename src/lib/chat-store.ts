import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { conversationSecret, decryptMessage } from "@/lib/e2ee";
import { fetchProfileForViewer } from "@/lib/profile-lock";
import { cacheGet, cacheSet } from "@/lib/offline";
import { queryKeys } from "@/lib/query-client";

export type ChatPeer = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  blood_group: string | null;
};

export type ChatConversation = {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at: string;
  peer?: ChatPeer;
  lastPreview?: string;
  lastFromMe?: boolean;
};

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_id: string;
  recipient_id: string;
  ciphertext: string;
  iv: string | null;
  is_encrypted: boolean;
  created_at: string;
  plaintext: string;
};

type LastMsgRow = {
  conversation_id: string;
  sender_id: string;
  ciphertext: string;
  iv: string | null;
  is_encrypted: boolean;
  created_at: string;
};

function convosIdbKey(userId: string) {
  return `chat-convos:${userId}`;
}

function msgsIdbKey(convId: string) {
  return `chat-msgs:${convId}`;
}

function previewText(raw: string, lang: "bn" | "en"): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (!t || t === "🔒") return lang === "bn" ? "মেসেজ" : "Message";
  return t.length > 72 ? `${t.slice(0, 72)}…` : t;
}

async function attachLastMessagePreviews(
  list: ChatConversation[],
  userId: string,
  lang: "bn" | "en",
): Promise<ChatConversation[]> {
  if (!list.length) return list;
  const ids = list.map((c) => c.id);
  const { data } = await supabase
    .from("messages")
    .select("conversation_id, sender_id, ciphertext, iv, is_encrypted, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(ids.length * 4, 40), 200));

  const latest = new Map<string, LastMsgRow>();
  for (const row of (data ?? []) as LastMsgRow[]) {
    if (!latest.has(row.conversation_id)) latest.set(row.conversation_id, row);
  }

  return Promise.all(
    list.map(async (c) => {
      const m = latest.get(c.id);
      if (!m) return { ...c, lastPreview: "", lastFromMe: false };
      const peerId = c.user_a === userId ? c.user_b : c.user_a;
      const secret = conversationSecret(userId, peerId);
      const plain =
        m.is_encrypted && m.iv
          ? await decryptMessage(m.ciphertext, m.iv, secret)
          : m.ciphertext;
      return {
        ...c,
        lastPreview: previewText(plain, lang),
        lastFromMe: m.sender_id === userId,
      };
    }),
  );
}

/** Conversations + peer profiles (fast). Previews filled in background when missing. */
export async function fetchChatConversations(
  userId: string,
  lang: "bn" | "en" = "bn",
): Promise<ChatConversation[]> {
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order("last_message_at", { ascending: false });

  const list = (data ?? []) as ChatConversation[];
  const peerIds = list.map((c) => (c.user_a === userId ? c.user_b : c.user_a));
  let withPeers = list;
  if (peerIds.length) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, blood_group")
      .in("id", peerIds);
    const map = new Map((profiles ?? []).map((p) => [p.id, p] as const));
    withPeers = list.map((c) => ({
      ...c,
      peer: map.get(c.user_a === userId ? c.user_b : c.user_a) as ChatPeer | undefined,
    }));
  }

  const enriched = await attachLastMessagePreviews(withPeers, userId, lang);
  void cacheSet(convosIdbKey(userId), enriched);
  return enriched;
}

export async function ensureConversationId(userId: string, peerId: string): Promise<string> {
  const [a, b] = [userId, peerId].sort();
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from("conversations")
    .insert({ user_a: a, user_b: b })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505" || /duplicate key|unique constraint/i.test(error.message)) {
      const { data: again } = await supabase
        .from("conversations")
        .select("id")
        .eq("user_a", a)
        .eq("user_b", b)
        .maybeSingle();
      if (again?.id) return again.id;
    }
    throw error;
  }
  return data.id;
}

export async function fetchChatMessages(
  convId: string,
  userId: string,
  peerId: string,
): Promise<ChatMessage[]> {
  const secret = conversationSecret(userId, peerId);
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(200);

  const decrypted = await Promise.all(
    ((data ?? []) as Omit<ChatMessage, "plaintext">[]).map(async (m) => ({
      ...m,
      plaintext:
        m.is_encrypted && m.iv ? await decryptMessage(m.ciphertext, m.iv, secret) : m.ciphertext,
    })),
  );
  void cacheSet(msgsIdbKey(convId), decrypted);
  return decrypted;
}

export function peerFromConversationsCache(
  queryClient: QueryClient,
  userId: string,
  peerId: string,
): ChatPeer | undefined {
  const convos = queryClient.getQueryData<ChatConversation[]>(
    queryKeys.chatConversations(userId),
  );
  return convos?.find((c) => c.peer?.id === peerId)?.peer;
}

/** Paint chat list from IndexedDB before network (instant tab open). */
export async function hydrateChatConversationsCache(
  queryClient: QueryClient,
  userId: string,
): Promise<boolean> {
  if (queryClient.getQueryData(queryKeys.chatConversations(userId))) return true;
  const cached = await cacheGet<ChatConversation[]>(convosIdbKey(userId));
  if (!cached?.length) return false;
  queryClient.setQueryData(queryKeys.chatConversations(userId), cached);
  return true;
}

/** Paint thread messages from IndexedDB before network. */
export async function hydrateChatMessagesCache(
  queryClient: QueryClient,
  convId: string,
): Promise<boolean> {
  if (queryClient.getQueryData(queryKeys.chatMessages(convId))) return true;
  const cached = await cacheGet<ChatMessage[]>(msgsIdbKey(convId));
  if (!cached?.length) return false;
  queryClient.setQueryData(queryKeys.chatMessages(convId), cached);
  return true;
}

export async function prefetchChatList(
  queryClient: QueryClient,
  userId: string,
  lang: "bn" | "en" = "bn",
) {
  await hydrateChatConversationsCache(queryClient, userId);
  await queryClient.prefetchQuery({
    queryKey: queryKeys.chatConversations(userId),
    queryFn: () => fetchChatConversations(userId, lang),
    staleTime: 45_000,
  });
}

export async function prefetchChatThread(
  queryClient: QueryClient,
  userId: string,
  peerId: string,
  lang: "bn" | "en" = "bn",
) {
  await prefetchChatList(queryClient, userId, lang);

  const peerCached = peerFromConversationsCache(queryClient, userId, peerId);
  if (!peerCached) {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.chatPeer(peerId, userId),
      queryFn: () => fetchProfileForViewer(peerId, userId),
      staleTime: 5 * 60_000,
    });
  }

  let convId = queryClient.getQueryData<string>(queryKeys.chatConvId(userId, peerId));
  if (!convId) {
    const convos = queryClient.getQueryData<ChatConversation[]>(
      queryKeys.chatConversations(userId),
    );
    convId = convos?.find(
      (c) => c.user_a === peerId || c.user_b === peerId,
    )?.id;
  }

  if (!convId) {
    convId = await queryClient.fetchQuery({
      queryKey: queryKeys.chatConvId(userId, peerId),
      queryFn: () => ensureConversationId(userId, peerId),
      staleTime: Infinity,
    });
  } else {
    queryClient.setQueryData(queryKeys.chatConvId(userId, peerId), convId);
  }

  await hydrateChatMessagesCache(queryClient, convId);
  await queryClient.prefetchQuery({
    queryKey: queryKeys.chatMessages(convId),
    queryFn: () => fetchChatMessages(convId, userId, peerId),
    staleTime: 30_000,
  });
}

export function appendChatMessage(
  queryClient: QueryClient,
  convId: string,
  msg: ChatMessage,
) {
  queryClient.setQueryData<ChatMessage[]>(queryKeys.chatMessages(convId), (prev) => {
    const list = prev ?? [];
    if (list.some((m) => m.id === msg.id)) return list;
    const next = [...list, msg];
    void cacheSet(msgsIdbKey(convId), next);
    return next;
  });
}

export function removeChatMessages(
  queryClient: QueryClient,
  convId: string,
  ids: string[],
) {
  queryClient.setQueryData<ChatMessage[]>(queryKeys.chatMessages(convId), (prev) => {
    if (!prev) return prev;
    const next = prev.filter((m) => !ids.includes(m.id));
    void cacheSet(msgsIdbKey(convId), next);
    return next;
  });
}
