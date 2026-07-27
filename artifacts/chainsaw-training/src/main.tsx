import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Auto-register service worker on every page load.
// This is required for PWA installability scoring and offline support.
// The push-notification hook (usePushNotifications) reuses this registration.
if ("serviceWorker" in navigator) {
  const swPath = `${import.meta.env.BASE_URL}sw.js`;
  const swScope = import.meta.env.BASE_URL;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(swPath, { scope: swScope })
      .then(async (reg) => {
        // Check for updates in the background
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

createRoot(document.getElementById("root")!).render(<App />);
