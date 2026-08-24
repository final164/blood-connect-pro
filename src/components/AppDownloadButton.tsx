import { useState, type MouseEvent } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { androidApkUrl } from "@/lib/app-download";
import { isNativeApp } from "@/lib/native-app";
import { cn } from "@/lib/utils";

type Props = {
  lang: "bn" | "en";
  className?: string;
  /** compact = icon+short label for nav; full = wider CTA */
  variant?: "nav" | "full" | "menu";
  /** kept for callers; download is always offered on web */
  force?: boolean;
};

async function triggerApkDownload(lang: "bn" | "en") {
  const url = androidApkUrl();
  const absolute =
    url.startsWith("http")
      ? url
      : `${window.location.origin}${url.startsWith("/") ? url : `/${url}`}`;

  const res = await fetch(absolute, { cache: "no-store", credentials: "same-origin" });
  if (!res.ok) {
    throw new Error(
      lang === "bn"
        ? "অ্যাপ ফাইল পাওয়া যায়নি — একটু পর আবার চেষ্টা করুন"
        : "App file not found — try again shortly",
    );
  }

  const blob = await res.blob();
  const type = (blob.type || res.headers.get("content-type") || "").toLowerCase();
  if (type.includes("text/html") || type.includes("text/plain") || blob.size < 50_000) {
    throw new Error(
      lang === "bn"
        ? "অ্যাপ ফাইল এখনো আপলোড হয়নি"
        : "App file is not available yet",
    );
  }

  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = "BloodLink.apk";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

/**
 * Website → Android APK download. Hidden inside the native shell.
 * Uses fetch+blob so TanStack Router cannot swallow the click.
 */
export function AppDownloadButton({ lang, className, variant = "nav" }: Props) {
  const [busy, setBusy] = useState(false);

  if (typeof window !== "undefined" && isNativeApp()) return null;

  const label =
    variant === "full"
      ? lang === "bn"
        ? "অ্যান্ড্রয়েড অ্যাপ ডাউনলোড"
        : "Download Android app"
      : lang === "bn"
        ? "অ্যাপ ডাউনলোড"
        : "Get app";

  async function onClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    try {
      await triggerApkDownload(lang);
      toast.success(lang === "bn" ? "ডাউনলোড শুরু হয়েছে" : "Download started");
    } catch (err) {
      toast.error((err as Error).message || (lang === "bn" ? "ডাউনলোড ব্যর্থ" : "Download failed"));
    } finally {
      setBusy(false);
    }
  }

  const shared = {
    type: "button" as const,
    onClick: (e: MouseEvent) => void onClick(e),
    disabled: busy,
    "aria-busy": busy,
    title: label,
  };

  const icon = busy ? (
    <Loader2 className="h-3.5 w-3.5 animate-spin" />
  ) : (
    <Download className={variant === "full" ? "h-4 w-4" : "h-3.5 w-3.5"} />
  );

  if (variant === "full") {
    return (
      <button
        {...shared}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1b1b1b] px-5 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-black disabled:opacity-60",
          className,
        )}
      >
        {icon}
        {label}
      </button>
    );
  }

  if (variant === "menu") {
    return (
      <button
        {...shared}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-muted disabled:opacity-60 text-left",
          className,
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Download className="h-4 w-4 text-primary" />}
        {label}
      </button>
    );
  }

  return (
    <button
      {...shared}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-xl border border-black/10 bg-white/80 px-2.5 py-2 text-[11px] sm:text-xs font-semibold text-foreground whitespace-nowrap hover:bg-white disabled:opacity-60",
        className,
      )}
    >
      {icon}
      <span className="hidden sm:inline">{lang === "bn" ? "অ্যাপ" : "App"}</span>
    </button>
  );
}
