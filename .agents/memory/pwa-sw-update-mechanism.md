---
name: PWA service worker update mechanism
description: How to make the Chainsaw Courses PWA auto-reload on all devices after a publish, and what doesn't work.
---

# PWA Service Worker Update Mechanism

## The correct approach (v7+)

**Never cache HTML (index.html / navigation requests).** Vite content-hashes all JS/CSS bundles, so old bundle files in cache are always valid. Only the HTML entry point ever becomes "stale". By refusing to cache it, every app open fetches fresh HTML from the server — updates reach all devices on next open, no cache-busting tricks needed.

In `public/sw.js` fetch handler:
```js
// Navigation (HTML) — network only, never cached
if (event.request.mode === "navigate") {
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
  return;
}
// Static assets — network-first, cache on success (content-hashed = never stale)
```

Also keep `postMessage({ type: "SW_UPDATED" })` in activate for belt-and-suspenders (reloads open tabs when SW activates).

Also keep SW_UPDATED listener in `main.tsx` → `window.location.reload()`.

## Cache version

Currently at v7. Only bump if changing SW logic itself — no longer needed to force asset refreshes since HTML is never cached.

## Do NOT cache "/" in PRECACHE_ASSETS

Removed `"/"` from precache. Offline fallback goes to `/offline.html` directly.

## What NOT to do

- Caching HTML/index.html in the SW — makes updates invisible until cache is manually busted
- `client.navigate(client.url)` — not supported on iOS SW
- Bumping cache version as the sole update mechanism — has a bootstrap problem on first deploy
