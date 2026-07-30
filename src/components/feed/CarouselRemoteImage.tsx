import { useEffect, useState } from "react";
import { carouselImageCandidates } from "@/lib/feed-carousel";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  loading?: "lazy" | "eager";
  draggable?: boolean;
};

/** Renders remote/Drive share URLs with fallbacks when the first candidate fails. */
export function CarouselRemoteImage({ src, alt = "", className, loading = "lazy", draggable }: Props) {
  const candidates = carouselImageCandidates(src);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [src]);

  const current = candidates[Math.min(index, Math.max(0, candidates.length - 1))] ?? "";
  if (!current) {
    return <div className={cn("bg-muted", className)} aria-hidden />;
  }

  return (
    <img
      key={`${src}-${index}`}
      src={current}
      alt={alt}
      className={className}
      loading={loading}
      draggable={draggable}
      referrerPolicy="no-referrer"
      onError={() => {
        setIndex((i) => (i + 1 < candidates.length ? i + 1 : i));
      }}
    />
  );
}
