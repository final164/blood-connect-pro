import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import { getVapidPublicKey, hasWebPushConfigured } from "@/lib/push-config";
import { isNativeApp, nativePlatform } from "@/lib/native-app";

export type DeviceNotificationPayload = {
  title: string;
  body: string;
  url: string;
  tag?: string;
};

export function canUseDeviceNotifications() {
  if (typeof window === "undefined") return false;
  if (isNativeApp()) return true;
  return "Notification" in window && "serviceWorker" in navigator;
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

async function enableNativePush(userId: string): Promise<boolean> {
  const { PushNotifications } = await import("@capacitor/push-notifications");
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== "granted") return false;

  await PushNotifications.register();

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };

    const timer = window.setTimeout(() => finish(false), 15000);

    void PushNotifications.addListener("registration", async (token) => {
      window.clearTimeout(timer);
      const platform = nativePlatform() === "ios" ? "ios" : "android";
      const endpoint = platform === "ios" ? `apns:${token.value}` : `fcm:${token.value}`;
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: userId,
          endpoint,
          p256dh: "native",
          auth: platform,
          user_agent: `BloodLink-Capacitor/${platform}/${Capacitor.getPlatform()}`,
          platform,
        } as never,
        { onConflict: "user_id,endpoint" },
      );
      // Drop stale web-local placeholders for this user on native
      await supabase.from("push_subscriptions").delete().eq("user_id", userId).like("endpoint", "local:%");
      finish(!error);
    });

    void PushNotifications.addListener("registrationError", () => {
      window.clearTimeout(timer);
      finish(false);
    });
  });
}

/** Request OS permission and register Web Push or native FCM/APNs */
export async function enableDeviceNotifications(userId: string): Promise<boolean> {
  if (!canUseDeviceNotifications()) return false;

  if (isNativeApp()) {
    return enableNativePush(userId);
  }

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
        platform: "web",
      } as never,
      { onConflict: "user_id,endpoint" },
    );
    if (error) throw error;
    await supabase.from("push_subscriptions").delete().eq("user_id", userId).like("endpoint", "local:%");
    return true;
  }

  await supabase.from("push_subscriptions").upsert(
    {
      user_id: userId,
      endpoint: `local:${userId}:${navigator.userAgent.slice(0, 40)}`,
      user_agent: navigator.userAgent,
      platform: "web",
    } as never,
    { onConflict: "user_id,endpoint" },
  );
  return true;
}

export async function disableDeviceNotifications(userId: string) {
  if (isNativeApp()) {
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications");
      await PushNotifications.removeAllListeners();
    } catch {
      /* ignore */
    }
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);
    return;
  }

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

export async function showDeviceNotification(payload: DeviceNotificationPayload) {
  if (isNativeApp()) {
    // Native OS shows via PushNotifications; local display not needed when server push works
    return;
  }
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
  if (isNativeApp()) {
    void import("@capacitor/push-notifications").then(({ PushNotifications }) => {
      void PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
        const data = event.notification.data as Record<string, unknown> | undefined;
        const url = typeof data?.url === "string" ? data.url : "/";
        if (url.startsWith("http")) {
          try {
            const u = new URL(url);
            window.location.assign(`${u.pathname}${u.search}${u.hash}`);
            return;
          } catch {
            /* fall through */
          }
        }
        window.location.assign(url.startsWith("/") ? url : `/${url}`);
      });
    });
    return;
  }

  if (!canUseDeviceNotifications()) return;
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "NOTIFICATION_CLICK" && event.data.url) {
      window.location.href = event.data.url;
    }
  });
}

export async function hasActiveWebPushSubscription(): Promise<boolean> {
  if (isNativeApp()) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("push_subscriptions")
        .select("endpoint")
        .eq("user_id", user.id)
        .or("endpoint.like.fcm:%,endpoint.like.apns:%")
        .limit(1);
      return (data?.length ?? 0) > 0;
    } catch {
      return false;
    }
  }
  if (!canUseDeviceNotifications() || !hasWebPushConfigured()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    return !!sub?.endpoint && !sub.endpoint.startsWith("local:");
  } catch {
    return false;
  }
}
