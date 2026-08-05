import { useState, type CSSProperties, type ImgHTMLAttributes } from "react";
import { LANDING_MEDIA } from "@/lib/landing-media";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & {
  src: string | null | undefined;
  fallbackSrc?: string;
  /** Extra fallbacks tried in order after primary fails */
  fallbacks?: string[];
};

/**
 * Landing image with graceful fallbacks — never leaves a broken/blank hole.
 */
export function LandingImg({
  src,
  fallbackSrc = LANDING_MEDIA.fallback,
  fallbacks = [],
  alt = "",
  className,
  style,
  ...rest
}: Props) {
  const chain = [src, ...fallbacks, fallbackSrc].filter(
    (u): u is string => typeof u === "string" && u.trim().length > 0,
  );
  const [idx, setIdx] = useState(0);
  const current = chain[Math.min(idx, chain.length - 1)] ?? LANDING_MEDIA.fallback;

  return (
    <img
      {...rest}
      src={current}
      alt={alt}
      className={className}
      style={style as CSSProperties}
      onError={() => {
        setIdx((i) => (i + 1 < chain.length ? i + 1 : i));
      }}
    />
  );
}
