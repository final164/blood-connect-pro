import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Droplets, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { CareAiFollowUpPanel } from "@/components/care/CareAiFollowUpPanel";
import { BloodDonorAiResultCards } from "@/components/blood-donor-ai/BloodDonorAiResultCards";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { authWithNext } from "@/lib/auth-next";
import {
  bloodDonorAiChat,
  fetchBloodDonorAiPublicConfig,
  type BloodDonorAiChatResult,
  type BloodDonorAiToolResults,
} from "@/lib/blood-donor-ai-chat";
import type { BloodDonorAiPublicConfig } from "@/lib/blood-donor-ai-settings";
import {
  bloodDonorFollowUpCopy,
  defaultPublicConfig,
  parseBloodDonorQuestions,
} from "@/lib/blood-donor-ai-followup";
import { isUpazilaAllValue, upazilaSlotLabel } from "@/lib/blood-donor-ai-slots";
import {
  displayAnswerBubble,
  displayBatchAnswerBubble,
  formatFollowUpAnswer,
  formatFollowUpBatchAnswer,
  type FollowUpQuestion,
} from "@/lib/care-ai-followup";

type Bubble = {
  role: "user" | "assistant";
  text: string;
  apiText?: string;
  questions?: string[];
  toolResults?: BloodDonorAiToolResults | null;
  intentHint?: string;
};

export function BloodDonorAiPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const bn = lang === "bn";
  const [cfg, setCfg] = useState<BloodDonorAiPublicConfig>(defaultPublicConfig);
  const [messages, setMessages] = useState<Bubble[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [activeQ, setActiveQ] = useState<FollowUpQuestion | null>(null);
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const [pendingQuestions, setPendingQuestions] = useState<FollowUpQuestion[]>([]);
  const [intentHint, setIntentHint] = useState<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetchBloodDonorAiPublicConfig({ data: { lang } })
      .then((c) => setCfg(c))
      .catch(() => setCfg(defaultPublicConfig()));
  }, [lang]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingQuestions, busy]);

  const followCopy = bloodDonorFollowUpCopy(cfg, lang);

  const runChat = useCallback(
    async (nextMessages: Bubble[], hint?: string) => {
      setBusy(true);
      try {
        const payload = nextMessages.map((m) => ({
          role: m.role,
          text: m.apiText || m.text,
        }));
        const result: BloodDonorAiChatResult = await bloodDonorAiChat({
          data: {
            messages: payload,
            lang,
            intentHint: hint || intentHint || undefined,
          },
        });
        const assistant: Bubble = {
          role: "assistant",
          text: result.reply,
          questions: result.questions,
          toolResults: result.tool_results,
        };
        setMessages([...nextMessages, assistant]);
        if (result.questions?.length) {
          setPendingQuestions(parseBloodDonorQuestions(result.questions, cfg, lang));
          setAnswered(new Set());
          setActiveQ(null);
        } else {
          setPendingQuestions([]);
          setAnswered(new Set());
          setActiveQ(null);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "AI failed");
      } finally {
        setBusy(false);
      }
    },
    [cfg, intentHint, lang],
  );

  async function sendText(text: string, hint?: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    if (hint) setIntentHint(hint);
    const userBubble: Bubble = { role: "user", text: trimmed, intentHint: hint };
    const next = [...messages, userBubble];
    setMessages(next);
    setDraft("");
    await runChat(next, hint);
  }

  function donorAnswerLabel(question: FollowUpQuestion, answer: string) {
    if (question.geo === "upazila" && isUpazilaAllValue(answer)) {
      return upazilaSlotLabel(answer, lang);
    }
    return answer;
  }

  function onFollowUp(question: FollowUpQuestion, answer: string) {
    const label = donorAnswerLabel(question, answer);
    const apiText = formatFollowUpAnswer(question.text, answer, followCopy);
    const display = displayAnswerBubble(question.text, label, followCopy);
    const userBubble: Bubble = { role: "user", text: display, apiText };
    const next = [...messages, userBubble];
    setMessages(next);
    setAnswered((prev) => new Set([...prev, question.text]));
    setActiveQ(null);
    void runChat(next);
  }

  function onFollowUpBatch(entries: { question: FollowUpQuestion; answer: string }[]) {
    const apiText = formatFollowUpBatchAnswer(
      entries.map((e) => ({ question: e.question.text, answer: e.answer })),
      followCopy,
    );
    const display = displayBatchAnswerBubble(
      entries.map((e) => ({
        question: e.question.text,
        answer: donorAnswerLabel(e.question, e.answer),
      })),
      followCopy,
    );
    const userBubble: Bubble = { role: "user", text: display, apiText };
    const next = [...messages, userBubble];
    setMessages(next);
    setAnswered((prev) => {
      const n = new Set(prev);
      for (const e of entries) n.add(e.question.text);
      return n;
    });
    setActiveQ(null);
    void runChat(next);
  }

  function needLogin() {
    window.location.assign(authWithNext("/ai/donors"));
  }

  if (!cfg.enabled) {
    return (
      <div className="min-h-dvh flex flex-col">
        <AutoHideHeader className="z-30 border-b bg-background safe-top">
          <div className="flex items-center gap-2 px-3 py-2">
            <PageBackButton />
            <Droplets className="h-4 w-4 text-primary shrink-0" />
            <p className="text-sm font-bold">{bn ? "ব্লাড ডোনার AI" : "Blood Donor AI"}</p>
          </div>
        </AutoHideHeader>
        <div className="flex-1 grid place-items-center p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {bn ? "Admin-এ Blood Donor AI বন্ধ আছে।" : "Blood Donor AI is disabled in Admin."}
          </p>
          <Link to="/community" className="mt-4 text-sm font-semibold text-primary">
            {bn ? "কমিউনিটিতে যান" : "Go to Community"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <AutoHideHeader className="z-30 border-b bg-background/95 backdrop-blur safe-top">
        <div className="flex items-center gap-2 px-3 py-2 max-w-2xl mx-auto w-full">
          <PageBackButton />
          <Droplets className="h-4 w-4 text-primary shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold truncate">
              {bn ? "ব্লাড ডোনার AI" : "Blood Donor AI"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {cfg.filters.gender === "male"
                ? bn
                  ? "শুধু পুরুষ ডোনার"
                  : "Male donors only"
                : cfg.filters.gender === "female"
                  ? bn
                    ? "শুধু নারী ডোনার"
                    : "Female donors only"
                  : bn
                    ? "সব ডোনার"
                    : "All donors"}
            </p>
          </div>
        </div>
      </AutoHideHeader>

      <div className="flex-1 overflow-y-auto px-3 py-3 max-w-2xl mx-auto w-full space-y-3 pb-36">
        {messages.length === 0 && (
          <div className="rounded-2xl border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <p className="text-sm font-bold">{bn ? cfg.ui.welcome_bn : cfg.ui.welcome_en}</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {bn ? cfg.ui.disclaimer_bn : cfg.ui.disclaimer_en}
            </p>
            <div className="space-y-2">
              {cfg.intents.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    void sendText(bn ? it.label_bn : it.label_en, it.action === "auto" ? "" : it.action)
                  }
                  className="w-full text-left rounded-xl border border-dashed border-primary/35 bg-primary/5 px-3 py-3 text-xs font-semibold text-primary hover:bg-primary/10"
                >
                  {bn ? it.label_bn : it.label_en}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted/70 border"
              }`}
            >
              {m.text}
              {m.role === "assistant" && m.toolResults ? (
                <BloodDonorAiResultCards
                  results={m.toolResults}
                  cfg={cfg}
                  lang={lang}
                  loggedIn={!!user}
                  onNeedLogin={needLogin}
                />
              ) : null}
            </div>
          </div>
        ))}

        {pendingQuestions.length > 0 && (
          <CareAiFollowUpPanel
            questions={pendingQuestions}
            active={activeQ}
            answered={answered}
            busy={busy}
            copy={followCopy}
            defaultUpazilaAll={cfg.defaults.upazila_all}
            onSelect={setActiveQ}
            onSubmit={onFollowUp}
            onSubmitBatch={onFollowUpBatch}
          />
        )}

        {busy && (
          <p className="text-xs text-muted-foreground animate-pulse px-1">
            {bn ? "AI ভাবছে…" : "AI is thinking…"}
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur safe-bottom">
        <form
          className="max-w-2xl mx-auto flex items-end gap-2 px-3 py-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            void sendText(draft);
          }}
        >
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={1}
            disabled={busy}
            placeholder={bn ? "জেলা, রক্তের গ্রুপ বা প্রশ্ন লিখুন…" : "District, blood group, or ask…"}
            className="flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30 min-h-[44px] max-h-28"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendText(draft);
              }
            }}
          />
          <button
            type="submit"
            disabled={busy || !draft.trim()}
            className="h-11 w-11 rounded-xl bg-primary text-primary-foreground grid place-items-center disabled:opacity-40"
            aria-label="Send"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
