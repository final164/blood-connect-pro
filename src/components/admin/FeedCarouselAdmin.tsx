import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Link2,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { CarouselRemoteImage } from "@/components/feed/CarouselRemoteImage";
import { fetchDistricts, type District } from "@/lib/api";
import {
  DEFAULT_FEED_CAROUSEL_SETTINGS,
  deleteFeedCarouselSlide,
  fetchAllFeedCarouselSlides,
  fetchFeedCarouselSettings,
  invalidateFeedCarouselCache,
  isGoogleDriveUrl,
  normalizeFeedCarouselSettings,
  reorderFeedCarouselSlides,
  resolveCarouselImageUrl,
  saveFeedCarouselSettings,
  uploadFeedCarouselImage,
  upsertFeedCarouselSlide,
  type FeedCarouselSettings,
  type FeedCarouselSlide,
} from "@/lib/feed-carousel";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

function ToggleRow({
  title,
  hint,
  checked,
  onChange,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 px-3 py-2.5">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">{hint}</p>
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

function emptyDraft(sortOrder: number): Omit<FeedCarouselSlide, "id"> & { id?: string } {
  return {
    image_url: "",
    title_bn: "",
    title_en: "",
    link_url: null,
    district_id: null,
    sort_order: sortOrder,
    is_active: true,
  };
}

export function FeedCarouselAdmin() {
  const { lang, t } = useI18n();
  const { can } = useAdminAccess();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cfg, setCfg] = useState<FeedCarouselSettings>(DEFAULT_FEED_CAROUSEL_SETTINGS);
  const [slides, setSlides] = useState<FeedCarouselSlide[]>([]);
  const [draft, setDraft] = useState(emptyDraft(10));
  const [uploadForId, setUploadForId] = useState<string | "new">("new");
  const [busy, setBusy] = useState(false);
  const [schemaHint, setSchemaHint] = useState(false);
  const [draftDistrict, setDraftDistrict] = useState<District | null>(null);
  const [districtById, setDistrictById] = useState<Record<string, District>>({});

  async function reload() {
    const settings = await fetchFeedCarouselSettings(true);
    setCfg(settings);
    const { slides: rows, error } = await fetchAllFeedCarouselSlides();
    if (error) {
      if (/feed_carousel|relation|column|schema/i.test(error.message)) {
        setSchemaHint(true);
      }
      toast.error(error.message);
      return;
    }
    setSchemaHint(false);
    setSlides(rows);
    setDraft(emptyDraft((rows.at(-1)?.sort_order ?? 0) + 10));
    setDraftDistrict(null);
    const ids = [...new Set(rows.map((s) => s.district_id).filter(Boolean))] as string[];
    if (ids.length) {
      const all = await fetchDistricts();
      const map: Record<string, District> = {};
      for (const d of all) {
        if (ids.includes(d.id)) map[d.id] = d;
      }
      setDistrictById((prev) => ({ ...prev, ...map }));
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function setFlag<K extends keyof FeedCarouselSettings>(key: K, value: FeedCarouselSettings[K]) {
    setCfg((p) => ({ ...p, [key]: value }));
  }

  async function saveSettings() {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    setBusy(true);
    const { error, settings } = await saveFeedCarouselSettings(cfg);
    setBusy(false);
    if (error) {
      if (/feed_carousel_settings|column/i.test(error.message)) {
        setSchemaHint(true);
        return toast.error(
          lang === "bn"
            ? "আগে scripts/feed-carousel.sql চালান"
            : "Run scripts/feed-carousel.sql first",
        );
      }
      return toast.error(error.message);
    }
    setCfg(settings);
    invalidateFeedCarouselCache();
    toast.success(t("saved"));
  }

  async function saveSlide(slide: Partial<FeedCarouselSlide> & { image_url: string }) {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    if (!slide.image_url.trim()) {
      return toast.error(lang === "bn" ? "ইমেজ URL বা আপলোড দিন" : "Provide an image URL or upload");
    }
    setBusy(true);
    const { error } = await upsertFeedCarouselSlide({
      ...slide,
      image_url: resolveCarouselImageUrl(slide.image_url),
    });
    setBusy(false);
    if (error) {
      if (/feed_carousel|relation|schema/i.test(error.message)) {
        setSchemaHint(true);
        return toast.error(
          lang === "bn"
            ? "আগে scripts/feed-carousel.sql চালান"
            : "Run scripts/feed-carousel.sql first",
        );
      }
      return toast.error(error.message);
    }
    toast.success(lang === "bn" ? "স্লাইড সেভ হয়েছে" : "Slide saved");
    await reload();
  }

  async function removeSlide(id: string) {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    if (!confirm(lang === "bn" ? "এই ইমেজ ডিলিট?" : "Delete this image?")) return;
    setBusy(true);
    const { error } = await deleteFeedCarouselSlide(id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "ডিলিট হয়েছে" : "Deleted");
    await reload();
  }

  async function moveSlide(id: string, dir: -1 | 1) {
    const idx = slides.findIndex((s) => s.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= slides.length) return;
    const next = [...slides];
    const tmp = next[idx]!;
    next[idx] = next[j]!;
    next[j] = tmp;
    setSlides(next);
    setBusy(true);
    const { error } = await reorderFeedCarouselSlides(next.map((s) => s.id));
    setBusy(false);
    if (error) {
      toast.error(error.message);
      await reload();
    }
  }

  async function onFilePicked(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return toast.error(lang === "bn" ? "শুধু ইমেজ ফাইল" : "Images only");
    }
    if (file.size > 5 * 1024 * 1024) {
      return toast.error(lang === "bn" ? "সর্বোচ্চ ৫ MB" : "Max 5 MB");
    }
    setBusy(true);
    const { url, error } = await uploadFeedCarouselImage(file);
    setBusy(false);
    if (error || !url) {
      if (/bucket|policy|storage|not found/i.test(error?.message ?? "")) {
        setSchemaHint(true);
      }
      return toast.error(error?.message ?? "Upload failed");
    }
    if (uploadForId === "new") {
      setDraft((d) => ({ ...d, image_url: url }));
    } else {
      const target = slides.find((s) => s.id === uploadForId);
      if (target) {
        await saveSlide({ ...target, image_url: url });
      }
    }
    toast.success(lang === "bn" ? "আপলোড হয়েছে" : "Uploaded");
  }

  function patchSlideLocal(id: string, patch: Partial<FeedCarouselSlide>) {
    setSlides((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  return (
    <div className="space-y-4 max-w-3xl">
      {schemaHint && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          {lang === "bn"
            ? "ডাটাবেস সেটআপ বাকি — scripts/feed-carousel.sql এবং scripts/feed-carousel-district.sql চালান।"
            : "Database setup pending — run scripts/feed-carousel.sql and scripts/feed-carousel-district.sql."}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">
              {lang === "bn" ? "ফিড ইমেজ ক্যারোজেল" : "Feed image carousel"}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {lang === "bn"
                ? "প্রথম Nটি পোস্টের পর একবার হরাইজন্টাল ইমেজ স্লাইডার দেখাবে।"
                : "Shows a horizontal image slider once after the first N posts."}
            </p>
          </div>
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

        <ToggleRow
          title={lang === "bn" ? "ফিডে দেখাও" : "Show in feed"}
          hint={lang === "bn" ? "বন্ধ করলে ক্যারোজেল লুকানো থাকবে" : "Hide the carousel when off"}
          checked={cfg.enabled}
          onChange={(v) => setFlag("enabled", v)}
        />
        <ToggleRow
          title={lang === "bn" ? "কমিউনিটিতে দেখাও" : "Show on community"}
          hint={
            lang === "bn"
              ? "Save request বাটনের নিচে হাইলাইটস"
              : "Highlights under the save-request button"
          }
          checked={cfg.show_on_community}
          onChange={(v) => setFlag("show_on_community", v)}
        />
        <ToggleRow
          title={lang === "bn" ? "কমিউনিটিতে জেলাভিত্তিক ফিল্টার" : "Community district filter"}
          hint={
            lang === "bn"
              ? "প্রোফাইল → সার্চ → Save request জেলা অনুযায়ী স্লাইড"
              : "Slides by profile → search → save-request district"
          }
          checked={cfg.community_district_filter}
          onChange={(v) => setFlag("community_district_filter", v)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500">
              {lang === "bn" ? "প্রথম কয়টি পোস্টের পর (একবার)" : "Once after first N posts"}
            </label>
            <input
              type="number"
              min={1}
              max={20}
              className={ainp}
              value={cfg.insert_after_every}
              onChange={(e) => setFlag("insert_after_every", Number(e.target.value) || 2)}
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {lang === "bn"
                ? "উদাহরণ: ২ = শুধু প্রথম ২ পোস্টের পর একবার; পরে আর আসবে না।"
                : "Example: 2 = once after the first 2 posts only; not repeated."}
            </p>
          </div>
          <div>
            <label className="text-[10px] text-slate-500">
              {lang === "bn" ? "কার্ড প্রস্থ (px)" : "Card width (px)"}
            </label>
            <input
              type="number"
              min={80}
              max={280}
              className={ainp}
              value={cfg.card_basis_px}
              onChange={(e) => setFlag("card_basis_px", Number(e.target.value) || 128)}
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">
              {lang === "bn" ? "অ্যাস্পেক্ট (যেমন 2/3)" : "Aspect (e.g. 2/3)"}
            </label>
            <input
              className={ainp}
              value={cfg.card_aspect}
              onChange={(e) => setFlag("card_aspect", e.target.value)}
              placeholder="2/3"
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">
              {lang === "bn" ? "গ্যাপ (px)" : "Gap (px)"}
            </label>
            <input
              type="number"
              min={0}
              max={32}
              className={ainp}
              value={cfg.gap_px}
              onChange={(e) => setFlag("gap_px", Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">
              {lang === "bn" ? "কোণার রাউন্ড (px)" : "Corner radius (px)"}
            </label>
            <input
              type="number"
              min={0}
              max={32}
              className={ainp}
              value={cfg.radius_px}
              onChange={(e) => setFlag("radius_px", Number(e.target.value) || 0)}
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">
              {lang === "bn" ? "অটোপ্লে মিলিসেকেন্ড" : "Autoplay ms"}
            </label>
            <input
              type="number"
              min={1500}
              max={60000}
              className={ainp}
              value={cfg.autoplay_ms}
              onChange={(e) => setFlag("autoplay_ms", Number(e.target.value) || 4500)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500">title_bn</label>
            <input
              className={ainp}
              value={cfg.title_bn}
              onChange={(e) => setFlag("title_bn", e.target.value)}
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500">title_en</label>
            <input
              className={ainp}
              value={cfg.title_en}
              onChange={(e) => setFlag("title_en", e.target.value)}
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <ToggleRow
            title={lang === "bn" ? "হেডার দেখাও" : "Show header"}
            hint={lang === "bn" ? "আইকন + টাইটেল" : "Icon + title row"}
            checked={cfg.show_header}
            onChange={(v) => setFlag("show_header", v)}
          />
          <ToggleRow
            title={lang === "bn" ? "বাম/ডান অ্যারো" : "Nav arrows"}
            hint={lang === "bn" ? "স্লাইড বাটন" : "Previous / next buttons"}
            checked={cfg.show_nav_arrows}
            onChange={(v) => setFlag("show_nav_arrows", v)}
          />
          <ToggleRow
            title={lang === "bn" ? "লুপ" : "Loop"}
            hint={lang === "bn" ? "শেষে গিয়ে আবার শুরু" : "Wrap around at ends"}
            checked={cfg.loop}
            onChange={(v) => setFlag("loop", v)}
          />
          <ToggleRow
            title={lang === "bn" ? "অটোপ্লে" : "Autoplay"}
            hint={lang === "bn" ? "স্বয়ংক্রিয় স্লাইড" : "Auto-advance slides"}
            checked={cfg.autoplay}
            onChange={(v) => setFlag("autoplay", v)}
          />
          <ToggleRow
            title={lang === "bn" ? "আইটেম মেনু আইকন" : "Item menu icon"}
            hint={lang === "bn" ? "ছবির উপর তিন ডট" : "Three dots overlay on cards"}
            checked={cfg.show_item_menu}
            onChange={(v) => setFlag("show_item_menu", v)}
          />
          <ToggleRow
            title={lang === "bn" ? "লিংক নতুন ট্যাবে" : "Open links in new tab"}
            hint={lang === "bn" ? "স্লাইডে URL থাকলে" : "When a slide has a URL"}
            checked={cfg.open_links_new_tab}
            onChange={(v) => setFlag("open_links_new_tab", v)}
          />
        </div>

        <button
          type="button"
          className="text-[11px] text-slate-400 underline"
          onClick={() => setCfg(normalizeFeedCarouselSettings(DEFAULT_FEED_CAROUSEL_SETTINGS))}
        >
          {lang === "bn" ? "ডিফল্ট সেটিংস রিসেট" : "Reset settings to defaults"}
        </button>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <ImagePlus className="h-4 w-4 text-rose-400" />
          {lang === "bn" ? "ইমেজ স্লাইড" : "Image slides"}
        </h3>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            void onFilePicked(f);
          }}
        />

        <div className="rounded-lg border border-dashed border-slate-700 bg-slate-950/60 p-3 space-y-2">
          <p className="text-[11px] text-slate-400">
            {lang === "bn" ? "নতুন স্লাইড যোগ করুন" : "Add a new slide"}
          </p>
          {draft.image_url ? (
            <CarouselRemoteImage
              src={draft.image_url}
              alt=""
              className="h-28 w-20 rounded-lg border border-slate-700"
              maxWidth={400}
              priority
            />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setUploadForId("new");
                fileRef.current?.click();
              }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              <Upload className="h-3.5 w-3.5" />
              {lang === "bn" ? "ইমেজ আপলোড" : "Upload image"}
            </button>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 flex items-center gap-1">
              <Link2 className="h-3 w-3" />
              {lang === "bn" ? "অথবা ইমেজ / Drive URL" : "Or image / Drive URL"}
            </label>
            <input
              className={ainp}
              value={draft.image_url}
              onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
              placeholder="https://drive.google.com/file/d/…/view"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              {lang === "bn"
                ? "Google Drive শেয়ার লিঙ্ক চলবে — ফাইল Share → Anyone with the link রাখুন।"
                : "Google Drive share links work — set Share → Anyone with the link."}
              {isGoogleDriveUrl(draft.image_url) ? (
                <span className="text-emerald-400">
                  {" "}
                  {lang === "bn" ? "Drive লিঙ্ক শনাক্ত হয়েছে।" : "Drive link detected."}
                </span>
              ) : null}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              className={ainp}
              placeholder="title_bn"
              value={draft.title_bn}
              onChange={(e) => setDraft((d) => ({ ...d, title_bn: e.target.value }))}
            />
            <input
              className={ainp}
              placeholder="title_en"
              value={draft.title_en}
              onChange={(e) => setDraft((d) => ({ ...d, title_en: e.target.value }))}
            />
          </div>
          <input
            className={ainp}
            placeholder={lang === "bn" ? "ক্লিক লিংক (ঐচ্ছিক)" : "Click link (optional)"}
            value={draft.link_url ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, link_url: e.target.value || null }))}
          />
          <div>
            <label className="text-[10px] text-slate-500 mb-1 block">
              {lang === "bn" ? "জেলা (খালি = সব জেলা / গ্লোবাল)" : "District (empty = global)"}
            </label>
            <DistrictTypeahead
              value={draftDistrict}
              onChange={(d) => {
                setDraftDistrict(d);
                setDraft((prev) => ({ ...prev, district_id: d?.id ?? null }));
                if (d) setDistrictById((m) => ({ ...m, [d.id]: d }));
              }}
              placeholder={lang === "bn" ? "জেলা খুঁজুন (ঐচ্ছিক)…" : "Search district (optional)…"}
              variant="admin"
            />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void saveSlide({
                image_url: draft.image_url,
                title_bn: draft.title_bn,
                title_en: draft.title_en,
                link_url: draft.link_url,
                district_id: draft.district_id,
                sort_order: draft.sort_order,
                is_active: true,
              })
            }
            className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {lang === "bn" ? "স্লাইড যোগ করুন" : "Add slide"}
          </button>
        </div>

        <ul className="space-y-3">
          {slides.length === 0 && (
            <li className="text-xs text-slate-500 py-4 text-center">
              {lang === "bn" ? "এখনো কোনো ইমেজ নেই" : "No images yet"}
            </li>
          )}
          {slides.map((slide, i) => (
            <li
              key={slide.id}
              className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-2"
            >
              <div className="flex gap-3">
                <CarouselRemoteImage
                  src={slide.image_url}
                  alt=""
                  className="h-24 w-18 rounded-lg border border-slate-700 shrink-0"
                  maxWidth={320}
                  priority
                />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300">
                      <input
                        type="checkbox"
                        checked={slide.is_active}
                        onChange={(e) =>
                          patchSlideLocal(slide.id, { is_active: e.target.checked })
                        }
                      />
                      {lang === "bn" ? "সক্রিয়" : "Active"}
                    </label>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy || i === 0}
                        onClick={() => void moveSlide(slide.id, -1)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                        aria-label="Move up"
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy || i === slides.length - 1}
                        onClick={() => void moveSlide(slide.id, 1)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                        aria-label="Move down"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void removeSlide(slide.id)}
                        className="rounded p-1 text-rose-400 hover:bg-rose-500/10"
                        aria-label="Delete"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <input
                    className={ainp}
                    value={slide.image_url}
                    onChange={(e) => patchSlideLocal(slide.id, { image_url: e.target.value })}
                    placeholder="https://drive.google.com/file/d/…/view"
                  />
                  {isGoogleDriveUrl(slide.image_url) && (
                    <p className="text-[10px] text-emerald-400/90">
                      {lang === "bn"
                        ? "Drive লিঙ্ক — সেভে প্রিভিউ URL সেভ হবে"
                        : "Drive link — preview URL saved on save"}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    <input
                      className={ainp}
                      placeholder="title_bn"
                      value={slide.title_bn}
                      onChange={(e) => patchSlideLocal(slide.id, { title_bn: e.target.value })}
                    />
                    <input
                      className={ainp}
                      placeholder="title_en"
                      value={slide.title_en}
                      onChange={(e) => patchSlideLocal(slide.id, { title_en: e.target.value })}
                    />
                  </div>
                  <input
                    className={ainp}
                    placeholder="link_url"
                    value={slide.link_url ?? ""}
                    onChange={(e) =>
                      patchSlideLocal(slide.id, { link_url: e.target.value || null })
                    }
                  />
                  <div>
                    <label className="text-[10px] text-slate-500 mb-1 block">
                      {lang === "bn" ? "জেলা" : "District"}
                      {slide.district_id
                        ? ` — ${
                            lang === "bn"
                              ? districtById[slide.district_id]?.name_bn ?? slide.district_id.slice(0, 8)
                              : districtById[slide.district_id]?.name_en ?? slide.district_id.slice(0, 8)
                          }`
                        : lang === "bn"
                          ? " — গ্লোবাল"
                          : " — Global"}
                    </label>
                    <DistrictTypeahead
                      value={slide.district_id ? districtById[slide.district_id] ?? null : null}
                      onChange={(d) => {
                        if (d) setDistrictById((m) => ({ ...m, [d.id]: d }));
                        patchSlideLocal(slide.id, { district_id: d?.id ?? null });
                      }}
                      placeholder={lang === "bn" ? "জেলা (ঐচ্ছিক)…" : "District (optional)…"}
                      variant="admin"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setUploadForId(slide.id);
                        fileRef.current?.click();
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2 py-1 text-[11px] text-slate-200"
                    >
                      <Upload className="h-3 w-3" />
                      {lang === "bn" ? "রিপ্লেস" : "Replace"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void saveSlide(slide)}
                      className="inline-flex items-center gap-1 rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white"
                    >
                      <Save className="h-3 w-3" />
                      {t("save")}
                    </button>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
