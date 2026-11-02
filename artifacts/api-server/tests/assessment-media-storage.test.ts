import assert from "node:assert/strict";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import test from "node:test";
import { assessmentMediaObjectKeyFromFileName } from "../src/lib/assessmentMediaStorage.ts";

const requireFromDb = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = requireFromDb("pg") as typeof import("pg");

test("derives an assessment object key from a GCS file name without the bucket segment", () => {
  assert.equal(
    assessmentMediaObjectKeyFromFileName(
      "private/assessment-media/images/123e4567-e89b-12d3-a456-426614174000",
      "/bucket/private",
    ),
    "assessment-media/images/123e4567-e89b-12d3-a456-426614174000",
  );
});

test("ignores files outside the configured private directory", () => {
  assert.equal(
    assessmentMediaObjectKeyFromFileName(
      "other/assessment-media/audio/123e4567-e89b-12d3-a456-426614174000",
      "/bucket/private",
    ),
    null,
  );
});

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

async function startApi(port: number, adminPassword: string, sessionSecret: string) {
  const server = spawn(process.execPath, [new URL("../dist/index.mjs", import.meta.url).pathname], {
    cwd: new URL("../../..", import.meta.url),
    env: {
      ...process.env,
      ADMIN_PASSWORD: adminPassword,
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

test("assessment image and audio survive restart, stay protected, and are deleted with their record", async () => {
  assert.ok(process.env.DATABASE_URL, "DATABASE_URL is required for the assessment media integration test");
  assert.ok(process.env.PRIVATE_OBJECT_DIR, "PRIVATE_OBJECT_DIR is required for the assessment media integration test");

  const suffix = `${process.pid}-${Date.now()}`;
  const adminPassword = `assessment-media-password-${suffix}`;
  const sessionSecret = `assessment-media-session-${suffix}`;
  const activeCode = `MEDIA-ACTIVE-${suffix}`;
  const expiredCode = `MEDIA-EXPIRED-${suffix}`;
  const activeDevice = `media-active-device-${suffix}`;
  const expiredDevice = `media-expired-device-${suffix}`;
  const port = await availablePort();
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let server: ChildProcessWithoutNullStreams | undefined;
  let questionId: number | undefined;
  let activeUserId: number | undefined;
  let expiredUserId: number | undefined;
  let imageUrl: string | undefined;
  let audioUrl: string | undefined;
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
  const learnerHeaders = (code: string, deviceId: string, userId: number) => ({
    activationcode: code,
    deviceid: deviceId,
    userid: String(userId),
  });
  const upload = async (kind: "image" | "audio", contentType: string, bytes: Uint8Array) => {
    const request = await adminJson("/admin/mock-questions/request-media-upload", "POST", {
      kind,
      contentType,
      size: bytes.byteLength,
    });
    assert.equal(request.status, 200);
    const details = await request.json() as { uploadURL: string; url: string };
    const put = await fetch(details.uploadURL, {
      method: "PUT",
      headers: { "content-type": contentType },
      body: bytes,
    });
    assert.ok(put.ok, `signed upload failed with ${put.status}`);
    const finalize = await adminJson("/admin/mock-questions/finalize-media-upload", "POST", {
      url: details.url,
    });
    assert.equal(finalize.status, 200);
    return details.url;
  };
  const assertMedia = async (url: string, headers: Record<string, string>, contentType: RegExp, expected: Uint8Array) => {
    let response: Response | undefined;
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      response = await fetch(`http://127.0.0.1:${port}${url}`, { headers });
      if (response.status < 500 || attempt === 4) break;
      await response.arrayBuffer();
      await new Promise((resolve) => setTimeout(resolve, attempt * 250));
    }
    assert.ok(response);
    if (response.status !== 200) {
      const failureBody = await response.text();
      assert.equal(
        response.status,
        200,
        `media request failed after bounded retries: ${response.status} ${failureBody}`,
      );
    }
    assert.match(response.headers.get("content-type") ?? "", contentType);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), expected);
  };

  const imageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
  const audioBytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 1, 2, 3, 4, 5, 6]);

  try {
    server = await startApi(port, adminPassword, sessionSecret);
    adminToken = await login();

    await pool.query(
      "INSERT INTO activation_codes (code, is_used) VALUES ($1, true), ($2, true)",
      [activeCode, expiredCode],
    );
    const users = await pool.query<{ id: number; activation_code: string }>(
      `INSERT INTO users (
        activation_code, full_name, email, device_id, activated_at, access_expires_at
      ) VALUES
        ($1, 'Active Media Test Learner', $2, $3, CURRENT_TIMESTAMP, $4),
        ($5, 'Expired Media Test Learner', $6, $7, CURRENT_TIMESTAMP, $8)
      RETURNING id, activation_code`,
      [
        activeCode, `active-media-${suffix}@example.test`, activeDevice, new Date(Date.now() + 60_000),
        expiredCode, `expired-media-${suffix}@example.test`, expiredDevice, new Date(Date.now() - 60_000),
      ],
    );
    activeUserId = users.rows.find((row) => row.activation_code === activeCode)!.id;
    expiredUserId = users.rows.find((row) => row.activation_code === expiredCode)!.id;

    imageUrl = await upload("image", "image/png", imageBytes);
    audioUrl = await upload("audio", "audio/ogg", audioBytes);

    for (const body of [
      { image: audioUrl, audioUrl },
      { image: imageUrl, audioUrl: imageUrl },
    ]) {
      const wrongType = await adminJson("/admin/mock-questions", "POST", {
        question: `Wrong media field ${suffix}`,
        prompts: [{ text: "Explain", keyPoints: ["safe"] }],
        ...body,
      });
      assert.equal(wrongType.status, 400);
    }

    const create = await adminJson("/admin/mock-questions", "POST", {
      question: `Persistent assessment media ${suffix}`,
      prompts: [{ text: "Explain", keyPoints: ["safe"] }],
      image: imageUrl,
      audioUrl,
      sortOrder: 999_999,
      isActive: true,
    });
    assert.equal(create.status, 200);
    const created = await create.json() as { id: number; image: string; audioUrl: string };
    questionId = created.id;
    assert.equal(created.image, imageUrl);
    assert.equal(created.audioUrl, audioUrl);

    const stored = await pool.query<{ image: string; audio_url: string }>(
      "SELECT image, audio_url FROM mock_questions WHERE id = $1",
      [questionId],
    );
    assert.deepEqual(stored.rows[0], { image: imageUrl, audio_url: audioUrl });

    assert.equal((await fetch(`http://127.0.0.1:${port}${imageUrl}`)).status, 401);
    assert.equal((await fetch(`http://127.0.0.1:${port}${audioUrl}`)).status, 401);
    await assertMedia(imageUrl, { admintoken: adminToken }, /^image\/png/, imageBytes);
    await assertMedia(audioUrl, { admintoken: adminToken }, /^audio\/ogg/, audioBytes);
    await assertMedia(imageUrl, learnerHeaders(activeCode, activeDevice, activeUserId), /^image\/png/, imageBytes);
    await assertMedia(audioUrl, learnerHeaders(activeCode, activeDevice, activeUserId), /^audio\/ogg/, audioBytes);

    for (const url of [imageUrl, audioUrl]) {
      const expiredRead = await fetch(`http://127.0.0.1:${port}${url}`, {
        headers: learnerHeaders(expiredCode, expiredDevice, expiredUserId),
      });
      assert.equal(expiredRead.status, 403);
      assert.deepEqual(await expiredRead.json(), {
        error: "access_expired",
        message: "Course access has ended.",
      });
    }

    await stopApi(server);
    server = await startApi(port, adminPassword, sessionSecret);
    adminToken = await login();

    const afterRestart = await adminJson("/admin/mock-questions", "GET");
    assert.equal(afterRestart.status, 200);
    const listed = await afterRestart.json() as {
      questions: Array<{ id: number; image?: string; audioUrl?: string }>;
    };
    const persistedQuestion = listed.questions.find((question) => question.id === questionId);
    assert.ok(persistedQuestion);
    assert.equal(persistedQuestion.image, imageUrl);
    assert.equal(persistedQuestion.audioUrl, audioUrl);
    await assertMedia(imageUrl, learnerHeaders(activeCode, activeDevice, activeUserId), /^image\/png/, imageBytes);
    await assertMedia(audioUrl, learnerHeaders(activeCode, activeDevice, activeUserId), /^audio\/ogg/, audioBytes);

    const remove = await adminJson(`/admin/mock-questions/${questionId}`, "DELETE");
    assert.equal(remove.status, 200);
    questionId = undefined;
    assert.equal((await fetch(`http://127.0.0.1:${port}${imageUrl}`, { headers: { admintoken: adminToken } })).status, 404);
    assert.equal((await fetch(`http://127.0.0.1:${port}${audioUrl}`, { headers: { admintoken: adminToken } })).status, 404);
    imageUrl = undefined;
    audioUrl = undefined;
  } finally {
    if (server && server.exitCode === null && adminToken) {
      if (questionId !== undefined) {
        await adminJson(`/admin/mock-questions/${questionId}`, "DELETE").catch(() => undefined);
      }
      for (const url of [imageUrl, audioUrl]) {
        if (url) {
          await adminJson("/admin/mock-questions/media", "DELETE", { url }).catch(() => undefined);
        }
      }
    }
    if (questionId !== undefined) {
      await pool.query("DELETE FROM mock_questions WHERE id = $1", [questionId]);
    }
    const userIds = [activeUserId, expiredUserId].filter((id): id is number => id !== undefined);
    if (userIds.length > 0) await pool.query("DELETE FROM users WHERE id = ANY($1::int[])", [userIds]);
    await pool.query("DELETE FROM activation_codes WHERE code = ANY($1::text[])", [[activeCode, expiredCode]]);
    if (server) await stopApi(server);
    await pool.end();
  }
});
