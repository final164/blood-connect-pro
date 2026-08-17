import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  buildChatSystemPrompt,
  getPublicAiConfig,
  normalizeGeminiSettingsExtended,
  type CareAiPublicConfig,
} from "@/lib/gemini-ai-config";
export type { CareAiPublicConfig } from "@/lib/gemini-ai-config";
import { adminClient, fetchSettingsRaw, fillPrompt, geminiGenerate } from "@/lib/gemini-rotate";

export type CareAiChatMessage = { role: "user" | "assistant"; text: string };

export type CareAiSuggestedTest = { catalog_id: string; code: string; reason: string };

export type CareAiChatResult = {
  reply: string;
  medical_advice: string;
  catalog_notes: string;
  questions: string[];
  suggested_tests: CareAiSuggestedTest[];
  offer_bundle: boolean;
};

type CatalogRow = {
  id: string;
  code: string;
  name_bn: string;
  name_en: string;
  category_id: string | null;
};

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI returned non-JSON");
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    throw new Error("AI returned invalid JSON");
  }
}

function friendlyAiError(e: unknown, lang: "bn" | "en"): string {
  const msg = e instanceof Error ? e.message : String(e);
  const bn = lang === "bn";
  if (/No Gemini API keys/i.test(msg)) {
    return bn
      ? "Admin → Settings → Gemini API-তে API key যোগ করুন।"
      : "Add a Gemini API key in Admin → Settings → Gemini API.";
  }
  if (/does not exist|schema cache|gemini_api_keys|gemini_settings/i.test(msg)) {
    return bn ? "Supabase-এ Gemini SQL migration চালান।" : "Run the Gemini SQL migration in Supabase.";
  }
  if (/SERVICE_ROLE|Server auth is not configured/i.test(msg)) {
    return bn ? "সার্ভারে SUPABASE_SERVICE_ROLE_KEY সেট নেই।" : "Set SUPABASE_SERVICE_ROLE_KEY on the server.";
  }
  if (/disabled/i.test(msg)) {
    return bn ? "Admin-এ Gemini AI বন্ধ আছে — চালু করুন।" : "Gemini AI is disabled in Admin. Turn it on.";
  }
  if (/404|not found for api version|is not found/i.test(msg)) {
    return bn
      ? "এই মডেল API-তে নেই। Admin-এ Primary মডেল বদলান (gemini-3.6-flash)।"
      : "That model is not available. Change Primary in Admin (gemini-3.6-flash).";
  }
  if (/API_KEY_INVALID|API key not valid|401|403/i.test(msg)) {
    return bn ? "Gemini API key অবৈধ। Admin-এ key এডিট করে নতুন key দিন।" : "Gemini API key is invalid. Update it in Admin.";
  }
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) {
    return bn ? "সব API key-এর কোটা শেষ। অন্য key যোগ করুন।" : "All Gemini keys hit quota. Add another key.";
  }
  if (/Empty Gemini|blocked/i.test(msg)) {
    return bn ? "মডেল খালি/ব্লকড উত্তর দিয়েছে। অন্য মডেল চেষ্টা করুন।" : "The model returned an empty or blocked reply. Try another model.";
  }
  if (/non-JSON|invalid JSON/i.test(msg)) {
    return bn ? "AI উত্তর পার্স করা যায়নি। অন্য মডেল চেষ্টা করুন।" : "Could not parse the AI reply. Try another model.";
  }
  return bn ? `AI কাজ করেনি: ${msg.slice(0, 180)}` : `AI failed: ${msg.slice(0, 180)}`;
}

function asString(v: unknown) {
  return typeof v === "string" ? v.trim() : "";
}

async function loadCatalog(limit: number): Promise<CatalogRow[]> {
  const sb = adminClient();
  const { data, error } = await sb
    .from("care_test_catalog")
    .select("id, code, name_bn, name_en, category_id")
    .eq("is_active", true)
    .order("sort_order")
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []) as CatalogRow[];
}

function compactCatalog(catalog: CatalogRow[]) {
  return catalog.map((c) => `${c.id}|${c.code}|${c.name_bn}|${c.name_en}`).join("\n");
}

function resolveAgainstCatalog(raw: unknown, catalog: CatalogRow[], max: number): CareAiSuggestedTest[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const byCode = new Map(catalog.map((c) => [c.code.trim().toLowerCase(), c]));
  const byName = new Map<string, CatalogRow>();
  for (const c of catalog) {
    byName.set(c.name_en.trim().toLowerCase(), c);
    byName.set(c.name_bn.trim().toLowerCase(), c);
  }
  const items = Array.isArray(raw) ? raw : [];
  const out: CareAiSuggestedTest[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const row = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const id = asString(row.catalog_id);
    const code = asString(row.code);
    const name = asString(row.name);
    const hit =
      byId.get(id) ||
      byCode.get(code.toLowerCase()) ||
      (name ? byName.get(name.toLowerCase()) : undefined);
    if (!hit || seen.has(hit.id)) continue;
    seen.add(hit.id);
    out.push({
      catalog_id: hit.id,
      code: hit.code,
      reason: asString(row.reason).slice(0, 280) || hit.name_en,
    });
  }
  return out.slice(0, max);
}

async function matchFuzzy(unresolved: unknown[], catalog: CatalogRow[], prompt: string, max: number): Promise<CareAiSuggestedTest[]> {
  if (!unresolved.length) return [];
  try {
    const text = await geminiGenerate({
      modelRole: "match",
      json: true,
      systemText: fillPrompt(prompt, { catalog: compactCatalog(catalog) }),
      userText: JSON.stringify({ mentions: unresolved }),
    });
    const parsed = parseJsonObject(text);
    return resolveAgainstCatalog(parsed.suggested_tests, catalog, max);
  } catch {
    return [];
  }
}

export const fetchCareAiPublicConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { lang?: "bn" | "en" }) => ({
    lang: data?.lang === "en" ? ("en" as const) : ("bn" as const),
  }))
  .handler(async ({ data }): Promise<CareAiPublicConfig> => {
    const sb = adminClient();
    const settings = normalizeGeminiSettingsExtended(await fetchSettingsRaw(sb));
    return getPublicAiConfig(settings, data.lang);
  });

export const careAiTestChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { messages: CareAiChatMessage[]; lang?: "bn" | "en" }) => {
    const messages = Array.isArray(data?.messages) ? data.messages : [];
    const cleaned: CareAiChatMessage[] = messages
      .slice(-6)
      .map((m) => {
        const role: CareAiChatMessage["role"] = m?.role === "assistant" ? "assistant" : "user";
        return { role, text: String(m?.text ?? "").trim().slice(0, 2000) };
      })
      .filter((m) => m.text);
    if (!cleaned.length) throw new Error("Message required");
    return { messages: cleaned, lang: data?.lang === "en" ? ("en" as const) : ("bn" as const) };
  })
  .handler(async ({ data }): Promise<CareAiChatResult> => {
    const sb = adminClient();
    const settings = normalizeGeminiSettingsExtended(await fetchSettingsRaw(sb));
    const { features } = settings;
    const catalog = await loadCatalog(settings.max_catalog_items);
    if (!catalog.length) {
      return {
        reply:
          data.lang === "bn"
            ? "এখন ক্যাটালগে কোনো টেস্ট নেই। পরে আবার চেষ্টা করুন।"
            : "No tests are in the catalog yet. Please try again later.",
        medical_advice: "",
        catalog_notes: "",
        questions: [],
        suggested_tests: [],
        offer_bundle: false,
      };
    }

    const catalogText = compactCatalog(catalog);
    const systemText = buildChatSystemPrompt(settings, data.lang, catalogText);

    const history = data.messages
      .map((m) => `${m.role === "assistant" ? "ASSISTANT" : "USER"}: ${m.text}`)
      .join("\n");

    let rawText: string;
    try {
      rawText = await geminiGenerate({
        userText: history,
        systemText,
        json: true,
        modelRole: "primary",
      });
    } catch (e) {
      console.error("[careAiTestChat]", e);
      throw new Error(friendlyAiError(e, data.lang));
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = parseJsonObject(rawText);
    } catch (e) {
      console.error("[careAiTestChat] parse", e, rawText.slice(0, 400));
      throw new Error(friendlyAiError(e, data.lang));
    }

    let suggested = features.test_suggestions
      ? resolveAgainstCatalog(parsed.suggested_tests, catalog, settings.max_suggestions)
      : [];
    if (
      features.match_fallback &&
      features.test_suggestions &&
      !suggested.length &&
      Array.isArray(parsed.suggested_tests) &&
      parsed.suggested_tests.length
    ) {
      suggested = await matchFuzzy(
        parsed.suggested_tests as unknown[],
        catalog,
        settings.prompt_match,
        settings.max_suggestions,
      );
    }

    const questions =
      features.follow_up_questions && Array.isArray(parsed.questions)
        ? parsed.questions.map(asString).filter(Boolean).slice(0, settings.max_questions)
        : [];
    const reply =
      asString(parsed.reply) ||
      (data.lang === "bn"
        ? "আরও বিস্তারিত লক্ষণ লিখুন, তাহলে ক্যাটালগ থেকে টেস্ট সাজেস্ট করতে পারব।"
        : "Tell me a bit more about the symptoms so I can suggest catalog tests.");
    const medical_advice = features.medical_advice ? asString(parsed.medical_advice).slice(0, 1200) : "";
    const catalog_notes = features.catalog_notes ? asString(parsed.catalog_notes).slice(0, 1600) : "";
    const offer_bundle =
      features.bundle_offer && features.test_suggestions && parsed.offer_bundle === true && suggested.length >= 2;

    return {
      reply,
      medical_advice,
      catalog_notes,
      questions,
      suggested_tests: suggested,
      offer_bundle,
    };
  });
