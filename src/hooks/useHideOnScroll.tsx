import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Hide on scroll-down, reveal on scroll-up (window scroll). */
export function useHideOnScroll(opts?: {
  threshold?: number;
  /** Min scrollY before hide can activate */
  topReveal?: number;
  disabled?: boolean;
}) {
  const threshold = opts?.threshold ?? 6;
  const topReveal = opts?.topReveal ?? 24;
  const disabled = opts?.disabled ?? false;
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (disabled) {
      setHidden(false);
      return;
    }

    let lastY = typeof window !== "undefined" ? window.scrollY : 0;
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastY;
        if (y <= topReveal) {
          setHidden(false);
        } else if (delta > threshold) {
          setHidden(true);
        } else if (delta < -threshold) {
          setHidden(false);
        }
        lastY = y;
        ticking = false;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [disabled, threshold, topReveal]);

  return hidden;
}

export function AutoHideHeader({
  children,
  className,
  disabled = false,
}: {
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const hidden = useHideOnScroll({ disabled });

  return (
    <header
      className={cn(
        "sticky top-0 transition-transform duration-300 ease-out will-change-transform",
        hidden ? "-translate-y-full pointer-events-none" : "translate-y-0",
        className,
      )}
      data-header-hidden={hidden ? "true" : "false"}
    >
      {children}
    </header>
  );
}
