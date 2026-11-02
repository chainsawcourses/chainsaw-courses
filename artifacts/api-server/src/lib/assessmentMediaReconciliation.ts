import { db, assessmentMediaReconciliationHealthTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { logger } from "./logger";
import {
  recordAssessmentMediaReconciliation as recordReconciliation,
  type AssessmentMediaReconciliationStatus,
  type AssessmentMediaStatusRecorder,
} from "./assessmentMediaReconciliationState";

export {
  ASSESSMENT_MEDIA_FAILURE_WARNING_THRESHOLD,
  assessmentMediaCleanupHealth,
} from "./assessmentMediaReconciliationState";

const HEALTH_KEY = "orphan-cleanup";

async function ensureAssessmentMediaHealthTable(): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS assessment_media_reconciliation_health (
      key TEXT PRIMARY KEY,
      last_attempt_at TIMESTAMPTZ NOT NULL,
      last_success_at TIMESTAMPTZ,
      last_failure_at TIMESTAMPTZ,
      last_removed_count INTEGER NOT NULL DEFAULT 0,
      consecutive_failures INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

const databaseStatusRecorder: AssessmentMediaStatusRecorder = {
  async success(removedCount, at) {
    await ensureAssessmentMediaHealthTable();
    await db.insert(assessmentMediaReconciliationHealthTable).values({
      key: HEALTH_KEY,
      lastAttemptAt: at,
      lastSuccessAt: at,
      lastRemovedCount: removedCount,
      consecutiveFailures: 0,
      updatedAt: at,
    }).onConflictDoUpdate({
      target: assessmentMediaReconciliationHealthTable.key,
      set: {
        lastAttemptAt: at,
        lastSuccessAt: at,
        lastRemovedCount: removedCount,
        consecutiveFailures: 0,
        updatedAt: at,
      },
    });
  },
  async failure(at) {
    await ensureAssessmentMediaHealthTable();
    await db.insert(assessmentMediaReconciliationHealthTable).values({
      key: HEALTH_KEY,
      lastAttemptAt: at,
      lastFailureAt: at,
      consecutiveFailures: 1,
      updatedAt: at,
    }).onConflictDoUpdate({
      target: assessmentMediaReconciliationHealthTable.key,
      set: {
        lastAttemptAt: at,
        lastFailureAt: at,
        consecutiveFailures: sql`${assessmentMediaReconciliationHealthTable.consecutiveFailures} + 1`,
        updatedAt: at,
      },
    });
  },
};

export async function recordAssessmentMediaReconciliation(
  run: () => Promise<number>,
  recorder: AssessmentMediaStatusRecorder = databaseStatusRecorder,
  now: () => Date = () => new Date(),
): Promise<void> {
  await recordReconciliation(
    async () => {
      const removedCount = await run();
      if (removedCount > 0) logger.info({ removed: removedCount }, "Removed orphaned assessment media");
      return removedCount;
    },
    recorder,
    now,
    err => logger.error({ err }, "Assessment media reconciliation failed; will retry"),
    err => logger.error({ err }, "Could not persist assessment media reconciliation failure"),
  );
}

export async function getAssessmentMediaReconciliationStatus(): Promise<AssessmentMediaReconciliationStatus> {
  await ensureAssessmentMediaHealthTable();
  const [row] = await db.select().from(assessmentMediaReconciliationHealthTable)
    .where(eq(assessmentMediaReconciliationHealthTable.key, HEALTH_KEY))
    .limit(1);
  return row ?? {
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastRemovedCount: 0,
    consecutiveFailures: 0,
  };
}