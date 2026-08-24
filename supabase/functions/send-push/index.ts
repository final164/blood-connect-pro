import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import webpush from "npm:web-push@3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

type NotifRecord = {
  id: string;
  user_id: string;
  actor_id?: string | null;
  type: string;
  request_id?: string | null;
  title?: string | null;
  body?: string | null;
  data?: { kind?: string; request_id?: string; actor_id?: string } | null;
};

type SubRow = {
  id: string;
  endpoint: string;
  p256dh: string | null;
  auth: string | null;
  platform?: string | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  const secret = req.headers.get("x-webhook-secret");
  const expected = Deno.env.get("WEBHOOK_SECRET");
  if (!expected || secret !== expected) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await req.json();
    const record = (payload.record ?? payload) as NotifRecord;
    if (!record?.user_id) return json({ error: "Missing user_id" }, 400);

    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY");
    const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
    const hasWeb = !!(vapidPublic && vapidPrivate);
    const hasFcm = !!fcmServerKey;

    if (!hasWeb && !hasFcm) {
      return json({ error: "No push transport configured (VAPID or FCM_SERVER_KEY)" }, 503);
    }

    if (hasWeb) {
      webpush.setVapidDetails(
        Deno.env.get("VAPID_SUBJECT") || "mailto:admin@bloodlink.app",
        vapidPublic!,
        vapidPrivate!,
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: appRow } = await supabase
      .from("app_settings")
      .select("notification_settings")
      .eq("id", 1)
      .maybeSingle();

    const settings = (appRow?.notification_settings ?? {}) as Record<string, boolean>;
    if (settings.enable_push === false) return json({ skipped: true, reason: "push disabled" });

    const kind = record.data?.kind || record.title || record.type;
    const isNewRequest = kind === "new_request" || record.type === "request_match";
    if (isNewRequest && settings.push_new_request === false) {
      return json({ skipped: true, reason: "new request push off" });
    }
    if (!isNewRequest && settings.push_interactions === false) {
      return json({ skipped: true, reason: "interaction push off" });
    }

    const { data: userSettings } = await supabase
      .from("user_settings")
      .select("notif_push")
      .eq("user_id", record.user_id)
      .maybeSingle();
    if (userSettings?.notif_push === false) {
      return json({ skipped: true, reason: "user opt-out" });
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth, platform")
      .eq("user_id", record.user_id);

    const rows = (subs ?? []) as SubRow[];
    const usable = rows.filter((s) => s.endpoint && !String(s.endpoint).startsWith("local:"));
    if (!usable.length) return json({ sent: 0, reason: "no subscriptions" });

    const requestId = record.request_id ?? record.data?.request_id;
    const url = requestId ? `/?requestId=${encodeURIComponent(requestId)}` : "/";
    const { title, body } = displayCopy(record, kind);

    const pushBody = JSON.stringify({ title, body, url, tag: record.id });
    let sent = 0;
    const expired: string[] = [];

    for (const sub of usable) {
      const ep = String(sub.endpoint);
      const isNative = ep.startsWith("fcm:") || ep.startsWith("apns:") || sub.p256dh === "native";

      if (isNative) {
        if (!hasFcm) continue;
        const token = ep.replace(/^fcm:/, "").replace(/^apns:/, "");
        const ok = await sendFcmLegacy(fcmServerKey!, token, title, body, url, record.id);
        if (ok === "ok") sent++;
        else if (ok === "gone") expired.push(sub.id);
        continue;
      }

      if (!hasWeb || !sub.p256dh || !sub.auth || sub.p256dh === "native") continue;
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          pushBody,
        );
        sent++;
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(sub.id);
      }
    }

    if (expired.length) {
      await supabase.from("push_subscriptions").delete().in("id", expired);
    }

    return json({ sent, expired: expired.length });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});

/** Legacy FCM HTTP API (FCM_SERVER_KEY). Works for Android FCM tokens; iOS if via Firebase. */
async function sendFcmLegacy(
  serverKey: string,
  token: string,
  title: string,
  body: string,
  url: string,
  tag: string,
): Promise<"ok" | "gone" | "fail"> {
  try {
    const res = await fetch("https://fcm.googleapis.com/fcm/send", {
      method: "POST",
      headers: {
        Authorization: `key=${serverKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: token,
        priority: "high",
        notification: { title, body, tag, sound: "default" },
        data: { url, tag, title, body },
      }),
    });
    if (res.status === 404 || res.status === 410) return "gone";
    if (!res.ok) return "fail";
    const data = (await res.json()) as { failure?: number; results?: { error?: string }[] };
    if (data.failure && data.results?.[0]?.error === "NotRegistered") return "gone";
    if (data.failure) return "fail";
    return "ok";
  } catch {
    return "fail";
  }
}

function displayCopy(record: NotifRecord, kind: string) {
  if (kind === "new_request" || record.type === "request_match") {
    return { title: "নতুন রক্তের রিকোয়েস্ট", body: record.body || record.title || "BloodLink" };
  }
  if (["like", "request_like", "post_like"].includes(kind) || record.type === "post_like") {
    return { title: "নতুন লাইক", body: "আপনার পোস্টে লাইক দেওয়া হয়েছে" };
  }
  if (["comment", "request_comment", "post_comment"].includes(kind) || record.type === "post_comment") {
    return { title: "নতুন কমেন্ট", body: record.body || "কেউ কমেন্ট করেছে" };
  }
  if (["share", "request_share"].includes(kind)) {
    return { title: "শেয়ার", body: "আপনার পোস্ট শেয়ার করা হয়েছে" };
  }
  return { title: record.title || "BloodLink", body: record.body || "" };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
