import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import test from "node:test";

const requireFromDb = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = requireFromDb("pg") as typeof import("pg");

test("video completion remains isolated to the enrolment that earned it", async () => {
  const suffix = `${process.pid}-${Date.now()}`;
  const port = 25000 + (process.pid % 1000);
  const deviceId = `progress-route-device-${suffix}`;
  const originalCode = `PROGRESS-ORIGINAL-${suffix}`;
  const replacementCode = `PROGRESS-REPLACEMENT-${suffix}`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let userId: number | null = null;
  let server: ReturnType<typeof spawn> | null = null;

  try {
    const moduleResult = await pool.query<{ id: number }>(
      "SELECT id FROM modules WHERE is_active = true ORDER BY \"order\", id LIMIT 1",
    );
    const moduleId = moduleResult.rows[0]?.id;
    assert.ok(moduleId, "the progress route test requires an active module");

    await pool.query(
      "INSERT INTO activation_codes (code, is_used) VALUES ($1, true), ($2, true)",
      [originalCode, replacementCode],
    );
    const userResult = await pool.query<{ id: number }>(
      `INSERT INTO users (
         activation_code, full_name, email, device_id, access_expires_at
       ) VALUES ($1, 'Renewed Progress Learner', $2, $3, CURRENT_TIMESTAMP + INTERVAL '1 year')
       RETURNING id`,
      [originalCode, `renewed-progress-${suffix}@example.test`, deviceId],
    );
    userId = userResult.rows[0]!.id;

    const enrolments = await pool.query<{ id: number; purchase_code: string }>(
      `INSERT INTO course_enrolments (
         user_id, purchase_code, activation_code, access_expires_at, status, access_type
       ) VALUES
         ($1, $2, $2, CURRENT_TIMESTAMP + INTERVAL '1 year', 'active', 'paid'),
         ($1, $3, $3, CURRENT_TIMESTAMP + INTERVAL '1 year', 'active', 'paid')
       RETURNING id, purchase_code`,
      [userId, originalCode, replacementCode],
    );
    const originalEnrollmentId = enrolments.rows.find((row) => row.purchase_code === originalCode)!.id;
    const replacementEnrollmentId = enrolments.rows.find((row) => row.purchase_code === replacementCode)!.id;
    await pool.query("UPDATE users SET current_enrollment_id = $1 WHERE id = $2", [originalEnrollmentId, userId]);

    server = spawn(process.execPath, [new URL("../dist/index.mjs", import.meta.url).pathname], {
      cwd: new URL("../../..", import.meta.url),
      env: {
        ...process.env,
        ADMIN_PASSWORD: "progress-route-test-password",
        SESSION_SECRET: "progress-route-test-session-secret",
        DEMO_MODE: "false",
        NODE_ENV: "test",
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
      server!.stdout.on("data", ready);
      server!.stderr.on("data", ready);
      server!.once("exit", (code) => {
        clearTimeout(timeout);
        reject(new Error(`API test server exited with code ${code}`));
      });
    });
    await started;

    const baseUrl = `http://127.0.0.1:${port}/api`;
    const headersFor = (activationCode: string) => ({
      activationcode: activationCode,
      deviceid: deviceId,
      userid: String(userId),
    });
    const completeVideo = (activationCode: string, enrollmentId: number) =>
      fetch(`${baseUrl}/progress/complete-video`, {
        method: "POST",
        headers: { ...headersFor(activationCode), "content-type": "application/json" },
        body: JSON.stringify({ moduleId, deviceId, activationCode, enrollmentId }),
      });
    const moduleCompletion = async (activationCode: string) => {
      const response = await fetch(`${baseUrl}/modules`, { headers: headersFor(activationCode) });
      assert.equal(response.status, 200);
      const modules = await response.json() as { id: number; isCompleted: boolean }[];
      return modules.find((module) => module.id === moduleId)?.isCompleted;
    };

    assert.equal((await completeVideo(originalCode, originalEnrollmentId)).status, 200);
    assert.equal(await moduleCompletion(originalCode), true);

    assert.equal((await completeVideo(originalCode, originalEnrollmentId)).status, 200);
    const originalRows = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM user_progress
       WHERE user_id = $1 AND enrollment_id = $2 AND module_id = $3`,
      [userId, originalEnrollmentId, moduleId],
    );
    assert.equal(originalRows.rows[0]?.count, "1");

    await pool.query("UPDATE users SET current_enrollment_id = $1 WHERE id = $2", [replacementEnrollmentId, userId]);
    assert.equal(await moduleCompletion(replacementCode), false);

    const delayedOriginalCompletion = await completeVideo(originalCode, originalEnrollmentId);
    assert.equal(delayedOriginalCompletion.status, 409);
    assert.deepEqual(await delayedOriginalCompletion.json(), {
      error: "stale_enrollment",
      message: "The completion belongs to a different enrolment.",
    });

    const replacementRows = await pool.query<{ count: string }>(
      `SELECT count(*)::text AS count
       FROM user_progress
       WHERE user_id = $1 AND enrollment_id = $2 AND module_id = $3`,
      [userId, replacementEnrollmentId, moduleId],
    );
    assert.equal(replacementRows.rows[0]?.count, "0");
    const preservedOriginalRows = await pool.query<{ count: string; video_completed: boolean }>(
      `SELECT count(*)::text AS count, bool_and(video_completed) AS video_completed
       FROM user_progress
       WHERE user_id = $1 AND enrollment_id = $2 AND module_id = $3`,
      [userId, originalEnrollmentId, moduleId],
    );
    assert.deepEqual(preservedOriginalRows.rows[0], { count: "1", video_completed: true });
  } finally {
    if (userId !== null) {
      await pool.query("DELETE FROM user_progress WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM course_enrolments WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
    await pool.query("DELETE FROM activation_codes WHERE code = ANY($1::text[])", [[originalCode, replacementCode]]);
    if (server) {
      server.kill("SIGTERM");
      if (server.exitCode === null) {
        await new Promise<void>((resolve) => server!.once("exit", () => resolve()));
      }
    }
    await pool.end();
  }
});