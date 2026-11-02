import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifyWebsitePurchaseSignature } from "../src/lib/websitePurchaseSignature.ts";

const secret = "synthetic-local-test-only-key";
const timestamp = "1790574000";
const now = Number(timestamp) * 1000;
const body = Buffer.from('{"event":"purchase.confirmed","orderId":"123","lineItemId":"456","seatId":"1","email":"test@example.invalid"}');
const sign = (payload: Buffer, at = timestamp) =>
  createHmac("sha256", secret).update(at + ".").update(payload).digest("hex");

test("accepts the signed exact body inside the five-minute window", () => {
  assert.equal(verifyWebsitePurchaseSignature(body, timestamp, sign(body), secret, now), true);
});

test("rejects tampering, missing credentials and a signature from another key", () => {
  assert.equal(verifyWebsitePurchaseSignature(Buffer.from("{}"), timestamp, sign(body), secret, now), false);
  assert.equal(verifyWebsitePurchaseSignature(body, timestamp, sign(body), "other-key", now), false);
  assert.equal(verifyWebsitePurchaseSignature(body, timestamp, undefined, secret, now), false);
  assert.equal(verifyWebsitePurchaseSignature(undefined, timestamp, sign(body), secret, now), false);
});

test("rejects expired, future, malformed and non-hex signatures", () => {
  assert.equal(verifyWebsitePurchaseSignature(body, timestamp, sign(body), secret, now + 301_000), false);
  assert.equal(verifyWebsitePurchaseSignature(body, timestamp, sign(body), secret, now - 301_000), false);
  assert.equal(verifyWebsitePurchaseSignature(body, "hello", sign(body), secret, now), false);
  assert.equal(verifyWebsitePurchaseSignature(body, timestamp, "z".repeat(64), secret, now), false);
});