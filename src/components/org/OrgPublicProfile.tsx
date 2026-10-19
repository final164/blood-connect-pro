import { useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Building2,
  ChevronDown,
  Droplets,
  ExternalLink,
  Globe,
  HeartPulse,
  Mail,
  Phone,
  Share2,
} from "lucide-react";
import type { OrgPortalFaq } from "@/lib/community-org-portal";

export type OrgPublicProfileProps = {
  name: string;
  description?: string | null;
  welcome?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  verified?: boolean;
  donorCount?: number;
  openRequestCount?: number;
  faqs?: OrgPortalFaq[];
  lang: "bn" | "en";
  /** Compact = view-as sheet; full = public page */
  variant?: "full" | "preview";
  onShare?: () => void;
  footerSlot?: ReactNode;
};

function pickFaq(f: OrgPortalFaq, lang: "bn" | "en") {
  return {
    q: lang === "bn" ? f.question_bn || f.question_en : f.question_en || f.question_bn,
    a: lang === "bn" ? f.answer_bn || f.answer_en : f.answer_en || f.answer_bn,
  };
}

/**
 * Grandmaster-level public organization profile —
 * same component for /org/public/$id and portal "View as".
 */
export function OrgPublicProfile({
  name,
  description,
  welcome,
  logoUrl,
  coverUrl,
  phone,
  email,
  website,
  verified,
  donorCount,
  openRequestCount,
  faqs = [],
  lang,
  variant = "full",
  onShare,
  footerSlot,
}: OrgPublicProfileProps) {
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const isPreview = variant === "preview";
  const coverH = isPreview ? "h-44 sm:h-52" : "h-52 sm:h-64 md:h-72";

  const visibleFaqs = faqs.filter((f) => {
    const { q } = pickFaq(f, lang);
    return !!q?.trim();
  });

  const siteHref = website
    ? /^https?:\/\//i.test(website)
      ? website
      : `https://${website}`
    : null;

  return (
    <article className="org-public-profile relative overflow-hidden">
      {/* Ambient wash */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, color-mix(in srgb, var(--primary) 18%, transparent), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, color-mix(in srgb, var(--primary) 8%, transparent), transparent)",
        }}
      />

      {/* Hero cover */}
      <div className={`relative ${coverH} overflow-hidden`}>
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover scale-[1.02]"
            loading={isPreview ? "lazy" : "eager"}
            decoding="async"
          />
        ) : (
          <div
            className="absolute inset-0"
            style={{
              background: `
                linear-gradient(145deg,
                  #1a0505 0%,
                  color-mix(in srgb, var(--primary) 55%, #2a0a0a) 42%,
                  #0f0a08 100%),
                repeating-linear-gradient(
                  -12deg,
                  transparent,
                  transparent 18px,
                  rgba(255,255,255,0.015) 18px,
                  rgba(255,255,255,0.015) 19px
                )
              `,
            }}
          />
        )}
        {/* Cinematic overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
        <div
          className="absolute -bottom-px inset-x-0 h-16"
          style={{
            background: "linear-gradient(to top, var(--background), transparent)",
          }}
        />

        {/* Floating brand chip */}
        <div className="absolute left-4 top-4 sm:left-5 sm:top-5">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/90 backdrop-blur-md">
            <Droplets className="h-3 w-3 text-rose-300" />
            {lang === "bn" ? "রক্তদান সংস্থা" : "Blood org"}
          </span>
        </div>

        {onShare && (
          <button
            type="button"
            onClick={onShare}
            className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/15 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md transition hover:bg-white/25 sm:right-5 sm:top-5"
          >
            <Share2 className="h-3.5 w-3.5" />
            {lang === "bn" ? "শেয়ার" : "Share"}
          </button>
        )}
      </div>

      {/* Identity block */}
      <div className={`relative px-4 sm:px-6 ${isPreview ? "-mt-12" : "-mt-14 sm:-mt-16"}`}>
        <div className="flex items-end gap-4">
          <div className="relative shrink-0">
            <div
              className={`grid place-items-center overflow-hidden rounded-[1.35rem] border-[3px] border-background bg-muted shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] ${
                isPreview ? "h-[4.75rem] w-[4.75rem]" : "h-24 w-24 sm:h-28 sm:w-28"
              }`}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <Building2 className="h-10 w-10 text-primary opacity-80" />
              )}
            </div>
            {verified ? (
              <span
                className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md"
                title={lang === "bn" ? "ভেরিফাইড" : "Verified"}
              >
                <BadgeCheck className="h-4 w-4" />
              </span>
            ) : null}
          </div>

          <div className="min-w-0 flex-1 pb-1">
            <h1
              className={`font-bold tracking-tight text-foreground leading-tight ${
                isPreview ? "text-xl" : "text-2xl sm:text-3xl"
              }`}
            >
              {name}
            </h1>
            {verified ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                <BadgeCheck className="h-3.5 w-3.5" />
                {lang === "bn" ? "ভেরিফাইড সংস্থা" : "Verified organization"}
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {lang === "bn" ? "কমিউনিটি রক্তদান নেটওয়ার্ক" : "Community blood network"}
              </p>
            )}
          </div>
        </div>

        {welcome ? (
          <p
            className="mt-4 rounded-2xl border border-primary/15 bg-primary/[0.06] px-4 py-3 text-sm font-medium leading-relaxed text-foreground"
            style={{
              boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--primary) 12%, transparent)",
            }}
          >
            “{welcome}”
          </p>
        ) : null}

        {/* Stats */}
        {(donorCount != null || openRequestCount != null) && (
          <div className={`mt-5 grid gap-2.5 ${donorCount != null && openRequestCount != null ? "grid-cols-2" : "grid-cols-1"}`}>
            {donorCount != null && (
              <div className="group relative overflow-hidden rounded-2xl border bg-card/80 p-4 backdrop-blur-sm transition hover:border-primary/30">
                <div
                  className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-40"
                  style={{
                    background:
                      "radial-gradient(circle, color-mix(in srgb, var(--primary) 35%, transparent), transparent 70%)",
                  }}
                />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Droplets className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    {lang === "bn" ? "রক্তদাতা" : "Donors"}
                  </span>
                </div>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">{donorCount}</p>
              </div>
            )}
            {openRequestCount != null && (
              <div className="group relative overflow-hidden rounded-2xl border bg-card/80 p-4 backdrop-blur-sm transition hover:border-primary/30">
                <div
                  className="pointer-events-none absolute -right-4 -top-4 h-20 w-20 rounded-full opacity-40"
                  style={{
                    background:
                      "radial-gradient(circle, color-mix(in srgb, var(--primary) 25%, transparent), transparent 70%)",
                  }}
                />
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                    <HeartPulse className="h-4 w-4" />
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wide">
                    {lang === "bn" ? "ওপেন রিকোয়েস্ট" : "Open requests"}
                  </span>
                </div>
                <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight">
                  {openRequestCount}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Contact strip */}
        {(phone || email || siteHref) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {phone ? (
              <a
                href={`tel:${phone.replace(/\s/g, "")}`}
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-xs font-semibold transition hover:border-primary/35 hover:bg-primary/[0.04]"
              >
                <Phone className="h-3.5 w-3.5 text-primary" />
                {phone}
              </a>
            ) : null}
            {email ? (
              <a
                href={`mailto:${email}`}
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-xs font-semibold transition hover:border-primary/35 hover:bg-primary/[0.04]"
              >
                <Mail className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[10rem] truncate">{email}</span>
              </a>
            ) : null}
            {siteHref ? (
              <a
                href={siteHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border bg-card px-3 py-2.5 text-xs font-semibold transition hover:border-primary/35 hover:bg-primary/[0.04]"
              >
                <Globe className="h-3.5 w-3.5 text-primary" />
                {lang === "bn" ? "ওয়েবসাইট" : "Website"}
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </a>
            ) : null}
          </div>
        )}

        {/* About */}
        {description ? (
          <section className="mt-6">
            <div className="mb-2 flex items-center gap-2">
              <span className="h-px w-6 bg-primary/50" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                {lang === "bn" ? "আমাদের সম্পর্কে" : "About us"}
              </h2>
            </div>
            <p className="text-sm leading-[1.7] text-muted-foreground whitespace-pre-wrap">
              {description}
            </p>
          </section>
        ) : null}

        {/* FAQ */}
        {visibleFaqs.length > 0 ? (
          <section className="mt-7">
            <div className="mb-3 flex items-center gap-2">
              <span className="h-px w-6 bg-primary/50" />
              <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
                {lang === "bn" ? "প্রশ্নোত্তর" : "Q & A"}
              </h2>
            </div>
            <ul className="space-y-2">
              {visibleFaqs.map((f, idx) => {
                const { q, a } = pickFaq(f, lang);
                const open = openFaq === f.id;
                return (
                  <li
                    key={f.id}
                    className="overflow-hidden rounded-2xl border bg-card/90 transition hover:border-primary/25"
                  >
                    <button
                      type="button"
                      onClick={() => setOpenFaq(open ? null : f.id)}
                      className="flex w-full items-start gap-3 px-3.5 py-3 text-left"
                      aria-expanded={open}
                    >
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary/10 text-[10px] font-bold tabular-nums text-primary">
                        {String(idx + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 text-sm font-semibold leading-snug">
                        {q}
                      </span>
                      <ChevronDown
                        className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ${
                          open ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    <div
                      className={`grid transition-[grid-template-rows,opacity] duration-200 ${
                        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                      }`}
                    >
                      <div className="overflow-hidden">
                        {a ? (
                          <p className="border-t px-3.5 pb-3.5 pt-2 pl-[3.25rem] text-xs leading-relaxed text-muted-foreground">
                            {a}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {footerSlot}

        {/* Brand footer */}
        <div className="mt-8 mb-2 flex items-center justify-center gap-2 border-t border-dashed pt-5 pb-1">
          <Droplets className="h-3.5 w-3.5 text-primary/70" />
          <p className="text-[10px] font-semibold tracking-wide text-muted-foreground">
            {lang === "bn" ? "স্পন্দন · spandonbd.com" : "Spandon · spandonbd.com"}
          </p>
        </div>
      </div>
    </article>
  );
}

/** @deprecated Prefer OrgPublicProfile — kept for any residual imports */
export function OrgPublicCard(props: {
  name: string;
  description?: string | null;
  logoUrl?: string | null;
  coverUrl?: string | null;
  phone?: string | null;
  verified?: boolean;
  donorCount?: number;
  openRequestCount?: number;
  lang: "bn" | "en";
}) {
  return (
    <OrgPublicProfile
      {...props}
      variant="preview"
    />
  );
}
