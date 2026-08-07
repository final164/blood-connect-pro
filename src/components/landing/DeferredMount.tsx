import { useEffect, useRef, useState, type ReactNode } from "react";

/** Mount children only when near viewport — keeps below-fold work off the critical path. */
export function DeferredMount({
  children,
  rootMargin = "280px 0px",
  minHeight = 120,
  className,
}: {
  children: ReactNode;
  rootMargin?: string;
  minHeight?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setShow(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShow(true);
          io.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [rootMargin]);

  return (
    <div
      ref={ref}
      className={className}
      style={show ? undefined : { minHeight }}
      aria-hidden={show ? undefined : true}
    >
      {show ? children : null}
    </div>
  );
}
