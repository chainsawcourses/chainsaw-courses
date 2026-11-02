import { Storage } from "@google-cloud/storage";

const sidecar = "http://127.0.0.1:1106";

/** Replit remains the default. GCS uses standard Application Default Credentials. */
export function createObjectStorageRuntime(
  provider = process.env.OBJECT_STORAGE_PROVIDER ?? "replit",
  makeStorage: (options: ConstructorParameters<typeof Storage>[0]) => Storage = options => new Storage(options),
  request: typeof fetch = fetch,
) {
  if (provider !== "replit" && provider !== "gcs") throw new Error("Unsupported OBJECT_STORAGE_PROVIDER");
  const storage = makeStorage(provider === "gcs"
    ? (process.env.GOOGLE_STORAGE_CREDENTIALS_FILE ? { keyFilename: process.env.GOOGLE_STORAGE_CREDENTIALS_FILE } : {})
    : {
    credentials: {
      audience: "replit", subject_token_type: "access_token",
      token_url: `${sidecar}/token`, type: "external_account",
      credential_source: { url: `${sidecar}/credential`, format: { type: "json", subject_token_field_name: "access_token" } },
      universe_domain: "googleapis.com",
    },
    projectId: "",
  });
  async function upload(bucketName: string, objectName: string): Promise<string> {
    const expires = new Date(Date.now() + 15 * 60 * 1000);
    if (provider === "gcs") {
      const [url] = await storage.bucket(bucketName).file(objectName).getSignedUrl({
        version: "v4", action: "write", expires,
      });
      return url;
    }
    const response = await request(`${sidecar}/object-storage/signed-object-url`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bucket_name: bucketName, object_name: objectName, method: "PUT", expires_at: expires.toISOString() }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Failed to create App Storage upload URL: ${response.status}`);
    const body = await response.json() as { signed_url?: string };
    if (!body.signed_url) throw new Error("App Storage did not return an upload URL");
    return body.signed_url;
  }
  return { storage, upload };
}
