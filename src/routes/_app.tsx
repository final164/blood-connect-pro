import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { NotificationsProvider, useNotifications } from "@/lib/notifications-context";
import { enableDeviceNotifications, canUseDeviceNotifications } from "@/lib/device-push";
import { supabase } from "@/integrations/supabase/client";
import { Home, Users, MessageCircle, User, WifiOff, Droplet, Shield, LogOut, Bell } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { loading, session, isAnonymous, isAdmin, user, signOut } = useAuth();
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
        userEmail={user?.email}
        online={online}
        onSignOut={() => signOut()}
      />
    </NotificationsProvider>
  );
}

function AppShell({
  t,
  locationPath,
  isAdmin,
  userEmail,
  online,
  onSignOut,
}: {
  t: (k: string) => string;
  locationPath: string;
  isAdmin: boolean;
  userEmail?: string | null;
  online: boolean;
  onSignOut: () => void;
}) {
  const { unread } = useNotifications();

  const tabs = [
    { to: "/", label: t("feed"), icon: Home },
    { to: "/community", label: t("community"), icon: Users },
    { to: "/chat", label: t("chat"), icon: MessageCircle },
    { to: "/notifications", label: t("notifications"), icon: Bell, badge: unread },
    { to: "/profile", label: t("profile"), icon: User },
  ] as const;

  return (
    <div className="min-h-dvh flex bg-background">
      <aside className="hidden md:flex md:w-60 lg:w-64 shrink-0 flex-col border-r bg-card sticky top-0 h-dvh">
        <div className="px-5 py-5 border-b flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow-md shadow-primary/25">
            <Droplet className="h-4 w-4" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{t("appName")}</p>
            <p className="text-[10px] text-muted-foreground truncate">{t("tagline")}</p>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {tabs.map((tab) => {
            const active =
              tab.to === "/" ? locationPath === "/" : locationPath.startsWith(tab.to);
            const Icon = tab.icon;
            const badge = "badge" in tab ? tab.badge : 0;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="relative">
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.4 : 1.9} />
                  {!!badge && badge > 0 && (
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
                <span className="flex-1 truncate">{tab.label}</span>
                {!!badge && badge > 0 && !active && (
                  <span className="text-[10px] font-semibold text-primary">{badge}</span>
                )}
              </Link>
            );
          })}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground mt-2 border-t pt-3"
            >
              <Shield className="h-4 w-4" />
              {t("adminPanel")}
            </Link>
          )}
        </nav>
        <div className="p-3 border-t space-y-2">
          <p className="text-[11px] text-muted-foreground truncate px-2">{userEmail}</p>
          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            {t("logout")}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-dvh">
        {!online && (
          <div className="sticky top-0 z-50 bg-amber-500 text-amber-950 text-xs font-medium px-3 py-1.5 flex items-center justify-center gap-1.5 safe-top">
            <WifiOff className="h-3.5 w-3.5" />
            {t("offlineMode")}
          </div>
        )}
        <main className="flex-1 pb-20 md:pb-0">
          <div className="md:max-w-3xl lg:max-w-4xl md:mx-auto md:px-6 md:py-4">
            <Outlet />
          </div>
        </main>

        <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-card/95 backdrop-blur-xl safe-bottom">
          <div className="mx-auto max-w-lg grid grid-cols-5 px-0.5 pt-1">
            {tabs.map((tab) => {
              const active =
                tab.to === "/" ? locationPath === "/" : locationPath.startsWith(tab.to);
              const Icon = tab.icon;
              const badge = "badge" in tab ? tab.badge : 0;
              return (
                <Link key={tab.to} to={tab.to} className="flex flex-col items-center gap-0.5 py-1.5">
                  <div
                    className={`relative h-9 w-11 grid place-items-center rounded-2xl transition ${
                      active ? "bg-primary text-primary-foreground shadow-md shadow-primary/30" : "text-muted-foreground"
                    }`}
                  >
                    <Icon className="h-[17px] w-[17px]" strokeWidth={active ? 2.4 : 1.9} />
                    {!!badge && badge > 0 && (
                      <span
                        className={`absolute top-0.5 right-0.5 min-w-[14px] h-[14px] px-0.5 rounded-full text-[8px] font-bold grid place-items-center ${
                          active
                            ? "bg-primary-foreground text-primary"
                            : "bg-primary text-primary-foreground"
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
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
