import { useEffect, useState } from "react";
import { Pencil, Plus, RefreshCw, Save, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_GEMINI_FEATURES,
  DEFAULT_GEMINI_FOLLOWUP,
  DEFAULT_GEMINI_UI,
  type FollowUpKind,
  type GeminiAiFeatures,
  type GeminiFollowUpKindSettings,
  type GeminiFollowUpSettings,
  type GeminiUiCopy,
} from "@/lib/gemini-ai-config";
import {
  deleteGeminiKeyFn,
  fetchGeminiAdminState,
  saveGeminiSettingsFn,
  testGeminiKeyFn,
  upsertGeminiKeyFn,
  upsertGeminiModelFn,
  type GeminiKeyPublic,
  type GeminiModelOption,
  type GeminiSettingsExtended,
} from "@/lib/gemini-admin";
import {
  DEFAULT_GEMINI_SETTINGS,
  DEFAULT_PROMPT_CHAT_BN,
  DEFAULT_PROMPT_CHAT_EN,
  DEFAULT_PROMPT_MATCH,
  type GeminiThinkingLevel,
} from "@/lib/gemini-rotate";

const ainp =
  "w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none focus:ring-2 focus:ring-rose-500/40 placeholder:text-slate-500";

type MainTab = "models" | "features" | "followup" | "prompts" | "ui" | "catalog" | "keys";
type PromptTab = "chat_bn" | "chat_en" | "match";
type UiTab = "welcome" | "status" | "headings" | "cta";
type FollowUpTab = "general" | FollowUpKind;

const MAIN_TABS: { id: MainTab; bn: string; en: string }[] = [
  { id: "models", bn: "মডেল ও পারফরম্যান্স", en: "Models & performance" },
  { id: "features", bn: "AI ফিচার", en: "AI features" },
  { id: "followup", bn: "ফলো-আপ উত্তর", en: "Follow-up answers" },
  { id: "prompts", bn: "সিস্টেম প্রম্পট", en: "System prompts" },
  { id: "ui", bn: "UI কপি", en: "UI copy" },
  { id: "catalog", bn: "মডেল ক্যাটালগ", en: "Model catalog" },
  { id: "keys", bn: "API Keys", en: "API keys" },
];

const PROMPT_TABS: { id: PromptTab; bn: string; en: string }[] = [
  { id: "chat_bn", bn: "চ্যাট (বাংলা)", en: "Chat (Bangla)" },
  { id: "chat_en", bn: "চ্যাট (English)", en: "Chat (English)" },
  { id: "match", bn: "ম্যাচ", en: "Match" },
];

const UI_TABS: { id: UiTab; bn: string; en: string }[] = [
  { id: "welcome", bn: "স্বাগত ও ডিসক্লেইমার", en: "Welcome & disclaimer" },
  { id: "status", bn: "স্ট্যাটাস টেক্সট", en: "Status text" },
  { id: "headings", bn: "সেকশন হেডিং", en: "Section headings" },
  { id: "cta", bn: "বুকিং CTA", en: "Booking CTA" },
];

const FOLLOWUP_TABS: { id: FollowUpTab; bn: string; en: string }[] = [
  { id: "general", bn: "সাধারণ", en: "General" },
  { id: "duration", bn: "সময়কাল", en: "Duration" },
  { id: "yes_no", bn: "হ্যাঁ/না", en: "Yes/No" },
  { id: "age", bn: "বয়স", en: "Age" },
  { id: "severity", bn: "তীব্রতা", en: "Severity" },
  { id: "text", bn: "সাধারণ টেক্সট", en: "Free text" },
];

const FOLLOWUP_GENERAL_FIELDS: (keyof GeminiFollowUpSettings)[] = [
  "panel_title_bn",
  "panel_title_en",
  "question_label_bn",
  "question_label_en",
  "close_label_bn",
  "close_label_en",
  "chip_hint_bn",
  "chip_hint_en",
  "answer_tag_bn",
  "answer_tag_en",
  "question_tag_bn",
  "question_tag_en",
  "answer_inline_bn",
  "answer_inline_en",
  "bubble_prefix",
  "bubble_caption_bn",
  "bubble_caption_en",
];

const FOLLOWUP_LABELS: Record<string, { bn: string; en: string }> = {
  panel_title_bn: { bn: "প্যানেল শিরোনাম (বাংলা)", en: "Panel title (Bangla)" },
  panel_title_en: { bn: "প্যানেল শিরোনাম (English)", en: "Panel title (English)" },
  question_label_bn: { bn: "প্রশ্ন লেবেল (বাংলা)", en: "Question label (Bangla)" },
  question_label_en: { bn: "প্রশ্ন লেবেল (English)", en: "Question label (English)" },
  close_label_bn: { bn: "বন্ধ (বাংলা)", en: "Close (Bangla)" },
  close_label_en: { bn: "বন্ধ (English)", en: "Close (English)" },
  chip_hint_bn: { bn: "চিপ হিন্ট (বাংলা)", en: "Chip hint (Bangla)" },
  chip_hint_en: { bn: "চিপ হিন্ট (English)", en: "Chip hint (English)" },
  answer_tag_bn: { bn: "AI ট্যাগ (বাংলা)", en: "AI tag (Bangla)" },
  answer_tag_en: { bn: "AI ট্যাগ (English)", en: "AI tag (English)" },
  question_tag_bn: { bn: "AI প্রশ্ন লেবেল (বাংলা)", en: "AI question label (Bangla)" },
  question_tag_en: { bn: "AI প্রশ্ন লেবেল (English)", en: "AI question label (English)" },
  answer_inline_bn: { bn: "AI উত্তর লেবেল (বাংলা)", en: "AI answer label (Bangla)" },
  answer_inline_en: { bn: "AI উত্তর লেবেল (English)", en: "AI answer label (English)" },
  bubble_prefix: { bn: "বাবল প্রিফিক্স", en: "Bubble prefix" },
  bubble_caption_bn: { bn: "বাবল ক্যাপশন (বাংলা)", en: "Bubble caption (Bangla)" },
  bubble_caption_en: { bn: "বাবল ক্যাপশন (English)", en: "Bubble caption (English)" },
  text_placeholder_bn: { bn: "টেক্সট placeholder (বাংলা)", en: "Text placeholder (Bangla)" },
  text_placeholder_en: { bn: "টেক্সট placeholder (English)", en: "Text placeholder (English)" },
  patterns: { bn: "Regex (প্রতি লাইনে)", en: "Regex patterns (one per line)" },
  quick_replies_bn: { bn: "দ্রুত চিপ (বাংলা)", en: "Quick chips (Bangla)" },
  quick_replies_en: { bn: "দ্রুত চিপ (English)", en: "Quick chips (English)" },
  placeholder_bn: { bn: "Placeholder (বাংলা)", en: "Placeholder (Bangla)" },
  placeholder_en: { bn: "Placeholder (English)", en: "Placeholder (English)" },
};

const UI_FIELDS: Record<UiTab, (keyof GeminiUiCopy)[]> = {
  welcome: ["welcome_bn", "welcome_en", "disclaimer_bn", "disclaimer_en"],
  status: ["thinking_bn", "thinking_en", "page_title_bn", "page_title_en"],
  headings: [
    "medical_heading_bn",
    "medical_heading_en",
    "catalog_heading_bn",
    "catalog_heading_en",
    "suggestions_heading_bn",
    "suggestions_heading_en",
  ],
  cta: ["bundle_cta_bn", "bundle_cta_en"],
};

const UI_LABELS: Record<keyof GeminiUiCopy, { bn: string; en: string }> = {
  welcome_bn: { bn: "স্বাগত (বাংলা)", en: "Welcome (Bangla)" },
  welcome_en: { bn: "স্বাগত (English)", en: "Welcome (English)" },
  disclaimer_bn: { bn: "ডিসক্লেইমার (বাংলা)", en: "Disclaimer (Bangla)" },
  disclaimer_en: { bn: "ডিসক্লেইমার (English)", en: "Disclaimer (English)" },
  thinking_bn: { bn: "লোডিং (বাংলা)", en: "Loading (Bangla)" },
  thinking_en: { bn: "লোডিং (English)", en: "Loading (English)" },
  page_title_bn: { bn: "পেজ শিরোনাম (বাংলা)", en: "Page title (Bangla)" },
  page_title_en: { bn: "পেজ শিরোনাম (English)", en: "Page title (English)" },
  medical_heading_bn: { bn: "মেডিকেল হেডিং (বাংলা)", en: "Medical heading (Bangla)" },
  medical_heading_en: { bn: "মেডিকেল হেডিং (English)", en: "Medical heading (English)" },
  catalog_heading_bn: { bn: "ক্যাটালগ হেডিং (বাংলা)", en: "Catalog heading (Bangla)" },
  catalog_heading_en: { bn: "ক্যাটালগ হেডিং (English)", en: "Catalog heading (English)" },
  suggestions_heading_bn: { bn: "সাজেশন হেডিং (বাংলা)", en: "Suggestions heading (Bangla)" },
  suggestions_heading_en: { bn: "সাজেশন হেডিং (English)", en: "Suggestions heading (English)" },
  bundle_cta_bn: { bn: "বান্ডেল CTA (বাংলা)", en: "Bundle CTA (Bangla)" },
  bundle_cta_en: { bn: "বান্ডেল CTA (English)", en: "Bundle CTA (English)" },
};

function defaultExtended(): GeminiSettingsExtended {
  return {
    ...DEFAULT_GEMINI_SETTINGS,
    features: { ...DEFAULT_GEMINI_FEATURES },
    ui: { ...DEFAULT_GEMINI_UI },
    follow_up: { ...DEFAULT_GEMINI_FOLLOWUP },
    max_questions: 4,
    max_suggestions: 8,
  };
}

function statusLabel(status: GeminiKeyPublic["status"], lang: "bn" | "en") {
  const map = {
    active: { bn: "চালু - কাজ করছে", en: "Active — working" },
    quota: { bn: "কোটা শেষ", en: "Quota exhausted" },
    error: { bn: "ত্রুটি", en: "Error" },
    disabled: { bn: "বন্ধ", en: "Disabled" },
  } as const;
  return map[status][lang];
}

function statusClass(status: GeminiKeyPublic["status"]) {
  if (status === "active") return "bg-sky-600/20 text-sky-300";
  if (status === "quota") return "bg-amber-600/20 text-amber-300";
  if (status === "error") return "bg-rose-600/20 text-rose-300";
  return "bg-slate-700 text-slate-300";
}

function SubNav<T extends string>({
  items,
  active,
  onChange,
  lang,
}: {
  items: { id: T; bn: string; en: string }[];
  active: T;
  onChange: (id: T) => void;
  lang: "bn" | "en";
}) {
  return (
    <nav className="flex gap-1 overflow-x-auto no-scrollbar rounded-lg border border-slate-800 bg-slate-950/80 p-1">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onChange(item.id)}
          className={`shrink-0 rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${
            active === item.id
              ? "bg-violet-600 text-white"
              : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
          }`}
        >
          {lang === "bn" ? item.bn : item.en}
        </button>
      ))}
    </nav>
  );
}

export function GeminiKeysAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const canEdit = can("settings.edit");
  const [tab, setTab] = useState<MainTab>("models");
  const [promptTab, setPromptTab] = useState<PromptTab>("chat_bn");
  const [uiTab, setUiTab] = useState<UiTab>("welcome");
  const [followUpTab, setFollowUpTab] = useState<FollowUpTab>("general");
  const [settings, setSettings] = useState<GeminiSettingsExtended>(defaultExtended);
  const [keys, setKeys] = useState<GeminiKeyPublic[]>([]);
  const [models, setModels] = useState<GeminiModelOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [modelSlug, setModelSlug] = useState("");
  const [modelLabel, setModelLabel] = useState("");

  async function reload() {
    const state = await fetchGeminiAdminState();
    setSettings(state.settings);
    setKeys(state.keys);
    setModels(state.models);
  }

  useEffect(() => {
    void reload().catch((e) => toast.error((e as Error).message));
  }, []);

  function patchFeatures(patch: Partial<GeminiAiFeatures>) {
    setSettings((s) => ({
      ...s,
      features: { ...s.features, ...patch },
      match_enabled: patch.match_fallback ?? s.features.match_fallback,
    }));
  }

  function patchUi(key: keyof GeminiUiCopy, value: string) {
    setSettings((s) => ({ ...s, ui: { ...s.ui, [key]: value } }));
  }

  function patchFollowUp(key: keyof GeminiFollowUpSettings, value: string) {
    setSettings((s) => ({ ...s, follow_up: { ...s.follow_up, [key]: value } }));
  }

  function patchFollowUpKind(
    kind: Exclude<FollowUpKind, "text">,
    key: keyof GeminiFollowUpKindSettings,
    value: string,
  ) {
    setSettings((s) => ({
      ...s,
      follow_up: { ...s.follow_up, [kind]: { ...s.follow_up[kind], [key]: value } },
    }));
  }

  async function saveSettings() {
    if (!canEdit) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    setBusy(true);
    try {
      const payload = {
        ...settings,
        match_enabled: settings.features.match_fallback,
      };
      await saveGeminiSettingsFn({ data: payload });
      toast.success(lang === "bn" ? "Gemini সেটিংস সেভ হয়েছে" : "Gemini settings saved");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCatalogModel() {
    if (!canEdit) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!modelSlug.trim() || !modelLabel.trim()) return toast.error(lang === "bn" ? "slug ও লেবেল দিন" : "slug and label required");
    setBusy(true);
    try {
      await upsertGeminiModelFn({ data: { slug: modelSlug.trim(), label: modelLabel.trim(), is_active: true } });
      setModelSlug("");
      setModelLabel("");
      toast.success(lang === "bn" ? "মডেল যোগ হয়েছে" : "Model added");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function toggleModel(m: GeminiModelOption) {
    if (!canEdit) return;
    setBusy(true);
    try {
      await upsertGeminiModelFn({ data: { slug: m.slug, label: m.label, is_active: !m.is_active } });
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveKey() {
    if (!canEdit) return toast.error(lang === "bn" ? "অনুমতি নেই" : "No permission");
    if (!name.trim()) return toast.error(lang === "bn" ? "নাম দিন" : "Name required");
    if (!editId && !apiKey.trim()) return toast.error(lang === "bn" ? "API key দিন" : "API key required");
    setBusy(true);
    try {
      await upsertGeminiKeyFn({
        data: { id: editId ?? undefined, name: name.trim(), api_key: apiKey.trim() || undefined },
      });
      setName("");
      setApiKey("");
      setEditId(null);
      toast.success(lang === "bn" ? "সেভ হয়েছে" : "Saved");
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!canEdit) return;
    setBusy(true);
    try {
      await deleteGeminiKeyFn({ data: { id } });
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function test(id?: string) {
    setBusy(true);
    try {
      const { results } = await testGeminiKeyFn({ data: { id } });
      const ok = results.filter((r) => r.ok).length;
      toast.success(lang === "bn" ? `${ok}/${results.length} কাজ করছে` : `${ok}/${results.length} working`);
      await reload();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ModelSelect = ({
    field,
    label,
    hint,
  }: {
    field: keyof Pick<GeminiSettingsExtended, "primary_model" | "fallback_model" | "match_model">;
    label: string;
    hint: string;
  }) => (
    <label className="block space-y-1">
      <span className="text-[11px] font-semibold text-slate-300">{label}</span>
      <select
        value={settings[field]}
        disabled={!canEdit}
        onChange={(e) => setSettings((s) => ({ ...s, [field]: e.target.value }))}
        className={ainp}
      >
        {models
          .filter((m) => m.is_active || m.slug === settings[field])
          .map((m) => (
            <option key={m.slug} value={m.slug}>
              {m.label}
            </option>
          ))}
      </select>
      <span className="text-[10px] text-slate-500">
        {hint} · {lang === "bn" ? "সোর্স: ডাটাবেস" : "Source: database"}
      </span>
    </label>
  );

  const FeatureToggle = ({
    field,
    label,
    hint,
  }: {
    field: keyof GeminiAiFeatures;
    label: string;
    hint: string;
  }) => (
    <label className="flex items-start gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5 cursor-pointer">
      <input
        type="checkbox"
        className="mt-0.5"
        checked={settings.features[field]}
        disabled={!canEdit}
        onChange={(e) => patchFeatures({ [field]: e.target.checked })}
      />
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-200">{label}</span>
        <span className="block text-[10px] text-slate-500 mt-0.5">{hint}</span>
      </span>
    </label>
  );

  const SaveBar = () =>
    canEdit ? (
      <div className="flex flex-wrap gap-2 pt-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void saveSettings()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white"
        >
          <Save className="h-3.5 w-3.5" />
          {lang === "bn" ? "সেভ করুন" : "Save"}
        </button>
      </div>
    ) : null;

  const activePromptValue =
    promptTab === "chat_bn"
      ? settings.prompt_chat_bn
      : promptTab === "chat_en"
        ? settings.prompt_chat_en
        : settings.prompt_match;

  const activePromptDefault =
    promptTab === "chat_bn"
      ? DEFAULT_PROMPT_CHAT_BN
      : promptTab === "chat_en"
        ? DEFAULT_PROMPT_CHAT_EN
        : DEFAULT_PROMPT_MATCH;

  return (
    <div className="space-y-4 max-w-5xl">
      <div>
        <h2 className="text-sm font-bold text-slate-100">Gemini AI</h2>
        <p className="text-xs text-slate-400 mt-1">
          {lang === "bn"
            ? "মডেল, API key, সিস্টেম প্রম্পট, AI ফিচার ও UI কপি — সব Admin থেকে নিয়ন্ত্রণ।"
            : "Control models, API keys, system prompts, AI features, and UI copy from Admin."}
        </p>
      </div>

      <nav className="flex gap-1 overflow-x-auto no-scrollbar rounded-xl border border-slate-800 bg-slate-950 p-1">
        {MAIN_TABS.map((item) => (
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

      {tab === "models" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <p className="text-[11px] text-slate-400">
            {lang === "bn"
              ? "Primary: মূল জেনারেশন। Fallback: প্রাইমারি ফেল করলে। Match: ক্যাটালগ ম্যাচিং।"
              : "Primary: main generation. Fallback: if primary fails. Match: catalog matching."}
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <ModelSelect field="primary_model" label="Primary" hint={lang === "bn" ? "মূল মডেল" : "Main model"} />
            <ModelSelect field="fallback_model" label="Fallback" hint={lang === "bn" ? "বিকল্প মডেল" : "Backup model"} />
            <ModelSelect field="match_model" label="Match" hint={lang === "bn" ? "ম্যাচ মডেল" : "Match model"} />
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={settings.enabled}
              disabled={!canEdit}
              onChange={(e) => setSettings((s) => ({ ...s, enabled: e.target.checked }))}
            />
            {lang === "bn" ? "AI চালু" : "AI enabled"}
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-slate-300">
                {lang === "bn" ? "Thinking লেভেল" : "Thinking level"}
              </span>
              <select
                value={settings.thinking_level ?? "minimal"}
                disabled={!canEdit}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, thinking_level: e.target.value as GeminiThinkingLevel }))
                }
                className={ainp}
              >
                <option value="minimal">minimal (fast)</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high (slow)</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-slate-300">
                {lang === "bn" ? "ম্যাক্স আউটপুট টোকেন" : "Max output tokens"}
              </span>
              <input
                type="number"
                min={256}
                max={4096}
                value={settings.max_output_tokens ?? 1024}
                disabled={!canEdit}
                onChange={(e) => setSettings((s) => ({ ...s, max_output_tokens: Number(e.target.value) || 1024 }))}
                className={ainp}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-slate-300">
                {lang === "bn" ? "ক্যাটালগ আইটেম" : "Catalog items"}
              </span>
              <input
                type="number"
                min={20}
                max={400}
                value={settings.max_catalog_items ?? 120}
                disabled={!canEdit}
                onChange={(e) => setSettings((s) => ({ ...s, max_catalog_items: Number(e.target.value) || 120 }))}
                className={ainp}
              />
            </label>
          </div>
          <SaveBar />
        </section>
      )}

      {tab === "features" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <p className="text-[11px] text-slate-400">
            {lang === "bn"
              ? "প্রতিটি AI আউটপুট আলাদা চালু/বন্ধ করা যায়। JSON স키মা ও UI স্বয়ংক্রিয় আপডেট হয়।"
              : "Toggle each AI output independently. JSON schema and UI update automatically."}
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <FeatureToggle
              field="medical_advice"
              label={lang === "bn" ? "মেডিকেল অ্যাডভাইস (সাধারণ)" : "Medical advice (general)"}
              hint={
                lang === "bn"
                  ? "স্বাস্থ্য তথ্য — রোগ নির্ণয়/ওষুধ নয়।"
                  : "Wellness guidance — no diagnosis or prescriptions."
              }
            />
            <FeatureToggle
              field="catalog_notes"
              label={lang === "bn" ? "ক্যাটালগ ভিত্তিক লেখা" : "Catalog-grounded copy"}
              hint={
                lang === "bn"
                  ? "ডাটাবেসের টেস্ট থেকে ফরম্যাটেড নোট।"
                  : "Formatted notes from catalog tests."
              }
            />
            <FeatureToggle
              field="test_suggestions"
              label={lang === "bn" ? "টেস্ট সাজেশন" : "Test suggestions"}
              hint={lang === "bn" ? "ক্যাটালগ থেকে suggested_tests কার্ড।" : "Suggested test cards from catalog."}
            />
            <FeatureToggle
              field="follow_up_questions"
              label={lang === "bn" ? "ফলো-আপ প্রশ্ন" : "Follow-up questions"}
              hint={lang === "bn" ? "চিপ আকারে ক্লিকযোগ্য প্রশ্ন।" : "Clickable question chips."}
            />
            <FeatureToggle
              field="bundle_offer"
              label={lang === "bn" ? "বান্ডেল বুকিং অফার" : "Bundle booking offer"}
              hint={lang === "bn" ? "২+ টেস্টে সস্তা বুকিং CTA।" : "Cheapest multi-test booking CTA."}
            />
            <FeatureToggle
              field="match_fallback"
              label={lang === "bn" ? "ম্যাচ ফallback (২য় API কল)" : "Match fallback (2nd API call)"}
              hint={
                lang === "bn"
                  ? "ID মিস হলে দ্বিতীয় কল — ধীর কিন্তু নির্ভুল।"
                  : "Second call when IDs miss — slower but accurate."
              }
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-slate-300">
                {lang === "bn" ? "সর্বোচ্চ প্রশ্ন" : "Max questions"}
              </span>
              <input
                type="number"
                min={0}
                max={6}
                value={settings.max_questions}
                disabled={!canEdit}
                onChange={(e) => setSettings((s) => ({ ...s, max_questions: Number(e.target.value) || 0 }))}
                className={ainp}
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] font-semibold text-slate-300">
                {lang === "bn" ? "সর্বোচ্চ সাজেশন" : "Max suggestions"}
              </span>
              <input
                type="number"
                min={0}
                max={12}
                value={settings.max_suggestions}
                disabled={!canEdit}
                onChange={(e) => setSettings((s) => ({ ...s, max_suggestions: Number(e.target.value) || 0 }))}
                className={ainp}
              />
            </label>
          </div>
          <SaveBar />
        </section>
      )}

      {tab === "followup" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <p className="text-[11px] text-slate-400">
            {lang === "bn"
              ? "ফলো-আপ প্রশ্নের উত্তর UI — চিপ, placeholder, regex প্যাটারn, AI ফরম্যাট লেবেল। প্রতি লাইনে একটি চিপ বা regex।"
              : "Follow-up answer UI — chips, placeholders, regex patterns, AI format labels. One chip or regex per line."}
          </p>
          <SubNav items={FOLLOWUP_TABS} active={followUpTab} onChange={setFollowUpTab} lang={lang} />

          {followUpTab === "general" && (
            <div className="space-y-3">
              {FOLLOWUP_GENERAL_FIELDS.map((key) => (
                <label key={key} className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-300">
                    {lang === "bn" ? FOLLOWUP_LABELS[key]?.bn : FOLLOWUP_LABELS[key]?.en}
                  </span>
                  <input
                    value={String(settings.follow_up[key] ?? "")}
                    disabled={!canEdit}
                    onChange={(e) => patchFollowUp(key, e.target.value)}
                    className={ainp + (key === "bubble_prefix" ? "" : " text-[12px]")}
                  />
                </label>
              ))}
            </div>
          )}

          {followUpTab === "text" && (
            <div className="space-y-3">
              {(["text_placeholder_bn", "text_placeholder_en"] as const).map((key) => (
                <label key={key} className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-300">
                    {lang === "bn" ? FOLLOWUP_LABELS[key].bn : FOLLOWUP_LABELS[key].en}
                  </span>
                  <input
                    value={settings.follow_up[key]}
                    disabled={!canEdit}
                    onChange={(e) => patchFollowUp(key, e.target.value)}
                    className={ainp}
                  />
                </label>
              ))}
            </div>
          )}

          {followUpTab !== "general" && followUpTab !== "text" && (
            <div className="space-y-3">
              {(
                [
                  ["patterns", 8, true],
                  ["quick_replies_bn", 6, false],
                  ["quick_replies_en", 6, false],
                  ["placeholder_bn", 1, false],
                  ["placeholder_en", 1, false],
                ] as const
              ).map(([key, rows, mono]) => (
                <label key={key} className="block space-y-1">
                  <span className="text-[11px] font-semibold text-slate-300">
                    {lang === "bn" ? FOLLOWUP_LABELS[key].bn : FOLLOWUP_LABELS[key].en}
                  </span>
                  {rows > 1 ? (
                    <textarea
                      value={settings.follow_up[followUpTab][key]}
                      disabled={!canEdit}
                      rows={rows}
                      onChange={(e) => patchFollowUpKind(followUpTab, key, e.target.value)}
                      className={ainp + (mono ? " font-mono text-[11px]" : " text-[12px]")}
                    />
                  ) : (
                    <input
                      value={settings.follow_up[followUpTab][key]}
                      disabled={!canEdit}
                      onChange={(e) => patchFollowUpKind(followUpTab, key, e.target.value)}
                      className={ainp}
                    />
                  )}
                </label>
              ))}
              <p className="text-[10px] text-slate-500">
                {lang === "bn"
                  ? "Regex: প্রশ্নের টেক্সটে মিললে এই ধরন (duration/yes_no/…) বেছে নেয়। অগ্রাধিকার: duration → age → severity → yes_no → text।"
                  : "Regex: matched against question text to pick this kind. Priority: duration → age → severity → yes_no → text."}
              </p>
            </div>
          )}

          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <SaveBar />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (followUpTab === "general" || followUpTab === "text") {
                    setSettings((s) => ({
                      ...s,
                      follow_up: {
                        ...s.follow_up,
                        ...(followUpTab === "general"
                          ? Object.fromEntries(
                              FOLLOWUP_GENERAL_FIELDS.map((k) => [k, DEFAULT_GEMINI_FOLLOWUP[k]]),
                            )
                          : {
                              text_placeholder_bn: DEFAULT_GEMINI_FOLLOWUP.text_placeholder_bn,
                              text_placeholder_en: DEFAULT_GEMINI_FOLLOWUP.text_placeholder_en,
                            }),
                      },
                    }));
                  } else {
                    setSettings((s) => ({
                      ...s,
                      follow_up: {
                        ...s.follow_up,
                        [followUpTab]: { ...DEFAULT_GEMINI_FOLLOWUP[followUpTab] },
                      },
                    }));
                  }
                }}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                {lang === "bn" ? "এই ট্যাব ডিফল্ট" : "Reset this tab"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => setSettings((s) => ({ ...s, follow_up: { ...DEFAULT_GEMINI_FOLLOWUP } }))}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                {lang === "bn" ? "সব ফলো-আপ ডিফল্ট" : "Reset all follow-up"}
              </button>
            </div>
          )}
        </section>
      )}

      {tab === "prompts" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <p className="text-[11px] text-slate-400">
            {lang === "bn"
              ? "ট্যাব ক্লিক করে প্রম্পট দেখুন/এডিট করুন। {{catalog}} ও {{lang}} প্লেসহোল্ডার। AI ফিচার অনুযায়ী JSON স키মা স্বয়ংক্রিয় যোগ হয়।"
              : "Click a tab to view/edit each prompt. Placeholders: {{catalog}}, {{lang}}. JSON schema is appended based on enabled features."}
          </p>
          <SubNav items={PROMPT_TABS} active={promptTab} onChange={setPromptTab} lang={lang} />
          <textarea
            value={activePromptValue ?? activePromptDefault}
            disabled={!canEdit}
            rows={16}
            onChange={(e) => {
              const v = e.target.value;
              if (promptTab === "chat_bn") setSettings((s) => ({ ...s, prompt_chat_bn: v }));
              else if (promptTab === "chat_en") setSettings((s) => ({ ...s, prompt_chat_en: v }));
              else setSettings((s) => ({ ...s, prompt_match: v }));
            }}
            className={ainp + " font-mono text-[12px] min-h-72"}
          />
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <SaveBar />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (promptTab === "chat_bn")
                    setSettings((s) => ({ ...s, prompt_chat_bn: DEFAULT_PROMPT_CHAT_BN }));
                  else if (promptTab === "chat_en")
                    setSettings((s) => ({ ...s, prompt_chat_en: DEFAULT_PROMPT_CHAT_EN }));
                  else setSettings((s) => ({ ...s, prompt_match: DEFAULT_PROMPT_MATCH }));
                }}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                {lang === "bn" ? "এই ট্যাব ডিফল্ট" : "Reset this tab"}
              </button>
            </div>
          )}
        </section>
      )}

      {tab === "ui" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <p className="text-[11px] text-slate-400">
            {lang === "bn"
              ? "রোগীর AI পেজে দেখানো টেক্সট। ট্যাব ক্লিক করে গ্রুপ অনুযায়ী এডিট করুন।"
              : "Text shown on the patient AI page. Click tabs to edit by group."}
          </p>
          <SubNav items={UI_TABS} active={uiTab} onChange={setUiTab} lang={lang} />
          <div className="space-y-3">
            {UI_FIELDS[uiTab].map((key) => (
              <label key={key} className="block space-y-1">
                <span className="text-[11px] font-semibold text-slate-300">
                  {lang === "bn" ? UI_LABELS[key].bn : UI_LABELS[key].en}
                </span>
                <textarea
                  value={settings.ui[key]}
                  disabled={!canEdit}
                  rows={key.includes("welcome") || key.includes("disclaimer") ? 3 : 2}
                  onChange={(e) => patchUi(key, e.target.value)}
                  className={ainp + " text-[12px]"}
                />
              </label>
            ))}
          </div>
          {canEdit && (
            <div className="flex flex-wrap gap-2">
              <SaveBar />
              <button
                type="button"
                disabled={busy}
                onClick={() => setSettings((s) => ({ ...s, ui: { ...DEFAULT_GEMINI_UI } }))}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200"
              >
                {lang === "bn" ? "UI ডিফল্ট" : "Reset UI defaults"}
              </button>
            </div>
          )}
        </section>
      )}

      {tab === "catalog" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <p className="text-[11px] font-semibold text-slate-300">
            {lang === "bn" ? "মডেল ক্যাটালগ (ডাটাবেস)" : "Model catalog (database)"}
          </p>
          <ul className="space-y-1 max-h-80 overflow-y-auto">
            {models.map((m) => (
              <li key={m.slug} className="flex items-center gap-2 text-[11px]">
                <span className="flex-1 font-mono text-slate-300 truncate">{m.slug}</span>
                <span className="text-slate-400 truncate">{m.label}</span>
                {canEdit && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void toggleModel(m)}
                    className="rounded-md border border-slate-700 px-2 py-0.5"
                  >
                    {m.is_active ? (lang === "bn" ? "চালু" : "On") : lang === "bn" ? "বন্ধ" : "Off"}
                  </button>
                )}
              </li>
            ))}
          </ul>
          {canEdit && (
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                value={modelSlug}
                onChange={(e) => setModelSlug(e.target.value)}
                placeholder="slug (gemini-…)"
                className={ainp + " font-mono"}
              />
              <input
                value={modelLabel}
                onChange={(e) => setModelLabel(e.target.value)}
                placeholder={lang === "bn" ? "লেবেল" : "Label"}
                className={ainp}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveCatalogModel()}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold"
              >
                {lang === "bn" ? "ক্যাটালগে যোগ" : "Add to catalog"}
              </button>
            </div>
          )}
        </section>
      )}

      {tab === "keys" && (
        <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xs font-bold text-slate-200 flex-1">
              {lang === "bn" ? "সংরক্ষিত API Keys" : "Saved API keys"} · {keys.length}
            </h3>
            <button
              type="button"
              disabled={busy}
              onClick={() => void test()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200"
            >
              <Zap className="h-3.5 w-3.5" />
              {lang === "bn" ? "সব পরীক্ষা" : "Test all"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void reload()}
              className="h-8 w-8 grid place-items-center rounded-lg border border-slate-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>

          {canEdit && (
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={lang === "bn" ? "নাম" : "Name"}
                className={ainp}
              />
              <input
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  editId
                    ? lang === "bn"
                      ? "নতুন key (খালি = আগেরটা)"
                      : "New key (blank = keep)"
                    : "API key"
                }
                className={ainp + " font-mono"}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void saveKey()}
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white inline-flex items-center justify-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                {editId ? (lang === "bn" ? "আপডেট" : "Update") : lang === "bn" ? "যোগ করুন" : "Add"}
              </button>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-500 text-left">
                <tr>
                  <th className="py-2 pr-2">#</th>
                  <th className="py-2 pr-2">{lang === "bn" ? "নাম" : "Name"}</th>
                  <th className="py-2 pr-2">API Key</th>
                  <th className="py-2 pr-2">{lang === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                  <th className="py-2 pr-2">{lang === "bn" ? "শেষ ব্যবহার" : "Last used"}</th>
                  <th className="py-2 pr-2">{lang === "bn" ? "ত্রুটি" : "Errors"}</th>
                  <th className="py-2">{lang === "bn" ? "অ্যাকশন" : "Actions"}</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k, i) => (
                  <tr key={k.id} className="border-t border-slate-800">
                    <td className="py-2 pr-2 text-slate-500">{i + 1}</td>
                    <td className="py-2 pr-2 font-semibold text-slate-100">{k.name}</td>
                    <td className="py-2 pr-2 font-mono text-slate-400">{k.masked}</td>
                    <td className="py-2 pr-2">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${statusClass(k.status)}`}
                      >
                        {statusLabel(k.status, lang)}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-slate-400 whitespace-nowrap">
                      {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : "—"}
                    </td>
                    <td className="py-2 pr-2 tabular-nums">{k.error_count}</td>
                    <td className="py-2">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void test(k.id)}
                          className="h-7 w-7 grid place-items-center rounded-md hover:bg-slate-800"
                          title="Test"
                        >
                          <Zap className="h-3.5 w-3.5 text-amber-400" />
                        </button>
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditId(k.id);
                                setName(k.name);
                                setApiKey("");
                              }}
                              className="h-7 w-7 grid place-items-center rounded-md hover:bg-slate-800"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void remove(k.id)}
                              className="h-7 w-7 grid place-items-center rounded-md hover:bg-slate-800 text-rose-400"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {keys.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">
                      {lang === "bn" ? "কোনো key নেই" : "No keys yet"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
