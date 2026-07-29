---
name: Vite dual React instance fix
description: How the "Cannot read properties of null (reading 'useEffect')" duplicate React error was caused and fixed in chainsaw-training.
---

## The Rule
After any `pnpm install` that restructures the dep tree, Vite's dep optimization cache must be fully cleared AND `react-dom/client` must be in `optimizeDeps.include` alongside `react` and `react-dom`.

**Why:** When Vite lazy-discovers deps, it can pre-bundle `react-dom/client` separately from `@tanstack/react-query`, with React inlined into the former and extracted into a shared chunk for the latter — two instances → hooks dispatcher mismatch.

**How to apply:** See `vite.config.ts`:
- `cacheDir: "node_modules/.vitecache"` — avoids proxy/browser serving a stale `.vite` cache URL
- `optimizeDeps.include: ["react", "react-dom", "react-dom/client"]` — forces all three into one pre-bundle pass so they share a single React chunk
- `server.headers: { "Cache-Control": "no-store" }` — prevents proxy/browser from caching stale dep files
- Service worker cache version bump (`chainsaw-shell-vN`) — clears old JS modules from users' SW caches

## Recovery steps if it recurs
1. `rm -rf artifacts/chainsaw-training/node_modules/.vite artifacts/chainsaw-training/node_modules/.vitecache`
2. Restart `artifacts/chainsaw-training: web` workflow
3. Wait for "✨ optimized dependencies changed. reloading" in logs
4. Bump `CACHE_NAME` in `public/sw.js` to clear service worker caches on users' devices
5. Take a screenshot AFTER the reload settles (sleep 3s)

## Root cause detail
The error `react-dom_client.js?v=a215da0d` with a FIXED hash while all other chunks get new hashes means a proxy/browser/SW cache is serving the old file. The `?v=` in Vite dep URLs is a global `browserHash` — ALL files in one opt run share it. A stale URL with a different hash = cached copy from a previous run.
