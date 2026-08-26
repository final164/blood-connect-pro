import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { hydrateChatConversationsCache, prefetchChatList } from "@/lib/chat-store";

/** Prefetch chat list in the background so /chat opens instantly. */
export function ChatWarmup() {
  const { user } = useAuth();
  const { lang } = useI18n();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const run = () => {
      void hydrateChatConversationsCache(queryClient, user.id);
      void prefetchChatList(queryClient, user.id, lang);
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(run, { timeout: 4000 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 1500);
    return () => window.clearTimeout(t);
  }, [user?.id, lang, queryClient]);

  return null;
}
