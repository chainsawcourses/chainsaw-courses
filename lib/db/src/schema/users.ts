import { pgTable, text, serial, timestamp, boolean, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activationCodesTable = pgTable("activation_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  isUsed: boolean("is_used").notNull().default(false),
  isUnlimited: boolean("is_unlimited").notNull().default(false),
  allModulesUnlocked: boolean("all_modules_unlocked").notNull().default(false),
  isPaused: boolean("is_paused").notNull().default(false),
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  activationCode: text("activation_code").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  deviceId: text("device_id").notNull(),
  activatedAt: timestamp("activated_at").notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at"),
  deletedAt: timestamp("deleted_at"),
  // Access window management
  accessExpiresAt: timestamp("access_expires_at"),        // null = unlimited (demo/admin codes)
  courseCompletedAt: timestamp("course_completed_at"),    // set when exam is first passed
  certificateIssuedAt: timestamp("certificate_issued_at"),// set with courseCompletedAt
  subscriptionExpiresAt: timestamp("subscription_expires_at"), // set when £2.99/mo sub paid
  // The learner is durable across purchases. Course state belongs to the
  // selected enrolment; this pointer is only the current-course convenience
  // lookup and is intentionally nullable for legacy rows during backfill.
  currentEnrollmentId: integer("current_enrollment_id"),
});

/**
 * A learner's individual CPD/course entitlement. Do not collapse these rows:
 * one learner may purchase the course repeatedly and every purchase is a
 * separate, independently auditable course attempt and certificate.
 *
 * This table deliberately lives beside users rather than replacing users.
 * Existing installations can therefore add it with Drizzle publish and have
 * the compatibility service associate old rows lazily.
 */
export const courseEnrolmentsTable = pgTable("course_enrolments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  purchaseCode: text("purchase_code").notNull(),
  activationCode: text("activation_code").notNull(),
  activatedAt: timestamp("activated_at").notNull().defaultNow(),
  accessExpiresAt: timestamp("access_expires_at"),
  courseCompletedAt: timestamp("course_completed_at"),
  certificateIssuedAt: timestamp("certificate_issued_at"),
  status: text("status").notNull().default("active"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  // Captures whether this came from an unlimited/reviewer entitlement or a
  // normal six-month purchase without changing the shared-code semantics.
  accessType: text("access_type").notNull().default("paid"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  // Shared unlimited codes (for example CHAIN) legitimately occur on many
  // enrolments. Paid purchase codes are unique because activation_codes.code
  // is unique and a consumed code must be idempotent.
  uniqueIndex("course_enrolments_paid_purchase_code_idx")
    .on(t.purchaseCode)
    .where(sql`${t.accessType} = 'paid'`),
  index("course_enrolments_purchase_code_idx").on(t.purchaseCode),
  index("course_enrolments_user_id_idx").on(t.userId),
  index("course_enrolments_user_status_idx").on(t.userId, t.status),
]);

export const waiversTable = pgTable("waivers", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").notNull(),
  enrollmentId: integer("enrollment_id"),
  signatureData: text("signature_data").notNull(),
  agreedToTerms: boolean("agreed_to_terms").notNull().default(true),
  signedAt: timestamp("signed_at").notNull().defaultNow(),
  pdfPath: text("pdf_path"),
  clausesSnapshot: text("clauses_snapshot"),
}, (t) => [
  uniqueIndex("waivers_user_enrollment_idx")
    .on(t.userId, t.enrollmentId)
    .where(sql`${t.enrollmentId} IS NOT NULL`),
]);

export const insertActivationCodeSchema = createInsertSchema(activationCodesTable).omit({ id: true, createdAt: true });
export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, activatedAt: true, lastActivityAt: true, deletedAt: true });
export const insertWaiverSchema = createInsertSchema(waiversTable).omit({ id: true, signedAt: true });
export const insertCourseEnrolmentSchema = createInsertSchema(courseEnrolmentsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type ActivationCode = typeof activationCodesTable.$inferSelect;
export type User = typeof usersTable.$inferSelect;
export type CourseEnrolment = typeof courseEnrolmentsTable.$inferSelect;
export type Waiver = typeof waiversTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertCourseEnrolment = z.infer<typeof insertCourseEnrolmentSchema>;
