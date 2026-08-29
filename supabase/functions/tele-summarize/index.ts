import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const body = await req.json();
    const bookingId = String(body?.booking_id ?? "");
    if (!bookingId) return json({ error: "booking_id required" }, 400);

    const secret = req.headers.get("x-webhook-secret");
    const expected = Deno.env.get("WEBHOOK_SECRET");
    const auth = req.headers.get("Authorization");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Allow webhook secret OR authenticated user (doctor/patient/staff)
    if (!(expected && secret === expected) && !auth) {
      return json({ error: "Unauthorized" }, 401);
    }

    const { data: settingsRow } = await admin
      .from("app_settings")
      .select("tele_settings, gemini_settings")
      .eq("id", 1)
      .maybeSingle();
    const tele = (settingsRow?.tele_settings ?? {}) as Record<string, unknown>;
    if (tele.ai_summary_enabled === false) {
      return json({ ok: true, skipped: "ai_summary_disabled" });
    }

    const gemini = (settingsRow?.gemini_settings ?? {}) as Record<string, unknown>;
    const promptTpl =
      String(gemini.prompt_tele_summary_bn || "") ||
      "Summarize transcript to JSON {summary_bn,summary_en,key_points_bn}. TRANSCRIPT:\n{{transcript}}";

    const { data: tr } = await admin
      .from("tele_transcripts")
      .select("raw_text")
      .eq("booking_id", bookingId)
      .maybeSingle();
    if (!tr?.raw_text) return json({ error: "No transcript" }, 404);

    const { data: keys } = await admin
      .from("gemini_api_keys")
      .select("api_key, status")
      .order("created_at", { ascending: true })
      .limit(5);
    const key = (keys ?? []).find((k) => k.status === "active" || !k.status)?.api_key;
    if (!key) return json({ error: "No Gemini API key" }, 500);

    const model = String(gemini.primary_model || "gemini-2.0-flash");
    const userText = promptTpl.replace("{{transcript}}", String(tr.raw_text).slice(0, 120_000));

    const gRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userText }] }],
          generationConfig: { responseMimeType: "application/json", maxOutputTokens: 2048 },
        }),
      },
    );
    const gBody = await gRes.text();
    if (!gRes.ok) {
      await admin.from("tele_ai_summaries").upsert(
        {
          booking_id: bookingId,
          status: "failed",
          error: gBody.slice(0, 500),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "booking_id" },
      );
      return json({ error: "Gemini failed", detail: gBody.slice(0, 300) }, 502);
    }

    let parsed: { summary_bn?: string; summary_en?: string; key_points_bn?: string[] } = {};
    try {
      const outer = JSON.parse(gBody);
      const text =
        outer?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") ??
        gBody;
      parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, "").trim());
    } catch {
      parsed = { summary_bn: gBody.slice(0, 2000), summary_en: gBody.slice(0, 2000) };
    }

    await admin.from("tele_ai_summaries").upsert(
      {
        booking_id: bookingId,
        summary_bn: parsed.summary_bn ?? null,
        summary_en: parsed.summary_en ?? null,
        key_points: parsed.key_points_bn ?? [],
        model,
        status: "ready",
        error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "booking_id" },
    );

    const { data: booking } = await admin
      .from("tele_bookings")
      .select("patient_id")
      .eq("id", bookingId)
      .maybeSingle();
    if (booking?.patient_id) {
      await admin.from("notifications").insert({
        user_id: booking.patient_id,
        type: "system",
        title: "tele_summary_ready",
        body: "Consultation summary ready",
        data: { kind: "tele_summary_ready", booking_id: bookingId },
        is_read: false,
      });
    }

    return json({ ok: true, summary_bn: parsed.summary_bn });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
