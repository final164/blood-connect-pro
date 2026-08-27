import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Avatar } from "@/components/Avatar";
import { conversationSecret, encryptMessage, decryptMessage } from "@/lib/e2ee";
import { Check, Send, ShieldCheck, Trash2, X } from "lucide-react";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { fetchProfileForViewer } from "@/lib/profile-lock";
import { useChatUnread } from "@/lib/chat-unread-context";
import {
  appendChatMessage,
  ensureConversationId,
  fetchChatMessages,
  hydrateChatMessagesCache,
  peerFromConversationsCache,
  prefetchChatThread,
  removeChatMessages,
  type ChatMessage,
} from "@/lib/chat-store";
import { queryKeys } from "@/lib/query-client";
import { toast } from "sonner";
import { fetchCareOrgChatLabel } from "@/lib/care-chat";

const TYPING_IDLE_MS = 1800;
const PEER_TYPING_HOLD_MS = 3200;
const LONG_PRESS_MS = 480;

type ChatSearch = { fromRequestId?: string; careOrgId?: string };

export const Route = createFileRoute("/_app/chat/$peerId")({
  head: () => ({ meta: [{ title: "Conversation — Muktosheba" }] }),
  validateSearch: (search: Record<string, unknown>): ChatSearch => ({
    fromRequestId: typeof search.fromRequestId === "string" ? search.fromRequestId : undefined,
    careOrgId: typeof search.careOrgId === "string" ? search.careOrgId : undefined,
  }),
  loader: async ({ context, params }) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    await prefetchChatThread(context.queryClient, userId, params.peerId);
  },
  component: Thread,
});

function Thread() {
  const { peerId } = Route.useParams();
  const { fromRequestId, careOrgId } = Route.useSearch();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const queryClient = useQueryClient();
  const { markConversationRead } = useChatUnread();
  const userId = user?.id ?? "";
  const [careOrgLabel, setCareOrgLabel] = useState<string | null>(null);

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const longPressRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingIdleRef = useRef<number | null>(null);
  const peerTypingHoldRef = useRef<number | null>(null);
  const lastTypingSentRef = useRef(false);
  const lastTypingAtRef = useRef(0);

  const convIdQuery = useQuery({
    queryKey: queryKeys.chatConvId(userId, peerId),
    queryFn: () => ensureConversationId(userId, peerId),
    enabled: !!userId && !!peerId,
    staleTime: Infinity,
    gcTime: Infinity,
    initialData: () => {
      const convos = queryClient.getQueryData<{ id: string; user_a: string; user_b: string }[]>(
        queryKeys.chatConversations(userId),
      );
      return convos?.find((c) => c.user_a === peerId || c.user_b === peerId)?.id;
    },
  });

  const convId = convIdQuery.data ?? null;

  const peerQuery = useQuery({
    queryKey: queryKeys.chatPeer(peerId, userId),
    queryFn: () => fetchProfileForViewer(peerId, userId),
    enabled: !!userId && !!peerId,
    staleTime: 5 * 60_000,
    placeholderData: () => peerFromConversationsCache(queryClient, userId, peerId) ?? undefined,
  });

  const peer = peerQuery.data;

  useEffect(() => {
    if (!careOrgId) {
      setCareOrgLabel(null);
      return;
    }
    let cancelled = false;
    void fetchCareOrgChatLabel(careOrgId, lang).then((name) => {
      if (!cancelled) setCareOrgLabel(name);
    });
    return () => {
      cancelled = true;
    };
  }, [careOrgId, lang]);

  const messagesQuery = useQuery({
    queryKey: queryKeys.chatMessages(convId ?? ""),
    queryFn: () => fetchChatMessages(convId!, userId, peerId),
    enabled: !!convId && !!userId,
    staleTime: 30_000,
    gcTime: 20 * 60_000,
    placeholderData: () =>
      convId ? queryClient.getQueryData<ChatMessage[]>(queryKeys.chatMessages(convId)) : undefined,
  });

  const msgs = messagesQuery.data ?? [];

  useEffect(() => {
    if (!convId) return;
    void hydrateChatMessagesCache(queryClient, convId);
  }, [convId, queryClient]);

  useEffect(() => {
    if (!convId) return;
    void markConversationRead(convId);
  }, [convId, markConversationRead]);

  useEffect(() => {
    if (!msgs.length) return;
    requestAnimationFrame(() => scrollerRef.current?.scrollTo({ top: 1e9 }));
  }, [convId, msgs.length]);

  const clearPeerTypingHold = useCallback(() => {
    if (peerTypingHoldRef.current != null) {
      window.clearTimeout(peerTypingHoldRef.current);
      peerTypingHoldRef.current = null;
    }
  }, []);

  const markPeerTyping = useCallback(
    (isTyping: boolean) => {
      clearPeerTypingHold();
      if (!isTyping) {
        setPeerTyping(false);
        return;
      }
      setPeerTyping(true);
      peerTypingHoldRef.current = window.setTimeout(() => {
        setPeerTyping(false);
        peerTypingHoldRef.current = null;
      }, PEER_TYPING_HOLD_MS);
    },
    [clearPeerTypingHold],
  );

  const sendTyping = useCallback(
    (isTyping: boolean) => {
      if (!user || !channelRef.current) return;
      if (!isTyping) {
        if (!lastTypingSentRef.current) return;
        lastTypingSentRef.current = false;
        lastTypingAtRef.current = 0;
        void channelRef.current.send({
          type: "broadcast",
          event: "typing",
          payload: { userId: user.id, typing: false },
        });
        return;
      }
      const now = Date.now();
      if (lastTypingSentRef.current && now - lastTypingAtRef.current < 1000) return;
      lastTypingSentRef.current = true;
      lastTypingAtRef.current = now;
      void channelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: { userId: user.id, typing: true },
      });
    },
    [user],
  );

  const stopTyping = useCallback(() => {
    if (typingIdleRef.current != null) {
      window.clearTimeout(typingIdleRef.current);
      typingIdleRef.current = null;
    }
    sendTyping(false);
  }, [sendTyping]);

  const onComposerChange = useCallback(
    (value: string) => {
      setText(value);
      if (!value.trim()) {
        stopTyping();
        return;
      }
      sendTyping(true);
      if (typingIdleRef.current != null) window.clearTimeout(typingIdleRef.current);
      typingIdleRef.current = window.setTimeout(() => {
        sendTyping(false);
        typingIdleRef.current = null;
      }, TYPING_IDLE_MS);
    },
    [sendTyping, stopTyping],
  );

  useEffect(() => {
    if (!convId || !user) return;
    const secret = conversationSecret(user.id, peerId);
    setPeerTyping(false);
    lastTypingSentRef.current = false;

    const ch = supabase
      .channel(`msg-${convId}`, { config: { broadcast: { self: false } } })
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        async (payload) => {
          const m = payload.new as ChatMessage;
          if (m.sender_id === peerId) markPeerTyping(false);
          if (m.recipient_id === user.id) void markConversationRead(convId);
          const plaintext =
            m.is_encrypted && m.iv ? await decryptMessage(m.ciphertext, m.iv, secret) : m.ciphertext;
          appendChatMessage(queryClient, convId, { ...m, plaintext });
          requestAnimationFrame(() =>
            scrollerRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${convId}` },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          removeChatMessages(queryClient, convId, [id]);
          setSelected((prev) => {
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            if (next.size === 0) setSelectMode(false);
            return next;
          });
        },
      )
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        const p = payload as { userId?: string; typing?: boolean } | null;
        if (!p || p.userId !== peerId) return;
        markPeerTyping(Boolean(p.typing));
      })
      .subscribe();
    channelRef.current = ch;

    return () => {
      stopTyping();
      clearPeerTypingHold();
      channelRef.current = null;
      supabase.removeChannel(ch);
    };
  }, [
    convId,
    user,
    peerId,
    markPeerTyping,
    stopTyping,
    clearPeerTypingHold,
    markConversationRead,
    queryClient,
  ]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  function clearLongPress() {
    if (longPressRef.current != null) {
      window.clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }

  function exitSelection() {
    setSelectMode(false);
    setSelected(new Set());
  }

  function enterSelection(id: string) {
    setSelectMode(true);
    setSelected(new Set([id]));
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(12);
    }
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      if (next.size === 0) setSelectMode(false);
      return next;
    });
  }

  function onOwnMessagePressStart(id: string) {
    clearLongPress();
    longPressTriggeredRef.current = false;
    longPressRef.current = window.setTimeout(() => {
      longPressTriggeredRef.current = true;
      enterSelection(id);
    }, LONG_PRESS_MS);
  }

  function onOwnMessagePressEnd() {
    clearLongPress();
  }

  function onOwnMessageClick(id: string) {
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (selectMode) toggleSelected(id);
  }

  async function deleteSelected() {
    if (!user || !convId || selected.size === 0) return;
    const ids = [...selected];
    setDeleting(true);
    const { error } = await supabase.from("messages").delete().in("id", ids).eq("sender_id", user.id);
    setDeleting(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    removeChatMessages(queryClient, convId, ids);
    exitSelection();
    toast.success(t("messagesDeleted"));
  }

  async function send() {
    if (!text.trim() || !convId || !user || selectMode) return;
    stopTyping();
    setSending(true);
    const secret = conversationSecret(user.id, peerId);
    const { ciphertext, iv } = await encryptMessage(text.trim(), secret);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: convId,
        sender_id: user.id,
        recipient_id: peerId,
        ciphertext,
        iv,
        is_encrypted: true,
      })
      .select("*")
      .single();
    setSending(false);
    if (error) return toast.error(error.message);
    if (data) {
      appendChatMessage(queryClient, convId, {
        ...(data as ChatMessage),
        plaintext: text.trim(),
      });
    }
    setText("");
    requestAnimationFrame(() => scrollerRef.current?.scrollTo({ top: 1e9, behavior: "smooth" }));
  }

  const selectedCount = selected.size;
  const peerName =
    careOrgLabel ||
    (peer?.full_name as string | null | undefined) ||
    (lang === "bn" ? "ইউজার" : "User");
  const peerSubtitle = careOrgLabel
    ? lang === "bn"
      ? "হাসপাতাল / ক্লিনিক"
      : "Hospital / clinic"
    : null;

  return (
    <div className="flex flex-col flex-1 min-h-0 h-full">
      <header className="shrink-0 glass border-b safe-top">
        {selectMode ? (
          <div className="flex items-center gap-2 px-3 py-2.5">
            <button
              type="button"
              onClick={exitSelection}
              className="p-1.5 rounded-lg hover:bg-muted"
              aria-label={t("cancel")}
            >
              <X className="h-4 w-4" />
            </button>
            <p className="flex-1 text-sm font-semibold">
              {selectedCount} {t("messagesSelected")}
            </p>
            <button
              type="button"
              disabled={deleting || selectedCount === 0}
              onClick={() => void deleteSelected()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-destructive text-destructive-foreground px-3 py-2 text-xs font-semibold disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t("deleteMessages")}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-2.5">
            {fromRequestId ? (
              <PageBackButton
                to={{ to: "/home", search: { requestId: fromRequestId } }}
                size="sm"
                shape="xl"
              />
            ) : (
              <PageBackButton
                to="/chat"
                size="sm"
                shape="xl"
                className="md:hidden"
              />
            )}
            <Link
              to="/profile/$userId"
              params={{ userId: peerId }}
              className="flex items-center gap-2 flex-1 min-w-0"
            >
              <Avatar
                name={peer?.full_name as string | undefined}
                src={(peer?.avatar_url as string | null | undefined) ?? undefined}
                size={36}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{peerName}</p>
                {peerTyping ? (
                  <p className="text-[10px] text-primary font-medium animate-pulse">{t("typing")}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    {peerSubtitle ?? t("encrypted")}
                    {!peerSubtitle && peer?.blood_group && (
                      <span className="ml-1 font-semibold text-primary">· {peer.blood_group as string}</span>
                    )}
                  </p>
                )}
              </div>
            </Link>
          </div>
        )}
      </header>

      {!selectMode && (
        <p className="shrink-0 px-3 py-1 text-[10px] text-muted-foreground text-center border-b bg-muted/30">
          {lang === "bn"
            ? "নিজের বার্তায় চেপে ধরে সিলেক্ট করুন"
            : "Press and hold your messages to select"}
        </p>
      )}

      <div ref={scrollerRef} className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1.5">
        {msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          const isSelected = selected.has(m.id);
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                role={mine ? "button" : undefined}
                tabIndex={mine && selectMode ? 0 : undefined}
                onPointerDown={mine ? () => onOwnMessagePressStart(m.id) : undefined}
                onPointerUp={mine ? onOwnMessagePressEnd : undefined}
                onPointerLeave={mine ? onOwnMessagePressEnd : undefined}
                onPointerCancel={mine ? onOwnMessagePressEnd : undefined}
                onClick={mine ? () => onOwnMessageClick(m.id) : undefined}
                onContextMenu={
                  mine
                    ? (e) => {
                        e.preventDefault();
                        if (selectMode) toggleSelected(m.id);
                        else enterSelection(m.id);
                      }
                    : undefined
                }
                className={`relative max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-2 text-sm transition select-none touch-manipulation ${
                  mine
                    ? `rounded-br-md text-primary-foreground ${isSelected ? "ring-2 ring-destructive ring-offset-2 ring-offset-background bg-primary/90" : "bg-primary"} ${selectMode ? "cursor-pointer active:scale-[0.98]" : ""}`
                    : "bg-muted text-foreground rounded-bl-md"
                }`}
              >
                {mine && isSelected && (
                  <span className="absolute -top-1.5 -left-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground grid place-items-center shadow">
                    <Check className="h-3 w-3" strokeWidth={3} />
                  </span>
                )}
                <p className="whitespace-pre-wrap break-words leading-snug">{m.plaintext}</p>
              </div>
            </div>
          );
        })}
        {peerTyping && (
          <div className="flex justify-start pt-1">
            <div className="rounded-2xl rounded-bl-md bg-muted px-3 py-2 text-xs text-muted-foreground animate-pulse">
              {t("typing")}
            </div>
          </div>
        )}
      </div>

      {!selectMode && (
        <div className="shrink-0 border-t glass safe-bottom bg-background">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
            className="flex items-end gap-2 px-3 py-2"
          >
            <textarea
              ref={textareaRef}
              className="flex-1 resize-none rounded-2xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 max-h-40 leading-snug"
              rows={1}
              placeholder={t("typeMessage")}
              value={text}
              onChange={(e) => onComposerChange(e.target.value)}
              onBlur={() => stopTyping()}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="submit"
              disabled={sending || !text.trim()}
              className="rounded-full bg-primary text-primary-foreground h-10 w-10 shrink-0 grid place-items-center disabled:opacity-40"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
