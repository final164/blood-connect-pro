import { useI18n } from "@/lib/i18n";
import { useNotifications, type AppNotification } from "@/lib/notifications-context";
import { notificationCopy, resolveActorName } from "@/lib/notification-copy";
import { timeAgo } from "@/lib/format";
import { Avatar } from "@/components/Avatar";
import { Bell, ThumbsUp, MessageSquare, Share2, Megaphone, CheckCheck, Droplets, Stethoscope } from "lucide-react";
import { ChatHeaderButton } from "@/components/MessengerIcon";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({ meta: [{ title: "Notifications — BloodLink" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t, lang } = useI18n();
  const { items, loading, unread, markRead, markAllRead } = useNotifications();

  return (
    <div className="min-h-full">
      <AutoHideHeader className="z-20 border-b bg-background/90 backdrop-blur px-4 py-3 flex items-center justify-between gap-3 safe-top">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-xl bg-muted grid place-items-center">
            <Bell className="h-4 w-4 text-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold tracking-tight">{t("notifications")}</h1>
            <p className="text-[10px] text-muted-foreground">
              {unread > 0
                ? lang === "bn"
                  ? `${unread}টি নতুন`
                  : `${unread} new`
                : lang === "bn"
                  ? "সব পড়া হয়েছে"
                  : "You're all caught up"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {unread > 0 && (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              {t("markAllRead")}
            </button>
          )}
          <ChatHeaderButton />
        </div>
      </AutoHideHeader>

      <ul className="px-3 py-4 space-y-2 pb-8">
        {loading && items.length === 0 && (
          <li className="py-16 text-center text-sm text-muted-foreground">{t("loading")}</li>
        )}
        {!loading && items.length === 0 && (
          <li className="rounded-2xl border border-dashed bg-muted/20 py-16 px-6 text-center">
            <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground">{t("emptyNotifications")}</p>
          </li>
        )}
        {items.map((n) => (
          <li key={n.id}>
            <NotificationRow n={n} onOpen={() => void markRead(n.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function NotificationRow({ n, onOpen }: { n: AppNotification; onOpen: () => void }) {
  const { lang } = useI18n();
  const name = resolveActorName(n, lang);
  const copy = notificationCopy(n, lang);
  const Icon = iconFor(n);
  const kind = String(n.data?.kind || n.title || n.type || "");
  const showActor = !["new_request"].includes(kind) && n.type !== "request_match";

  const inner = (
    <div
      className={`flex gap-3 rounded-2xl border px-3 py-3 transition ${
        n.is_read ? "bg-card border-border/60" : "bg-card border-primary/25 shadow-sm"
      }`}
    >
      {showActor && (n.actor || n.data?.actor_name) ? (
        <Avatar name={name} src={n.actor?.avatar_url ?? undefined} size={40} />
      ) : (
        <div
          className={`h-10 w-10 rounded-xl grid place-items-center shrink-0 ${
            n.is_read ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm leading-snug ${n.is_read ? "text-foreground/85" : "font-medium text-foreground"}`}>
            {copy.title}
          </p>
          {!n.is_read && <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />}
        </div>
        {copy.body && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{copy.body}</p>}
        <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
          <Icon className="h-3 w-3 shrink-0" />
          <span>{timeAgo(n.created_at, lang)}</span>
        </div>
      </div>
    </div>
  );

  const requestId = n.request_id ?? (n.data?.request_id as string | undefined);
  const serialId = typeof n.data?.serial_id === "string" ? n.data.serial_id : null;
  const bookingId = typeof n.data?.booking_id === "string" ? n.data.booking_id : null;
  if (serialId) {
    return (
      <Link to="/care/serial/$id" params={{ id: serialId }} onClick={onOpen} className="block">
        {inner}
      </Link>
    );
  }
  if (bookingId) {
    return (
      <Link to="/care/lab-booking/$id" params={{ id: bookingId }} onClick={onOpen} className="block">
        {inner}
      </Link>
    );
  }
  if (requestId) {
    return (
      <Link to="/home" search={{ requestId }} onClick={onOpen} className="block">
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onOpen} className="w-full text-left">
      {inner}
    </button>
  );
}

function iconFor(n: AppNotification) {
  const kind = n.data?.kind || n.title || n.type;
  if (kind === "new_request" || n.type === "request_match") return Droplets;
  if (kind === "comment_like" || n.title === "comment_like") return ThumbsUp;
  if (kind === "reply" || n.title === "request_reply") return MessageSquare;
  if (["like", "request_like", "post_like"].includes(String(kind)) || n.type === "post_like") return ThumbsUp;
  if (
    ["comment", "request_comment", "post_comment"].includes(String(kind)) ||
    n.type === "post_comment"
  ) {
    return MessageSquare;
  }
  if (["share", "request_share"].includes(String(kind))) return Share2;
  if (String(kind).startsWith("care_")) return Stethoscope;
  return Megaphone;
}
