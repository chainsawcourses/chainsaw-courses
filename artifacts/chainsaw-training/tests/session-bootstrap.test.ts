import assert from "node:assert/strict";
import test from "node:test";

import { settleWithin } from "../src/lib/startupTimeout.ts";

test("native session startup resolves normally when storage responds", async () => {
  const value = await settleWithin(Promise.resolve("ready"), 100, "timed out");
  assert.equal(value, "ready");
});

test("native session startup rejects instead of hanging when storage never responds", async () => {
  const never = new Promise<never>(() => {});
  await assert.rejects(
    settleWithin(never, 10, "Secure session restoration timed out"),
    /Secure session restoration timed out/,
  );
});

test("native session startup preserves storage failures", async () => {
  await assert.rejects(
    settleWithin(Promise.reject(new Error("storage failed")), 100, "timed out"),
    /storage failed/,
  );
});