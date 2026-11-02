import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import test from "node:test";

const requireFromDb = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = requireFromDb("pg") as typeof import("pg");

const accessExpired = { error: "access_expired", message: "Course access has ended." };

test("course routes deny expired learners while preserving their completion evidence", async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const port = 23000 + (process.pid % 1000);
  const smtpPort = 24000 + (process.pid % 1000);
  const deviceId = `course-access-device-${suffix}`;
  const codes = {
    expired: `ACCESS-EXPIRED-${suffix}`,
    active: `ACCESS-ACTIVE-${suffix}`,
    unlimited: `ACCESS-UNLIMITED-${suffix}`,
    extended: `ACCESS-EXTENDED-${suffix}`,
    subscription: `ACCESS-SUBSCRIPTION-${suffix}`,
    boundary: `ACCESS-BOUNDARY-${suffix}`,
  };
  const userIds: number[] = [];
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const smtpServer = createServer((socket) => {
    let receivingMessage = false;
    socket.on("error", () => {
      // Nodemailer may close the test connection immediately after receiving
      // the final response; the route assertion, not socket teardown, is under test.
    });
    socket.write("220 localhost ESMTP\r\n");
    socket.on("data", (chunk) => {
      const input = chunk.toString();
      if (receivingMessage && input.includes("\r\n.\r\n")) {
        receivingMessage = false;
        socket.write("250 Message accepted\r\n");
        return;
      }
      for (const command of input.split("\r\n").filter(Boolean)) {
        if (/^(EHLO|HELO) /i.test(command)) socket.write("250-localhost\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (/^DATA$/i.test(command)) {
          receivingMessage = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (/^QUIT$/i.test(command)) socket.end("221 Bye\r\n");
        else socket.write("250 OK\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => smtpServer.listen(smtpPort, "127.0.0.1", resolve));
  const server = spawn(process.execPath, [new URL("../dist/index.mjs", import.meta.url).pathname], {
    cwd: new URL("../../..", import.meta.url),
    env: {
      ...process.env,
      ADMIN_PASSWORD: "course-access-route-test-password",
      SESSION_SECRET: "course-access-route-test-session-secret",
      DEMO_MODE: "false",
      NODE_ENV: "test",
      PORT: String(port),
      // Expired AI requests must return before a provider can be contacted.
      GEMINI_API_KEY: "",
      // Keep preservation coverage self-contained: resend reaches this local
      // accepting SMTP server rather than any configured external provider.
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(smtpPort),
      SMTP_SECURE: "false",
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
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`API test server exited with code ${code}`));
    });
  });

  const baseUrl = `http://127.0.0.1:${port}/api`;
  const headersFor = (activationCode: string, userId: number) => ({
    activationcode: activationCode,
    deviceid: deviceId,
    userid: String(userId),
  });
  const post = (path: string, activationCode: string, userId: number, body: unknown) =>
    fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { ...headersFor(activationCode, userId), "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const assertExpired = async (response: Response) => {
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), accessExpired);
  };

  try {
    await started;
    const past = new Date(Date.now() - 60_000);
    const future = new Date(Date.now() + 60_000);
    const oldLifecycle = new Date("2024-01-01T00:00:00.000Z");
    const deterministicBoundary = new Date("2030-01-01T00:00:00.000Z");
    await pool.query(
      "INSERT INTO activation_codes (code, is_used) VALUES ($1, true), ($2, true), ($3, true), ($4, true), ($5, true), ($6, true)",
      Object.values(codes),
    );
    const created = await pool.query<{
      id: number; activation_code: string;
    }>(
      `INSERT INTO users (
        activation_code, full_name, email, device_id, activated_at, access_expires_at, subscription_expires_at,
        course_completed_at, certificate_issued_at
      ) VALUES
        ($1, 'Expired Route Learner', $2, $3, $4, $5, NULL, $5, $5),
        ($6, 'Active Route Learner', $7, $3, CURRENT_TIMESTAMP, $8, NULL, NULL, NULL),
        ($9, 'Unlimited Route Learner', $10, $3, $4, NULL, NULL, NULL, NULL),
        ($11, 'Staff Extended Route Learner', $12, $3, $4, $8, NULL, NULL, NULL),
        ($13, 'Subscription Route Learner', $14, $3, $4, $5, $8, NULL, NULL),
        ($15, 'Boundary Route Learner', $16, $3, $4, $17, NULL, NULL, NULL)
      RETURNING id, activation_code`,
      [
        codes.expired, `expired-${suffix}@example.test`, deviceId, oldLifecycle, past,
        codes.active, `active-${suffix}@example.test`, future,
        codes.unlimited, `unlimited-${suffix}@example.test`,
        codes.extended, `staff-extended-${suffix}@example.test`,
        codes.subscription, `subscription-${suffix}@example.test`,
        codes.boundary, `boundary-${suffix}@example.test`, deterministicBoundary,
      ],
    );
    const byCode = new Map(created.rows.map((user) => [user.activation_code, user]));
    const expired = byCode.get(codes.expired)!;
    const active = byCode.get(codes.active)!;
    const unlimited = byCode.get(codes.unlimited)!;
    const extended = byCode.get(codes.extended)!;
    const subscription = byCode.get(codes.subscription)!;
    const boundary = byCode.get(codes.boundary)!;
    userIds.push(...created.rows.map((user) => user.id));
    await pool.query(
      "INSERT INTO exam_attempts (user_id, score, passed, total_questions, answers, attempted_at) VALUES ($1, 100, true, 1, '[]', $2)",
      [expired.id, past],
    );

    // The same physical device can switch from an expired account to an active one.
    const expiredMe = await fetch(`${baseUrl}/auth/me`, { headers: headersFor(codes.expired, expired.id) });
    assert.equal(expiredMe.status, 200);
    const expiredProfile = await expiredMe.json() as { accessStatus: string; enrollmentId: number };
    assert.equal(expiredProfile.accessStatus, "expired");
    for (const learner of [
      [codes.active, active, "active", future.toISOString()],
      [codes.unlimited, unlimited, "active", null],
      [codes.extended, extended, "active", future.toISOString()],
      [codes.subscription, subscription, "active", future.toISOString()],
    ] as const) {
      const response = await fetch(`${baseUrl}/auth/me`, { headers: headersFor(learner[0], learner[1].id) });
      assert.equal(response.status, 200);
      const identity = await response.json() as {
        accessStatus: string;
        accessExpiresAt: string | null;
        daysRemaining: number | null;
      };
      assert.equal(identity.accessStatus, learner[2]);
      assert.equal(identity.accessExpiresAt, learner[3]);
      assert.equal(identity.daysRemaining === null, learner[3] === null);
    }

    await pool.query(
      "UPDATE users SET device_id = $1 WHERE id = $2",
      [`RESET_${Date.now()}`, active.id],
    );
    const reboundMe = await fetch(`${baseUrl}/auth/me`, {
      headers: headersFor(codes.active, active.id),
    });
    assert.equal(reboundMe.status, 200);
    const reboundDevice = await pool.query<{ device_id: string }>(
      "SELECT device_id FROM users WHERE id = $1",
      [active.id],
    );
    assert.equal(reboundDevice.rows[0]?.device_id, deviceId);

    await pool.query(
      "UPDATE activation_codes SET is_paused = true WHERE code = $1",
      [codes.active],
    );
    const pausedMe = await fetch(`${baseUrl}/auth/me`, {
      headers: headersFor(codes.active, active.id),
    });
    assert.equal(pausedMe.status, 403);
    assert.deepEqual(await pausedMe.json(), {
      error: "access_paused",
      message: "You no longer have access to this app.",
    });
    await pool.query(
      "UPDATE activation_codes SET is_paused = false WHERE code = $1",
      [codes.active],
    );

    assert.equal((await fetch(`${baseUrl}/modules`, { headers: headersFor(codes.active, active.id) })).status, 200);
    assert.equal((await fetch(`${baseUrl}/modules`, { headers: headersFor(codes.unlimited, unlimited.id) })).status, 200);
    assert.equal((await fetch(`${baseUrl}/modules`, { headers: headersFor(codes.extended, extended.id) })).status, 200);
    assert.equal((await fetch(`${baseUrl}/modules`, { headers: headersFor(codes.subscription, subscription.id) })).status, 200);
    assert.equal((await fetch(`${baseUrl}/hazards/site`, { headers: headersFor(codes.active, active.id) })).status, 200);
    assert.equal((await fetch(`${baseUrl}/documents/hazards/reference`, { headers: headersFor(codes.active, active.id) })).status, 200);
    for (const learner of [
      [codes.active, active],
      [codes.extended, extended],
      [codes.unlimited, unlimited],
      [codes.subscription, subscription],
    ] as const) {
      const manifest = await fetch(`${baseUrl}/documents/manual/manifest`, { headers: headersFor(learner[0], learner[1].id) });
      assert.equal(manifest.status, 200);
      assert.match(manifest.headers.get("content-type") ?? "", /^application\/json/);
      assert.equal(manifest.headers.get("cache-control"), "private, no-store");
      assert.ok((await manifest.json() as { pages: number }).pages > 0);
    }
    const manualPage = await fetch(`${baseUrl}/documents/manual/pages/page-000.jpg`, {
      headers: headersFor(codes.active, active.id),
    });
    assert.equal(manualPage.status, 200);
    assert.match(manualPage.headers.get("content-type") ?? "", /^image\/jpeg/);
    assert.ok((await manualPage.arrayBuffer()).byteLength > 1_000);
    const assessmentImage = await fetch(`${baseUrl}/assessment-images/bundled/air-filter.jpg`, {
      headers: headersFor(codes.active, active.id),
    });
    assert.equal(assessmentImage.status, 200);
    assert.match(assessmentImage.headers.get("content-type") ?? "", /^image\/jpeg/);
    assert.equal(assessmentImage.headers.get("cache-control"), "private, no-store");
    assert.ok((await assessmentImage.arrayBuffer()).byteLength > 1_000);
    assert.equal(
      (await fetch(`${baseUrl}/assessment-images/bundled/air-filter.jpg`)).status,
      401,
    );
    assert.equal(
      (await fetch(`${baseUrl}/assessment-images/bundled/not-present.jpg`, {
        headers: headersFor(codes.active, active.id),
      })).status,
      404,
    );
    assert.equal(
      (await fetch(`${baseUrl}/documents/manual/pages/page-00x.jpg`, {
        headers: headersFor(codes.active, active.id),
      })).status,
      404,
    );
    for (const learner of [
      [codes.active, active],
      [codes.extended, extended],
      [codes.unlimited, unlimited],
    ] as const) {
      assert.equal(
        (await fetch(`${baseUrl}/gateway/venues`, { headers: headersFor(learner[0], learner[1].id) })).status,
        200,
      );
    }
    // Intentionally incomplete mutations prove active learners pass the
    // gateway access guard without creating passport or enquiry records.
    assert.equal(
      (await post("/gateway/passport", codes.active, active.id, {})).status,
      400,
    );
    assert.equal(
      (await post("/gateway/enquiries", codes.active, active.id, {})).status,
      400,
    );

    await assertExpired(await fetch(`${baseUrl}/modules`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/modules/999999`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/quizzes/999999`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await post("/quizzes/999999/submit", codes.expired, expired.id, {
      deviceId, activationCode: codes.expired, answers: [],
    }));
    await assertExpired(await post("/progress/heartbeat", codes.expired, expired.id, {
      moduleId: 999999, timestamp: 0, deviceId, activationCode: codes.expired,
    }));
    await assertExpired(await post("/progress/complete-video", codes.expired, expired.id, {
      moduleId: 999999, deviceId, activationCode: codes.expired, enrollmentId: expiredProfile.enrollmentId,
    }));
    await assertExpired(await post("/progress/complete-assessment", codes.expired, expired.id, {
      moduleId: 999999, deviceId, activationCode: codes.expired, passed: false,
    }));
    await assertExpired(await fetch(`${baseUrl}/mock-questions`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/assessment-images/bundled/air-filter.jpg`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/hazards/site`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/documents/legislation`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/documents/hazards`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/documents/hazards/reference`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/documents/manual/manifest`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/documents/manual/search-index`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/documents/manual/pages/page-000.jpg`, { headers: headersFor(codes.expired, expired.id) }));
    // No URL is intentionally supplied: access is checked before query
    // validation, cache lookup, fetch, or document parsing.
    await assertExpired(await fetch(`${baseUrl}/how-to-use`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/gateway/venues`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/gateway/passport`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await post("/gateway/passport", codes.expired, expired.id, {}));
    await assertExpired(await fetch(`${baseUrl}/gateway/enquiries`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await post("/gateway/enquiries", codes.expired, expired.id, {}));
    assert.equal((await fetch(`${baseUrl}/gateway/resolve/not-a-real-token`)).status, 404);
    await assertExpired(await fetch(`${baseUrl}/exam`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await fetch(`${baseUrl}/exam/status`, { headers: headersFor(codes.expired, expired.id) }));
    await assertExpired(await post("/exam/submit", codes.expired, expired.id, {
      deviceId, activationCode: codes.expired, answers: [],
    }));
    await assertExpired(await post("/ai/chat", codes.expired, expired.id, {
      message: "This must not invoke AI.", deviceId, activationCode: codes.expired, mode: "tutor",
    }));
    await assertExpired(await post("/ai/grade-answer", codes.expired, expired.id, {
      transcript: "answer", promptText: "question", keyPoints: [], deviceId, activationCode: codes.expired,
    }));
    await assertExpired(await fetch(`${baseUrl}/ai/chat-history`, { headers: headersFor(codes.expired, expired.id) }));

    // Exact exclusivity is unit-tested with the same instant passed to the
    // helper. HTTP and database clocks cannot be made identical over a
    // network, so this route check persists the DB's current cutoff, confirms
    // it is at-or-before the DB clock, then proves the route rejects it.
    await pool.query("UPDATE users SET access_expires_at = CURRENT_TIMESTAMP WHERE id = $1", [boundary.id]);
    const boundaryState = await pool.query<{ expired: boolean }>(
      "SELECT access_expires_at <= CURRENT_TIMESTAMP AS expired FROM users WHERE id = $1",
      [boundary.id],
    );
    assert.equal(boundaryState.rows[0]?.expired, true);
    await assertExpired(await fetch(`${baseUrl}/modules`, { headers: headersFor(codes.boundary, boundary.id) }));

    const summary = await fetch(`${baseUrl}/progress/summary`, { headers: headersFor(codes.expired, expired.id) });
    assert.equal(summary.status, 200);
    const details = await fetch(`${baseUrl}/certificate/details`, { headers: headersFor(codes.expired, expired.id) });
    assert.equal(details.status, 200);
    assert.equal((await details.json() as { fullName: string }).fullName, "Expired Route Learner");
    // A completion flag alone must never fabricate a certificate. This active
    // learner has no passed attempt and must remain certificate-ineligible.
    const activeDetails = await fetch(`${baseUrl}/certificate/details`, { headers: headersFor(codes.active, active.id) });
    assert.equal(activeDetails.status, 401);
    const activeToken = await fetch(`${baseUrl}/certificate/access-token`, { headers: headersFor(codes.active, active.id) });
    assert.equal(activeToken.status, 404);
    const accessToken = await fetch(`${baseUrl}/certificate/access-token`, { headers: headersFor(codes.expired, expired.id) });
    assert.equal(accessToken.status, 200);
    const view = await fetch(`http://127.0.0.1:${port}${(await accessToken.json() as { viewUrl: string }).viewUrl}`);
    assert.equal(view.status, 200);
    assert.match(view.headers.get("content-type") ?? "", /^application\/pdf/);
    const certificate = await fetch(`${baseUrl}/certificate?download=1`, { headers: headersFor(codes.expired, expired.id) });
    assert.equal(certificate.status, 200);
    assert.match(certificate.headers.get("content-disposition") ?? "", /^attachment;/);
    assert.match(certificate.headers.get("content-type") ?? "", /^application\/pdf/);
    const resend = await fetch(`${baseUrl}/certificate/resend`, {
      method: "POST",
      headers: headersFor(codes.expired, expired.id),
    });
    assert.equal(resend.status, 200);
    assert.deepEqual(await resend.json(), { ok: true });

    // Certificate preservation does not remove the activation-code/device bond.
    const wrongDevice = `${deviceId}-other`;
    assert.equal(
      (await fetch(`${baseUrl}/certificate/view`)).status,
      401,
    );
    assert.equal(
      (await fetch(`${baseUrl}/certificate/resend`, {
        method: "POST",
        headers: { activationcode: codes.expired, deviceid: wrongDevice, userid: String(expired.id) },
      })).status,
      401,
    );
  } finally {
    if (userIds.length > 0) {
      for (const table of ["chat_messages", "quiz_attempts", "user_progress", "exam_attempts"]) {
        await pool.query(`DELETE FROM ${table} WHERE user_id = ANY($1::int[])`, [userIds]);
      }
      await pool.query("DELETE FROM users WHERE id = ANY($1::int[])", [userIds]);
    }
    await pool.query("DELETE FROM activation_codes WHERE code = ANY($1::text[])", [Object.values(codes)]);
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => server.once("exit", () => resolve()));
    await new Promise<void>((resolve, reject) => smtpServer.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  }
});