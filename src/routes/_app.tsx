import { createFileRoute, Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { Home, HeartPulse, Map, MessageCircle, User } from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useI18n();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="min-h-dvh grid place-items-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const tabs = [
    { to: "/", label: t("feed"), icon: Home },
    { to: "/requests", label: t("requests"), icon: HeartPulse },
    { to: "/map", label: t("map"), icon: Map },
    { to: "/chat", label: t("chat"), icon: MessageCircle },
    { to: "/profile", label: t("profile"), icon: User },
  ] as const;

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <main className="flex-1 pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 inset-x-0 z-40 glass border-t safe-bottom">
        <div className="mx-auto max-w-md grid grid-cols-5 px-1 pt-1">
          {tabs.map((tab) => {
            const active =
              tab.to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(tab.to);
            const Icon = tab.icon;
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className="flex flex-col items-center gap-0.5 py-1.5 rounded-lg"
              >
                <div
                  className={`h-8 w-14 grid place-items-center rounded-full transition ${
                    active ? "bg-primary/10 text-primary" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 1.9} />
                </div>
                <span
                  className={`text-[10px] font-medium leading-none ${
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
  );
}
