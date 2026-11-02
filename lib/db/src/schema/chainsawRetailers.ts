import { boolean, index, integer, pgTable, real, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * The independent retailer directory is deliberately separate from
 * assessment_venues. Retailers are public directory records and have their
 * own verification lifecycle.
 */
export const chainsawRetailersTable = pgTable("chainsaw_retailers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  address: text("address").notNull(),
  town: text("town").notNull(),
  county: text("county").notNull(),
  postcode: text("postcode").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  website: text("website"),
  logoObjectKey: text("logo_object_key"),
  active: boolean("active").notNull().default(true),
  featured: boolean("featured").notNull().default(false),
  verificationStatus: text("verification_status").notNull().default("pending"),
  evidenceUrl: text("evidence_url"),
  lastCheckedAt: timestamp("last_checked_at"),
  reviewDueReminderClaimedAt: timestamp("review_due_reminder_claimed_at"),
  reviewDueReminderSentAt: timestamp("review_due_reminder_sent_at"),
  reviewDueReminderFailedAt: timestamp("review_due_reminder_failed_at"),
  reviewOverdueReminderClaimedAt: timestamp("review_overdue_reminder_claimed_at"),
  reviewOverdueReminderSentAt: timestamp("review_overdue_reminder_sent_at"),
  reviewOverdueReminderFailedAt: timestamp("review_overdue_reminder_failed_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("chainsaw_retailers_active_verification_idx").on(table.active, table.verificationStatus),
  index("chainsaw_retailers_featured_name_idx").on(table.featured, table.name),
  index("chainsaw_retailers_postcode_idx").on(table.postcode),
]);

export const chainsawRetailerVerificationHistoryTable = pgTable("chainsaw_retailer_verification_history", {
  id: serial("id").primaryKey(),
  retailerId: integer("retailer_id")
    .notNull()
    .references(() => chainsawRetailersTable.id),
  priorEvidenceUrl: text("prior_evidence_url"),
  priorCheckedAt: timestamp("prior_checked_at", { withTimezone: true }),
  newEvidenceUrl: text("new_evidence_url").notNull(),
  newCheckedAt: timestamp("new_checked_at", { withTimezone: true }).notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("chainsaw_retailer_verification_history_retailer_recorded_idx")
    .on(table.retailerId, table.recordedAt),
]);

export const chainsawRetailerFeaturedHistoryTable = pgTable("chainsaw_retailer_featured_history", {
  id: serial("id").primaryKey(),
  retailerId: integer("retailer_id")
    .notNull()
    .references(() => chainsawRetailersTable.id),
  priorFeatured: boolean("prior_featured").notNull(),
  newFeatured: boolean("new_featured").notNull(),
  actorIdentity: text("actor_identity"),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("chainsaw_retailer_featured_history_retailer_recorded_idx")
    .on(table.retailerId, table.recordedAt),
]);

export const chainsawRetailerReminderAttemptTable = pgTable("chainsaw_retailer_reminder_attempt", {
  id: serial("id").primaryKey(),
  retailerId: integer("retailer_id")
    .notNull()
    .references(() => chainsawRetailersTable.id),
  threshold: text("threshold").notNull(),
  outcome: text("outcome").notNull(),
  attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("chainsaw_retailer_reminder_attempt_retailer_attempted_idx")
    .on(table.retailerId, table.attemptedAt),
]);

export const insertChainsawRetailerSchema = createInsertSchema(chainsawRetailersTable)
  .omit({ id: true, createdAt: true, updatedAt: true });

export type ChainsawRetailer = typeof chainsawRetailersTable.$inferSelect;
export type InsertChainsawRetailer = z.infer<typeof insertChainsawRetailerSchema>;
export type ChainsawRetailerVerificationHistory =
  typeof chainsawRetailerVerificationHistoryTable.$inferSelect;
export type ChainsawRetailerFeaturedHistory =
  typeof chainsawRetailerFeaturedHistoryTable.$inferSelect;
export type ChainsawRetailerReminderAttempt =
  typeof chainsawRetailerReminderAttemptTable.$inferSelect;

// Short aliases keep the directory convenient to consume while the explicit
// names above make its separation from assessment venues unambiguous.
export const retailersTable = chainsawRetailersTable;
export const insertRetailerSchema = insertChainsawRetailerSchema;
export type Retailer = ChainsawRetailer;
export type InsertRetailer = InsertChainsawRetailer;