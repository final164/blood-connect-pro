import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { useChatUnreadOptional } from "@/lib/chat-unread-context";
import { useNotifications } from "@/lib/notifications-context";

/** Instagram / Messenger-style bubble + lightning */
export function MessengerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden focusable="false">
      <path
        d="M12 2.25C6.62 2.25 2.25 6.3 2.25 11.3c0 2.86 1.4 5.4 3.6 7.08v3.12l3.42-1.88c.9.25 1.85.38 2.83.38 5.38 0 9.75-4.05 9.75-9.05S17.38 2.25 12 2.25z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M7.15 13.55 11.05 9.4l2.25 2.25 3.55-3.05-3.9 4.15-2.25-2.25-3.55 3.05z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Header chat control — outline Messenger icon + optional red unread badge */
export function ChatHeaderButton({
  badge,
  className = "",
  size = "md",
}: {
  /** Override unread count; otherwise uses live chat unread context. */
  badge?: number;
  className?: string;
  size?: "md" | "lg";
}) {
  const { t } = useI18n();
  const chatUnread = useChatUnreadOptional();
  const count = badge ?? chatUnread?.unread ?? 0;
  const showBadge = count > 0;
  const tap = size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const icon = size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]";

  return (
    <Link
      to="/chat"
      title={t("chat")}
      aria-label={showBadge ? `${t("chat")} (${count})` : t("chat")}
      className={`relative ${tap} rounded-xl text-foreground hover:bg-muted grid place-items-center transition ${className}`}
    >
      <MessengerIcon className={icon} />
      {showBadge && (
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-[#FF3040] text-white text-[9px] font-bold leading-none grid place-items-center ring-2 ring-background">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}

/** Header alerts — Bell + unread badge (header slot formerly used by chat). */
export function AlertsHeaderButton({
  badge,
  className = "",
  size = "md",
}: {
  badge?: number;
  className?: string;
  size?: "md" | "lg";
}) {
  const { t } = useI18n();
  const { unread } = useNotifications();
  const count = badge ?? unread;
  const showBadge = count > 0;
  const tap = size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const icon = size === "lg" ? "h-5 w-5" : "h-[18px] w-[18px]";

  return (
    <Link
      to="/notifications"
      title={t("notifications")}
      aria-label={showBadge ? `${t("notifications")} (${count})` : t("notifications")}
      className={`relative ${tap} rounded-xl text-foreground hover:bg-muted grid place-items-center transition ${className}`}
    >
      <Bell className={icon} strokeWidth={1.9} />
      {showBadge && (
        <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-0.5 rounded-full bg-[#FF3040] text-white text-[9px] font-bold leading-none grid place-items-center ring-2 ring-background">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
