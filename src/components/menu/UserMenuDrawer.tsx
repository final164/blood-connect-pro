import { useState, type CSSProperties } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { UserMenuNav } from "@/components/menu/UserMenuNav";
import { fetchUserMenuSettings, DEFAULT_USER_MENU_SETTINGS } from "@/lib/user-menu-settings";
import { useEffect } from "react";

export function UserMenuTrigger({
  className = "h-10 w-10 rounded-xl text-foreground hover:bg-muted grid place-items-center transition shrink-0",
}: {
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { lang } = useI18n();

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
  const { t, lang } = useI18n();
  const [width, setWidth] = useState(DEFAULT_USER_MENU_SETTINGS.design.drawer_width_px);

  useEffect(() => {
    if (!open) return;
    fetchUserMenuSettings().then((s) => setWidth(s.design.drawer_width_px));
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="p-0 flex flex-col gap-0 overflow-y-auto w-[min(92vw,var(--user-menu-w))]! max-w-none!"
        style={{ ["--user-menu-w"]: `${width}px` } as CSSProperties}
      >
        <SheetHeader className="px-4 pt-5 pb-3 border-b text-left space-y-0">
          <SheetTitle className="text-base font-bold tracking-tight">{t("appName")}</SheetTitle>
          <p className="text-[11px] text-muted-foreground font-normal">
            {lang === "bn" ? "আপনার মেনু" : "Your menu"}
          </p>
        </SheetHeader>
        <div className="p-3 flex-1">
          <UserMenuNav onNavigate={() => onOpenChange(false)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
