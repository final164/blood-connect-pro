import { useEffect, useState, type ReactNode } from "react";
import { BookOpen, Plus, RotateCcw, Save, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_SEO_SETTINGS,
  fetchSeoSettings,
  invalidateSeoSettingsCache,
  saveSeoSettings,
  type SeoSettings,
} from "@/lib/seo-settings";
import { SEO_GUIDE_BN, SEO_GUIDE_EN } from "@/lib/seo-guide";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/40 placeholder:text-slate-500";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-medium text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2 text-xs">
      <span className="text-slate-300">{label}</span>
      <input type="checkbox" className="h-4 w-4 accent-rose-500" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function SeoAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const [s, setS] = useState<SeoSettings>({ ...DEFAULT_SEO_SETTINGS });
  const [busy, setBusy] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [extraPath, setExtraPath] = useState("");
  const [sameAsInput, setSameAsInput] = useState("");

  useEffect(() => {
    void fetchSeoSettings(true).then(setS);
  }, []);

  async function save() {
    if (!can("settings.edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    setBusy(true);
    try {
      await saveSeoSettings(s);
      invalidateSeoSettingsCache();
      toast.success(lang === "bn" ? "SEO সেটিংস সেভ হয়েছে" : "SEO settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function resetDefaults() {
    if (!confirm(lang === "bn" ? "ডিফল্ট SEO-তে ফিরে যাবেন?" : "Reset to default SEO?")) return;
    setS({ ...DEFAULT_SEO_SETTINGS });
    toast.message(lang === "bn" ? "ডিফল্ট লোড — সেভ করুন" : "Defaults loaded — click Save");
  }

  function addExtraPath() {
    const p = extraPath.trim();
    if (!p) return;
    setS((prev) => ({
      ...prev,
      sitemap_extra_paths: [...new Set([...prev.sitemap_extra_paths, p.startsWith("/") ? p : `/${p}`])],
    }));
    setExtraPath("");
  }

  function addSameAs() {
    const url = sameAsInput.trim();
    if (!url) return;
    setS((prev) => ({
      ...prev,
      org_same_as: [...new Set([...prev.org_same_as, url])],
    }));
    setSameAsInput("");
  }

  const guide = lang === "bn" ? SEO_GUIDE_BN : SEO_GUIDE_EN;

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900"
        >
          <BookOpen className="h-3.5 w-3.5" />
          {lang === "bn" ? "সম্পূর্ণ SEO গাইড" : "Full SEO guide"}
        </button>
        {can("settings.edit") && (
          <>
            <button
              type="button"
              onClick={resetDefaults}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {lang === "bn" ? "ডিফল্ট" : "Reset defaults"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={save}
              className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {busy ? "…" : lang === "bn" ? "সেভ" : "Save"}
            </button>
          </>
        )}
      </div>

      <Section title={lang === "bn" ? "মৌলিক SEO" : "Basic SEO"}>
        <Field label={lang === "bn" ? "সাইট URL" : "Site URL"}>
          <input
            className={ainp}
            placeholder="https://bloodlink.example.com"
            value={s.site_url}
            onChange={(e) => setS({ ...s, site_url: e.target.value })}
          />
        </Field>
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Title BN">
            <input className={ainp} value={s.title_bn} onChange={(e) => setS({ ...s, title_bn: e.target.value })} />
          </Field>
          <Field label="Title EN">
            <input className={ainp} value={s.title_en} onChange={(e) => setS({ ...s, title_en: e.target.value })} />
          </Field>
          <Field label={lang === "bn" ? "Title টেমপ্লেট" : "Title template"}>
            <input
              className={ainp}
              placeholder="%s — BloodLink"
              value={s.title_template}
              onChange={(e) => setS({ ...s, title_template: e.target.value })}
            />
          </Field>
          <Field label="Canonical URL">
            <input
              className={ainp}
              placeholder="/"
              value={s.canonical_url}
              onChange={(e) => setS({ ...s, canonical_url: e.target.value })}
            />
          </Field>
          <Field label="Description BN">
            <textarea
              className={`${ainp} min-h-[80px]`}
              value={s.description_bn}
              onChange={(e) => setS({ ...s, description_bn: e.target.value })}
            />
          </Field>
          <Field label="Description EN">
            <textarea
              className={`${ainp} min-h-[80px]`}
              value={s.description_en}
              onChange={(e) => setS({ ...s, description_en: e.target.value })}
            />
          </Field>
          <Field label="Keywords BN">
            <textarea
              className={`${ainp} min-h-[60px]`}
              value={s.keywords_bn}
              onChange={(e) => setS({ ...s, keywords_bn: e.target.value })}
            />
          </Field>
          <Field label="Keywords EN">
            <textarea
              className={`${ainp} min-h-[60px]`}
              value={s.keywords_en}
              onChange={(e) => setS({ ...s, keywords_en: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="Open Graph">
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="OG Title BN">
            <input className={ainp} value={s.og_title_bn} onChange={(e) => setS({ ...s, og_title_bn: e.target.value })} />
          </Field>
          <Field label="OG Title EN">
            <input className={ainp} value={s.og_title_en} onChange={(e) => setS({ ...s, og_title_en: e.target.value })} />
          </Field>
          <Field label="OG Description BN">
            <textarea
              className={`${ainp} min-h-[60px]`}
              value={s.og_description_bn}
              onChange={(e) => setS({ ...s, og_description_bn: e.target.value })}
            />
          </Field>
          <Field label="OG Description EN">
            <textarea
              className={`${ainp} min-h-[60px]`}
              value={s.og_description_en}
              onChange={(e) => setS({ ...s, og_description_en: e.target.value })}
            />
          </Field>
          <Field label="OG Image URL">
            <input
              className={ainp}
              placeholder="/icon-512.png"
              value={s.og_image_url}
              onChange={(e) => setS({ ...s, og_image_url: e.target.value })}
            />
          </Field>
          <Field label="OG Type">
            <input className={ainp} value={s.og_type} onChange={(e) => setS({ ...s, og_type: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title="Twitter">
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Twitter Card">
            <select
              className={ainp}
              value={s.twitter_card}
              onChange={(e) =>
                setS({ ...s, twitter_card: e.target.value as SeoSettings["twitter_card"] })
              }
            >
              <option value="summary">summary</option>
              <option value="summary_large_image">summary_large_image</option>
            </select>
          </Field>
          <Field label="Twitter Image URL">
            <input
              className={ainp}
              value={s.twitter_image_url}
              onChange={(e) => setS({ ...s, twitter_image_url: e.target.value })}
            />
          </Field>
          <Field label="Twitter Title">
            <input className={ainp} value={s.twitter_title} onChange={(e) => setS({ ...s, twitter_title: e.target.value })} />
          </Field>
          <Field label="Twitter Description">
            <textarea
              className={`${ainp} min-h-[60px]`}
              value={s.twitter_description}
              onChange={(e) => setS({ ...s, twitter_description: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title={lang === "bn" ? "Robots ও Hreflang" : "Robots & Hreflang"}>
        <div className="space-y-2">
          <ToggleRow
            label={lang === "bn" ? "Index (robots index)" : "Allow indexing"}
            checked={s.robots_index}
            onChange={(v) => setS({ ...s, robots_index: v })}
          />
          <ToggleRow
            label={lang === "bn" ? "Follow links" : "Follow links"}
            checked={s.robots_follow}
            onChange={(v) => setS({ ...s, robots_follow: v })}
          />
        </div>
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Hreflang BN path">
            <input className={ainp} value={s.hreflang_bn} onChange={(e) => setS({ ...s, hreflang_bn: e.target.value })} />
          </Field>
          <Field label="Hreflang EN path">
            <input className={ainp} value={s.hreflang_en} onChange={(e) => setS({ ...s, hreflang_en: e.target.value })} />
          </Field>
        </div>
      </Section>

      <Section title={lang === "bn" ? "Verification" : "Verification"}>
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label="Google Site Verification">
            <input
              className={ainp}
              value={s.google_site_verification}
              onChange={(e) => setS({ ...s, google_site_verification: e.target.value })}
            />
          </Field>
          <Field label="Bing Site Verification">
            <input
              className={ainp}
              value={s.bing_site_verification}
              onChange={(e) => setS({ ...s, bing_site_verification: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title="JSON-LD">
        <ToggleRow
          label={lang === "bn" ? "Organization schema চালু" : "Enable Organization schema"}
          checked={s.json_ld_enabled}
          onChange={(v) => setS({ ...s, json_ld_enabled: v })}
        />
        <div className="grid sm:grid-cols-2 gap-2">
          <Field label={lang === "bn" ? "সংস্থার নাম" : "Organization name"}>
            <input className={ainp} value={s.org_name} onChange={(e) => setS({ ...s, org_name: e.target.value })} />
          </Field>
          <Field label={lang === "bn" ? "ফোন" : "Phone"}>
            <input className={ainp} value={s.org_phone} onChange={(e) => setS({ ...s, org_phone: e.target.value })} />
          </Field>
          <Field label="Logo URL">
            <input className={ainp} value={s.org_logo_url} onChange={(e) => setS({ ...s, org_logo_url: e.target.value })} />
          </Field>
        </div>
        <Field label={lang === "bn" ? "Social profiles (sameAs)" : "Social profiles (sameAs)"}>
          <div className="flex gap-2">
            <input
              className={ainp}
              placeholder="https://facebook.com/..."
              value={sameAsInput}
              onChange={(e) => setSameAsInput(e.target.value)}
            />
            <button type="button" onClick={addSameAs} className="shrink-0 rounded-lg bg-slate-800 px-2.5 text-slate-200">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {s.org_same_as.map((url) => (
              <li key={url} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 px-2 py-1 text-xs">
                <span className="truncate text-slate-300">{url}</span>
                <button
                  type="button"
                  onClick={() => setS({ ...s, org_same_as: s.org_same_as.filter((x) => x !== url) })}
                  className="text-rose-400"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </Field>
      </Section>

      <Section title={lang === "bn" ? "Sitemap ও robots.txt" : "Sitemap & robots.txt"}>
        <ToggleRow
          label={lang === "bn" ? "Sitemap চালু" : "Enable sitemap"}
          checked={s.sitemap_enabled}
          onChange={(v) => setS({ ...s, sitemap_enabled: v })}
        />
        <p className="text-[10px] text-slate-500">
          {lang === "bn"
            ? "লাইভ: /sitemap.xml ও /robots.txt — Site URL সেট করলে Sitemap লিংক সঠিক হবে।"
            : "Live endpoints: /sitemap.xml and /robots.txt — set Site URL for correct sitemap links."}
        </p>
        <Field label={lang === "bn" ? "Extra sitemap paths" : "Extra sitemap paths"}>
          <div className="flex gap-2">
            <input
              className={ainp}
              placeholder="/about"
              value={extraPath}
              onChange={(e) => setExtraPath(e.target.value)}
            />
            <button type="button" onClick={addExtraPath} className="shrink-0 rounded-lg bg-slate-800 px-2.5 text-slate-200">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <ul className="mt-2 flex flex-wrap gap-1">
            {s.sitemap_extra_paths.map((p) => (
              <li
                key={p}
                className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300"
              >
                {p}
                <button
                  type="button"
                  onClick={() =>
                    setS({ ...s, sitemap_extra_paths: s.sitemap_extra_paths.filter((x) => x !== p) })
                  }
                  className="text-rose-400"
                >
                  <X className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        </Field>
        <Field label="robots.txt (custom)">
          <textarea
            className={`${ainp} min-h-[120px] font-mono text-xs`}
            placeholder={lang === "bn" ? "খালি = ডিফল্ট robots.txt" : "Empty = default robots.txt"}
            value={s.robots_txt}
            onChange={(e) => setS({ ...s, robots_txt: e.target.value })}
          />
        </Field>
      </Section>

      <Drawer open={guideOpen} onOpenChange={setGuideOpen}>
        <DrawerContent className="max-h-[92dvh] bg-slate-950 border-slate-800 text-slate-100">
          <DrawerHeader className="border-b border-slate-800">
            <DrawerTitle>{guide.title}</DrawerTitle>
            <DrawerClose className="absolute right-4 top-4 rounded-md p-1 text-slate-400 hover:text-slate-200">
              <X className="h-4 w-4" />
            </DrawerClose>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-8 pt-2 space-y-5 text-sm">
            <p className="text-slate-300 leading-relaxed">{guide.intro}</p>
            <div>
              <h4 className="font-semibold text-rose-300 mb-2">
                {lang === "bn" ? "চেকলিস্ট" : "Checklist"}
              </h4>
              <ul className="list-disc pl-5 space-y-1 text-slate-300 text-xs">
                {guide.checklist.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            {guide.sections.map((sec) => (
              <div key={sec.title}>
                <h4 className="font-semibold text-slate-100 mb-1">{sec.title}</h4>
                {sec.body.map((p) => (
                  <p key={p} className="text-xs text-slate-400 leading-relaxed mb-1">
                    {p}
                  </p>
                ))}
                {sec.bullets && (
                  <ul className="list-disc pl-5 space-y-0.5 text-xs text-slate-400 mt-1">
                    {sec.bullets.map((b) => (
                      <li key={b}>{b}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
