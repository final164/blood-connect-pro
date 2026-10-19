import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import {
  Activity,
  Bookmark,
  Building2,
  ChevronDown,
  Circle,
  Droplet,
  FileText,
  Flag,
  LogOut,
  MessagesSquare,
  Moon,
  Settings,
  Share2,
  Sun,
  ThumbsUp,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AppDownloadButton } from "@/components/AppDownloadButton";
import { BrandMark } from "@/components/BrandLogo";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { isNativeApp } from "@/lib/native-app";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_USER_MENU_SETTINGS,
  fetchUserMenuSettings,
  menuItemHref,
  type UserMenuItem,
  type UserMenuItemId,
  type UserMenuSettings,
} from "@/lib/user-menu-settings";

/** Explicit map — never `import * as Icons` (pulls entire lucide into the graph). */
const MENU_ICONS: Record<string, LucideIcon> = {
  FileText,
  ThumbsUp,
  MessagesSquare,
  Share2,
  Bookmark,
  Droplet,
  Building2,
  Users,
  User,
  Settings,
  Flag,
  LogOut,
  Circle,
  Activity,
};

/** Activity log ids shown as a compact grid under one dropdown. */
const ACTIVITY_LOG_IDS = new Set<UserMenuItemId>([
  "liked",
  "commented",
  "shared",
  "saved",
  "donated",
]);

const ACTIVITY_TILE_TINT: Record<string, string> = {
  liked: "#E53935",
  commented: "#1E88E5",
  shared: "#43A047",
  saved: "#FB8C00",
  donated: "#C62828",
};

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
  const Comp = MENU_ICONS[name] ?? Circle;
  return <Comp className={className} />;
}

function navigateToMenu(href: string, navigate: ReturnType<typeof useNavigate>) {
  if (href === "/profile") return void navigate({ to: "/profile" });
  if (href === "/org") return void navigate({ to: "/org" });
  if (href.startsWith("/settings")) {
    const report = href.includes("report=1") || href.includes("report=true");
    return void navigate({ to: "/settings", search: report ? { report: true } : {} });
  }
  const view = href.replace("/me/", "");
  void navigate({ to: "/me/$view", params: { view } });
}

function itemActive(item: UserMenuItem, pathname: string): boolean {
  const href = menuItemHref(item.id);
  if (!href) return false;
  if (href === "/profile") return pathname === "/profile";
  if (href === "/org") return pathname === "/org" || pathname.startsWith("/org/");
  if (href === "/settings") return pathname === "/settings";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function activityGroupActive(items: UserMenuItem[], pathname: string): boolean {
  return items.some((item) => itemActive(item, pathname));
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
  const [activityOpen, setActivityOpen] = useState(false);

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

  const { topItems, activityItems } = useMemo(() => {
    const activity: UserMenuItem[] = [];
    const top: UserMenuItem[] = [];
    for (const item of enabled) {
      if (ACTIVITY_LOG_IDS.has(item.id)) activity.push(item);
      else top.push(item);
    }
    return { topItems: top, activityItems: activity };
  }, [enabled]);

  const activityIsActive = activityGroupActive(activityItems, location.pathname);

  useEffect(() => {
    if (activityIsActive) setActivityOpen(true);
  }, [activityIsActive]);

  const primary =
    settings.design.show_see_more && !expanded ? topItems.slice(0, 6) : topItems;

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

  function renderRow(item: UserMenuItem) {
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
  }

  function renderActivityDropdown() {
    if (!activityItems.length) return null;
    const accent = settings.design.accent;
    return (
      <div className="rounded-xl overflow-hidden">
        <button
          type="button"
          onClick={() => setActivityOpen((v) => !v)}
          aria-expanded={activityOpen}
          className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
            activityIsActive || activityOpen
              ? "bg-primary/10 text-primary font-semibold"
              : "hover:bg-muted text-foreground"
          }`}
        >
          <span
            className="h-9 w-9 rounded-full grid place-items-center shrink-0"
            style={{
              backgroundColor: `${accent}${activityIsActive || activityOpen ? "28" : "18"}`,
              color: accent,
            }}
          >
            <Activity className="h-4 w-4" />
          </span>
          <span className="flex-1 text-sm font-medium truncate">
            {lang === "bn" ? "অ্যাক্টিভিটি লগস" : "Activity logs"}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
              activityOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        <div
          className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
            activityOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="grid grid-cols-2 gap-2 px-1 pb-2 pt-1 sm:grid-cols-2">
              {activityItems.map((item) => {
                const active = itemActive(item, location.pathname);
                const tint = ACTIVITY_TILE_TINT[item.id] ?? accent;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => void onItem(item)}
                    className={`aspect-square rounded-2xl border p-2.5 flex flex-col items-center justify-center gap-2 text-center transition active:scale-[0.97] ${
                      active
                        ? "border-primary/40 bg-primary/10 shadow-sm"
                        : "border-border/70 bg-card hover:border-primary/25 hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className="h-10 w-10 rounded-xl grid place-items-center shrink-0 shadow-sm"
                      style={{ backgroundColor: `${tint}18`, color: tint }}
                    >
                      <MenuIcon name={item.icon} className="h-5 w-5" />
                    </span>
                    <span
                      className={`text-[11px] font-semibold leading-tight line-clamp-2 px-0.5 ${
                        active ? "text-primary" : "text-foreground"
                      }`}
                    >
                      {lang === "bn" ? item.label_bn : item.label_en}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  /** Insert activity dropdown after my_posts (or right after the first row). */
  const navNodes: ReactNode[] = [];
  let activityInserted = false;
  const hasMyPosts = primary.some((p) => p.id === "my_posts");
  for (const item of primary) {
    navNodes.push(renderRow(item));
    if (!activityInserted && (item.id === "my_posts" || (!hasMyPosts && navNodes.length === 1))) {
      const block = renderActivityDropdown();
      if (block) {
        navNodes.push(<div key="activity-logs">{block}</div>);
        activityInserted = true;
      }
    }
  }
  if (!activityInserted) {
    const block = renderActivityDropdown();
    if (block) navNodes.unshift(<div key="activity-logs">{block}</div>);
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

      {!isNativeApp() && (
        <AppDownloadButton lang={lang} variant="menu" force />
      )}

      <nav className="space-y-0.5">{navNodes}</nav>

      {settings.design.show_see_more && topItems.length > 6 && (
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
        <BrandMark
          name={t("appName")}
          subtitle={lang === "bn" ? "আপনার মেনু" : "Your menu"}
          to="/home"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <UserMenuNav compact />
      </div>
    </aside>
  );
}
