import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

export type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  request_id: string | null;
  title: string;
  body: string | null;
  is_read: boolean;
  read_at?: string | null;
  data?: { actor_id?: string; request_id?: string; kind?: string } | null;
  created_at: string;
  actor?: { full_name: string | null; avatar_url: string | null } | null;
};

type Ctx = {
  items: AppNotification[];
  unread: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
};

const NotifContext = createContext<Ctx | null>(null);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) {
        setItems([]);
        return;
      }
      const list = (data ?? []).map((row: any) => {
        const n = row as AppNotification;
        const fromData = (n.data?.actor_id as string | undefined) ?? null;
        n.actor_id = n.actor_id ?? fromData;
        n.request_id = n.request_id ?? (n.data?.request_id as string | undefined) ?? null;
        // Prefer is_read; fall back to read_at from original schema
        if (n.is_read == null) n.is_read = !!n.read_at;
        return n;
      });
      const actorIds = [...new Set(list.map((n) => n.actor_id).filter(Boolean))] as string[];
      if (actorIds.length) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", actorIds);
        const map = new Map((profiles ?? []).map((p) => [p.id, p]));
        for (const n of list) {
          n.actor = n.actor_id ? map.get(n.actor_id) ?? null : null;
        }
      }
      setItems(list);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
    if (!user) return;
    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh]);

  const markRead = async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: n.read_at ?? new Date().toISOString() } : n)));
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", id);
  };

  const markAllRead = async () => {
    if (!user) return;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true, read_at: n.read_at ?? now })));
    await supabase
      .from("notifications")
      .update({ is_read: true, read_at: now })
      .eq("user_id", user.id)
      .eq("is_read", false);
  };

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <NotifContext.Provider value={{ items, unread, loading, refresh, markRead, markAllRead }}>
      {children}
    </NotifContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotifContext);
  if (!ctx) throw new Error("useNotifications outside provider");
  return ctx;
}
