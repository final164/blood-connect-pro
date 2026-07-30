import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, PanelsTopLeft } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { CarouselRemoteImage } from "@/components/feed/CarouselRemoteImage";
import { useI18n } from "@/lib/i18n";
import type { FeedBannerSettings, FeedBannerSlide } from "@/lib/feed-banner";
import { cn } from "@/lib/utils";

type Props = {
  settings: FeedBannerSettings;
  slides: FeedBannerSlide[];
  className?: string;
};

export function FeedBannerSlider({ settings, slides, className }: Props) {
  const { lang } = useI18n();
  const [api, setApi] = useState<CarouselApi>();
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const [selected, setSelected] = useState(0);

  const active = slides.filter((s) => s.is_active && s.image_url);
  const title = lang === "bn" ? settings.title_bn : settings.title_en;
  const show = settings.enabled && active.length > 0;

  useEffect(() => {
    if (!api) return;
    const sync = () => {
      setCanPrev(api.canScrollPrev());
      setCanNext(api.canScrollNext());
      setSelected(api.selectedScrollSnap());
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
    if (!api || !show || !settings.autoplay || active.length < 2) return;
    const id = window.setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
      else if (settings.loop) api.scrollTo(0);
    }, settings.autoplay_ms);
    return () => window.clearInterval(id);
  }, [api, show, settings.autoplay, settings.autoplay_ms, settings.loop, active.length]);

  if (!show) return null;

  return (
    <section
      className={cn("rounded-2xl border bg-card overflow-hidden shadow-sm", className)}
      aria-label={title}
    >
      {settings.show_header && (
        <header className="flex items-center gap-2 px-3.5 pt-3 pb-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
            <PanelsTopLeft className="h-4 w-4" />
          </span>
          <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
        </header>
      )}

      <div className={cn("relative", settings.show_header ? "px-2 pb-3" : "p-2")}>
        <Carousel
          setApi={setApi}
          opts={{
            align: "start",
            loop: settings.loop,
          }}
          className="w-full"
        >
          <CarouselContent className="ml-0">
            {active.map((slide) => {
              const caption = lang === "bn" ? slide.title_bn : slide.title_en;
              const inner = (
                <div
                  className="relative w-full overflow-hidden bg-muted"
                  style={{
                    aspectRatio: settings.aspect_ratio,
                    maxHeight: settings.max_height_px,
                    borderRadius: settings.radius_px,
                  }}
                >
                  <CarouselRemoteImage
                    src={slide.image_url}
                    alt={caption || title}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                  {settings.show_captions && caption ? (
                    <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/60 to-transparent px-3 pb-2.5 pt-8 text-xs font-medium text-white line-clamp-2">
                      {caption}
                    </span>
                  ) : null}
                </div>
              );

              return (
                <CarouselItem key={slide.id} className="pl-0 basis-full">
                  {slide.link_url ? (
                    <a
                      href={slide.link_url}
                      target={settings.open_links_new_tab ? "_blank" : undefined}
                      rel={settings.open_links_new_tab ? "noopener noreferrer" : undefined}
                      className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {inner}
                    </a>
                  ) : (
                    inner
                  )}
                </CarouselItem>
              );
            })}
          </CarouselContent>

          {settings.show_nav_arrows && active.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => api?.scrollPrev()}
                disabled={!canPrev && !settings.loop}
                className={cn(
                  "absolute left-3 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md border border-black/5 transition",
                  !canPrev && !settings.loop && "opacity-40 pointer-events-none",
                )}
                aria-label={lang === "bn" ? "আগে" : "Previous"}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => api?.scrollNext()}
                disabled={!canNext && !settings.loop}
                className={cn(
                  "absolute right-3 top-1/2 z-10 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-foreground shadow-md border border-black/5 transition",
                  !canNext && !settings.loop && "opacity-40 pointer-events-none",
                )}
                aria-label={lang === "bn" ? "পরে" : "Next"}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </Carousel>

        {settings.show_dots && active.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 pt-2.5">
            {active.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => api?.scrollTo(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === selected ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/35",
                )}
                aria-label={`${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
