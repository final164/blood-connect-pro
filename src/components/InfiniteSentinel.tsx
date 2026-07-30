import type { RefObject } from "react";
import { Loader2 } from "lucide-react";

/** Bottom sentinel for infinite lists — attach ref from useInfiniteScroll. */
export function InfiniteSentinel({
  sentinelRef,
  loading,
  hasMore,
  label,
}: {
  sentinelRef: RefObject<HTMLDivElement | null>;
  loading?: boolean;
  hasMore: boolean;
  label?: string;
}) {
  if (!hasMore && !loading) return null;
  return (
    <div
      ref={sentinelRef}
      className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground"
      aria-hidden={!loading}
    >
      {loading ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{label ?? "Loading…"}</span>
        </>
      ) : (
        <span className="h-4" />
      )}
    </div>
  );
}
