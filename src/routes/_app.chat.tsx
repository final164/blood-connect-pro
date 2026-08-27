import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { MessengerIcon } from "@/components/MessengerIcon";
import { useChatUnread } from "@/lib/chat-unread-context";
import {
  fetchChatConversations,
  hydrateChatConversationsCache,
  prefetchChatThread,
  type ChatConversation,
} from "@/lib/chat-store";
import { queryKeys } from "@/lib/query-client";
import { Search } from "lucide-react";
import { PageBackButton } from "@/components/nav/PageBackButton";

export const Route = createFileRoute("/_app/chat")({
  head: () => ({ meta: [{ title: "Chat — Muktosheba" }] }),
  loader: async ({ context }) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    await hydrateChatConversationsCache(context.queryClient, userId);
  },
  component: ChatLayout,
});

function ChatLayout() {
  const { lang } = useI18n();
  const location = useLocation();
  const isThread = /\/chat\/[^/]+/.test(location.pathname);

  return (
    <div
      className={`flex min-h-0 bg-background ${
        isThread
          ? "fixed inset-0 z-50 flex-col md:static md:z-auto md:flex md:flex-1 md:h-[calc(100dvh-2rem)]"
          : "flex-1 flex-col md:flex md:h-[calc(100dvh-2rem)]"
      }`}
    >
      <div className="flex flex-1 min-h-0 overflow-hidden md:rounded-2xl md:border md:shadow-sm md:border-border/60">
        <aside
          className={`${
            isThread ? "hidden md:flex md:flex-none" : "flex flex-1"
          } w-full md:w-80 lg:w-[22rem] shrink-0 flex-col border-r border-border/60 bg-card min-h-0`}
        >
          <ChatList activePeerId={isThread ? location.pathname.split("/").pop() : undefined} />
        </aside>

        <section
          className={`${
            isThread ? "flex flex-1 flex-col min-h-0 min-w-0" : "hidden md:flex md:flex-1 md:flex-col md:min-h-0 md:min-w-0"
          } bg-background`}
        >
          {isThread ? (
            <Outlet />
          ) : (
            <div className="flex-1 grid place-items-center p-8 text-center bg-gradient-to-b from-muted/30 to-background">
              <div className="max-w-sm space-y-3">
                <div className="mx-auto h-16 w-16 rounded-2xl bg-primary/10 text-primary grid place-items-center ring-1 ring-primary/15">
                  <MessengerIcon className="h-7 w-7" />
                </div>
                <p className="text-base font-semibold tracking-tight">
                  {lang === "bn" ? "একটি কথোপকথন বেছে নিন" : "Select a conversation"}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {lang === "bn"
                    ? "বাম পাশের তালিকা থেকে চ্যাট খুলুন এবং মেসেজ করুন।"
                    : "Open a chat from the list to continue messaging."}
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ChatList({ activePeerId }: { activePeerId?: string }) {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { byConversation } = useChatUnread();
  const [query, setQuery] = useState("");

  const userId = user?.id ?? "";

  const convosQuery = useQuery({
    queryKey: queryKeys.chatConversations(userId),
    queryFn: () => fetchChatConversations(userId, lang),
    enabled: !!userId,
    staleTime: 45_000,
    gcTime: 20 * 60_000,
    placeholderData: () =>
      queryClient.getQueryData<ChatConversation[]>(queryKeys.chatConversations(userId)),
  });

  useEffect(() => {
    if (!userId) return;
    void hydrateChatConversationsCache(queryClient, userId);
  }, [userId, queryClient]);

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.chatConversations(userId) });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        void queryClient.invalidateQueries({ queryKey: queryKeys.chatConversations(userId) });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [userId, queryClient]);

  const convos = convosQuery.data ?? [];

  const filtered = query.trim()
    ? convos.filter((c) => {
        const name = (c.peer?.full_name ?? "").toLowerCase();
        const preview = (c.lastPreview ?? "").toLowerCase();
        const q = query.trim().toLowerCase();
        return name.includes(q) || preview.includes(q);
      })
    : convos;

  return (
    <>
      <header className="shrink-0 border-b border-border/60 bg-card/95 backdrop-blur-xl safe-top">
        <div className="px-3 pt-2.5 pb-2 flex items-center gap-2">
          <PageBackButton fallbackTo="/home" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[17px] font-bold tracking-tight leading-tight">{t("chat")}</h1>
          </div>
        </div>
        <div className="px-3 pb-2.5">
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={lang === "bn" ? "সার্চ…" : "Search…"}
              className="w-full h-9 rounded-xl bg-muted/70 border-0 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/25 placeholder:text-muted-foreground/80"
            />
          </label>
        </div>
      </header>

      <ul className="flex-1 overflow-y-auto min-h-0">
        {filtered.length === 0 && (
          <li className="text-center text-sm text-muted-foreground py-16 px-4">
            {query.trim()
              ? lang === "bn"
                ? "কোনো চ্যাট পাওয়া যায়নি"
                : "No chats found"
              : t("emptyChat")}
          </li>
        )}
        {filtered.map((c) => {
          const peerId = c.peer?.id ?? "";
          const active = activePeerId === peerId;
          const unreadCount = byConversation[c.id] ?? 0;
          const preview = c.lastPreview?.trim()
            ? c.lastFromMe
              ? `${lang === "bn" ? "আপনি" : "You"}: ${c.lastPreview}`
              : c.lastPreview
            : lang === "bn"
              ? "এখনও কোনো মেসেজ নেই"
              : "No messages yet";

          return (
            <li key={c.id}>
              <Link
                to="/chat/$peerId"
                params={{ peerId }}
                onPointerEnter={() => {
                  if (userId && peerId) void prefetchChatThread(queryClient, userId, peerId, lang);
                }}
                onTouchStart={() => {
                  if (userId && peerId) void prefetchChatThread(queryClient, userId, peerId, lang);
                }}
                className={`flex items-center gap-3 px-3.5 py-2.5 transition ${
                  active ? "bg-primary/[0.07]" : "hover:bg-muted/60"
                }`}
              >
                <div className="relative shrink-0">
                  <Avatar name={c.peer?.full_name} src={c.peer?.avatar_url ?? undefined} size={48} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
                  )}
                </div>
                <div className="flex-1 min-w-0 py-0.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <p
                      className={`text-[15px] truncate ${
                        unreadCount > 0 ? "font-bold text-foreground" : "font-semibold text-foreground"
                      }`}
                    >
                      {c.peer?.full_name ?? (lang === "bn" ? "ইউজার" : "User")}
                    </p>
                    <span
                      className={`shrink-0 text-[11px] tabular-nums ${
                        unreadCount > 0 ? "text-primary font-semibold" : "text-muted-foreground"
                      }`}
                    >
                      {timeAgo(c.last_message_at, lang)}
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 min-w-0">
                    <p
                      className={`flex-1 min-w-0 text-[13px] truncate leading-snug ${
                        unreadCount > 0 ? "text-foreground/80 font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {preview}
                    </p>
                    {unreadCount > 0 && (
                      <span className="shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none grid place-items-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                    {c.peer?.blood_group && unreadCount === 0 && (
                      <span className="shrink-0 text-[10px] font-semibold text-primary/90 bg-primary/10 px-1.5 py-0.5 rounded-md">
                        {c.peer.blood_group}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
