import { useEffect, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import {
  ArrowDown,
  ArrowUp,
  Globe,
  Plus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_LANDING_SETTINGS,
  DEFAULT_HERO_SLIDESHOW,
  THEME_PRESETS,
  fetchLandingSettings,
  invalidateLandingSettingsCache,
  saveLandingSettings,
  type LandingSectionId,
  type LandingSettings,
  type LandingTheme,
} from "@/lib/landing-settings";
import {
  landingAdmin,
  uploadLandingImage,
  type LandingCampaign,
  type LandingCard,
  type LandingCommunityCard,
  type LandingFaq,
  type LandingGalleryItem,
  type LandingSlide,
  type LandingStat,
} from "@/lib/landing-content";
import { isGoogleDriveUrl, resolveCarouselImageUrl } from "@/lib/feed-carousel";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

type SubTab =
  | "general"
  | "sections"
  | "hero"
  | "stats"
  | "cards"
  | "carousel"
  | "campaigns"
  | "gallery"
  | "community"
  | "faq"
  | "cta"
  | "footer"
  | "seo";

const SECTION_LABELS: Record<LandingSectionId, { bn: string; en: string }> = {
  nav: { bn: "নেভ", en: "Nav" },
  hero: { bn: "হিরো", en: "Hero" },
  stats: { bn: "স্ট্যাটস", en: "Stats" },
  how_it_works: { bn: "কীভাবে", en: "How it works" },
  campaigns: { bn: "ক্যাম্পেইন", en: "Campaigns" },
  community: { bn: "কমিউনিটি", en: "Community" },
  gallery: { bn: "গ্যালারি", en: "Gallery" },
  stories_carousel: { bn: "গল্প স্লাইডার", en: "Stories" },
  faq: { bn: "FAQ", en: "FAQ" },
  cta_band: { bn: "CTA ব্যান্ড", en: "CTA band" },
  footer: { bn: "ফুটার", en: "Footer" },
};

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{title}</p>
        {hint && <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-rose-500 shrink-0"
      />
    </label>
  );
}

async function pickUpload(
  file: File | undefined,
  onUrl: (url: string) => void,
  lang: "bn" | "en",
) {
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    toast.error(lang === "bn" ? "শুধু ইমেজ" : "Images only");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast.error(lang === "bn" ? "সর্বোচ্চ ৫ MB" : "Max 5 MB");
    return;
  }
  try {
    const url = await uploadLandingImage(file);
    onUrl(url);
    toast.success(lang === "bn" ? "আপলোড হয়েছে" : "Uploaded");
  } catch (e) {
    toast.error(e instanceof Error ? e.message : "Upload failed");
  }
}

export function LandingAdmin() {
  const { lang, t } = useI18n();
  const { can } = useAdminAccess();
  const [tab, setTab] = useState<SubTab>("general");
  const [cfg, setCfg] = useState<LandingSettings>(DEFAULT_LANDING_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [schemaHint, setSchemaHint] = useState(false);

  const [stats, setStats] = useState<LandingStat[]>([]);
  const [cards, setCards] = useState<LandingCard[]>([]);
  const [slides, setSlides] = useState<LandingSlide[]>([]);
  const [campaigns, setCampaigns] = useState<LandingCampaign[]>([]);
  const [gallery, setGallery] = useState<LandingGalleryItem[]>([]);
  const [faqs, setFaqs] = useState<LandingFaq[]>([]);
  const [communityCards, setCommunityCards] = useState<LandingCommunityCard[]>([]);

  async function reload() {
    try {
      const settings = await fetchLandingSettings(true);
      setCfg(settings);
      const [st, ca, sl, camp, gal, fq, cc] = await Promise.all([
        landingAdmin.stats(),
        landingAdmin.cards(),
        landingAdmin.slides(),
        landingAdmin.campaigns(),
        landingAdmin.gallery(),
        landingAdmin.faqs(),
        landingAdmin.communityCards(),
      ]);
      setStats(st);
      setCards(ca);
      setSlides(sl);
      setCampaigns(camp);
      setGallery(gal);
      setFaqs(fq);
      setCommunityCards(cc);
      setSchemaHint(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/landing_|relation|column|schema/i.test(msg)) setSchemaHint(true);
      toast.error(msg);
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  async function saveSettings() {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    setBusy(true);
    try {
      await saveLandingSettings(cfg);
      invalidateLandingSettingsCache();
      toast.success(t("saved"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/landing_settings|column/i.test(msg)) setSchemaHint(true);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function upsertRow(table: string, row: Record<string, unknown>) {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    setBusy(true);
    try {
      await landingAdmin.upsert(table, row);
      toast.success(t("saved"));
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/landing_|relation/i.test(msg)) setSchemaHint(true);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  async function removeRow(table: string, id: string) {
    if (!can("settings.edit")) return;
    if (!confirm(lang === "bn" ? "ডিলিট করবেন?" : "Delete?")) return;
    setBusy(true);
    try {
      await landingAdmin.remove(table, id);
      toast.success(lang === "bn" ? "ডিলিট হয়েছে" : "Deleted");
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  function moveSection(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= cfg.section_order.length) return;
    const next = [...cfg.section_order];
    const tmp = next[idx]!;
    next[idx] = next[j]!;
    next[j] = tmp;
    setCfg((p) => ({ ...p, section_order: next }));
  }

  const tabs: { id: SubTab; bn: string; en: string }[] = [
    { id: "general", bn: "জেনারেল / থিম", en: "General / Theme" },
    { id: "sections", bn: "সেকশন অর্ডার", en: "Sections" },
    { id: "hero", bn: "হিরো", en: "Hero" },
    { id: "stats", bn: "স্ট্যাটস", en: "Stats" },
    { id: "cards", bn: "কার্ড", en: "Cards" },
    { id: "carousel", bn: "ক্যারোজেল", en: "Carousel" },
    { id: "campaigns", bn: "ক্যাম্পেইন", en: "Campaigns" },
    { id: "gallery", bn: "গ্যালারি", en: "Gallery" },
    { id: "community", bn: "কমিউনিটি", en: "Community" },
    { id: "faq", bn: "FAQ", en: "FAQ" },
    { id: "cta", bn: "CTA", en: "CTA" },
    { id: "footer", bn: "ফুটার", en: "Footer" },
    { id: "seo", bn: "SEO", en: "SEO" },
  ];

  return (
    <div className="space-y-4 max-w-4xl">
      {schemaHint && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {lang === "bn"
            ? "ডাটাবেস সেটআপ বাকি — Supabase SQL Editor-এ scripts/landing-page.sql চালান।"
            : "Database setup pending — run scripts/landing-page.sql in the Supabase SQL Editor."}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          {lang === "bn"
            ? "লগইনের আগের পাবলিক ল্যান্ডিং পেজ"
            : "Public landing page before login"}
        </p>
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          title={lang === "bn" ? "ল্যান্ডিং পেজ দেখুন" : "View landing page"}
          aria-label={lang === "bn" ? "ল্যান্ডিং পেজ দেখুন" : "View landing page"}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-rose-600 hover:border-rose-600 hover:text-white transition"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">
            {lang === "bn" ? "ল্যান্ডিং পেজ" : "Landing page"}
          </span>
        </a>
      </div>

      <nav className="flex gap-1 overflow-x-auto no-scrollbar rounded-xl border border-slate-800 bg-slate-950 p-1">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`shrink-0 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              tab === item.id
                ? "bg-rose-600 text-white shadow"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            {lang === "bn" ? item.bn : item.en}
          </button>
        ))}
      </nav>

      {(tab === "general" ||
        tab === "sections" ||
        tab === "hero" ||
        tab === "community" ||
        tab === "cta" ||
        tab === "footer" ||
        tab === "seo") && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => void saveSettings()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {t("save")}
          </button>
        </div>
      )}

      {tab === "general" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <ToggleRow
            title={lang === "bn" ? "ল্যান্ডিং চালু" : "Landing enabled"}
            hint={lang === "bn" ? "বন্ধ থাকলে / → /auth" : "If off, / redirects to /auth"}
            checked={cfg.enabled}
            onChange={(v) => setCfg((p) => ({ ...p, enabled: v }))}
          />
          <Field label={lang === "bn" ? "থিম" : "Theme"}>
            <select
              className={ainp}
              value={cfg.theme}
              onChange={(e) => {
                const theme = e.target.value as LandingTheme;
                setCfg((p) => ({
                  ...p,
                  theme,
                  colors: { ...THEME_PRESETS[theme] },
                }));
              }}
            >
              <option value="life_crimson">Life Crimson</option>
              <option value="night_clinic">Night Clinic</option>
            </select>
          </Field>
          <div className="grid sm:grid-cols-2 gap-2">
            {(
              [
                ["primary", "Primary"],
                ["background", "Background"],
                ["foreground", "Foreground"],
                ["muted", "Muted"],
                ["glass", "Glass"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  className={ainp}
                  value={cfg.colors[key]}
                  onChange={(e) =>
                    setCfg((p) => ({
                      ...p,
                      colors: { ...p.colors, [key]: e.target.value },
                    }))
                  }
                />
              </Field>
            ))}
          </div>
          <ToggleRow
            title={lang === "bn" ? "ভাষা টগল" : "Language toggle"}
            checked={cfg.nav.show_lang_toggle}
            onChange={(v) => setCfg((p) => ({ ...p, nav: { ...p.nav, show_lang_toggle: v } }))}
          />
          <Field label="Logo URL">
            <MediaUrlInput
              value={cfg.nav.logo_url}
              onChange={(url) => setCfg((p) => ({ ...p, nav: { ...p.nav, logo_url: url } }))}
              lang={lang}
            />
          </Field>
          <div className="grid sm:grid-cols-2 gap-2">
            <Field label="Login BN">
              <input
                className={ainp}
                value={cfg.nav.cta_login_bn}
                onChange={(e) => setCfg((p) => ({ ...p, nav: { ...p.nav, cta_login_bn: e.target.value } }))}
              />
            </Field>
            <Field label="Login EN">
              <input
                className={ainp}
                value={cfg.nav.cta_login_en}
                onChange={(e) => setCfg((p) => ({ ...p, nav: { ...p.nav, cta_login_en: e.target.value } }))}
              />
            </Field>
            <Field label="Signup BN">
              <input
                className={ainp}
                value={cfg.nav.cta_signup_bn}
                onChange={(e) => setCfg((p) => ({ ...p, nav: { ...p.nav, cta_signup_bn: e.target.value } }))}
              />
            </Field>
            <Field label="Signup EN">
              <input
                className={ainp}
                value={cfg.nav.cta_signup_en}
                onChange={(e) => setCfg((p) => ({ ...p, nav: { ...p.nav, cta_signup_en: e.target.value } }))}
              />
            </Field>
          </div>
        </div>
      )}

      {tab === "sections" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-2">
          <p className="text-[11px] text-slate-400 mb-2">
            {lang === "bn" ? "ড্র্যাগ নেই — উপরে/নিচে বাটন দিয়ে অর্ডার বদলান।" : "Reorder with up/down. Toggle visibility."}
          </p>
          {cfg.section_order.map((id, idx) => (
            <div
              key={id}
              className="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2"
            >
              <input
                type="checkbox"
                checked={cfg.sections_enabled[id] !== false}
                onChange={(e) =>
                  setCfg((p) => ({
                    ...p,
                    sections_enabled: { ...p.sections_enabled, [id]: e.target.checked },
                  }))
                }
                className="h-4 w-4 accent-rose-500"
              />
              <span className="flex-1 text-xs font-medium">
                {lang === "bn" ? SECTION_LABELS[id].bn : SECTION_LABELS[id].en}
              </span>
              <button type="button" className="p-1 text-slate-400" onClick={() => moveSection(idx, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="p-1 text-slate-400" onClick={() => moveSection(idx, 1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {tab === "hero" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4">
          <div className="grid sm:grid-cols-2 gap-2">
            {(
              [
                ["brand_bn", "Brand BN"],
                ["brand_en", "Brand EN"],
                ["headline_bn", "Headline BN"],
                ["headline_en", "Headline EN"],
                ["sub_bn", "Sub BN"],
                ["sub_en", "Sub EN"],
                ["cta_primary_bn", "Primary CTA BN"],
                ["cta_primary_en", "Primary CTA EN"],
                ["cta_secondary_bn", "Secondary CTA BN"],
                ["cta_secondary_en", "Secondary CTA EN"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  className={ainp}
                  value={cfg.hero[key]}
                  onChange={(e) =>
                    setCfg((p) => ({ ...p, hero: { ...p.hero, [key]: e.target.value } }))
                  }
                />
              </Field>
            ))}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-200">
                {lang === "bn" ? "হিরো ব্যাকগ্রাউন্ড ইমেজ" : "Hero background images"}
              </p>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] font-semibold text-slate-200"
                onClick={() =>
                  setCfg((p) => ({
                    ...p,
                    hero: {
                      ...p.hero,
                      background_images: [...p.hero.background_images, ""],
                    },
                  }))
                }
              >
                <Plus className="h-3 w-3" />
                {lang === "bn" ? "ইমেজ যোগ" : "Add image"}
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              {lang === "bn"
                ? "Google Drive লিংক পেস্ট করুন বা আপলোড করুন। একাধিক ইমেজ smooth স্লাইড হবে।"
                : "Paste Google Drive links or upload. Multiple images rotate with a smooth transition."}
            </p>
            {(cfg.hero.background_images.length ? cfg.hero.background_images : [""]).map((url, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <div className="flex-1 space-y-1">
                  <span className="text-[10px] text-slate-500">
                    {lang === "bn" ? `স্লাইড ${idx + 1}` : `Slide ${idx + 1}`}
                  </span>
                  <MediaUrlInput
                    value={url}
                    onChange={(next) =>
                      setCfg((p) => {
                        const imgs = [...(p.hero.background_images.length ? p.hero.background_images : [""])];
                        imgs[idx] = next;
                        const filtered = imgs.filter(Boolean);
                        return {
                          ...p,
                          hero: {
                            ...p.hero,
                            background_images: imgs,
                            background_url: filtered[0] ?? p.hero.background_url,
                          },
                        };
                      })
                    }
                    lang={lang}
                  />
                </div>
                <div className="flex flex-col gap-1 pt-5">
                  <button
                    type="button"
                    className="p-1 text-slate-400 disabled:opacity-30"
                    disabled={idx === 0}
                    onClick={() =>
                      setCfg((p) => {
                        const imgs = [...p.hero.background_images];
                        [imgs[idx - 1], imgs[idx]] = [imgs[idx], imgs[idx - 1]];
                        return {
                          ...p,
                          hero: {
                            ...p.hero,
                            background_images: imgs,
                            background_url: imgs.find(Boolean) ?? p.hero.background_url,
                          },
                        };
                      })
                    }
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="p-1 text-slate-400 disabled:opacity-30"
                    disabled={idx >= cfg.hero.background_images.length - 1}
                    onClick={() =>
                      setCfg((p) => {
                        const imgs = [...p.hero.background_images];
                        [imgs[idx + 1], imgs[idx]] = [imgs[idx], imgs[idx + 1]];
                        return {
                          ...p,
                          hero: {
                            ...p.hero,
                            background_images: imgs,
                            background_url: imgs.find(Boolean) ?? p.hero.background_url,
                          },
                        };
                      })
                    }
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="p-1 text-rose-400"
                    onClick={() =>
                      setCfg((p) => {
                        const imgs = p.hero.background_images.filter((_, i) => i !== idx);
                        return {
                          ...p,
                          hero: {
                            ...p.hero,
                            background_images: imgs.length ? imgs : [...DEFAULT_LANDING_SETTINGS.hero.background_images],
                            background_url: imgs.find(Boolean) ?? DEFAULT_LANDING_SETTINGS.hero.background_url,
                          },
                        };
                      })
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <details className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
            <summary className="cursor-pointer text-xs font-semibold text-slate-200 select-none">
              {lang === "bn" ? "অ্যাডভান্স স্লাইডশো অপশন" : "Advanced slideshow options"}
            </summary>
            <div className="mt-3 space-y-3">
              <ToggleRow
                title={lang === "bn" ? "স্লাইডশো চালু" : "Slideshow enabled"}
                hint={
                  lang === "bn"
                    ? "২+ ইমেজ থাকলে স্বয়ংক্রিয় রোটেশন"
                    : "Auto-rotate when 2+ images are set"
                }
                checked={cfg.hero.slideshow?.enabled ?? DEFAULT_HERO_SLIDESHOW.enabled}
                onChange={(v) =>
                  setCfg((p) => ({
                    ...p,
                    hero: {
                      ...p.hero,
                      slideshow: { ...(p.hero.slideshow ?? DEFAULT_HERO_SLIDESHOW), enabled: v },
                    },
                  }))
                }
              />
              <div className="grid sm:grid-cols-2 gap-2">
                <Field label={lang === "bn" ? "ইন্টারভাল (সেকেন্ড)" : "Interval (seconds)"}>
                  <input
                    type="number"
                    min={2.5}
                    max={30}
                    step={0.5}
                    className={ainp}
                    value={(cfg.hero.slideshow?.interval_ms ?? DEFAULT_HERO_SLIDESHOW.interval_ms) / 1000}
                    onChange={(e) =>
                      setCfg((p) => ({
                        ...p,
                        hero: {
                          ...p.hero,
                          slideshow: {
                            ...(p.hero.slideshow ?? DEFAULT_HERO_SLIDESHOW),
                            interval_ms: Math.min(30000, Math.max(2500, Number(e.target.value) * 1000)),
                          },
                        },
                      }))
                    }
                  />
                </Field>
                <Field label={lang === "bn" ? "ট্রানজিশন (সেকেন্ড)" : "Transition (seconds)"}>
                  <input
                    type="number"
                    min={0.4}
                    max={4}
                    step={0.1}
                    className={ainp}
                    value={(cfg.hero.slideshow?.transition_ms ?? DEFAULT_HERO_SLIDESHOW.transition_ms) / 1000}
                    onChange={(e) =>
                      setCfg((p) => ({
                        ...p,
                        hero: {
                          ...p.hero,
                          slideshow: {
                            ...(p.hero.slideshow ?? DEFAULT_HERO_SLIDESHOW),
                            transition_ms: Math.min(4000, Math.max(400, Number(e.target.value) * 1000)),
                          },
                        },
                      }))
                    }
                  />
                </Field>
                <Field label={lang === "bn" ? "ট্রানজিশন স্টাইল" : "Transition style"}>
                  <select
                    className={ainp}
                    value={cfg.hero.slideshow?.transition ?? DEFAULT_HERO_SLIDESHOW.transition}
                    onChange={(e) =>
                      setCfg((p) => ({
                        ...p,
                        hero: {
                          ...p.hero,
                          slideshow: {
                            ...(p.hero.slideshow ?? DEFAULT_HERO_SLIDESHOW),
                            transition: e.target.value as "fade" | "crossfade" | "slide",
                          },
                        },
                      }))
                    }
                  >
                    <option value="crossfade">{lang === "bn" ? "ক্রসফেড (স্মুথ)" : "Crossfade (smooth)"}</option>
                    <option value="fade">{lang === "bn" ? "ফেড" : "Fade"}</option>
                    <option value="slide">{lang === "bn" ? "স্লাইড" : "Slide"}</option>
                  </select>
                </Field>
                <Field label={lang === "bn" ? "ওভারলে (%)" : "Overlay darkness (%)"}>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={ainp}
                    value={cfg.hero.slideshow?.overlay_opacity ?? DEFAULT_HERO_SLIDESHOW.overlay_opacity}
                    onChange={(e) =>
                      setCfg((p) => ({
                        ...p,
                        hero: {
                          ...p.hero,
                          slideshow: {
                            ...(p.hero.slideshow ?? DEFAULT_HERO_SLIDESHOW),
                            overlay_opacity: Math.min(100, Math.max(0, Number(e.target.value))),
                          },
                        },
                      }))
                    }
                  />
                </Field>
              </div>
              <ToggleRow
                title={lang === "bn" ? "Ken Burns (জুম)" : "Ken Burns (zoom)"}
                hint={
                  lang === "bn"
                    ? "সূক্ষ্ম জুম — বেশি ইমেজে ল্যাগ হতে পারে"
                    : "Subtle zoom — may cost FPS on slow devices"
                }
                checked={cfg.hero.slideshow?.ken_burns ?? DEFAULT_HERO_SLIDESHOW.ken_burns}
                onChange={(v) =>
                  setCfg((p) => ({
                    ...p,
                    hero: {
                      ...p.hero,
                      slideshow: { ...(p.hero.slideshow ?? DEFAULT_HERO_SLIDESHOW), ken_burns: v },
                    },
                  }))
                }
              />
              <ToggleRow
                title={lang === "bn" ? "হোভারে পজ" : "Pause on hover"}
                checked={cfg.hero.slideshow?.pause_on_hover ?? DEFAULT_HERO_SLIDESHOW.pause_on_hover}
                onChange={(v) =>
                  setCfg((p) => ({
                    ...p,
                    hero: {
                      ...p.hero,
                      slideshow: { ...(p.hero.slideshow ?? DEFAULT_HERO_SLIDESHOW), pause_on_hover: v },
                    },
                  }))
                }
              />
              <ToggleRow
                title={lang === "bn" ? "ডট ইন্ডিকেটর" : "Dot indicators"}
                checked={cfg.hero.slideshow?.show_dots ?? DEFAULT_HERO_SLIDESHOW.show_dots}
                onChange={(v) =>
                  setCfg((p) => ({
                    ...p,
                    hero: {
                      ...p.hero,
                      slideshow: { ...(p.hero.slideshow ?? DEFAULT_HERO_SLIDESHOW), show_dots: v },
                    },
                  }))
                }
              />
            </div>
          </details>

          <Field label={lang === "bn" ? "ব্যাকগ্রাউন্ড ভিডিও URL (ঐচ্ছিক)" : "Background video URL (optional)"}>
            <input
              className={ainp}
              value={cfg.hero.background_video_url}
              placeholder="https://…"
              onChange={(e) =>
                setCfg((p) => ({ ...p, hero: { ...p.hero, background_video_url: e.target.value } }))
              }
            />
            <p className="mt-1 text-[10px] text-slate-500">
              {lang === "bn"
                ? "ভিডিও সেট করলে স্লাইডশো বন্ধ থাকবে"
                : "Video overrides the image slideshow when set"}
            </p>
          </Field>
        </div>
      )}

      {tab === "stats" && (
        <CrudList
          lang={lang}
          busy={busy}
          items={stats}
          onAdd={() =>
            void upsertRow("landing_stats", {
              label_bn: "নতুন",
              label_en: "New",
              value_text: "0",
              icon_key: "droplet",
              source: "manual",
              sort_order: (stats.at(-1)?.sort_order ?? 0) + 10,
              is_active: true,
            })
          }
          renderItem={(s) => (
            <div className="space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <input className={ainp} value={s.label_bn} placeholder="Label BN"
                  onChange={(e) => setStats((p) => p.map((x) => (x.id === s.id ? { ...x, label_bn: e.target.value } : x)))} />
                <input className={ainp} value={s.label_en} placeholder="Label EN"
                  onChange={(e) => setStats((p) => p.map((x) => (x.id === s.id ? { ...x, label_en: e.target.value } : x)))} />
                <input className={ainp} value={s.value_text} placeholder="Value"
                  onChange={(e) => setStats((p) => p.map((x) => (x.id === s.id ? { ...x, value_text: e.target.value } : x)))} />
                <select className={ainp} value={s.source}
                  onChange={(e) => setStats((p) => p.map((x) => (x.id === s.id ? { ...x, source: e.target.value as LandingStat["source"] } : x)))}>
                  <option value="manual">manual</option>
                  <option value="live_requests">live_requests</option>
                  <option value="live_donors">live_donors</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white"
                  onClick={() => void upsertRow("landing_stats", { ...s })}>{t("save")}</button>
                <button type="button" className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] text-rose-300"
                  onClick={() => void removeRow("landing_stats", s.id)}><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          )}
        />
      )}

      {tab === "cards" && (
        <CrudList
          lang={lang}
          busy={busy}
          items={cards}
          onAdd={() =>
            void upsertRow("landing_cards", {
              kind: "how",
              title_bn: "নতুন",
              title_en: "New",
              body_bn: "",
              body_en: "",
              icon_key: "heart",
              sort_order: (cards.at(-1)?.sort_order ?? 0) + 10,
              is_active: true,
            })
          }
          renderItem={(c) => (
            <div className="space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <input className={ainp} value={c.title_bn} placeholder="Title BN"
                  onChange={(e) => setCards((p) => p.map((x) => (x.id === c.id ? { ...x, title_bn: e.target.value } : x)))} />
                <input className={ainp} value={c.title_en} placeholder="Title EN"
                  onChange={(e) => setCards((p) => p.map((x) => (x.id === c.id ? { ...x, title_en: e.target.value } : x)))} />
                <textarea className={ainp} rows={2} value={c.body_bn} placeholder="Body BN"
                  onChange={(e) => setCards((p) => p.map((x) => (x.id === c.id ? { ...x, body_bn: e.target.value } : x)))} />
                <textarea className={ainp} rows={2} value={c.body_en} placeholder="Body EN"
                  onChange={(e) => setCards((p) => p.map((x) => (x.id === c.id ? { ...x, body_en: e.target.value } : x)))} />
                <input className={ainp} value={c.icon_key} placeholder="icon_key"
                  onChange={(e) => setCards((p) => p.map((x) => (x.id === c.id ? { ...x, icon_key: e.target.value } : x)))} />
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white"
                  onClick={() => void upsertRow("landing_cards", { ...c })}>{t("save")}</button>
                <button type="button" className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] text-rose-300"
                  onClick={() => void removeRow("landing_cards", c.id)}><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          )}
        />
      )}

      {tab === "carousel" && (
        <SlideAdmin
          lang={lang}
          busy={busy}
          slides={slides}
          setSlides={setSlides}
          onSave={(s) => void upsertRow("landing_carousel_slides", { ...s, image_url: resolveCarouselImageUrl(s.image_url) })}
          onRemove={(id) => void removeRow("landing_carousel_slides", id)}
          onAdd={(kind) =>
            void upsertRow("landing_carousel_slides", {
              kind,
              image_url: "",
              title_bn: "স্লাইড",
              title_en: "Slide",
              body_bn: "",
              body_en: "",
              sort_order: (slides.at(-1)?.sort_order ?? 0) + 10,
              is_active: true,
            })
          }
        />
      )}

      {tab === "campaigns" && (
        <CrudList
          lang={lang}
          busy={busy}
          items={campaigns}
          onAdd={() =>
            void upsertRow("landing_campaigns", {
              title_bn: "ক্যাম্পেইন",
              title_en: "Campaign",
              body_bn: "",
              body_en: "",
              cta_bn: "যোগ দিন",
              cta_en: "Join",
              cta_href: "/auth",
              sort_order: (campaigns.at(-1)?.sort_order ?? 0) + 10,
              is_active: true,
            })
          }
          renderItem={(c) => (
            <div className="space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <input className={ainp} value={c.title_bn}
                  onChange={(e) => setCampaigns((p) => p.map((x) => (x.id === c.id ? { ...x, title_bn: e.target.value } : x)))} />
                <input className={ainp} value={c.title_en}
                  onChange={(e) => setCampaigns((p) => p.map((x) => (x.id === c.id ? { ...x, title_en: e.target.value } : x)))} />
                <textarea className={ainp} rows={2} value={c.body_bn}
                  onChange={(e) => setCampaigns((p) => p.map((x) => (x.id === c.id ? { ...x, body_bn: e.target.value } : x)))} />
                <textarea className={ainp} rows={2} value={c.body_en}
                  onChange={(e) => setCampaigns((p) => p.map((x) => (x.id === c.id ? { ...x, body_en: e.target.value } : x)))} />
              </div>
              <MediaUrlInput
                value={c.cover_url ?? ""}
                onChange={(url) => setCampaigns((p) => p.map((x) => (x.id === c.id ? { ...x, cover_url: url } : x)))}
                lang={lang}
              />
              <div className="flex gap-2">
                <button type="button" disabled={busy} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white"
                  onClick={() => void upsertRow("landing_campaigns", { ...c })}>{t("save")}</button>
                <button type="button" className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] text-rose-300"
                  onClick={() => void removeRow("landing_campaigns", c.id)}><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          )}
        />
      )}

      {tab === "gallery" && (
        <CrudList
          lang={lang}
          busy={busy}
          items={gallery}
          onAdd={() =>
            void upsertRow("landing_gallery", {
              image_url: "",
              caption_bn: "",
              caption_en: "",
              sort_order: (gallery.at(-1)?.sort_order ?? 0) + 10,
              is_active: true,
            })
          }
          renderItem={(g) => (
            <div className="space-y-2">
              <MediaUrlInput
                value={g.image_url}
                onChange={(url) => setGallery((p) => p.map((x) => (x.id === g.id ? { ...x, image_url: url } : x)))}
                lang={lang}
              />
              <div className="grid sm:grid-cols-2 gap-2">
                <input className={ainp} value={g.caption_bn} placeholder="Caption BN"
                  onChange={(e) => setGallery((p) => p.map((x) => (x.id === g.id ? { ...x, caption_bn: e.target.value } : x)))} />
                <input className={ainp} value={g.caption_en} placeholder="Caption EN"
                  onChange={(e) => setGallery((p) => p.map((x) => (x.id === g.id ? { ...x, caption_en: e.target.value } : x)))} />
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white"
                  onClick={() => void upsertRow("landing_gallery", { ...g, image_url: resolveCarouselImageUrl(g.image_url) })}>{t("save")}</button>
                <button type="button" className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] text-rose-300"
                  onClick={() => void removeRow("landing_gallery", g.id)}><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          )}
        />
      )}

      {tab === "community" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
            <div className="grid sm:grid-cols-2 gap-2">
              {(
                [
                  ["title_bn", "Title BN"],
                  ["title_en", "Title EN"],
                  ["body_bn", "Body BN"],
                  ["body_en", "Body EN"],
                  ["cta_bn", "CTA BN"],
                  ["cta_en", "CTA EN"],
                ] as const
              ).map(([key, label]) => (
                <Field key={key} label={label}>
                  <input
                    className={ainp}
                    value={cfg.community[key]}
                    onChange={(e) =>
                      setCfg((p) => ({
                        ...p,
                        community: { ...p.community, [key]: e.target.value },
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
            <Field label="Background URL">
              <MediaUrlInput
                value={cfg.community.background_url}
                onChange={(url) =>
                  setCfg((p) => ({ ...p, community: { ...p.community, background_url: url } }))
                }
                lang={lang}
              />
            </Field>
          </div>
          <CrudList
            lang={lang}
            busy={busy}
            items={communityCards}
            onAdd={() =>
              void upsertRow("landing_community_cards", {
                title_bn: "সংস্থা",
                title_en: "Org",
                body_bn: "",
                body_en: "",
                sort_order: (communityCards.at(-1)?.sort_order ?? 0) + 10,
                is_active: true,
              })
            }
            renderItem={(c) => (
              <div className="space-y-2">
                <div className="grid sm:grid-cols-2 gap-2">
                  <input className={ainp} value={c.title_bn}
                    onChange={(e) => setCommunityCards((p) => p.map((x) => (x.id === c.id ? { ...x, title_bn: e.target.value } : x)))} />
                  <input className={ainp} value={c.title_en}
                    onChange={(e) => setCommunityCards((p) => p.map((x) => (x.id === c.id ? { ...x, title_en: e.target.value } : x)))} />
                  <textarea className={ainp} rows={2} value={c.body_bn}
                    onChange={(e) => setCommunityCards((p) => p.map((x) => (x.id === c.id ? { ...x, body_bn: e.target.value } : x)))} />
                  <textarea className={ainp} rows={2} value={c.body_en}
                    onChange={(e) => setCommunityCards((p) => p.map((x) => (x.id === c.id ? { ...x, body_en: e.target.value } : x)))} />
                </div>
                <div className="flex gap-2">
                  <button type="button" disabled={busy} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white"
                    onClick={() => void upsertRow("landing_community_cards", { ...c })}>{t("save")}</button>
                  <button type="button" className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] text-rose-300"
                    onClick={() => void removeRow("landing_community_cards", c.id)}><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            )}
          />
        </div>
      )}

      {tab === "faq" && (
        <CrudList
          lang={lang}
          busy={busy}
          items={faqs}
          onAdd={() =>
            void upsertRow("landing_faqs", {
              question_bn: "প্রশ্ন?",
              question_en: "Question?",
              answer_bn: "",
              answer_en: "",
              sort_order: (faqs.at(-1)?.sort_order ?? 0) + 10,
              is_active: true,
            })
          }
          renderItem={(f) => (
            <div className="space-y-2">
              <div className="grid sm:grid-cols-2 gap-2">
                <input className={ainp} value={f.question_bn}
                  onChange={(e) => setFaqs((p) => p.map((x) => (x.id === f.id ? { ...x, question_bn: e.target.value } : x)))} />
                <input className={ainp} value={f.question_en}
                  onChange={(e) => setFaqs((p) => p.map((x) => (x.id === f.id ? { ...x, question_en: e.target.value } : x)))} />
                <textarea className={ainp} rows={2} value={f.answer_bn}
                  onChange={(e) => setFaqs((p) => p.map((x) => (x.id === f.id ? { ...x, answer_bn: e.target.value } : x)))} />
                <textarea className={ainp} rows={2} value={f.answer_en}
                  onChange={(e) => setFaqs((p) => p.map((x) => (x.id === f.id ? { ...x, answer_en: e.target.value } : x)))} />
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white"
                  onClick={() => void upsertRow("landing_faqs", { ...f })}>{t("save")}</button>
                <button type="button" className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] text-rose-300"
                  onClick={() => void removeRow("landing_faqs", f.id)}><Trash2 className="h-3 w-3" /></button>
              </div>
            </div>
          )}
        />
      )}

      {tab === "cta" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            {(
              [
                ["title_bn", "Title BN"],
                ["title_en", "Title EN"],
                ["body_bn", "Body BN"],
                ["body_en", "Body EN"],
                ["primary_bn", "Primary BN"],
                ["primary_en", "Primary EN"],
                ["secondary_bn", "Secondary BN"],
                ["secondary_en", "Secondary EN"],
                ["secondary_href", "Secondary href"],
              ] as const
            ).map(([key, label]) => (
              <Field key={key} label={label}>
                <input
                  className={ainp}
                  value={cfg.cta_band[key]}
                  onChange={(e) =>
                    setCfg((p) => ({ ...p, cta_band: { ...p.cta_band, [key]: e.target.value } }))
                  }
                />
              </Field>
            ))}
          </div>
          <Field label="Background URL">
            <MediaUrlInput
              value={cfg.cta_band.background_url}
              onChange={(url) =>
                setCfg((p) => ({ ...p, cta_band: { ...p.cta_band, background_url: url } }))
              }
              lang={lang}
            />
          </Field>
        </div>
      )}

      {tab === "footer" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="grid sm:grid-cols-2 gap-2">
            <Field label="Copyright BN">
              <input
                className={ainp}
                value={cfg.footer.copyright_bn}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, footer: { ...p.footer, copyright_bn: e.target.value } }))
                }
              />
            </Field>
            <Field label="Copyright EN">
              <input
                className={ainp}
                value={cfg.footer.copyright_en}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, footer: { ...p.footer, copyright_en: e.target.value } }))
                }
              />
            </Field>
            <Field label="Hotline">
              <input
                className={ainp}
                value={cfg.footer.hotline}
                onChange={(e) =>
                  setCfg((p) => ({ ...p, footer: { ...p.footer, hotline: e.target.value } }))
                }
              />
            </Field>
          </div>
          <p className="text-[10px] text-slate-500">
            {lang === "bn"
              ? "ফুটার কলাম JSON এডিট — সেভ করলে সেটিংসে যায়।"
              : "Footer columns are edited via the seeded defaults; extend in General if needed."}
          </p>
        </div>
      )}

      {tab === "seo" && (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <p className="text-xs text-slate-400 leading-relaxed">
            {lang === "bn"
              ? "সাইট-wide SEO এখন Admin → Settings → SEO-তে পরিচালিত হয়। Title, description, OG image, robots, sitemap, verification — সব এক জায়গায়।"
              : "Site-wide SEO is now managed under Admin → Settings → SEO. Title, description, OG image, robots, sitemap, and verification live there."}
          </p>
          <p className="text-[10px] text-slate-500">
            {lang === "bn"
              ? "Settings ট্যাবে SEO খুলুন — সম্পূর্ণ গাইড বাটন সহ।"
              : "Open the SEO tab under Settings — includes the full SEO guide button."}
          </p>
        </div>
      )}
    </div>
  );
}

function MediaUrlInput({
  value,
  onChange,
  lang,
}: {
  value: string;
  onChange: (url: string) => void;
  lang: "bn" | "en";
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className="flex gap-2">
      <input
        className={ainp}
        value={value}
        placeholder="https://… or Drive link"
        onChange={(e) => {
          const v = e.target.value;
          onChange(isGoogleDriveUrl(v) ? resolveCarouselImageUrl(v) : v);
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => void pickUpload(e.target.files?.[0], onChange, lang)}
      />
      <button
        type="button"
        className="shrink-0 rounded-lg border border-slate-700 px-2.5 py-1.5 text-slate-300"
        onClick={() => fileRef.current?.click()}
      >
        <Upload className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function CrudList<T extends { id: string }>({
  lang,
  busy,
  items,
  onAdd,
  renderItem,
}: {
  lang: "bn" | "en";
  busy: boolean;
  items: T[];
  onAdd: () => void;
  renderItem: (item: T) => ReactNode;
}) {
  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={busy}
        onClick={onAdd}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
      >
        <Plus className="h-3.5 w-3.5" />
        {lang === "bn" ? "যোগ করুন" : "Add"}
      </button>
      {items.map((item) => (
        <div key={item.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3">
          {renderItem(item)}
        </div>
      ))}
      {!items.length && (
        <p className="text-xs text-slate-500 px-1">
          {lang === "bn" ? "কোনো আইটেম নেই" : "No items yet"}
        </p>
      )}
    </div>
  );
}

function SlideAdmin({
  lang,
  busy,
  slides,
  setSlides,
  onSave,
  onRemove,
  onAdd,
}: {
  lang: "bn" | "en";
  busy: boolean;
  slides: LandingSlide[];
  setSlides: Dispatch<SetStateAction<LandingSlide[]>>;
  onSave: (s: LandingSlide) => void;
  onRemove: (id: string) => void;
  onAdd: (kind: "main" | "stories") => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => onAdd("main")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" />
          Main
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onAdd("stories")}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold"
        >
          <Plus className="h-3.5 w-3.5" />
          Stories
        </button>
      </div>
      {slides.map((s) => (
        <div key={s.id} className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
          <p className="text-[10px] text-slate-500 uppercase">{s.kind}</p>
          <MediaUrlInput
            value={s.image_url}
            onChange={(url) => setSlides((p) => p.map((x) => (x.id === s.id ? { ...x, image_url: url } : x)))}
            lang={lang}
          />
          <div className="grid sm:grid-cols-2 gap-2">
            <input className={ainp} value={s.title_bn}
              onChange={(e) => setSlides((p) => p.map((x) => (x.id === s.id ? { ...x, title_bn: e.target.value } : x)))} />
            <input className={ainp} value={s.title_en}
              onChange={(e) => setSlides((p) => p.map((x) => (x.id === s.id ? { ...x, title_en: e.target.value } : x)))} />
            <textarea className={ainp} rows={2} value={s.body_bn}
              onChange={(e) => setSlides((p) => p.map((x) => (x.id === s.id ? { ...x, body_bn: e.target.value } : x)))} />
            <textarea className={ainp} rows={2} value={s.body_en}
              onChange={(e) => setSlides((p) => p.map((x) => (x.id === s.id ? { ...x, body_en: e.target.value } : x)))} />
          </div>
          <div className="flex gap-2">
            <button type="button" disabled={busy} className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[10px] font-semibold text-white"
              onClick={() => onSave(s)}>
              Save
            </button>
            <button type="button" className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-[10px] text-rose-300"
              onClick={() => onRemove(s.id)}>
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
