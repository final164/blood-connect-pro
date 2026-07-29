import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Menu } from "lucide-react";
import * as Icons from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchUserMenuSettings,
  menuItemHref,
  type UserMenuItem,
  type UserMenuSettings,
  DEFAULT_USER_MENU_SETTINGS,
} from "@/lib/user-menu-settings";

function MenuIcon({ name, className }: { name: string; className?: string }) {
  const Comp = (Icons as Record<string, unknown>)[name] as
    | React.ComponentType<{ className?: string }>
    | undefined;
  if (!Comp) return <Icons.Circle className={className} />;
  return <Comp className={className} />;
}

function navigateToMenu(
  href: string,
  navigate: ReturnType<typeof useNavigate>,
) {
  if (href === "/profile") return void navigate({ to: "/profile" });
  if (href === "/settings") return void navigate({ to: "/settings" });
  const view = href.replace("/me/", "");
  void navigate({ to: "/me/$view", params: { view } });
}

export function UserMenuTrigger({
  className = "h-10 w-10 rounded-xl text-foreground hover:bg-muted grid place-items-center transition shrink-0",
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { lang, t } = useI18n();

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className}
        aria-label={lang === "bn" ? "মেনু" : "Menu"}
        title={lang === "bn" ? "মেনু" : "Menu"}
      >
        <Menu className="h-5 w-5" />
      </button>
      <UserMenuDrawer open={open} onOpenChange={setOpen} />
    </>
  );
}

export function UserMenuDrawer({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { user, signOut } = useAuth();
  const { lang, t } = useI18n();
  const navigate = useNavigate();
  const [settings, setSettings] = useState<UserMenuSettings>(DEFAULT_USER_MENU_SETTINGS);
  const [profile, setProfile] = useState<{
    full_name: string | null;
    avatar_url: string | null;
  } | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!open) return;
    fetchUserMenuSettings().then(setSettings);
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => setProfile(data ?? null));
  }, [open, user?.id]);

  const enabled = useMemo(
    () => settings.items.filter((i) => i.enabled).sort((a, b) => a.order - b.order),
    [settings.items],
  );

  const primary = settings.design.show_see_more && !expanded ? enabled.slice(0, 6) : enabled;
  const width = settings.design.drawer_width_px;

  async function onItem(item: UserMenuItem) {
    if (item.id === "logout") {
      onOpenChange(false);
      await signOut();
      return;
    }
    const href = menuItemHref(item.id);
    if (!href) return;
    onOpenChange(false);
    navigateToMenu(href, navigate);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="p-0 flex flex-col gap-0 overflow-y-auto !w-[min(92vw,var(--user-menu-w))] !max-w-none"
        style={{ ["--user-menu-w"]: `${width}px` } as CSSProperties}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b text-left space-y-0">
          <SheetTitle className="text-base font-bold tracking-tight">{t("appName")}</SheetTitle>
          <p className="text-[11px] text-muted-foreground font-normal">
            {lang === "bn" ? "আপনার মেনু" : "Your menu"}
          </p>
        </SheetHeader>

        <div className="p-3 space-y-3 flex-1">
          {settings.design.show_profile_card && (
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                void navigate({ to: "/profile" });
              }}
              className="w-full flex items-center gap-3 rounded-xl border bg-card px-3 py-3 text-left hover:bg-muted/60 transition"
            >
              <Avatar name={profile?.full_name} src={profile?.avatar_url ?? undefined} size={44} />
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

          <nav className="space-y-0.5">
            {primary.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void onItem(item)}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted transition"
              >
                <span
                  className="h-9 w-9 rounded-full grid place-items-center shrink-0"
                  style={{ backgroundColor: `${settings.design.accent}18`, color: settings.design.accent }}
                >
                  <MenuIcon name={item.icon} className="h-4 w-4" />
                </span>
                <span className="text-sm font-medium truncate">
                  {lang === "bn" ? item.label_bn : item.label_en}
                </span>
              </button>
            ))}
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
      </SheetContent>
    </Sheet>
  );
}

/** Optional wrapper if a parent needs a fixed trigger slot */
export function UserMenuShell({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}
