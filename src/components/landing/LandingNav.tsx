import { Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import type { LandingSettings } from "@/lib/landing-settings";
import { enterAppOrOpenAuth } from "@/lib/landing-enter";

const AppDownloadButton = lazy(() =>
  import("@/components/AppDownloadButton").then((m) => ({ default: m.AppDownloadButton })),
);

function AuthEntryButton({
  className,
  style,
  children,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  async function onClick(e: MouseEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await enterAppOrOpenAuth();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" className={className} style={style} disabled={busy} onClick={(e) => void onClick(e)}>
      {children}
    </button>
  );
}

export function LandingNav({
  settings,
  lang,
  onToggleLang,
}: {
  settings: LandingSettings;
  lang: "bn" | "en";
  onToggleLang: () => void;
}) {
  const nav = settings.nav;
  const customLogo =
    nav.logo_url && !/\/icon-192\.png|\/icon-512\.png|\/icon\.svg/i.test(nav.logo_url);
  const [showDownload, setShowDownload] = useState(false);

  useEffect(() => {
    const show = () => setShowDownload(true);
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(show, { timeout: 2500 });
      return () => cancelIdleCallback(id);
    }
    const t = window.setTimeout(show, 900);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <header
      className="sticky top-0 z-40 border-b border-black/8 bg-[color:var(--landing-bg)]/95 supports-[backdrop-filter]:bg-[color:var(--landing-bg)]/90"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto flex w-full max-w-5xl md:max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <a href="#top" className="flex items-center gap-2 min-w-0">
          {customLogo ? (
            <img
              src={nav.logo_url}
              alt={lang === "bn" ? settings.hero.brand_bn : settings.hero.brand_en}
              width={36}
              height={36}
              className="h-9 w-9 rounded-xl object-cover ring-1 ring-black/5"
              decoding="async"
              fetchPriority="low"
            />
          ) : (
            <span
              className="h-9 w-9 rounded-xl grid place-items-center text-white shadow-md"
              style={{ background: "var(--landing-primary)" }}
              aria-hidden
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <path d="M12 2.2s6 7.1 6 11.2a6 6 0 1 1-12 0C6 9.3 12 2.2 12 2.2z" />
              </svg>
            </span>
          )}
          <span className="landing-brand text-sm font-semibold truncate">
            {lang === "bn" ? settings.hero.brand_bn : settings.hero.brand_en}
          </span>
        </a>
        <nav
          className="hidden md:flex items-center gap-4 text-xs font-medium"
          style={{ color: "var(--landing-muted)" }}
        >
          {nav.links.map((l) => (
            <a key={l.id} href={l.href} className="hover:opacity-100 opacity-80 transition whitespace-nowrap">
              {lang === "bn" ? l.label_bn : l.label_en}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2 shrink-0">
          {nav.show_lang_toggle && (
            <button
              type="button"
              onClick={onToggleLang}
              className="text-[11px] px-2 py-1.5 rounded-lg border border-black/10"
              style={{ color: "var(--landing-muted)" }}
            >
              {lang === "bn" ? "EN" : "বাং"}
            </button>
          )}
          {showDownload ? (
            <Suspense fallback={null}>
              <AppDownloadButton lang={lang} variant="nav" force />
            </Suspense>
          ) : null}
          <AuthEntryButton className="hidden sm:inline-flex text-xs font-semibold px-3 py-2 rounded-xl border border-black/10">
            {lang === "bn" ? nav.cta_login_bn : nav.cta_login_en}
          </AuthEntryButton>
          <Link
            to="/care/video"
            className="inline-flex text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl border border-sky-700/30 text-sky-900 bg-sky-50/80 whitespace-nowrap"
          >
            {lang === "bn" ? "কনসালট্যান্ট" : "Consultant"}
          </Link>
          <Link
            to="/care/doctor/register"
            className="inline-flex text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl border border-rose-700/30 text-rose-900 bg-rose-50/80 whitespace-nowrap"
          >
            {lang === "bn" ? "ডাক্তার জয়েন" : "Join as doctor"}
          </Link>
          <Link
            to="/care/auth"
            search={{ mode: "register", next: undefined }}
            className="hidden md:inline-flex text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3 py-2 rounded-xl border border-teal-700/30 text-teal-800 bg-teal-50/80 whitespace-nowrap"
          >
            {lang === "bn" ? "Care ভেন্ডর" : "Care vendor"}
          </Link>
          <AuthEntryButton
            className="text-xs font-semibold px-3 py-2 rounded-xl text-white shadow-md"
            style={{ background: "var(--landing-primary)" }}
          >
            {lang === "bn" ? nav.cta_signup_bn : nav.cta_signup_en}
          </AuthEntryButton>
        </div>
      </div>
    </header>
  );
}
