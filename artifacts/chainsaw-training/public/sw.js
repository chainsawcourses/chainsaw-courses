// Network-first fetch handler — required for PWA installability & Play Store packaging
self.addEventListener("fetch", (event) => {
  // Only handle GET requests; skip cross-origin requests
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache a clone of successful navigations for offline fallback
        if (response.ok && event.request.mode === "navigate") {
          const cache = caches.open("chainsaw-shell-v1").then((c) =>
            c.put(event.request, response.clone())
          );
        }
        return response;
      })
      .catch(() =>
        // Offline fallback — serve cached shell if available
        caches.match(event.request).then((cached) => cached || caches.match("/"))
      )
  );
});

// Push notification handler
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try { payload = event.data.json(); } catch { payload = { title: "Chainsaw Courses", body: event.data.text() }; }

  const title = payload.title ?? "Chainsaw Courses News";
  const options = {
    body: payload.body ?? "A new article has been posted.",
    icon: self.registration.scope + "favicon.svg",
    badge: self.registration.scope + "favicon.svg",
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
