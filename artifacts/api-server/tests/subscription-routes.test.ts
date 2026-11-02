import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import test from "node:test";
import { addCalendarMonthsUtc } from "../src/lib/courseAccess.ts";

const requireFromDb = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = requireFromDb("pg") as typeof import("pg");

test("production billing reconciliation ignores the test-only notification scope", async () => {
  const suffix = `production-scope-${process.pid}-${Date.now()}`;
  const port = 27000 + (process.pid % 1000);
  const smtpPort = 28000 + (process.pid % 1000);
  const openAlertId = `production-open:${suffix}`;
  const pendingAlertId = `production-pending:${suffix}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const deliveredSubjects: string[] = [];
  const smtpServer = createServer((socket) => {
    let buffer = "";
    let receivingMessage = false;
    socket.write("220 localhost ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (receivingMessage) {
        const end = buffer.indexOf("\r\n.\r\n");
        if (end === -1) return;
        const message = buffer.slice(0, end);
        const subject = message.match(/^Subject:\s*(.+)$/mi)?.[1]?.trim();
        if (subject) deliveredSubjects.push(subject);
        buffer = buffer.slice(end + 5);
        receivingMessage = false;
        socket.write("250 Message accepted\r\n");
      }
      while (!receivingMessage) {
        const lineEnd = buffer.indexOf("\r\n");
        if (lineEnd === -1) return;
        const command = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        if (/^(EHLO|HELO) /i.test(command)) socket.write("250 localhost\r\n");
        else if (/^DATA$/i.test(command)) {
          receivingMessage = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (/^QUIT$/i.test(command)) socket.end("221 Bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  let server: ReturnType<typeof spawn> | null = null;
  let serverOutput = "";

  try {
    await new Promise<void>((resolve) => smtpServer.listen(smtpPort, "127.0.0.1", resolve));
    await pool.query(
      `INSERT INTO billing_support_notifications (
         alert_id, alert_type, title, description, status, open_delivery_status,
         resolution_delivery_status, updated_at
       ) VALUES
         ($1, 'scope_regression', 'Unrelated open production alert', 'Must be reconciled outside test mode.',
          'open', 'pending', NULL, NOW()),
         ($2, 'scope_regression', 'Unrelated pending production alert', 'Must be delivered outside test mode.',
          'resolved', 'sent', 'pending', NOW())`,
      [openAlertId, pendingAlertId],
    );

    server = spawn(process.execPath, [new URL("../dist/index.mjs", import.meta.url).pathname], {
      cwd: new URL("../../..", import.meta.url),
      env: {
        ...process.env,
        NODE_ENV: "production",
        BILLING_NOTIFICATION_TEST_SCOPE: "scope-that-matches-neither-production-fixture",
        SESSION_SECRET: `production-scope-session-${suffix}`,
        SMTP_HOST: "127.0.0.1",
        SMTP_PORT: String(smtpPort),
        SMTP_SECURE: "false",
        SMTP_USER: "",
        SMTP_PASS: "",
        SUPPORT_EMAIL: "production-scope-test@example.test",
        PORT: String(port),
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server.stdout.on("data", (chunk: Buffer) => {
      serverOutput += chunk.toString();
    });
    server.stderr.on("data", (chunk: Buffer) => {
      serverOutput += chunk.toString();
    });
    const started = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Production-scope API test server did not start")), 15_000);
      const ready = (chunk: Buffer) => {
        if (chunk.toString().includes("Server listening")) {
          clearTimeout(timeout);
          resolve();
        }
      };
      server!.stdout.on("data", ready);
      server!.stderr.on("data", ready);
      server!.once("exit", (exitCode) => {
        clearTimeout(timeout);
        reject(new Error(`Production-scope API test server exited with code ${exitCode}`));
      });
    });
    await started;
    assert.match(
      serverOutput,
      /Test-only billing notification scope is configured outside the test environment; reconciliation will remain unfiltered/,
    );
    assert.doesNotMatch(serverOutput, /scope-that-matches-neither-production-fixture/);

    const deadline = Date.now() + 5_000;
    let rows: { alert_id: string; status: string; resolution_delivery_status: string | null }[] = [];
    while (Date.now() < deadline) {
      rows = (await pool.query<{
        alert_id: string;
        status: string;
        resolution_delivery_status: string | null;
      }>(
        `SELECT alert_id, status, resolution_delivery_status
         FROM billing_support_notifications
         WHERE alert_id = ANY($1::text[])
         ORDER BY alert_id`,
        [[openAlertId, pendingAlertId]],
      )).rows;
      const open = rows.find((row) => row.alert_id === openAlertId);
      const pending = rows.find((row) => row.alert_id === pendingAlertId);
      if (open?.status === "resolved" && pending?.resolution_delivery_status === "sent") break;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }

    assert.equal(rows.find((row) => row.alert_id === openAlertId)?.status, "resolved");
    assert.equal(
      rows.find((row) => row.alert_id === pendingAlertId)?.resolution_delivery_status,
      "sent",
    );
    assert.ok(deliveredSubjects.some((subject) =>
      subject === "[Billing alert Resolved] Unrelated pending production alert"));
  } finally {
    if (server?.exitCode === null) {
      await new Promise<void>((resolve) => {
        server!.once("exit", () => resolve());
        server!.kill("SIGTERM");
      });
    }
    await pool.query(
      "DELETE FROM billing_support_notifications WHERE alert_id = ANY($1::text[])",
      [[openAlertId, pendingAlertId]],
    );
    await Promise.allSettled([
      new Promise<void>((resolve) => smtpServer.close(() => resolve())),
      pool.end(),
    ]);
  }
});

test("billing endpoint reconciles renewals, delayed events, expiry, refresher enrolments, and admin state", async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const port = 25000 + (process.pid % 1000);
  const smtpPort = 26000 + (process.pid % 1000);
  const secret = `billing-test-secret-${suffix}`;
  const code = `SUBSCRIPTION-ROUTE-${suffix}`;
  const refreshCode = `SUBSCRIPTION-REFRESH-${suffix}`;
  const deviceId = `bonded-device-${suffix}`;
  const email = `subscription-${suffix}@example.test`;
  const repeatedAlertId = `delivery-failure:test-provider:repeated-failure-${suffix}`;
  const unrelatedPendingAlertId = `delivery-failure:unrelated-provider:${createHash("sha256").update(suffix).digest("hex").slice(0, 16)}`;
  const repeatedSupportReference = createHash("sha256").update(repeatedAlertId).digest("hex").slice(0, 12);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const deliveredSubjects: string[] = [];
  const deliveredMessages: string[] = [];
  let holdRepeatedOpening = false;
  let releaseRepeatedOpening = () => {};
  let repeatedOpeningSeenResolve = () => {};
  const repeatedOpeningSeen = new Promise<void>((resolve) => {
    repeatedOpeningSeenResolve = resolve;
  });
  const smtpServer = createServer((socket) => {
    let buffer = "";
    let receivingMessage = false;
    socket.write("220 localhost ESMTP\r\n");
    socket.on("data", (chunk) => {
      buffer += chunk.toString();
      if (receivingMessage) {
        const end = buffer.indexOf("\r\n.\r\n");
        if (end === -1) return;
        const message = buffer.slice(0, end);
        const subject = message.match(/^Subject:\s*(.+)$/mi)?.[1]?.trim();
        if (subject) {
          deliveredSubjects.push(subject);
          deliveredMessages.push(message);
        }
        buffer = buffer.slice(end + 5);
        receivingMessage = false;
        if (
          holdRepeatedOpening
          && subject?.startsWith("[Billing alert Urgent]")
          && message.includes(`Support reference ${repeatedSupportReference}`)
        ) {
          repeatedOpeningSeenResolve();
          const released = new Promise<void>((resolve) => {
            releaseRepeatedOpening = resolve;
          });
          void released.then(() => socket.write("250 Message accepted\r\n"));
        } else {
          socket.write("250 Message accepted\r\n");
        }
      }
      while (!receivingMessage) {
        const lineEnd = buffer.indexOf("\r\n");
        if (lineEnd === -1) return;
        const command = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        if (/^(EHLO|HELO) /i.test(command)) socket.write("250 localhost\r\n");
        else if (/^DATA$/i.test(command)) {
          receivingMessage = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (/^QUIT$/i.test(command)) socket.end("221 Bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => smtpServer.listen(smtpPort, "127.0.0.1", resolve));
  const waitForDeliveredSubjects = async (expectedCount: number): Promise<void> => {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      if (deliveredSubjects.length >= expectedCount) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Timed out waiting for ${expectedCount} billing support emails`);
  };
  const waitForNotification = async (
    alertId: string,
    expectedStatus: string,
  ): Promise<{
    status: string;
    open_delivery_status: string;
    resolution_delivery_status: string | null;
    resolution_delivery_error: string | null;
  }> => {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const result = await pool.query<{
        status: string;
        open_delivery_status: string;
        resolution_delivery_status: string | null;
        resolution_delivery_error: string | null;
      }>(
        `SELECT status, open_delivery_status, resolution_delivery_status, resolution_delivery_error
         FROM billing_support_notifications WHERE alert_id = $1`,
        [alertId],
      );
      const row = result.rows[0];
      const openingFinished = row?.open_delivery_status !== "pending" && row?.open_delivery_status !== "sending";
      const resolutionFinished = expectedStatus !== "resolved"
        || (row?.resolution_delivery_status !== "pending" && row?.resolution_delivery_status !== "sending");
      if (row?.status === expectedStatus && openingFinished && resolutionFinished) {
        return row;
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Timed out waiting for billing support notification ${alertId} to become ${expectedStatus}`);
  };
  const server = spawn(process.execPath, [new URL("../dist/index.mjs", import.meta.url).pathname], {
    cwd: new URL("../../..", import.meta.url),
    env: {
      ...process.env,
      ADMIN_PASSWORD: `admin-password-${suffix}`,
      BILLING_MONITORING_SMOKE_SECRET: `billing-monitoring-smoke-secret-${suffix}`,
      SESSION_SECRET: `session-secret-${suffix}`,
      WEBSITE_BILLING_EVENTS_SECRET: secret,
      DEMO_MODE: "false",
      NODE_ENV: "test",
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(smtpPort),
      SMTP_SECURE: "false",
      SMTP_USER: "",
      SMTP_PASS: "",
      SUPPORT_EMAIL: "support-notification-test@example.test",
      BILLING_NOTIFICATION_TEST_SCOPE: suffix,
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const started = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("API test server did not start")), 15_000);
    const ready = (chunk: Buffer) => {
      if (chunk.toString().includes("Server listening")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    server.stdout.on("data", ready);
    server.stderr.on("data", ready);
    server.once("exit", (exitCode) => {
      clearTimeout(timeout);
      reject(new Error(`API test server exited with code ${exitCode}`));
    });
  });
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const learnerHeaders = () => ({ activationcode: sessionCode, deviceid: deviceId, userid: String(userId) });
  const event = (body: Record<string, unknown>, auth = secret, bearer = false) => fetch(`${baseUrl}/billing/subscription-events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(bearer ? { authorization: `Bearer ${auth}` } : { "x-website-billing-secret": auth }),
    },
    body: JSON.stringify(body),
  });
  const authMe = () => fetch(`${baseUrl}/auth/me`, { headers: learnerHeaders() });
  let userId = 0;
  let ambiguousUserId = 0;
  let sessionCode = code;
  let firstEnrollmentId = 0;
  let refresherEnrollmentId = 0;
  const oldCompletedAt = new Date("2024-06-01T00:00:00Z");
  const oldCertificateAt = new Date("2024-06-01T00:00:00Z");
  const renewalAnchor = new Date();
  let finalPaidThrough = renewalAnchor;

  try {
    await pool.query(
      `INSERT INTO billing_support_notifications (
         alert_id, alert_type, title, description, status, open_delivery_status,
         open_delivery_attempts, updated_at
       ) VALUES ($1, 'delivery_failure', 'Unrelated pending alert',
         'This row must not be changed by the subscription integration suite.',
         'open', 'pending', 0, '2020-01-01T00:00:00Z')`,
      [unrelatedPendingAlertId],
    );
    await started;
    const inserted = await pool.query<{ id: number }>(
      `INSERT INTO activation_codes (code, is_used) VALUES ($1, true)
       RETURNING id`,
      [code],
    );
    assert.equal(inserted.rowCount, 1);
    const user = await pool.query<{ id: number }>(
      `INSERT INTO users (
        activation_code, full_name, email, device_id, access_expires_at,
        course_completed_at, certificate_issued_at, current_enrollment_id
      ) VALUES ($1, 'Subscription Route Learner', $2, $3, $4, $5, $6, NULL)
      RETURNING id`,
      [code, email, deviceId, new Date("2024-12-31T00:00:00Z"), oldCompletedAt, oldCertificateAt],
    );
    userId = user.rows[0]!.id;
    const enrollment = await pool.query<{ id: number }>(
      `INSERT INTO course_enrolments (
        user_id, purchase_code, activation_code, activated_at, access_expires_at,
        course_completed_at, certificate_issued_at, status, access_type
      ) VALUES ($1, $2, $2, $3, $4, $5, $6, 'completed', 'paid')
      RETURNING id`,
      [userId, code, new Date("2024-06-01T00:00:00Z"), new Date("2024-12-31T00:00:00Z"), oldCompletedAt, oldCertificateAt],
    );
    firstEnrollmentId = enrollment.rows[0]!.id;
    await pool.query("UPDATE users SET current_enrollment_id = $1 WHERE id = $2", [firstEnrollmentId, userId]);
    await pool.query(
      `INSERT INTO user_progress (
        user_id, enrollment_id, module_id, video_completed, quiz_passed, quiz_score, last_timestamp
      ) VALUES ($1, $2, 999999, true, true, 100, 321)`,
      [userId, firstEnrollmentId],
    );

    const dormant = await authMe();
    assert.equal(dormant.status, 200);
    const dormantProfile = await dormant.json() as {
      accessStatus: string;
      subscription: { status: string; paidThroughAt: string | null };
      enrollmentId: number;
    };
    assert.equal(dormantProfile.accessStatus, "expired");
    assert.deepEqual(dormantProfile.subscription, { status: "inactive", paidThroughAt: null, cancelAtPeriodEnd: false });
    assert.deepEqual(Object.keys(dormantProfile.subscription).sort(), ["cancelAtPeriodEnd", "paidThroughAt", "status"]);
    assert.equal(dormantProfile.enrollmentId, firstEnrollmentId);

    assert.equal((await event({
      providerEventId: `bad-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test",
      learnerEmail: email,
      eventType: "subscription.activated",
      occurredAt: "2025-01-01T00:00:00Z",
      sequence: 1,
      status: "active",
      paidThroughAt: "2025-02-01T00:00:00Z",
    }, "wrong-secret")).status, 401);
    assert.equal((await event({
      providerEventId: `invalid-date-${suffix}`,
      provider: "test-provider",
      learnerEmail: email,
      eventType: "subscription.activated",
      occurredAt: "not-a-date",
      status: "active",
    })).status, 400);
    const invalidDateAttempt = await pool.query<{ outcome: string; event_occurred_at: Date | null }>(
      "SELECT outcome, event_occurred_at FROM subscription_delivery_attempts WHERE provider_event_id = $1",
      [`invalid-date-${suffix}`],
    );
    assert.deepEqual(invalidDateAttempt.rows[0], { outcome: "invalid_date", event_occurred_at: null });
    assert.equal((await event({
      providerEventId: `invalid-payload-${suffix}`,
      provider: "test-provider",
      learnerEmail: email,
      eventType: "subscription.activated",
      occurredAt: new Date().toISOString(),
      // status is deliberately omitted to exercise authenticated parse failure.
    })).status, 400);
    const invalidPayloadAttempt = await pool.query<{ outcome: string; event_occurred_at: Date | null }>(
      "SELECT outcome, event_occurred_at FROM subscription_delivery_attempts WHERE provider_event_id = $1",
      [`invalid-payload-${suffix}`],
    );
    assert.equal(invalidPayloadAttempt.rows[0]?.outcome, "invalid_payload");
    assert.ok(invalidPayloadAttempt.rows[0]?.event_occurred_at instanceof Date);

    // A five-year run of monthly renewals exercises the provider ordering
    // cursor and keeps the subscription independent from the old enrolment.
    for (let sequence = 1; sequence <= 60; sequence += 1) {
      const paidThrough = addCalendarMonthsUtc(renewalAnchor, sequence);
      finalPaidThrough = paidThrough;
      const response = await event({
        providerEventId: `renewal-${suffix}-${sequence}`,
        provider: "test-provider",
        providerCustomerId: "cus-test",
        providerSubscriptionId: "sub-test",
        learnerEmail: email,
        eventType: sequence === 1 ? "subscription.activated" : "invoice.paid",
        occurredAt: new Date(renewalAnchor.getTime() + sequence * 1_000).toISOString(),
        sequence,
        status: "active",
        paidThroughAt: paidThrough.toISOString(),
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json() as { applied: boolean }).applied, true);
    }
    const concurrentHighPaidThrough = addCalendarMonthsUtc(renewalAnchor, 62);
    const concurrentLowPaidThrough = addCalendarMonthsUtc(renewalAnchor, 61);
    const [concurrentHigh, concurrentLow] = await Promise.all([
      event({
        providerEventId: `concurrent-high-${suffix}`,
        provider: "test-provider",
        providerCustomerId: "cus-test",
        providerSubscriptionId: "sub-test",
        eventType: "subscription.renewed",
        occurredAt: new Date(renewalAnchor.getTime() + 62_000).toISOString(),
        sequence: 62,
        status: "active",
        paidThroughAt: concurrentHighPaidThrough.toISOString(),
      }, secret, true),
      event({
        providerEventId: `concurrent-low-${suffix}`,
        provider: "test-provider",
        providerCustomerId: "cus-test",
        providerSubscriptionId: "sub-test",
        eventType: "subscription.renewed",
        occurredAt: new Date(renewalAnchor.getTime() + 61_000).toISOString(),
        sequence: 61,
        status: "active",
        paidThroughAt: concurrentLowPaidThrough.toISOString(),
      }),
    ]);
    assert.equal(concurrentHigh.status, 200);
    assert.equal(concurrentLow.status, 200);
    finalPaidThrough = concurrentHighPaidThrough;
    const concurrentState = await pool.query<{ last_event_sequence: number; paid_through_at: Date }>(
      "SELECT last_event_sequence, paid_through_at FROM learner_subscriptions WHERE user_id = $1",
      [userId],
    );
    assert.equal(concurrentState.rows[0]?.last_event_sequence, 62);
    assert.equal(concurrentState.rows[0]?.paid_through_at.toISOString(), concurrentHighPaidThrough.toISOString());
    const duplicate = await event({
      providerEventId: `renewal-${suffix}-60`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test",
      eventType: "invoice.paid",
      occurredAt: new Date(renewalAnchor.getTime() + 60_000).toISOString(),
      sequence: 60,
      status: "active",
      paidThroughAt: finalPaidThrough.toISOString(),
    });
    assert.deepEqual(await duplicate.json(), { accepted: true, duplicate: true, applied: false });

    const delayed = await event({
      providerEventId: `delayed-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test",
      eventType: "payment.failed",
      occurredAt: new Date(renewalAnchor.getTime() + 59_500).toISOString(),
      sequence: 59,
      status: "past_due",
      paidThroughAt: null,
    });
    assert.deepEqual(await delayed.json(), { accepted: true, duplicate: false, applied: false });

    const cancellation = await event({
      providerEventId: `cancel-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test",
      eventType: "subscription.cancelled",
      occurredAt: new Date(renewalAnchor.getTime() + 63_000).toISOString(),
      sequence: 63,
      status: "cancelled",
      cancelAtPeriodEnd: true,
    });
    assert.deepEqual(await cancellation.json(), { accepted: true, duplicate: false, applied: true });
    const failure = await event({
      providerEventId: `failure-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test",
      eventType: "payment.failed",
      occurredAt: new Date(renewalAnchor.getTime() + 64_000).toISOString(),
      sequence: 64,
      status: "past_due",
    });
    assert.deepEqual(await failure.json(), { accepted: true, duplicate: false, applied: true });

    const restored = await authMe();
    assert.equal(restored.status, 200);
    const restoredProfile = await restored.json() as { accessStatus: string; subscription: { status: string; paidThroughAt: string | null } };
    assert.equal(restoredProfile.accessStatus, "active");
    assert.equal(restoredProfile.subscription.status, "past_due");
    assert.equal(restoredProfile.subscription.paidThroughAt, finalPaidThrough.toISOString());

    // Once a canonical subscription exists, its terminal null paid-through is
    // authoritative and must not fall back to a stale future legacy extension.
    await pool.query(
      "UPDATE users SET subscription_expires_at = $1 WHERE id = $2",
      [addCalendarMonthsUtc(finalPaidThrough, 12), userId],
    );
    const ended = await event({
      providerEventId: `ended-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test",
      eventType: "subscription.ended",
       occurredAt: new Date(renewalAnchor.getTime() + 65_000).toISOString(),
       sequence: 65,
      status: "expired",
      paidThroughAt: null,
    });
    assert.deepEqual(await ended.json(), { accepted: true, duplicate: false, applied: true });
    const endedMe = await authMe();
    assert.equal(endedMe.status, 200);
    assert.equal((await endedMe.json() as { accessStatus: string }).accessStatus, "expired");
    assert.equal((await fetch(`${baseUrl}/modules`, { headers: learnerHeaders() })).status, 403);

    // A later paid refresher uses the real activation flow. The local
    // Shopify-verified marker avoids any external provider call.
    await pool.query(
      `INSERT INTO activation_codes (code, is_used, assigned_to, notes)
       VALUES ($1, false, $2, $3)`,
      [refreshCode, email, `Shopify order id refresh-${suffix} | Shopify order #refresh-${suffix}`],
    );
    const activationResponse = await fetch(`${baseUrl}/auth/activate`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: refreshCode,
        deviceId,
        fullName: "Subscription Route Learner",
        email,
      }),
    });
    assert.equal(activationResponse.status, 200);
    const activationResult = await activationResponse.json() as {
      success: boolean;
      userId: number;
      enrollmentId: number;
    };
    assert.equal(activationResult.success, true);
    assert.equal(activationResult.userId, userId);
    assert.notEqual(activationResult.enrollmentId, firstEnrollmentId);
    refresherEnrollmentId = activationResult.enrollmentId;
    sessionCode = refreshCode;
    const newLifecyclePaidThrough = addCalendarMonthsUtc(finalPaidThrough, 5);
    const newLifecycle = await event({
      providerEventId: `refresher-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test-new",
      eventType: "subscription.renewed",
      occurredAt: new Date(renewalAnchor.getTime() + 66_000).toISOString(),
      sequence: 1,
      status: "active",
      paidThroughAt: newLifecyclePaidThrough.toISOString(),
    });
    assert.deepEqual(await newLifecycle.json(), { accepted: true, duplicate: false, applied: true });
    const refresherMe = await authMe();
    assert.equal(refresherMe.status, 200);
    const refresherProfile = await refresherMe.json() as { accessStatus: string; enrollmentId: number };
    assert.equal(refresherProfile.accessStatus, "active");
    assert.equal(refresherProfile.enrollmentId, refresherEnrollmentId);

    // The old lifecycle is immutable history now. Even a higher sequence
    // delivered after the new sequence-one activation cannot overwrite it.
    const delayedRetiredLifecycle = await event({
      providerEventId: `delayed-retired-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test",
      eventType: "subscription.renewed",
      occurredAt: new Date(renewalAnchor.getTime() + 67_000).toISOString(),
      sequence: 66,
      status: "active",
      paidThroughAt: addCalendarMonthsUtc(finalPaidThrough, 12).toISOString(),
    });
    assert.deepEqual(await delayedRetiredLifecycle.json(), { accepted: true, duplicate: false, applied: false });

    const partialRefund = await event({
      providerEventId: `partial-refund-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test-new",
      eventType: "subscription.refunded",
      occurredAt: new Date(renewalAnchor.getTime() + 68_000).toISOString(),
      sequence: 2,
      status: "refunded",
    });
    assert.deepEqual(await partialRefund.json(), { accepted: true, duplicate: false, applied: true });
    const partialRefundState = await pool.query<{ paid_through_at: Date }>(
      "SELECT paid_through_at FROM learner_subscriptions WHERE user_id = $1",
      [userId],
    );
    assert.equal(partialRefundState.rows[0]?.paid_through_at.toISOString(), newLifecyclePaidThrough.toISOString());

    // Only explicit full refunds and reversals remove the subscription-derived
    // entitlement. The paid course enrolment remains usable.
    const refund = await event({
      providerEventId: `refund-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test-new",
      eventType: "subscription.full_refund",
      occurredAt: new Date(renewalAnchor.getTime() + 68_500).toISOString(),
      sequence: 3,
      status: "fully_refunded",
      paidThroughAt: null,
    });
    assert.deepEqual(await refund.json(), { accepted: true, duplicate: false, applied: true });
    const refundedProfile = await (await authMe()).json() as {
      accessStatus: string;
      subscription: { status: string; paidThroughAt: string | null };
    };
    assert.equal(refundedProfile.accessStatus, "active");
    assert.deepEqual(refundedProfile.subscription, { status: "fully_refunded", paidThroughAt: null, cancelAtPeriodEnd: false });

    const reversal = await event({
      providerEventId: `reversal-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test-new",
      eventType: "payment.reversed",
      occurredAt: new Date(renewalAnchor.getTime() + 69_000).toISOString(),
      sequence: 4,
      status: "reversed",
      paidThroughAt: null,
    });
    assert.deepEqual(await reversal.json(), { accepted: true, duplicate: false, applied: true });
    const outOfOrder = await event({
      providerEventId: `out-of-order-current-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test-new",
      eventType: "subscription.renewed",
      occurredAt: new Date(renewalAnchor.getTime() + 70_000).toISOString(),
      sequence: 1,
      status: "active",
      paidThroughAt: newLifecyclePaidThrough.toISOString(),
    });
    assert.deepEqual(await outOfOrder.json(), { accepted: true, duplicate: false, applied: false });

    const resubscriptionPaidThrough = addCalendarMonthsUtc(finalPaidThrough, 7);
    const resubscription = await event({
      providerEventId: `resubscription-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test-resubscription",
      eventType: "subscription.activated",
      occurredAt: new Date(renewalAnchor.getTime() + 71_000).toISOString(),
      sequence: 1,
      status: "active",
      paidThroughAt: resubscriptionPaidThrough.toISOString(),
    });
    assert.deepEqual(await resubscription.json(), { accepted: true, duplicate: false, applied: true });
    const delayedAfterResubscription = await event({
      providerEventId: `delayed-retired-after-resubscription-${suffix}`,
      provider: "test-provider",
      providerSubscriptionId: "sub-test",
      eventType: "subscription.ended",
      occurredAt: new Date(renewalAnchor.getTime() + 72_000).toISOString(),
      sequence: 67,
      status: "expired",
      paidThroughAt: null,
    });
    assert.deepEqual(await delayedAfterResubscription.json(), { accepted: true, duplicate: false, applied: false });

    const preserved = await pool.query<{ device_id: string }>("SELECT device_id FROM users WHERE id = $1", [userId]);
    assert.equal(preserved.rows[0]?.device_id, deviceId);
    const oldEvidence = await pool.query<{ course_completed_at: Date; certificate_issued_at: Date }>(
      "SELECT course_completed_at, certificate_issued_at FROM course_enrolments WHERE id = $1",
      [firstEnrollmentId],
    );
    assert.equal(oldEvidence.rows[0]?.course_completed_at.toISOString(), oldCompletedAt.toISOString());
    assert.equal(oldEvidence.rows[0]?.certificate_issued_at.toISOString(), oldCertificateAt.toISOString());
    const oldProgress = await pool.query<{ enrollment_id: number; video_completed: boolean; quiz_passed: boolean; last_timestamp: number }>(
      "SELECT enrollment_id, video_completed, quiz_passed, last_timestamp FROM user_progress WHERE user_id = $1 AND enrollment_id = $2",
      [userId, firstEnrollmentId],
    );
    assert.deepEqual(oldProgress.rows[0], {
      enrollment_id: firstEnrollmentId,
      video_completed: true,
      quiz_passed: true,
      last_timestamp: 321,
    });
    assert.equal((await authMe()).status, 200);
    assert.equal((await fetch(`${baseUrl}/auth/me`, {
      headers: { activationcode: refreshCode, deviceid: `${deviceId}-other`, userid: String(userId) },
    })).status, 401);

    const duplicateEmailUser = await pool.query<{ id: number }>(
      `INSERT INTO users (activation_code, full_name, email, device_id, access_expires_at)
       VALUES ($1, 'Duplicate Email Learner', $2, $3, CURRENT_TIMESTAMP + INTERVAL '1 year')
       RETURNING id`,
      [`AMBIGUOUS-${suffix}`, email.toUpperCase(), `ambiguous-device-${suffix}`],
    );
    ambiguousUserId = duplicateEmailUser.rows[0]!.id;
    const ambiguousEvent = await event({
      providerEventId: `ambiguous-${suffix}`,
      provider: "test-provider",
      learnerEmail: email,
      eventType: "subscription.activated",
      occurredAt: new Date().toISOString(),
      status: "active",
      paidThroughAt: addCalendarMonthsUtc(finalPaidThrough, 6).toISOString(),
    });
    assert.equal(ambiguousEvent.status, 409);
    const explicitLearnerEvent = await event({
      providerEventId: `explicit-learner-${suffix}`,
      provider: "test-provider",
      learnerId: ambiguousUserId,
      learnerEmail: email.toUpperCase(),
      eventType: "subscription.activated",
      occurredAt: new Date().toISOString(),
      status: "active",
      paidThroughAt: addCalendarMonthsUtc(finalPaidThrough, 6).toISOString(),
    });
    assert.equal(explicitLearnerEvent.status, 200);
    const mismatchedLearnerEvent = await event({
      providerEventId: `mismatched-learner-${suffix}`,
      provider: "test-provider",
      learnerId: ambiguousUserId,
      learnerEmail: `other-${suffix}@example.test`,
      eventType: "subscription.activated",
      occurredAt: new Date().toISOString(),
      status: "active",
      paidThroughAt: addCalendarMonthsUtc(finalPaidThrough, 6).toISOString(),
    });
    assert.equal(mismatchedLearnerEvent.status, 400);

    const adminLogin = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: `admin-password-${suffix}` }),
    });
    assert.equal(adminLogin.status, 200);
    const adminToken = (await adminLogin.json() as { token: string }).token;
    const billingAlerts = () => fetch(`${baseUrl}/admin/billing-alerts`, { headers: { admintoken: adminToken } });

    assert.equal((await fetch(`${baseUrl}/admin/billing-monitoring-smoke`, {
      method: "POST",
    })).status, 401);
    assert.equal((await fetch(`${baseUrl}/admin/billing-monitoring-smoke`, {
      method: "POST",
      headers: { admintoken: adminToken },
    })).status, 401);
    assert.equal((await fetch(`${baseUrl}/admin/billing-alerts`, {
      headers: { billingmonitoringtoken: `billing-monitoring-smoke-secret-${suffix}` },
    })).status, 401);
    const accessBeforeSmoke = await pool.query<{
      subscription_count: string;
      enrolment_count: string;
      access_expires_at: Date;
    }>(
      `SELECT
         (SELECT count(*) FROM learner_subscriptions WHERE user_id = $1)::text AS subscription_count,
         (SELECT count(*) FROM course_enrolments WHERE user_id = $1)::text AS enrolment_count,
         access_expires_at
       FROM users WHERE id = $1`,
      [userId],
    );
    const smokeResponse = await fetch(`${baseUrl}/admin/billing-monitoring-smoke`, {
      method: "POST",
      headers: { billingmonitoringtoken: `billing-monitoring-smoke-secret-${suffix}` },
    });
    assert.equal(smokeResponse.status, 200);
    assert.deepEqual(await smokeResponse.json(), {
      schema: "ok",
      alertOpened: true,
      alertCleared: true,
      retainedRows: 0,
    });
    const retainedSmokeRows = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM subscription_delivery_attempts WHERE provider = 'release-smoke'",
    );
    assert.equal(retainedSmokeRows.rows[0]?.count, "0");
    const accessAfterSmoke = await pool.query<{
      subscription_count: string;
      enrolment_count: string;
      access_expires_at: Date;
    }>(
      `SELECT
         (SELECT count(*) FROM learner_subscriptions WHERE user_id = $1)::text AS subscription_count,
         (SELECT count(*) FROM course_enrolments WHERE user_id = $1)::text AS enrolment_count,
         access_expires_at
       FROM users WHERE id = $1`,
      [userId],
    );
    assert.deepEqual(accessAfterSmoke.rows[0], accessBeforeSmoke.rows[0]);

    for (let allowedAttempt = 0; allowedAttempt < 2; allowedAttempt += 1) {
      const repeatedSmokeResponse = await fetch(`${baseUrl}/admin/billing-monitoring-smoke`, {
        method: "POST",
        headers: { billingmonitoringtoken: `billing-monitoring-smoke-secret-${suffix}` },
      });
      assert.equal(repeatedSmokeResponse.status, 200);
    }
    const rateLimitedSmokeResponse = await fetch(`${baseUrl}/admin/billing-monitoring-smoke`, {
      method: "POST",
      headers: { billingmonitoringtoken: `billing-monitoring-smoke-secret-${suffix}` },
    });
    assert.equal(rateLimitedSmokeResponse.status, 429);
    assert.match(rateLimitedSmokeResponse.headers.get("retry-after") ?? "", /^\d+$/);
    assert.deepEqual(await rateLimitedSmokeResponse.json(), {
      error: "Too many billing monitoring smoke checks",
    });
    const retainedRowsAfterRateLimit = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM subscription_delivery_attempts WHERE provider = 'release-smoke'",
    );
    assert.equal(retainedRowsAfterRateLimit.rows[0]?.count, "0");
    assert.equal((await billingAlerts()).status, 200);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const ambiguousRetry = await event({
        providerEventId: `ambiguous-retry-${suffix}`,
        provider: "test-provider",
        learnerEmail: email,
        eventType: "subscription.activated",
        occurredAt: new Date(Date.now() + attempt * 1000).toISOString(),
        status: "active",
      });
      assert.equal(ambiguousRetry.status, 409);
    }
    await waitForNotification(`ambiguous-match:test-provider:ambiguous-retry-${suffix}`, "open");
    const ambiguousAlerts = await (await billingAlerts()).json() as {
      type: string;
      providerEventId: string | null;
      supportNotification: { status: string; deliveryStatus: string; deliveryError: string | null } | null;
    }[];
    const ambiguousAlert = ambiguousAlerts.find((alert) =>
      alert.type === "ambiguous_match" && alert.providerEventId === `ambiguous-retry-${suffix}`);
    assert.ok(ambiguousAlert);
    assert.deepEqual(ambiguousAlert.supportNotification, {
      status: "open",
      deliveryStatus: "sent",
      deliveryError: null,
    });
    const ambiguousNotification = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM billing_support_notifications WHERE alert_id = $1",
      [`ambiguous-match:test-provider:ambiguous-retry-${suffix}`],
    );
    assert.equal(ambiguousNotification.rows[0]?.count, "1");
    const ambiguousRecovery = await event({
      providerEventId: `ambiguous-retry-${suffix}`,
      provider: "test-provider",
      learnerId: ambiguousUserId,
      learnerEmail: email,
      eventType: "subscription.activated",
      occurredAt: new Date().toISOString(),
      status: "active",
    });
    assert.equal(ambiguousRecovery.status, 200);
    const recoveredAmbiguousAlerts = await (await billingAlerts()).json() as { type: string; providerEventId: string | null }[];
    assert.ok(!recoveredAmbiguousAlerts.some((alert) => alert.providerEventId === `ambiguous-retry-${suffix}`));
    const recoveredAmbiguousNotification = await waitForNotification(
      `ambiguous-match:test-provider:ambiguous-retry-${suffix}`,
      "resolved",
    );
    assert.equal(recoveredAmbiguousNotification.resolution_delivery_status, "sent");
    assert.equal(recoveredAmbiguousNotification.resolution_delivery_error, null);
    const supportNotificationResponse = await fetch(`${baseUrl}/admin/billing-support-notifications`, {
      headers: { admintoken: adminToken },
    });
    assert.equal(supportNotificationResponse.status, 200);
    const supportNotifications = await supportNotificationResponse.json() as {
      notificationId: number;
      alertType: string;
      learnerId: number | null;
      title: string;
      status: string;
      resolutionDeliveryStatus: string | null;
      resolutionDeliveryError: string | null;
      providerEventId?: string;
    }[];
    const visibleRecoveryFailure = supportNotifications.find((row) =>
      row.alertType === "ambiguous_match" && row.title === "Ambiguous learner match");
    assert.equal(visibleRecoveryFailure?.status, "resolved");
    assert.equal(visibleRecoveryFailure?.resolutionDeliveryStatus, "sent");
    assert.equal(visibleRecoveryFailure?.resolutionDeliveryError, null);
    assert.equal("providerEventId" in (visibleRecoveryFailure ?? {}), false);
    assert.equal(
      JSON.stringify(supportNotifications).includes(`ambiguous-retry-${suffix}`),
      false,
      "support history must not expose provider event IDs in any response value",
    );

    const repeatedEmailStart = deliveredMessages.length;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const repeatedFailure = await event({
        providerEventId: `repeated-failure-${suffix}`,
        provider: "test-provider",
        eventType: "subscription.activated",
        occurredAt: new Date(Date.now() + attempt * 1000).toISOString(),
        status: "active",
      });
      assert.equal(repeatedFailure.status, 404);
    }
    holdRepeatedOpening = true;
    const concurrentFailures = await Promise.all([
      event({
        providerEventId: `repeated-failure-${suffix}`,
        provider: "test-provider",
        eventType: "subscription.activated",
        occurredAt: new Date().toISOString(),
        status: "active",
      }),
      event({
        providerEventId: `repeated-failure-${suffix}`,
        provider: "test-provider",
        eventType: "subscription.activated",
        occurredAt: new Date().toISOString(),
        status: "active",
      }),
    ]);
    assert.deepEqual(concurrentFailures.map((response) => response.status), [404, 404]);
    await Promise.race([
      repeatedOpeningSeen,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timed out waiting for the opening email to enter SMTP delivery")), 5_000)),
    ]);
    const concurrentRecoveries = await Promise.all([
      event({
        providerEventId: `repeated-failure-${suffix}`,
        provider: "test-provider",
        learnerId: userId,
        learnerEmail: email,
        eventType: "subscription.activated",
        occurredAt: new Date().toISOString(),
        status: "active",
      }),
      event({
        providerEventId: `repeated-failure-${suffix}`,
        provider: "test-provider",
        learnerId: userId,
        learnerEmail: email,
        eventType: "subscription.activated",
        occurredAt: new Date().toISOString(),
        status: "active",
      }),
    ]);
    assert.deepEqual(concurrentRecoveries.map((response) => response.status), [200, 200]);
    holdRepeatedOpening = false;
    releaseRepeatedOpening();
    const resolvedRepeatedFailure = await waitForNotification(repeatedAlertId, "resolved");
    const repeatedFailureAlerts = await (await billingAlerts()).json() as { type: string; providerEventId: string | null }[];
    assert.ok(!repeatedFailureAlerts.some((alert) => alert.providerEventId === `repeated-failure-${suffix}`));
    const repeatedFailureNotification = await pool.query<{
      count: string;
      open_delivery_status: string;
      open_delivery_attempts: number;
      resolution_delivery_status: string | null;
      resolution_delivery_attempts: number;
    }>(
      `SELECT count(*)::text AS count, max(open_delivery_status) AS open_delivery_status,
              max(open_delivery_attempts) AS open_delivery_attempts,
              max(resolution_delivery_status) AS resolution_delivery_status,
              max(resolution_delivery_attempts) AS resolution_delivery_attempts
       FROM billing_support_notifications WHERE alert_id = $1`,
      [repeatedAlertId],
    );
    assert.deepEqual(repeatedFailureNotification.rows[0], {
      count: "1",
      open_delivery_status: "sent",
      open_delivery_attempts: 1,
      resolution_delivery_status: "sent",
      resolution_delivery_attempts: 1,
    });
    await waitForDeliveredSubjects(repeatedEmailStart + 1);
    const repeatedAlertTitle = (await pool.query<{ title: string }>(
      "SELECT title FROM billing_support_notifications WHERE alert_id = $1",
      [repeatedAlertId],
    )).rows[0]!.title;
    const repeatedAlertSubjects = () => deliveredMessages
      .slice(repeatedEmailStart)
      .filter((message) => message.includes(`Support reference ${repeatedSupportReference}`))
      .map((message) => message.match(/^Subject:\s*(.+)$/mi)?.[1]?.trim());
    assert.equal(resolvedRepeatedFailure.resolution_delivery_status, "sent");
    await waitForDeliveredSubjects(repeatedEmailStart + 2);
    assert.deepEqual(repeatedAlertSubjects(), [
      `[Billing alert Urgent] ${repeatedAlertTitle}`,
      `[Billing alert Resolved] ${repeatedAlertTitle}`,
    ]);
    const recurringFailures = await Promise.all(Array.from({ length: 3 }, (_, attempt) => event({
      providerEventId: `repeated-failure-${suffix}`,
      provider: "test-provider",
      eventType: "subscription.activated",
      occurredAt: new Date(Date.now() + attempt).toISOString(),
    })));
    assert.deepEqual(recurringFailures.map((response) => response.status), [400, 400, 400]);
    await waitForNotification(repeatedAlertId, "open");
    await waitForDeliveredSubjects(repeatedEmailStart + 3);
    assert.deepEqual(repeatedAlertSubjects(), [
      `[Billing alert Urgent] ${repeatedAlertTitle}`,
      `[Billing alert Resolved] ${repeatedAlertTitle}`,
      `[Billing alert Urgent] ${repeatedAlertTitle}`,
    ]);
    const recurringNotification = await pool.query<{
      count: string;
      open_delivery_status: string;
      open_delivery_attempts: number;
      resolution_delivery_status: string | null;
      resolution_delivery_attempts: number;
    }>(
      `SELECT count(*)::text AS count, max(open_delivery_status) AS open_delivery_status,
              max(open_delivery_attempts) AS open_delivery_attempts,
              max(resolution_delivery_status) AS resolution_delivery_status,
              max(resolution_delivery_attempts) AS resolution_delivery_attempts
       FROM billing_support_notifications WHERE alert_id = $1`,
      [repeatedAlertId],
    );
    assert.deepEqual(recurringNotification.rows[0], {
      count: "1",
      open_delivery_status: "sent",
      open_delivery_attempts: 1,
      resolution_delivery_status: null,
      resolution_delivery_attempts: 0,
    });
    const unrelatedPendingAfterReconciliation = await pool.query<{
      status: string;
      open_delivery_status: string;
      open_delivery_attempts: number;
      updated_at: Date;
    }>(
      `SELECT status, open_delivery_status, open_delivery_attempts, updated_at
       FROM billing_support_notifications WHERE alert_id = $1`,
      [unrelatedPendingAlertId],
    );
    assert.deepEqual(unrelatedPendingAfterReconciliation.rows[0], {
      status: "open",
      open_delivery_status: "pending",
      open_delivery_attempts: 0,
      updated_at: new Date("2020-01-01T00:00:00.000Z"),
    });

    const filterFixturePrefix = `filter-test-${suffix}`;
    await pool.query(
      `INSERT INTO billing_support_notifications (
         alert_id, alert_type, title, description, status, open_delivery_status,
         open_delivery_error, resolution_delivery_status, resolution_delivery_error
       ) VALUES
         ($1, 'filter_test', 'Open delivered', 'Filter test', 'open', 'sent', NULL, NULL, NULL),
         ($2, 'filter_test', 'Open failed', 'Filter test', 'open', 'failed', 'mailbox_unavailable', NULL, NULL),
         ($3, 'filter_test', 'Resolved delivered', 'Filter test', 'resolved', 'sent', NULL, 'sent', NULL),
         ($4, 'filter_test', 'Resolved exhausted', 'Filter test', 'resolved', 'sent', NULL, 'retry_pending', 'retry_exhausted')`,
      [
        `${filterFixturePrefix}-open-delivered`,
        `${filterFixturePrefix}-open-failed`,
        `${filterFixturePrefix}-resolved-delivered`,
        `${filterFixturePrefix}-resolved-exhausted`,
      ],
    );
    const filteredHistory = async (query: string) => {
      const response = await fetch(`${baseUrl}/admin/billing-support-notifications?${query}`, {
        headers: { admintoken: adminToken },
      });
      return {
        response,
        rows: response.status === 200
          ? await response.json() as { title: string; status: string; providerEventId?: string }[]
          : [],
      };
    };
    const failedHistory = await filteredHistory("deliveryOutcome=failed_or_exhausted");
    assert.equal(failedHistory.response.status, 200);
    assert.deepEqual(
      failedHistory.rows.filter((row) => row.title.startsWith("Open failed") || row.title.startsWith("Resolved exhausted"))
        .map((row) => row.title)
        .sort(),
      ["Open failed", "Resolved exhausted"],
    );
    const deliveredHistory = await filteredHistory("deliveryOutcome=delivered");
    assert.equal(deliveredHistory.response.status, 200);
    assert.deepEqual(
      deliveredHistory.rows.filter((row) => row.title.includes("delivered")).map((row) => row.title).sort(),
      ["Open delivered", "Resolved delivered"],
    );
    const pendingOpenHistory = await filteredHistory("deliveryOutcome=pending&incidentStatus=open");
    assert.equal(pendingOpenHistory.response.status, 200);
    assert.ok(pendingOpenHistory.rows.some((row) => row.title === "Unrelated pending alert"));
    assert.ok(pendingOpenHistory.rows.every((row) => row.status === "open"));
    const resolvedFailureHistory = await filteredHistory("deliveryOutcome=failed_or_exhausted&incidentStatus=resolved");
    assert.equal(resolvedFailureHistory.response.status, 200);
    assert.ok(resolvedFailureHistory.rows.some((row) => row.title === "Resolved exhausted"));
    assert.ok(resolvedFailureHistory.rows.every((row) => row.status === "resolved"));
    assert.equal(
      (await filteredHistory("deliveryOutcome=unknown")).response.status,
      400,
    );
    assert.ok(
      [...failedHistory.rows, ...deliveredHistory.rows, ...pendingOpenHistory.rows, ...resolvedFailureHistory.rows]
        .every((row) => !("providerEventId" in row)),
    );

    const detailResponse = await fetch(`${baseUrl}/admin/students/${userId}`, { headers: { admintoken: adminToken } });
    assert.equal(detailResponse.status, 200);
    const detail = await detailResponse.json() as {
      subscription: { status: string; paidThroughAt: string | null };
      enrollments: { enrollmentId: number; isCurrent: boolean }[];
      subscriptionHistory: { providerEventId: string }[];
      deliveryAttempts: { outcome: string }[];
    };
    assert.equal(detail.subscription.status, "active");
    assert.equal(detail.subscription.paidThroughAt, resubscriptionPaidThrough.toISOString());
    assert.equal(detail.enrollments.find((row) => row.isCurrent)?.enrollmentId, refresherEnrollmentId);
    assert.equal(detail.enrollments.find((row) => row.enrollmentId === firstEnrollmentId)?.isCurrent, false);
    assert.ok(detail.subscriptionHistory.length >= 1);
    assert.ok(detail.deliveryAttempts.some((attempt) => attempt.outcome === "duplicate"));
    assert.ok(detail.deliveryAttempts.some((attempt) => attempt.outcome === "ambiguous_learner"));

    const repairUrl = `${baseUrl}/admin/students/${userId}/subscription-repair`;
    await pool.query(
      `UPDATE learner_subscriptions
       SET provider = 'corrupted-provider', provider_customer_id = 'corrupted-customer',
           provider_subscription_id = 'corrupted-subscription', status = 'expired',
           paid_through_at = NULL, cancel_at_period_end = false,
           last_event_occurred_at = '2000-01-01T00:00:00Z', last_event_sequence = NULL
       WHERE user_id = $1`,
      [userId],
    );
    const repair = await fetch(repairUrl, { method: "POST", headers: { admintoken: adminToken } });
    assert.equal(repair.status, 200);
    const repairAgain = await fetch(repairUrl, { method: "POST", headers: { admintoken: adminToken } });
    assert.equal(repairAgain.status, 200);
    const repairedDetail = await (await fetch(`${baseUrl}/admin/students/${userId}`, { headers: { admintoken: adminToken } })).json() as {
      subscription: { provider: string; providerCustomerId: string | null; providerSubscriptionId: string | null; status: string; paidThroughAt: string | null };
      enrollments: { enrollmentId: number; isCurrent: boolean; certificateIssuedAt: string | null }[];
    };
    assert.equal(repairedDetail.subscription.provider, "test-provider");
    assert.equal(repairedDetail.subscription.providerCustomerId, "cus-test");
    assert.equal(repairedDetail.subscription.providerSubscriptionId, "sub-test-resubscription");
    assert.equal(repairedDetail.subscription.status, "active");
    assert.equal(repairedDetail.subscription.paidThroughAt, addCalendarMonthsUtc(finalPaidThrough, 7).toISOString());
    assert.equal(repairedDetail.enrollments.find((row) => row.enrollmentId === firstEnrollmentId)?.certificateIssuedAt, oldCertificateAt.toISOString());
    assert.equal(repairedDetail.enrollments.find((row) => row.isCurrent)?.enrollmentId, refresherEnrollmentId);

    const nearExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const nearExpiryEvent = await event({
      providerEventId: `near-expiry-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test-resubscription",
      learnerId: userId,
      learnerEmail: email,
      eventType: "invoice.paid",
      occurredAt: new Date().toISOString(),
      sequence: 4,
      status: "active",
      paidThroughAt: nearExpiry.toISOString(),
    });
    assert.equal(nearExpiryEvent.status, 200);
    const expiryAlerts = await (await billingAlerts()).json() as { type: string; userId: number | null }[];
    assert.ok(expiryAlerts.some((alert) => alert.type === "expiry_without_renewal" && alert.userId === userId));
    const renewedPaidThrough = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const renewed = await event({
      providerEventId: `renewed-after-near-expiry-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test-resubscription",
      learnerId: userId,
      learnerEmail: email,
      eventType: "invoice.paid",
      occurredAt: new Date(Date.now() + 1000).toISOString(),
      sequence: 5,
      status: "active",
      paidThroughAt: renewedPaidThrough.toISOString(),
    });
    assert.equal(renewed.status, 200);
    const renewedAlerts = await (await billingAlerts()).json() as { type: string; userId: number | null }[];
    assert.ok(!renewedAlerts.some((alert) => alert.type === "expiry_without_renewal" && alert.userId === userId));

    const omittedTerminal = await event({
      providerEventId: `terminal-without-paid-through-${suffix}`,
      provider: "test-provider",
      providerCustomerId: "cus-test",
      providerSubscriptionId: "sub-test-resubscription",
      learnerId: userId,
      learnerEmail: email,
      eventType: "subscription.ended",
      occurredAt: new Date(Date.now() + 2000).toISOString(),
      sequence: 6,
      status: "expired",
    });
    assert.equal(omittedTerminal.status, 200);
    const liveOmittedTerminal = await pool.query<{ paid_through_at: Date }>(
      "SELECT paid_through_at FROM learner_subscriptions WHERE user_id = $1",
      [userId],
    );
    assert.equal(liveOmittedTerminal.rows[0]?.paid_through_at.toISOString(), renewedPaidThrough.toISOString());
    await pool.query("UPDATE learner_subscriptions SET paid_through_at = NULL WHERE user_id = $1", [userId]);
    assert.equal((await fetch(repairUrl, { method: "POST", headers: { admintoken: adminToken } })).status, 200);
    const omittedTerminalRepair = await pool.query<{ paid_through_at: Date }>(
      "SELECT paid_through_at FROM learner_subscriptions WHERE user_id = $1",
      [userId],
    );
    assert.equal(omittedTerminalRepair.rows[0]?.paid_through_at.toISOString(), renewedPaidThrough.toISOString());

    await pool.query(
      `INSERT INTO subscription_delivery_attempts (
        provider_event_id, provider, learner_id, learner_email, event_type, event_occurred_at,
        outcome, http_status
      ) VALUES ($1, 'test-provider', NULL, $2, 'subscription.activated', NULL, 'invalid_learner', 400)`,
      [`email-cleanup-${suffix}`, email.toUpperCase()],
    );
    const selfDelete = await fetch(`${baseUrl}/auth/delete-account`, { method: "DELETE", headers: learnerHeaders() });
    assert.equal(selfDelete.status, 200);
    const selfDeleteRows = await pool.query<{ subscriptions: string; events: string; attempts: string }>(
      `SELECT
        (SELECT count(*) FROM learner_subscriptions WHERE user_id = $1)::text AS subscriptions,
        (SELECT count(*) FROM subscription_billing_events WHERE user_id = $1)::text AS events,
        (SELECT count(*) FROM subscription_delivery_attempts
          WHERE learner_id = $1 OR provider_event_id = $2 OR lower(learner_email) = lower($3))::text AS attempts`,
      [userId, `email-cleanup-${suffix}`, email],
    );
    assert.deepEqual(selfDeleteRows.rows[0], { subscriptions: "0", events: "0", attempts: "0" });
    userId = 0;

    const adminDelete = await fetch(`${baseUrl}/admin/students/${ambiguousUserId}/delete`, {
      method: "DELETE",
      headers: { admintoken: adminToken },
    });
    assert.equal(adminDelete.status, 200);
    const adminDeleteRows = await pool.query<{ subscriptions: string; events: string; attempts: string; users: string }>(
      `SELECT
        (SELECT count(*) FROM learner_subscriptions WHERE user_id = $1)::text AS subscriptions,
        (SELECT count(*) FROM subscription_billing_events WHERE user_id = $1)::text AS events,
        (SELECT count(*) FROM subscription_delivery_attempts WHERE learner_id = $1)::text AS attempts,
        (SELECT count(*) FROM users WHERE id = $1)::text AS users`,
      [ambiguousUserId],
    );
    assert.deepEqual(adminDeleteRows.rows[0], { subscriptions: "0", events: "0", attempts: "0", users: "0" });
    ambiguousUserId = 0;
  } finally {
    holdRepeatedOpening = false;
    releaseRepeatedOpening();
    if (server.exitCode === null) {
      await new Promise<void>((resolve) => {
        server.once("exit", () => resolve());
        server.kill("SIGTERM");
      });
    }
    try {
      if (userId) {
        await pool.query("DELETE FROM subscription_billing_events WHERE user_id = $1", [userId]);
        await pool.query("DELETE FROM subscription_delivery_attempts WHERE learner_id = $1", [userId]);
        await pool.query("DELETE FROM learner_subscriptions WHERE user_id = $1", [userId]);
        await pool.query("DELETE FROM user_progress WHERE user_id = $1", [userId]);
        await pool.query("DELETE FROM course_enrolments WHERE user_id = $1", [userId]);
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
      }
      if (ambiguousUserId) {
        await pool.query("DELETE FROM subscription_billing_events WHERE user_id = $1", [ambiguousUserId]);
        await pool.query("DELETE FROM subscription_delivery_attempts WHERE learner_id = $1", [ambiguousUserId]);
        await pool.query("DELETE FROM learner_subscriptions WHERE user_id = $1", [ambiguousUserId]);
        await pool.query("DELETE FROM users WHERE id = $1", [ambiguousUserId]);
      }
      await pool.query("DELETE FROM activation_codes WHERE code = ANY($1::text[])", [[code, refreshCode]]);
      await pool.query("DELETE FROM subscription_delivery_attempts WHERE provider_event_id LIKE $1", [`%${suffix}%`]);
      await pool.query(
        "DELETE FROM billing_support_notifications WHERE alert_id LIKE $1 OR alert_id = $2",
        [`%${suffix}%`, unrelatedPendingAlertId],
      );
    } finally {
      await Promise.allSettled([
        new Promise<void>((resolve) => smtpServer.close(() => resolve())),
        pool.end(),
      ]);
    }
  }
});
