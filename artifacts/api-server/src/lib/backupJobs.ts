import { AppConnectors as ReplitConnectors } from "./appConnectors";
import { and, desc, eq, sql } from "drizzle-orm";
import { backupExportsTable, backupRunsTable, db, pool, type BackupRun } from "@workspace/db";
import { createReadableBackup, type ReadableBackupResult } from "./readableBackup";
import { logger } from "./logger";
import { backupFailureMessage, londonBackupDateKey, shouldRunScheduledBackup } from "./backupSchedulePolicy";
import { releaseBackupAdvisoryLock, tryAcquireBackupAdvisoryLock } from "./backupAdvisoryLock";
import { observeBackupConnection, reconcileUnownedBackupRuns, recoverBackupOwnership } from "./backupLockLease";

const STALE_BACKUP_AFTER_MS = 6 * 60 * 60 * 1000;

type LockClient = NonNullable<Parameters<Parameters<typeof pool.connect>[0]>[1]>;
type BackupSource = "manual" | "scheduled";
const backupLeases = new WeakMap<LockClient, ReturnType<typeof observeBackupConnection>>();

async function acquireBackupLock(): Promise<LockClient | null> {
  const client = await pool.connect();
  const lease = observeBackupConnection(client, () =>
    logger.error("Readable backup lost its database lock connection"));
  try {
    if (!await tryAcquireBackupAdvisoryLock(client)) {
      await lease.stopHeartbeat();
      lease.release();
      return null;
    }
    lease.assertHeld();
    backupLeases.set(client, lease);
    return client;
  } catch (error) {
    await lease.stopHeartbeat();
    lease.release(true);
    throw error;
  }
}

async function releaseBackupLock(client: LockClient): Promise<void> {
  const lease = backupLeases.get(client);
  await lease?.stopHeartbeat();
  let destroy = lease?.lost ?? false;
  try {
    if (!destroy) await releaseBackupAdvisoryLock(client);
  } catch (error) {
    destroy = true;
    logger.error({ err: error }, "Failed to release readable-backup advisory lock");
  } finally {
    backupLeases.delete(client);
    if (lease) lease.release(destroy);
    else client.release(true);
  }
}

async function markInterruptedBackups(client: LockClient): Promise<void> {
  backupLeases.get(client)?.assertHeld();
  // Use the lock-owning connection itself: if it drops, this UPDATE cannot run on
  // another connection after ownership has been lost.
  const result = await client.query(
    `UPDATE backup_runs SET state = 'failed', finished_at = NOW(), error = $1
     WHERE state = 'running' RETURNING id`,
    ["The backup was interrupted before completion. No active backup process remains. Retry using Backup all data."],
  );
  if (result.rowCount) logger.warn({ count: result.rowCount }, "Recovered interrupted backup status");
}

async function latestRun(source?: BackupSource): Promise<BackupRun | null> {
  const query = db.select().from(backupRunsTable);
  const rows = await (source
    ? query.where(eq(backupRunsTable.source, source))
    : query
  ).orderBy(desc(backupRunsTable.startedAt)).limit(1);
  return rows[0] ?? null;
}

async function deleteUploadedBackup(result: ReadableBackupResult): Promise<void> {
  let failed = false;
  for (const id of [...result.driveFileIds].reverse()) {
    const removed = await new ReplitConnectors().proxy("google-drive", `/drive/v3/files/${id}`, { method: "DELETE" });
    if (!removed.ok) failed = true;
  }
  if (failed) throw new Error("Backup audit failed; one or more temporary Drive files could not be removed");
}

async function performBackup(run: BackupRun, client: LockClient): Promise<void> {
  let uploaded: ReadableBackupResult | null = null;
  let failure = "The readable backup failed before verification. Check the API logs and retry.";
  const ensureOwnership = async () => {
    if (backupLeases.get(client)?.lost) {
      client = await recoverBackupOwnership(client, {
        acquire: acquireBackupLock,
        release: releaseBackupLock,
        isStillRunning: async (replacement) => {
          const current = await replacement.query("SELECT state FROM backup_runs WHERE id = $1", [run.id]);
          return current.rows[0]?.state === "running";
        },
      });
      logger.info({ runId: run.id }, "Backup safely reacquired its database lock");
    }
    backupLeases.get(client)?.assertHeld();
  };
  const reportProgress = async (message: string) => {
    await ensureOwnership();
    await db.update(backupRunsTable).set({
      result: sql`jsonb_build_object('progress', ${message}::text, 'updatedAt', ${new Date().toISOString()}::text)`,
    }).where(and(eq(backupRunsTable.id, run.id), eq(backupRunsTable.state, "running")));
  };
  try {
    await reportProgress("Reading user records and creating readable Google Sheets");
    uploaded = await createReadableBackup(undefined, ensureOwnership, reportProgress);
    await ensureOwnership();
    await db.transaction(async (tx) => {
      backupLeases.get(client)?.assertHeld();
      await tx.insert(backupExportsTable).values({
        title: uploaded!.title,
        sheetUrl: uploaded!.url,
        folderId: uploaded!.folderId,
        rowCount: uploaded!.counts.learners,
      });
      const [updatedRun] = await tx.update(backupRunsTable).set({
        state: "succeeded",
        finishedAt: new Date(),
        error: null,
        result: uploaded,
      }).where(and(eq(backupRunsTable.id, run.id), eq(backupRunsTable.state, "running"))).returning();
      if (!updatedRun) throw new Error("Backup run history could not be updated");
      backupLeases.get(client)?.assertHeld();
    });
    logger.info({ runId: run.id, counts: uploaded.counts }, "Verified readable backup saved to Drive");
    return;
  } catch (error) {
    if (uploaded) {
      try {
        await deleteUploadedBackup(uploaded);
      } catch (cleanupError) {
        logger.error({ runId: run.id, err: cleanupError }, "Failed to remove an untracked readable backup");
        failure = backupFailureMessage(cleanupError instanceof Error ? cleanupError.message : "");
      }
    }
    if (failure === "The readable backup failed before verification. Check the API logs and retry.") {
      failure = backupFailureMessage(error instanceof Error ? error.message : "");
    }
    logger.error({ runId: run.id, source: run.source, err: error }, "Readable backup failed");
    try {
      await db.update(backupRunsTable).set({
        state: "failed",
        finishedAt: new Date(),
        error: failure,
      }).where(eq(backupRunsTable.id, run.id));
    } catch (recordError) {
      logger.error({ runId: run.id, err: recordError }, "Could not record readable backup failure");
    }
  } finally {
    await releaseBackupLock(client);
  }
}

export async function startManualBackup(): Promise<
  { started: true; run: BackupRun } | { started: false; error: string; run?: BackupRun | null }
> {
  const client = await acquireBackupLock();
  if (!client) {
    return {
      started: false,
      error: "A backup is already running. Wait for it to finish, then refresh the status.",
      run: await latestRun(),
    };
  }

  let handedOffToBackup = false;
  try {
    await markInterruptedBackups(client);
    const [run] = await db.insert(backupRunsTable).values({
      source: "manual",
      state: "running",
    }).returning();
    // Hold the authenticated HTTP request open so Autoscale cannot idle this job
    // immediately after an early 202 response.
    handedOffToBackup = true;
    await performBackup(run, client);
    const [finishedRun] = await db.select().from(backupRunsTable)
      .where(eq(backupRunsTable.id, run.id)).limit(1);
    if (!finishedRun) throw new Error("Backup run history is unavailable");
    return { started: true, run: finishedRun };
  } catch (error) {
    if (!handedOffToBackup) await releaseBackupLock(client);
    throw error;
  }
}

export async function runScheduledBackupIfDue(): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;

  const client = await acquireBackupLock().catch((error) => {
    logger.error({ err: error }, "Could not acquire automated backup lock");
    return null;
  });
  if (!client) return;

  let handedOffToBackup = false;
  try {
    await markInterruptedBackups(client);
    const now = new Date();
    const scheduleKey = londonBackupDateKey(now);
    const [scheduledToday] = await db.select({ scheduleKey: backupRunsTable.scheduleKey })
      .from(backupRunsTable)
      .where(eq(backupRunsTable.scheduleKey, scheduleKey))
      .limit(1);
    if (!shouldRunScheduledBackup(now, scheduledToday?.scheduleKey ?? null)) {
      return;
    }

    const [run] = await db.insert(backupRunsTable).values({
      source: "scheduled",
      state: "running",
      scheduleKey,
    }).onConflictDoNothing({ target: backupRunsTable.scheduleKey }).returning();
    if (!run) return;
    handedOffToBackup = true;
    await performBackup(run, client).catch((error) =>
      logger.error({ runId: run.id, err: error }, "Unexpected scheduled backup task failure"));
  } catch (error) {
    logger.error({ err: error }, "Could not start automated readable backup");
  } finally {
    if (!handedOffToBackup) await releaseBackupLock(client);
  }
}

/** Minimal job state for external triggers; never exposes learner data or file URLs. */
export async function getScheduledBackupRun(dateKey: string): Promise<
  { state: "running" | "succeeded" | "failed" } | null
> {
  const [run] = await db.select({ state: backupRunsTable.state })
    .from(backupRunsTable).where(eq(backupRunsTable.scheduleKey, dateKey)).limit(1);
  if (!run) return null;
  if (run.state === "running" || run.state === "succeeded" || run.state === "failed") {
    return { state: run.state };
  }
  throw new Error("The daily backup has an unrecognised state.");
}

/** Used by a Replit Scheduled Deployment so the process waits until every Drive file is verified. */
export async function runScheduledBackupOnce(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    throw new Error("Scheduled backups must run in the production environment");
  }
  const scheduleKey = londonBackupDateKey(new Date());
  const deadline = Date.now() + STALE_BACKUP_AFTER_MS;
  while (Date.now() < deadline) {
    await runScheduledBackupIfDue();
    const [run] = await db.select({
      state: backupRunsTable.state,
      error: backupRunsTable.error,
    }).from(backupRunsTable).where(eq(backupRunsTable.scheduleKey, scheduleKey)).limit(1);
    if (run?.state === "succeeded") return;
    if (run?.state === "failed") {
      throw new Error(run.error ?? "Today's scheduled backup failed.");
    }
    // Another instance may own the advisory lock; retry after it has finished.
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  throw new Error("Today's scheduled backup did not complete within six hours.");
}

export async function getLatestBackupRun(): Promise<BackupRun | null> {
  const run = await latestRun();
  if (!run || run.state !== "running") return run;
  await reconcileUnownedBackupRuns({
    acquire: acquireBackupLock,
    recover: markInterruptedBackups,
    release: releaseBackupLock,
  });
  return latestRun();
}

export async function getLatestReadableBackupRun(): Promise<BackupRun | null> {
  const [run] = await db.select().from(backupRunsTable).where(and(
    eq(backupRunsTable.state, "succeeded"),
    sql`${backupRunsTable.result}->>'format' = 'readable'`,
  )).orderBy(desc(backupRunsTable.startedAt)).limit(1);
  return run ?? null;
}
