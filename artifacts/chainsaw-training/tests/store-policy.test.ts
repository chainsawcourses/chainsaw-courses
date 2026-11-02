import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the native-accessible QR route contains no external purchase direction", async () => {
  const source = await readFile(new URL("../src/pages/QrLanding.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /https?:\/\//i);
  assert.doesNotMatch(source, /purchase|subscribe|checkout|refresh my certificate/i);
  assert.match(source, /Enter your existing access code to continue/);
});