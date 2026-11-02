import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import test from "node:test";

const requireFromDb = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const pg = requireFromDb("pg");

test("retailer learner and admin routes enforce visibility, validation and imports", async () => {
  const port = 23000 + (process.pid % 1000);
  const postcodePort = 24000 + (process.pid % 1000);
  let transientAttempts = 0;
  const postcodeServer = createServer((req, res) => {
    if (req.url?.endsWith("/OUTAGE")) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Service unavailable" }));
      return;
    }
    if (req.url?.endsWith("/TRANSIENT")) {
      transientAttempts += 1;
      if (transientAttempts === 1) {
        res.writeHead(503, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: "Try again" }));
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ result: { latitude: 51.5, longitude: -0.1 } }));
      return;
    }
    if (req.url?.endsWith("/NEWLOC")) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ result: { latitude: 55, longitude: -3 } }));
      return;
    }
    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ status: "no_match" }));
  });
  await new Promise<void>((resolve) => postcodeServer.listen(postcodePort, "127.0.0.1", resolve));

  const server = spawn(process.execPath, ["dist/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      ADMIN_PASSWORD: "retailer-route-test-password",
      SESSION_SECRET: "retailer-route-test-session-secret",
      DEMO_MODE: "true",
      NODE_ENV: "test",
      PORT: String(port),
      POSTCODE_PRIMARY_API_URL: `http://127.0.0.1:${postcodePort}/primary`,
      POSTCODE_SECONDARY_API_URL: `http://127.0.0.1:${postcodePort}/secondary`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("API test server did not start")), 15_000);
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes("Server listening")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`API test server exited with code ${code}`));
    });
  });

  const baseUrl = `http://127.0.0.1:${port}/api`;
  const learnerHeaders = {
    activationcode: "DEMO-PREVIEW",
    deviceid: "retailer-route-test-device",
  };
  const createdIds: number[] = [];

  const retailerBody = (name: string, overrides: Record<string, unknown> = {}) => ({
    name,
    address: "1 Test Road",
    town: "London",
    county: "London",
    postcode: "",
    lat: 51.5,
    lng: -0.1,
    email: "test@example.com",
    phone: "01234567890",
    active: true,
    verificationStatus: "verified",
    ...overrides,
  });

  try {
    assert.equal((await fetch(`${baseUrl}/retailers`)).status, 401);
    const initialPublicFeedResponse = await fetch(`${baseUrl}/retailers/public`, {
      headers: { origin: "https://shopify.example" },
    });
    assert.equal(initialPublicFeedResponse.status, 200);
    assert.equal(initialPublicFeedResponse.headers.get("access-control-allow-origin"), "*");
    assert.ok(Array.isArray(await initialPublicFeedResponse.json()));
    assert.equal((await fetch(`${baseUrl}/admin/retailers`)).status, 401);

    const loginResponse = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "retailer-route-test-password" }),
    });
    assert.equal(loginResponse.status, 200);
    const { token } = await loginResponse.json() as { token: string };
    const adminHeaders = { "content-type": "application/json", admintoken: token };

    const invalidResponse = await fetch(`${baseUrl}/admin/retailers`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({ ...retailerBody(""), name: "" }),
    });
    assert.equal(invalidResponse.status, 400);
    const invalidFeaturedResponse = await fetch(`${baseUrl}/admin/retailers`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(retailerBody("Invalid featured retailer", { featured: "yes" })),
    });
    assert.equal(invalidFeaturedResponse.status, 400);

    const visibleResponse = await fetch(`${baseUrl}/admin/retailers`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(retailerBody(`Retailer visible ${Date.now()}`, {
        notes: "Admin-only note",
        evidenceUrl: "https://example.com/internal-evidence",
        lastCheckedAt: "2026-09-15T00:00:00.000Z",
        featured: true,
      })),
    });
    assert.equal(visibleResponse.status, 200);
    const visible = await visibleResponse.json() as { id: number; featured: boolean };
    assert.equal(visible.featured, true);
    createdIds.push(visible.id);

    const oldReminderDate = new Date("2026-09-14T00:00:00.000Z");
    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    await client.query(
      "UPDATE chainsaw_retailers SET review_due_reminder_claimed_at = $1 WHERE id = $2",
      [new Date(), visible.id],
    );
    const deleteDuringReminderResponse = await fetch(`${baseUrl}/admin/retailers/${visible.id}`, {
      method: "DELETE",
      headers: { admintoken: token },
    });
    assert.equal(deleteDuringReminderResponse.status, 409);
    assert.match(
      (await deleteDuringReminderResponse.json() as { error: string }).error,
      /reminder delivery in progress/i,
    );
    await client.query(
      `UPDATE chainsaw_retailers
       SET review_due_reminder_claimed_at = $1,
           review_due_reminder_sent_at = $1,
            review_due_reminder_failed_at = $1,
           review_overdue_reminder_claimed_at = $1,
            review_overdue_reminder_sent_at = $1,
            review_overdue_reminder_failed_at = $1
       WHERE id = $2`,
      [oldReminderDate, visible.id],
    );
    await client.end();

    const reminderStateResponse = await fetch(`${baseUrl}/admin/retailers`, {
      headers: adminHeaders,
    });
    assert.equal(reminderStateResponse.status, 200);
    const retailersWithReminderState = await reminderStateResponse.json() as Array<{
      id: number;
      reviewDueReminderSentAt: string | null;
      reviewDueReminderFailedAt: string | null;
      reviewOverdueReminderSentAt: string | null;
      reviewOverdueReminderFailedAt: string | null;
    }>;
    const retailerWithReminderState = retailersWithReminderState.find((retailer) => retailer.id === visible.id);
    assert.equal(retailerWithReminderState?.reviewDueReminderSentAt, oldReminderDate.toISOString());
    assert.equal(retailerWithReminderState?.reviewDueReminderFailedAt, oldReminderDate.toISOString());
    assert.equal(retailerWithReminderState?.reviewOverdueReminderSentAt, oldReminderDate.toISOString());
    assert.equal(retailerWithReminderState?.reviewOverdueReminderFailedAt, oldReminderDate.toISOString());

    const reverifyResponse = await fetch(`${baseUrl}/admin/retailers/${visible.id}/reverify`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ evidenceUrl: "https://example.com/current-evidence" }),
    });
    assert.equal(reverifyResponse.status, 200);
    const reverified = await reverifyResponse.json() as {
      name: string;
      notes: string;
      evidenceUrl: string;
      lastCheckedAt: string;
      verificationStatus: string;
      reviewDueReminderClaimedAt: string | null;
      reviewDueReminderSentAt: string | null;
      reviewDueReminderFailedAt: string | null;
      reviewOverdueReminderClaimedAt: string | null;
      reviewOverdueReminderSentAt: string | null;
      reviewOverdueReminderFailedAt: string | null;
    };
    assert.equal(reverified.name.startsWith("Retailer visible"), true);
    assert.equal(reverified.notes, "Admin-only note");
    assert.equal(reverified.evidenceUrl, "https://example.com/current-evidence");
    assert.equal(reverified.verificationStatus, "verified");
    assert.equal(reverified.reviewDueReminderClaimedAt, null);
    assert.equal(reverified.reviewDueReminderSentAt, null);
    assert.equal(reverified.reviewDueReminderFailedAt, null);
    assert.equal(reverified.reviewOverdueReminderClaimedAt, null);
    assert.equal(reverified.reviewOverdueReminderSentAt, null);
    assert.equal(reverified.reviewOverdueReminderFailedAt, null);
    assert.ok(Date.now() - new Date(reverified.lastCheckedAt).getTime() < 10_000);

    const historyResponse = await fetch(`${baseUrl}/admin/retailers/${visible.id}/verification-history`, {
      headers: adminHeaders,
    });
    assert.equal(historyResponse.status, 200);
    const history = await historyResponse.json() as Array<Record<string, unknown>>;
    assert.equal(history.length, 1);
    assert.equal(history[0]?.retailerId, visible.id);
    assert.equal(history[0]?.priorEvidenceUrl, "https://example.com/internal-evidence");
    assert.equal(new Date(String(history[0]?.priorCheckedAt)).toISOString(), "2026-09-15T00:00:00.000Z");
    assert.equal(history[0]?.newEvidenceUrl, "https://example.com/current-evidence");
    assert.equal(new Date(String(history[0]?.newCheckedAt)).getTime(), new Date(reverified.lastCheckedAt).getTime());
    assert.equal((await fetch(`${baseUrl}/admin/retailers/${visible.id}/verification-history`)).status, 401);

    const invalidReverifyResponse = await fetch(`${baseUrl}/admin/retailers/${visible.id}/reverify`, {
      method: "PATCH",
      headers: adminHeaders,
      body: JSON.stringify({ evidenceUrl: "not a URL" }),
    });
    assert.equal(invalidReverifyResponse.status, 400);

    const pendingResponse = await fetch(`${baseUrl}/admin/retailers`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(retailerBody(`Retailer pending ${Date.now()}`, {
        verificationStatus: "pending",
        featured: true,
      })),
    });
    assert.equal(pendingResponse.status, 200);
    const pending = await pendingResponse.json() as { id: number; featured: boolean };
    assert.equal(pending.featured, true);
    createdIds.push(pending.id);

    const inactiveResponse = await fetch(`${baseUrl}/admin/retailers`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(retailerBody(`Retailer inactive ${Date.now()}`, {
        active: false,
        featured: true,
      })),
    });
    assert.equal(inactiveResponse.status, 200);
    const inactive = await inactiveResponse.json() as { id: number };
    createdIds.push(inactive.id);

    const zuluResponse = await fetch(`${baseUrl}/admin/retailers`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(retailerBody(`Zulu unfeatured ${Date.now()}`)),
    });
    assert.equal(zuluResponse.status, 200);
    const zulu = await zuluResponse.json() as { id: number };
    createdIds.push(zulu.id);

    const alphaResponse = await fetch(`${baseUrl}/admin/retailers`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify(retailerBody(`Alpha unfeatured ${Date.now()}`)),
    });
    assert.equal(alphaResponse.status, 200);
    const alpha = await alphaResponse.json() as { id: number };
    createdIds.push(alpha.id);

    const reminderHistoryClient = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await reminderHistoryClient.connect();
    await reminderHistoryClient.query(
      `INSERT INTO chainsaw_retailer_reminder_attempt
        (retailer_id, threshold, outcome, attempted_at)
       VALUES ($1, 'due', 'failed', $2), ($1, 'due', 'sent', $3)`,
      [
        alpha.id,
        new Date("2026-09-14T09:00:00.000Z"),
        new Date("2026-09-15T09:00:00.000Z"),
      ],
    );
    await reminderHistoryClient.end();
    assert.equal(
      (await fetch(`${baseUrl}/admin/retailers/${alpha.id}/reminder-attempts`)).status,
      401,
    );
    const reminderHistoryResponse = await fetch(
      `${baseUrl}/admin/retailers/${alpha.id}/reminder-attempts`,
      { headers: adminHeaders },
    );
    assert.equal(reminderHistoryResponse.status, 200);
    const reminderHistory = await reminderHistoryResponse.json() as Array<{
      retailerId: number;
      threshold: string;
      outcome: string;
      attemptedAt: string;
    }>;
    assert.deepEqual(
      reminderHistory.map(({ retailerId, threshold, outcome }) => ({ retailerId, threshold, outcome })),
      [
        { retailerId: alpha.id, threshold: "due", outcome: "sent" },
        { retailerId: alpha.id, threshold: "due", outcome: "failed" },
      ],
    );
    assert.ok(
      new Date(reminderHistory[0]!.attemptedAt).getTime()
      > new Date(reminderHistory[1]!.attemptedAt).getTime(),
    );
    const deleteAttemptHistoryResponse = await fetch(`${baseUrl}/admin/retailers/${alpha.id}`, {
      method: "DELETE",
      headers: { admintoken: token },
    });
    assert.equal(deleteAttemptHistoryResponse.status, 409);
    assert.match(
      (await deleteAttemptHistoryResponse.json() as { error: string }).error,
      /reminder history/i,
    );

    const learnerResponse = await fetch(`${baseUrl}/retailers`, { headers: learnerHeaders });
    assert.equal(learnerResponse.status, 200);
    const learnerRetailers = await learnerResponse.json() as Array<Record<string, unknown> & { id: number }>;
    assert.ok(learnerRetailers.some((retailer) => retailer.id === visible.id));
    assert.ok(!learnerRetailers.some((retailer) => retailer.id === pending.id));
    assert.ok(!learnerRetailers.some((retailer) => retailer.id === inactive.id));
    const publicVisible = learnerRetailers.find((retailer) => retailer.id === visible.id);
    assert.ok(publicVisible);
    assert.equal(publicVisible.featured, true);
    const publicFeedResponse = await fetch(`${baseUrl}/retailers/public`);
    assert.equal(publicFeedResponse.status, 200);
    const publicFeed = await publicFeedResponse.json() as Array<Record<string, unknown> & { id: number }>;
    assert.ok(publicFeed.some((retailer) => retailer.id === visible.id));
    assert.ok(!publicFeed.some((retailer) => retailer.id === pending.id));
    assert.ok(!publicFeed.some((retailer) => retailer.id === inactive.id));
    const publicFeedVisible = publicFeed.find((retailer) => retailer.id === visible.id);
    assert.ok(publicFeedVisible);
    assert.deepEqual(
      Object.keys(publicFeedVisible).sort(),
      ["id", "name", "address", "town", "county", "postcode", "lat", "lng", "email", "phone", "website", "featured", "logoUrl"].sort(),
    );
    assert.equal(publicFeedVisible.logoUrl, null);
    assert.deepEqual(
      learnerRetailers
        .filter((retailer) => [visible.id, alpha.id, zulu.id].includes(retailer.id))
        .map((retailer) => retailer.id),
      [visible.id, alpha.id, zulu.id],
    );
    for (const internalField of ["notes", "verificationStatus", "evidenceUrl", "lastCheckedAt", "createdAt", "updatedAt", "active", "verificationHistory"]) {
      assert.equal(internalField in publicVisible, false, `learner response must omit ${internalField}`);
    }

    const transientResponse = await fetch(`${baseUrl}/retailers/postcode`, {
      method: "POST",
      headers: { ...learnerHeaders, "content-type": "application/json" },
      body: JSON.stringify({ postcode: "TRANSIENT" }),
    });
    assert.equal(transientResponse.status, 200);
    assert.deepEqual(await transientResponse.json(), { lat: 51.5, lng: -0.1 });
    assert.equal(transientAttempts, 2);

    const outageResponse = await fetch(`${baseUrl}/retailers/postcode`, {
      method: "POST",
      headers: { ...learnerHeaders, "content-type": "application/json" },
      body: JSON.stringify({ postcode: "OUTAGE" }),
    });
    assert.equal(outageResponse.status, 503);

    const importName = `Retailer import ${Date.now()}`;
    const importResponse = await fetch(`${baseUrl}/admin/retailers/import`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        rows: [
          retailerBody(importName, { postcode: "IM1 1AA", featured: true }),
          retailerBody(importName, { postcode: "IM1 1AA", address: "2 Test Road" }),
          retailerBody(`${importName.toUpperCase()} Ltd.`, {
            postcode: "IM1 1AA",
            address: "1 test road.",
          }),
          retailerBody(importName, { postcode: "IM1 1AA", address: "2 Test Road" }),
        ],
      }),
    });
    assert.equal(importResponse.status, 200);
    const imported = await importResponse.json() as {
      results: Array<{ status: string; retailer?: { id: number; featured: boolean } }>;
    };
    assert.deepEqual(
      imported.results.map((row) => row.status),
      ["created", "created", "duplicate", "duplicate"],
    );
    const importedId = imported.results[0].retailer?.id;
    assert.ok(importedId);
    assert.equal(imported.results[0].retailer?.featured, true);
    createdIds.push(importedId!);
    const secondBranchId = imported.results[1].retailer?.id;
    assert.ok(secondBranchId);
    assert.notEqual(secondBranchId, importedId);
    createdIds.push(secondBranchId!);

    const updateResponse = await fetch(`${baseUrl}/admin/retailers/${visible.id}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify(retailerBody(`Retailer updated ${Date.now()}`, {
        postcode: "NEWLOC",
        lat: 51.5,
        lng: -0.1,
        featured: true,
      })),
    });
    assert.equal(updateResponse.status, 200);
    const updated = await updateResponse.json() as {
      name: string;
      lat: number;
      lng: number;
      evidenceUrl: string;
      lastCheckedAt: string;
      verificationStatus: string;
      featured: boolean;
    };
    assert.equal(updated.name.startsWith("Retailer updated"), true);
    assert.deepEqual({ lat: updated.lat, lng: updated.lng }, { lat: 55, lng: -3 });
    assert.equal(updated.evidenceUrl, reverified.evidenceUrl);
    assert.equal(new Date(updated.lastCheckedAt).getTime(), new Date(reverified.lastCheckedAt).getTime());
    assert.equal(updated.verificationStatus, "verified");
    assert.equal(updated.featured, true);
    const updatedPublicFeedResponse = await fetch(`${baseUrl}/retailers/public`);
    assert.equal(updatedPublicFeedResponse.status, 200);
    const updatedPublicFeed = await updatedPublicFeedResponse.json() as Array<{
      id: number;
      name: string;
      postcode: string;
      lat: number;
      lng: number;
      featured: boolean;
    }>;
    const updatedPublicRetailer = updatedPublicFeed.find((retailer) => retailer.id === visible.id);
    assert.deepEqual(updatedPublicRetailer, {
      ...publicFeedVisible,
      name: updated.name,
      postcode: "NEWLOC",
      lat: updated.lat,
      lng: updated.lng,
      featured: updated.featured,
    });

    const noChangeFeaturedHistoryResponse = await fetch(
      `${baseUrl}/admin/retailers/${visible.id}/featured-history`,
      { headers: adminHeaders },
    );
    assert.equal(noChangeFeaturedHistoryResponse.status, 200);
    assert.deepEqual(await noChangeFeaturedHistoryResponse.json(), []);

    const unfeatureResponse = await fetch(`${baseUrl}/admin/retailers/${visible.id}`, {
      method: "PUT",
      headers: adminHeaders,
      body: JSON.stringify(retailerBody(updated.name, {
        postcode: "NEWLOC",
        lat: updated.lat,
        lng: updated.lng,
        featured: false,
         actorIdentity: "Client-supplied identity",
      })),
    });
    assert.equal(unfeatureResponse.status, 200);

    const featuredHistoryResponse = await fetch(
      `${baseUrl}/admin/retailers/${visible.id}/featured-history`,
      { headers: adminHeaders },
    );
    assert.equal(featuredHistoryResponse.status, 200);
    const featuredHistory = await featuredHistoryResponse.json() as Array<{
      retailerId: number;
      priorFeatured: boolean;
      newFeatured: boolean;
      actorIdentity: string | null;
      recordedAt: string;
    }>;
    assert.equal(featuredHistory.length, 1);
    assert.equal(featuredHistory[0]?.retailerId, visible.id);
    assert.equal(featuredHistory[0]?.priorFeatured, true);
    assert.equal(featuredHistory[0]?.newFeatured, false);
    assert.equal(featuredHistory[0]?.actorIdentity, "Shared administrator");
    assert.ok(Number.isFinite(new Date(featuredHistory[0]!.recordedAt).getTime()));
    assert.equal((await fetch(`${baseUrl}/admin/retailers/${visible.id}/featured-history`)).status, 401);

    const unchangedHistory = await fetch(`${baseUrl}/admin/retailers/${visible.id}/verification-history`, {
      headers: adminHeaders,
    });
    assert.equal(unchangedHistory.status, 200);
    assert.deepEqual(await unchangedHistory.json(), history);

    const deleteResponse = await fetch(`${baseUrl}/admin/retailers/${visible.id}`, {
      method: "DELETE",
      headers: { admintoken: token },
    });
    assert.equal(deleteResponse.status, 409);
    assert.match(
      String((await deleteResponse.json() as { error: string }).error),
      /verification history/,
    );
    const retainedHistoryResponse = await fetch(
      `${baseUrl}/admin/retailers/${visible.id}/verification-history`,
      { headers: adminHeaders },
    );
    assert.equal(retainedHistoryResponse.status, 200);
    assert.deepEqual(await retainedHistoryResponse.json(), history);
  } finally {
    if (createdIds.length > 0) {
      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      await client.query(
        "DELETE FROM chainsaw_retailer_reminder_attempt WHERE retailer_id = ANY($1::int[])",
        [createdIds],
      );
      await client.query(
        "DELETE FROM chainsaw_retailer_featured_history WHERE retailer_id = ANY($1::int[])",
        [createdIds],
      );
      await client.query(
        "DELETE FROM chainsaw_retailer_verification_history WHERE retailer_id = ANY($1::int[])",
        [createdIds],
      );
      await client.end();
    }
    const loginResponse = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "retailer-route-test-password" }),
    });
    if (loginResponse.ok) {
      const { token } = await loginResponse.json() as { token: string };
      await Promise.all(createdIds.map((id) => fetch(`${baseUrl}/admin/retailers/${id}`, {
        method: "DELETE",
        headers: { admintoken: token },
      })));
    }
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => server.once("exit", () => resolve()));
    await new Promise<void>((resolve, reject) => postcodeServer.close((error) => {
      if (error) reject(error);
      else resolve();
    }));
  }
});


test("concurrent retailer verification and detail updates preserve both audit chains", async () => {
  const port = 25000 + (process.pid % 1000);
  const server = spawn(process.execPath, ["dist/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      ADMIN_PASSWORD: "retailer-concurrency-test-password",
      SESSION_SECRET: "retailer-concurrency-test-session-secret",
      DEMO_MODE: "true",
      NODE_ENV: "test",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("API test server did not start")), 15_000);
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes("Server listening")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`API test server exited with code ${code}`));
    });
  });

  const baseUrl = `http://127.0.0.1:${port}/api`;
  let retailerId: number | undefined;

  try {
    const loginResponse = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "retailer-concurrency-test-password" }),
    });
    assert.equal(loginResponse.status, 200);
    const token = (await loginResponse.json() as { token: string }).token;
    const adminHeaders = { "content-type": "application/json", admintoken: token };

    const baselineEvidenceUrl = "https://example.com/concurrency-baseline";
    const createResponse = await fetch(`${baseUrl}/admin/retailers`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        name: `Concurrency retailer ${Date.now()}`,
        address: "1 Test Road",
        town: "London",
        county: "London",
        postcode: "",
        lat: 51.5,
        lng: -0.1,
        email: "concurrency@example.com",
        phone: "01234567890",
        active: true,
        featured: false,
        verificationStatus: "verified",
        evidenceUrl: baselineEvidenceUrl,
        lastCheckedAt: "2026-09-15T00:00:00.000Z",
      }),
    });
    assert.equal(createResponse.status, 200);
    retailerId = (await createResponse.json() as { id: number }).id;

    const evidenceUrls = [
      "https://example.com/concurrent-evidence-a",
      "https://example.com/concurrent-evidence-b",
    ];
    const ordinaryEditName = "Concurrent ordinary detail edit";
    const [reverifyAResponse, reverifyBResponse, ordinaryEditResponse] = await Promise.all([
      fetch(`${baseUrl}/admin/retailers/${retailerId}/reverify`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ evidenceUrl: evidenceUrls[0] }),
      }),
      fetch(`${baseUrl}/admin/retailers/${retailerId}/reverify`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ evidenceUrl: evidenceUrls[1] }),
      }),
      fetch(`${baseUrl}/admin/retailers/${retailerId}`, {
        method: "PUT",
        headers: adminHeaders,
        body: JSON.stringify({
          name: ordinaryEditName,
          address: "2 Updated Road",
          town: "Manchester",
          county: "Lancashire",
          postcode: "",
          lat: 53.48,
          lng: -2.24,
          email: "updated@example.com",
          phone: "01987654321",
          active: true,
          featured: true,
          verificationStatus: "rejected",
          evidenceUrl: "https://example.com/ordinary-edit-must-not-win",
          lastCheckedAt: "2020-01-01T00:00:00.000Z",
          notes: "Ordinary detail update completed alongside verification.",
        }),
      }),
    ]);

    assert.equal(reverifyAResponse.status, 200);
    assert.equal(reverifyBResponse.status, 200);
    assert.equal(ordinaryEditResponse.status, 200);

    const historyResponse = await fetch(
      `${baseUrl}/admin/retailers/${retailerId}/verification-history`,
      { headers: adminHeaders },
    );
    assert.equal(historyResponse.status, 200);
    const history = await historyResponse.json() as Array<{
      priorEvidenceUrl: string | null;
      priorCheckedAt: string | null;
      newEvidenceUrl: string;
      newCheckedAt: string;
      recordedAt: string;
    }>;
    assert.equal(history.length, 2);

    const chronologicalHistory = [...history].reverse();
    const firstEvent = chronologicalHistory[0];
    const secondEvent = chronologicalHistory[1];
    assert.ok(firstEvent);
    assert.ok(secondEvent);
    assert.equal(firstEvent.priorEvidenceUrl, baselineEvidenceUrl);
    assert.equal(firstEvent.priorCheckedAt, "2026-09-15T00:00:00.000Z");
    assert.notEqual(firstEvent.newEvidenceUrl, secondEvent.newEvidenceUrl);
    assert.deepEqual(
      new Set(chronologicalHistory.map((event) => event.newEvidenceUrl)),
      new Set(evidenceUrls),
    );
    assert.equal(secondEvent.priorEvidenceUrl, firstEvent.newEvidenceUrl);
    assert.equal(secondEvent.priorCheckedAt, firstEvent.newCheckedAt);
    assert.ok(new Date(firstEvent.recordedAt).getTime() <= new Date(secondEvent.recordedAt).getTime());

    const retailersResponse = await fetch(`${baseUrl}/admin/retailers`, {
      headers: adminHeaders,
    });
    assert.equal(retailersResponse.status, 200);
    const retailers = await retailersResponse.json() as Array<{
      id: number;
      name: string;
      evidenceUrl: string | null;
      lastCheckedAt: string | null;
      verificationStatus: string;
      featured: boolean;
    }>;
    const currentRetailer = retailers.find((retailer) => retailer.id === retailerId);
    assert.ok(currentRetailer);
    assert.equal(currentRetailer.name, ordinaryEditName);
    assert.equal(currentRetailer.featured, true);
    assert.equal(currentRetailer.verificationStatus, "verified");
    assert.equal(currentRetailer.evidenceUrl, secondEvent.newEvidenceUrl);
    assert.equal(currentRetailer.lastCheckedAt, secondEvent.newCheckedAt);

    const featuredHistoryResponse = await fetch(
      `${baseUrl}/admin/retailers/${retailerId}/featured-history`,
      { headers: adminHeaders },
    );
    assert.equal(featuredHistoryResponse.status, 200);
    const featuredHistory = await featuredHistoryResponse.json() as Array<{
      id: number;
      retailerId: number;
      priorFeatured: boolean;
      newFeatured: boolean;
      recordedAt: string;
    }>;
    assert.equal(featuredHistory.length, 1);
    assert.equal(featuredHistory[0]?.retailerId, retailerId);
    assert.equal(featuredHistory[0]?.priorFeatured, false);
    assert.equal(featuredHistory[0]?.newFeatured, true);
    assert.ok(Number.isFinite(new Date(featuredHistory[0]!.recordedAt).getTime()));
  } finally {
    if (retailerId) {
      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      await client.query(
        "DELETE FROM chainsaw_retailer_featured_history WHERE retailer_id = $1",
        [retailerId],
      );
      await client.query(
        "DELETE FROM chainsaw_retailer_verification_history WHERE retailer_id = $1",
        [retailerId],
      );
      await client.query("DELETE FROM chainsaw_retailers WHERE id = $1", [retailerId]);
      await client.end();
    }
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => server.once("exit", () => resolve()));
  }
});

test("concurrent retailer deletion and verification produce a complete documented outcome", async () => {
  const port = 26000 + (process.pid % 1000);
  const server = spawn(process.execPath, ["dist/index.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      ADMIN_PASSWORD: "retailer-delete-concurrency-test-password",
      SESSION_SECRET: "retailer-delete-concurrency-test-session-secret",
      DEMO_MODE: "true",
      NODE_ENV: "test",
      PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("API test server did not start")), 15_000);
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes("Server listening")) {
        clearTimeout(timeout);
        resolve();
      }
    };
    server.stdout.on("data", onData);
    server.stderr.on("data", onData);
    server.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`API test server exited with code ${code}`));
    });
  });

  const baseUrl = `http://127.0.0.1:${port}/api`;
  let retailerId: number | undefined;

  try {
    const loginResponse = await fetch(`${baseUrl}/admin/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: "retailer-delete-concurrency-test-password" }),
    });
    assert.equal(loginResponse.status, 200);
    const token = (await loginResponse.json() as { token: string }).token;
    const adminHeaders = { "content-type": "application/json", admintoken: token };

    const createResponse = await fetch(`${baseUrl}/admin/retailers`, {
      method: "POST",
      headers: adminHeaders,
      body: JSON.stringify({
        name: `Delete concurrency retailer ${Date.now()}`,
        address: "1 Test Road",
        town: "London",
        county: "London",
        postcode: "",
        lat: 51.5,
        lng: -0.1,
        email: "delete-concurrency@example.com",
        phone: "01234567890",
        active: true,
        featured: false,
        verificationStatus: "verified",
        evidenceUrl: "https://example.com/delete-concurrency-baseline",
        lastCheckedAt: "2026-09-15T00:00:00.000Z",
      }),
    });
    assert.equal(createResponse.status, 200);
    retailerId = (await createResponse.json() as { id: number }).id;

    const [deleteResponse, reverifyResponse] = await Promise.all([
      fetch(`${baseUrl}/admin/retailers/${retailerId}`, {
        method: "DELETE",
        headers: { admintoken: token },
      }),
      fetch(`${baseUrl}/admin/retailers/${retailerId}/reverify`, {
        method: "PATCH",
        headers: adminHeaders,
        body: JSON.stringify({ evidenceUrl: "https://example.com/delete-concurrency-new" }),
      }),
    ]);

    assert.notEqual(deleteResponse.status, 500);
    assert.notEqual(reverifyResponse.status, 500);

    const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    const retailerResult = await client.query(
      "SELECT evidence_url, last_checked_at FROM chainsaw_retailers WHERE id = $1",
      [retailerId],
    );
    const historyResult = await client.query(
      `SELECT prior_evidence_url, prior_checked_at, new_evidence_url, new_checked_at
       FROM chainsaw_retailer_verification_history
       WHERE retailer_id = $1`,
      [retailerId],
    );
    await client.end();

    if (deleteResponse.status === 200) {
      assert.equal(reverifyResponse.status, 404);
      assert.deepEqual(await reverifyResponse.json(), { error: "Retailer not found" });
      assert.equal(retailerResult.rowCount, 0);
      assert.equal(historyResult.rowCount, 0);
    } else {
      assert.equal(deleteResponse.status, 409);
      assert.equal(reverifyResponse.status, 200);
      assert.equal(retailerResult.rowCount, 1);
      assert.equal(historyResult.rowCount, 1);
      assert.equal(retailerResult.rows[0].evidence_url, "https://example.com/delete-concurrency-new");
      assert.equal(historyResult.rows[0].prior_evidence_url, "https://example.com/delete-concurrency-baseline");
      assert.equal(
        new Date(historyResult.rows[0].prior_checked_at).toISOString(),
        "2026-09-15T00:00:00.000Z",
      );
      assert.equal(historyResult.rows[0].new_evidence_url, "https://example.com/delete-concurrency-new");
      assert.equal(
        new Date(historyResult.rows[0].new_checked_at).getTime(),
        new Date(retailerResult.rows[0].last_checked_at).getTime(),
      );
    }
  } finally {
    if (retailerId) {
      const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      await client.query(
        "DELETE FROM chainsaw_retailer_verification_history WHERE retailer_id = $1",
        [retailerId],
      );
      await client.query("DELETE FROM chainsaw_retailers WHERE id = $1", [retailerId]);
      await client.end();
    }
    server.kill("SIGTERM");
    await new Promise<void>((resolve) => server.once("exit", () => resolve()));
  }
});