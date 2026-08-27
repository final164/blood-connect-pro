/* Muktosheba offline shell + device notifications */
const CACHE = "Muktosheba-shell-v4";
const ASSETS = ["/manifest.webmanifest", "/icon.svg", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(fetch(req));
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) =>
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => cached || caches.match("/")),
    ),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "SHOW_NOTIFICATION") return;
  const { title, body, url, tag } = data;
  event.waitUntil(
    self.registration.showNotification(title || "Muktosheba", {
      body: body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: tag || "Muktosheba",
      data: { url: url || "/" },
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          client.focus();
          client.postMessage({ type: "NOTIFICATION_CLICK", url });
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Muktosheba", body: "", url: "/", tag: "Muktosheba" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data?.text() || "";
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag || "Muktosheba",
      data: { url: payload.url || "/" },
      renotify: true,
    }),
  );
});
