import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_BRAND_LOGO,
  sanitizeLogoUrl,
} from "@/lib/landing-media";
import {
  fetchLandingSettings,
  peekLandingSettingsCache,
} from "@/lib/landing-settings";

export const SPANDON_LOGO_SRC = DEFAULT_BRAND_LOGO;

/** Live brand logo from Admin → Landing → Logo URL (with Spandon fallback). */
export function useBrandLogoSrc(override?: string | null) {
  const [src, setSrc] = useState(() =>
    sanitizeLogoUrl(override ?? peekLandingSettingsCache().nav.logo_url),
  );

  useEffect(() => {
    if (override != null && String(override).trim()) {
      setSrc(sanitizeLogoUrl(override));
      return;
    }
    setSrc(sanitizeLogoUrl(peekLandingSettingsCache().nav.logo_url));
    let cancelled = false;
    void fetchLandingSettings().then((s) => {
      if (!cancelled) setSrc(sanitizeLogoUrl(s.nav.logo_url));
    });
    return () => {
      cancelled = true;
    };
  }, [override]);

  return src;
}

type BrandLogoProps = {
  size?: number;
  pulse?: boolean;
  className?: string;
  imgClassName?: string;
  /** Admin / CMS logo URL. Omit to load from landing settings. */
  src?: string | null;
  /** When set, wraps logo in a home link. Use `false` for decorative/loading only. */
  to?: "/home" | "/" | false;
  alt?: string;
};

/** Brand mark — always Admin Landing logo (or Spandon default). No legacy icons. */
export function BrandLogo({
  size = 36,
  pulse = false,
  className,
  imgClassName,
  src: srcProp,
  to = "/home",
  alt = "Spandon",
}: BrandLogoProps) {
  const src = useBrandLogoSrc(srcProp);

  const mark = (
    <span
      className={cn(
        "relative inline-grid place-items-center overflow-hidden rounded-xl bg-black ring-1 ring-black/10 shrink-0",
        pulse && "spandon-logo-pulse",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={cn("h-full w-full object-cover", imgClassName)}
        decoding="async"
        draggable={false}
      />
    </span>
  );

  if (to === false) return mark;

  return (
    <Link
      to={to}
      className="inline-flex shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      aria-label={alt}
    >
      {mark}
    </Link>
  );
}

/** Logo + brand name for headers. */
export function BrandMark({
  name,
  subtitle,
  size = 36,
  pulse = false,
  to = "/home",
  className,
  src,
}: {
  name: string;
  subtitle?: string;
  size?: number;
  pulse?: boolean;
  to?: "/home" | "/" | false;
  className?: string;
  src?: string | null;
}) {
  const inner = (
    <>
      <BrandLogo size={size} pulse={pulse} to={false} alt={name} src={src} />
      <span className="min-w-0 text-left">
        <span className="block text-sm font-bold leading-tight truncate">{name}</span>
        {subtitle ? (
          <span className="block text-[10px] text-muted-foreground leading-tight truncate">
            {subtitle}
          </span>
        ) : null}
      </span>
    </>
  );

  if (to === false) {
    return <span className={cn("inline-flex items-center gap-2.5 min-w-0", className)}>{inner}</span>;
  }

  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-2.5 min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
      aria-label={name}
    >
      {inner}
    </Link>
  );
}

/** Full-screen / route loading with heartbeat pulse. */
export function BrandLoadingScreen({ label }: { label?: string }) {
  return (
    <div
      className="min-h-dvh grid place-items-center bg-background"
      aria-busy="true"
      role="status"
    >
      <div className="flex flex-col items-center gap-3">
        <BrandLogo size={72} pulse to={false} />
        {label ? <p className="text-xs text-muted-foreground">{label}</p> : null}
      </div>
    </div>
  );
}
