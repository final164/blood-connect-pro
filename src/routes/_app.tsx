import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { NotificationsProvider } from "@/lib/notifications-context";
import { ChatUnreadProvider } from "@/lib/chat-unread-context";
import { enableDeviceNotifications, canUseDeviceNotifications } from "@/lib/device-push";
import { supabase } from "@/integrations/supabase/client";
import { getProfile } from "@/lib/api";
import { isProfileComplete } from "@/lib/onboarding";
import { UserMenuSidebar } from "@/components/menu/UserMenuNav";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import {
  DEFAULT_BOTTOM_NAV_SETTINGS,
  fetchBottomNavSettings,
  type BottomNavItemId,
  type BottomNavSettings,
} from "@/lib/bottom-nav-settings";
import { Home, Users, User, WifiOff, Droplet, Shield, Plus } from "lucide-react";
import { MessengerIcon } from "@/components/MessengerIcon";
import { useChatUnread } from "@/lib/chat-unread-context";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, session, isAnonymous, isAdmin, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  const [profileGate, setProfileGate] = useState<"checking" | "incomplete" | "ok">("checking");
  const onOnboarding = location.pathname === "/onboarding";

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
    if (!loading && (!session || isAnonymous)) {
      navigate({ to: "/auth" });
    }
  }, [loading, session, isAnonymous, navigate]);

  useEffect(() => {
    if (!user || loading || isAnonymous) {
      setProfileGate("checking");
      return;
    }
    let cancelled = false;
    // Skip full-screen gate spinner when this user already passed the check.
    setProfileGate((prev) => (prev === "ok" ? "ok" : "checking"));
    getProfile(user.id)
      .then((profile) => {
        if (cancelled) return;
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
    supabase
      .from("user_settings")
      .select("notif_push")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.notif_push) void enableDeviceNotifications(user.id);
      });
  }, [user?.id]);

  if (loading && !session) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!session || isAnonymous) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (profileGate === "checking" || (profileGate === "incomplete" && !onOnboarding)) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <NotificationsProvider>
      <ChatUnreadProvider>
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
  const navigate = useNavigate();
  const location = useLocation();
  const isChatThread = /^\/chat\/[^/]+$/.test(locationPath);
  const isChatSection = locationPath.startsWith("/chat");
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
    | { id: BottomNavItemId; kind: "link"; to: "/profile"; label: string; icon: typeof User; badge?: number }
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
        id: "profile",
        kind: "link",
        to: "/profile",
        label: label("profile", t("profile")),
        icon: User,
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
      return (
        <button key={tab.id} type="button" onClick={openComposer} className="flex flex-col items-center gap-0.5 py-1.5">
          <div
            className={`relative h-9 w-11 grid place-items-center rounded-2xl transition ${
              composeOpen
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                : "bg-primary text-primary-foreground shadow-md shadow-primary/25"
            }`}
          >
            <Icon className="h-[17px] w-[17px]" strokeWidth={2.4} />
          </div>
          <span className="text-[9px] font-medium leading-none truncate max-w-[4.2rem] text-primary">
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
        <MessengerIcon className={layout === "top" ? "h-4 w-4" : "h-[17px] w-[17px]"} />
      ) : (
        (() => {
          const Icon = tab.icon;
          return (
            <Icon
              className={layout === "top" ? "h-4 w-4" : "h-[17px] w-[17px]"}
              strokeWidth={active ? 2.4 : 1.9}
            />
          );
        })()
      );

    if (layout === "top") {
      return (
        <Link
          key={tab.id}
          to={tab.to}
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
      <Link key={tab.id} to={tab.to} className="flex flex-col items-center gap-0.5 py-1.5">
        <div
          className={`relative h-9 w-11 grid place-items-center rounded-2xl transition ${
            active ? "bg-primary text-primary-foreground shadow-md shadow-primary/30" : "text-muted-foreground"
          }`}
        >
          {iconEl}
          {badge > 0 && (
            <span
              className={`absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold grid place-items-center ${
                active ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground"
              }`}
            >
              {badge > 9 ? "9+" : badge}
            </span>
          )}
        </div>
        <span
          className={`text-[9px] font-medium leading-none truncate max-w-[4.2rem] ${
            active ? "text-primary" : "text-muted-foreground"
          }`}
        >
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

      <div className="flex-1 flex flex-col min-w-0 min-h-dvh">
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
        </AutoHideHeader>

        {!online && (
          <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 text-xs font-medium px-3 py-1.5 flex items-center justify-center gap-1.5 safe-top">
            <WifiOff className="h-3.5 w-3.5" />
            {t("offlineMode")}
          </div>
        )}

        <main
          className={`flex-1 flex flex-col min-h-0 min-w-0 ${
            isChatThread ? "pb-0" : "pb-bottom-nav md:pb-0"
          }`}
        >
          {isChatSection ? (
            <div className="flex-1 flex flex-col min-h-0 app-shell-wide md:px-4 md:py-4 lg:px-6">
              <Outlet />
            </div>
          ) : (
            <div className="app-shell">
              <Outlet />
            </div>
          )}
        </main>

        {/* Mobile: bottom nav */}
        {!isChatThread && (
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur-xl safe-bottom">
            <div className={`app-shell grid ${gridColsClass} px-0.5 pt-1`}>
              {tabs.map((tab) => renderTab(tab, "bottom"))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
