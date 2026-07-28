import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import {
  fetchNotificationSettings,
  notificationPostUrl,
  purgeExpiredNotificationsForUser,
} from "@/lib/notification-settings";
import { showDeviceNotification } from "@/lib/device-push";
import { hasWebPushConfigured } from "@/lib/push-config";

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
  data?: { actor_id?: string; request_id?: string; kind?: string; blood_group?: string } | null;
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

function notifDisplay(n: AppNotification, lang: "bn" | "en") {
  const kind = n.data?.kind || n.title || n.type;
  const name = n.actor?.full_name || (lang === "bn" ? "কেউ" : "Someone");
  if (kind === "new_request" || n.type === "request_match") {
    return {
      title: lang === "bn" ? "নতুন রক্তের রিকোয়েস্ট" : "New blood request",
      body: n.body || n.title,
    };
  }
  if (["like", "request_like", "post_like"].includes(kind) || n.title === "request_like") {
    return {
      title: lang === "bn" ? "নতুন লাইক" : "New like",
      body: lang === "bn" ? `${name} আপনার পোস্টে লাইক দিয়েছে` : `${name} liked your post`,
    };
  }
  if (["comment", "request_comment", "post_comment"].includes(kind) || n.title === "request_comment") {
    return {
      title: lang === "bn" ? "নতুন কমেন্ট" : "New comment",
      body: n.body || (lang === "bn" ? `${name} কমেন্ট করেছে` : `${name} commented`),
    };
  }
  if (["share", "request_share"].includes(kind) || n.title === "request_share") {
    return {
      title: lang === "bn" ? "শেয়ার" : "Shared",
      body: lang === "bn" ? `${name} আপনার পোস্ট শেয়ার করেছে` : `${name} shared your post`,
    };
  }
  return { title: n.title || "BloodLink", body: n.body || "" };
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const seenIds = useRef(new Set<string>());

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const settings = await fetchNotificationSettings();
      await purgeExpiredNotificationsForUser(user.id, settings.retention_days);

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

  const pushForNotification = useCallback(async (n: AppNotification) => {
    // Server Web Push handles delivery when app is closed; skip duplicate OS alerts
    if (hasWebPushConfigured()) return;

    const settings = await fetchNotificationSettings();
    if (!settings.enable_push) return;

    const kind = n.data?.kind || n.title || n.type;
    const isNewRequest = kind === "new_request" || n.type === "request_match";
    if (isNewRequest && !settings.push_new_request) return;
    if (!isNewRequest && !settings.push_interactions) return;

    const { data: us } = await supabase
      .from("user_settings")
      .select("notif_push")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (us && us.notif_push === false) return;

    const copy = notifDisplay(n, lang);
    await showDeviceNotification({
      title: copy.title,
      body: copy.body,
      url: notificationPostUrl(n.request_id),
      tag: n.id,
    });
  }, [user, lang]);

  useEffect(() => {
    void refresh();
    if (!user) return;

    const ch = supabase
      .channel(`notif-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        async (payload) => {
          const n = payload.new as AppNotification;
          if (!seenIds.current.has(n.id)) {
            seenIds.current.add(n.id);
            await pushForNotification(n);
          }
          void refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, refresh, pushForNotification]);

  const markRead = async (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: n.read_at ?? new Date().toISOString() } : n)),
    );
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
