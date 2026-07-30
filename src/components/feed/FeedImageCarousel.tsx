import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Images, MoreHorizontal } from "lucide-react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { useI18n } from "@/lib/i18n";
import type { FeedCarouselSettings, FeedCarouselSlide } from "@/lib/feed-carousel";
import { cn } from "@/lib/utils";

type Props = {
  settings: FeedCarouselSettings;
  slides: FeedCarouselSlide[];
  className?: string;
};

export function FeedImageCarousel({ settings, slides, className }: Props) {
  const { lang } = useI18n();
  const [api, setApi] = useState<CarouselApi>();
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const active = slides.filter((s) => s.is_active && s.image_url);
  const title = lang === "bn" ? settings.title_bn : settings.title_en;
  const gap = settings.gap_px;
  const radius = settings.radius_px;
  const basis = settings.card_basis_px;
  const show = settings.enabled && active.length > 0;

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
        <header className="flex items-center justify-between gap-2 px-3.5 pt-3 pb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0">
              <Images className="h-4 w-4" />
            </span>
            <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
          </div>
          <span className="rounded-full p-1.5 text-muted-foreground" aria-hidden>
            <MoreHorizontal className="h-4 w-4" />
          </span>
        </header>
      )}

      <div className="relative px-2 pb-3 pt-0.5">
        <Carousel
          setApi={setApi}
          opts={{
            align: "start",
            loop: settings.loop,
            dragFree: true,
          }}
          className="w-full"
        >
          <CarouselContent className="ml-0" style={{ gap: `${gap}px` }}>
            {active.map((slide) => {
              const caption = lang === "bn" ? slide.title_bn : slide.title_en;
              const inner = (
                <div
                  className="relative w-full overflow-hidden bg-muted"
                  style={{
                    aspectRatio: settings.card_aspect,
                    borderRadius: radius,
                  }}
                >
                  <img
                    src={slide.image_url}
                    alt={caption || title}
                    className="absolute inset-0 h-full w-full object-cover"
                    loading="lazy"
                    draggable={false}
                  />
                  {settings.show_item_menu && (
                    <span className="absolute top-1.5 right-1.5 rounded-full bg-black/35 p-1 text-white">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </span>
                  )}
                  {caption ? (
                    <span className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/55 to-transparent px-2 pb-1.5 pt-6 text-[10px] font-medium text-white line-clamp-2">
                      {caption}
                    </span>
                  ) : null}
                </div>
              );

              return (
                <CarouselItem
                  key={slide.id}
                  className="pl-0 basis-auto"
                  style={{
                    flexBasis: basis,
                    maxWidth: basis,
                    width: basis,
                  }}
                >
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
                  "absolute left-1 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-foreground shadow-md border border-black/5 transition",
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
                  "absolute right-1 top-1/2 z-10 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-foreground shadow-md border border-black/5 transition",
                  !canNext && !settings.loop && "opacity-40 pointer-events-none",
                )}
                aria-label={lang === "bn" ? "পরে" : "Next"}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </Carousel>
      </div>
    </section>
  );
}
