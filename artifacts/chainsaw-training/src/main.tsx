import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

function registerProductionServiceWorker() {
  const swPath = `${import.meta.env.BASE_URL}sw.js`;
  const swScope = import.meta.env.BASE_URL;

  // Standard PWA update pattern: reload as soon as a new SW takes control.
  // controllerchange fires on the page the moment skipWaiting + claim() runs —
  // no message listener required in the old cached app.
  let swRefreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!swRefreshing) {
      swRefreshing = true;
      window.location.reload();
    }
  });

  // Fallback: also handle the SW_UPDATED postMessage for belt-and-suspenders.
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "SW_UPDATED") {
      window.location.reload();
    }
  });

  // iOS bfcache fix: if the OS restores a frozen snapshot, force a fresh load.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      window.location.reload();
    }
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(swPath, { scope: swScope })
      .then(async (reg) => {
        // Check for updates on every page load so installs never wait 24 h
        reg.update().catch(() => {});

        // ── Periodic Background Sync ──────────────────────────────────────────
        // Keeps the news feed and biosecurity map fresh even when the app is
        // not open. Browser enforces a minimum interval (typically 12–24 hrs)
        // and only fires on installed PWAs with sufficient user engagement.
        if ("periodicSync" in reg) {
          try {
            // @ts-ignore — PeriodicSyncManager types not yet in TS lib
            await reg.periodicSync.register("news-refresh", {
              minInterval: 12 * 60 * 60 * 1000, // 12 hours
            });
            // @ts-ignore
            await reg.periodicSync.register("biosecurity-refresh", {
              minInterval: 24 * 60 * 60 * 1000, // 24 hours
            });
          } catch {
            // Permission denied or not supported — non-fatal
          }
        }

        // ── Background Sync ───────────────────────────────────────────────────
        // Pre-registers the sync tag so the browser is aware of it.
        // The actual queue-and-retry logic fires from individual API call sites
        // (e.g. inspection saves, risk assessments) when they fail offline.
        if ("sync" in reg) {
          try {
            // @ts-ignore — SyncManager types not yet in TS lib
            await reg.sync.register("retry-api-requests");
          } catch {
            // Not supported or no permission — non-fatal
          }
        }
      })
      .catch((err) => {
        // Non-fatal — app still works without SW
        console.warn("Service worker registration failed:", err);
      });
  });
}

// Service workers are useful for the installed/PWA build, but Vite's dev
// server must stay under the normal HMR lifecycle. A worker left behind from
// an earlier preview session can otherwise keep claiming the page and trigger
// the reload listeners above.
if ("serviceWorker" in navigator) {
  if (import.meta.env.DEV) {
    const devCleanupKey = "chainsaw-dev-sw-cleaned";
    if (!sessionStorage.getItem(devCleanupKey)) {
      sessionStorage.setItem(devCleanupKey, "true");
      navigator.serviceWorker
        .getRegistration(import.meta.env.BASE_URL)
        .then((registration) => {
          if (registration) return registration.unregister().then(() => window.location.reload());
          return undefined;
        })
        .catch(() => {});
    }
  } else {
    // Production/PWA builds retain service-worker caching, offline support,
    // push notifications, and automatic update reloads.
    registerProductionServiceWorker();
  }
}

createRoot(document.getElementById("root")!).render(<App />);
