import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { createRequire } from "node:module";

const { Pool } = createRequire(new URL("../../../lib/db/package.json", import.meta.url))("pg");

async function freePort(): Promise<number> {
  const socket = createServer();
  await new Promise<void>((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const address = socket.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const port = address.port;
  await new Promise<void>((resolve) => socket.close(() => resolve()));
  return port;
}

test("purchase bridge rejects unsigned, tampered and malformed requests before any database write", async () => {
  const port = await freePort();
  const secret = "synthetic-local-test-only-key";
  const server = spawn(process.execPath, [new URL("../dist/index.mjs", import.meta.url).pathname], {
    cwd: new URL("../../..", import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: "test",
      PORT: String(port),
      WEBSITE_PURCHASE_SECRET: secret,
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: "1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    const url = `http://127.0.0.1:${port}/api/website/purchases`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error("Isolated API exited before test");
      try {
        const probe = await fetch(`http://127.0.0.1:${port}/api/healthz`);
        if (probe.status < 500) { ready = true; break; }
      } catch { /* startup in progress */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true, "Isolated API started");
    const body = JSON.stringify({
      event: "purchase.confirmed", orderId: "123", lineItemId: "456", seatId: "1",
      email: "learner@example.com",
    });
    const at = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", secret).update(at + "." + body).digest("hex");
    const unsigned = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body });
    assert.equal(unsigned.status, 401);
    const tampered = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CC-Timestamp": at, "X-CC-Signature": signature },
      body: body.replace('"seatId":"1"', '"seatId":"2"'),
    });
    assert.equal(tampered.status, 401);
    const invalidBody = JSON.stringify({ event: "purchase.confirmed", orderId: "123", lineItemId: "456", seatId: "1" });
    const invalidSignature = createHmac("sha256", secret).update(at + "." + invalidBody).digest("hex");
    const malformed = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CC-Timestamp": at, "X-CC-Signature": invalidSignature },
      body: invalidBody,
    });
    assert.equal(malformed.status, 400);
  } finally {
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (server.exitCode !== null) resolve();
      else server.once("exit", () => resolve());
    });
  }
});

test("synthetic two-seat purchase retries and reversals preserve codes without sending real mail", async () => {
  if (!process.env.DATABASE_URL) throw new Error("Development database unavailable");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const port = await freePort();
  const orderId = `${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, "0")}`;
  const legacyOrderId = `${orderId}1`;
  const legacyCode = `CC-TEST-${orderId}`;
  const lineItemId = "987654321";
  const secret = "synthetic-local-test-only-key";
  const adminSecret = "synthetic-admin-session-key";
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString("base64url");
  const adminToken = `test.${payload}.${createHmac("sha256", adminSecret).update(`test.${payload}`).digest("hex")}`;
  const server = spawn(process.execPath, [new URL("../dist/index.mjs", import.meta.url).pathname], {
    cwd: new URL("../../..", import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: "test", PORT: String(port), WEBSITE_PURCHASE_SECRET: secret,
      SHOPIFY_WEBHOOK_SECRET: secret,
      SESSION_SECRET: adminSecret,
      SMTP_HOST: "127.0.0.1", SMTP_PORT: "1", SMTP_SECURE: "false",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const post = async (event: string, seatId: string, email = "synthetic-learner@example.invalid", order = orderId) => {
    const body = JSON.stringify({ event, orderId: order, lineItemId, seatId, email, buyerName: "Synthetic Learner" });
    const at = String(Math.floor(Date.now() / 1000));
    const signature = createHmac("sha256", secret).update(at + "." + body).digest("hex");
    const response = await fetch(`http://127.0.0.1:${port}/api/website/purchases`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-CC-Timestamp": at, "X-CC-Signature": signature },
      body,
    });
    return { status: response.status, data: await response.json() as { status: string; emailStatus: string } };
  };
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error("Isolated API exited before synthetic test");
      try {
        const probe = await fetch(`http://127.0.0.1:${port}/api/healthz`);
        if (probe.status < 500) { ready = true; break; }
      } catch { /* startup in progress */ }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal(ready, true);
    await pool.query(
      "INSERT INTO activation_codes (code, assigned_to, notes) VALUES ($1, $2, $3)",
      [legacyCode, "synthetic-learner@example.invalid", `Shopify order id ${legacyOrderId} | existing order-wide code`],
    );
    const legacyRefund = await post("purchase.refunded", "1", "synthetic-learner@example.invalid", legacyOrderId);
    assert.equal(legacyRefund.status, 409);
    assert.equal((await pool.query("SELECT is_paused FROM activation_codes WHERE code = $1", [legacyCode])).rows[0].is_paused, false);
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM website_purchase_seats WHERE order_id = $1", [legacyOrderId])).rows[0].n, 0);
    const first = await post("purchase.confirmed", "1");
    assert.equal(first.status, 202);
    assert.equal(first.data.emailStatus, "needs_review"); // local SMTP sink refuses; no external mail
    const retry = await post("purchase.confirmed", "1");
    assert.equal(retry.status, 202);
    assert.equal(retry.data.emailStatus, "needs_review"); // never resend uncertain email
    const second = await post("purchase.confirmed", "2");
    assert.equal(second.status, 202);
    const reviewUrl = `http://127.0.0.1:${port}/api/admin/website-purchase-seats`;
    assert.equal((await fetch(reviewUrl)).status, 401);
    const review = await fetch(reviewUrl, { headers: { admintoken: adminToken } });
    assert.equal(review.status, 200);
    const seats = await review.json() as Array<{ id: number; orderId: string; seatId: string; emailStatus: string; isPaused: boolean; reviewable: boolean }>;
    const secondSeat = seats.find((seat) => seat.orderId === orderId && seat.seatId === "2");
    assert.equal(secondSeat?.emailStatus, "needs_review");
    assert.equal(secondSeat?.isPaused, false);
    assert.equal(secondSeat?.reviewable, true);
    const firstSeat = seats.find((seat) => seat.orderId === orderId && seat.seatId === "1")!;
    await pool.query("UPDATE website_purchase_seats SET email_status = 'sending', updated_at = now() WHERE id = $1", [firstSeat.id]);
    const tooEarly = await fetch(`${reviewUrl}/${firstSeat.id}/resolve`, {
      method: "POST", headers: { admintoken: adminToken, "Content-Type": "application/json" },
      body: JSON.stringify({ resolution: "confirmed_received", note: "Too soon" }),
    });
    assert.equal(tooEarly.status, 409);
    await pool.query("UPDATE website_purchase_seats SET email_status = 'needs_review' WHERE id = $1", [firstSeat.id]);
    const manualUrl = `${reviewUrl}/${secondSeat!.id}`;
    assert.equal((await fetch(`${manualUrl}/code`)).status, 401);
    const revealed = await fetch(`${manualUrl}/code`, { headers: { admintoken: adminToken } });
    assert.equal(revealed.status, 200);
    const existingCode = (await revealed.json() as { code: string }).code;
    assert.match(existingCode, /^CC-/);
    const resolutionBody = JSON.stringify({ resolution: "manual_handoff", note: "Synthetic support handoff confirmed" });
    const resolve = () => fetch(`${manualUrl}/resolve`, {
      method: "POST",
      headers: { admintoken: adminToken, "Content-Type": "application/json" },
      body: resolutionBody,
    });
    assert.equal((await resolve()).status, 200);
    assert.equal((await resolve()).status, 409);
    assert.equal((await fetch(`${manualUrl}/code`, { headers: { admintoken: adminToken } })).status, 409);
    const afterManualRetry = await post("purchase.confirmed", "2");
    assert.equal(afterManualRetry.data.emailStatus, "needs_review");
    assert.equal((await pool.query(
      `SELECT c.code, s.resolution FROM website_purchase_seats s
       JOIN activation_codes c ON c.id = s.activation_code_id
       WHERE s.order_id = $1 AND s.seat_id = '2'`, [orderId],
    )).rows[0].code, existingCode);
    const webhookBody = JSON.stringify({ id: Number(orderId), email: "synthetic-learner@example.invalid" });
    const webhookSignature = createHmac("sha256", secret).update(webhookBody).digest("base64");
    const webhook = await fetch(`http://127.0.0.1:${port}/api/api/shopify/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json", "X-Shopify-Topic": "orders/paid",
        "X-Shopify-Hmac-Sha256": webhookSignature,
      },
      body: webhookBody,
    });
    assert.equal(webhook.status, 200);
    assert.equal((await webhook.json() as { duplicate: boolean }).duplicate, true);
    const rows = (await pool.query(
      `SELECT s.seat_id, s.activation_code_id, c.is_paused
       FROM website_purchase_seats s JOIN activation_codes c ON c.id = s.activation_code_id
       WHERE s.order_id = $1 ORDER BY s.seat_id`, [orderId],
    )).rows;
    assert.equal(rows.length, 2);
    assert.notEqual(rows[0].activation_code_id, rows[1].activation_code_id);
    const refunded = await post("purchase.refunded", "1");
    assert.equal(refunded.status, 200);
    assert.equal(refunded.data.status, "revoked");
    assert.equal((await fetch(`${reviewUrl}/${firstSeat.id}/resolve`, {
      method: "POST", headers: { admintoken: adminToken, "Content-Type": "application/json" },
      body: JSON.stringify({ resolution: "confirmed_received", note: "Not permitted after refund" }),
    })).status, 409);
    const afterRefund = (await pool.query(
      `SELECT s.seat_id, c.is_paused FROM website_purchase_seats s
       JOIN activation_codes c ON c.id = s.activation_code_id
       WHERE s.order_id = $1 ORDER BY s.seat_id`, [orderId],
    )).rows;
    assert.deepEqual(afterRefund, [{ seat_id: "1", is_paused: true }, { seat_id: "2", is_paused: false }]);
    const latePaid = await post("purchase.confirmed", "1");
    assert.equal(latePaid.data.status, "revoked");
    assert.equal((await pool.query("SELECT count(*)::int AS n FROM website_purchase_seats WHERE order_id = $1", [orderId])).rows[0].n, 2);
  } finally {
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => {
      if (server.exitCode !== null) resolve();
      else server.once("exit", () => resolve());
    });
    const ids = (await pool.query(
      "DELETE FROM website_purchase_seats WHERE order_id = $1 RETURNING activation_code_id", [orderId],
    )).rows.map((row: { activation_code_id: number | null }) => row.activation_code_id)
      .filter((id: number | null): id is number => id !== null);
    if (ids.length) await pool.query("DELETE FROM activation_codes WHERE id = ANY($1::int[])", [ids]);
    await pool.query("DELETE FROM activation_codes WHERE code = $1", [legacyCode]);
    await pool.end();
  }
});