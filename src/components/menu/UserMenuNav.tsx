import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { Moon, Sun } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_USER_MENU_SETTINGS,
  fetchUserMenuSettings,
  menuItemHref,
  type UserMenuItem,
  type UserMenuSettings,
} from "@/lib/user-menu-settings";

function ThemeLangControls() {
  const { lang, setLang, t } = useI18n();
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleDark() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => setLang(lang === "bn" ? "en" : "bn")}
        className="flex items-center justify-center gap-2 rounded-xl border bg-card px-2 py-2.5 text-xs font-semibold hover:bg-muted/60 transition"
        title={lang === "bn" ? "English" : "বাংলা"}
      >
        <span className="text-[11px] font-bold tracking-tight text-primary">
          {lang === "bn" ? "EN" : "বাং"}
        </span>
        <span className="truncate text-muted-foreground">
          {lang === "bn" ? "English" : "বাংলা"}
        </span>
      </button>
      <button
        type="button"
        onClick={toggleDark}
        className="flex items-center justify-center gap-2 rounded-xl border bg-card px-2 py-2.5 text-xs font-semibold hover:bg-muted/60 transition"
        title={dark ? t("darkMode") : "Light"}
      >
        {dark ? <Sun className="h-4 w-4 text-primary shrink-0" /> : <Moon className="h-4 w-4 text-primary shrink-0" />}
        <span className="truncate text-muted-foreground">
          {dark ? (lang === "bn" ? "লাইট" : "Light") : t("darkMode")}
        </span>
      </button>
    </div>
  );
}

function MenuIcon({ name, className }: { name: string; className?: string }) {
  const Comp = (Icons as Record<string, unknown>)[name] as
    | React.ComponentType<{ className?: string }>
    | undefined;
  if (!Comp) return <Icons.Circle className={className} />;
  return <Comp className={className} />;
}

function navigateToMenu(href: string, navigate: ReturnType<typeof useNavigate>) {
  if (href === "/profile") return void navigate({ to: "/profile" });
  if (href === "/settings") return void navigate({ to: "/settings" });
  const view = href.replace("/me/", "");
  void navigate({ to: "/me/$view", params: { view } });
}

function itemActive(item: UserMenuItem, pathname: string): boolean {
  const href = menuItemHref(item.id);
  if (!href) return false;
  if (href === "/profile") return pathname === "/profile";
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function UserMenuNav({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const { user, signOut } = useAuth();
  const { lang } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const [settings, setSettings] = useState<UserMenuSettings>(DEFAULT_USER_MENU_SETTINGS);
  const [profile, setProfile] = useState<{
    full_name: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    fetchUserMenuSettings().then(setSettings);
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [user?.id]);

  const enabled = useMemo(
    () => settings.items.filter((i) => i.enabled).sort((a, b) => a.order - b.order),
    [settings.items],
  );

  const primary =
    settings.design.show_see_more && !expanded ? enabled.slice(0, 6) : enabled;

  async function onItem(item: UserMenuItem) {
    if (item.id === "logout") {
      onNavigate?.();
      await signOut();
      return;
    }
    const href = menuItemHref(item.id);
    if (!href) return;
    onNavigate?.();
    navigateToMenu(href, navigate);
  }

  return (
    <div className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
      {settings.design.show_profile_card && (
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            void navigate({ to: "/profile" });
          }}
          className="w-full flex items-center gap-3 rounded-xl border bg-card px-3 py-3 text-left hover:bg-muted/60 transition"
        >
          <Avatar name={profile?.full_name} src={profile?.avatar_url ?? undefined} size={compact ? 40 : 44} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold truncate">
              {profile?.full_name || user?.email || "User"}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {lang === "bn" ? "প্রোফাইল দেখুন" : "View profile"}
            </p>
          </div>
        </button>
      )}

      <ThemeLangControls />

      <nav className="space-y-0.5">
        {primary.map((item) => {
          const active = itemActive(item, location.pathname);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => void onItem(item)}
              className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                active
                  ? "bg-primary/10 text-primary font-semibold"
                  : "hover:bg-muted text-foreground"
              }`}
            >
              <span
                className="h-9 w-9 rounded-full grid place-items-center shrink-0"
                style={{
                  backgroundColor: active
                    ? `${settings.design.accent}28`
                    : `${settings.design.accent}18`,
                  color: settings.design.accent,
                }}
              >
                <MenuIcon name={item.icon} className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium truncate">
                {lang === "bn" ? item.label_bn : item.label_en}
              </span>
            </button>
          );
        })}
      </nav>

      {settings.design.show_see_more && enabled.length > 6 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="w-full rounded-xl bg-muted/80 text-xs font-semibold py-2.5 hover:bg-muted"
        >
          {expanded
            ? lang === "bn"
              ? "কম দেখুন"
              : "See less"
            : lang === "bn"
              ? "আরও দেখুন"
              : "See more"}
        </button>
      )}
    </div>
  );
}

export function UserMenuSidebar() {
  const { t, lang } = useI18n();

  return (
    <aside className="hidden md:flex md:w-60 lg:w-64 xl:w-72 shrink-0 flex-col border-r bg-card sticky top-0 h-dvh">
      <div className="px-4 py-4 border-b shrink-0">
        <p className="font-bold text-sm tracking-tight">{t("appName")}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {lang === "bn" ? "আপনার মেনু" : "Your menu"}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <UserMenuNav compact />
      </div>
    </aside>
  );
}
