---
name: PWA service worker update mechanism
description: How to make the Chainsaw Courses PWA auto-reload on all devices after a publish, and what doesn't work.
---

# PWA Service Worker Update Mechanism

## The approach that works

**SW → app postMessage + `window.location.reload()`**

In `public/sw.js` activate event:
```js
self.clients.matchAll({ type: "window", includeUncontrolled: true })
  .then((list) => list.forEach((c) => c.postMessage({ type: "SW_UPDATED" })))
```

In `src/main.tsx` (before the register call):
```js
navigator.serviceWorker.addEventListener("message", (event) => {
  if (event.data?.type === "SW_UPDATED") window.location.reload();
});
```

**Why:** `client.navigate(client.url)` is unreliable on iOS and some Android configurations. The postMessage approach works everywhere.

## Cache version bumping

`CACHE_NAME = "chainsaw-shell-vN"` — bump N on every deploy that changes assets. Currently at v6. The activate event deletes all caches where key !== CACHE_NAME, then postMessages all clients to reload.

**Why:** Without a version bump, the old cache persists and the new bundle is never loaded from network.

## Bootstrap problem

The first publish after adding the postMessage listener does NOT auto-reload, because the old cached app has no listener. User must manually close the app from the app switcher and reopen once. After that, all future publishes auto-reload.

## What NOT to do

- `client.navigate(client.url)` — not supported on iOS SW, unreliable on Android
- Relying on cache version bump alone without postMessage — doesn't force a reload of open windows
- Not bumping cache version — old files serve indefinitely from SW cache
