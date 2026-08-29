import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { BadgeCheck, FlaskConical, Sparkles, ShoppingBag, Stethoscope, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth-context";
import type { District } from "@/lib/api";
import { fetchTestCatalog } from "@/lib/care-cms";
import { searchTestOfferings, type CareOffering } from "@/lib/care-lab-api";
import { offeringSalePrice } from "@/lib/care-lab-price";
import { CareLabPriceDisplay } from "@/components/care/CareLabPriceDisplay";
import {
  careAiTestChat,
  fetchCareAiPublicConfig,
  type CareAiChatMessage,
  type CareAiExpertAnalysis,
  type CareAiMedicine,
  type CareAiPublicConfig,
  type CareAiSuggestedSpecialty,
  type CareAiSuggestedTest,
} from "@/lib/care-ai-chat";
import { CareAiExpertBlock, CareAiFirstAidBlock, CareAiSpecialtyCards } from "@/components/care/CareAiInsightBlocks";
import { CareAiMedicineBlock } from "@/components/care/CareAiMedicineBlock";
import { CareAiLabGeoSheet } from "@/components/care/CareAiLabGeoSheet";
import {
  loadBundlePlan,
  rankNearbyLabsForTests,
  type RankedLabClinic,
} from "@/lib/care-ai-bundle";
import { CareAiFollowUpPanel } from "@/components/care/CareAiFollowUpPanel";
import { CareAiChatComposer, type CareAiPendingImage } from "@/components/care/CareAiChatComposer";
import { compressImageForAi } from "@/lib/care-ai-image";
import {
  displayAnswerBubble,
  displayBatchAnswerBubble,
  formatFollowUpAnswer,
  formatFollowUpBatchAnswer,
  parseFollowUpQuestions,
  type FollowUpQuestion,
} from "@/lib/care-ai-followup";
import { AI_CHAT_RESUME_PATH, consumeAiChatDraft, saveAiChatDraft } from "@/lib/auth-next";
import { CareAiChatHistoryNav } from "@/components/care/CareAiChatHistoryNav";
import {
  deleteCareAiChatThread,
  listCareAiChatThreads,
  loadCareAiChat,
  saveCareAiChat,
  startCareAiNewChat,
  switchCareAiChat,
  type CareAiChatThreadSummary,
} from "@/lib/care-ai-chat-store";

type ChatBubble = CareAiChatMessage & {
  medicalAdvice?: string;
  catalogNotes?: string;
  questions?: string[];
  suggestions?: CareAiSuggestedTest[];
  specialties?: CareAiSuggestedSpecialty[];
  expertAnalysis?: CareAiExpertAnalysis | null;
  firstAid?: string[];
  medicines?: CareAiMedicine[];
  fromPrescription?: boolean;
  offerBundle?: boolean;
  imagePreviews?: string[];
  /** Text sent to Gemini (may differ from bubble display for follow-ups). */
  apiText?: string;
  /** Display-only: user answered a follow-up question */
  followUpQuestion?: string;
  followUpBatch?: boolean;
};

type CatalogCard = {
  catalogId: string;
  code: string;
  reason: string;
  nameBn: string;
  nameEn: string;
  cheapest: number | null;
  listPrice: number | null;
  discountPercent: number;
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
  const { session, isAnonymous, user } = useAuth();
  const navigate = useNavigate();
  const isGuest = !session || isAnonymous;
  const userId = user?.id ?? null;
  const [aiConfig, setAiConfig] = useState<CareAiPublicConfig | null>(null);
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [district, setDistrict] = useState<District | null>(null);
  const [upazila, setUpazila] = useState("");
  const [pendingSuggestions, setPendingSuggestions] = useState<CareAiSuggestedTest[]>([]);
  const [rankedClinics, setRankedClinics] = useState<RankedLabClinic[]>([]);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoSheetOpen, setGeoSheetOpen] = useState(false);
  const [pendingBookIds, setPendingBookIds] = useState<string[]>([]);
  const [pendingOrgId, setPendingOrgId] = useState<string | null>(null);
  const [cart, setCart] = useState<string[]>([]);
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [bookBusy, setBookBusy] = useState(false);
  const [pendingImages, setPendingImages] = useState<CareAiPendingImage[]>([]);
  const [activeFollowUp, setActiveFollowUp] = useState<FollowUpQuestion | null>(null);
  const [answeredFollowUps, setAnsweredFollowUps] = useState<Set<string>>(() => new Set());
  const [hydrated, setHydrated] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadList, setThreadList] = useState<CareAiChatThreadSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastQuestionKeyRef = useRef("");
  const threadIdRef = useRef<string | null>(null);
  const didHydrateRef = useRef(false);
  const persistDays = aiConfig?.chatPersistDays ?? 7;

  function refreshThreadList() {
    setThreadList(listCareAiChatThreads(null, persistDays));
  }

  function persistChat(
    nextMessages: ChatBubble[],
    nextCards = cards,
    nextCart = cart,
    idOverride: string | null = threadIdRef.current,
  ) {
    const id = saveCareAiChat({
      lang,
      messages: nextMessages,
      cards: nextCards,
      cart: nextCart,
      threadId: idOverride,
      persistDays,
    });
    if (id) {
      threadIdRef.current = id;
      setThreadId(id);
    }
    setThreadList(listCareAiChatThreads(null, persistDays));
    return id;
  }

  useEffect(() => {
    let cancelled = false;
    void fetchCareAiPublicConfig({ data: { lang } })
      .then((cfg) => {
        if (cancelled) return;
        const config = cfg as CareAiPublicConfig;
        setAiConfig(config);
        const days = config.chatPersistDays ?? 7;

        // Only restore conversation once per page visit (avoid wipe when auth userId settles).
        if (!didHydrateRef.current) {
          const saved = loadCareAiChat(null, days);
          if (saved?.messages?.length) {
            setMessages(saved.messages as ChatBubble[]);
            setCards((saved.cards as CatalogCard[]) ?? []);
            setCart(saved.cart ?? []);
            const tid = saved.threadId ?? null;
            threadIdRef.current = tid;
            setThreadId(tid);
          } else {
            setMessages([welcomeBubble(config.ui.welcome)]);
            setCards([]);
            setCart([]);
            threadIdRef.current = null;
            setThreadId(null);
          }
          didHydrateRef.current = true;
          setHydrated(true);
        }

        setThreadList(listCareAiChatThreads(null, days));
      })
      .catch((e) => toast.error((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [lang]);

  useEffect(() => {
    const draft = consumeAiChatDraft(AI_CHAT_RESUME_PATH);
    if (draft) setInput(draft);
  }, []);

  const geoReady = !!district?.id;

  const refreshLabSuggestions = useCallback(
    async (suggestions: CareAiSuggestedTest[], dist: District | null, upz: string) => {
      if (!suggestions.length) {
        setCards([]);
        setRankedClinics([]);
        return;
      }
      setGeoBusy(true);
      try {
        const catalog = await fetchTestCatalog();
        const catMap = new Map(catalog.map((c) => [c.id, c]));
        if (!dist?.id) {
          setCards(
            suggestions.map((s) => {
              const sample = catMap.get(s.catalog_id);
              return {
                catalogId: s.catalog_id,
                code: sample?.code || s.code,
                reason: s.reason,
                nameBn: sample?.name_bn || s.code,
                nameEn: sample?.name_en || s.code,
                cheapest: null,
                listPrice: null,
                discountPercent: 0,
                clinicCount: 0,
                cheapestOfferingId: null,
              };
            }),
          );
          setRankedClinics([]);
          return;
        }
        const ids = suggestions.map((s) => s.catalog_id);
        const rows = await searchTestOfferings({
          catalogIds: ids,
          districtId: dist.id,
          upazila: upz.trim() || undefined,
        });
        setCards(buildCards(suggestions, rows, catalog));
        setRankedClinics(rankNearbyLabsForTests(ids, rows, 5));
      } catch (e) {
        toast.error((e as Error).message);
      } finally {
        setGeoBusy(false);
      }
    },
    [],
  );

  // Catalog names for suggested tests (prices/clinics only after district+upazila via Book).
  useEffect(() => {
    if (!pendingSuggestions.length) {
      setCards([]);
      setRankedClinics([]);
      return;
    }
    void refreshLabSuggestions(pendingSuggestions, null, "");
  }, [pendingSuggestions, refreshLabSuggestions]);

  useEffect(() => {
    if (!hydrated || !aiConfig) return;
    persistChat(messages, cards, cart, threadIdRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist on chat content changes only
  }, [hydrated, aiConfig, lang, messages, cards, cart, persistDays]);

  useEffect(() => {
    if (!historyOpen) return;
    // Flush current conversation into history before listing.
    if (messages.some((m) => m.role === "user" && (m.text.trim() || m.imagePreviews?.length))) {
      persistChat(messages, cards, cart, threadIdRef.current);
    }
    setThreadList(listCareAiChatThreads(null, persistDays));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyOpen, persistDays]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, cards.length, activeFollowUp?.text]);

  function startNewChat() {
    startCareAiNewChat(null, persistDays);
    threadIdRef.current = null;
    setThreadId(null);
    setMessages([
      welcomeBubble(
        aiConfig?.ui.welcome ?? (lang === "bn" ? "আপনার লক্ষণ লিখুন।" : "Describe your symptoms."),
      ),
    ]);
    setCards([]);
    setCart([]);
    setPendingSuggestions([]);
    setRankedClinics([]);
    setPendingBookIds([]);
    setPendingOrgId(null);
    setGeoSheetOpen(false);
    setActiveFollowUp(null);
    setAnsweredFollowUps(new Set());
    setInput("");
    refreshThreadList();
  }

  function openThread(id: string) {
    const snap = switchCareAiChat(null, id, persistDays);
    if (!snap) return;
    const tid = snap.threadId ?? id;
    threadIdRef.current = tid;
    setThreadId(tid);
    setMessages((snap.messages as ChatBubble[]) ?? []);
    setCards((snap.cards as CatalogCard[]) ?? []);
    setCart(snap.cart ?? []);
    const restoredSuggestions =
      ((snap.messages as ChatBubble[]) ?? [])
        .filter((m) => m.role === "assistant" && m.suggestions?.length)
        .at(-1)?.suggestions ?? [];
    setPendingSuggestions(restoredSuggestions);
    setRankedClinics([]);
    setActiveFollowUp(null);
    setAnsweredFollowUps(new Set());
    refreshThreadList();
  }

  function removeThread(id: string) {
    const next = deleteCareAiChatThread(null, id, persistDays);
    refreshThreadList();
    if (id === threadIdRef.current) {
      if (next?.messages?.length) {
        const tid = next.threadId ?? null;
        threadIdRef.current = tid;
        setThreadId(tid);
        setMessages(next.messages as ChatBubble[]);
        setCards((next.cards as CatalogCard[]) ?? []);
        setCart(next.cart ?? []);
      } else {
        threadIdRef.current = null;
        setThreadId(null);
        setMessages([
          welcomeBubble(
            aiConfig?.ui.welcome ?? (lang === "bn" ? "আপনার লক্ষণ লিখুন।" : "Describe your symptoms."),
          ),
        ]);
        setCards([]);
        setCart([]);
      }
    }
  }

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

  async function send(
    text: string,
    opts?: {
      followUp?: FollowUpQuestion;
      followUpBatch?: FollowUpQuestion[];
      displayText?: string;
      images?: CareAiPendingImage[];
    },
  ) {
    const images = opts?.images ?? pendingImages;
    const t = text.trim();
    if ((!t && !images.length) || busy) return;
    if (isGuest) {
      saveAiChatDraft(AI_CHAT_RESUME_PATH, opts?.displayText ?? t);
      void navigate({ to: "/auth", search: { next: AI_CHAT_RESUME_PATH } as never });
      return;
    }
    setInput("");
    setPendingImages([]);
    setActiveFollowUp(null);
    const bubbleText =
      (opts?.displayText?.trim() || t.trim()) ||
      (images.length
        ? lang === "bn"
          ? `প্রেসক্রিপশন ছবি (${images.length})`
          : `Prescription photo (${images.length})`
        : "");
    const userBubble: ChatBubble = {
      role: "user",
      text: bubbleText || (lang === "bn" ? "প্রেসক্রিপশন" : "Prescription"),
      apiText: opts?.followUp || opts?.followUpBatch?.length ? t : t || undefined,
      followUpQuestion: opts?.followUp?.text,
      followUpBatch: !!opts?.followUpBatch?.length,
      imagePreviews: images.map((i) => i.storagePreviewUrl || i.previewUrl),
    };
    const nextMsgs: ChatBubble[] = [...messages, userBubble];
    setMessages(nextMsgs);
    persistChat(nextMsgs);
    if (opts?.followUp) {
      setAnsweredFollowUps((prev) => new Set(prev).add(opts.followUp!.text));
    }
    if (opts?.followUpBatch?.length) {
      setAnsweredFollowUps((prev) => {
        const next = new Set(prev);
        for (const q of opts.followUpBatch!) next.add(q.text);
        return next;
      });
    }
    setBusy(true);
    try {
      const apiMessages = nextMsgs.map((m) => ({
        role: m.role,
        text:
          m.apiText ??
          m.text ??
          (m.imagePreviews?.length
            ? lang === "bn"
              ? "প্রেসক্রিপশন ছবি পড়ুন।"
              : "Please read this prescription image."
            : ""),
      }));
      const res = await careAiTestChat({
        data: {
          lang,
          messages: apiMessages.filter((m) => m.text),
          images: images.map((i) => ({ mimeType: i.mimeType, data: i.data })),
        },
      });
      const assistantBubble: ChatBubble = {
        role: "assistant",
        text: res.reply,
        medicalAdvice: res.medical_advice,
        catalogNotes: res.catalog_notes,
        questions: res.questions,
        suggestions: res.suggested_tests,
        specialties: res.suggested_specialties,
        expertAnalysis: res.expert_analysis,
        firstAid: res.first_aid,
        medicines: res.medicines,
        fromPrescription: res.from_prescription,
        offerBundle: res.offer_bundle,
      };
      const withAssistant = [...nextMsgs, assistantBubble];
      setMessages(withAssistant);
      persistChat(withAssistant);
      setAnsweredFollowUps(new Set());
      setActiveFollowUp(null);
      if (res.suggested_tests.length) {
        setPendingSuggestions(res.suggested_tests);
        const nextCart = res.from_prescription
          ? res.suggested_tests.map((s) => s.catalog_id)
          : cart;
        if (res.from_prescription) setCart(nextCart);
        persistChat(withAssistant, [], nextCart);
      } else {
        setPendingSuggestions([]);
        setCards([]);
        setRankedClinics([]);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePickFiles(files: FileList | null) {
    if (!files?.length) return;
    const max = aiConfig?.limits?.maxPrescriptionImages ?? 2;
    const maxPx = aiConfig?.limits?.prescriptionImageMaxPx ?? 1600;
    const room = Math.max(0, max - pendingImages.length);
    if (!room) {
      toast.error(lang === "bn" ? `সর্বোচ্চ ${max}টি ছবি` : `Max ${max} images`);
      return;
    }
    try {
      const next: CareAiPendingImage[] = [...pendingImages];
      for (const file of Array.from(files).slice(0, room)) {
        if (!file.type.startsWith("image/")) continue;
        const compressed = await compressImageForAi(file, maxPx);
        const storage = await compressImageForAi(file, 480, 0.62);
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          mimeType: compressed.mimeType,
          data: compressed.data,
          previewUrl: compressed.previewUrl,
          storagePreviewUrl: storage.previewUrl,
        });
      }
      setPendingImages(next);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function submitFollowUpAnswer(question: FollowUpQuestion, answer: string) {
    if (!aiConfig?.followUp) return;
    const payload = formatFollowUpAnswer(question.text, answer, aiConfig.followUp);
    const display = displayAnswerBubble(question.text, answer, aiConfig.followUp);
    void send(payload, { followUp: question, displayText: display });
  }

  function submitFollowUpBatch(entries: { question: FollowUpQuestion; answer: string }[]) {
    if (!aiConfig?.followUp || !entries.length) return;
    const payload = formatFollowUpBatchAnswer(
      entries.map((e) => ({ question: e.question.text, answer: e.answer })),
      aiConfig.followUp,
    );
    const display = displayBatchAnswerBubble(
      entries.map((e) => ({ question: e.question.text, answer: e.answer })),
      aiConfig.followUp,
    );
    void send(payload, {
      followUpBatch: entries.map((e) => e.question),
      displayText: display,
    });
  }

  function requestBook(catalogIds?: string[], opts?: { orgId?: string }) {
    const ids = catalogIds?.length
      ? catalogIds
      : cart.length
        ? cart
        : cards.map((c) => c.catalogId);
    if (!ids.length) {
      toast.error(lang === "bn" ? "আগে টেস্ট বেছে নিন" : "Select tests first");
      return;
    }
    if (isGuest) {
      void navigate({ to: "/auth", search: { next: AI_CHAT_RESUME_PATH } as never });
      return;
    }
    setCart(ids);
    setPendingBookIds(ids);
    setPendingOrgId(opts?.orgId ?? null);

    // Already have district (+ optional upazila) and a clinic → open lab page with tests selected.
    if (opts?.orgId && district?.id) {
      void navigate({
        to: "/care/labs/$orgId",
        params: { orgId: opts.orgId },
        search: { catalogs: ids.join(",") },
      });
      return;
    }
    setGeoSheetOpen(true);
  }

  async function continueBookAfterGeo() {
    if (!district?.id || !pendingBookIds.length) {
      toast.error(lang === "bn" ? "জেলা সিলেক্ট করুন" : "Select a district");
      return;
    }
    setBookBusy(true);
    try {
      const upz = upazila.trim() || undefined;
      await refreshLabSuggestions(pendingSuggestions, district, upazila);
      const packed = await loadBundlePlan(
        pendingBookIds,
        district.id,
        upz,
        pendingOrgId ?? undefined,
      );
      if (!packed.groups.length) {
        toast.error(
          lang === "bn"
            ? "এই জেলায় এই টেস্টের অফার নেই। অন্য জেলা/উপজেলা চেষ্টা করুন।"
            : "No offerings for these tests in this district. Try another area.",
        );
        return;
      }
      // Prefer preferred clinic, else the group covering the most tests.
      const primary =
        (pendingOrgId && packed.groups.find((g) => g.orgId === pendingOrgId)) ||
        packed.groups.slice().sort((a, b) => b.items.length - a.items.length)[0];
      const catalogIds = primary.items.map((i) => i.catalogId);
      setCart(catalogIds);
      setGeoSheetOpen(false);
      void navigate({
        to: "/care/labs/$orgId",
        params: { orgId: primary.orgId },
        search: { catalogs: catalogIds.join(",") },
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBookBusy(false);
    }
  }

  const cartCount = cart.length;
  const fromPrescription = !!messages.filter((m) => m.fromPrescription).at(-1);
  const showSuggestions =
    features?.test_suggestions !== false ||
    (fromPrescription && features?.prescription_tests !== false);
  const showBundle =
    features?.bundle_offer !== false &&
    cards.length > 0 &&
    (lastOffer || fromPrescription || cartCount >= 1 || cards.length >= 1);

  return (
    <div className="w-full min-h-dvh flex flex-col">
      <AutoHideHeader className="z-30 border-b bg-background safe-top">
        <div className="flex items-center gap-2 px-3 py-2">
          <PageBackButton
            fallbackTo={{ to: "/care", search: { tab: "tests" } }}
            shape="xl"
          />
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <h1 className="text-sm font-bold truncate">
              {ui?.pageTitle ?? (lang === "bn" ? "AI টেস্ট সাজেশন" : "AI test advisor")}
            </h1>
            <p className="text-[10px] text-muted-foreground truncate">
              {ui?.disclaimer ?? (lang === "bn" ? "তথ্যমূলক; চিকিৎসকের পরামর্শ নয়" : "Informational only")}
            </p>
          </div>
          <CareAiChatHistoryNav
            open={historyOpen}
            onOpenChange={setHistoryOpen}
            threads={threadList}
            lang={lang}
            onSelect={openThread}
            onDelete={removeThread}
            onNewChat={startNewChat}
          />
          <button
            type="button"
            onClick={startNewChat}
            className="shrink-0 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground hover:bg-muted"
          >
            {lang === "bn" ? "নতুন চ্যাট" : "New chat"}
          </button>
        </div>
      </AutoHideHeader>

      <div
        className="flex-1 px-3 py-3 max-w-2xl mx-auto w-full space-y-3"
        style={{
          paddingBottom:
            "calc(var(--care-ai-composer-h, 7rem) + var(--app-bottom-nav-h, 0px) + 0.5rem)",
        }}
      >
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
                  {features?.prescription_medicines !== false && (
                    <CareAiMedicineBlock
                      items={m.medicines}
                      title={
                        ui?.medicinesHeading ??
                        (lang === "bn" ? "প্রেসক্রিপশনের ওষুধ" : "Prescription medicines")
                      }
                      disclaimer={ui?.prescriptionDisclaimer}
                      lang={lang}
                    />
                  )}
                  {features?.medical_advice !== false && (
                    <AiSection
                      icon={Stethoscope}
                      title={ui?.medicalHeading ?? (lang === "bn" ? "স্বাস্থ্য তথ্য" : "Health guidance")}
                      body={m.medicalAdvice ?? ""}
                      accent="border-emerald-500/30 bg-emerald-500/5"
                    />
                  )}
                  {features?.expert_analysis !== false && (
                    <CareAiExpertBlock
                      analysis={m.expertAnalysis}
                      title={ui?.expertHeading ?? (lang === "bn" ? "এক্সপার্ট বিশ্লেষণ" : "Expert analysis")}
                      lang={lang}
                    />
                  )}
                  {features?.specialty_suggestions !== false && (
                    <CareAiSpecialtyCards
                      items={m.specialties}
                      title={
                        ui?.specialtyHeading ??
                        (lang === "bn" ? "কোন বিশেষজ্ঞ দেখাবেন" : "Which specialist to see")
                      }
                      cta={ui?.specialtyCta ?? (lang === "bn" ? "ডাক্তার খুঁজুন" : "Find doctors")}
                      lang={lang}
                    />
                  )}
                  {features?.first_aid !== false && (
                    <CareAiFirstAidBlock
                      steps={m.firstAid}
                      buttonLabel={
                        ui?.firstAidButton ?? (lang === "bn" ? "প্রাথমিক চিকিৎসা" : "Primary first aid")
                      }
                      heading={
                        ui?.firstAidHeading ?? (lang === "bn" ? "প্রাথমিক চিকিৎসা" : "Primary first aid")
                      }
                      lang={lang}
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
                  {m.imagePreviews?.length ? (
                    <div className="flex gap-1.5 mb-2 overflow-x-auto">
                      {m.imagePreviews.map((src, idx) => (
                        <img
                          key={idx}
                          src={src}
                          alt=""
                          className="h-16 w-16 rounded-lg object-cover border border-primary-foreground/30"
                        />
                      ))}
                    </div>
                  ) : null}
                  <p className="whitespace-pre-wrap">{m.text}</p>
                  {m.followUpQuestion && aiConfig?.followUp && (
                    <p className="text-[10px] opacity-75 mt-1 pt-1 border-t border-primary-foreground/20">
                      {aiConfig.followUp.bubbleCaption}
                    </p>
                  )}
                  {m.followUpBatch && aiConfig?.followUp && (
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
            onSubmitBatch={submitFollowUpBatch}
          />
        )}

        {showSuggestions && pendingSuggestions.length > 0 && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground px-1 leading-relaxed">
              {lang === "bn"
                ? "বুক চাপলে জেলা সিলেক্ট করতে বলা হবে (উপজেলা ঐচ্ছিক) — তারপর সেই এলাকার ক্লিনিক/মূল্য দেখাবে।"
                : "Tap Book to choose a district (upazila optional) — then clinics/prices from that area are shown."}
            </p>

            {geoReady && geoBusy && (
              <p className="text-xs text-muted-foreground animate-pulse px-1">
                {lang === "bn" ? "এই এলাকার ল্যাব খুঁজছি…" : "Finding labs in this area…"}
              </p>
            )}

            {geoReady && rankedClinics.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground px-1">
                  {ui?.labClinicsHeading ??
                    (lang === "bn"
                      ? "নির্বাচিত জেলা/উপজেলার কম মূল্যের ভেরিফায়েড ক্লিনিক/ল্যাব"
                      : "Low-price verified clinics/labs in your selected area")}
                </p>
                <ul className="space-y-2">
                  {rankedClinics.map((clinic) => (
                    <li
                      key={clinic.orgId}
                      className="rounded-2xl border bg-card px-3 py-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate inline-flex items-center gap-1.5">
                          {lang === "bn" && clinic.nameBn ? clinic.nameBn : clinic.name}
                          {clinic.verified ? (
                            <BadgeCheck className="h-3.5 w-3.5 text-sky-600 shrink-0" aria-label="verified" />
                          ) : null}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {[
                            clinic.upazila,
                            `${clinic.testCount} ${lang === "bn" ? "টেস্ট" : "tests"}`,
                            `৳${Math.round(clinic.subtotal)}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {clinic.address ? (
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{clinic.address}</p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-2 shrink-0">
                        {clinic.sampleOfferingId ? (
                          <Link
                            to="/care/labs/$orgId"
                            params={{ orgId: clinic.orgId }}
                            className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
                          >
                            {lang === "bn" ? "বিস্তারিত" : "Details"}
                          </Link>
                        ) : null}
                        <button
                          type="button"
                          disabled={bookBusy}
                          onClick={() => {
                            setCart(clinic.catalogIds);
                            requestBook(clinic.catalogIds, { orgId: clinic.orgId });
                          }}
                          className="rounded-lg bg-sky-600 text-white px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                        >
                          {lang === "bn" ? "বুক করুন" : "Book"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {cards.length > 0 && (
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
                            <p className="text-sm font-semibold truncate">
                              {lang === "bn" ? c.nameBn : c.nameEn}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {[
                                c.code,
                                geoReady && c.clinicCount
                                  ? `${c.clinicCount} ${lang === "bn" ? "ক্লিনিক" : "clinics"}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                            {geoReady && c.listPrice != null ? (
                              <div className="mt-1">
                                <CareLabPriceDisplay
                                  listPrice={c.listPrice}
                                  salePrice={c.cheapest}
                                  discountPercent={c.discountPercent}
                                  lang={lang}
                                  variant="inline"
                                />
                              </div>
                            ) : null}
                            {c.reason && <p className="text-xs text-muted-foreground mt-1">{c.reason}</p>}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {geoReady && c.cheapestOfferingId && (
                            <Link
                              to="/care/test/$id"
                              params={{ id: c.cheapestOfferingId }}
                              className="rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold"
                            >
                              {lang === "bn" ? "ক্লিনিক" : "Clinic"}
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setCart((prev) =>
                                inCart ? prev.filter((id) => id !== c.catalogId) : [...prev, c.catalogId],
                              )
                            }
                            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
                              inCart ? "bg-primary text-primary-foreground" : "border"
                            }`}
                          >
                            {inCart
                              ? lang === "bn"
                                ? "কার্টে আছে"
                                : "In cart"
                              : lang === "bn"
                                ? "কার্টে যোগ"
                                : "Add"}
                          </button>
                          <button
                            type="button"
                            disabled={bookBusy}
                            onClick={() => requestBook([c.catalogId])}
                            className="rounded-lg bg-primary text-primary-foreground px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50"
                          >
                            {lang === "bn" ? "বুক করুন" : "Book"}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <CareAiChatComposer
        value={input}
        onChange={setInput}
        onSend={() => void send(input)}
        placeholder={lang === "bn" ? "লক্ষণ বা প্রশ্ন লিখুন…" : "Describe symptoms or ask…"}
        hint={
          busy && pendingImages.length === 0 && features?.prescription_scan
            ? ui?.prescriptionAnalyzing ?? aiConfig?.followUp?.composerHint
            : aiConfig?.followUp?.composerHint
        }
        busy={busy}
        attachEnabled={features?.prescription_scan !== false}
        attachLabel={ui?.prescriptionAttach}
        cameraLabel={ui?.prescriptionCamera}
        photosLabel={ui?.prescriptionPhotos}
        pendingImages={pendingImages}
        onImagesChange={setPendingImages}
        onPickFiles={(files) => void handlePickFiles(files)}
        maxImages={aiConfig?.limits?.maxPrescriptionImages ?? 2}
        topSlot={
          showBundle ? (
            <button
              type="button"
              disabled={bookBusy || (cartCount === 0 && cards.length === 0)}
              onClick={() => {
                const ids = cart.length ? cart : cards.map((c) => c.catalogId);
                if (ids.length) setCart(ids);
                requestBook(ids);
              }}
              className="w-full rounded-xl bg-primary text-primary-foreground px-3 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <ShoppingBag className="h-4 w-4" />
              {ui?.bundleCta ??
                (fromPrescription
                  ? lang === "bn"
                    ? "প্রেসক্রিপশনের টেস্ট বুক করুন"
                    : "Book prescription tests"
                  : lang === "bn"
                    ? "এই টেস্টগুলো সবচেয়ে ভালো ও কম টাকায় বুক করব?"
                    : "Book these tests at the best price together?")}
            </button>
          ) : undefined
        }
      />

      <CareAiLabGeoSheet
        open={geoSheetOpen}
        onOpenChange={setGeoSheetOpen}
        district={district}
        upazila={upazila}
        onDistrictChange={setDistrict}
        onUpazilaChange={setUpazila}
        title={
          ui?.labGeoTitle ??
          (lang === "bn"
            ? "বুকিংয়ের আগে জেলা নির্বাচন করুন"
            : "Select district before booking")
        }
        hint={
          ui?.labGeoHint ??
          (lang === "bn"
            ? "জেলা বাধ্যতামূলক; উপজেলা ঐচ্ছিক। এরপর সেই এলাকার হাসপাতাল/ক্লিনিক পেজে আপনার টেস্টগুলো সিলেক্ট অবস্থায় খুলবে।"
            : "District required; upazila optional. Then the hospital/clinic page opens with your tests already selected.")
        }
        ctaLabel={
          lang === "bn" ? "ল্যাবে টেস্ট দেখুন" : "View tests at lab"
        }
        cancelLabel={lang === "bn" ? "ফিরে যান" : "Back"}
        busy={bookBusy || geoBusy}
        onContinue={() => void continueBookAfterGeo()}
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
    const cheapest = rows.slice().sort((a, b) => offeringSalePrice(a) - offeringSalePrice(b))[0];
    const clinics = new Set(rows.map((r) => r.org_id));
    const sample = cheapest?.catalog || catMap.get(s.catalog_id);
    return {
      catalogId: s.catalog_id,
      code: sample?.code || s.code,
      reason: s.reason,
      nameBn: sample?.name_bn || s.code,
      nameEn: sample?.name_en || s.code,
      cheapest: cheapest ? offeringSalePrice(cheapest) : null,
      listPrice: cheapest ? cheapest.price : null,
      discountPercent: cheapest?.discount_percent ?? 0,
      clinicCount: clinics.size,
      cheapestOfferingId: cheapest?.id ?? null,
    };
  });
}
