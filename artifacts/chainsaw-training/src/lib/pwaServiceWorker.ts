// Admin pages share the app's URL scope but are online-only. Check the current
// pathname at event time: client-side navigation can enter admin after startup.
export function isAdminRoute(pathname: string, basePath: string): boolean {
  const base = `/${basePath.split("/").filter(Boolean).join("/")}`;
  const relative = pathname.startsWith(`${base}/`)
    ? pathname.slice(base.length)
    : base === "/" ? pathname : "";
  return relative === "/admin" || relative.startsWith("/admin/") ||
    relative === "/admin-preview" || relative.startsWith("/admin-preview/");
}

export function registerProductionServiceWorker(baseUrl: string, routeBase: string) {
  if (isAdminRoute(window.location.pathname, routeBase)) return;

  const swPath = `${baseUrl}sw.js`;
  const swScope = baseUrl;
  const onAdminRoute = () => isAdminRoute(window.location.pathname, routeBase);

  // Standard PWA update pattern for learner routes. Admin routes must not
  // reload even if a previously installed worker still controls this tab.
  let swRefreshing = false;
  const refreshLearner = () => {
    if (!swRefreshing && !onAdminRoute()) {
      swRefreshing = true;
      window.location.reload();
    }
  };
  navigator.serviceWorker.addEventListener("controllerchange", refreshLearner);
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "SW_UPDATED") refreshLearner();
  });

  // iOS bfcache fix: a restored learner snapshot needs a fresh load.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) refreshLearner();
  });

  window.addEventListener("load", () => {
    if (onAdminRoute()) return;
    navigator.serviceWorker
      .register(swPath, { scope: swScope })
      .then(async (reg) => {
        // Check for updates on every page load so installs never wait 24 h
        reg.update().catch(() => {});

        // Keep learner background sync and periodic refreshes unchanged.
        if ("periodicSync" in reg) {
          try {
            // @ts-ignore — PeriodicSyncManager types not yet in TS lib
            await reg.periodicSync.register("news-refresh", {
              minInterval: 12 * 60 * 60 * 1000,
            });
            // @ts-ignore
            await reg.periodicSync.register("biosecurity-refresh", {
              minInterval: 24 * 60 * 60 * 1000,
            });
          } catch {
            // Permission denied or not supported — non-fatal
          }
        }
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
        console.warn("Service worker registration failed:", err);
      });
  });
}