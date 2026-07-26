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
      .then((reg) => {
        // Check for updates in the background
        reg.update().catch(() => {});
      })
      .catch((err) => {
        // Non-fatal — app still works without SW
        console.warn("Service worker registration failed:", err);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
