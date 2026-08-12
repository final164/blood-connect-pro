import { useEffect, useMemo, useState } from "react";
import { carouselImageCandidates, resolveCarouselImageUrl } from "@/lib/feed-carousel";

export function Avatar({ name, src, size = 40 }: { name?: string | null; src?: string; size?: number }) {
  const initial = (name ?? "?").trim().charAt(0).toUpperCase();
  const candidates = useMemo(() => {
    if (!src?.trim()) return [];
    return carouselImageCandidates(resolveCarouselImageUrl(src), Math.max(size * 2, 160));
  }, [src, size]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [src]);

  const current = candidates[Math.min(index, Math.max(0, candidates.length - 1))];

  return (
    <div
      className="rounded-full bg-primary/10 text-primary grid place-items-center font-semibold shrink-0 overflow-hidden"
      style={{ height: size, width: size, fontSize: size * 0.38 }}
    >
      {current ? (
        <img
          src={current}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => {
            if (index + 1 < candidates.length) setIndex((i) => i + 1);
          }}
        />
      ) : (
        initial
      )}
    </div>
  );
}
