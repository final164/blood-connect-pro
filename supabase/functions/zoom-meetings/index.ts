import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Body = {
  action?: string;
  booking_id?: string;
  role?: "patient" | "host";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { global: { headers: { Authorization: auth } } },
    );
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const body = (await req.json()) as Body;
    if (body.action !== "ensure" || !body.booking_id) {
      return json({ error: "action=ensure and booking_id required" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: booking, error: bErr } = await admin
      .from("tele_bookings")
      .select("*")
      .eq("id", body.booking_id)
      .maybeSingle();
    if (bErr || !booking) return json({ error: "Booking not found" }, 404);

    const isPatient = booking.patient_id === user.id;
    let isDoctor = false;
    if (booking.doctor_id) {
      const { data: doc } = await admin
        .from("care_doctors")
        .select("user_id")
        .eq("id", booking.doctor_id)
        .maybeSingle();
      isDoctor = doc?.user_id === user.id;
    }
    if (!isPatient && !isDoctor) {
      const { data: staffOk } = await admin.rpc("is_care_staff", { _uid: user.id });
      if (!staffOk) return json({ error: "Forbidden" }, 403);
    }

    const { data: existing } = await admin
      .from("tele_zoom_meetings")
      .select("*")
      .eq("booking_id", booking.id)
      .maybeSingle();

    if (existing?.join_url) {
      return json({
        join_url: existing.join_url,
        start_url: existing.start_url,
        password: existing.password,
        meeting_id: existing.zoom_meeting_id,
      });
    }

    const zoom = await createZoomMeeting(booking.id, Number(booking.net_amount) || 20);
    const row = {
      booking_id: booking.id,
      zoom_meeting_id: zoom.meeting_id,
      zoom_uuid: zoom.uuid,
      join_url: zoom.join_url,
      start_url: zoom.start_url,
      password: zoom.password,
      raw_status: zoom.status,
      updated_at: new Date().toISOString(),
    };

    const { error: upErr } = await admin.from("tele_zoom_meetings").upsert(row, {
      onConflict: "booking_id",
    });
    if (upErr) return json({ error: upErr.message }, 500);

    return json({
      join_url: zoom.join_url,
      start_url: zoom.start_url,
      password: zoom.password,
      meeting_id: zoom.meeting_id,
      stub: zoom.stub === true,
    });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

async function createZoomMeeting(bookingId: string, durationMin: number) {
  const accountId = Deno.env.get("ZOOM_ACCOUNT_ID");
  const clientId = Deno.env.get("ZOOM_CLIENT_ID");
  const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");

  if (!accountId || !clientId || !clientSecret) {
    // Dev stub so UI flow works before secrets are set
    const stubId = `stub-${bookingId.slice(0, 8)}`;
    return {
      meeting_id: stubId,
      uuid: stubId,
      join_url: `https://zoom.us/j/${stubId}`,
      start_url: `https://zoom.us/s/${stubId}`,
      password: "000000",
      status: "stub",
      stub: true as const,
    };
  }

  const token = await zoomAccessToken(accountId, clientId, clientSecret);
  const topic = `Muktosheba Tele ${bookingId.slice(0, 8)}`;
  const res = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      topic,
      type: 2,
      duration: Math.max(15, Math.min(60, durationMin || 20)),
      settings: {
        waiting_room: true,
        join_before_host: false,
        auto_recording: "cloud",
        meeting_authentication: false,
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoom create failed: ${res.status} ${text}`);
  }
  const data = await res.json();
  return {
    meeting_id: String(data.id),
    uuid: String(data.uuid ?? data.id),
    join_url: String(data.join_url),
    start_url: String(data.start_url),
    password: data.password ? String(data.password) : null,
    status: "created",
    stub: false as const,
  };
}

async function zoomAccessToken(accountId: string, clientId: string, clientSecret: string) {
  const basic = btoa(`${clientId}:${clientSecret}`);
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
    {
      method: "POST",
      headers: { Authorization: `Basic ${basic}` },
    },
  );
  if (!res.ok) throw new Error(`Zoom OAuth failed: ${res.status}`);
  const data = await res.json();
  return String(data.access_token);
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
