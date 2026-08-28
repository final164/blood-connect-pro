import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type Ctx = {
  unread: number;
  byConversation: Record<string, number>;
  refresh: () => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
};

const ChatUnreadContext = createContext<Ctx | null>(null);

function aggregate(rows: { conversation_id: string }[]) {
  const byConversation: Record<string, number> = {};
  for (const r of rows) {
    byConversation[r.conversation_id] = (byConversation[r.conversation_id] ?? 0) + 1;
  }
  return byConversation;
}

export function ChatUnreadProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [byConversation, setByConversation] = useState<Record<string, number>>({});

  const refresh = useCallback(async () => {
    if (!user) {
      setByConversation({});
      return;
    }
    const { data, error } = await supabase
      .from("messages")
      .select("conversation_id")
      .eq("recipient_id", user.id)
      .is("read_at", null)
      .limit(500);
    if (error) {
      setByConversation({});
      return;
    }
    setByConversation(aggregate((data ?? []) as { conversation_id: string }[]));
  }, [user]);

  useEffect(() => {
    // Defer badge fetch + realtime — never compete with first paint.
    if (!user) {
      setByConversation({});
      return;
    }
    let cancelled = false;
    let ch: ReturnType<typeof supabase.channel> | null = null;

    const start = () => {
      if (cancelled) return;
      void refresh();
      ch = supabase
        .channel(`chat-unread-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${user.id}`,
          },
          () => void refresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${user.id}`,
          },
          () => void refresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "messages",
            filter: `recipient_id=eq.${user.id}`,
          },
          () => void refresh(),
        )
        .subscribe();
    };

    const idleId =
      typeof requestIdleCallback === "function"
        ? requestIdleCallback(start, { timeout: 3500 })
        : null;
    const t = idleId == null ? window.setTimeout(start, 1200) : null;

    return () => {
      cancelled = true;
      if (idleId != null) cancelIdleCallback(idleId);
      if (t != null) window.clearTimeout(t);
      if (ch) supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  const markConversationRead = useCallback(
    async (conversationId: string) => {
      if (!user || !conversationId) return;
      setByConversation((prev) => {
        if (!prev[conversationId]) return prev;
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      const now = new Date().toISOString();
      await supabase
        .from("messages")
        .update({ read_at: now })
        .eq("conversation_id", conversationId)
        .eq("recipient_id", user.id)
        .is("read_at", null);
    },
    [user],
  );

  const unread = useMemo(
    () => Object.values(byConversation).reduce((sum, n) => sum + n, 0),
    [byConversation],
  );

  const value = useMemo(
    () => ({ unread, byConversation, refresh, markConversationRead }),
    [unread, byConversation, refresh, markConversationRead],
  );

  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
}

export function useChatUnread() {
  const ctx = useContext(ChatUnreadContext);
  if (!ctx) throw new Error("useChatUnread outside provider");
  return ctx;
}

/** Safe for components that may render outside the provider. */
export function useChatUnreadOptional(): Ctx | null {
  return useContext(ChatUnreadContext);
}
