import { useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { isNativeApp, nativeHapticLight } from "@/lib/native-app";

type FallbackTo =
  | string
  | { to: string; search?: Record<string, unknown> };

type PageBackButtonProps = {
  /** Prefer router history; if none, go here (default /home). */
  fallbackTo?: FallbackTo;
  /** Force a fixed destination (no history.back). */
  to?: FallbackTo;
  className?: string;
  /** rounded-full (default) | rounded-xl */
  shape?: "full" | "xl";
  size?: "sm" | "md";
};

function navigateFallback(
  navigate: ReturnType<typeof useNavigate>,
  dest: FallbackTo,
) {
  if (typeof dest === "string") {
    void navigate({ to: dest as never });
    return;
  }
  void navigate({ to: dest.to as never, search: dest.search as never });
}

/**
 * Professional app-wide back control.
 * Uses TanStack history when possible — never trusts window.history.length alone
 * (Android WebView often reports length>1 on first paint and blanks the app).
 */
export function PageBackButton({
  fallbackTo = "/home",
  to,
  className,
  shape = "full",
  size = "md",
}: PageBackButtonProps) {
  const navigate = useNavigate();
  const router = useRouter();
  const { lang } = useI18n();
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const radius = shape === "xl" ? "rounded-xl" : "rounded-full";

  function onBack() {
    if (isNativeApp()) void nativeHapticLight();
    if (to) {
      navigateFallback(navigate, to);
      return;
    }
    try {
      if (router.history.canGoBack()) {
        router.history.back();
        return;
      }
    } catch {
      /* fall through */
    }
    navigateFallback(navigate, fallbackTo);
  }

  return (
    <button
      type="button"
      onClick={onBack}
      className={cn(
        dim,
        radius,
        "shrink-0 grid place-items-center text-foreground/90 hover:bg-muted active:scale-[0.96] transition",
        className,
      )}
      aria-label={lang === "bn" ? "ফিরে যান" : "Go back"}
    >
      <ArrowLeft className={icon} strokeWidth={2.25} />
    </button>
  );
}

type PageHeaderBarProps = {
  title: string;
  subtitle?: string;
  fallbackTo?: FallbackTo;
  to?: FallbackTo;
  trailing?: React.ReactNode;
  leadingExtra?: React.ReactNode;
  className?: string;
  /** Hide back (e.g. true root tabs). Default false. */
  hideBack?: boolean;
};

/** Compact title row: [back] title … trailing — drop into AutoHideHeader. */
export function PageHeaderBar({
  title,
  subtitle,
  fallbackTo,
  to,
  trailing,
  leadingExtra,
  className,
  hideBack = false,
}: PageHeaderBarProps) {
  return (
    <div className={cn("flex items-center gap-2 px-3 sm:px-4 py-2.5 min-h-12", className)}>
      {!hideBack && <PageBackButton fallbackTo={fallbackTo} to={to} />}
      {leadingExtra}
      <div className="min-w-0 flex-1">
        <h1 className="text-sm sm:text-base font-bold tracking-tight truncate leading-tight">{title}</h1>
        {subtitle ? <p className="text-[10px] text-muted-foreground truncate mt-0.5">{subtitle}</p> : null}
      </div>
      {trailing ? <div className="flex items-center gap-1 shrink-0">{trailing}</div> : null}
    </div>
  );
}
