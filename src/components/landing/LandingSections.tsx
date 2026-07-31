import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Heart,
  Bell,
  Users,
  User,
} from "lucide-react";
import type { LandingSettings } from "@/lib/landing-settings";
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

const ICONS: Record<string, typeof Droplet> = {
  droplet: Droplet,
  heart: Heart,
  users: Users,
  user: User,
  bell: Bell,
  building: Building2,
};

function pick(lang: "bn" | "en", bn: string, en: string) {
  return lang === "bn" ? bn : en;
}

export function LandingHero({ settings, lang }: { settings: LandingSettings; lang: "bn" | "en" }) {
  const h = settings.hero;
  const bg = h.background_url;
  return (
    <section id="top" className="relative min-h-[min(92dvh,820px)] flex flex-col justify-end overflow-hidden">
      <div className="absolute inset-0 landing-hero-bg">
        {h.background_video_url ? (
          <video
            className="h-full w-full object-cover"
            autoPlay
            muted
            loop
            playsInline
            poster={bg || undefined}
            src={h.background_video_url}
          />
        ) : bg ? (
          <img src={bg} alt="" className="h-full w-full object-cover" />
        ) : (
          <div
            className="h-full w-full"
            style={{
              background: `radial-gradient(ellipse at 30% 20%, color-mix(in srgb, var(--landing-primary) 35%, transparent), transparent 55%),
                linear-gradient(165deg, #1a0a0a 0%, color-mix(in srgb, var(--landing-primary) 55%, #1a0a0a) 45%, #0c0707 100%)`,
            }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/20" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-5xl px-5 pb-14 pt-28 landing-fade-up">
        <p className="landing-brand text-3xl sm:text-5xl font-bold text-white tracking-tight mb-3">
          {pick(lang, h.brand_bn, h.brand_en)}
        </p>
        <h1 className="text-xl sm:text-2xl font-semibold text-white/95 max-w-xl leading-snug">
          {pick(lang, h.headline_bn, h.headline_en)}
        </h1>
        <p className="mt-3 text-sm sm:text-base text-white/75 max-w-lg leading-relaxed">
          {pick(lang, h.sub_bn, h.sub_en)}
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/30"
            style={{ background: "var(--landing-primary)" }}
          >
            {pick(lang, h.cta_primary_bn, h.cta_primary_en)}
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white/95 border border-white/35 bg-white/10 backdrop-blur"
          >
            {pick(lang, h.cta_secondary_bn, h.cta_secondary_en)}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingStats({
  stats,
  lang,
  liveRequestCount,
}: {
  stats: LandingStat[];
  lang: "bn" | "en";
  liveRequestCount: number | null;
}) {
  if (!stats.length) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => {
          const Icon = ICONS[s.icon_key] ?? Droplet;
          const value =
            s.source === "live_requests" && liveRequestCount != null
              ? String(liveRequestCount)
              : s.value_text;
          return (
            <div key={s.id} className="text-center py-2">
              <Icon className="h-5 w-5 mx-auto mb-2" style={{ color: "var(--landing-primary)" }} />
              <p className="text-lg sm:text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--landing-muted)" }}>
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
    <section id="how" className="mx-auto max-w-5xl px-4 py-12">
      <h2 className="text-xl font-bold mb-6 landing-brand">
        {lang === "bn" ? "কীভাবে কাজ করে" : "How it works"}
      </h2>
      <ul className="grid sm:grid-cols-3 gap-4">
        {list.map((c) => {
          const Icon = ICONS[c.icon_key] ?? Heart;
          return (
            <li key={c.id} className="rounded-2xl border border-black/5 bg-white/40 dark:bg-white/5 p-4">
              {c.image_url ? (
                <img src={c.image_url} alt="" className="h-28 w-full object-cover rounded-xl mb-3" />
              ) : (
                <span
                  className="h-10 w-10 rounded-xl grid place-items-center text-white mb-3"
                  style={{ background: "var(--landing-primary)" }}
                >
                  <Icon className="h-5 w-5" />
                </span>
              )}
              <p className="font-semibold text-sm">{pick(lang, c.title_bn, c.title_en)}</p>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: "var(--landing-muted)" }}>
                {pick(lang, c.body_bn, c.body_en)}
              </p>
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
  useEffect(() => {
    if (slides.length < 2) return;
    const t = window.setInterval(() => setI((x) => (x + 1) % slides.length), 4500);
    return () => window.clearInterval(t);
  }, [slides.length]);
  if (!slides.length) return null;
  const s = slides[i] ?? slides[0];
  return (
    <section id={id} className="mx-auto max-w-5xl px-4 py-10">
      <div className="relative overflow-hidden rounded-3xl border border-black/5 bg-black/5">
        <div className="aspect-[16/9] relative">
          {s.image_url ? (
            <img
              key={s.id}
              src={s.image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-500"
            />
          ) : (
            <div className="absolute inset-0" style={{ background: "var(--landing-primary)", opacity: 0.3 }} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-5 text-white">
            <p className="font-semibold text-sm sm:text-base">{pick(lang, s.title_bn, s.title_en)}</p>
            {(s.body_bn || s.body_en) && (
              <p className="mt-1 text-xs text-white/80 line-clamp-2">{pick(lang, s.body_bn, s.body_en)}</p>
            )}
          </div>
        </div>
        {slides.length > 1 && (
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between px-2 pointer-events-none">
            <button
              type="button"
              className="pointer-events-auto h-9 w-9 rounded-full bg-black/40 text-white grid place-items-center"
              onClick={() => setI((x) => (x - 1 + slides.length) % slides.length)}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="pointer-events-auto h-9 w-9 rounded-full bg-black/40 text-white grid place-items-center"
              onClick={() => setI((x) => (x + 1) % slides.length)}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
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
    <div>
      <div className="mx-auto max-w-5xl px-4 pt-4">
        <h2 className="text-xl font-bold landing-brand">
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
    <section id="campaigns" className="mx-auto max-w-5xl px-4 py-12">
      <h2 className="text-xl font-bold mb-6 landing-brand">
        {lang === "bn" ? "ক্যাম্পেইন" : "Campaigns"}
      </h2>
      <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
        {campaigns.map((c) => (
          <article
            key={c.id}
            className="min-w-[260px] max-w-[280px] shrink-0 rounded-2xl border border-black/5 overflow-hidden bg-white/50"
          >
            {c.cover_url ? (
              <img src={c.cover_url} alt="" className="h-36 w-full object-cover" />
            ) : (
              <div className="h-36 w-full" style={{ background: "var(--landing-primary)", opacity: 0.25 }} />
            )}
            <div className="p-4">
              <p className="font-semibold text-sm">{pick(lang, c.title_bn, c.title_en)}</p>
              <p className="mt-1 text-xs line-clamp-3" style={{ color: "var(--landing-muted)" }}>
                {pick(lang, c.body_bn, c.body_en)}
              </p>
              {c.cta_href && (
                <Link
                  to="/auth"
                  className="mt-3 inline-flex text-xs font-semibold"
                  style={{ color: "var(--landing-primary)" }}
                >
                  {pick(lang, c.cta_bn, c.cta_en) || (lang === "bn" ? "দেখুন" : "View")} →
                </Link>
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
    <section
      className="relative py-14 px-4 overflow-hidden"
      style={
        c.background_url
          ? {
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.45), rgba(0,0,0,0.55)), url(${c.background_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : {
              background: `linear-gradient(135deg, color-mix(in srgb, var(--landing-primary) 18%, var(--landing-bg)), var(--landing-bg))`,
            }
      }
    >
      <div className="mx-auto max-w-5xl">
        <div className="landing-glass rounded-3xl border border-white/20 p-6 sm:p-8 text-[color:var(--landing-fg)]">
          <h2 className="text-xl font-bold landing-brand">{pick(lang, c.title_bn, c.title_en)}</h2>
          <p className="mt-2 text-sm max-w-2xl" style={{ color: "var(--landing-muted)" }}>
            {pick(lang, c.body_bn, c.body_en)}
          </p>
          {cards.length > 0 && (
            <ul className="mt-6 grid sm:grid-cols-3 gap-3">
              {cards.map((card) => (
                <li key={card.id} className="rounded-2xl border border-black/5 bg-white/50 p-3">
                  <p className="text-sm font-semibold">{pick(lang, card.title_bn, card.title_en)}</p>
                  <p className="mt-1 text-[11px]" style={{ color: "var(--landing-muted)" }}>
                    {pick(lang, card.body_bn, card.body_en)}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/auth"
            className="mt-6 inline-flex rounded-2xl px-4 py-2.5 text-xs font-semibold text-white"
            style={{ background: "var(--landing-primary)" }}
          >
            {pick(lang, c.cta_bn, c.cta_en)}
          </Link>
        </div>
      </div>
    </section>
  );
}

export function LandingGallery({ items, lang }: { items: LandingGalleryItem[]; lang: "bn" | "en" }) {
  if (!items.length) return null;
  return (
    <section className="mx-auto max-w-5xl px-4 py-12">
      <h2 className="text-xl font-bold mb-6 landing-brand">
        {lang === "bn" ? "গ্যালারি" : "Gallery"}
      </h2>
      <div className="columns-2 sm:columns-3 gap-3 space-y-3">
        {items.map((g) => (
          <figure key={g.id} className="break-inside-avoid rounded-2xl overflow-hidden border border-black/5">
            <img src={g.image_url} alt="" className="w-full object-cover" loading="lazy" />
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
    <section id="faq" className="mx-auto max-w-5xl px-4 py-12">
      <h2 className="text-xl font-bold mb-6 landing-brand">
        {lang === "bn" ? "প্রশ্নোত্তর" : "FAQ"}
      </h2>
      <ul className="space-y-2">
        {faqs.map((f) => {
          const isOpen = open === f.id;
          return (
            <li key={f.id} className="rounded-2xl border border-black/5 overflow-hidden bg-white/40">
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

export function LandingCtaBand({ settings, lang }: { settings: LandingSettings; lang: "bn" | "en" }) {
  const c = settings.cta_band;
  return (
    <section
      className="relative py-16 px-4"
      style={
        c.background_url
          ? {
              backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(0,0,0,0.6)), url(${c.background_url})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }
          : { background: "color-mix(in srgb, var(--landing-primary) 12%, var(--landing-bg))" }
      }
    >
      <div className="mx-auto max-w-3xl text-center landing-glass rounded-3xl border border-white/20 px-6 py-10">
        <h2 className="text-xl sm:text-2xl font-bold landing-brand">{pick(lang, c.title_bn, c.title_en)}</h2>
        <p className="mt-2 text-sm" style={{ color: "var(--landing-muted)" }}>
          {pick(lang, c.body_bn, c.body_en)}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/auth"
            className="rounded-2xl px-5 py-3 text-sm font-semibold text-white"
            style={{ background: "var(--landing-primary)" }}
          >
            {pick(lang, c.primary_bn, c.primary_en)}
          </Link>
          <a
            href={c.secondary_href || "#how"}
            className="rounded-2xl px-5 py-3 text-sm font-semibold border border-black/10"
          >
            {pick(lang, c.secondary_bn, c.secondary_en)}
          </a>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter({ settings, lang }: { settings: LandingSettings; lang: "bn" | "en" }) {
  const f = settings.footer;
  return (
    <footer className="border-t border-black/5 px-4 py-10" style={{ color: "var(--landing-muted)" }}>
      <div className="mx-auto max-w-5xl grid sm:grid-cols-3 gap-8 text-sm">
        <div>
          <p className="font-semibold text-[color:var(--landing-fg)] landing-brand">
            {pick(lang, settings.hero.brand_bn, settings.hero.brand_en)}
          </p>
          <p className="mt-2 text-xs leading-relaxed">{pick(lang, f.copyright_bn, f.copyright_en)}</p>
          {f.hotline && (
            <a href={`tel:${f.hotline}`} className="mt-3 inline-block text-xs font-semibold" style={{ color: "var(--landing-primary)" }}>
              {f.hotline}
            </a>
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
                  <a href={l.href}>{pick(lang, l.label_bn, l.label_en)}</a>
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
        />
      );
    case "how_it_works":
      return <LandingHowItWorks key={id} cards={content.cards} lang={lang} />;
    case "campaigns":
      return (
        <div key={id}>
          <LandingMainCarousel slides={content.carousel} lang={lang} />
          <LandingCampaigns campaigns={content.campaigns} lang={lang} />
        </div>
      );
    case "community":
      return (
        <LandingCommunity key={id} settings={settings} cards={content.communityCards} lang={lang} />
      );
    case "gallery":
      return <LandingGallery key={id} items={content.gallery} lang={lang} />;
    case "stories_carousel":
      return <LandingStories key={id} slides={content.stories} lang={lang} />;
    case "faq":
      return <LandingFaq key={id} faqs={content.faqs} lang={lang} />;
    case "cta_band":
      return <LandingCtaBand key={id} settings={settings} lang={lang} />;
    case "footer":
      return <LandingFooter key={id} settings={settings} lang={lang} />;
    case "nav":
      return null; // rendered separately sticky
    default:
      return null;
  }
}
