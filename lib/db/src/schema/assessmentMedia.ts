import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const assessmentMediaReconciliationHealthTable = pgTable("assessment_media_reconciliation_health", {
  key: text("key").primaryKey(),
  lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }).notNull(),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
  lastRemovedCount: integer("last_removed_count").notNull().default(0),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AssessmentMediaReconciliationHealth =
  typeof assessmentMediaReconciliationHealthTable.$inferSelect;