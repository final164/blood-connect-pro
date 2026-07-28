import { supabase } from "@/integrations/supabase/client";
import { getVapidPublicKey, hasWebPushConfigured } from "@/lib/push-config";

export type DeviceNotificationPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

export function canUseDeviceNotifications() {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/** Request OS permission and register Web Push subscription (works when app is closed) */
export async function enableDeviceNotifications(userId: string): Promise<boolean> {
  if (!canUseDeviceNotifications()) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  const vapidKey = getVapidPublicKey();

  if (vapidKey && "pushManager" in reg) {
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidKey),
        });
      } catch {
        return false;
      }
    }
    const json = sub.toJSON();
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: userId,
        endpoint: sub.endpoint,
        p256dh: json.keys?.p256dh ?? null,
        auth: json.keys?.auth ?? null,
        user_agent: navigator.userAgent,
      },
      { onConflict: "user_id,endpoint" },
    );
    if (error) throw error;
    await supabase.from("push_subscriptions").delete().eq("user_id", userId).like("endpoint", "local:%");
    return true;
  }

  // Fallback when VAPID not configured — in-app only while tab open
  await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: `local:${userId}:${navigator.userAgent.slice(0, 40)}`,
      user_agent: navigator.userAgent,
    },
    { onConflict: "user_id,endpoint" },
  );
  return true;
}

export async function disableDeviceNotifications(userId: string) {
  if (canUseDeviceNotifications()) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch {
      /* ignore */
    }
  }
  await supabase.from("push_subscriptions").delete().eq("user_id", userId);
}

/** Fallback local notification when Web Push server is not configured (app must be open/background) */
export async function showDeviceNotification(payload: DeviceNotificationPayload) {
  if (!canUseDeviceNotifications()) return;
  if (Notification.permission !== "granted") return;
  if (hasWebPushConfigured()) return;

  try {
    const reg = await navigator.serviceWorker.ready;
    if (reg.active) {
      reg.active.postMessage({ type: "SHOW_NOTIFICATION", ...payload });
      return;
    }
  } catch {
    /* fall through */
  }

  const n = new Notification(payload.title, {
    body: payload.body,
    icon: "/icon-192.png",
    tag: payload.tag,
    data: { url: payload.url },
  });
  n.onclick = () => {
    window.focus();
    window.location.href = payload.url;
    n.close();
  };
}

export function setupNotificationClickHandler() {
  if (!canUseDeviceNotifications()) return;
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "NOTIFICATION_CLICK" && event.data.url) {
      window.location.href = event.data.url;
    }
  });
}

export async function hasActiveWebPushSubscription(): Promise<boolean> {
  if (!canUseDeviceNotifications() || !hasWebPushConfigured()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub?.endpoint && !sub.endpoint.startsWith("local:");
  } catch {
    return false;
  }
}
