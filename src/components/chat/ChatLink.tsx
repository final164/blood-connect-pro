import { Link, type LinkProps } from "@tanstack/react-router";
import type { MouseEventHandler, PointerEventHandler, TouchEventHandler } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { prefetchChatThread } from "@/lib/chat-store";

type Props = Omit<LinkProps, "to" | "params" | "search"> & {
  peerId: string;
  fromRequestId?: string;
  children?: React.ReactNode;
  className?: string;
  title?: string;
  "aria-label"?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  onPointerEnter?: PointerEventHandler<HTMLAnchorElement>;
  onTouchStart?: TouchEventHandler<HTMLAnchorElement>;
};

/** Chat deep-link with hover/touch prefetch — opens without a loading flash. */
export function ChatLink({
  peerId,
  fromRequestId,
  onPointerEnter,
  onTouchStart,
  children,
  ...rest
}: Props) {
  const { user } = useAuth();
  const { lang } = useI18n();
  const queryClient = useQueryClient();

  const warm = () => {
    if (!user?.id) return;
    void prefetchChatThread(queryClient, user.id, peerId, lang);
  };

  return (
    <Link
      {...rest}
      to="/chat/$peerId"
      params={{ peerId }}
      search={fromRequestId ? { fromRequestId } : {}}
      onPointerEnter={(e) => {
        warm();
        onPointerEnter?.(e);
      }}
      onTouchStart={(e) => {
        warm();
        onTouchStart?.(e);
      }}
    >
      {children}
    </Link>
  );
}
