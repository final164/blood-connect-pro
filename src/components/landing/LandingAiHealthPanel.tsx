import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Send, Sparkles, Stethoscope, BookOpen, Loader2, FlaskConical, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import {
  careAiTestChat,
  fetchCareAiPublicConfig,
  type CareAiChatMessage,
  type CareAiPublicConfig,
  type CareAiSuggestedTest,
} from "@/lib/care-ai-chat";
import { fetchTestCatalog } from "@/lib/care-cms";
import { searchTestOfferings, type CareOffering } from "@/lib/care-lab-api";
import { authWithNext, AI_CHAT_RESUME_PATH, saveAiChatDraft } from "@/lib/auth-next";
import { supabase } from "@/integrations/supabase/client";

type Bubble = CareAiChatMessage & {
  medicalAdvice?: string;
  catalogNotes?: string;
  offerBundle?: boolean;
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
  const taRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetchCareAiPublicConfig({ data: { lang } })
      .then((c) => {
        if (cancelled) return;
        setCfg(c);
        setMessages((prev) => (prev.length ? prev : [{ role: "assistant", text: c.ui.welcome }]));
      })
      .catch((e) => toast.error((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [open, lang]);

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
    setBusy(true);
    try {
      const res = await careAiTestChat({
        data: {
          lang,
          messages: next.map((m) => ({ role: m.role, text: m.text })),
        },
      });
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          text: res.reply,
          medicalAdvice: res.medical_advice,
          catalogNotes: res.catalog_notes,
          offerBundle: res.offer_bundle,
        },
      ]);
      setOfferBundle(res.offer_bundle === true);
      if (res.suggested_tests.length && cfg?.features.test_suggestions !== false) {
        const ids = res.suggested_tests.map((s) => s.catalog_id);
        const [offerings, catalog] = await Promise.all([
          searchTestOfferings({ catalogIds: ids }),
          fetchTestCatalog(),
        ]);
        setCards(buildCards(res.suggested_tests, offerings, catalog));
        setCart([]);
      } else {
        setCards([]);
        setCart([]);
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
        className="w-full rounded-2xl border border-black/5 bg-white/95 shadow-lg shadow-black/10 px-4 py-3.5 flex items-center gap-3 text-left transition hover:bg-white active:scale-[0.99]"
      >
        <span
          className="h-11 w-11 rounded-2xl grid place-items-center shrink-0"
          style={{
            color: "var(--landing-primary)",
            background: "color-mix(in srgb, var(--landing-primary) 12%, transparent)",
          }}
        >
          <Sparkles className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-black/90">
            {pick(lang, "AI স্বাস্থ্য — লক্ষণ লিখুন", "AI health — describe symptoms")}
          </p>
          <p className="text-[11px] text-black/50 truncate">
            {pick(lang, "সাজেশন ও বুকিং · চ্যাটে লগইন লাগবে", "Suggestions & booking · login to chat")}
          </p>
        </div>
      </button>
    );
  }

  return (
    <div
      id="landing-ai-health"
      className="w-full rounded-2xl border border-black/5 bg-white/95 shadow-lg shadow-black/10 overflow-hidden flex flex-col max-h-[min(72dvh,640px)]"
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-black/5 shrink-0">
        <Sparkles className="h-4 w-4 shrink-0" style={{ color: "var(--landing-primary)" }} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-black/90 truncate">
            {cfg?.ui.pageTitle ?? pick(lang, "AI স্বাস্থ্য", "AI health")}
          </p>
          <p className="text-[10px] text-black/45 truncate">
            {cfg?.ui.disclaimer ??
              pick(lang, "তথ্যমূলক; চিকিৎসকের পরামর্শ নয়", "Informational only")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="text-[11px] font-semibold px-2 py-1 rounded-lg hover:bg-black/5 text-black/50"
        >
          {pick(lang, "বন্ধ", "Close")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 min-h-[140px]">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "text-white"
                  : "border border-black/8 bg-black/[0.02] text-black/85"
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
          <p className="text-xs text-black/45 animate-pulse flex items-center gap-1.5">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {cfg?.ui.thinking ?? pick(lang, "ভাবছি…", "Thinking…")}
          </p>
        )}

        {showSuggestions && !busy && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] font-semibold text-black/50 px-0.5">
              {cfg?.ui.suggestionsHeading ?? pick(lang, "সাজেস্টেড টেস্ট / বুকিং", "Suggested tests / booking")}
            </p>
            <ul className="space-y-2">
              {cards.map((c) => {
                const inCart = cart.includes(c.catalogId);
                return (
                  <li
                    key={c.catalogId}
                    className="rounded-xl border border-black/8 bg-black/[0.015] px-2.5 py-2.5 space-y-1.5"
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className="h-9 w-9 rounded-xl grid place-items-center shrink-0"
                        style={{
                          color: "var(--landing-primary)",
                          background: "color-mix(in srgb, var(--landing-primary) 12%, transparent)",
                        }}
                      >
                        <FlaskConical className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-black/90 truncate">
                          {lang === "bn" ? c.nameBn : c.nameEn}
                        </p>
                        <p className="text-[11px] text-black/45">
                          {[
                            c.code,
                            c.cheapest != null ? `৳${c.cheapest}` : null,
                            c.clinicCount
                              ? `${c.clinicCount} ${lang === "bn" ? "ক্লিনিক" : "clinics"}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                        {c.reason ? <p className="text-xs text-black/55 mt-0.5 leading-snug">{c.reason}</p> : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.cheapestOfferingId && (
                        <Link
                          to="/care/test/$id"
                          params={{ id: c.cheapestOfferingId }}
                          className="rounded-lg border border-black/10 px-2.5 py-1.5 text-[11px] font-semibold text-black/75"
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
                          inCart ? "text-white" : "border border-black/10 text-black/75"
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

      <div className="shrink-0 border-t border-black/5 px-3 py-2.5 space-y-2 bg-white">
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
            className="flex-1 resize-none rounded-xl border border-black/10 bg-black/[0.02] px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-[color:var(--landing-primary)]/30 min-h-[44px] max-h-[100px] leading-relaxed text-black/90"
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
          <p className="text-[10px] text-black/40">
            {pick(lang, "চ্যাট ও বুকিংয়ে লগইন লাগবে", "Login required for chat & booking")}
          </p>
          <Link
            to="/care/ai-tests"
            className="text-[10px] font-semibold"
            style={{ color: "var(--landing-primary)" }}
          >
            {pick(lang, "পূর্ণ পেজ →", "Full page →")}
          </Link>
        </div>
      </div>
    </div>
  );
}
