import { useEffect, useRef, useState, type CSSProperties } from "react";
import { levelAnimCssVars, type UrgencyLevelAnim } from "@/lib/urgency-animation";

/** Lightweight static SVG — cheaper than Lucide component tree */
function BloodDropIcon({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="currentColor"
      aria-hidden
      focusable="false"
    >
      <path d="M12 2.2c-1.1 2.6-5.5 7.1-5.5 11.1a5.5 5.5 0 0 0 11 0c0-4-4.4-8.5-5.5-11.1z" />
    </svg>
  );
}

function modeClass(mode: UrgencyLevelAnim["mode"]) {
  if (mode === "heartbeat") return "ua-droplet--heartbeat";
  if (mode === "pulse-glow") return "ua-droplet--pulse-glow";
  if (mode === "bounce") return "ua-droplet--bounce";
  return "ua-droplet--breathe";
}

/** Cap droplet count for smoothness (mobile CSS also hides 2nd+) */
function effectiveCount(cfg: UrgencyLevelAnim) {
  return Math.min(2, Math.max(1, cfg.droplet_count));
}

/** Full-bleed blood droplet backdrop — GPU opacity/scale only, pauses off-screen */
export function UrgencyDropletBackdrop({
  config,
  className = "",
}: {
  config: UrgencyLevelAnim;
  className?: string;
}) {
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    if (!config.enabled) return;
    const el = layerRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;

    const root = el.closest(".ua-anim-root") ?? el;

    const syncPause = (visible: boolean) => {
      const docVisible = typeof document === "undefined" || document.visibilityState === "visible";
      const next = visible && docVisible;
      setActive(next);
      root.classList.toggle("is-paused", !next);
    };

    const io = new IntersectionObserver(
      ([entry]) => syncPause(!!entry?.isIntersecting),
      { root: null, rootMargin: "40px", threshold: 0.01 },
    );
    io.observe(root instanceof Element ? root : el);

    const onVis = () => {
      const target = root instanceof Element ? root : el;
      const rect = target.getBoundingClientRect();
      const inView = rect.bottom > 0 && rect.top < window.innerHeight;
      syncPause(inView);
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      root.classList.remove("is-paused");
    };
  }, [config.enabled]);

  if (!config.enabled) return null;

  const vars = levelAnimCssVars(config) as CSSProperties;
  const count = effectiveCount(config);
  const offsets =
    count === 1
      ? [{ x: "50%", y: "52%", delay: "0ms", scale: 1 }]
      : [
          { x: "44%", y: "48%", delay: "0ms", scale: 1 },
          {
            x: "58%",
            y: "56%",
            delay: `${Math.round(config.duration_ms * 0.4)}ms`,
            scale: 0.88,
          },
        ];

  return (
    <div
      ref={layerRef}
      className={`ua-layer ${active ? "" : "is-paused"} ${className}`}
      aria-hidden
      style={vars}
    >
      {offsets.map((o, i) => (
        <BloodDropIcon
          key={i}
          className={`ua-droplet ${modeClass(config.mode)}`}
          style={
            {
              left: o.x,
              top: o.y,
              animationDelay: o.delay,
              width: `calc(var(--ua-size) * ${o.scale})`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

export function UrgencyHeaderIcon({
  config,
  className = "h-5 w-5 shrink-0",
}: {
  config: UrgencyLevelAnim;
  className?: string;
}) {
  if (!config.enabled || !config.show_header_icon) return null;
  const vars = levelAnimCssVars({
    ...config,
    opacity_min: Math.max(0.65, config.opacity_min),
    opacity_max: 1,
    scale_min: 0.94,
    scale_max: 1.1,
  }) as CSSProperties;
  return (
    <BloodDropIcon
      className={`ua-header-icon ua-mode-${config.mode} ${className}`}
      style={vars}
    />
  );
}
