const CACHE_NAME = "chainsaw-shell-v2";
const OFFLINE_URL = "/offline.html";

const PRECACHE_ASSETS = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

// Install — pre-cache the app shell and offline page
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network-first with offline fallback
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Skip non-same-origin and API requests (always need fresh data)
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful navigation responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // For navigation requests, show offline page
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
        })
      )
  );
});

// Push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: "Chainsaw Courses", body: event.data.text() }; }

  const title = payload.title ?? "Chainsaw Courses News";
  const options = {
    body: payload.body ?? "A new article has been posted.",
    icon: self.registration.scope + "icon-192.png",
    badge: self.registration.scope + "icon-192.png",
    data: { url: payload.url ?? self.registration.scope + "news" },
    tag: "news-update",
    renotify: true,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});

// Message handler (for skipWaiting from UI)
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
