import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronLeft, ChevronRight, Droplet } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useI18n } from "@/lib/i18n";
import {
  successSlideHref,
  type SuccessCarouselSettings,
  type SuccessStorySlide,
} from "@/lib/success-carousel";
import { cn } from "@/lib/utils";

type Props = {
  settings: SuccessCarouselSettings;
  slides: SuccessStorySlide[];
  className?: string;
};

export function SuccessStoriesCarousel({ settings, slides, className }: Props) {
  const { lang } = useI18n();
  const bn = lang === "bn";
  const [api, setApi] = useState<CarouselApi>();
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [inView, setInView] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);

  const active = useMemo(() => slides.filter((s) => s.is_active), [slides]);
  const title = bn ? settings.title_bn : settings.title_en;
  const gap = settings.gap_px;
  const radius = settings.radius_px;
  const basis = settings.card_basis_px;
  const show = settings.enabled && active.length > 0;

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { rootMargin: "180px 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!api) return;
    const sync = () => {
      setCanPrev(api.canScrollPrev());
      setCanNext(api.canScrollNext());
    };
    sync();
    api.on("select", sync);
    api.on("reInit", sync);
    return () => {
      api.off("select", sync);
      api.off("reInit", sync);
    };
  }, [api]);

  useEffect(() => {
    if (!api || !show || !inView || !settings.autoplay || active.length < 2) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      if (api.canScrollNext()) api.scrollNext();
      else if (settings.loop) api.scrollTo(0);
    }, Math.max(3500, settings.autoplay_ms));
    return () => window.clearInterval(id);
  }, [api, show, inView, settings.autoplay, settings.autoplay_ms, settings.loop, active.length]);

  if (!show) return null;

  return (
    <section
      ref={sectionRef}
      className={cn(
        "rounded-2xl border bg-card overflow-hidden shadow-sm",
        className,
      )}
      aria-label={title}
    >
      {settings.show_header && (
        <header className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 shrink-0">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
          </div>
          {settings.show_nav_arrows && active.length > 1 && (
            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                disabled={!canPrev && !settings.loop}
                onClick={() => api?.scrollPrev()}
                className="h-8 w-8 rounded-full border grid place-items-center disabled:opacity-40"
                aria-label="Previous"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!canNext && !settings.loop}
                onClick={() => api?.scrollNext()}
                className="h-8 w-8 rounded-full border grid place-items-center disabled:opacity-40"
                aria-label="Next"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </header>
      )}

      <Carousel
        setApi={setApi}
        opts={{ align: "start", loop: settings.loop }}
        className="w-full px-3 pb-3"
      >
        <CarouselContent style={{ marginLeft: 0, gap }}>
          {active.map((slide) => {
            const href = successSlideHref(slide);
            const cardTitle = bn ? slide.title_bn || slide.title_en : slide.title_en || slide.title_bn;
            const inner = (
              <article
                className="h-full flex flex-col overflow-hidden border bg-gradient-to-b from-emerald-50/80 to-card dark:from-emerald-950/30 dark:to-card shadow-sm"
                style={{
                  borderRadius: radius,
                  aspectRatio: settings.card_aspect.replace("/", " / "),
                }}
              >
                <div className="px-3 pt-3 flex items-start justify-between gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-bold">
                    <Droplet className="h-3 w-3" fill="currentColor" />
                    {slide.blood_group || "—"}
                  </span>
                  <span className="rounded-full bg-emerald-600/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-semibold">
                    {bn ? "সম্পন্ন" : "Done"}
                  </span>
                </div>
                <div className="px-3 pt-2 flex-1 min-h-0">
                  <p className="text-sm font-bold leading-snug line-clamp-2">{cardTitle}</p>
                  {slide.patient_name ? (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                      {bn ? "রোগীঃ" : "Patient:"} {slide.patient_name}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground line-clamp-2">
                    {slide.location_label || slide.hospital || "—"}
                  </p>
                  <p className="mt-1 text-[11px] font-medium text-foreground/80">
                    {slide.bags_needed} {bn ? "ব্যাগ" : "bag(s)"}
                  </p>
                  {slide.notes_excerpt ? (
                    <p className="mt-2 text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">
                      {slide.notes_excerpt}
                    </p>
                  ) : null}
                </div>
              </article>
            );

            return (
              <CarouselItem
                key={slide.id}
                className="pl-0"
                style={{ flexBasis: basis, maxWidth: basis * 1.35 }}
              >
                {href ? (
                  href.startsWith("http") ? (
                    <a
                      href={href}
                      target={settings.open_links_new_tab ? "_blank" : undefined}
                      rel="noreferrer"
                      className="block h-full"
                    >
                      {inner}
                    </a>
                  ) : (
                    <Link to={href as never} className="block h-full">
                      {inner}
                    </Link>
                  )
                ) : (
                  inner
                )}
              </CarouselItem>
            );
          })}
        </CarouselContent>
      </Carousel>
    </section>
  );
}
