import { useEffect, useState } from "react";
import {
  ChevronDown,
  HelpCircle,
  Info,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  newOrgFaq,
  parseOrgPortalContent,
  saveOrgPortalContent,
  type OrgPortalAdvanced,
  type OrgPortalContent,
  type OrgPortalFaq,
} from "@/lib/community-org-portal";

const field =
  "w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/25";

const ADVANCED_TOGGLES: {
  key: keyof Pick<
    OrgPortalAdvanced,
    | "show_donor_count_public"
    | "show_open_requests_public"
    | "show_phone_public"
    | "highlight_verified_badge"
    | "accept_inbound_requests"
    | "notify_members_on_request"
  >;
  bn: string;
  en: string;
  hintBn: string;
  hintEn: string;
}[] = [
  {
    key: "show_donor_count_public",
    bn: "পাবলিক পেজে রক্তদাতা সংখ্যা",
    en: "Show donor count publicly",
    hintBn: "ভিজিটররা মোট ডোনার দেখতে পারবে",
    hintEn: "Visitors see total donors",
  },
  {
    key: "show_open_requests_public",
    bn: "পাবলিক পেজে ওপেন রিকোয়েস্ট",
    en: "Show open requests publicly",
    hintBn: "চলমান রিকোয়েস্ট কাউন্ট দেখাবে",
    hintEn: "Shows live open-request count",
  },
  {
    key: "show_phone_public",
    bn: "পাবলিক ফোন নম্বর",
    en: "Show phone on public page",
    hintBn: "প্রোফাইলে ফোন লুকানো/দেখানো",
    hintEn: "Hide or show org phone",
  },
  {
    key: "highlight_verified_badge",
    bn: "ভেরিফাইড ব্যাজ হাইলাইট",
    en: "Highlight verified badge",
    hintBn: "ভেরিফাইড হলে ব্যাজ জোরালো দেখাবে",
    hintEn: "Emphasize verified status",
  },
  {
    key: "accept_inbound_requests",
    bn: "ইনবাউন্ড রিকোয়েস্ট গ্রহণ",
    en: "Accept inbound requests",
    hintBn: "কমিউনিটি থেকে নতুন রিকোয়েস্ট আসবে",
    hintEn: "Receive community blood requests",
  },
  {
    key: "notify_members_on_request",
    bn: "নতুন রিকোয়েস্টে মেম্বার নোটিফাই",
    en: "Notify members on new request",
    hintBn: "মেম্বারদের অ্যালার্ট (যদি চালু থাকে)",
    hintEn: "Alert members when enabled",
  },
];

export function OrgOverviewPortal({
  orgId,
  lang,
  canEdit,
  initialPortal,
  fallbackAboutBn,
  fallbackAboutEn,
  onSaved,
}: {
  orgId: string;
  lang: "bn" | "en";
  canEdit: boolean;
  initialPortal?: unknown;
  fallbackAboutBn?: string | null;
  fallbackAboutEn?: string | null;
  onSaved?: () => void;
}) {
  const [content, setContent] = useState<OrgPortalContent>(() => {
    const parsed = parseOrgPortalContent(initialPortal);
    if (!parsed.about_bn && fallbackAboutBn) parsed.about_bn = fallbackAboutBn;
    if (!parsed.about_en && fallbackAboutEn) parsed.about_en = fallbackAboutEn;
    return parsed;
  });
  const [busy, setBusy] = useState(false);
  const [faqOpen, setFaqOpen] = useState(true);
  const [advOpen, setAdvOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState<string | null>(null);

  useEffect(() => {
    const parsed = parseOrgPortalContent(initialPortal);
    if (!parsed.about_bn && fallbackAboutBn) parsed.about_bn = fallbackAboutBn;
    if (!parsed.about_en && fallbackAboutEn) parsed.about_en = fallbackAboutEn;
    setContent(parsed);
  }, [orgId, initialPortal, fallbackAboutBn, fallbackAboutEn]);

  async function save(next: OrgPortalContent = content) {
    if (!canEdit) return;
    setBusy(true);
    try {
      const saved = await saveOrgPortalContent(orgId, next);
      setContent(saved);
      toast.success(lang === "bn" ? "সেভ হয়েছে" : "Saved");
      onSaved?.();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function updateFaq(id: string, patch: Partial<OrgPortalFaq>) {
    setContent((c) => ({
      ...c,
      faqs: c.faqs.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    }));
  }

  function addFaq() {
    const f = newOrgFaq();
    setContent((c) => ({ ...c, faqs: [...c.faqs, f] }));
    setOpenFaqId(f.id);
    setFaqOpen(true);
  }

  function removeFaq(id: string) {
    setContent((c) => ({ ...c, faqs: c.faqs.filter((f) => f.id !== id) }));
  }

  return (
    <div className="space-y-4">
      {/* About us */}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center gap-3 border-b bg-linear-to-r from-primary/[0.07] to-transparent px-4 py-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/12 text-primary">
            <Info className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">
              {lang === "bn" ? "আমাদের সম্পর্কে" : "About us"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {lang === "bn"
                ? "পাবলিক প্রোফাইলে যে বর্ণনা দেখাবে"
                : "Shown on your public organization profile"}
            </p>
          </div>
          <Sparkles className="ml-auto h-4 w-4 text-primary/50" />
        </div>
        <div className="space-y-3 p-4">
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">
              {lang === "bn" ? "বাংলা" : "Bangla"}
            </span>
            <textarea
              className={`${field} min-h-[88px] resize-y leading-relaxed`}
              disabled={!canEdit || busy}
              value={content.about_bn}
              onChange={(e) => setContent({ ...content, about_bn: e.target.value })}
              placeholder={
                lang === "bn"
                  ? "সংস্থার লক্ষ্য, এলাকা, কার্যক্রম…"
                  : "Mission, area, activities…"
              }
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground">English</span>
            <textarea
              className={`${field} min-h-[72px] resize-y leading-relaxed`}
              disabled={!canEdit || busy}
              value={content.about_en}
              onChange={(e) => setContent({ ...content, about_en: e.target.value })}
              placeholder="Mission, coverage area, activities…"
            />
          </label>
          {canEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void save()}
              className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? "…" : lang === "bn" ? "আবাউট সেভ" : "Save about"}
            </button>
          )}
        </div>
      </section>

      {/* Q/A */}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <button
          type="button"
          onClick={() => setFaqOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-500/12 text-sky-700 dark:text-sky-400">
            <HelpCircle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">
              {lang === "bn" ? "প্রশ্নোত্তর (Q/A)" : "Q & A"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {content.faqs.length
                ? lang === "bn"
                  ? `${content.faqs.length}টি প্রশ্ন`
                  : `${content.faqs.length} question(s)`
                : lang === "bn"
                  ? "সাধারণ প্রশ্নের উত্তর যোগ করুন"
                  : "Add frequently asked answers"}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${faqOpen ? "rotate-180" : ""}`}
          />
        </button>

        {faqOpen && (
          <div className="space-y-3 border-t px-4 py-3">
            {content.faqs.length === 0 && (
              <p className="rounded-xl border border-dashed bg-muted/20 px-3 py-6 text-center text-xs text-muted-foreground">
                {lang === "bn"
                  ? "এখনো কোনো Q/A নেই — নিচে যোগ করুন"
                  : "No Q/A yet — add one below"}
              </p>
            )}
            {content.faqs.map((f, idx) => {
              const open = openFaqId === f.id;
              const q = lang === "bn" ? f.question_bn || f.question_en : f.question_en || f.question_bn;
              return (
                <div key={f.id} className="overflow-hidden rounded-xl border bg-muted/20">
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(open ? null : f.id)}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
                  >
                    <span className="grid h-6 w-6 place-items-center rounded-lg bg-sky-500/15 text-[10px] font-bold text-sky-700">
                      {idx + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                      {q || (lang === "bn" ? "নতুন প্রশ্ন" : "New question")}
                    </span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                    />
                  </button>
                  {open && (
                    <div className="space-y-2 border-t px-3 py-3">
                      <input
                        className={field}
                        disabled={!canEdit}
                        placeholder={lang === "bn" ? "প্রশ্ন (বাংলা)" : "Question (Bangla)"}
                        value={f.question_bn}
                        onChange={(e) => updateFaq(f.id, { question_bn: e.target.value })}
                      />
                      <input
                        className={field}
                        disabled={!canEdit}
                        placeholder="Question (English)"
                        value={f.question_en}
                        onChange={(e) => updateFaq(f.id, { question_en: e.target.value })}
                      />
                      <textarea
                        className={`${field} min-h-[64px] resize-y`}
                        disabled={!canEdit}
                        placeholder={lang === "bn" ? "উত্তর (বাংলা)" : "Answer (Bangla)"}
                        value={f.answer_bn}
                        onChange={(e) => updateFaq(f.id, { answer_bn: e.target.value })}
                      />
                      <textarea
                        className={`${field} min-h-[56px] resize-y`}
                        disabled={!canEdit}
                        placeholder="Answer (English)"
                        value={f.answer_en}
                        onChange={(e) => updateFaq(f.id, { answer_en: e.target.value })}
                      />
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => removeFaq(f.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive hover:underline"
                        >
                          <Trash2 className="h-3 w-3" />
                          {lang === "bn" ? "মুছুন" : "Remove"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {canEdit && (
              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  onClick={addFaq}
                  className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold hover:bg-muted"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {lang === "bn" ? "প্রশ্ন যোগ" : "Add question"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void save()}
                  className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {busy ? "…" : lang === "bn" ? "Q/A সেভ" : "Save Q/A"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Advanced */}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <button
          type="button"
          onClick={() => setAdvOpen((v) => !v)}
          className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-muted/40"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-500/12 text-violet-700 dark:text-violet-400">
            <Settings2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">
              {lang === "bn" ? "অ্যাডভান্সড অপশন" : "Advanced options"}
            </h2>
            <p className="text-[11px] text-muted-foreground">
              {lang === "bn"
                ? "পাবলিক ভিউ ও নোটিফিকেশন নিয়ন্ত্রণ"
                : "Public view & notification controls"}
            </p>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${advOpen ? "rotate-180" : ""}`}
          />
        </button>

        {advOpen && (
          <div className="space-y-3 border-t px-4 py-3">
            <div className="grid gap-2">
              {ADVANCED_TOGGLES.map((t) => (
                <label
                  key={t.key}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border bg-muted/20 px-3 py-2.5 transition hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-primary accent-primary"
                    disabled={!canEdit}
                    checked={content.advanced[t.key]}
                    onChange={(e) =>
                      setContent({
                        ...content,
                        advanced: { ...content.advanced, [t.key]: e.target.checked },
                      })
                    }
                  />
                  <span className="min-w-0">
                    <span className="block text-xs font-semibold">
                      {lang === "bn" ? t.bn : t.en}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {lang === "bn" ? t.hintBn : t.hintEn}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">
                {lang === "bn" ? "ওয়েলকাম মেসেজ (বাংলা)" : "Welcome message (Bangla)"}
              </span>
              <input
                className={field}
                disabled={!canEdit}
                value={content.advanced.welcome_bn}
                onChange={(e) =>
                  setContent({
                    ...content,
                    advanced: { ...content.advanced, welcome_bn: e.target.value },
                  })
                }
                placeholder={
                  lang === "bn" ? "পাবলিক পেজের শুভেচ্ছা…" : "Greeting on public page…"
                }
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground">
                Welcome message (English)
              </span>
              <input
                className={field}
                disabled={!canEdit}
                value={content.advanced.welcome_en}
                onChange={(e) =>
                  setContent({
                    ...content,
                    advanced: { ...content.advanced, welcome_en: e.target.value },
                  })
                }
                placeholder="Greeting on public page…"
              />
            </label>
            {canEdit && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void save()}
                className="rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
              >
                {busy ? "…" : lang === "bn" ? "অ্যাডভান্সড সেভ" : "Save advanced"}
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
