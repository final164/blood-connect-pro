import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { MessengerIcon } from "@/components/MessengerIcon";
import { ArrowLeft, ShieldCheck } from "lucide-react";

type Convo = {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at: string;
  peer?: { id: string; full_name: string | null; avatar_url: string | null; blood_group: string | null };
};

export const Route = createFileRoute("/_app/chat")({
  head: () => ({ meta: [{ title: "Chat — BloodLink" }] }),
  component: ChatLayout,
});

function ChatLayout() {
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
      <div className="flex flex-1 min-h-0 overflow-hidden md:rounded-2xl md:border md:shadow-sm">
        <aside
          className={`${
            isThread ? "hidden md:flex md:flex-none" : "flex flex-1"
          } w-full md:w-80 lg:w-96 shrink-0 flex-col border-r bg-card min-h-0`}
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
            <div className="flex-1 grid place-items-center p-8 text-center">
              <div className="max-w-xs space-y-3">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-primary/10 text-primary grid place-items-center">
                  <MessengerIcon className="h-7 w-7" />
                </div>
                <p className="text-sm font-medium">Select a conversation</p>
                <p className="text-xs text-muted-foreground">
                  Choose a chat from the list to start messaging. All messages are end-to-end encrypted.
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
  const navigate = useNavigate();
  const [convos, setConvos] = useState<Convo[]>([]);

  function goBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      window.history.back();
      return;
    }
    void navigate({ to: "/" });
  }

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .or(`user_a.eq.${user!.id},user_b.eq.${user!.id}`)
        .order("last_message_at", { ascending: false });
      const list = (data ?? []) as Convo[];
      const peerIds = list.map((c) => (c.user_a === user!.id ? c.user_b : c.user_a));
      if (peerIds.length) {
        const { data: profiles } = await supabase
          .from("profiles_public")
          .select("id, full_name, avatar_url, blood_group")
          .in("id", peerIds);
        const map = new Map((profiles ?? []).map((p) => [p.id, p] as const));
        setConvos(list.map((c) => ({ ...c, peer: map.get(c.user_a === user!.id ? c.user_b : c.user_a) as any })));
      } else {
        setConvos([]);
      }
    }
    load();
    const ch = supabase
      .channel("chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, load)
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user]);

  return (
    <>
      <header className="shrink-0 glass border-b safe-top">
        <div className="px-3 py-2.5 flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            className="h-10 w-10 rounded-xl grid place-items-center text-foreground hover:bg-muted transition shrink-0"
            aria-label={lang === "bn" ? "ফিরে যান" : "Go back"}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base font-bold leading-tight">{t("chat")}</h1>
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <ShieldCheck className="h-2.5 w-2.5" /> {t("e2eeOn")}
            </p>
          </div>
        </div>
      </header>
      <ul className="flex-1 overflow-y-auto divide-y min-h-0">
        {convos.length === 0 && (
          <li className="text-center text-sm text-muted-foreground py-16 px-4">{t("emptyChat")}</li>
        )}
        {convos.map((c) => {
          const peerId = c.peer?.id ?? "";
          const active = activePeerId === peerId;
          return (
            <li key={c.id}>
              <Link
                to="/chat/$peerId"
                params={{ peerId }}
                className={`flex items-center gap-3 px-4 py-3 transition ${
                  active ? "bg-primary/8 border-l-2 border-l-primary" : "hover:bg-muted"
                }`}
              >
                <Avatar name={c.peer?.full_name} src={c.peer?.avatar_url ?? undefined} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="font-semibold text-sm truncate">{c.peer?.full_name ?? "User"}</p>
                    {c.peer?.blood_group && (
                      <span className="text-[10px] font-semibold bg-primary/10 text-primary px-1.5 rounded">
                        {c.peer.blood_group}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" /> {t("encrypted")}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {timeAgo(c.last_message_at, lang)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
