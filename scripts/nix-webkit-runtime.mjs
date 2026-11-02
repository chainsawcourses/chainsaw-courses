import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

// Discover split Nix outputs from the active environment, never store hashes.
export function configureNixWebKitRuntime(env = process.env) {
  if (!env.NIX_LDFLAGS) return;

  const libraryPaths = [...new Set(
    env.NIX_LDFLAGS.split(/\s+/)
      .filter((entry) => entry.startsWith("-L"))
      .map((entry) => entry.slice(2)),
  )];
  const pluginPaths = libraryPaths
    .map((libraryPath) => path.join(libraryPath, "gstreamer-1.0"))
    .filter(existsSync);
  const scanner = libraryPaths
    .map((libraryPath) => path.join(path.dirname(libraryPath), "libexec/gstreamer-1.0/gst-plugin-scanner"))
    .find(existsSync);
  const vendorFiles = libraryPaths
    .map((libraryPath) => path.join(path.dirname(libraryPath), "share/glvnd/egl_vendor.d"))
    .filter(existsSync)
    .flatMap((directory) => readdirSync(directory)
      .filter((name) => name.endsWith(".json"))
      .sort()
      .map((name) => path.join(directory, name)));

  // Directory discovery alone does not expose EGL platforms in this runtime.
  // Explicit vendor manifests let GLVND load Mesa for headless WPE WebKit.
  // The workspace image can inherit a manifest from a different Mesa version.
  // Prefer vendors from the active Nix package set over that ambient default.
  if (vendorFiles.length) {
    env.__EGL_VENDOR_LIBRARY_FILENAMES = [...new Set(vendorFiles)].join(":");
  }
  if (pluginPaths.length && !env.GST_PLUGIN_SYSTEM_PATH_1_0) {
    env.GST_PLUGIN_SYSTEM_PATH_1_0 = pluginPaths.join(":");
  }
  if (scanner && !env.GST_PLUGIN_SCANNER) {
    env.GST_PLUGIN_SCANNER = scanner;
  }

  // Playwright's distro validator cannot detect Nix split outputs. Actual
  // browser launch/page creation still fails if a runtime dependency is absent.
  env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS ??= "1";
}