import { Download } from "lucide-react";
import { androidApkUrl, isAndroidUserAgent } from "@/lib/app-download";
import { isNativeApp } from "@/lib/native-app";
import { cn } from "@/lib/utils";

type Props = {
  lang: "bn" | "en";
  className?: string;
  /** compact = icon+short label for nav; full = wider CTA */
  variant?: "nav" | "full" | "menu";
  /** Force show even on non-Android (e.g. desktop download for friends) */
  force?: boolean;
};

/**
 * Website → Android APK download. Hidden inside the native shell.
 */
export function AppDownloadButton({ lang, className, variant = "nav", force = false }: Props) {
  if (typeof window !== "undefined" && isNativeApp()) return null;
  if (!force && typeof navigator !== "undefined" && !isAndroidUserAgent() && variant === "nav") {
    // Still show on desktop landing as "Get Android app"
  }

  const href = androidApkUrl();
  const label =
    variant === "full"
      ? lang === "bn"
        ? "অ্যান্ড্রয়েড অ্যাপ ডাউনলোড"
        : "Download Android app"
      : lang === "bn"
        ? "অ্যাপ ডাউনলোড"
        : "Get app";

  if (variant === "full") {
    return (
      <a
        href={href}
        download="BloodLink.apk"
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1b1b1b] px-5 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-black",
          className,
        )}
      >
        <Download className="h-4 w-4" />
        {label}
      </a>
    );
  }

  if (variant === "menu") {
    return (
      <a
        href={href}
        download="BloodLink.apk"
        className={cn(
          "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-muted",
          className,
        )}
      >
        <Download className="h-4 w-4 text-primary" />
        {label}
      </a>
    );
  }

  return (
    <a
      href={href}
      download="BloodLink.apk"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white/80 px-2.5 py-2 text-[11px] sm:text-xs font-semibold text-foreground whitespace-nowrap hover:bg-white",
        className,
      )}
      title={label}
    >
      <Download className="h-3.5 w-3.5" />
      <span className="hidden xs:inline sm:inline">{lang === "bn" ? "অ্যাপ" : "App"}</span>
    </a>
  );
}
