import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import { getAppBasePath } from "./lib/routing";
import { isAdminRoute, registerProductionServiceWorker } from "./lib/pwaServiceWorker";
import "./index.css";

// Service workers are useful for the installed/PWA build, but Vite's dev
// server must stay under the normal HMR lifecycle. A worker left behind from
// an earlier preview session can otherwise keep claiming the page and trigger
// the reload listeners above.
if (Capacitor.isNativePlatform()) {
  // Capacitor already provides the native app container. A browser service
  // worker can retain stale startup assets across hosted-app releases and
  // leave both WKWebView and Android WebView unable to bootstrap. Remove any
  // registration left by an earlier release and keep native startup network-
  // first; browser-installed PWAs retain their normal worker below.
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      )
      .catch(() => {});
  }
  if ("caches" in window) {
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("chainsaw-shell-"))
            .map((key) => caches.delete(key)),
        ),
      )
      .catch(() => {});
  }
} else if ("serviceWorker" in navigator) {
  if (import.meta.env.DEV) {
    // Never let a worker from an earlier production/PWA preview mask Vite
    // changes. The old sessionStorage guard only cleaned it once per tab, so
    // a stale worker could survive subsequent code updates.
    navigator.serviceWorker
      .getRegistration(import.meta.env.BASE_URL)
      .then((registration) => {
        if (!registration) return;
        return registration.unregister().then((unregistered) => {
          if (unregistered && navigator.serviceWorker.controller &&
              !isAdminRoute(window.location.pathname, getAppBasePath())) {
            window.location.reload();
          }
        });
      })
      .catch(() => {});
  } else {
    // Production/PWA builds retain service-worker caching, offline support,
    // push notifications, and automatic update reloads.
    registerProductionServiceWorker(import.meta.env.BASE_URL, getAppBasePath());
  }
}

createRoot(document.getElementById("root")!).render(<App />);
