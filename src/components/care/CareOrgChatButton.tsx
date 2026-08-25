import { useEffect, useState, type MouseEvent, type PointerEvent } from "react";
import { Loader2, Phone } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { authWithNext } from "@/lib/auth-next";
import { resolveCareOrgChatPeer, isCareOrgChatEnabled } from "@/lib/care-chat";
import { ChatLink } from "@/components/chat/ChatLink";
import { MessengerIcon } from "@/components/MessengerIcon";
import { cn } from "@/lib/utils";

type Variant = "icon" | "button";

/** Patient → hospital/clinic chat using existing 1:1 messaging (staff owner/reception peer). */
export function CareOrgChatButton({
  orgId,
  phone,
  orgLabel,
  variant = "button",
  className,
  stopPropagation,
}: {
  orgId: string | null | undefined;
  phone?: string | null;
  orgLabel?: string | null;
  variant?: Variant;
  className?: string;
  /** Use inside nested links (dashboard cards) */
  stopPropagation?: boolean;
}) {
  const { user, isAnonymous } = useAuth();
  const { lang } = useI18n();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!orgId);

  useEffect(() => {
    if (!orgId) {
      setPeerId(null);
      setEnabled(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setEnabled(null);
    void (async () => {
      const on = await isCareOrgChatEnabled();
      if (cancelled) return;
      setEnabled(on);
      if (!on) {
        setPeerId(null);
        setLoading(false);
        return;
      }
      const id = await resolveCareOrgChatPeer(orgId);
      if (cancelled) return;
      setPeerId(id);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  if (!orgId || enabled === false) return null;

  const label = lang === "bn" ? "চ্যাট" : "Chat";
  const title = orgLabel
    ? lang === "bn"
      ? `${orgLabel}-এর সাথে চ্যাট`
      : `Chat with ${orgLabel}`
    : lang === "bn"
      ? "হাসপাতাল / ক্লিনিকের সাথে চ্যাট"
      : "Chat with hospital / clinic";

  const iconClass =
    variant === "icon"
      ? cn(
          "h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-xl border text-primary hover:bg-primary/10 transition",
          className,
        )
      : cn(
          "inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs font-bold text-primary hover:bg-primary hover:text-primary-foreground transition",
          className,
        );

  const stop = stopPropagation
    ? {
        onClick: (e: MouseEvent) => e.stopPropagation(),
        onPointerDown: (e: PointerEvent) => e.stopPropagation(),
      }
    : {};

  if (!user || isAnonymous) {
    return (
      <a
        href={authWithNext(
          typeof window !== "undefined" ? window.location.pathname + window.location.search : "/care",
        )}
        className={iconClass}
        title={title}
        aria-label={title}
        {...stop}
      >
        {variant === "icon" ? (
          <MessengerIcon className="h-[18px] w-[18px]" />
        ) : (
          <>
            <MessengerIcon className="h-3.5 w-3.5" />
            {label}
          </>
        )}
      </a>
    );
  }

  if (loading) {
    return (
      <span className={cn(iconClass, "opacity-60 pointer-events-none")} aria-hidden>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </span>
    );
  }

  if (peerId && peerId !== user.id) {
    return (
      <ChatLink
        peerId={peerId}
        careOrgId={orgId}
        className={iconClass}
        title={title}
        aria-label={title}
        {...stop}
      >
        {variant === "icon" ? (
          <MessengerIcon className="h-[18px] w-[18px]" />
        ) : (
          <>
            <MessengerIcon className="h-3.5 w-3.5" />
            {label}
          </>
        )}
      </ChatLink>
    );
  }

  const tel = phone?.replace(/\s/g, "");
  if (tel) {
    return (
      <a href={`tel:${tel}`} className={iconClass} title={title} aria-label={title} {...stop}>
        {variant === "icon" ? (
          <Phone className="h-4 w-4" />
        ) : (
          <>
            <Phone className="h-3.5 w-3.5" />
            {lang === "bn" ? "কল" : "Call"}
          </>
        )}
      </a>
    );
  }

  return null;
}
