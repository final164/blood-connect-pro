import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Send, Sparkles, Stethoscope, BookOpen, Loader2, FlaskConical, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import {
  careAiTestChat,
  fetchCareAiPublicConfig,
  type CareAiChatMessage,
  type CareAiExpertAnalysis,
  type CareAiPublicConfig,
  type CareAiSuggestedSpecialty,
  type CareAiSuggestedTest,
} from "@/lib/care-ai-chat";
import { CareAiExpertBlock, CareAiFirstAidBlock, CareAiSpecialtyCards } from "@/components/care/CareAiInsightBlocks";
import { fetchTestCatalog } from "@/lib/care-cms";
import { searchTestOfferings, type CareOffering } from "@/lib/care-lab-api";
import { offeringSalePrice } from "@/lib/care-lab-price";
import { CareLabPriceDisplay } from "@/components/care/CareLabPriceDisplay";
import { authWithNext, AI_CHAT_RESUME_PATH, saveAiChatDraft } from "@/lib/auth-next";
import { supabase } from "@/integrations/supabase/client";
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

type Bubble = CareAiChatMessage & {
  medicalAdvice?: string;
  catalogNotes?: string;
  specialties?: CareAiSuggestedSpecialty[];
  expertAnalysis?: CareAiExpertAnalysis | null;
  firstAid?: string[];
  offerBundle?: boolean;
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

function pick(lang: "bn" | "en", bn: string, en: string) {
  return lang === "bn" ? bn : en;
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

const MAX_H = 100;

export function LandingAiHealthPanel({
  lang,
  open,
  onOpenChange,
}: {
  lang: "bn" | "en";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [cfg, setCfg] = useState<CareAiPublicConfig | null>(null);
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [cards, setCards] = useState<CatalogCard[]>([]);
  const [cart, setCart] = useState<string[]>([]);
  const [offerBundle, setOfferBundle] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [threadList, setThreadList] = useState<CareAiChatThreadSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const threadIdRef = useRef<string | null>(null);
  const persistDays = cfg?.chatPersistDays ?? 7;

  const didHydrateRef = useRef(false);

  function refreshThreadList() {
    setThreadList(listCareAiChatThreads(null, persistDays));
  }

  function persistChat(nextMessages: Bubble[], nextCards = cards, nextCart = cart) {
    const id = saveCareAiChat({
      lang,
      messages: nextMessages,
      cards: nextCards,
      cart: nextCart,
      threadId: threadIdRef.current,
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
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id ?? null;
      if (cancelled) return;
      setUserId(uid);
      try {
        const c = (await fetchCareAiPublicConfig({ data: { lang } })) as CareAiPublicConfig;
        if (cancelled) return;
        setCfg(c);
        const days = c.chatPersistDays ?? 7;
        if (!didHydrateRef.current) {
          const saved = loadCareAiChat(null, days);
          if (saved?.messages?.length) {
            setMessages(saved.messages as Bubble[]);
            setCards((saved.cards as CatalogCard[]) ?? []);
            setCart(saved.cart ?? []);
            threadIdRef.current = saved.threadId ?? null;
            setThreadId(saved.threadId ?? null);
          } else {
            setMessages([{ role: "assistant", text: c.ui.welcome }]);
            setCards([]);
            setCart([]);
            threadIdRef.current = null;
            setThreadId(null);
          }
          didHydrateRef.current = true;
          setHydrated(true);
        }
        setThreadList(listCareAiChatThreads(null, days));
      } catch (e) {
        toast.error((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, lang]);

  useEffect(() => {
    if (!open || !hydrated || !cfg) return;
    persistChat(messages, cards, cart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, hydrated, cfg, lang, messages, cards, cart, persistDays]);

  useEffect(() => {
    if (!historyOpen) return;
    if (messages.some((m) => m.role === "user" && m.text.trim())) {
      persistChat(messages, cards, cart);
    }
    setThreadList(listCareAiChatThreads(null, persistDays));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyOpen, persistDays]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => taRef.current?.focus());
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, busy, cards.length]);

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_H)}px`;
  }, [input]);

  function startNewChat() {
    startCareAiNewChat(null, persistDays);
    threadIdRef.current = null;
    setThreadId(null);
    setMessages([
      {
        role: "assistant",
        text: cfg?.ui.welcome ?? pick(lang, "আপনার লক্ষণ লিখুন।", "Describe your symptoms."),
      },
    ]);
    setCards([]);
    setCart([]);
    setOfferBundle(false);
    setInput("");
    refreshThreadList();
  }

  function openThread(id: string) {
    const snap = switchCareAiChat(null, id, persistDays);
    if (!snap) return;
    threadIdRef.current = snap.threadId ?? id;
    setThreadId(snap.threadId ?? id);
    setMessages((snap.messages as Bubble[]) ?? []);
    setCards((snap.cards as CatalogCard[]) ?? []);
    setCart(snap.cart ?? []);
    refreshThreadList();
  }

  function removeThread(id: string) {
    const next = deleteCareAiChatThread(null, id, persistDays);
    refreshThreadList();
    if (id !== threadIdRef.current) return;
    if (next?.messages?.length) {
      threadIdRef.current = next.threadId ?? null;
      setThreadId(next.threadId ?? null);
      setMessages(next.messages as Bubble[]);
      setCards((next.cards as CatalogCard[]) ?? []);
      setCart(next.cart ?? []);
    } else {
      threadIdRef.current = null;
      setThreadId(null);
      setMessages([
        {
          role: "assistant",
          text: cfg?.ui.welcome ?? pick(lang, "আপনার লক্ষণ লিখুন।", "Describe your symptoms."),
        },
      ]);
      setCards([]);
      setCart([]);
    }
  }

  async function send() {
    const t = input.trim();
    if (!t || busy) return;
    // Landing shell has no AuthProvider — check session directly.
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session || session.user?.is_anonymous) {
      saveAiChatDraft(AI_CHAT_RESUME_PATH, t);
      window.location.assign(authWithNext(AI_CHAT_RESUME_PATH));
      return;
    }
    setInput("");
    const next: Bubble[] = [...messages, { role: "user", text: t }];
    setMessages(next);
    persistChat(next);
    setBusy(true);
    try {
      const res = await careAiTestChat({
        data: {
          lang,
          messages: next.map((m) => ({ role: m.role, text: m.text })),
        },
      });
      const assistant: Bubble = {
        role: "assistant",
        text: res.reply,
        medicalAdvice: res.medical_advice,
        catalogNotes: res.catalog_notes,
        specialties: res.suggested_specialties,
        expertAnalysis: res.expert_analysis,
        firstAid: res.first_aid,
        offerBundle: res.offer_bundle,
      };
      const withAssistant = [...next, assistant];
      setMessages(withAssistant);
      setOfferBundle(res.offer_bundle === true);
      if (res.suggested_tests.length && cfg?.features.test_suggestions !== false) {
        const ids = res.suggested_tests.map((s) => s.catalog_id);
        const [offerings, catalog] = await Promise.all([
          searchTestOfferings({ catalogIds: ids }),
          fetchTestCatalog(),
        ]);
        const built = buildCards(res.suggested_tests, offerings, catalog);
        setCards(built);
        setCart([]);
        persistChat(withAssistant, built, []);
      } else {
        setCards([]);
        setCart([]);
        persistChat(withAssistant, [], []);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function goBook() {
    const next = "/care/ai-tests";
    window.location.assign(authWithNext(next));
  }

  const showSuggestions = cfg?.features.test_suggestions !== false && cards.length > 0;
  const showBundle =
    cfg?.features.bundle_offer !== false &&
    (offerBundle || cart.length >= 2 || cards.length >= 2) &&
    cards.length > 0;

  if (!open) {
    return (
      <button
        type="button"
        id="landing-ai-health"
        onClick={() => onOpenChange(true)}
        className="landing-hero-card landing-hero-card-tile w-full px-4 py-3.5 flex items-center gap-3 text-left active:scale-[0.99]"
      >
        <span className="landing-hero-card-icon h-11 w-11 rounded-2xl grid place-items-center shrink-0">
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="landing-hero-card-body text-sm font-semibold">
            {pick(lang, "AI স্বাস্থ্য — লক্ষণ লিখুন", "AI health — describe symptoms")}
          </p>
          <p className="landing-hero-card-muted text-[11px] truncate">
            {pick(lang, "সাজেশন ও বুকিং · চ্যাটে লগইন লাগবে", "Suggestions & booking · login to chat")}
          </p>
        </div>
      </button>
    );
  }

  return (
    <div
      id="landing-ai-health"
      className="landing-hero-card w-full overflow-hidden flex flex-col max-h-[min(72dvh,640px)]"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b landing-hero-card-divider shrink-0">
        <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--landing-primary)" }} />
        <div className="min-w-0 flex-1">
          <p className="landing-hero-card-body text-sm font-semibold truncate">
            {cfg?.ui.pageTitle ?? pick(lang, "AI স্বাস্থ্য", "AI health")}
          </p>
          <p className="landing-hero-card-muted text-[10px] truncate">
            {cfg?.ui.disclaimer ??
              pick(lang, "তথ্যমূলক; চিকিৎসকের পরামর্শ নয়", "Informational only")}
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
          variant="landing"
        />
        <button
          type="button"
          onClick={startNewChat}
          className="landing-hero-card-btn-muted text-[11px] font-semibold px-2 py-1 rounded-lg"
        >
          {pick(lang, "নতুন", "New")}
        </button>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="landing-hero-card-btn-muted text-[11px] font-semibold px-2 py-1 rounded-lg"
        >
          {pick(lang, "বন্ধ", "Close")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-[140px]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user" ? "text-white" : "landing-hero-card-inner landing-hero-card-body"
              }`}
              style={m.role === "user" ? { background: "var(--landing-primary)" } : undefined}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
              {m.medicalAdvice?.trim() ? (
                <div className="mt-2 rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-2 py-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800/80 flex items-center gap-1 mb-0.5">
                    <Stethoscope className="h-3 w-3" />
                    {cfg?.ui.medicalHeading ?? pick(lang, "স্বাস্থ্য তথ্য", "Health guidance")}
                  </p>
                  <p className="text-xs whitespace-pre-wrap leading-relaxed text-black/75">{m.medicalAdvice}</p>
                </div>
              ) : null}
              {cfg?.features.expert_analysis !== false ? (
                <CareAiExpertBlock
                  analysis={m.expertAnalysis}
                  title={cfg?.ui.expertHeading ?? pick(lang, "এক্সপার্ট বিশ্লেষণ", "Expert analysis")}
                  lang={lang}
                />
              ) : null}
              {cfg?.features.specialty_suggestions !== false ? (
                <CareAiSpecialtyCards
                  items={m.specialties}
                  title={
                    cfg?.ui.specialtyHeading ?? pick(lang, "কোন বিশেষজ্ঞ দেখাবেন", "Which specialist to see")
                  }
                  cta={cfg?.ui.specialtyCta ?? pick(lang, "ডাক্তার খুঁজুন", "Find doctors")}
                  lang={lang}
                />
              ) : null}
              {cfg?.features.first_aid !== false ? (
                <CareAiFirstAidBlock
                  steps={m.firstAid}
                  buttonLabel={cfg?.ui.firstAidButton ?? pick(lang, "প্রাথমিক চিকিৎসা", "Primary first aid")}
                  heading={cfg?.ui.firstAidHeading ?? pick(lang, "প্রাথমিক চিকিৎসা", "Primary first aid")}
                  lang={lang}
                />
              ) : null}
              {m.catalogNotes?.trim() ? (
                <div className="mt-2 rounded-xl border border-sky-500/25 bg-sky-500/5 px-2 py-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-sky-800/80 flex items-center gap-1 mb-0.5">
                    <BookOpen className="h-3 w-3" />
                    {cfg?.ui.catalogHeading ?? pick(lang, "ক্যাটালগ তথ্য", "Catalog notes")}
                  </p>
                  <p className="text-xs whitespace-pre-wrap leading-relaxed text-black/75">{m.catalogNotes}</p>
                </div>
              ) : null}
            </div>
          </div>
        ))}

        {busy && (
          <p className="landing-hero-card-muted text-xs animate-pulse flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {cfg?.ui.thinking ?? pick(lang, "ভাবছি…", "Thinking…")}
          </p>
        )}

        {showSuggestions && !busy && (
          <div className="space-y-2 pt-1">
            <p className="landing-hero-card-title text-[11px] font-semibold px-0.5">
              {cfg?.ui.suggestionsHeading ?? pick(lang, "সাজেস্টেড টেস্ট / বুকিং", "Suggested tests / booking")}
            </p>
            <ul className="space-y-2">
              {cards.map((c) => {
                const inCart = cart.includes(c.catalogId);
                return (
                  <li key={c.catalogId} className="landing-hero-card-inner px-2.5 py-2.5 space-y-1.5">
                    <div className="flex items-start gap-2.5">
                      <span className="landing-hero-card-icon h-9 w-9 rounded-xl grid place-items-center shrink-0">
                        <FlaskConical className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="landing-hero-card-body text-sm font-semibold truncate">
                          {lang === "bn" ? c.nameBn : c.nameEn}
                        </p>
                        <p className="landing-hero-card-muted text-[11px]">
                          {[
                            c.code,
                            c.clinicCount
                              ? `${c.clinicCount} ${lang === "bn" ? "ক্লিনিক" : "clinics"}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {c.listPrice != null ? (
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
                        {c.reason ? (
                          <p className="landing-hero-card-muted text-xs mt-0.5 leading-snug">{c.reason}</p>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.cheapestOfferingId && (
                        <Link
                          to="/care/test/$id"
                          params={{ id: c.cheapestOfferingId }}
                          className="landing-hero-card-outline-btn rounded-lg px-2.5 py-1.5 text-[11px] font-semibold"
                        >
                          {lang === "bn" ? "বিস্তারিত" : "Details"}
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
                          inCart ? "text-white" : "landing-hero-card-outline-btn"
                        }`}
                        style={inCart ? { background: "var(--landing-primary)" } : undefined}
                      >
                        {inCart
                          ? pick(lang, "কার্টে আছে", "In cart")
                          : pick(lang, "কার্টে যোগ", "Add")}
                      </button>
                      {c.cheapestOfferingId && (
                        <a
                          href={authWithNext(`/care/test/${c.cheapestOfferingId}`)}
                          className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white"
                          style={{ background: "var(--landing-primary)" }}
                        >
                          {pick(lang, "বুক করুন", "Book")}
                        </a>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="landing-hero-card-footer shrink-0 px-3 py-2.5 space-y-2">
        {showBundle && (
          <button
            type="button"
            onClick={goBook}
            className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white inline-flex items-center justify-center gap-2"
            style={{ background: "var(--landing-primary)" }}
          >
            <ShoppingBag className="h-4 w-4" />
            {cfg?.ui.bundleCta ??
              pick(
                lang,
                cart.length
                  ? `কার্ট (${cart.length}) — একসাথে বুক করুন`
                  : "সবচেয়ে ভালো দামে একসাথে বুক করুন",
                cart.length
                  ? `Cart (${cart.length}) — book together`
                  : "Book these at the best price together",
              )}
          </button>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={taRef}
            rows={1}
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={pick(lang, "লক্ষণ বা প্রশ্ন লিখুন…", "Describe symptoms or ask…")}
            enterKeyHint="send"
            className="landing-hero-card-input flex-1 resize-none rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-white/25 min-h-[44px] max-h-[100px] leading-relaxed"
          />
          <button
            type="button"
            disabled={busy || !input.trim()}
            onClick={() => void send()}
            aria-label="Send"
            className="h-11 w-11 shrink-0 rounded-xl grid place-items-center text-white disabled:opacity-45"
            style={{ background: "var(--landing-primary)" }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="landing-hero-card-muted text-[10px]">
            {pick(lang, "চ্যাট ও বুকিংয়ে লগইন লাগবে", "Login required for chat & booking")}
          </p>
          <Link to="/care/ai-tests" className="landing-hero-card-body text-[10px] font-semibold">
            {pick(lang, "পূর্ণ পেজ →", "Full page →")}
          </Link>
        </div>
      </div>
    </div>
  );
}
