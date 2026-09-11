import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Msg = { role: string; text: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const lang = body?.lang === "en" ? "en" : "bn";
    const messages: Msg[] = Array.isArray(body?.messages)
      ? body.messages
          .slice(-12)
          .map((m: { role?: string; text?: string }) => ({
            role: m?.role === "assistant" ? "assistant" : "user",
            text: String(m?.text ?? "").trim().slice(0, 2000),
          }))
          .filter((m: Msg) => m.text)
      : [];
    if (!messages.length) {
      return json({ error: lang === "bn" ? "মেসেজ দিন" : "Message required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: settingsRow } = await admin
      .from("app_settings")
      .select("gemini_settings")
      .eq("id", 1)
      .maybeSingle();
    const gemini = (settingsRow?.gemini_settings ?? {}) as Record<string, unknown>;
    const model = String(gemini.primary_model || "gemini-2.0-flash");
    const maxCatalog = Math.min(120, Number(gemini.max_catalog_items || 80) || 80);
    const maxSuggestions = Math.min(8, Number(gemini.max_suggestions || 5) || 5);

    const { data: catalogRows } = await admin
      .from("care_test_catalog")
      .select("id, code, name_bn, name_en, category_id")
      .eq("is_active", true)
      .order("sort_order")
      .limit(maxCatalog);
    const catalog = (catalogRows ?? []) as Array<{
      id: string;
      code: string;
      name_bn: string;
      name_en: string;
    }>;

    if (!catalog.length) {
      return json({
        reply:
          lang === "bn"
            ? "এখন ক্যাটালগে কোনো টেস্ট নেই। পরে আবার চেষ্টা করুন।"
            : "No tests are in the catalog yet. Please try again later.",
        medical_advice: "",
        catalog_notes: "",
        questions: [],
        suggested_tests: [],
        offer_bundle: false,
      });
    }

    const { data: keys } = await admin
      .from("gemini_api_keys")
      .select("api_key, status")
      .order("created_at", { ascending: true })
      .limit(8);
    const key = (keys ?? []).find((k) => k.status === "active" || !k.status)?.api_key;
    if (!key) {
      return json(
        {
          error:
            lang === "bn"
              ? "Admin-এ Gemini API key সেট করা নেই।"
              : "No Gemini API key configured in Admin.",
        },
        500,
      );
    }

    const catalogText = catalog
      .map((c) => `${c.id}|${c.code}|${c.name_bn}|${c.name_en}`)
      .join("\n");

    const customPrompt = String(
      lang === "bn" ? gemini.prompt_care_chat_bn || "" : gemini.prompt_care_chat_en || "",
    ).trim();

    const systemText =
      customPrompt ||
      `You are a careful medical triage assistant for Bangladesh Care app.
Language for user-facing strings: ${lang === "bn" ? "Bangla" : "English"}.
Use ONLY the catalog below when suggesting tests (match catalog_id exactly).
Return STRICT JSON:
{
  "reply": "short helpful reply",
  "medical_advice": "brief non-diagnostic advice",
  "catalog_notes": "why these tests",
  "questions": ["follow-up question", "..."],
  "suggested_tests": [
    {"catalog_id":"uuid","code":"...","name_bn":"...","name_en":"...","reason":"..."}
  ],
  "offer_bundle": true
}
Never invent catalog_id. Prefer 2-${maxSuggestions} tests. Not a diagnosis. Urgent red flags → advise ER.

CATALOG (id|code|name_bn|name_en):
${catalogText}`;

    const history = messages
      .map((m) => `${m.role === "assistant" ? "ASSISTANT" : "USER"}: ${m.text}`)
      .join("\n");

    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents: [{ role: "user", parts: [{ text: history }] }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: 2048,
            temperature: 0.4,
          },
        }),
      },
    );
    const gBody = await gRes.text();
    if (!gRes.ok) {
      console.error("[care-ai-chat] gemini", gRes.status, gBody.slice(0, 400));
      return json(
        {
          error:
            lang === "bn"
              ? "AI উত্তর পাওয়া যায়নি। পরে চেষ্টা করুন।"
              : "AI reply failed. Please try again.",
        },
        502,
      );
    }

    let rawText = "";
    try {
      const parsedG = JSON.parse(gBody) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      rawText = parsedG.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    } catch {
      rawText = gBody;
    }

    const parsed = parseJsonObject(rawText);
    const byId = new Map(catalog.map((c) => [c.id, c]));
    const byCode = new Map(catalog.map((c) => [c.code.toLowerCase(), c]));
    const suggestedRaw = Array.isArray(parsed.suggested_tests) ? parsed.suggested_tests : [];
    const suggested_tests: Array<Record<string, string>> = [];
    for (const item of suggestedRaw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const id = String(row.catalog_id ?? "");
      const code = String(row.code ?? "").toLowerCase();
      const hit = byId.get(id) || byCode.get(code);
      if (!hit) continue;
      if (suggested_tests.some((s) => s.catalog_id === hit.id)) continue;
      suggested_tests.push({
        catalog_id: hit.id,
        code: hit.code,
        name_bn: hit.name_bn,
        name_en: hit.name_en,
        reason: String(row.reason ?? ""),
      });
      if (suggested_tests.length >= maxSuggestions) break;
    }

    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.map((q) => String(q)).filter(Boolean).slice(0, 5)
      : [];

    return json({
      reply: String(parsed.reply || parsed.medical_advice || "").trim() ||
        (lang === "bn" ? "আরেকটু বিস্তারিত বলুন।" : "Please share a bit more detail."),
      medical_advice: String(parsed.medical_advice || "").trim(),
      catalog_notes: String(parsed.catalog_notes || "").trim(),
      questions,
      suggested_tests,
      offer_bundle: parsed.offer_bundle === true,
      suggested_specialties: Array.isArray(parsed.suggested_specialties)
        ? parsed.suggested_specialties
        : [],
      expert_analysis: parsed.expert_analysis ?? null,
      first_aid: Array.isArray(parsed.first_aid) ? parsed.first_aid : [],
      medicines: Array.isArray(parsed.medicines) ? parsed.medicines : [],
    });
  } catch (e) {
    console.error("[care-ai-chat]", e);
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("AI returned non-JSON");
  return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
