import { Link } from "@tanstack/react-router";
import type { LandingSettings } from "@/lib/landing-settings";

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
  return (
    <header className="sticky top-0 z-40 border-b border-black/8 bg-[color:var(--landing-bg)]/92">
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
          <Link
            to="/auth"
            className="text-xs font-semibold px-3 py-2 rounded-xl border border-black/10"
          >
            {lang === "bn" ? nav.cta_login_bn : nav.cta_login_en}
          </Link>
          <Link
            to="/auth"
            search={{}}
            className="text-xs font-semibold px-3 py-2 rounded-xl text-white shadow-md"
            style={{ background: "var(--landing-primary)" }}
          >
            {lang === "bn" ? nav.cta_signup_bn : nav.cta_signup_en}
          </Link>
        </div>
      </div>
    </header>
  );
}
