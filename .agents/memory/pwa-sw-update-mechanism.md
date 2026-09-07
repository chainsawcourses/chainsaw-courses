---
name: PWA service worker update mechanism
description: How to make the Chainsaw Courses PWA auto-reload on all devices after a publish, and what doesn't work.
---

# PWA Service Worker Update Mechanism

## The correct approach (v7+)

**Two-part strategy:**

### 1. Never cache HTML in the SW
Vite content-hashes all JS/CSS bundles — they never go stale. Only the HTML entry point becomes stale. By refusing to cache it, every app open fetches fresh HTML from the server.

In `public/sw.js` fetch handler:
```js
if (event.request.mode === "navigate") {
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
  return;
}
```

Do NOT include `"/"` in PRECACHE_ASSETS.

### 2. controllerchange listener in main.tsx (standard pattern)
```js
let swRefreshing = false;
navigator.serviceWorker.addEventListener("controllerchange", () => {
  if (!swRefreshing) { swRefreshing = true; window.location.reload(); }
});
```
This fires the moment `skipWaiting` + `claim()` runs — **no message listener required in the old cached app**. This is the correct standard pattern. Also keep `SW_UPDATED` postMessage as belt-and-suspenders, and `pageshow` persisted handler for iOS bfcache.

## Cache version
Currently at v9. Only bump if changing SW logic itself — no longer needed to force asset refreshes since HTML is never cached.

Development preview rule: do not register the production service worker under Vite. If an older preview worker is already registered, unregister it once and reload; otherwise its update/reload lifecycle can fight Vite HMR and make the preview refresh continuously.

**Why:** The installed/PWA worker is designed to claim clients and reload them after production updates, while a Vite preview needs to remain under its own hot-reload lifecycle.

**How to apply:** Guard service-worker registration with `!import.meta.env.DEV`; use the production registration only in built deployments. Keep this separate from production caching and update behavior.

## Bootstrap problem (one-time)
The old installed PWA on a device won't auto-update until it loads the new code at least once. For users stuck with a very old cached version: open the site in Safari/Chrome browser directly (not the PWA icon) — gets the latest version immediately. After that the installed PWA self-updates.

## Production server note
Replit sets `cache-control: private` on sw.js responses. Browsers still revalidate SW scripts per spec, so this is not the blocker.

## What NOT to do
- Caching HTML/index.html in the SW — makes updates invisible
- `client.navigate(client.url)` — not supported on iOS SW
- postMessage SW_UPDATED as the ONLY mechanism — bootstrap problem (old app has no listener)
- Relying solely on cache version bumps
