import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem("pwa-install-dismissed");
    if (dismissed) return;

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      ("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone === true);
    if (isStandalone) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setVisible(false);
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-4 pt-3 flex items-center gap-3 shadow-xl"
      style={{ background: "#e27226" }}
    >
      <img src="/logo.png" alt="" className="h-9 w-9 rounded-lg flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm leading-tight">Install Chainsaw Courses</p>
        <p className="text-orange-100 text-xs">Add to your home screen for quick access</p>
      </div>
      <button
        onClick={handleInstall}
        className="flex-shrink-0 bg-white text-orange-600 font-bold text-sm px-3 py-1.5 rounded-lg"
      >
        Install
      </button>
      <button
        onClick={handleDismiss}
        className="flex-shrink-0 text-orange-100 text-lg leading-none px-1"
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  );
}
