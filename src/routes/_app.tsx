import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { NotificationsProvider, useNotifications } from "@/lib/notifications-context";
import { enableDeviceNotifications, canUseDeviceNotifications } from "@/lib/device-push";
import { supabase } from "@/integrations/supabase/client";
import { UserMenuSidebar } from "@/components/menu/UserMenuNav";
import { Home, Users, User, WifiOff, Droplet, Shield, Bell, Plus } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, session, isAnonymous, isAdmin, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

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

  if (loading || !session || isAnonymous) {
    return (
      <div className="min-h-dvh grid place-items-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <NotificationsProvider>
      <AppShell
        t={t}
        locationPath={location.pathname}
        isAdmin={isAdmin}
        online={online}
      />
    </NotificationsProvider>
  );
}

function AppShell({
  t,
  locationPath,
  isAdmin,
  online,
}: {
  t: (k: string) => string;
  locationPath: string;
  isAdmin: boolean;
  online: boolean;
}) {
  const { unread } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const isChatThread = /^\/chat\/[^/]+$/.test(locationPath);
  const isChatSection = locationPath.startsWith("/chat");
  const composeOpen =
    locationPath === "/" &&
    !!(location.search as { compose?: boolean | string }).compose;

  function openComposer() {
    if (composeOpen) {
      void navigate({
        to: "/",
        search: (prev) => ({ ...prev, compose: undefined }),
      });
      return;
    }
    void navigate({
      to: "/",
      search: (prev) => ({ ...prev, compose: true }),
    });
  }

  type NavTab =
    | { id: string; kind: "link"; to: "/"; label: string; icon: typeof Home; badge?: number }
    | { id: string; kind: "link"; to: "/community"; label: string; icon: typeof Users; badge?: number }
    | { id: string; kind: "link"; to: "/notifications"; label: string; icon: typeof Bell; badge?: number }
    | { id: string; kind: "link"; to: "/profile"; label: string; icon: typeof User; badge?: number }
    | { id: string; kind: "compose"; label: string; icon: typeof Plus };

  const tabs: NavTab[] = [
    { id: "feed", kind: "link", to: "/", label: t("feed"), icon: Home },
    { id: "community", kind: "link", to: "/community", label: t("community"), icon: Users },
    { id: "compose", kind: "compose", label: t("createRequest"), icon: Plus },
    {
      id: "notifications",
      kind: "link",
      to: "/notifications",
      label: t("notifications"),
      icon: Bell,
      badge: unread,
    },
    { id: "profile", kind: "link", to: "/profile", label: t("profile"), icon: User },
  ];

  function renderTab(tab: NavTab, layout: "top" | "bottom") {
    const Icon = tab.icon;
    if (tab.kind === "compose") {
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
      tab.to === "/"
        ? locationPath === "/" && !composeOpen
        : locationPath.startsWith(tab.to);
    const badge = tab.badge ?? 0;

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
            <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 1.9} />
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
          <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2.4 : 1.9} />
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

  return (
    <div className="min-h-dvh flex bg-background">
      <UserMenuSidebar />

      <div className="flex-1 flex flex-col min-w-0 min-h-dvh">
        {/* Desktop / large screen: top app nav (was bottom on mobile) */}
        <header className="hidden md:sticky md:top-0 md:z-40 md:flex items-center gap-3 border-b bg-card/95 backdrop-blur-xl px-4 lg:px-6 py-2.5">
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
        </header>

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
            <div className="flex-1 flex flex-col min-h-0 md:px-4 md:py-4 lg:px-6">
              <Outlet />
            </div>
          ) : (
            <div className="w-full max-w-lg mx-auto md:max-w-3xl lg:max-w-5xl xl:max-w-6xl md:mx-auto md:px-6 md:py-4 lg:py-6">
              <Outlet />
            </div>
          )}
        </main>

        {/* Mobile: bottom nav */}
        {!isChatThread && (
          <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur-xl safe-bottom">
            <div className="mx-auto max-w-lg grid grid-cols-5 px-0.5 pt-1">
              {tabs.map((tab) => renderTab(tab, "bottom"))}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
