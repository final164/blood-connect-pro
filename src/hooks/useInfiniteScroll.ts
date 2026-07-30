import { useEffect, useRef } from "react";

/** Fires `onLoadMore` when the sentinel enters the viewport (infinite scroll). */
export function useInfiniteScroll(
  onLoadMore: () => void,
  opts: { enabled?: boolean; rootMargin?: string } = {},
) {
  const { enabled = true, rootMargin = "240px" } = opts;
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const busyRef = useRef(false);
  const cbRef = useRef(onLoadMore);
  cbRef.current = onLoadMore;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !enabled || typeof IntersectionObserver === "undefined") return;

    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.some((e) => e.isIntersecting);
        if (!hit || busyRef.current) return;
        busyRef.current = true;
        try {
          cbRef.current();
        } finally {
          // Allow next trigger after a short pause (caller also gates with loading/hasMore)
          window.setTimeout(() => {
            busyRef.current = false;
          }, 400);
        }
      },
      { root: null, rootMargin, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled, rootMargin]);

  return sentinelRef;
}
