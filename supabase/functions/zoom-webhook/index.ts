import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-zm-signature, x-zm-request-timestamp",
};

/**
 * Zoom webhook: recording/transcript completed → store transcript → enqueue AI summary.
 * Configure Zoom Event Subscriptions to this function URL.
 * Set ZOOM_WEBHOOK_SECRET for validation token challenge + signature (optional soft check).
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const payload = await req.json();

    // Zoom URL validation challenge
    if (payload?.event === "endpoint.url_validation" && payload?.payload?.plainToken) {
      const secret = Deno.env.get("ZOOM_WEBHOOK_SECRET") || "";
      const plain = String(payload.payload.plainToken);
      const enc = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(secret + plain),
      );
      const hash = [...new Uint8Array(enc)].map((b) => b.toString(16).padStart(2, "0")).join("");
      return json({ plainToken: plain, encryptedToken: hash });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const event = String(payload?.event ?? "");
    const obj = payload?.payload?.object ?? payload?.payload ?? {};

    // Map Zoom meeting id → tele_zoom_meetings
    const meetingId = String(obj?.id ?? obj?.meeting_id ?? "");
    if (!meetingId) return json({ ok: true, skipped: "no meeting id" });

    const { data: zm } = await admin
      .from("tele_zoom_meetings")
      .select("booking_id")
      .eq("zoom_meeting_id", meetingId)
      .maybeSingle();
    if (!zm?.booking_id) return json({ ok: true, skipped: "unknown meeting" });

    const bookingId = zm.booking_id as string;

    if (event.includes("recording") || event.includes("transcript")) {
      const files = (obj?.recording_files ?? obj?.participant_audio_files ?? []) as {
        file_type?: string;
        download_url?: string;
        play_url?: string;
      }[];
      const transcriptFile = files.find((f) =>
        /TRANSCRIPT|CHAT|TIMELINE/i.test(String(f.file_type ?? "")),
      );
      const downloadUrl = transcriptFile?.download_url || transcriptFile?.play_url || null;

      let rawText = "";
      if (downloadUrl) {
        try {
          const token = await zoomToken();
          const tr = await fetch(downloadUrl, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (tr.ok) rawText = await tr.text();
        } catch (e) {
          console.error("transcript fetch", e);
        }
      }

      if (!rawText && obj?.transcript) rawText = String(obj.transcript);

      if (rawText) {
        await admin.from("tele_transcripts").upsert(
          {
            booking_id: bookingId,
            source_url: downloadUrl,
            raw_text: rawText.slice(0, 200_000),
            language: "auto",
          },
          { onConflict: "booking_id" },
        );

        await admin.from("tele_ai_summaries").upsert(
          {
            booking_id: bookingId,
            status: "pending",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "booking_id" },
        );

    const summarizeUrl =
      Deno.env.get("TELE_SUMMARIZE_URL") ||
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/tele-summarize`;
    void fetch(summarizeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": Deno.env.get("WEBHOOK_SECRET") || "",
      },
      body: JSON.stringify({ booking_id: bookingId }),
    }).catch(() => undefined);
      }

      await admin
        .from("tele_zoom_meetings")
        .update({
          raw_status: event,
          transcript_file_id: transcriptFile?.download_url ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("booking_id", bookingId);
    }

    if (event.includes("meeting.ended")) {
      await admin
        .from("tele_bookings")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", bookingId)
        .in("status", ["ready", "in_call", "confirmed"]);
    }

    return json({ ok: true });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

async function zoomToken() {
  const accountId = Deno.env.get("ZOOM_ACCOUNT_ID");
  const clientId = Deno.env.get("ZOOM_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");
  if (!accountId || !clientId || !clientSecret) return null;
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    { method: "POST", headers: { Authorization: `Basic ${basic}` } },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return String(data.access_token);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
