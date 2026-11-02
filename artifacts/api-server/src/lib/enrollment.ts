import {
  courseEnrolmentsTable,
  activationCodesTable,
  examAttemptsTable,
  moduleFeedbackTable,
  quizAttemptsTable,
  userProgressTable,
  usersTable,
  videoEngagementTable,
  waiversTable,
  type CourseEnrolment,
  type User,
} from "@workspace/db";
import { and, asc, eq, isNull, ne, or, sql } from "drizzle-orm";
import {
  certificateIdentity,
  compatibleLearnerName,
  deviceBondDecision,
  normalizeLearnerEmail,
  shouldCreateEnrollment,
  mergeLegacyProgress,
} from "./enrollmentDecisions";

export {
  certificateIdentity,
  compatibleLearnerName,
  deviceBondDecision,
  normalizeLearnerEmail,
  normalizeLearnerName,
  shouldCreateEnrollment,
} from "./enrollmentDecisions";

/**
 * The database transaction type is intentionally structural. Drizzle's
 * transaction and database objects expose the same query methods used here,
 * which lets this compatibility operation run atomically in either context.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbExecutor = any;

/**
 * Lazily upgrades one pre-enrolment learner. This is deliberately called from
 * authentication/admin access instead of process startup: production schema
 * changes are owned by Drizzle publish, while this operation is safe to run
 * repeatedly after the columns/table exist.
 */
export async function ensureCurrentEnrollment(
  tx: DbExecutor,
  user: User,
): Promise<CourseEnrolment | null> {
  if (user.id === 0) return null;

  // Every caller must observe the same learner snapshot. This prevents two
  // concurrent first-auth requests from both deciding that backfill is needed.
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"enrollment-user:" + user.id}))`);
  const existing = await tx
    .select()
    .from(courseEnrolmentsTable)
    .where(and(
      eq(courseEnrolmentsTable.userId, user.id),
      eq(courseEnrolmentsTable.isDeleted, false),
    ))
    .orderBy(asc(courseEnrolmentsTable.createdAt), asc(courseEnrolmentsTable.id));
  // A valid pointer is authoritative. Legacy rows without one use the newest
  // enrolment, so a backfill can never silently reactivate the oldest purchase.
  const current = existing.find((enrollment: CourseEnrolment) => enrollment.id === user.currentEnrollmentId)
    ?? [...existing].sort((a: CourseEnrolment, b: CourseEnrolment) =>
      b.createdAt.getTime() - a.createdAt.getTime() || b.id - a.id)[0];

  if (current) {
    if (user.currentEnrollmentId !== current.id) {
      await tx.update(usersTable)
        .set({ currentEnrollmentId: current.id })
        .where(eq(usersTable.id, user.id));
    }
  await reconcileLegacyRows(tx, user.id, current.id);
    return current;
  }

  const [activation] = await tx.select({ isUnlimited: activationCodesTable.isUnlimited })
    .from(activationCodesTable)
    .where(or(
      eq(activationCodesTable.code, user.activationCode),
      eq(activationCodesTable.code, user.activationCode.trim().toUpperCase()),
    ))
    .limit(1);
  const accessType = activation?.isUnlimited ? "unlimited" : "paid";
  const [legacy] = await tx.insert(courseEnrolmentsTable).values({
    userId: user.id,
    purchaseCode: user.activationCode,
    activationCode: user.activationCode,
    activatedAt: user.activatedAt,
    accessExpiresAt: user.accessExpiresAt,
    courseCompletedAt: user.courseCompletedAt,
    certificateIssuedAt: user.certificateIssuedAt,
    accessType,
    status: user.accessExpiresAt && user.accessExpiresAt <= new Date() ? "expired" : "active",
  }).returning();

  if (!legacy) return null;
  await tx.update(usersTable)
    .set({ currentEnrollmentId: legacy.id })
    .where(eq(usersTable.id, user.id));
  await reconcileLegacyRows(tx, user.id, legacy.id);
  return legacy;
}

/**
 * Legacy rows were written without a cycle key. Reconcile before assigning the
 * key so the partial progress/waiver indexes can never reject first login.
 * This runs under ensureCurrentEnrollment's per-user advisory lock.
 */
export async function reconcileLegacyRows(tx: DbExecutor, userId: number, enrollmentId: number): Promise<void> {
  const scopedProgress = await tx.select().from(userProgressTable).where(and(
    eq(userProgressTable.userId, userId),
    or(isNull(userProgressTable.enrollmentId), eq(userProgressTable.enrollmentId, enrollmentId)),
  ));
  type LegacyProgress = typeof userProgressTable.$inferSelect;
  type LegacyWaiver = typeof waiversTable.$inferSelect;
  const progressByModule = new Map<number, LegacyProgress[]>();
  for (const row of scopedProgress) {
    const rows = progressByModule.get(row.moduleId) ?? [];
    rows.push(row);
    progressByModule.set(row.moduleId, rows);
  }
  for (const rows of progressByModule.values()) {
    const merged = mergeLegacyProgress(rows);
    const canonical = rows.find((row) => row.id === merged.canonicalId)!;
    // Delete every duplicate before assigning the key. This is important when
    // a partially migrated row already has this enrolmentId: updating a null
    // row first would transiently violate the partial unique index.
    for (const duplicate of rows.filter((row) => row.id !== merged.canonicalId)) {
      await tx.delete(userProgressTable).where(eq(userProgressTable.id, duplicate.id));
    }
    await tx.update(userProgressTable).set({
      enrollmentId,
      videoCompleted: merged.videoCompleted,
      quizPassed: merged.quizPassed,
      quizScore: merged.quizScore,
      lastTimestamp: merged.lastTimestamp,
      completedAt: merged.completedAt,
      updatedAt: merged.updatedAt,
    }).where(eq(userProgressTable.id, canonical.id));
  }

  const scopedWaivers = await tx.select().from(waiversTable).where(and(
    eq(waiversTable.userId, userId),
    or(isNull(waiversTable.enrollmentId), eq(waiversTable.enrollmentId, enrollmentId)),
  ));
  const validWaivers = scopedWaivers
    .filter((waiver: LegacyWaiver) => waiver.agreedToTerms && waiver.signatureData.trim().length > 0)
    .sort((a: LegacyWaiver, b: LegacyWaiver) => b.signedAt.getTime() - a.signedAt.getTime() || b.id - a.id);
  const canonicalWaiver = validWaivers[0] ?? scopedWaivers
    .slice()
    .sort((a: LegacyWaiver, b: LegacyWaiver) => b.signedAt.getTime() - a.signedAt.getTime() || b.id - a.id)[0];
  if (canonicalWaiver) {
    // Keep older signed PDFs as null-scoped evidence, but clear any previous
    // target rows before assigning the selected canonical row.
    await tx.update(waiversTable)
      .set({ enrollmentId: null })
      .where(and(
        eq(waiversTable.userId, userId),
        eq(waiversTable.enrollmentId, enrollmentId),
        ne(waiversTable.id, canonicalWaiver.id),
      ));
    await tx.update(waiversTable).set({ enrollmentId }).where(eq(waiversTable.id, canonicalWaiver.id));
  }

  const scopedTables = [
    videoEngagementTable,
    moduleFeedbackTable,
    examAttemptsTable,
    quizAttemptsTable,
  ] as const;

  for (const table of scopedTables) {
    await tx.update(table)
      .set({ enrollmentId })
      .where(and(eq(table.userId, userId), isNull(table.enrollmentId)));
  }
}


export function enrollmentIsActive(
  enrollment: Pick<CourseEnrolment, "accessExpiresAt" | "status" | "isDeleted">,
  now = new Date(),
): boolean {
  if (enrollment.isDeleted || enrollment.status === "deleted" || enrollment.status === "revoked") return false;
  return enrollment.accessExpiresAt === null || enrollment.accessExpiresAt > now;
}
