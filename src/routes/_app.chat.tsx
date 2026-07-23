import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/routes/_app.index";
import { ShieldCheck } from "lucide-react";

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
  // If nested route active (e.g. /chat/:peerId), show only the nested view
  const isNested = /\/chat\/.+/.test(location.pathname);
  if (isNested) return <Outlet />;
  return <ChatList />;
}

function ChatList() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const [convos, setConvos] = useState<Convo[]>([]);

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
          .from("profiles")
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
    <div className="mx-auto max-w-md">
      <header className="sticky top-0 z-30 glass border-b safe-top">
        <div className="px-4 py-3">
          <h1 className="text-base font-bold">{t("chat")}</h1>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <ShieldCheck className="h-2.5 w-2.5" /> {t("e2eeOn")}
          </p>
        </div>
      </header>
      <ul className="divide-y">
        {convos.length === 0 && (
          <li className="text-center text-sm text-muted-foreground py-16">{t("emptyChat")}</li>
        )}
        {convos.map((c) => (
          <li key={c.id}>
            <Link
              to="/chat/$peerId"
              params={{ peerId: c.peer?.id ?? "" }}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted"
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
              <span className="text-[10px] text-muted-foreground">{timeAgo(c.last_message_at, lang)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
