import { ReplitConnectors } from "@replit/connectors-sdk";

type ProxyArgs = Parameters<ReplitConnectors["proxy"]>;

/** Narrow direct adapter: credentials never leave the server; no arbitrary hosts. */
export function createDirectGoogleProxy(
  getToken: () => Promise<string | null | undefined>,
  request: typeof fetch = fetch,
): ReplitConnectors["proxy"] {
  return async (name, path, options) => {
    const base = name === "google-drive" ? "https://www.googleapis.com"
      : name === "google-sheet" ? "https://sheets.googleapis.com" : null;
    const allowed = name === "google-drive" ? /^\/(?:upload\/)?drive\/v3(?:\/|[?]|$)/ : /^\/v4\/spreadsheets(?:\/|[?]|$)/;
    if (!base || !allowed.test(path) || /[\r\n\\]/.test(path)) throw new Error("Unsupported direct Google API request");
    const token = await getToken();
    if (!token) throw new Error("Google Application Default Credentials are unavailable");
    const headers = new Headers(options?.headers);
    headers.set("Authorization", `Bearer ${token}`);
    let body = options?.body;
    if (body != null && typeof body === "object" && !(body instanceof Buffer) &&
        !(body instanceof ArrayBuffer) && !(body instanceof Blob) &&
        !(body instanceof FormData) && !(body instanceof URLSearchParams) && !(body instanceof ReadableStream)) {
      body = JSON.stringify(body);
      if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    }
    return request(base + path, {
      method: options?.method ?? "GET", headers, body: body as NonNullable<Parameters<typeof fetch>[1]>["body"],
      redirect: "error", signal: AbortSignal.timeout(120_000),
    });
  };
}

// Keep the existing Replit path independent of ADC initialisation and bundling.
let directAuth: Promise<import("google-auth-library").GoogleAuth> | undefined;
const directProxy = createDirectGoogleProxy(async () => {
  directAuth ??= import("google-auth-library").then(({ GoogleAuth }) => new GoogleAuth({
    ...(process.env.GOOGLE_DRIVE_CREDENTIALS_FILE ? { keyFilename: process.env.GOOGLE_DRIVE_CREDENTIALS_FILE } : {}),
    scopes: [
    "https://www.googleapis.com/auth/drive",
    "https://www.googleapis.com/auth/spreadsheets",
  ] }));
  return (await directAuth).getAccessToken();
});

/** Existing deployments continue through the same Replit connector implementation. */
export class AppConnectors extends ReplitConnectors {
  override proxy(...args: ProxyArgs): ReturnType<ReplitConnectors["proxy"]> {
    if (process.env.RECOVERY_REHEARSAL === "true") throw new Error("External Google requests are disabled during recovery rehearsal");
    const provider = process.env.GOOGLE_API_PROVIDER ?? "replit";
    if (provider === "replit") return super.proxy(...args);
    if (provider === "direct") return directProxy(...args);
    throw new Error("Unsupported GOOGLE_API_PROVIDER");
  }
}
