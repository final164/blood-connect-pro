import { createClient } from "@supabase/supabase-js";
import { PUBLIC_SUPABASE_URL } from "@/integrations/supabase/public-env";
import { requireServerEnv, serverEnv } from "@/lib/server-env.server";
import {
  fillPrompt,
  isQuotaLike,
  normalizeGeminiSettings,
  type GeminiSettings,
  type GeminiThinkingLevel,
} from "@/lib/gemini-shared";

export type { GeminiThinkingLevel, GeminiSettings } from "@/lib/gemini-shared";
export {
  DEFAULT_GEMINI_SETTINGS,
  DEFAULT_PROMPT_CHAT_BN,
  DEFAULT_PROMPT_CHAT_EN,
  DEFAULT_PROMPT_MATCH,
  GEMINI_MODEL_CATALOG_SEED,
  fillPrompt,
  isQuotaLike,
  normalizeGeminiSettings,
} from "@/lib/gemini-shared";

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

function isNewSupabaseApiKey(value: string) {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function adminClient() {
  const url = serverEnv("SUPABASE_URL") || serverEnv("VITE_SUPABASE_URL") || PUBLIC_SUPABASE_URL;
  const secret = requireServerEnv(
    "SUPABASE_SERVICE_ROLE_KEY",
    "Server auth is not configured — set SUPABASE_SERVICE_ROLE_KEY in .env (local) or deployment secrets (VPS/Lovable).",
  );
  return createClient(url, secret, {
    global: { fetch: createSupabaseFetch(secret) },
    auth: { persistSession: false, autoRefreshToken: false },
  });
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
