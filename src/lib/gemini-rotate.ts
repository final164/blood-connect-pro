import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL } from "@/integrations/supabase/public-env";

export type GeminiThinkingLevel = "minimal" | "low" | "medium" | "high";

export type GeminiSettings = {
  enabled: boolean;
  primary_model: string;
  fallback_model: string;
  match_model: string;
  thinking_level: GeminiThinkingLevel;
  max_output_tokens: number;
  max_catalog_items: number;
  match_enabled: boolean;
  prompt_chat_bn: string;
  prompt_chat_en: string;
  prompt_match: string;
};

export const DEFAULT_PROMPT_CHAT_BN = `আপনি BloodLink Care-এর AI স্বাস্থ্য ও ল্যাব-টেস্ট সহায়ক। আপনি ডাক্তার নন — রোগ নির্ণয়, ওষুধ বা ডোজ দেবেন না।
নিয়ম:
- reply: সংক্ষিপ্ত সহানুভূতিপূর্ণ সারাংশ।
- medical_advice (যখন চালু): সাধারণ স্বাস্থ্য তথ্য — জরুরি লক্ষণে হাসপাতাল যাওয়ার পরামর্শ।
- catalog_notes (যখন চালু): ক্যাটালগের টেস্টের নাম, প্রস্তুতি, কেন প্রাসঙ্গিক — সুন্দর বুলেট/অনুচ্ছেদ।
- suggested_tests: শুধু নিচের ক্যাটালগ থেকে; বাইরে কিছু উদ্ভাবন নিষেধ।
- ইতিহাস কম হলে বয়স, সময়কাল, জানা রোগ জিজ্ঞাসা করুন।
- শুধু JSON — markdown বা অতিরিক্ত টেক্সট নয়।

CATALOG (id|code|name_bn|name_en):
{{catalog}}

Language: {{lang}}`;

export const DEFAULT_PROMPT_CHAT_EN = `You are BloodLink Care's AI health & lab-test assistant. You are not a doctor — no diagnosis, prescriptions, or doses.
Rules:
- reply: short empathetic summary.
- medical_advice (when enabled): general wellness guidance; advise emergency care for red flags.
- catalog_notes (when enabled): formatted notes from catalog tests (names, prep, relevance).
- suggested_tests: catalog only — never invent tests.
- If history is thin, ask age, duration, and known conditions.
- JSON only — no markdown or extra text.

CATALOG (id|code|name_bn|name_en):
{{catalog}}

Language: {{lang}}`;

export const DEFAULT_PROMPT_MATCH = `Map lab-test mentions to catalog entries. Return JSON only:
{"suggested_tests":[{"catalog_id":"uuid","code":"CODE","reason":"why"}]}
Use only catalog ids. Never invent tests.

CATALOG:
{{catalog}}`;

export const DEFAULT_GEMINI_SETTINGS: GeminiSettings = {
  enabled: true,
  primary_model: "gemini-3.5-flash-lite",
  fallback_model: "gemini-3.5-flash",
  match_model: "gemini-3.5-flash-lite",
  thinking_level: "minimal",
  max_output_tokens: 1024,
  max_catalog_items: 120,
  match_enabled: false,
  prompt_chat_bn: DEFAULT_PROMPT_CHAT_BN,
  prompt_chat_en: DEFAULT_PROMPT_CHAT_EN,
  prompt_match: DEFAULT_PROMPT_MATCH,
};

const THINKING_LEVELS: GeminiThinkingLevel[] = ["minimal", "low", "medium", "high"];

/** Official Gemini generateContent model IDs for the admin catalog. */
export const GEMINI_MODEL_CATALOG_SEED: { slug: string; label: string; is_active: boolean; sort_order: number }[] = [
  { slug: "gemini-flash-latest", label: "Gemini Flash (latest alias)", is_active: true, sort_order: 5 },
  { slug: "gemini-flash-lite-latest", label: "Gemini Flash-Lite (latest alias)", is_active: true, sort_order: 6 },
  { slug: "gemini-pro-latest", label: "Gemini Pro (latest alias)", is_active: true, sort_order: 7 },
  { slug: "gemini-3.7-flash", label: "Gemini 3.7 Flash", is_active: true, sort_order: 8 },
  { slug: "gemini-3.6-flash", label: "Gemini 3.6 Flash (recommended)", is_active: true, sort_order: 10 },
  { slug: "gemini-3.5-flash", label: "Gemini 3.5 Flash", is_active: true, sort_order: 20 },
  { slug: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash-Lite", is_active: true, sort_order: 30 },
  { slug: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview", is_active: true, sort_order: 40 },
  { slug: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite", is_active: true, sort_order: 50 },
  { slug: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", is_active: true, sort_order: 60 },
  { slug: "gemini-3-pro-preview", label: "Gemini 3 Pro Preview", is_active: true, sort_order: 70 },
  { slug: "gemini-2.5-flash", label: "Gemini 2.5 Flash (unavailable to new keys)", is_active: false, sort_order: 80 },
  { slug: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (unavailable to new keys)", is_active: false, sort_order: 90 },
  { slug: "gemini-2.5-pro", label: "Gemini 2.5 Pro", is_active: true, sort_order: 100 },
  { slug: "gemini-2.5-flash-image", label: "Gemini 2.5 Flash Image", is_active: true, sort_order: 110 },
  { slug: "gemini-2.0-flash", label: "Gemini 2.0 Flash (legacy)", is_active: true, sort_order: 120 },
  { slug: "gemini-2.0-flash-001", label: "Gemini 2.0 Flash 001 (legacy)", is_active: true, sort_order: 130 },
  { slug: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash-Lite (legacy)", is_active: true, sort_order: 140 },
  { slug: "gemini-2.0-flash-lite-001", label: "Gemini 2.0 Flash-Lite 001 (legacy)", is_active: true, sort_order: 150 },
  { slug: "gemini-1.5-flash", label: "Gemini 1.5 Flash (legacy)", is_active: true, sort_order: 160 },
  { slug: "gemini-1.5-flash-8b", label: "Gemini 1.5 Flash 8B (legacy)", is_active: true, sort_order: 170 },
  { slug: "gemini-1.5-pro", label: "Gemini 1.5 Pro (legacy)", is_active: true, sort_order: 180 },
];

export type GeminiKeyRow = {
  id: string;
  name: string;
  api_key: string;
  status: "active" | "quota" | "error" | "disabled";
  last_used_at: string | null;
  error_count: number;
  last_error: string | null;
  sort_order: number;
  is_active: boolean;
};

function adminClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("Server auth is not configured — set SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function normalizeGeminiSettings(raw: unknown): GeminiSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const thinking = String(r.thinking_level ?? DEFAULT_GEMINI_SETTINGS.thinking_level) as GeminiThinkingLevel;
  return {
    enabled: r.enabled !== false,
    primary_model:
      typeof r.primary_model === "string" && r.primary_model
        ? r.primary_model
        : DEFAULT_GEMINI_SETTINGS.primary_model,
    fallback_model:
      typeof r.fallback_model === "string" && r.fallback_model
        ? r.fallback_model
        : DEFAULT_GEMINI_SETTINGS.fallback_model,
    match_model:
      typeof r.match_model === "string" && r.match_model ? r.match_model : DEFAULT_GEMINI_SETTINGS.match_model,
    thinking_level: THINKING_LEVELS.includes(thinking) ? thinking : "minimal",
    max_output_tokens: Math.min(4096, Math.max(256, Number(r.max_output_tokens) || DEFAULT_GEMINI_SETTINGS.max_output_tokens)),
    max_catalog_items: Math.min(400, Math.max(20, Number(r.max_catalog_items) || DEFAULT_GEMINI_SETTINGS.max_catalog_items)),
    match_enabled: r.match_enabled === true,
    prompt_chat_bn: typeof r.prompt_chat_bn === "string" && r.prompt_chat_bn.trim() ? r.prompt_chat_bn : DEFAULT_PROMPT_CHAT_BN,
    prompt_chat_en: typeof r.prompt_chat_en === "string" && r.prompt_chat_en.trim() ? r.prompt_chat_en : DEFAULT_PROMPT_CHAT_EN,
    prompt_match: typeof r.prompt_match === "string" && r.prompt_match.trim() ? r.prompt_match : DEFAULT_PROMPT_MATCH,
  };
}

export function fillPrompt(template: string, vars: Record<string, string>) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");
}

export function isQuotaLike(status: number, body: string): boolean {
  if (status === 429) return true;
  const t = body.toLowerCase();
  return (
    t.includes("resource_exhausted") ||
    t.includes("quota") ||
    t.includes("rate limit") ||
    t.includes("resource exhausted") ||
    t.includes("exceeded")
  );
}

async function fetchSettingsRaw(sb: ReturnType<typeof adminClient>): Promise<unknown> {
  const { data } = await sb.from("app_settings").select("gemini_settings").eq("id", 1).maybeSingle();
  return (data as { gemini_settings?: unknown } | null)?.gemini_settings;
}

async function fetchSettings(sb: ReturnType<typeof adminClient>): Promise<GeminiSettings> {
  return normalizeGeminiSettings(await fetchSettingsRaw(sb));
}

async function loadKeys(sb: ReturnType<typeof adminClient>): Promise<GeminiKeyRow[]> {
  const { data, error } = await sb
    .from("gemini_api_keys")
    .select("id, name, api_key, status, last_used_at, error_count, last_error, sort_order, is_active")
    .eq("is_active", true)
    .neq("status", "disabled")
    .order("sort_order")
    .order("last_used_at", { ascending: true, nullsFirst: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as GeminiKeyRow[];
}

async function markKey(
  sb: ReturnType<typeof adminClient>,
  id: string,
  patch: Partial<Pick<GeminiKeyRow, "status" | "last_error">> & { bumpError?: boolean },
) {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.status) row.status = patch.status;
  if (patch.last_error !== undefined) row.last_error = patch.last_error;
  if (patch.status === "active") {
    row.last_used_at = new Date().toISOString();
    row.last_error = null;
  }
  if (patch.bumpError) {
    const { data } = await sb.from("gemini_api_keys").select("error_count").eq("id", id).maybeSingle();
    row.error_count = Number((data as { error_count?: number } | null)?.error_count ?? 0) + 1;
  }
  await sb.from("gemini_api_keys").update(row as never).eq("id", id);
}

function isGemini3Family(model: string) {
  const m = model.toLowerCase();
  return (
    m.startsWith("gemini-3") ||
    m === "gemini-flash-latest" ||
    m === "gemini-flash-lite-latest" ||
    m === "gemini-pro-latest"
  );
}

function isModelIssue(status: number, body: string): boolean {
  if (status === 404) return true;
  const t = body.toLowerCase();
  return (
    status === 400 &&
    (t.includes("not found") ||
      t.includes("not supported") ||
      t.includes("unknown name") ||
      t.includes("invalid argument") ||
      t.includes("temperature") ||
      t.includes("is not found for api version"))
  );
}

function extractGeminiText(body: string): string {
  const parsed = JSON.parse(body) as {
    candidates?: {
      finishReason?: string;
      content?: { parts?: { text?: string; thought?: boolean }[] };
    }[];
    promptFeedback?: { blockReason?: string };
  };
  const cand = parsed.candidates?.[0];
  const text =
    cand?.content?.parts
      ?.filter((p) => !p.thought)
      .map((p) => p.text ?? "")
      .join("") ||
    cand?.content?.parts?.map((p) => p.text ?? "").join("") ||
    "";
  if (text.trim()) return text;
  const block = parsed.promptFeedback?.blockReason || cand?.finishReason;
  if (block && block !== "STOP") throw new Error(`Gemini blocked (${block})`);
  throw new Error("Empty Gemini response");
}

async function callGemini(
  apiKey: string,
  model: string,
  userText: string,
  systemText?: string,
  json = false,
  speed?: { thinkingLevel: GeminiThinkingLevel; maxOutputTokens: number },
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const thinkingLevel = speed?.thinkingLevel ?? "minimal";
  const maxOutputTokens = speed?.maxOutputTokens ?? 1024;
  const generationConfig: Record<string, unknown> = {
    maxOutputTokens,
    ...(json ? { responseMimeType: "application/json" } : {}),
  };
  if (isGemini3Family(model)) {
    generationConfig.thinkingConfig = { thinkingLevel };
  } else if (/gemini-2\.5/i.test(model)) {
    generationConfig.thinkingConfig = { thinkingBudget: 0 };
  } else {
    generationConfig.temperature = 0.3;
  }

  const payload: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig,
  };
  if (systemText) {
    payload.systemInstruction = { parts: [{ text: systemText }] };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.text();
  if (!res.ok && res.status === 400 && generationConfig.thinkingConfig) {
    delete generationConfig.thinkingConfig;
    const retry = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const retryBody = await retry.text();
    if (!retry.ok) {
      const err = new Error(`Gemini ${retry.status} (${model}): ${retryBody.slice(0, 400)}`);
      (err as Error & { status?: number; body?: string }).status = retry.status;
      (err as Error & { status?: number; body?: string }).body = retryBody;
      throw err;
    }
    return extractGeminiText(retryBody);
  }
  if (!res.ok) {
    const err = new Error(`Gemini ${res.status} (${model}): ${body.slice(0, 400)}`);
    (err as Error & { status?: number; body?: string }).status = res.status;
    (err as Error & { status?: number; body?: string }).body = body;
    throw err;
  }
  return extractGeminiText(body);
}

export async function geminiGenerate(opts: {
  userText: string;
  systemText?: string;
  json?: boolean;
  modelRole?: "primary" | "fallback" | "match";
}): Promise<string> {
  const sb = adminClient();
  const settings = await fetchSettings(sb);
  if (!settings.enabled) throw new Error("Gemini AI is disabled");

  const primary =
    opts.modelRole === "match"
      ? settings.match_model
      : opts.modelRole === "fallback"
        ? settings.fallback_model
        : settings.primary_model;
  const models = [...new Set([primary, settings.fallback_model].filter(Boolean))];

  const keys = await loadKeys(sb);
  if (!keys.length) throw new Error("No Gemini API keys configured");

  const speed = { thinkingLevel: settings.thinking_level, maxOutputTokens: settings.max_output_tokens };
  const preferred = keys.filter((k) => k.status === "active");
  const rest = keys.filter((k) => k.status !== "active");
  const ordered = [...preferred, ...rest];

  let lastErr: Error | null = null;
  for (const model of models) {
    for (const key of ordered) {
      try {
        const text = await callGemini(
          key.api_key,
          model,
          opts.userText,
          opts.systemText,
          opts.json,
          speed,
        );
        await markKey(sb, key.id, { status: "active" });
        return text;
      } catch (e) {
        const err = e as Error & { status?: number; body?: string };
        lastErr = err;
        const blob = `${err.message} ${err.body ?? ""}`;
        const quota = isQuotaLike(err.status ?? 0, blob);
        const modelIssue = isModelIssue(err.status ?? 0, blob);
        if (modelIssue) continue;
        await markKey(sb, key.id, {
          status: quota ? "quota" : "error",
          last_error: err.message.slice(0, 300),
          bumpError: true,
        });
      }
    }
  }
  throw lastErr ?? new Error("AI temporarily unavailable");
}

export async function geminiPing(apiKey: string, model: string): Promise<{ ok: boolean; message: string }> {
  try {
    const text = await callGemini(apiKey, model, "Reply with the single word OK.", undefined, false, {
      thinkingLevel: "minimal",
      maxOutputTokens: 32,
    });
    return { ok: true, message: text.slice(0, 80) };
  } catch (e) {
    return { ok: false, message: (e as Error).message.slice(0, 200) };
  }
}

export { adminClient, fetchSettings, fetchSettingsRaw, loadKeys, markKey };
