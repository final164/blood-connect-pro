import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Droplets, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AutoHideHeader } from "@/hooks/useHideOnScroll";
import { PageBackButton } from "@/components/nav/PageBackButton";
import { CareAiFollowUpPanel } from "@/components/care/CareAiFollowUpPanel";
import { CareAiChatComposer } from "@/components/care/CareAiChatComposer";
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
  KISHOREGANJ_UNIVERSITY_TAB,
  buildLocationTabBootstrapApiText,
  intentHintForTab,
  locationPresetForTab,
  type BloodDonorAiLocationTab,
} from "@/lib/blood-donor-ai-location-tabs";
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

const intentBtnClass =
  "w-full text-left rounded-xl border border-dashed border-primary/35 bg-primary/5 px-3 py-3 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-50";

export function BloodDonorAiPage() {
  const { lang } = useI18n();
  const { user } = useAuth();
  const bn = lang === "bn";
  const [cfg, setCfg] = useState<BloodDonorAiPublicConfig>(() => defaultPublicConfig());
  /** Active location preset while chatting (null = general / no auto filter) */
  const [locationTab, setLocationTab] = useState<BloodDonorAiLocationTab | null>(null);
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

  const campusTab = useMemo(() => {
    return (
      cfg.defaults.location_tabs.find((t) => t.id === KISHOREGANJ_UNIVERSITY_TAB.id) ??
      KISHOREGANJ_UNIVERSITY_TAB
    );
  }, [cfg.defaults.location_tabs]);

  const locationPinned = !!locationTab?.district?.trim();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pendingQuestions, busy]);

  const followCopy = bloodDonorFollowUpCopy(cfg, lang);

  const runChat = useCallback(
    async (
      nextMessages: Bubble[],
      hint?: string,
      presetTab?: BloodDonorAiLocationTab | null,
    ) => {
      setBusy(true);
      try {
        const tab = presetTab === undefined ? locationTab : presetTab;
        const payload = nextMessages.map((m) => ({
          role: m.role,
          text: m.apiText || m.text,
        }));
        const tabHint = intentHintForTab(tab ?? undefined);
        const result: BloodDonorAiChatResult = await bloodDonorAiChat({
          data: {
            messages: payload,
            lang,
            intentHint: hint || tabHint || intentHint || undefined,
            locationPreset: locationPresetForTab(tab ?? undefined),
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
          setPendingQuestions(
            parseBloodDonorQuestions(result.questions, cfg, lang, {
              skipGeo: !!locationPresetForTab(tab ?? undefined),
            }),
          );
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
    [cfg, intentHint, lang, locationTab],
  );

  async function pushUserMessage(
    display: string,
    opts?: {
      apiText?: string;
      hint?: string;
      presetTab?: BloodDonorAiLocationTab | null;
    },
  ) {
    if (!display.trim() || busy) return;
    const hint = opts?.hint;
    if (hint) setIntentHint(hint);
    if (opts?.presetTab !== undefined) setLocationTab(opts.presetTab);
    const userBubble: Bubble = {
      role: "user",
      text: display.trim(),
      apiText: opts?.apiText,
      intentHint: hint,
    };
    const next = [...messages, userBubble];
    setMessages(next);
    setDraft("");
    await runChat(next, hint, opts?.presetTab);
  }

  async function sendText(text: string, hint?: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (locationPinned && locationTab) {
      const apiText = [
        buildLocationTabBootstrapApiText(locationTab, cfg.ui, lang),
        `${cfg.ui.question_tag} ${bn ? "কোন রক্তের গ্রুপ / অনুরোধ?" : "Blood group / request?"}`,
        `${cfg.ui.answer_inline} ${trimmed}`,
      ].join("\n");
      await pushUserMessage(trimmed, {
        apiText,
        hint: hint ?? intentHintForTab(locationTab) ?? "sms",
      });
      return;
    }
    await pushUserMessage(trimmed, { hint });
  }

  /** Same style as “আমাকে বলুন…” — campus tab with auto district/upazila filter */
  async function startCampusDonorTab() {
    const tab = campusTab;
    const hint = intentHintForTab(tab) ?? "sms";
    const display = bn
      ? "আমাকে বলুন — কিশোরগঞ্জ বিশ্ববিদ্যালয় ডোনারদের Bulk SMS পাঠাই"
      : "Tell me — send bulk SMS to Kishoreganj University donors";
    const apiText = buildLocationTabBootstrapApiText(tab, cfg.ui, lang);
    await pushUserMessage(display, { apiText, hint, presetTab: tab });
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

  const composerPlaceholder = locationPinned
    ? bn
      ? "রক্তের গ্রুপ লিখুন (যেমন O+)…"
      : "Blood group (e.g. O+)…"
    : bn
      ? "জেলা, রক্তের গ্রুপ বা প্রশ্ন লিখুন…"
      : "District, blood group, or ask…";

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
              {locationPinned
                ? bn
                  ? `অটো: ${locationTab?.upazila || campusTab.upazila}`
                  : `Auto: ${locationTab?.upazila || campusTab.upazila}`
                : cfg.filters.gender === "male"
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

      <div className="flex-1 overflow-y-auto px-3 py-3 max-w-2xl mx-auto w-full space-y-3 pb-[calc(7.25rem+var(--app-bottom-nav-h,0px))] md:pb-28">
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
              <button
                type="button"
                disabled={busy}
                onClick={() => void startCampusDonorTab()}
                className={intentBtnClass}
              >
                {bn
                  ? "আমাকে বলুন — কিশোরগঞ্জ বিশ্ববিদ্যালয় ডোনার (অটো ফিল্টার · Bulk SMS)"
                  : "Tell me — Kishoreganj University donors (auto filter · Bulk SMS)"}
              </button>
              {cfg.intents.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    const hint = it.action === "auto" ? "" : it.action;
                    void pushUserMessage(bn ? it.label_bn : it.label_en, {
                      hint: hint || undefined,
                      presetTab: null,
                    });
                  }}
                  className={intentBtnClass}
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
            defaultUpazilaAll={cfg.defaults.upazila_all && !locationPinned}
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

      <CareAiChatComposer
        id="blood-donor-ai-composer"
        value={draft}
        onChange={setDraft}
        onSend={() => void sendText(draft, intentHintForTab(locationTab ?? undefined))}
        placeholder={composerPlaceholder}
        disabled={busy}
        busy={busy}
        className="z-40"
      />
    </div>
  );
}
