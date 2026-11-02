import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
const dir = await mkdtemp(new URL(".portable-provider-test-", import.meta.url).pathname);
await build({ stdin: { contents: 'export * from "./src/lib/objectStorageRuntime"; export * from "./src/lib/appConnectors";',
  resolveDir: new URL("../", import.meta.url).pathname }, outfile: `${dir}/providers.mjs`, bundle: true,
  packages: "external", platform: "node", format: "esm", logLevel: "silent" });
const { createObjectStorageRuntime, createDirectGoogleProxy, AppConnectors } = await import(pathToFileURL(`${dir}/providers.mjs`));
test.after(() => rm(dir, { recursive: true, force: true }));

test("Replit keeps sidecar credentials and the existing upload contract", async () => {
  let opts, sent;
  const runtime = createObjectStorageRuntime("replit", o => { opts = o; return {}; }, async (url, init) => {
    sent = { url, ...JSON.parse(init.body) }; return Response.json({ signed_url: "https://upload.invalid/test" });
  });
  assert.equal(opts.credentials.token_url, "http://127.0.0.1:1106/token");
  assert.equal(await runtime.upload("bucket", "private/assessment-media/images/id"), "https://upload.invalid/test");
  assert.equal(sent.object_name, "private/assessment-media/images/id");
  assert.equal(sent.method, "PUT");
  assert.ok(Date.parse(sent.expires_at) > Date.now() + 14 * 60_000);
});
test("GCS uses ADC and signs the same private key without calling the sidecar", async () => {
  let seen;
  const runtime = createObjectStorageRuntime("gcs", opts => {
    assert.deepEqual(opts, {});
    return { bucket: bucket => ({ file: object => ({ getSignedUrl: async config => {
      seen = { bucket, object, config }; return ["https://gcs.invalid/signed"];
    } }) }) };
  }, () => { throw Error("Sidecar must not be contacted"); });
  assert.equal(await runtime.upload("target", "private/retailer-logos/65/id"), "https://gcs.invalid/signed");
  assert.equal(seen.object, "private/retailer-logos/65/id");
  assert.equal(seen.config.action, "write");
  assert.equal(seen.config.version, "v4");
});
test("invalid storage and connector providers fail explicitly", async () => {
  assert.throws(() => createObjectStorageRuntime("wrong"), /Unsupported/);
  const old = process.env.GOOGLE_API_PROVIDER;
  try {
    process.env.GOOGLE_API_PROVIDER = "wrong";
    assert.throws(() => new AppConnectors().proxy("google-drive", "/drive/v3/files"), /Unsupported/);
  } finally { if (old === undefined) delete process.env.GOOGLE_API_PROVIDER; else process.env.GOOGLE_API_PROVIDER = old; }
});
test("GCS can use a separate host-side signer credential without changing Replit", () => {
  const old = process.env.GOOGLE_STORAGE_CREDENTIALS_FILE;
  try {
    process.env.GOOGLE_STORAGE_CREDENTIALS_FILE = "/private/synthetic-storage-credentials.json";
    createObjectStorageRuntime("gcs", opts => { assert.deepEqual(opts, { keyFilename: "/private/synthetic-storage-credentials.json" }); return {}; });
    createObjectStorageRuntime("replit", opts => { assert.equal(opts.keyFilename, undefined); return {}; });
  } finally { if (old === undefined) delete process.env.GOOGLE_STORAGE_CREDENTIALS_FILE; else process.env.GOOGLE_STORAGE_CREDENTIALS_FILE = old; }
});
test("direct Google requests are scoped, preserve bytes and never redirect credentials", async () => {
  const seen = [];
  const proxy = createDirectGoogleProxy(async () => "synthetic-test-token", async (url, init) => {
    seen.push({ url, init }); return Response.json({ ok: true });
  });
  const bytes = Buffer.from([0, 255, 3]);
  await proxy("google-drive", "/upload/drive/v3/files/id?uploadType=media", { method: "PATCH", body: bytes });
  await proxy("google-sheet", "/v4/spreadsheets/id", { method: "GET" });
  assert.equal(seen[0].url, "https://www.googleapis.com/upload/drive/v3/files/id?uploadType=media");
  assert.equal(seen[0].init.body, bytes);
  assert.equal(seen[0].init.redirect, "error");
  assert.equal(seen[0].init.headers.get("Authorization"), "Bearer synthetic-test-token");
  assert.match(seen[1].url, /^https:\/\/sheets.googleapis.com\//);
  await assert.rejects(proxy("github", "/repos/test"), /Unsupported/);
  await assert.rejects(proxy("google-drive", "//evil.invalid"), /Unsupported/);
  await assert.rejects(proxy("google-drive", "/drive/v3\\evil"), /Unsupported/);
  assert.equal(seen.length, 2);
});
test("Replit connector remains the default and delegates without changing options", async () => {
  const { ReplitConnectors } = await import("@replit/connectors-sdk");
  const old = ReplitConnectors.prototype.proxy, env = process.env.GOOGLE_API_PROVIDER;
  try {
    delete process.env.GOOGLE_API_PROVIDER;
    ReplitConnectors.prototype.proxy = async (...args) => Response.json(args);
    const r = await new AppConnectors().proxy("google-drive", "/drive/v3/files", { method: "GET" });
    assert.deepEqual(await r.json(), ["google-drive", "/drive/v3/files", { method: "GET" }]);
  } finally { ReplitConnectors.prototype.proxy = old; if (env === undefined) delete process.env.GOOGLE_API_PROVIDER; else process.env.GOOGLE_API_PROVIDER = env; }
});
test("recovery rehearsal cannot call external Google services", () => {
  const old = process.env.RECOVERY_REHEARSAL;
  try {
    process.env.RECOVERY_REHEARSAL = "true";
    assert.throws(() => new AppConnectors().proxy("google-drive", "/drive/v3/files"), /disabled during recovery/);
  } finally { if (old === undefined) delete process.env.RECOVERY_REHEARSAL; else process.env.RECOVERY_REHEARSAL = old; }
});
