import { memo, useEffect, useMemo, useRef, useState } from "react";
import { carouselImageCandidates } from "@/lib/feed-carousel";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  /** Drive/remote max edge length — keep small for feed cards to avoid decode lag */
  maxWidth?: number;
  /** When false, do not start network load until near viewport */
  priority?: boolean;
  loading?: "lazy" | "eager";
  draggable?: boolean;
};

/**
 * Remote/Drive image with sized URLs, viewport gating, and single-fallback retries.
 * Avoids remounting and huge 2000px Drive thumbs that jank the feed.
 */
export const CarouselRemoteImage = memo(function CarouselRemoteImage({
  src,
  alt = "",
  className,
  maxWidth = 800,
  priority = false,
  loading = "lazy",
  draggable = false,
}: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const candidates = useMemo(() => carouselImageCandidates(src, maxWidth), [src, maxWidth]);
  const [index, setIndex] = useState(0);
  const [allowLoad, setAllowLoad] = useState(priority);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setIndex(0);
    setFailed(false);
    if (priority) setAllowLoad(true);
  }, [src, priority]);

  useEffect(() => {
    if (priority || allowLoad) return;
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setAllowLoad(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting || e.intersectionRatio > 0)) {
          setAllowLoad(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px 0px", threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [priority, allowLoad, src]);

  const current = candidates[Math.min(index, Math.max(0, candidates.length - 1))] ?? "";

  return (
    <div
      ref={rootRef}
      className={cn("bg-muted", className)}
      style={{ contentVisibility: "auto", containIntrinsicSize: "1px 160px" }}
    >
      {allowLoad && current && !failed ? (
        <img
          src={current}
          alt={alt}
          className="h-full w-full object-cover"
          loading={priority ? "eager" : loading}
          decoding="async"
          fetchPriority={priority ? "high" : "low"}
          draggable={draggable}
          referrerPolicy="no-referrer"
          onError={() => {
            if (index + 1 < candidates.length) setIndex(index + 1);
            else setFailed(true);
          }}
        />
      ) : null}
    </div>
  );
});
