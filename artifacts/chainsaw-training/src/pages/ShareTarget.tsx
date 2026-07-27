import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * ShareTarget — handles content shared to the app via the OS share tray.
 *
 * The manifest's share_target sends a GET to /share?title=...&text=...&url=...
 * We read those params and redirect the user to the most relevant page.
 *
 * Routing logic:
 *  - URL contains a known deep-link path  → navigate to that path
 *  - Text/title mentions a keyword        → navigate to relevant section
 *  - Fallback                             → send to news feed (good catch-all)
 */
export default function ShareTarget() {
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sharedUrl = params.get("url") || "";
    const sharedText = (params.get("text") || "").toLowerCase();
    const sharedTitle = (params.get("title") || "").toLowerCase();
    const combined = sharedText + " " + sharedTitle;

    // Try to deep-link if the shared URL is already one of our paths
    const knownPaths = [
      "/biosecurity-map",
      "/inspection",
      "/risk-assessment",
      "/glossary",
      "/news",
      "/chain-chart",
      "/species-guide",
      "/manual",
      "/training",
      "/exam",
    ];

    let destination = "/news"; // sensible default

    // If the shared URL already points into our app, honour it
    if (sharedUrl) {
      try {
        const parsed = new URL(sharedUrl);
        const matchedPath = knownPaths.find((p) =>
          parsed.pathname.startsWith(p)
        );
        if (matchedPath) {
          destination = matchedPath;
        }
      } catch {
        // not a valid URL — fall through to keyword matching
      }
    }

    // Keyword matching for shares from external sources
    if (destination === "/news") {
      if (
        combined.includes("biosecurity") ||
        combined.includes("opm") ||
        combined.includes("ash dieback") ||
        combined.includes("pest") ||
        combined.includes("disease")
      ) {
        destination = "/biosecurity-map";
      } else if (
        combined.includes("inspect") ||
        combined.includes("pre-start") ||
        combined.includes("checklist")
      ) {
        destination = "/inspection";
      } else if (
        combined.includes("risk") ||
        combined.includes("assessment") ||
        combined.includes("hazard")
      ) {
        destination = "/risk-assessment";
      } else if (
        combined.includes("glossary") ||
        combined.includes("definition") ||
        combined.includes("term")
      ) {
        destination = "/glossary";
      } else if (
        combined.includes("chain") &&
        (combined.includes("guide") || combined.includes("chart"))
      ) {
        destination = "/chain-chart";
      } else if (
        combined.includes("species") ||
        combined.includes("timber") ||
        combined.includes("tree")
      ) {
        destination = "/species-guide";
      }
    }

    navigate(destination);
  }, [navigate]);

  // Shown briefly while the redirect fires
  return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center space-y-3">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-gray-500">Opening Chainsaw Courses…</p>
      </div>
    </div>
  );
}
