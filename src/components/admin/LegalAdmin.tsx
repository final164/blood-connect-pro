import { useEffect, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import { useAdminAccess } from "@/lib/admin-access-context";
import {
  DEFAULT_LEGAL_SETTINGS,
  LEGAL_DOC_PATHS,
  fetchLegalSettings,
  invalidateLegalSettingsCache,
  makeLegalSectionId,
  saveLegalSettings,
  type LegalDoc,
  type LegalDocKey,
  type LegalSection,
  type LegalSettings,
} from "@/lib/legal-settings";

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
      <input
        type="checkbox"
        className="h-4 w-4 accent-rose-500"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

export function LegalAdmin() {
  const { lang } = useI18n();
  const { can } = useAdminAccess();
  const bn = lang === "bn";
  const [s, setS] = useState<LegalSettings>({ ...DEFAULT_LEGAL_SETTINGS });
  const [docKey, setDocKey] = useState<LegalDocKey>("privacy");
  const [busy, setBusy] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [schemaHint, setSchemaHint] = useState(false);

  useEffect(() => {
    void fetchLegalSettings(true).then(setS);
  }, []);

  const doc = s[docKey];
  const editable = can("settings.edit");

  function patchDoc(patch: Partial<LegalDoc>) {
    setS((prev) => ({ ...prev, [docKey]: { ...prev[docKey], ...patch } }));
  }

  function patchSection(id: string, patch: Partial<LegalSection>) {
    patchDoc({
      sections: doc.sections.map((sec) => (sec.id === id ? { ...sec, ...patch } : sec)),
    });
  }

  function addSection() {
    const id = makeLegalSectionId();
    const maxOrder = doc.sections.reduce((m, x) => Math.max(m, x.sort_order ?? 0), 0);
    patchDoc({
      sections: [
        ...doc.sections,
        {
          id,
          heading_bn: "",
          heading_en: "",
          body_bn: "",
          body_en: "",
          sort_order: maxOrder + 1,
          is_active: true,
        },
      ],
    });
    setOpenSection(id);
  }

  function removeSection(id: string) {
    if (!confirm(bn ? "এই অংশটি মুছে ফেলবেন?" : "Delete this section?")) return;
    patchDoc({ sections: doc.sections.filter((sec) => sec.id !== id) });
  }

  function moveSection(id: string, dir: -1 | 1) {
    const ordered = [...doc.sections].sort((a, b) => a.sort_order - b.sort_order);
    const idx = ordered.findIndex((sec) => sec.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= ordered.length) return;
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    patchDoc({ sections: ordered.map((sec, i) => ({ ...sec, sort_order: i + 1 })) });
  }

  async function save() {
    if (!editable) return toast.error(bn ? "অনুমতি নেই" : "No permission");
    setBusy(true);
    setSchemaHint(false);
    try {
      await saveLegalSettings(s);
      invalidateLegalSettingsCache();
      toast.success(bn ? "আইনি পেজ সেভ হয়েছে" : "Legal pages saved");
    } catch (e) {
      const msg = (e as Error).message;
      if (/legal_settings/i.test(msg)) setSchemaHint(true);
      toast.error(msg);
    } finally {
      setBusy(false);
    }
  }

  function resetDefaults() {
    if (
      !confirm(
        bn
          ? "ডিফল্ট আইনি টেক্সটে ফিরে যাবেন? এখনকার এডিট হারিয়ে যাবে।"
          : "Reset to the default legal text? Current edits will be lost.",
      )
    )
      return;
    setS({ ...DEFAULT_LEGAL_SETTINGS });
    toast.message(bn ? "ডিফল্ট লোড — সেভ করুন" : "Defaults loaded — click Save");
  }

  const docTabs: { id: LegalDocKey; bn: string; en: string }[] = [
    { id: "privacy", bn: "গোপনীয়তা নীতি", en: "Privacy Policy" },
    { id: "terms", bn: "সেবার শর্তাবলী", en: "Terms of Service" },
  ];

  const ordered = [...doc.sections].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4 max-w-3xl">
      {schemaHint && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs text-amber-100">
          {bn
            ? "ডেটাবেজে legal_settings কলাম নেই। supabase/migrations এর নতুন migration চালান, তারপর আবার সেভ করুন।"
            : "The legal_settings column is missing. Apply the new migration in supabase/migrations, then save again."}
        </div>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 text-xs text-slate-300 space-y-2">
        <p className="font-semibold text-slate-100">
          {bn ? "পাবলিক লিংক" : "Public links"}
        </p>
        <div className="flex flex-wrap gap-2">
          {docTabs.map((tab) => (
            <a
              key={tab.id}
              href={LEGAL_DOC_PATHS[tab.id]}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-[11px] text-slate-200 hover:border-rose-500 hover:text-white"
            >
              {LEGAL_DOC_PATHS[tab.id]}
              <ExternalLink className="h-3 w-3" />
            </a>
          ))}
        </div>
        <p className="text-slate-400">
          {bn
            ? "Google Console / Play Store এ এই দুটি লিংক সাইটের ডোমেইনসহ দিন।"
            : "Use these two paths with your site domain in Google Console / Play Store."}
        </p>
      </div>

      <nav className="flex gap-1 rounded-xl border border-slate-800 bg-slate-950 p-1">
        {docTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setDocKey(tab.id);
              setOpenSection(null);
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
              docKey === tab.id
                ? "bg-rose-600 text-white shadow"
                : "text-slate-400 hover:bg-slate-900 hover:text-slate-200"
            }`}
          >
            {bn ? tab.bn : tab.en}
          </button>
        ))}
      </nav>

      {editable && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={resetDefaults}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {bn ? "ডিফল্ট" : "Reset defaults"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            <Save className="h-3.5 w-3.5" />
            {busy ? "…" : bn ? "সেভ" : "Save"}
          </button>
        </div>
      )}

      <Section title={bn ? "পেজ সেটিংস" : "Page settings"}>
        <ToggleRow
          label={bn ? "পেজটি চালু" : "Page enabled"}
          checked={doc.enabled}
          onChange={(v) => patchDoc({ enabled: v })}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={bn ? "শিরোনাম (বাংলা)" : "Title BN"}>
            <input
              className={ainp}
              value={doc.title_bn}
              onChange={(e) => patchDoc({ title_bn: e.target.value })}
            />
          </Field>
          <Field label={bn ? "শিরোনাম (English)" : "Title EN"}>
            <input
              className={ainp}
              value={doc.title_en}
              onChange={(e) => patchDoc({ title_en: e.target.value })}
            />
          </Field>
        </div>
        <Field label={bn ? "কার্যকর তারিখ" : "Effective date"}>
          <input
            type="date"
            className={ainp}
            value={doc.effective_date}
            onChange={(e) => patchDoc({ effective_date: e.target.value })}
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={bn ? "ভূমিকা (বাংলা)" : "Intro BN"}>
            <textarea
              className={`${ainp} min-h-[110px]`}
              value={doc.intro_bn}
              onChange={(e) => patchDoc({ intro_bn: e.target.value })}
            />
          </Field>
          <Field label={bn ? "ভূমিকা (English)" : "Intro EN"}>
            <textarea
              className={`${ainp} min-h-[110px]`}
              value={doc.intro_en}
              onChange={(e) => patchDoc({ intro_en: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <Section title={bn ? `অংশসমূহ (${ordered.length})` : `Sections (${ordered.length})`}>
        <p className="text-[11px] text-slate-400">
          {bn
            ? 'প্রতিটি খালি লাইন নতুন প্যারাগ্রাফ তৈরি করে। লাইনের শুরুতে "- " দিলে সেটি বুলেট পয়েন্ট হবে।'
            : 'A blank line starts a new paragraph. A line beginning with "- " becomes a bullet point.'}
        </p>

        {ordered.map((sec, i) => {
          const open = openSection === sec.id;
          const heading = (bn ? sec.heading_bn : sec.heading_en) || sec.heading_bn || sec.heading_en;
          return (
            <div key={sec.id} className="rounded-lg border border-slate-800 bg-slate-950">
              <div className="flex items-center gap-2 p-2.5">
                <button
                  type="button"
                  onClick={() => setOpenSection(open ? null : sec.id)}
                  className="flex flex-1 items-center gap-2 text-left text-xs font-semibold text-slate-200 min-w-0"
                >
                  <span className="shrink-0 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                    {i + 1}
                  </span>
                  <span className="truncate">
                    {heading || (bn ? "নতুন অংশ" : "New section")}
                  </span>
                  {!sec.is_active && (
                    <span className="shrink-0 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-200">
                      {bn ? "লুকানো" : "hidden"}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(sec.id, -1)}
                  disabled={i === 0}
                  className="rounded p-1 text-slate-400 hover:bg-slate-900 hover:text-slate-100 disabled:opacity-30"
                  aria-label={bn ? "উপরে" : "Move up"}
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(sec.id, 1)}
                  disabled={i === ordered.length - 1}
                  className="rounded p-1 text-slate-400 hover:bg-slate-900 hover:text-slate-100 disabled:opacity-30"
                  aria-label={bn ? "নিচে" : "Move down"}
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                {editable && (
                  <button
                    type="button"
                    onClick={() => removeSection(sec.id)}
                    className="rounded p-1 text-slate-400 hover:bg-rose-600/20 hover:text-rose-300"
                    aria-label={bn ? "মুছুন" : "Delete"}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {open && (
                <div className="space-y-3 border-t border-slate-800 p-3">
                  <ToggleRow
                    label={bn ? "পেজে দেখানো হবে" : "Show on page"}
                    checked={sec.is_active}
                    onChange={(v) => patchSection(sec.id, { is_active: v })}
                  />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={bn ? "হেডিং (বাংলা)" : "Heading BN"}>
                      <input
                        className={ainp}
                        value={sec.heading_bn}
                        onChange={(e) => patchSection(sec.id, { heading_bn: e.target.value })}
                      />
                    </Field>
                    <Field label={bn ? "হেডিং (English)" : "Heading EN"}>
                      <input
                        className={ainp}
                        value={sec.heading_en}
                        onChange={(e) => patchSection(sec.id, { heading_en: e.target.value })}
                      />
                    </Field>
                  </div>
                  <Field label={bn ? "লেখা (বাংলা)" : "Body BN"}>
                    <textarea
                      className={`${ainp} min-h-[180px] font-[inherit]`}
                      value={sec.body_bn}
                      onChange={(e) => patchSection(sec.id, { body_bn: e.target.value })}
                    />
                  </Field>
                  <Field label={bn ? "লেখা (English)" : "Body EN"}>
                    <textarea
                      className={`${ainp} min-h-[180px] font-[inherit]`}
                      value={sec.body_en}
                      onChange={(e) => patchSection(sec.id, { body_en: e.target.value })}
                    />
                  </Field>
                </div>
              )}
            </div>
          );
        })}

        {editable && (
          <button
            type="button"
            onClick={addSection}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-900"
          >
            <Plus className="h-3.5 w-3.5" />
            {bn ? "নতুন অংশ" : "Add section"}
          </button>
        )}
      </Section>

      <Section title={bn ? "যোগাযোগের তথ্য (দুই পেজেই দেখাবে)" : "Contact details (shown on both pages)"}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={bn ? "ইমেইল" : "Email"}>
            <input
              className={ainp}
              placeholder="support@muktosheba.com"
              value={s.contact_email}
              onChange={(e) => setS({ ...s, contact_email: e.target.value })}
            />
          </Field>
          <Field label={bn ? "ফোন" : "Phone"}>
            <input
              className={ainp}
              placeholder="+8801XXXXXXXXX"
              value={s.contact_phone}
              onChange={(e) => setS({ ...s, contact_phone: e.target.value })}
            />
          </Field>
          <Field label={bn ? "ঠিকানা (বাংলা)" : "Address BN"}>
            <input
              className={ainp}
              value={s.contact_address_bn}
              onChange={(e) => setS({ ...s, contact_address_bn: e.target.value })}
            />
          </Field>
          <Field label={bn ? "ঠিকানা (English)" : "Address EN"}>
            <input
              className={ainp}
              value={s.contact_address_en}
              onChange={(e) => setS({ ...s, contact_address_en: e.target.value })}
            />
          </Field>
        </div>
      </Section>
    </div>
  );
}
