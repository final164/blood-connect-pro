import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ImagePlus,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import { fetchDistricts, type District } from "@/lib/api";
import {
  DEFAULT_SUCCESS_CAROUSEL_SETTINGS,
  deleteSuccessStorySlide,
  fetchAllSuccessStorySlides,
  fetchSuccessCarouselSettings,
  invalidateSuccessCarouselCache,
  normalizeSuccessCarouselSettings,
  reorderSuccessStorySlides,
  saveSuccessCarouselSettings,
  uploadSuccessCarouselImage,
  upsertSuccessStorySlide,
  type SuccessCarouselSettings,
  type SuccessStorySlide,
} from "@/lib/success-carousel";

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

function emptyDraft(sortOrder: number): Partial<SuccessStorySlide> & { id?: string } {
  return {
    blood_group: "",
    patient_name: "",
    hospital: "",
    bags_needed: 1,
    location_label: "",
    notes_excerpt: "",
    title_bn: "",
    title_en: "",
    image_url: null,
    link_url: null,
    district_id: null,
    request_id: null,
    sort_order: sortOrder,
    is_active: true,
  };
}

export function SuccessCarouselAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cfg, setCfg] = useState<SuccessCarouselSettings>(DEFAULT_SUCCESS_CAROUSEL_SETTINGS);
  const [slides, setSlides] = useState<SuccessStorySlide[]>([]);
  const [draft, setDraft] = useState(emptyDraft(10));
  const [uploadForId, setUploadForId] = useState<string | "new">("new");
  const [busy, setBusy] = useState(false);
  const [schemaHint, setSchemaHint] = useState(false);
  const [draftDistrict, setDraftDistrict] = useState<District | null>(null);
  const [districtById, setDistrictById] = useState<Record<string, District>>({});

  async function reload() {
    const settings = await fetchSuccessCarouselSettings(true);
    setCfg(settings);
    const { slides: rows, error } = await fetchAllSuccessStorySlides();
    if (error) {
      if (/success_story|relation|column|schema/i.test(error.message)) {
        setSchemaHint(true);
      }
      toast.error(error.message);
      return;
    }
    setSchemaHint(false);
    setSlides(rows);
  }

  useEffect(() => {
    void reload();
    void fetchDistricts().then((list) => {
      const map: Record<string, District> = {};
      for (const d of list) map[d.id] = d;
      setDistrictById(map);
    });
  }, []);

  async function saveSettings() {
    if (!can("cms.edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    setBusy(true);
    const { error } = await saveSuccessCarouselSettings(normalizeSuccessCarouselSettings(cfg));
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "সেটিংস সেভ হয়েছে" : "Settings saved");
    invalidateSuccessCarouselCache();
  }

  async function saveDraft() {
    if (!can("cms.edit")) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    setBusy(true);
    const { error } = await upsertSuccessStorySlide({
      ...draft,
      district_id: draftDistrict?.id ?? draft.district_id ?? null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(lang === "bn" ? "স্লাইড সেভ হয়েছে" : "Slide saved");
    setDraft(emptyDraft((slides[slides.length - 1]?.sort_order ?? 0) + 10));
    setDraftDistrict(null);
    await reload();
  }

  async function toggleActive(slide: SuccessStorySlide) {
    if (!can("cms.edit")) return;
    setBusy(true);
    const { error } = await upsertSuccessStorySlide({
      ...slide,
      is_active: !slide.is_active,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    await reload();
  }

  async function move(id: string, dir: -1 | 1) {
    if (!can("cms.edit")) return;
    const idx = slides.findIndex((s) => s.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= slides.length) return;
    const next = [...slides];
    const [row] = next.splice(idx, 1);
    next.splice(j, 0, row);
    setSlides(next);
    const { error } = await reorderSuccessStorySlides(next.map((s) => s.id));
    if (error) toast.error(error.message);
    await reload();
  }

  async function remove(id: string) {
    if (!can("cms.edit")) return;
    if (!window.confirm(lang === "bn" ? "স্লাইড মুছবেন?" : "Delete slide?")) return;
    setBusy(true);
    const { error } = await deleteSuccessStorySlide(id);
    setBusy(false);
    if (error) return toast.error(error.message);
    await reload();
  }

  async function onUpload(file: File | null) {
    if (!file || !can("cms.edit")) return;
    setBusy(true);
    const { url, error } = await uploadSuccessCarouselImage(file);
    setBusy(false);
    if (error || !url) return toast.error(error?.message ?? "Upload failed");
    if (uploadForId === "new") {
      setDraft((d) => ({ ...d, image_url: url }));
    } else {
      const slide = slides.find((s) => s.id === uploadForId);
      if (slide) {
        await upsertSuccessStorySlide({ ...slide, image_url: url });
        await reload();
      }
    }
    toast.success(lang === "bn" ? "ছবি আপলোড হয়েছে" : "Image uploaded");
  }

  return (
    <div className="space-y-4 text-slate-100">
      {schemaHint && (
        <p className="rounded-lg border border-amber-700/50 bg-amber-950/40 px-3 py-2 text-xs text-amber-200">
          {lang === "bn"
            ? "success_story_slides মাইগ্রেশন রান করুন (20260912091000_success_story_carousel.sql)"
            : "Run migration 20260912091000_success_story_carousel.sql"}
        </p>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {lang === "bn" ? "সফল রক্তদান ক্যারোজেল" : "Success donation carousel"}
          </h3>
          <button
            type="button"
            disabled={busy || !can("cms.edit")}
            onClick={() => void saveSettings()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {lang === "bn" ? "সেভ" : "Save"}
          </button>
        </div>
        <p className="text-[10px] text-slate-500">
          {lang === "bn"
            ? "রক্তদান fulfilled হলে অটো কার্ড তৈরি হয়। এখান থেকে দেখান/লুকান, অর্ডার ও টেক্সট ম্যানেজ করুন।"
            : "Cards auto-create when a request is fulfilled. Manage visibility, order, and copy here."}
        </p>
        <ToggleRow
          title={lang === "bn" ? "সক্রিয়" : "Enabled"}
          hint={lang === "bn" ? "ফিডে ক্যারোজেল দেখাবে" : "Show carousel on feed"}
          checked={cfg.enabled}
          onChange={(v) => setCfg({ ...cfg, enabled: v })}
        />
        <ToggleRow
          title={lang === "bn" ? "হেডার" : "Header"}
          hint={lang === "bn" ? "টাইটেল দেখাবে" : "Show title"}
          checked={cfg.show_header}
          onChange={(v) => setCfg({ ...cfg, show_header: v })}
        />
        <ToggleRow
          title={lang === "bn" ? "অটোপ্লে" : "Autoplay"}
          hint="ms"
          checked={cfg.autoplay}
          onChange={(v) => setCfg({ ...cfg, autoplay: v })}
        />
        <ToggleRow
          title={lang === "bn" ? "অ্যারো" : "Nav arrows"}
          hint=""
          checked={cfg.show_nav_arrows}
          onChange={(v) => setCfg({ ...cfg, show_nav_arrows: v })}
        />
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] text-slate-400">
            {lang === "bn" ? "কত পোস্ট পর" : "Insert after N posts"}
            <input
              className={`${ainp} mt-1`}
              type="number"
              min={1}
              max={20}
              value={cfg.insert_after_every}
              onChange={(e) =>
                setCfg({ ...cfg, insert_after_every: Number(e.target.value) || 3 })
              }
            />
          </label>
          <label className="text-[10px] text-slate-400">
            autoplay_ms
            <input
              className={`${ainp} mt-1`}
              type="number"
              value={cfg.autoplay_ms}
              onChange={(e) =>
                setCfg({ ...cfg, autoplay_ms: Number(e.target.value) || 5000 })
              }
            />
          </label>
          <label className="text-[10px] text-slate-400">
            title_bn
            <input
              className={`${ainp} mt-1`}
              value={cfg.title_bn}
              onChange={(e) => setCfg({ ...cfg, title_bn: e.target.value })}
            />
          </label>
          <label className="text-[10px] text-slate-400">
            title_en
            <input
              className={`${ainp} mt-1`}
              value={cfg.title_en}
              onChange={(e) => setCfg({ ...cfg, title_en: e.target.value })}
            />
          </label>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <h3 className="text-sm font-semibold">
          {lang === "bn" ? "নতুন / এডিট স্লাইড" : "New / edit slide"}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          <input
            className={ainp}
            placeholder="title_bn"
            value={draft.title_bn ?? ""}
            onChange={(e) => setDraft({ ...draft, title_bn: e.target.value })}
          />
          <input
            className={ainp}
            placeholder="title_en"
            value={draft.title_en ?? ""}
            onChange={(e) => setDraft({ ...draft, title_en: e.target.value })}
          />
          <input
            className={ainp}
            placeholder="blood_group"
            value={draft.blood_group ?? ""}
            onChange={(e) => setDraft({ ...draft, blood_group: e.target.value })}
          />
          <input
            className={ainp}
            placeholder="patient_name"
            value={draft.patient_name ?? ""}
            onChange={(e) => setDraft({ ...draft, patient_name: e.target.value })}
          />
          <input
            className={ainp}
            placeholder="hospital"
            value={draft.hospital ?? ""}
            onChange={(e) => setDraft({ ...draft, hospital: e.target.value })}
          />
          <input
            className={ainp}
            type="number"
            min={1}
            placeholder="bags"
            value={draft.bags_needed ?? 1}
            onChange={(e) =>
              setDraft({ ...draft, bags_needed: Number(e.target.value) || 1 })
            }
          />
          <input
            className={`${ainp} col-span-2`}
            placeholder="location_label"
            value={draft.location_label ?? ""}
            onChange={(e) => setDraft({ ...draft, location_label: e.target.value })}
          />
          <textarea
            className={`${ainp} col-span-2 min-h-[60px]`}
            placeholder="notes_excerpt"
            value={draft.notes_excerpt ?? ""}
            onChange={(e) => setDraft({ ...draft, notes_excerpt: e.target.value })}
          />
          <input
            className={`${ainp} col-span-2`}
            placeholder="link_url"
            value={draft.link_url ?? ""}
            onChange={(e) => setDraft({ ...draft, link_url: e.target.value || null })}
          />
          <input
            className={`${ainp} col-span-2`}
            placeholder="image_url"
            value={draft.image_url ?? ""}
            onChange={(e) => setDraft({ ...draft, image_url: e.target.value || null })}
          />
        </div>
        <DistrictTypeahead
          value={draftDistrict}
          onChange={setDraftDistrict}
          variant="admin"
          placeholder={lang === "bn" ? "জেলা (ঐচ্ছিক)" : "District (optional)"}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy || !can("cms.edit")}
            onClick={() => {
              setUploadForId("new");
              fileRef.current?.click();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs"
          >
            <Upload className="h-3.5 w-3.5" />
            {lang === "bn" ? "ছবি" : "Image"}
          </button>
          <button
            type="button"
            disabled={busy || !can("cms.edit")}
            onClick={() => void saveDraft()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {draft.id
              ? lang === "bn"
                ? "আপডেট"
                : "Update"
              : lang === "bn"
                ? "যোগ করুন"
                : "Add"}
          </button>
          {draft.id && (
            <button
              type="button"
              className="text-xs text-slate-400 underline"
              onClick={() => {
                setDraft(emptyDraft(10));
                setDraftDistrict(null);
              }}
            >
              {lang === "bn" ? "নতুন" : "Clear"}
            </button>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void onUpload(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900 divide-y divide-slate-800">
        {slides.length === 0 && (
          <p className="p-4 text-xs text-slate-500">
            {lang === "bn" ? "এখনো কোনো স্লাইড নেই" : "No slides yet"}
          </p>
        )}
        {slides.map((s) => (
          <div key={s.id} className="p-3 flex gap-3 items-start">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold truncate">
                {s.blood_group || "—"} · {lang === "bn" ? s.title_bn : s.title_en || s.title_bn}
              </p>
              <p className="text-[11px] text-slate-400 truncate">
                {s.patient_name || "—"} · {s.location_label || s.hospital || "—"}
              </p>
              <p className="text-[10px] text-slate-500">
                {s.is_active ? "active" : "hidden"}
                {s.district_id && districtById[s.district_id]
                  ? ` · ${districtById[s.district_id].name_en}`
                  : ""}
              </p>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button type="button" className="p-1" onClick={() => void move(s.id, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="p-1" onClick={() => void move(s.id, 1)}>
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className="text-[10px] text-emerald-400"
                onClick={() => void toggleActive(s)}
              >
                {s.is_active ? "hide" : "show"}
              </button>
              <button
                type="button"
                className="text-[10px] text-sky-400"
                onClick={() => {
                  setDraft(s);
                  setDraftDistrict(
                    s.district_id && districtById[s.district_id]
                      ? districtById[s.district_id]
                      : null,
                  );
                }}
              >
                edit
              </button>
              <button type="button" className="p-1 text-rose-400" onClick={() => void remove(s.id)}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
