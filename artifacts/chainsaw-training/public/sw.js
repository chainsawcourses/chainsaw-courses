const CACHE_NAME = "chainsaw-shell-v24";
const OFFLINE_URL = "/offline.html";
// Course assets may be used offline briefly, but a cache must not turn an old
// installed course into an indefinitely available copy.
const STATIC_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

// Do NOT include "/" (index.html) here — we never cache the HTML entry point
// so that every app open always fetches fresh HTML from the server.
// Vite's JS/CSS bundles are content-hashed so they never go stale in cache.
const PRECACHE_ASSETS = [
  "/offline.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/apple-touch-icon.png",
];

function isAdminPath(pathname) {
  const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
  // Root-mounted previews can also be reached through the artifact prefix.
  const bases = scopePath ? [scopePath] : ["", "/chainsaw-training"];
  return bases.some((base) =>
    pathname === `${base}/admin` || pathname.startsWith(`${base}/admin/`) ||
    pathname === `${base}/admin-preview` || pathname.startsWith(`${base}/admin-preview/`)
  );
}

// ─── IndexedDB helper for background sync queue ───────────────────────────────
// Stores failed POST/PUT requests so they can be retried when connectivity returns.

function openSyncDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("chainsaw-sync-queue", 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore("requests", { keyPath: "id", autoIncrement: true });
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function getSyncQueue() {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("requests", "readonly");
    const req = tx.objectStore("requests").getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function removeSyncItem(id) {
  const db = await openSyncDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("requests", "readwrite");
    tx.objectStore("requests").delete(id);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Install — pre-cache the app shell ───────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// ─── Activate — clean up old caches, then tell all windows to hard-reload ────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
      .then(() =>
        // Post to learner windows only — their update listener reloads the
        // page. client.navigate() is unreliable on iOS and Android.
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) =>
          list.filter((client) => !isAdminPath(new URL(client.url).pathname))
            .forEach((client) => client.postMessage({ type: "SW_UPDATED" }))
        )
      )
  );
});

// ─── Fetch — split strategy for instant updates ───────────────────────────────
//
// Navigation requests (HTML):  always network — never cached.
//   Every app open fetches fresh index.html from the server, so published
//   changes reach all devices on next open with no cache-busting required.
//   Vite's JS/CSS bundles are content-hashed so they are safe to cache long-term.
//
// Static assets (JS/CSS/images/fonts):  network-first, cached on success.
//   Content-hash filenames mean a cached bundle is always the right version.
//
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);

  // Skip non-same-origin requests — CDN, Firebase, API calls handled elsewhere
  if (url.origin !== self.location.origin) return;
  // The admin portal is online-only, including navigation and static requests
  // initiated by an admin client. Do not provide an offline shell for it.
  if (isAdminPath(url.pathname)) return;
  // API calls must always be fresh
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/question-images/")) return;
  // Course manuals and other learning-content files must never be retained by
  // the shell cache. They require a live, authorised course session.
  if (url.pathname.startsWith("/manual-pages/") ||
      url.pathname.startsWith("/course-content/") ||
      url.pathname.startsWith("/training-content/")) return;
  // Vite dev server internals — never cache
  if (url.pathname.startsWith("/node_modules/")) return;
  if (url.pathname.startsWith("/@")) return;

  // Bundles are shared URLs: an existing worker can still control an admin
  // tab, so do not cache or offline-serve its static requests either.
  if (event.clientId && event.request.mode !== "navigate") {
    event.respondWith(
      self.clients.get(event.clientId).then((client) => {
        if (client && isAdminPath(new URL(client.url).pathname)) {
          return fetch(event.request);
        }
        return fetchAndCache(event.request);
      })
    );
    return;
  }

  // ── HTML navigation — network only, never cached ──────────────────────────
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(OFFLINE_URL))
    );
    return;
  }

  // ── Static assets — network-first, cache on success ──────────────────────
  event.respondWith(fetchAndCache(event.request));
});

function fetchAndCache(request) {
  return fetch(request)
    .then(async (response) => {
      if (response.ok) await cacheStaticResponse(request, response.clone());
      return response;
    })
    .catch(() => matchFreshStaticResponse(request));
}

async function cacheStaticResponse(request, response) {
  const headers = new Headers(response.headers);
  headers.set("sw-cached-at", String(Date.now()));
  const cacheableResponse = new Response(await response.arrayBuffer(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  const cache = await caches.open(CACHE_NAME);
  await cache.put(request, cacheableResponse);
}

async function matchFreshStaticResponse(request) {
  const cached = await caches.match(request);
  if (!cached) return undefined;
  const cachedAt = Number(cached.headers.get("sw-cached-at"));
  if (!Number.isFinite(cachedAt) || Date.now() - cachedAt >= STATIC_CACHE_MAX_AGE_MS) {
    const cache = await caches.open(CACHE_NAME);
    await cache.delete(request);
    return undefined;
  }
  return cached;
}

// ─── Background Sync — retry queued API requests when connectivity returns ────
// Fires automatically by the browser when the device comes back online.
// The app queues failed requests (e.g. inspection saves, risk assessments)
// by calling registration.sync.register("retry-api-requests").
self.addEventListener("sync", (event) => {
  if (event.tag === "retry-api-requests") {
    event.waitUntil(replayQueuedRequests());
  }
});

async function replayQueuedRequests() {
  const queue = await getSyncQueue();
  for (const item of queue) {
    try {
      const response = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (response.ok) {
        await removeSyncItem(item.id);
      }
    } catch {
      // Still offline — leave in queue, browser will retry again later
    }
  }
}

// ─── Periodic Background Sync — refresh news & biosecurity data silently ──────
// Fires on a schedule set by the browser (minimum interval: 1 day for most browsers).
// The app registers these tags on install via registration.periodicSync.register().
// Keeps the news feed and hazard map fresh even when the user hasn't opened the app.
self.addEventListener("periodicsync", (event) => {
  if (event.tag === "news-refresh") {
    event.waitUntil(refreshNewsCache());
  }
  if (event.tag === "biosecurity-refresh") {
    event.waitUntil(refreshBiosecurityCache());
  }
});

async function refreshNewsCache() {
  try {
    const response = await fetch("/api/news");
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put("/api/news", response);
    }
  } catch {
    // Network unavailable — skip, will retry next period
  }
}

async function refreshBiosecurityCache() {
  try {
    const response = await fetch("/api/biosecurity");
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put("/api/biosecurity", response);
    }
  } catch {
    // Network unavailable — skip, will retry next period
  }
}

// ─── Push notifications ───────────────────────────────────────────────────────
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

// ─── Message handler (for skipWaiting from UI) ────────────────────────────────
self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
