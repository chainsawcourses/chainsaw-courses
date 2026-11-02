import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import express from "express";
import { PDFDocument } from "pdf-lib";

test("public privacy policy route returns an openable PDF attachment", async () => {
  const fixtureDir = await mkdtemp(path.resolve(".privacy-policy-route-test-"));
  const fixturePath = path.join(fixtureDir, "privacyPolicy.mjs");
  await build({
    entryPoints: [path.resolve("src/routes/privacyPolicy.ts")],
    outfile: fixturePath,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
  });
  const { default: privacyPolicyRouter } = await import(pathToFileURL(fixturePath).href);
  const app = express();
  app.use("/api", privacyPolicyRouter);
  const server = app.listen(0, "127.0.0.1");

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/privacy-policy-pdf`);

    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /^application\/pdf(?:;|$)/);
    assert.equal(
      response.headers.get("content-disposition"),
      'attachment; filename="Chainsaw-Courses-Privacy-Policy.pdf"',
    );

    const document = await PDFDocument.load(await response.arrayBuffer());
    assert.ok(document.getPageCount() >= 1, "downloaded privacy policy PDF must contain at least one page");
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await rm(fixtureDir, { recursive: true, force: true });
  }
});