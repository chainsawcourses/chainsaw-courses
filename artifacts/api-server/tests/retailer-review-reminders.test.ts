import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { createRequire } from "node:module";

const requireFromDb = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const pg = requireFromDb("pg");

const NOW = new Date("2026-09-15T12:00:00.000Z");
const DAY_MS = 86_400_000;
type RetailerReviewThreshold = "due" | "overdue";

function checkedDaysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS);
}

test("retailer review reminders are threshold-specific, deduplicated, retryable and visibility-neutral", async () => {
  const bundlePath = new URL(`./.retailer-reminder-test-${process.pid}.mjs`, import.meta.url);
  const ids: number[] = [];
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  const deliveries: Array<{ name: string; threshold: RetailerReviewThreshold }> = [];

  try {
    await build({
      entryPoints: [new URL("../src/lib/retailerReviewReminders.ts", import.meta.url).pathname],
      bundle: true,
      platform: "node",
      format: "esm",
      outfile: bundlePath.pathname,
      external: ["nodemailer", "pino", "pino-pretty", "thread-stream"],
      banner: {
        js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);",
      },
    });
    const { runRetailerReviewReminders } = await import(`${bundlePath.href}?v=${Date.now()}`) as {
      runRetailerReviewReminders: (
        now: Date,
        deliver: (candidate: { name: string }, threshold: RetailerReviewThreshold) => Promise<boolean>,
        candidateIds?: number[],
        afterClaim?: (
          candidates: Array<{ id: number; name: string }>,
          threshold: RetailerReviewThreshold,
        ) => Promise<void>,
      ) => Promise<void>;
    };
    await client.connect();
    const suffix = `${process.pid}-${Date.now()}`;
    const fixtures = [
      [`CurrentBoundary ${suffix}`, true, "verified", new Date(checkedDaysAgo(150).getTime() + 1)],
      [`DueBoundary ${suffix}`, true, "verified", checkedDaysAgo(150)],
      [`Due ${suffix}`, true, "verified", new Date(checkedDaysAgo(180).getTime() + 1)],
      [`OverdueBoundary ${suffix}`, true, "verified", checkedDaysAgo(180)],
      [`Failed ${suffix}`, true, "verified", checkedDaysAgo(160)],
      [`Reverified ${suffix}`, true, "verified", checkedDaysAgo(160)],
      [`Stale ${suffix}`, true, "verified", checkedDaysAgo(160)],
      [`Inactive ${suffix}`, false, "verified", checkedDaysAgo(190)],
      [`Pending ${suffix}`, true, "pending", checkedDaysAgo(190)],
    ] as const;
    for (const [name, active, verificationStatus, lastCheckedAt] of fixtures) {
      const result = await client.query<{ id: number }>(
        `INSERT INTO chainsaw_retailers
          (name, address, town, county, postcode, lat, lng, email, phone, active, verification_status, last_checked_at)
         VALUES ($1, '1 Reminder Road', 'Test Town', 'Testshire', 'TE1 1ST', 51.5, -0.1,
           'retailer@example.com', '01234567890', $2, $3, $4)
         RETURNING id`,
        [name, active, verificationStatus, lastCheckedAt],
      );
      ids.push(result.rows[0]!.id);
    }
    await client.query(
      `UPDATE chainsaw_retailers
       SET review_due_reminder_claimed_at = $1
       WHERE name = $2`,
      [new Date(NOW.getTime() - 31 * 60 * 1_000), `Stale ${suffix}`],
    );

    await Promise.all([
      runRetailerReviewReminders(NOW, async (candidate, threshold) => {
        deliveries.push({ name: candidate.name, threshold });
        if (candidate.name.startsWith("Reverified ")) {
          await client.query(
            `UPDATE chainsaw_retailers
             SET last_checked_at = $1,
                 review_due_reminder_sent_at = NULL,
                 review_due_reminder_failed_at = NULL
             WHERE name = $2`,
            [NOW, candidate.name],
          );
        }
        if (candidate.name.startsWith("Failed ")) {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
        return !candidate.name.startsWith("Failed ");
      }, ids),
      runRetailerReviewReminders(NOW, async (candidate, threshold) => {
        deliveries.push({ name: candidate.name, threshold });
        if (candidate.name.startsWith("Reverified ")) {
          await client.query(
            `UPDATE chainsaw_retailers
             SET last_checked_at = $1,
                 review_due_reminder_sent_at = NULL,
                 review_due_reminder_failed_at = NULL
             WHERE name = $2`,
            [NOW, candidate.name],
          );
        }
        return !candidate.name.startsWith("Failed ");
      }, ids),
    ]);
    assert.deepEqual(
      deliveries
        .map(({ name, threshold }) => ({ name: name.split(" ")[0], threshold }))
        .sort((a, b) => a.name.localeCompare(b.name)),
      [
        { name: "Due", threshold: "due" },
        { name: "DueBoundary", threshold: "due" },
        { name: "Failed", threshold: "due" },
        { name: "OverdueBoundary", threshold: "overdue" },
        { name: "Reverified", threshold: "due" },
        { name: "Stale", threshold: "due" },
      ].sort((a, b) => a.name.localeCompare(b.name)),
    );
    const failedAttempt = await client.query<{
      review_due_reminder_failed_at: Date | null;
      review_due_reminder_sent_at: Date | null;
    }>(
      `SELECT review_due_reminder_failed_at, review_due_reminder_sent_at
       FROM chainsaw_retailers WHERE name = $1`,
      [`Failed ${suffix}`],
    );
    assert.ok(failedAttempt.rows[0]?.review_due_reminder_failed_at instanceof Date);
    assert.equal(failedAttempt.rows[0]?.review_due_reminder_sent_at, null);

    const reverifiedAttempt = await client.query<{
      review_due_reminder_claimed_at: Date | null;
      review_due_reminder_sent_at: Date | null;
      outcome: string;
    }>(
      `SELECT r.review_due_reminder_claimed_at,
              r.review_due_reminder_sent_at,
              a.outcome
       FROM chainsaw_retailers r
       JOIN chainsaw_retailer_reminder_attempt a ON a.retailer_id = r.id
       WHERE r.name = $1`,
      [`Reverified ${suffix}`],
    );
    assert.equal(reverifiedAttempt.rows[0]?.review_due_reminder_claimed_at, null);
    assert.equal(reverifiedAttempt.rows[0]?.review_due_reminder_sent_at, null);
    assert.equal(reverifiedAttempt.rows[0]?.outcome, "sent");

    const preDeliveryName = `PreDeliveryReverified ${suffix}`;
    const preDeliveryFixture = await client.query<{ id: number }>(
      `INSERT INTO chainsaw_retailers
        (name, address, town, county, postcode, lat, lng, email, phone, active, verification_status, last_checked_at)
       VALUES ($1, '1 Reminder Road', 'Test Town', 'Testshire', 'TE1 1ST', 51.5, -0.1,
         'retailer@example.com', '01234567890', true, 'verified', $2)
       RETURNING id`,
      [preDeliveryName, checkedDaysAgo(160)],
    );
    const preDeliveryId = preDeliveryFixture.rows[0]!.id;
    ids.push(preDeliveryId);
    let preDeliveryInvoked = false;
    await runRetailerReviewReminders(
      NOW,
      async () => {
        preDeliveryInvoked = true;
        return true;
      },
      [preDeliveryId],
      async (candidates, threshold) => {
        if (threshold === "due" && candidates.some((candidate) => candidate.id === preDeliveryId)) {
          await client.query(
            "UPDATE chainsaw_retailers SET last_checked_at = $1 WHERE id = $2",
            [NOW, preDeliveryId],
          );
        }
      },
    );
    assert.equal(preDeliveryInvoked, false);
    const supersededClaim = await client.query<{
      review_due_reminder_claimed_at: Date | null;
      attempts: number;
    }>(
      `SELECT r.review_due_reminder_claimed_at, COUNT(a.id)::int AS attempts
       FROM chainsaw_retailers r
       LEFT JOIN chainsaw_retailer_reminder_attempt a ON a.retailer_id = r.id
       WHERE r.id = $1
       GROUP BY r.id`,
      [preDeliveryId],
    );
    assert.equal(supersededClaim.rows[0]?.review_due_reminder_claimed_at, null);
    assert.equal(supersededClaim.rows[0]?.attempts, 0);

    deliveries.length = 0;
    await runRetailerReviewReminders(NOW, async (candidate, threshold) => {
      deliveries.push({ name: candidate.name, threshold });
      return true;
    }, ids);
    assert.deepEqual(
      deliveries.map(({ name, threshold }) => ({ name: name.split(" ")[0], threshold })),
      [{ name: "Failed", threshold: "due" }],
    );
    const recoveredAttempt = await client.query<{
      review_due_reminder_failed_at: Date | null;
      review_due_reminder_sent_at: Date | null;
    }>(
      `SELECT review_due_reminder_failed_at, review_due_reminder_sent_at
       FROM chainsaw_retailers WHERE name = $1`,
      [`Failed ${suffix}`],
    );
    assert.equal(recoveredAttempt.rows[0]?.review_due_reminder_failed_at, null);
    assert.ok(recoveredAttempt.rows[0]?.review_due_reminder_sent_at instanceof Date);

    const attempts = await client.query<{
      threshold: RetailerReviewThreshold;
      outcome: "sent" | "failed";
      attempted_at: Date;
    }>(
      `SELECT threshold, outcome, attempted_at
       FROM chainsaw_retailer_reminder_attempt
       WHERE retailer_id = $1
       ORDER BY attempted_at, id`,
      [ids[4]],
    );
    assert.deepEqual(attempts.rows.map(({ threshold, outcome }) => ({ threshold, outcome })), [
      { threshold: "due", outcome: "failed" },
      { threshold: "due", outcome: "sent" },
    ]);
    assert.ok(attempts.rows.every((attempt) => attempt.attempted_at instanceof Date));

    deliveries.length = 0;
    await runRetailerReviewReminders(NOW, async (candidate, threshold) => {
      deliveries.push({ name: candidate.name, threshold });
      return true;
    }, ids);
    assert.deepEqual(deliveries, []);

    const records = await client.query<{
      name: string;
      active: boolean;
      review_overdue_reminder_sent_at: Date | null;
    }>(
      `SELECT name, active, review_overdue_reminder_sent_at
       FROM chainsaw_retailers WHERE id = ANY($1::int[])`,
      [ids],
    );
    assert.equal(records.rows.find((row) => row.name.startsWith("Due "))?.active, true);
    assert.equal(records.rows.find((row) => row.name.startsWith("OverdueBoundary "))?.active, true);
    assert.equal(records.rows.find((row) => row.name.startsWith("Inactive "))?.review_overdue_reminder_sent_at, null);
    assert.equal(records.rows.find((row) => row.name.startsWith("Pending "))?.review_overdue_reminder_sent_at, null);
  } finally {
    if (ids.length) {
      await client.query(
        "DELETE FROM chainsaw_retailer_reminder_attempt WHERE retailer_id = ANY($1::int[])",
        [ids],
      );
      await client.query("DELETE FROM chainsaw_retailers WHERE id = ANY($1::int[])", [ids]);
    }
    if (client.connectionParameters) await client.end().catch(() => {});
    await rm(bundlePath, { force: true });
  }
});