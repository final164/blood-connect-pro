import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_NEED_REASON_CATALOG,
  fetchNeedReasonCatalog,
  invalidateNeedReasonCache,
  newNeedReasonId,
  normalizeNeedReasonCatalog,
  pickLocalized,
  saveNeedReasonCatalog,
  type LocalizedText,
  type NeedReasonCatalog,
  type NeedReasonCategory,
  type NeedReasonDisplayLang,
} from "@/lib/need-reason-catalog";
import { ChevronDown, ChevronUp, Plus, Save, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-slate-100 outline-none focus:ring-1 focus:ring-rose-500/40";

export function NeedReasonAdmin() {
  const { lang, t } = useI18n();
  const { can } = useAdminAccess();
  const [catalog, setCatalog] = useState<NeedReasonCatalog>(DEFAULT_NEED_REASON_CATALOG);
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchNeedReasonCatalog(true).then(setCatalog);
  }, []);

  function patchCategory(id: string, patch: Partial<NeedReasonCategory>) {
    setCatalog((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  function setDisplayLang(display_lang: NeedReasonDisplayLang) {
    setCatalog((prev) => ({ ...prev, display_lang }));
  }

  function patchLabel(id: string, key: "bn" | "en", value: string) {
    setCatalog((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === id ? { ...c, label: { ...c.label, [key]: value } } : c,
      ),
    }));
  }

  function patchSuggestion(catId: string, index: number, key: "bn" | "en", value: string) {
    setCatalog((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => {
        if (c.id !== catId) return c;
        const suggestions = c.suggestions.map((s, i) =>
          i === index ? { ...s, [key]: value } : s,
        );
        return { ...c, suggestions };
      }),
    }));
  }

  function addSuggestion(catId: string) {
    const blank: LocalizedText = { bn: "", en: "" };
    setCatalog((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === catId ? { ...c, suggestions: [...c.suggestions, blank] } : c,
      ),
    }));
  }

  function removeSuggestion(catId: string, index: number) {
    setCatalog((prev) => ({
      ...prev,
      categories: prev.categories.map((c) =>
        c.id === catId
          ? { ...c, suggestions: c.suggestions.filter((_, i) => i !== index) }
          : c,
      ),
    }));
  }

  function addCategory() {
    const id = newNeedReasonId(`reason-${Date.now().toString(36)}`);
    const next: NeedReasonCategory = {
      id,
      label: {
        bn: lang === "bn" ? "নতুন ক্যাটাগরি" : "New category",
        en: "New category",
      },
      suggestions: [
        {
          bn: "রোগীর জন্য রক্ত প্রয়োজন। দয়া করে সাড়া দিন।",
          en: "Patient needs blood. Please respond.",
        },
      ],
      is_active: true,
      sort_order: (catalog.categories.at(-1)?.sort_order ?? 0) + 10,
    };
    setCatalog((prev) => ({ ...prev, categories: [...prev.categories, next] }));
    setOpenId(id);
  }

  function removeCategory(id: string) {
    setCatalog((prev) => ({ ...prev, categories: prev.categories.filter((c) => c.id !== id) }));
    if (openId === id) setOpenId(null);
  }

  function resetDefaults() {
    setCatalog(
      normalizeNeedReasonCatalog({
        display_lang: catalog.display_lang,
        categories: DEFAULT_NEED_REASON_CATALOG.categories.map((c) => ({
          ...c,
          label: { ...c.label },
          suggestions: c.suggestions.map((s) => ({ ...s })),
        })),
      }),
    );
    toast.message(lang === "bn" ? "ডিফল্ট ক্যাটাগরি লোড হয়েছে — সেভ করুন" : "Defaults loaded — click Save");
  }

  async function save() {
    if (!can("settings.edit")) {
      return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    }
    setBusy(true);
    const { error, catalog: saved } = await saveNeedReasonCatalog(catalog);
    setBusy(false);
    if (error) {
      if (/need_reason_catalog|column/i.test(error.message)) {
        return toast.error(
          lang === "bn"
            ? "আগে scripts/need-reason-catalog.sql চালান"
            : "Run scripts/need-reason-catalog.sql first",
        );
      }
      return toast.error(error.message);
    }
    setCatalog(saved);
    invalidateNeedReasonCache();
    toast.success(t("saved"));
  }

  const sorted = [...catalog.categories].sort(
    (a, b) => a.sort_order - b.sort_order || a.label.en.localeCompare(b.label.en),
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">
            {lang === "bn" ? "রক্তের প্রয়োজনের কারণ / রোগের ধরন" : "Blood need reason / disease type"}
          </h3>
          <p className="text-[11px] text-slate-400 mt-1 max-w-xl leading-relaxed">
            {lang === "bn"
              ? "ক্যাটাগরি সিলেক্ট করলে নোট সাজেশন চিপ দেখাবে। এখান থেকে ক্যাটাগরি ও সাজেশন যোগ/সম্পাদনা/মুছুন।"
              : "Categories power the composer reason picker and note suggestion chips. Add, edit, or delete here."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {lang === "bn" ? "ডিফল্ট" : "Defaults"}
          </button>
          <button
            type="button"
            onClick={addCategory}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
          >
            <Plus className="h-3.5 w-3.5" />
            {lang === "bn" ? "ক্যাটাগরি" : "Category"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {t("save")}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3 space-y-2">
        <p className="text-xs font-medium text-slate-300">
          {lang === "bn" ? "পোস্ট ফর্মে দেখানোর ভাষা" : "Language shown on post form"}
        </p>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          {lang === "bn"
            ? "বাংলা সিলেক্ট করলে অ্যাপ English হলেও কারণ/সাজেশন বাংলায় দেখাবে।"
            : "If Bangla is selected, reasons/suggestions stay Bangla even when the app UI is English."}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: "app" as const, bn: "অ্যাপ অনুসারে", en: "Follow app" },
              { id: "bn" as const, bn: "বাংলা", en: "Bangla" },
              { id: "en" as const, bn: "English", en: "English" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setDisplayLang(opt.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold border transition ${
                catalog.display_lang === opt.id
                  ? "bg-rose-600 border-rose-600 text-white"
                  : "border-slate-700 text-slate-300 hover:bg-slate-800"
              }`}
            >
              {lang === "bn" ? opt.bn : opt.en}
            </button>
          ))}
        </div>
      </div>

      <ul className="space-y-2">
        {sorted.map((c) => {
          const open = openId === c.id;
          return (
            <li key={c.id} className="rounded-lg border border-slate-800 overflow-hidden">
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-950/50">
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : c.id)}
                  className="h-8 w-8 rounded-lg grid place-items-center text-slate-400 hover:bg-slate-800"
                  aria-expanded={open}
                >
                  {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{pickLocalized(c.label, lang)}</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {c.id} · {c.suggestions.length}{" "}
                    {lang === "bn" ? "সাজেশন" : "suggestions"}
                    {!c.is_active ? (lang === "bn" ? " · লুকানো" : " · hidden") : ""}
                  </p>
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-slate-400 shrink-0">
                  <input
                    type="checkbox"
                    checked={c.is_active}
                    onChange={(e) => patchCategory(c.id, { is_active: e.target.checked })}
                  />
                  {lang === "bn" ? "সক্রিয়" : "Active"}
                </label>
                <button
                  type="button"
                  onClick={() => removeCategory(c.id)}
                  className="h-8 w-8 rounded-lg grid place-items-center text-rose-400 hover:bg-rose-500/10"
                  aria-label={lang === "bn" ? "মুছুন" : "Delete"}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {open && (
                <div className="p-3 space-y-3 border-t border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500">Label (BN)</label>
                      <input
                        className={ainp}
                        value={c.label.bn}
                        onChange={(e) => patchLabel(c.id, "bn", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Label (EN)</label>
                      <input
                        className={ainp}
                        value={c.label.en}
                        onChange={(e) => patchLabel(c.id, "en", e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">ID</label>
                      <input
                        className={ainp}
                        value={c.id}
                        onChange={(e) => patchCategory(c.id, { id: e.target.value.trim() || c.id })}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500">Sort</label>
                      <input
                        className={ainp}
                        type="number"
                        value={c.sort_order}
                        onChange={(e) =>
                          patchCategory(c.id, { sort_order: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-300">
                        {lang === "bn" ? "নোট সাজেশন" : "Note suggestions"}
                      </p>
                      <button
                        type="button"
                        onClick={() => addSuggestion(c.id)}
                        className="text-[11px] text-rose-400 hover:underline inline-flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        {lang === "bn" ? "সাজেশন" : "Suggestion"}
                      </button>
                    </div>
                    {c.suggestions.length === 0 && (
                      <p className="text-[11px] text-slate-500">
                        {lang === "bn" ? "কোনো সাজেশন নেই" : "No suggestions yet"}
                      </p>
                    )}
                    {c.suggestions.map((s, i) => (
                      <div
                        key={`${c.id}-s-${i}`}
                        className="rounded-lg border border-slate-800 p-2 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500">#{i + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeSuggestion(c.id, i)}
                            className="text-rose-400 hover:text-rose-300"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <textarea
                          className={ainp}
                          rows={2}
                          placeholder="বাংলা"
                          value={s.bn}
                          onChange={(e) => patchSuggestion(c.id, i, "bn", e.target.value)}
                        />
                        <textarea
                          className={ainp}
                          rows={2}
                          placeholder="English"
                          value={s.en}
                          onChange={(e) => patchSuggestion(c.id, i, "en", e.target.value)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
