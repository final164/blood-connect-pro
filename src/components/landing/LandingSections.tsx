import { useEffect, useRef, useState } from "react";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Droplet,
  FlaskConical,
  Heart,
  Bell,
  Microscope,
  Stethoscope,
  Users,
  User,
} from "lucide-react";
import type { LandingSettings } from "@/lib/landing-settings";
import { activeIslamicCards } from "@/lib/landing-settings";
import type {
  LandingCampaign,
  LandingCard,
  LandingCommunityCard,
  LandingContentBundle,
  LandingFaq,
  LandingGalleryItem,
  LandingSlide,
  LandingStat,
} from "@/lib/landing-content";
import { LandingImg } from "@/components/landing/LandingImg";
import { LandingHref, LandingHero } from "@/components/landing/LandingHero";
import { DeferredMount } from "@/components/landing/DeferredMount";
import { LandingIslamicCarousel } from "@/components/landing/LandingIslamicCarousel";
import { LANDING_MEDIA } from "@/lib/landing-media";

export { LandingHero, LandingHref } from "@/components/landing/LandingHero";

const ICONS: Record<string, typeof Droplet> = {
  droplet: Droplet,
  heart: Heart,
  users: Users,
  user: User,
  bell: Bell,
  building: Building2,
  stethoscope: Stethoscope,
  microscope: Microscope,
  flask: FlaskConical,
  clipboard: ClipboardList,
};

function pick(lang: "bn" | "en", bn: string, en: string) {
  return lang === "bn" ? bn : en;
}

const shell = "mx-auto w-full max-w-5xl md:max-w-6xl px-4 sm:px-5";

export function LandingStats({
  stats,
  lang,
  liveRequestCount,
  liveDonorCount,
}: {
  stats: LandingStat[];
  lang: "bn" | "en";
  liveRequestCount: number | null;
  liveDonorCount: number | null;
}) {
  if (!stats.length) return null;
  return (
    <section className={`landing-section ${shell} py-10`}>
      <div className="grid grid-cols-3 gap-3 sm:gap-6">
        {stats.map((s) => {
          const Icon = ICONS[s.icon_key] ?? Droplet;
          let value = s.value_text;
          if (s.source === "live_requests" && liveRequestCount != null) value = String(liveRequestCount);
          if (s.source === "live_donors" && liveDonorCount != null) {
            value =
              liveDonorCount >= 1000
                ? `${(liveDonorCount / 1000).toFixed(liveDonorCount >= 10000 ? 0 : 1).replace(/\.0$/, "")}k+`
                : `${liveDonorCount}+`;
          }
          return (
            <div
              key={s.id}
              className="text-center py-3 rounded-2xl border border-black/5 bg-white/55"
            >
              <Icon className="h-5 w-5 mx-auto mb-2" style={{ color: "var(--landing-primary)" }} />
              <p className="text-lg sm:text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-[11px] mt-0.5 px-1" style={{ color: "var(--landing-muted)" }}>
                {pick(lang, s.label_bn, s.label_en)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function LandingHowItWorks({ cards, lang }: { cards: LandingCard[]; lang: "bn" | "en" }) {
  const list = cards.filter((c) => c.kind === "how");
  if (!list.length) return null;
  return (
    <section id="how" className={`landing-section ${shell} py-12`}>
      <h2 className="text-xl md:text-2xl font-bold mb-6 landing-brand">
        {lang === "bn" ? "কীভাবে কাজ করে" : "How it works"}
      </h2>
      <ul className="grid sm:grid-cols-3 gap-4">
        {list.map((c, idx) => {
          const Icon = ICONS[c.icon_key] ?? Heart;
          const inner = (
            <>
              {c.image_url ? (
                <LandingImg
                  src={c.image_url}
                  fallbackSrc={LANDING_MEDIA.how[idx % LANDING_MEDIA.how.length]}
                  alt=""
                  className="h-36 w-full object-cover rounded-xl mb-3"
                  loading="lazy"
                  decoding="async"
                  width={560}
                  height={224}
                />
              ) : (
                <span
                  className="h-10 w-10 rounded-xl grid place-items-center text-white mb-3"
                  style={{ background: "var(--landing-primary)" }}
                >
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <p className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--landing-primary)" }}>
                {lang === "bn" ? `ধাপ ${idx + 1}` : `Step ${idx + 1}`}
              </p>
              <p className="font-semibold text-sm">{pick(lang, c.title_bn, c.title_en)}</p>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--landing-muted)" }}>
                {pick(lang, c.body_bn, c.body_en)}
              </p>
            </>
          );
          return (
            <li key={c.id} className="rounded-2xl border border-black/5 bg-white/50 overflow-hidden p-3 sm:p-4 shadow-sm shadow-black/5">
              {c.link_url ? (
                <LandingHref href={c.link_url} className="block h-full hover:opacity-95 transition">
                  {inner}
                </LandingHref>
              ) : (
                inner
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function SlideCarousel({
  slides,
  lang,
  id,
}: {
  slides: LandingSlide[];
  lang: "bn" | "en";
  id?: string;
}) {
  const [i, setI] = useState(0);
  const rootRef = useRef<HTMLElement | null>(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = !!entry?.isIntersecting;
      },
      { rootMargin: "80px", threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;
    const t = window.setInterval(() => {
      if (!visibleRef.current) return; // pause off-screen — stops jank while scrolling
      if (document.hidden) return;
      setI((x) => (x + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(t);
  }, [slides.length]);

  if (!slides.length) return null;
  const s = slides[i] ?? slides[0];
  const next = slides[(i + 1) % slides.length];

  return (
    <section id={id} ref={rootRef} className={`landing-section ${shell} py-10`}>
      <div className="relative overflow-hidden rounded-3xl border border-black/5 bg-black/5 shadow-md shadow-black/5">
        <div className="aspect-[16/9] relative bg-black/10">
          {s.link_url ? (
            <LandingHref href={s.link_url} className="absolute inset-0 block">
              {s.image_url ? (
                <LandingImg
                  key={s.id}
                  src={s.image_url}
                  fallbackSrc={LANDING_MEDIA.carousel[0]}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                  decoding="async"
                  loading="lazy"
                  width={1100}
                  height={620}
                />
              ) : (
                <div
                  className="absolute inset-0"
                  style={{ background: "var(--landing-primary)", opacity: 0.3 }}
                />
              )}
            </LandingHref>
          ) : s.image_url ? (
            <LandingImg
              key={s.id}
              src={s.image_url}
              fallbackSrc={LANDING_MEDIA.carousel[0]}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              decoding="async"
              loading="lazy"
              width={1100}
              height={620}
            />
          ) : (
            <div className="absolute inset-0" style={{ background: "var(--landing-primary)", opacity: 0.3 }} />
          )}
          {/* Prefetch next slide quietly */}
          {next?.image_url && next.id !== s.id && (
            <img src={next.image_url} alt="" className="hidden" aria-hidden decoding="async" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-7 text-white pointer-events-none">
            <p className="font-semibold text-sm sm:text-lg">{pick(lang, s.title_bn, s.title_en)}</p>
            {(s.body_bn || s.body_en) && (
              <p className="mt-1 text-xs sm:text-sm text-white/85 line-clamp-2">
                {pick(lang, s.body_bn, s.body_en)}
              </p>
            )}
          </div>
        </div>
        {slides.length > 1 && (
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 pointer-events-none">
            <button
              type="button"
              aria-label="Previous"
              className="pointer-events-auto h-9 w-9 rounded-full bg-black/45 text-white grid place-items-center"
              onClick={() => setI((x) => (x - 1 + slides.length) % slides.length)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Next"
              className="pointer-events-auto h-9 w-9 rounded-full bg-black/45 text-white grid place-items-center"
              onClick={() => setI((x) => (x + 1) % slides.length)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        {slides.length > 1 && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-10">
            {slides.map((slide, idx) => (
              <button
                key={slide.id}
                type="button"
                aria-label={`Slide ${idx + 1}`}
                className={`h-1.5 rounded-full transition-all ${idx === i ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
                onClick={() => setI(idx)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export function LandingMainCarousel({ slides, lang }: { slides: LandingSlide[]; lang: "bn" | "en" }) {
  return <SlideCarousel slides={slides} lang={lang} />;
}

export function LandingStories({ slides, lang }: { slides: LandingSlide[]; lang: "bn" | "en" }) {
  if (!slides.length) return null;
  return (
    <div id="stories">
      <div className={`${shell} pt-4`}>
        <h2 className="text-xl md:text-2xl font-bold landing-brand">
          {lang === "bn" ? "গল্প ও অভিজ্ঞতা" : "Stories"}
        </h2>
      </div>
      <SlideCarousel slides={slides} lang={lang} />
    </div>
  );
}

export function LandingCampaigns({
  campaigns,
  lang,
}: {
  campaigns: LandingCampaign[];
  lang: "bn" | "en";
}) {
  if (!campaigns.length) return null;
  return (
    <section id="campaigns" className={`landing-section ${shell} py-12`}>
      <h2 className="text-xl md:text-2xl font-bold mb-6 landing-brand">
        {lang === "bn" ? "ক্যাম্পেইন" : "Campaigns"}
      </h2>
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
        {campaigns.map((c) => (
          <article
            key={c.id}
            className="min-w-[260px] max-w-[300px] shrink-0 rounded-2xl border border-black/5 overflow-hidden bg-white/55 shadow-sm shadow-black/5"
          >
            {c.cover_url ? (
              <LandingImg
                src={c.cover_url}
                fallbackSrc={LANDING_MEDIA.campaigns[0]}
                alt=""
                className="h-40 w-full object-cover"
                loading="lazy"
                decoding="async"
                width={640}
                height={160}
              />
            ) : (
              <div className="h-40 w-full" style={{ background: "var(--landing-primary)", opacity: 0.25 }} />
            )}
            <div className="p-4">
              <p className="font-semibold text-sm">{pick(lang, c.title_bn, c.title_en)}</p>
              <p className="mt-1 text-xs line-clamp-3 leading-relaxed" style={{ color: "var(--landing-muted)" }}>
                {pick(lang, c.body_bn, c.body_en)}
              </p>
              {c.cta_href && (
                <LandingHref
                  href={c.cta_href}
                  className="mt-3 inline-flex text-xs font-semibold"
                  style={{ color: "var(--landing-primary)" }}
                >
                  {pick(lang, c.cta_bn, c.cta_en) || (lang === "bn" ? "দেখুন" : "View")} →
                </LandingHref>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

export function LandingCommunity({
  settings,
  cards,
  lang,
}: {
  settings: LandingSettings;
  cards: LandingCommunityCard[];
  lang: "bn" | "en";
}) {
  const c = settings.community;
  return (
    <section id="community" className="landing-section relative py-14 px-4 overflow-hidden">
      {c.background_url ? (
        <>
          <LandingImg
            src={c.background_url}
            fallbackSrc={LANDING_MEDIA.communityBg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            width={1100}
            height={700}
          />
          <div className="absolute inset-0 bg-black/60" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, var(--landing-primary) 18%, var(--landing-bg)), var(--landing-bg))`,
          }}
        />
      )}
      <div className="relative mx-auto w-full max-w-5xl md:max-w-6xl">
        <div className="landing-glass rounded-3xl border border-white/25 p-6 sm:p-8 text-[color:var(--landing-fg)] shadow-lg shadow-black/10">
          <h2 className="text-xl md:text-2xl font-bold landing-brand">{pick(lang, c.title_bn, c.title_en)}</h2>
          <p className="mt-2 text-sm max-w-2xl leading-relaxed" style={{ color: "var(--landing-muted)" }}>
            {pick(lang, c.body_bn, c.body_en)}
          </p>
          {cards.length > 0 && (
            <ul className="mt-6 grid sm:grid-cols-3 gap-3">
              {cards.map((card) => {
                const body = (
                  <>
                    {card.image_url && (
                      <LandingImg
                        src={card.image_url}
                        fallbackSrc={LANDING_MEDIA.communityCards[0]}
                        alt=""
                        className="h-28 w-full object-cover rounded-xl mb-2.5"
                        loading="lazy"
                        decoding="async"
                        width={480}
                        height={180}
                      />
                    )}
                    <p className="text-sm font-semibold">{pick(lang, card.title_bn, card.title_en)}</p>
                    <p className="mt-1 text-[11px] leading-relaxed" style={{ color: "var(--landing-muted)" }}>
                      {pick(lang, card.body_bn, card.body_en)}
                    </p>
                  </>
                );
                return (
                  <li key={card.id} className="rounded-2xl border border-black/5 bg-white/60 p-3 overflow-hidden">
                    {card.link_url ? (
                      <LandingHref href={card.link_url} className="block hover:opacity-95">
                        {body}
                      </LandingHref>
                    ) : (
                      body
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <LandingHref
            href={c.cta_href}
            className="mt-6 inline-flex rounded-2xl px-4 py-2.5 text-xs font-semibold text-white"
            style={{ background: "var(--landing-primary)" }}
          >
            {pick(lang, c.cta_bn, c.cta_en)}
          </LandingHref>
        </div>
      </div>
    </section>
  );
}

export function LandingGallery({ items, lang }: { items: LandingGalleryItem[]; lang: "bn" | "en" }) {
  if (!items.length) return null;
  return (
    <section id="gallery" className={`landing-section ${shell} py-12`}>
      <h2 className="text-xl md:text-2xl font-bold mb-6 landing-brand">
        {lang === "bn" ? "গ্যালারি" : "Gallery"}
      </h2>
      <div className="columns-2 sm:columns-3 gap-3 space-y-3">
        {items.map((g) => (
          <figure
            key={g.id}
            className="break-inside-avoid rounded-2xl overflow-hidden border border-black/5 bg-white/40 shadow-sm shadow-black/5"
          >
            <LandingImg
              src={g.image_url}
              fallbackSrc={LANDING_MEDIA.gallery[0]}
              alt=""
              className="w-full object-cover"
              loading="lazy"
              decoding="async"
              width={560}
              height={400}
            />
            {(g.caption_bn || g.caption_en) && (
              <figcaption className="px-2.5 py-2 text-[10px]" style={{ color: "var(--landing-muted)" }}>
                {pick(lang, g.caption_bn, g.caption_en)}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
    </section>
  );
}

export function LandingFaq({ faqs, lang }: { faqs: LandingFaq[]; lang: "bn" | "en" }) {
  const [open, setOpen] = useState<string | null>(faqs[0]?.id ?? null);
  if (!faqs.length) return null;
  return (
    <section id="faq" className={`landing-section ${shell} py-12`}>
      <h2 className="text-xl md:text-2xl font-bold mb-6 landing-brand">
        {lang === "bn" ? "প্রশ্নোত্তর" : "FAQ"}
      </h2>
      <ul className="space-y-2">
        {faqs.map((f) => {
          const isOpen = open === f.id;
          return (
            <li key={f.id} className="rounded-2xl border border-black/5 overflow-hidden bg-white/50 shadow-sm shadow-black/5">
              <button
                type="button"
                className="w-full flex items-center justify-between gap-3 px-4 py-3.5 text-left text-sm font-semibold"
                onClick={() => setOpen(isOpen ? null : f.id)}
              >
                {pick(lang, f.question_bn, f.question_en)}
                <ChevronDown className={`h-4 w-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-out"
                style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 text-xs leading-relaxed" style={{ color: "var(--landing-muted)" }}>
                    {pick(lang, f.answer_bn, f.answer_en)}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function LandingCareVendor({ settings, lang }: { settings: LandingSettings; lang: "bn" | "en" }) {
  const c = settings.care_vendor;
  return (
    <section
      id="care-vendor"
      className="landing-section relative overflow-hidden px-4 py-14"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in srgb, #0d9488 14%, var(--landing-bg)), var(--landing-bg))",
      }}
    >
      <div className={`relative ${shell}`}>
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center rounded-3xl border border-teal-900/10 bg-white/60 p-6 sm:p-8 shadow-lg shadow-teal-900/5 backdrop-blur">
          <div>
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-600 text-white">
              <Stethoscope className="h-5 w-5" />
            </div>
            <h2 className="text-xl md:text-2xl font-bold landing-brand">{pick(lang, c.title_bn, c.title_en)}</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--landing-muted)" }}>
              {pick(lang, c.body_bn, c.body_en)}
            </p>
            <ul className="mt-5 grid gap-2 text-xs sm:grid-cols-2" style={{ color: "var(--landing-muted)" }}>
              <li className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 shrink-0 text-teal-700" />
                {lang === "bn" ? "চেম্বার ডেস্ক — সিরিয়াল ও কিউ" : "Chamber desk — serials & queue"}
              </li>
              <li className="flex items-center gap-2">
                <Microscope className="h-4 w-4 shrink-0 text-teal-700" />
                {lang === "bn" ? "ল্যাব ডেস্ক — বুকিং ও চেক-ইন" : "Lab desk — bookings & check-in"}
              </li>
            </ul>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:min-w-[220px]">
            <LandingHref
              href="/care/auth?mode=register"
              className="inline-flex items-center justify-center rounded-2xl bg-teal-600 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-teal-900/20 hover:bg-teal-700"
            >
              {pick(lang, c.register_bn, c.register_en)}
            </LandingHref>
            <LandingHref
              href="/care/auth"
              className="inline-flex items-center justify-center rounded-2xl border border-teal-700/25 bg-white/70 px-5 py-3 text-sm font-semibold text-teal-900"
            >
              {pick(lang, c.login_bn, c.login_en)}
            </LandingHref>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingCtaBand({ settings, lang }: { settings: LandingSettings; lang: "bn" | "en" }) {
  const c = settings.cta_band;
  return (
    <section className="landing-section relative py-16 px-4 overflow-hidden">
      {c.background_url ? (
        <>
          <LandingImg
            src={c.background_url}
            fallbackSrc={LANDING_MEDIA.ctaBg}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
            decoding="async"
            width={1100}
            height={600}
          />
          <div className="absolute inset-0 bg-black/55" />
        </>
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: "color-mix(in srgb, var(--landing-primary) 12%, var(--landing-bg))" }}
        />
      )}
      <div className="relative mx-auto max-w-3xl text-center landing-glass rounded-3xl border border-white/25 px-6 py-10 shadow-lg shadow-black/10">
        <h2 className="text-xl sm:text-2xl font-bold landing-brand">{pick(lang, c.title_bn, c.title_en)}</h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--landing-muted)" }}>
          {pick(lang, c.body_bn, c.body_en)}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <LandingHref
            href={c.primary_href}
            className="rounded-2xl px-5 py-3 text-sm font-semibold text-white"
            style={{ background: "var(--landing-primary)" }}
          >
            {pick(lang, c.primary_bn, c.primary_en)}
          </LandingHref>
          <LandingHref
            href={c.secondary_href || "#how"}
            className="rounded-2xl px-5 py-3 text-sm font-semibold border border-black/10 bg-white/40"
          >
            {pick(lang, c.secondary_bn, c.secondary_en)}
          </LandingHref>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter({ settings, lang }: { settings: LandingSettings; lang: "bn" | "en" }) {
  const f = settings.footer;
  return (
    <footer className="border-t border-black/5 px-4 py-10" style={{ color: "var(--landing-muted)" }}>
      <div className="mx-auto w-full max-w-5xl md:max-w-6xl grid sm:grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
        <div>
          <p className="font-semibold text-[color:var(--landing-fg)] landing-brand">
            {pick(lang, settings.hero.brand_bn, settings.hero.brand_en)}
          </p>
          <p className="mt-2 text-xs leading-relaxed">{pick(lang, f.copyright_bn, f.copyright_en)}</p>
          {f.hotline && (
            <a
              href={`tel:${f.hotline.replace(/\s/g, "")}`}
              className="mt-3 inline-block text-xs font-semibold"
              style={{ color: "var(--landing-primary)" }}
            >
              {lang === "bn" ? "হটলাইন" : "Hotline"}: {f.hotline}
            </a>
          )}
          {f.social.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {f.social.map((s, i) => (
                <li key={i}>
                  <LandingHref
                    href={s.href}
                    className="inline-flex rounded-lg border border-black/10 px-2.5 py-1 text-[10px] font-semibold hover:bg-black/5"
                  >
                    {pick(lang, s.label_bn, s.label_en)}
                  </LandingHref>
                </li>
              ))}
            </ul>
          )}
        </div>
        {f.columns.map((col, idx) => (
          <div key={idx}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--landing-fg)]">
              {pick(lang, col.title_bn, col.title_en)}
            </p>
            <ul className="mt-2 space-y-1.5 text-xs">
              {col.links.map((l, i) => (
                <li key={i}>
                  <LandingHref href={l.href} className="hover:opacity-100 opacity-80 transition">
                    {pick(lang, l.label_bn, l.label_en)}
                  </LandingHref>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </footer>
  );
}

export function renderLandingSection(
  id: string,
  ctx: {
    settings: LandingSettings;
    content: LandingContentBundle;
    lang: "bn" | "en";
  },
) {
  const { settings, content, lang } = ctx;
  if (!settings.sections_enabled[id as keyof typeof settings.sections_enabled]) return null;
  switch (id) {
    case "hero":
      return <LandingHero key={id} settings={settings} lang={lang} />;
    case "stats":
      return (
        <LandingStats
          key={id}
          stats={content.stats}
          lang={lang}
          liveRequestCount={content.liveRequestCount}
          liveDonorCount={content.liveDonorCount}
        />
      );
    case "how_it_works":
      return (
        <DeferredMount key={id} minHeight={280}>
          <LandingHowItWorks cards={content.cards} lang={lang} />
        </DeferredMount>
      );
    case "islamic_carousel":
      // Text-only: always mount for SSR/SEO (no DeferredMount gate).
      return (
        <LandingIslamicCarousel
          key={id}
          block={settings.islamic}
          cards={activeIslamicCards(settings.islamic)}
          lang={lang}
        />
      );
    case "campaigns":
      return (
        <DeferredMount key={id} minHeight={360}>
          <div>
            <LandingMainCarousel slides={content.carousel} lang={lang} />
            <LandingCampaigns campaigns={content.campaigns} lang={lang} />
          </div>
        </DeferredMount>
      );
    case "community":
      return (
        <DeferredMount key={id} minHeight={320}>
          <LandingCommunity settings={settings} cards={content.communityCards} lang={lang} />
        </DeferredMount>
      );
    case "care_vendor":
      return (
        <DeferredMount key={id} minHeight={280}>
          <LandingCareVendor settings={settings} lang={lang} />
        </DeferredMount>
      );
    case "gallery":
      return (
        <DeferredMount key={id} minHeight={240}>
          <LandingGallery items={content.gallery} lang={lang} />
        </DeferredMount>
      );
    case "stories_carousel":
      return (
        <DeferredMount key={id} minHeight={280}>
          <LandingStories slides={content.stories} lang={lang} />
        </DeferredMount>
      );
    case "faq":
      return (
        <DeferredMount key={id} minHeight={200}>
          <LandingFaq faqs={content.faqs} lang={lang} />
        </DeferredMount>
      );
    case "cta_band":
      return <LandingCtaBand key={id} settings={settings} lang={lang} />;
    case "footer":
      return <LandingFooter key={id} settings={settings} lang={lang} />;
    case "nav":
      return null;
    default:
      return null;
  }
}
