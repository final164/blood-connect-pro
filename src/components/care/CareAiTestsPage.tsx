import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, FlaskConical, Send, Sparkles, ShoppingBag, Stethoscope, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { useI18n } from "@/lib/i18n";
import { DistrictTypeahead } from "@/components/district/DistrictTypeahead";
import type { District } from "@/lib/api";
import { fetchTestCatalog } from "@/lib/care-cms";
import { searchTestOfferings, type CareOffering } from "@/lib/care-lab-api";
import {
  careAiTestChat,
  fetchCareAiPublicConfig,
  type CareAiChatMessage,
  type CareAiPublicConfig,
  type CareAiSuggestedTest,
} from "@/lib/care-ai-chat";
import { loadBundlePlan, type BundlePlan } from "@/lib/care-ai-bundle";
import { CareAiBundleSheet } from "@/components/care/CareAiBundleSheet";
import { CareAiFollowUpPanel } from "@/components/care/CareAiFollowUpPanel";
import {
  displayAnswerBubble,
  formatFollowUpAnswer,
  parseFollowUpQuestions,
  type FollowUpQuestion,
} from "@/lib/care-ai-followup";

type ChatBubble = CareAiChatMessage & {
  medicalAdvice?: string;
  catalogNotes?: string;
  questions?: string[];
  suggestions?: CareAiSuggestedTest[];
  offerBundle?: boolean;
  /** Text sent to Gemini (may differ from bubble display for follow-ups). */
  apiText?: string;
  /** Display-only: user answered a follow-up question */
  followUpQuestion?: string;
};

type CatalogCard = {
  catalogId: string;
  code: string;
  reason: string;
  nameBn: string;
  nameEn: string;
  cheapest: number | null;
  clinicCount: number;
  cheapestOfferingId: string | null;
};

function welcomeBubble(text: string): ChatBubble {
  return { role: "assistant", text };
}

function AiSection({
  icon: Icon,
  title,
  body,
  accent,
}: {
  icon: typeof Stethoscope;
  title: string;
  body: string;
  accent: string;
}) {
  if (!body.trim()) return null;
  return (
    <div className={`mt-2 rounded-xl border px-2.5 py-2 ${accent}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 flex items-center gap-1 mb-1">
        <Icon className="h-3 w-3" />
        {title}
      </p>
      <p className="text-xs whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  );
}

export function CareAiTestsPage() {
  const { lang } = useI18n();
  const [aiConfig, setAiConfig] = useState<CareAiPublicConfig | null>(null);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [district, setDistrict] = useState<District | null>(null);
  const [cart, setCart] = useState<string[]>([]);
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [plan, setPlan] = useState<BundlePlan | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [bookBusy, setBookBusy] = useState(false);
  const [activeFollowUp, setActiveFollowUp] = useState<FollowUpQuestion | null>(null);
  const [answeredFollowUps, setAnsweredFollowUps] = useState<Set<string>>(() => new Set());
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastQuestionKeyRef = useRef("");

  useEffect(() => {
    void fetchCareAiPublicConfig({ data: { lang } })
      .then((cfg) => {
        setAiConfig(cfg);
        setMessages([welcomeBubble(cfg.ui.welcome)]);
      })
      .catch((e) => toast.error((e as Error).message));
  }, [lang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, cards.length, activeFollowUp?.text]);

  const features = aiConfig?.features;
  const ui = aiConfig?.ui;
  const showQuestionsFeature = features?.follow_up_questions !== false;
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const pendingQuestions =
    showQuestionsFeature && lastAssistant?.questions?.length && aiConfig?.followUp
      ? parseFollowUpQuestions(lastAssistant.questions, aiConfig.followUp)
      : [];
  const lastOffer = features?.bundle_offer ? messages.filter((m) => m.offerBundle).at(-1) : undefined;

  useEffect(() => {
    const key = pendingQuestions.map((q) => q.text).join("\n");
    if (!key || key === lastQuestionKeyRef.current) return;
    lastQuestionKeyRef.current = key;
    if (pendingQuestions.length === 1) setActiveFollowUp(pendingQuestions[0]);
  }, [pendingQuestions]);

  async function send(text: string, opts?: { followUp?: FollowUpQuestion; displayText?: string }) {
    const t = text.trim();
    if (!t || busy) return;
    setInput("");
    setActiveFollowUp(null);
    const bubbleText = opts?.displayText ?? t;
    const userBubble: ChatBubble = {
      role: "user",
      text: bubbleText,
      apiText: opts?.followUp ? t : undefined,
      followUpQuestion: opts?.followUp?.text,
    };
    const nextMsgs: ChatBubble[] = [...messages, userBubble];
    setMessages(nextMsgs);
    if (opts?.followUp) {
      setAnsweredFollowUps((prev) => new Set(prev).add(opts.followUp!.text));
    }
    setBusy(true);
    try {
      const res = await careAiTestChat({
        data: {
          lang,
          messages: nextMsgs.map((m) => ({ role: m.role, text: m.apiText ?? m.text })),
        },
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: res.reply,
          medicalAdvice: res.medical_advice,
          catalogNotes: res.catalog_notes,
          questions: res.questions,
          suggestions: res.suggested_tests,
          offerBundle: res.offer_bundle,
        },
      ]);
      setAnsweredFollowUps(new Set());
      setActiveFollowUp(null);
      if (res.suggested_tests.length) {
        const ids = res.suggested_tests.map((s) => s.catalog_id);
        const [offerings, catalog] = await Promise.all([
          searchTestOfferings({ catalogIds: ids, districtId: district?.id }),
          fetchTestCatalog(),
        ]);
        setCards(buildCards(res.suggested_tests, offerings, catalog));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function submitFollowUpAnswer(question: FollowUpQuestion, answer: string) {
    if (!aiConfig?.followUp) return;
    const payload = formatFollowUpAnswer(question.text, answer, aiConfig.followUp);
    const display = displayAnswerBubble(question.text, answer, aiConfig.followUp);
    void send(payload, { followUp: question, displayText: display });
  }

  async function openBundle() {
    const ids = cart.length ? cart : cards.map((c) => c.catalogId);
    if (!ids.length) return toast.error(lang === "bn" ? "আগে টেস্ট বেছে নিন" : "Select tests first");
    setBookBusy(true);
    try {
      const packed = await loadBundlePlan(ids, district?.id);
      setPlan(packed);
      setSheetOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBookBusy(false);
    }
  }

  const cartCount = cart.length;
  const showSuggestions = features?.test_suggestions !== false;
  const showBundle =
    features?.bundle_offer !== false && (lastOffer || cartCount >= 2 || cards.length >= 2);

  return (
    <div className="w-full min-h-dvh flex flex-col">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <Link to="/care" search={{ tab: "tests" }} className="h-9 w-9 rounded-xl grid place-items-center hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold truncate">
              {ui?.pageTitle ?? (lang === "bn" ? "AI টেস্ট সাজেশন" : "AI test advisor")}
            </h1>
            <p className="text-[10px] text-muted-foreground truncate">
              {ui?.disclaimer ?? (lang === "bn" ? "তথ্যমূলক; চিকিৎসকের পরামর্শ নয়" : "Informational only")}
            </p>
          </div>
        </div>
      </AutoHideHeader>

      <div className="flex-1 px-3 py-3 max-w-2xl mx-auto w-full space-y-3 pb-40">
        <DistrictTypeahead value={district} onChange={setDistrict} />

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user" ? "bg-primary text-primary-foreground whitespace-pre-wrap" : "border bg-card"
              }`}
            >
              {m.role === "assistant" ? (
                <>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {features?.medical_advice !== false && (
                    <AiSection
                      icon={Stethoscope}
                      title={ui?.medicalHeading ?? (lang === "bn" ? "স্বাস্থ্য তথ্য" : "Health guidance")}
                      body={m.medicalAdvice ?? ""}
                      accent="border-emerald-500/30 bg-emerald-500/5"
                    />
                  )}
                  {features?.catalog_notes !== false && (
                    <AiSection
                      icon={BookOpen}
                      title={ui?.catalogHeading ?? (lang === "bn" ? "ক্যাটালগ তথ্য" : "Catalog notes")}
                      body={m.catalogNotes ?? ""}
                      accent="border-sky-500/30 bg-sky-500/5"
                    />
                  )}
                </>
              ) : (
                <>
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.followUpQuestion && aiConfig?.followUp && (
                    <p className="text-[10px] opacity-75 mt-1 pt-1 border-t border-primary-foreground/20">
                      {aiConfig.followUp.bubbleCaption}
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <p className="text-xs text-muted-foreground animate-pulse">
            {ui?.thinking ?? (lang === "bn" ? "ভাবছি…" : "Thinking…")}
          </p>
        )}

        {showQuestionsFeature && pendingQuestions.length > 0 && !busy && aiConfig?.followUp && (
          <CareAiFollowUpPanel
            questions={pendingQuestions}
            active={activeFollowUp}
            answered={answeredFollowUps}
            busy={busy}
            copy={aiConfig.followUp}
            onSelect={setActiveFollowUp}
            onSubmit={submitFollowUpAnswer}
          />
        )}

        {showSuggestions && cards.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground px-1">
              {ui?.suggestionsHeading ?? (lang === "bn" ? "সাজেস্টেড টেস্ট" : "Suggested tests")}
            </p>
            <ul className="space-y-2">
              {cards.map((c) => {
                const inCart = cart.includes(c.catalogId);
                return (
                  <li key={c.catalogId} className="rounded-2xl border bg-card px-3 py-3 space-y-1.5">
                    <div className="flex items-start gap-3">
                      <span className="h-10 w-10 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                        <FlaskConical className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{lang === "bn" ? c.nameBn : c.nameEn}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[c.code, c.cheapest != null ? `৳${c.cheapest}` : null, c.clinicCount ? `${c.clinicCount} ${lang === "bn" ? "ক্লিনিক" : "clinics"}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {c.reason && <p className="text-xs text-muted-foreground mt-1">{c.reason}</p>}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {c.cheapestOfferingId && (
                        <Link
                          to="/care/test/$id"
                          params={{ id: c.cheapestOfferingId }}
                          className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
                        >
                          {lang === "bn" ? "বিস্তারিত" : "Details"}
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setCart((prev) => (inCart ? prev.filter((id) => id !== c.catalogId) : [...prev, c.catalogId]))
                        }
                        className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                          inCart ? "bg-primary text-primary-foreground" : "border"
                        }`}
                      >
                        {inCart ? (lang === "bn" ? "কার্টে আছে" : "In cart") : lang === "bn" ? "কার্টে যোগ" : "Add"}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-0 inset-x-0 border-t bg-background/95 backdrop-blur-xl pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-2xl mx-auto px-3 py-2 space-y-2">
          {showBundle && (
            <button
              type="button"
              disabled={bookBusy || (cartCount === 0 && cards.length === 0)}
              onClick={() => void openBundle()}
              className="w-full rounded-xl bg-primary text-primary-foreground px-3 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ShoppingBag className="h-4 w-4" />
              {ui?.bundleCta ??
                (lang === "bn"
                  ? "এই টেস্টগুলো সবচেয়ে ভালো ও কম টাকায় বুক করব?"
                  : "Book these tests at the best price together?")}
            </button>
          )}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={lang === "bn" ? "লক্ষণ বা প্রশ্ন লিখুন…" : "Describe symptoms or ask…"}
              className="flex-1 rounded-xl border bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="h-11 w-11 rounded-xl bg-primary text-primary-foreground grid place-items-center disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      <CareAiBundleSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        plan={plan}
        lang={lang}
        busy={bookBusy}
        setBusy={setBookBusy}
      />
    </div>
  );
}

function buildCards(
  suggestions: CareAiSuggestedTest[],
  offerings: CareOffering[],
  catalog: { id: string; code: string; name_bn: string; name_en: string }[],
): CatalogCard[] {
  const catMap = new Map(catalog.map((c) => [c.id, c]));
  return suggestions.map((s) => {
    const rows = offerings.filter((o) => o.catalog_id === s.catalog_id);
    const cheapest = rows.slice().sort((a, b) => a.price - b.price)[0];
    const clinics = new Set(rows.map((r) => r.org_id));
    const sample = cheapest?.catalog || catMap.get(s.catalog_id);
    return {
      catalogId: s.catalog_id,
      code: sample?.code || s.code,
      reason: s.reason,
      nameBn: sample?.name_bn || s.code,
      nameEn: sample?.name_en || s.code,
      cheapest: cheapest ? cheapest.price : null,
      clinicCount: clinics.size,
      cheapestOfferingId: cheapest?.id ?? null,
    };
  });
}
