import { useEffect, useRef, useState } from "react";
import type { LandingIslamicBlock, LandingIslamicCard } from "@/lib/landing-settings";

function pick(lang: "bn" | "en", bn: string, en: string) {
  return lang === "bn" ? bn : en;
}

const shell = "mx-auto w-full max-w-5xl md:max-w-6xl px-4 sm:px-5";

/**
 * Text-only Islamic inspiration carousel.
 * - Always in the DOM (SSR + crawlers) — no DeferredMount / no images.
 * - content-visibility keeps paint cheap; autoplay only when in view.
 */
export function LandingIslamicCarousel({
  block,
  cards,
  lang,
}: {
  block: LandingIslamicBlock;
  cards: LandingIslamicCard[];
  lang: "bn" | "en";
}) {
  const trackRef = useRef<HTMLUListElement>(null);
  const rootRef = useRef<HTMLElement>(null);
  const [active, setActive] = useState(0);
  const [inView, setInView] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener?.("change", sync);
    return () => mq.removeEventListener?.("change", sync);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setInView(!!entry?.isIntersecting),
      { rootMargin: "40px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const track = trackRef.current;
    const child = track?.children[active] as HTMLElement | undefined;
    if (!track || !child) return;
    const left = child.offsetLeft - (track.clientWidth - child.clientWidth) / 2;
    track.scrollTo({ left, behavior: reduceMotion ? "auto" : "smooth" });
  }, [active, reduceMotion, cards.length, inView]);

  useEffect(() => {
    if (!inView || reduceMotion || cards.length < 2) return;
    const t = window.setInterval(() => {
      setActive((i) => (i + 1) % cards.length);
    }, 7000);
    return () => window.clearInterval(t);
  }, [inView, reduceMotion, cards.length]);

  if (!cards.length) return null;

  const sectionTitle = pick(lang, block.title_bn, block.title_en);
  const sectionBody = pick(lang, block.body_bn, block.body_en);
  const inLang = lang === "bn" ? "bn-BD" : "en-BD";

  return (
    <section
      ref={rootRef}
      id="islamic"
      lang={inLang}
      className="landing-section relative py-12"
      aria-labelledby="islamic-heading"
      itemScope
      itemType="https://schema.org/ItemList"
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "auto 360px",
      }}
    >
      <meta itemProp="name" content={sectionTitle} />
      <meta itemProp="numberOfItems" content={String(cards.length)} />
      {sectionBody ? <meta itemProp="description" content={sectionBody} /> : null}

      {/* Cheap static wash — no blur / no image paint */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--landing-primary) 6%, transparent), transparent 42%, color-mix(in srgb, var(--landing-primary) 4%, transparent))",
        }}
      />

      <div className={`relative ${shell}`}>
        <header className="mb-6 max-w-2xl">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.14em] mb-2"
            style={{ color: "var(--landing-muted)" }}
          >
            {lang === "bn" ? "ইসলামী অনুপ্রেরণা" : "Islamic inspiration"}
          </p>
          <h2 id="islamic-heading" className="text-xl md:text-2xl font-bold landing-brand">
            {sectionTitle}
          </h2>
          {sectionBody ? (
            <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--landing-muted)" }}>
              {sectionBody}
            </p>
          ) : null}
        </header>

        {/*
          All quotes stay in the HTML for crawlers (horizontal carousel only).
          No JS gate / no image URLs.
        */}
        <ul
          ref={trackRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory no-scrollbar pb-1"
          role="list"
        >
          {cards.map((card, index) => {
            const quote = pick(lang, card.quote_bn, card.quote_en);
            const source = pick(lang, card.source_bn, card.source_en);
            const theme = pick(lang, card.theme_bn, card.theme_en);
            const reflection = pick(lang, card.reflection_bn, card.reflection_en);
            return (
              <li
                key={card.id}
                className="snap-center shrink-0 w-[min(100%,22rem)] sm:w-[24rem]"
                itemProp="itemListElement"
                itemScope
                itemType="https://schema.org/ListItem"
              >
                <meta itemProp="position" content={String(index + 1)} />
                <article
                  className="h-full rounded-3xl border border-black/5 bg-[color:var(--landing-glass)] p-5 sm:p-6"
                  itemProp="item"
                  itemScope
                  itemType="https://schema.org/Quotation"
                >
                  {theme ? (
                    <p
                      className="text-[11px] font-semibold tracking-wide mb-3"
                      style={{ color: "var(--landing-primary)" }}
                      itemProp="name"
                    >
                      {theme}
                    </p>
                  ) : null}
                  <blockquote className="relative" cite={source || undefined}>
                    <p
                      className="text-[15px] sm:text-base font-medium leading-relaxed"
                      style={{ color: "var(--landing-fg)" }}
                      itemProp="text"
                    >
                      {quote}
                    </p>
                    {source ? (
                      <footer className="mt-4">
                        <cite
                          className="not-italic text-xs font-semibold"
                          style={{ color: "var(--landing-muted)" }}
                          itemProp="isBasedOn"
                        >
                          — {source}
                        </cite>
                      </footer>
                    ) : null}
                  </blockquote>
                  {reflection ? (
                    <p
                      className="mt-4 text-xs leading-relaxed border-t border-black/5 pt-3"
                      style={{ color: "var(--landing-muted)" }}
                    >
                      {reflection}
                    </p>
                  ) : null}
                </article>
              </li>
            );
          })}
        </ul>

        {cards.length > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1.5" role="tablist" aria-label={lang === "bn" ? "স্লাইড" : "Slides"}>
              {cards.map((c, idx) => (
                <button
                  key={c.id}
                  type="button"
                  role="tab"
                  aria-selected={idx === active}
                  aria-label={`${lang === "bn" ? "কার্ড" : "Card"} ${idx + 1}`}
                  className={`h-1.5 rounded-full transition-[width] duration-200 ${
                    idx === active ? "w-6" : "w-1.5 opacity-40"
                  }`}
                  style={{ background: "var(--landing-primary)" }}
                  onClick={() => setActive(idx)}
                />
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                aria-label={lang === "bn" ? "আগের কার্ড" : "Previous card"}
                className="h-9 w-9 rounded-full border border-black/10 bg-white/80 text-sm font-semibold grid place-items-center"
                onClick={() => setActive((i) => (i - 1 + cards.length) % cards.length)}
              >
                ‹
              </button>
              <button
                type="button"
                aria-label={lang === "bn" ? "পরের কার্ড" : "Next card"}
                className="h-9 w-9 rounded-full border border-black/10 bg-white/80 text-sm font-semibold grid place-items-center"
                onClick={() => setActive((i) => (i + 1) % cards.length)}
              >
                ›
              </button>
            </div>
          </div>
        ) : null}

        {/* Crawler / no-JS mirror — same copy, zero layout cost when CSS applies */}
        <noscript>
          <ol>
            {cards.map((card) => (
              <li key={`ns-${card.id}`}>
                <strong>{pick(lang, card.theme_bn, card.theme_en)}</strong>
                {": "}
                {pick(lang, card.quote_bn, card.quote_en)}
                {pick(lang, card.source_bn, card.source_en)
                  ? ` (${pick(lang, card.source_bn, card.source_en)})`
                  : ""}
              </li>
            ))}
          </ol>
        </noscript>
      </div>
    </section>
  );
}
