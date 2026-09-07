const ARTIFACT_PREVIEW_PREFIX = "/chainsaw-training";

/**
 * Resolve the app prefix from Vite when configured, or from the artifact
 * preview URL when Replit mounts this app beneath its artifact name.
 */
export function getAppBasePath(): string {
  const configuredBase = import.meta.env.BASE_URL.replace(/\/$/, "");
  if (configuredBase) return configuredBase;

  if (typeof window !== "undefined") {
    const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
    if (
      pathname === ARTIFACT_PREVIEW_PREFIX ||
      pathname.startsWith(`${ARTIFACT_PREVIEW_PREFIX}/`)
    ) {
      return ARTIFACT_PREVIEW_PREFIX;
    }
  }

  return "";
}

export function appPath(path: string): string {
  const normalizedPath = path.replace(/^\/+/, "");
  return `${getAppBasePath()}/${normalizedPath}`;
}