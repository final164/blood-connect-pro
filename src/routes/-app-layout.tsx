import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { NotificationsProvider } from "@/lib/notifications-context";
import { ChatUnreadProvider } from "@/lib/chat-unread-context";
import { ChatWarmup } from "@/components/chat/ChatWarmup";
import { enableDeviceNotifications, canUseDeviceNotifications } from "@/lib/device-push";
import { supabase } from "@/integrations/supabase/client";
import { getProfile } from "@/lib/api";
import { isProfileComplete } from "@/lib/onboarding";
import { isGuestBrowsePath } from "@/lib/auth-next";

function pathWithSearch(pathname: string, search: unknown) {
  if (!search || typeof search !== "object") return pathname;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(search as Record<string, unknown>)) {
    if (v == null || v === "") continue;
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${pathname}?${s}` : pathname;
}
import { UserMenuSidebar } from "@/components/menu/UserMenuNav";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import {
  DEFAULT_BOTTOM_NAV_SETTINGS,
  bottomNavColorStyle,
  fetchBottomNavSettings,
  type BottomNavItemId,
  type BottomNavSettings,
} from "@/lib/bottom-nav-settings";
import { Home, Users, WifiOff, Droplet, Plus, LayoutGrid, LogIn, Ambulance, Sparkles, Shield } from "lucide-react";
import { MessengerIcon } from "@/components/MessengerIcon";
import { ProfileHeaderButton } from "@/components/ProfileHeaderButton";
import { useChatUnread } from "@/lib/chat-unread-context";
import { prefetchChatList } from "@/lib/chat-store";
export function AppLayout() {
  const { loading, session, isAnonymous, isAdmin, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [profileGate, setProfileGate] = useState<"checking" | "incomplete" | "ok">("checking");
  const onOnboarding = location.pathname === "/onboarding";
  const guestBrowse = isGuestBrowsePath(
    location.pathname,
    location.search as Record<string, unknown>,
  );
  const isGuest = !session || isAnonymous;

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (isGuest && !guestBrowse) {
      const next = pathWithSearch(location.pathname, location.search);
      void navigate({ to: "/auth", search: { next } as never });
    }
  }, [loading, isGuest, guestBrowse, navigate, location.pathname, location.search]);

  useEffect(() => {
    if (!user || loading || isAnonymous) {
      setProfileGate("checking");
      return;
    }
    let cancelled = false;
    setProfileGate((prev) => (prev === "ok" ? "ok" : "checking"));
    getProfile(user.id)
      .then((profile) => {
        if (cancelled) return;
        const accountKind = (profile as { account_kind?: string } | null)?.account_kind;
        if (accountKind === "care_vendor") {
          setProfileGate("ok");
          return;
        }
        const complete = isProfileComplete(profile);
        setProfileGate(complete ? "ok" : "incomplete");
        if (!complete && !onOnboarding) {
          void navigate({ to: "/onboarding" });
        } else if (complete && onOnboarding) {
          void navigate({ to: "/home" });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProfileGate("incomplete");
          if (!onOnboarding) void navigate({ to: "/onboarding" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id, loading, isAnonymous, onOnboarding, navigate]);

  useEffect(() => {
    if (!user || !canUseDeviceNotifications()) return;
    // Defer so login navigation finishes; never block first paint.
    const t = window.setTimeout(() => {
      void supabase
        .from("user_settings")
        .select("notif_push")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.notif_push) void enableDeviceNotifications(user.id).catch(() => {});
        })
        .catch(() => {});
    }, 2500);
    return () => window.clearTimeout(t);
  }, [user?.id]);

  if (loading && !session) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (isGuest) {
    if (!guestBrowse) {
      return (
        <div className="min-h-dvh grid place-items-center bg-background">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      );
    }
    return (
      <NotificationsProvider>
        <ChatUnreadProvider>
          <GuestAppShell t={t} locationPath={location.pathname} online={online} />
        </ChatUnreadProvider>
      </NotificationsProvider>
    );
  }

  return (
    <NotificationsProvider>
      <ChatUnreadProvider>
        <ChatWarmup />
        <AppShell
          t={t}
          locationPath={location.pathname}
          isAdmin={isAdmin}
          online={online}
          onboarding={onOnboarding}
        />
      </ChatUnreadProvider>
    </NotificationsProvider>
  );
}

function GuestAppShell({
  t,
  locationPath,
  online,
}: {
  t: (k: string) => string;
  locationPath: string;
  online: boolean;
}) {
  const { lang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const next = pathWithSearch(locationPath, location.search);

  function requireLogin(path?: string) {
    void navigate({ to: "/auth", search: { next: path || next } as never });
  }

  return (
    <div
      className="min-h-dvh flex flex-col bg-background"
      style={{
        ...bottomNavColorStyle(DEFAULT_BOTTOM_NAV_SETTINGS),
        ["--app-bottom-nav-h" as string]: "calc(3.35rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <AutoHideHeader className="z-30 border-b bg-background/95 backdrop-blur safe-top">
        <div className="flex items-center gap-2 px-3 py-2 max-w-3xl mx-auto w-full">
          <Link to="/" className="h-9 w-9 rounded-xl grid place-items-center hover:bg-muted shrink-0">
            <Droplet className="h-5 w-5 text-primary" fill="currentColor" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate">{t("appName")}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {lang === "bn" ? "গেস্ট মোড — বুক/পোস্টে লগইন লাগবে" : "Guest — login to book or post"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => requireLogin()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-semibold"
          >
            <LogIn className="h-3.5 w-3.5" />
            {lang === "bn" ? "লগইন" : "Log in"}
          </button>
        </div>
        {!online && (
          <div className="px-3 pb-2">
            <p className="text-[11px] text-amber-700 dark:text-amber-300 flex items-center gap-1">
              <WifiOff className="h-3.5 w-3.5" />
              Offline
            </p>
          </div>
        )}
      </AutoHideHeader>
      <main className="flex-1 w-full max-w-3xl mx-auto pb-20">
        <Outlet />
      </main>
      <nav className="bn-bar fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur pb-[max(0.35rem,env(safe-area-inset-bottom))]">
        <div className="max-w-3xl mx-auto grid grid-cols-4 gap-1 px-2 pt-1">
          {(
            [
              { to: "/care", label: lang === "bn" ? "কেয়ার" : "Care", icon: LayoutGrid, match: (p: string) => p === "/care" || (p.startsWith("/care/") && !p.startsWith("/care/ai-tests")) },
              { to: "/ambulance", label: lang === "bn" ? "অ্যাম্বুলেন্স" : "Ambulance", icon: Ambulance, match: (p: string) => p.startsWith("/ambulance") },
              { to: "/care/ai-tests", label: lang === "bn" ? "AI" : "AI", icon: Sparkles, match: (p: string) => p.startsWith("/care/ai-tests") },
              { kind: "login" as const, label: lang === "bn" ? "লগইন" : "Log in" },
            ] as const
          ).map((tab) => {
            if ("kind" in tab && tab.kind === "login") {
              return (
                <button
                  key="login"
                  type="button"
                  onClick={() => requireLogin("/home")}
                  className="bn-tab flex flex-col items-center justify-center gap-0.5 min-h-[44px] pt-1 pb-0.5 text-muted-foreground"
                >
                  <LogIn className="h-5 w-5" />
                  <span className="bn-label text-[10px]">{tab.label}</span>
                </button>
              );
            }
            const Icon = tab.icon;
            const active = tab.match(locationPath);
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`bn-tab flex flex-col items-center justify-center gap-0.5 min-h-[44px] pt-1 pb-0.5 ${active ? "bn-tab--active text-primary" : "text-muted-foreground"}`}
              >
                <Icon className="h-5 w-5" strokeWidth={active ? 2.3 : 1.8} />
                <span className="bn-label text-[10px]">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function AppShell({
  t,
  locationPath,
  isAdmin,
  online,
  onboarding,
}: {
  t: (k: string) => string;
  locationPath: string;
  isAdmin: boolean;
  online: boolean;
  onboarding: boolean;
}) {
  const { unread: chatUnread } = useChatUnread();
  const { lang } = useI18n();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const isChatThread = /^\/chat\/[^/]+$/.test(locationPath);
  const isChatSection = locationPath.startsWith("/chat");
  const isCareVendorShell =
    locationPath.startsWith("/care/desk") ||
    locationPath.startsWith("/care/lab") ||
    locationPath.startsWith("/care/portal");
  const hideBottomNav = isChatThread || isCareVendorShell;
  const composeOpen =
    (locationPath === "/home" || locationPath === "/") &&
    !!(location.search as { compose?: boolean | string }).compose;
  const [navCfg, setNavCfg] = useState<BottomNavSettings>(DEFAULT_BOTTOM_NAV_SETTINGS);

  useEffect(() => {
    void fetchBottomNavSettings().then(setNavCfg);
  }, []);

  function openComposer() {
    if (composeOpen) {
      void navigate({
        to: "/home",
        search: (prev: Record<string, unknown>) => ({ ...prev, compose: undefined }),
      });
      return;
    }
    void navigate({
      to: "/home",
      search: (prev: Record<string, unknown>) => ({ ...prev, compose: true }),
    });
  }

  type NavTab =
    | { id: BottomNavItemId; kind: "link"; to: "/home"; label: string; icon: typeof Home; badge?: number }
    | { id: BottomNavItemId; kind: "link"; to: "/community"; label: string; icon: typeof Users; badge?: number }
    | {
        id: BottomNavItemId;
        kind: "link";
        to: "/chat";
        label: string;
        icon: "messenger";
        badge?: number;
      }
    | { id: BottomNavItemId; kind: "link"; to: "/care"; label: string; icon: typeof LayoutGrid; badge?: number }
    | { id: BottomNavItemId; kind: "compose"; label: string; icon: typeof Plus };

  const allTabs: NavTab[] = useMemo(() => {
    const label = (id: BottomNavItemId, fallback: string) => {
      const row = navCfg.items.find((i) => i.id === id);
      if (!row) return fallback;
      return lang === "bn" ? row.label_bn || fallback : row.label_en || fallback;
    };
    return [
      { id: "feed", kind: "link", to: "/home", label: label("feed", t("feed")), icon: Home },
      {
        id: "community",
        kind: "link",
        to: "/community",
        label: label("community", t("community")),
        icon: Users,
      },
      { id: "post", kind: "compose", label: label("post", t("createRequest")), icon: Plus },
      {
        id: "alert",
        kind: "link",
        to: "/chat",
        label: label("alert", t("chat")),
        icon: "messenger",
        badge: chatUnread,
      },
      {
        id: "more",
        kind: "link",
        to: "/care",
        label: label("more", t("more")),
        icon: LayoutGrid,
      },
    ];
  }, [lang, navCfg.items, t, chatUnread]);

  const enabledOrder = useMemo(() => {
    return [...navCfg.items]
      .filter((i) => i.enabled)
      .sort((a, b) => a.order - b.order)
      .map((i) => i.id);
  }, [navCfg.items]);

  const tabs = useMemo(() => {
    const byId = new Map(allTabs.map((tab) => [tab.id, tab]));
    const list = enabledOrder.map((id) => byId.get(id)).filter(Boolean) as NavTab[];
    return list.length ? list : allTabs;
  }, [allTabs, enabledOrder]);

  const gridColsClass =
    tabs.length <= 3
      ? "grid-cols-3"
      : tabs.length === 4
        ? "grid-cols-4"
        : "grid-cols-5";

  function warmChatList() {
    if (!user?.id) return;
    void prefetchChatList(queryClient, user.id, lang);
  }

  function renderTab(tab: NavTab, layout: "top" | "bottom") {
    if (tab.kind === "compose") {
      const Icon = tab.icon;
      if (layout === "top") {
        return (
          <button
            key={tab.id}
            type="button"
            onClick={openComposer}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
              composeOpen
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={composeOpen ? 2.4 : 1.9} />
            <span className="hidden lg:inline">{tab.label}</span>
          </button>
        );
      }
      /* Dark pro nav: center + with label under icon */
      return (
        <button
          key={tab.id}
          type="button"
          onClick={openComposer}
          aria-label={tab.label}
          className={`bn-tab flex flex-col items-center justify-center gap-0.5 min-h-[44px] pt-1 pb-0.5 transition-colors ${
            composeOpen ? "bn-tab--active" : ""
          }`}
        >
          <span
            className={`bn-compose h-7 w-7 rounded-full grid place-items-center transition shadow-sm ${
              composeOpen ? "bn-compose--open" : ""
            }`}
          >
            <Icon className="h-[16px] w-[16px]" strokeWidth={2.4} />
          </span>
          <span className="bn-label text-[10px] leading-none truncate max-w-[4.5rem] tracking-wide">
            {tab.label}
          </span>
        </button>
      );
    }

    const active =
      tab.to === "/home"
        ? (locationPath === "/home" || locationPath === "/") && !composeOpen
        : locationPath.startsWith(tab.to);
    const badge = tab.badge ?? 0;
    const iconEl =
      tab.icon === "messenger" ? (
        <MessengerIcon className={layout === "top" ? "h-4 w-4" : "h-[20px] w-[20px]"} />
      ) : (
        (() => {
          const Icon = tab.icon;
          return (
            <Icon
              className={layout === "top" ? "h-4 w-4" : "h-[20px] w-[20px]"}
              strokeWidth={active ? 2.35 : 1.8}
              fill={active && tab.to === "/home" ? "currentColor" : "none"}
            />
          );
        })()
      );

    if (layout === "top") {
      return (
        <Link
          key={tab.id}
          to={tab.to}
          onPointerEnter={tab.to === "/chat" ? warmChatList : undefined}
          onTouchStart={tab.to === "/chat" ? warmChatList : undefined}
          className={`relative inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
            active
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          <span className="relative">
            {iconEl}
            {badge > 0 && (
              <span
                className={`absolute -top-1.5 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[9px] font-bold grid place-items-center ring-2 ${
                  active
                    ? "bg-primary-foreground text-primary ring-primary"
                    : "bg-primary text-primary-foreground ring-card"
                }`}
              >
                {badge > 9 ? "9+" : badge}
              </span>
            )}
          </span>
          <span className="hidden lg:inline">{tab.label}</span>
        </Link>
      );
    }

    return (
      <Link
        key={tab.id}
        to={tab.to}
        onPointerEnter={tab.to === "/chat" ? warmChatList : undefined}
        onTouchStart={tab.to === "/chat" ? warmChatList : undefined}
        className={`bn-tab flex flex-col items-center justify-center gap-0.5 min-h-[44px] pt-1 pb-0.5 transition-colors ${
          active ? "bn-tab--active" : ""
        }`}
      >
        <span className="relative grid place-items-center h-5 w-5">
          {iconEl}
          {badge > 0 && (
            <span
              className="absolute -top-1 -right-2 min-w-[14px] h-[14px] px-0.5 rounded-full bg-primary text-primary-foreground text-[8px] font-bold grid place-items-center ring-2"
              style={{ boxShadow: `0 0 0 2px var(--bn-bar-bg, #14181f)` }}
              aria-label={`${badge} unread`}
            >
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </span>
        <span className="bn-label text-[10px] leading-none truncate max-w-[4.5rem] tracking-wide">
          {tab.label}
        </span>
      </Link>
    );
  }

  if (onboarding) {
    return (
      <div className="min-h-dvh flex bg-background">
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex bg-background">
      <UserMenuSidebar />

      <div
        className="flex-1 flex flex-col min-w-0 min-h-dvh"
        style={
          hideBottomNav
            ? undefined
            : ({
                ["--app-bottom-nav-h"]: "calc(3.15rem + env(safe-area-inset-bottom, 0px))",
              } as CSSProperties)
        }
      >
        {/* Desktop / large screen: top app nav (was bottom on mobile) */}
        <AutoHideHeader
          className="hidden z-40 md:flex items-center gap-3 border-b bg-card/95 backdrop-blur-xl px-4 lg:px-6 py-2.5"
        >
          <div className="flex items-center gap-2.5 shrink-0 mr-1">
            <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-md shadow-primary/25">
              <Droplet className="h-4 w-4" fill="currentColor" />
            </div>
            <div className="min-w-0 hidden xl:block">
              <p className="font-bold text-sm leading-tight truncate">{t("appName")}</p>
              <p className="text-[10px] text-muted-foreground truncate">{t("tagline")}</p>
            </div>
          </div>

          <nav className="flex-1 flex items-center justify-center gap-1 min-w-0">
            {tabs.map((tab) => renderTab(tab, "top"))}
          </nav>

          {isAdmin && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground shrink-0"
            >
              <Shield className="h-4 w-4" />
              <span className="hidden lg:inline">{t("adminPanel")}</span>
            </Link>
          )}
          <ProfileHeaderButton className="shrink-0" />
        </AutoHideHeader>

        {!online && (
          <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 text-xs font-medium px-3 py-1.5 flex items-center justify-center gap-1.5 safe-top">
            <WifiOff className="h-3.5 w-3.5" />
            {t("offlineMode")}
          </div>
        )}

      <div
        className={`flex-1 flex flex-col min-h-0 min-w-0 ${
          hideBottomNav ? "pb-0" : "pb-bottom-nav md:pb-0"
        }`}
      >
          {isChatSection || isCareVendorShell ? (
            <div className="flex-1 flex flex-col min-h-0 app-shell-wide md:px-4 md:py-4 lg:px-6">
              <Outlet />
            </div>
          ) : (
            <div className="app-shell">
              <Outlet />
            </div>
          )}
        </div>

        {/* Mobile: dark professional bottom nav (colors from admin) */}
        {!hideBottomNav && (
          <nav
            className="md:hidden fixed bottom-0 inset-x-0 z-40 bottom-nav-dark safe-bottom-nav"
            style={bottomNavColorStyle(navCfg.colors ?? DEFAULT_BOTTOM_NAV_SETTINGS.colors)}
          >
            <div className={`app-shell grid ${gridColsClass} px-1`}>
              {tabs.map((tab) => renderTab(tab, "bottom"))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
