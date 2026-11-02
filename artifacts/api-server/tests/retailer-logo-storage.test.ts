import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import esbuildPluginPino from "esbuild-plugin-pino";

const requireFromDb = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = requireFromDb("pg") as typeof import("pg");
Object.assign(globalThis, { require: createRequire(import.meta.url) });

async function buildApiHarness(): Promise<{ directory: string; bundlePath: string }> {
  const testDirectory = path.dirname(fileURLToPath(import.meta.url));
  const directory = await mkdtemp(path.join(testDirectory, ".retailer-logo-harness-"));
  const bundlePath = path.join(directory, "server.mjs");
  try {
    await build({
      entryPoints: [{
        in: path.join(testDirectory, "retailer-logo-harness.ts"),
        out: "server",
      }],
      outdir: directory,
      platform: "node",
      bundle: true,
      format: "esm",
      outExtension: { ".js": ".mjs" },
      logLevel: "silent",
      external: ["*.node", "@google-cloud/*", "@google/*", "@replit/connectors-sdk", "nodemailer", "pdfkit", "fontkit"],
      plugins: [esbuildPluginPino({ transports: ["pino-pretty"] })],
      banner: {
        js: `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);`,
      },
    });
    return { directory, bundlePath };
  } catch (error) {
    await rm(directory, { recursive: true, force: true });
    throw error;
  }
}

async function availablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return port;
}

async function startApi(
  bundlePath: string,
  port: number,
  adminPassword: string,
  sessionSecret: string,
): Promise<ChildProcessWithoutNullStreams> {
  const server = spawn(process.execPath, [bundlePath], {
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    env: {
      ...process.env,
      ADMIN_PASSWORD: adminPassword,
      APP_URL: `http://127.0.0.1:${port}`,
      SESSION_SECRET: sessionSecret,
      DEMO_MODE: "false",
      NODE_ENV: "test",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const output: string[] = [];
    const timeout = setTimeout(() => {
      reject(new Error(`API test server did not start:\n${output.join("")}`));
    }, 20_000);
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      output.push(text);
      if (text.includes("Server listening")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`API test server exited with code ${code}:\n${output.join("")}`));
    });
  });
  return server;
}

async function stopApi(server: ChildProcessWithoutNullStreams): Promise<void> {
  if (server.exitCode !== null) return;
  server.kill("SIGTERM");
  await new Promise<void>((resolve) => server.once("exit", () => resolve()));
}

test("retailer logos upload, persist publicly, replace, and remove", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for retailer logo integration tests");
  assert.ok(process.env.PRIVATE_OBJECT_DIR, "PRIVATE_OBJECT_DIR is required for retailer logo integration tests");

  const { directory: harnessDirectory, bundlePath } = await buildApiHarness();
  const suffix = `${process.pid}-${Date.now()}`;
  const adminPassword = `retailer-logo-password-${suffix}`;
  const sessionSecret = `retailer-logo-session-${suffix}`;
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let server: ChildProcessWithoutNullStreams | undefined;
  let retailerId: number | undefined;
  let adminToken: string | undefined;

  const login = async () => {
    const response = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: adminPassword }),
    });
    assert.equal(response.status, 200);
    return (await response.json() as { token: string }).token;
  };
  const adminJson = (path: string, method: string, body?: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        admintoken: adminToken!,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const uploadAndAssign = async (bytes: Buffer) => {
    const request = await adminJson(`/admin/retailers/${retailerId}/logo-upload`, "POST", {
      name: "retailer-logo.png",
      size: bytes.byteLength,
      contentType: "image/png",
    });
    assert.equal(request.status, 200);
    const { uploadURL, objectKey } = await request.json() as { uploadURL: string; objectKey: string };
    const upload = await fetch(uploadURL, {
      method: "PUT",
      headers: { "content-type": "image/png" },
      body: bytes,
    });
    assert.ok(upload.ok, `signed retailer logo upload failed with ${upload.status}`);
    const assignment = await adminJson(`/admin/retailers/${retailerId}/logo`, "PUT", { objectKey });
    assert.equal(assignment.status, 200);
    assert.deepEqual(await assignment.json(), { logoObjectKey: objectKey });
  };
  const publicLogoUrl = async (): Promise<string | null> => {
    const response = await fetch(`${baseUrl}/retailers/public`);
    assert.equal(response.status, 200);
    const retailers = await response.json() as Array<{ id: number; logoUrl: string | null }>;
    return retailers.find((retailer) => retailer.id === retailerId)?.logoUrl ?? null;
  };
  const assertLogoBytes = async (url: string, expected: Buffer) => {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^image\/png/);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  };

  const firstLogo = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  const replacementLogo = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 5, 6, 7, 8]);

  try {
    const portNumber = port;
    server = await startApi(bundlePath, portNumber, adminPassword, sessionSecret);
    adminToken = await login();
    const inserted = await pool.query<{ id: number }>(
      `INSERT INTO chainsaw_retailers (
        name, address, town, county, postcode, lat, lng, email, phone, active, featured, verification_status
      ) VALUES ($1, '1 Test Road', 'London', 'London', 'SW1A 1AA', 51.5, -0.1, $2, '01234567890', true, false, 'verified')
      RETURNING id`,
      [`Logo integration retailer ${suffix}`, `logo-${suffix}@example.test`],
    );
    retailerId = inserted.rows[0]!.id;

    await uploadAndAssign(firstLogo);
    const firstUrl = await publicLogoUrl();
    assert.ok(firstUrl);
    assert.equal(new URL(firstUrl).origin, `http://127.0.0.1:${port}`);
    await assertLogoBytes(firstUrl, firstLogo);

    await stopApi(server);
    server = await startApi(bundlePath, port, adminPassword, sessionSecret);
    adminToken = await login();
    assert.equal(await publicLogoUrl(), firstUrl);
    await assertLogoBytes(firstUrl, firstLogo);

    await uploadAndAssign(replacementLogo);
    const replacementUrl = await publicLogoUrl();
    assert.ok(replacementUrl);
    assert.notEqual(replacementUrl, firstUrl);
    await assertLogoBytes(replacementUrl, replacementLogo);
    assert.equal((await fetch(firstUrl)).status, 404);

    const remove = await adminJson(`/admin/retailers/${retailerId}/logo`, "PUT", { objectKey: null });
    assert.equal(remove.status, 200);
    assert.deepEqual(await remove.json(), { logoObjectKey: null });
    assert.equal(await publicLogoUrl(), null);
    assert.equal((await fetch(replacementUrl)).status, 404);

    await uploadAndAssign(firstLogo);
    const deleteUrl = await publicLogoUrl();
    assert.ok(deleteUrl);
    const deleted = await adminJson(`/admin/retailers/${retailerId}`, "DELETE");
    assert.equal(deleted.status, 200);
    retailerId = undefined;
    assert.equal((await fetch(deleteUrl)).status, 404);
  } finally {
    if (server && server.exitCode === null && adminToken && retailerId !== undefined) {
      await adminJson(`/admin/retailers/${retailerId}`, "DELETE").catch(() => undefined);
    }
    if (retailerId !== undefined) {
      await pool.query("DELETE FROM chainsaw_retailers WHERE id = $1", [retailerId]).catch(() => undefined);
    }
    if (server) await stopApi(server);
    await pool.end();
    await rm(harnessDirectory, { recursive: true, force: true });
  }
});