import { pgTable, text, timestamp, integer, index, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

// Apple-signed transaction identities are not learner credentials. Keep the
// payment ledger separate from the existing course and session model.
export const applePurchasesTable = pgTable("apple_purchases", {
  transactionId: text("transaction_id").primaryKey(),
  originalTransactionId: text("original_transaction_id").notNull(),
  productId: text("product_id").notNull(),
  environment: text("environment").notNull(),
  appAccountToken: uuid("app_account_token").notNull(),
  userId: integer("user_id"),
  enrollmentId: integer("enrollment_id"),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  // Erasure removes the learner link, but never makes a used transaction
  // claimable by a different person.
  erasedAt: timestamp("erased_at", { withTimezone: true }),
}, t => [index("apple_purchases_user_idx").on(t.userId)]);

export const applePurchaseIntentsTable = pgTable("apple_purchase_intents", {
  id: uuid("id").primaryKey(),
  secretHash: text("secret_hash").notNull(),
  appAccountToken: uuid("app_account_token").notNull().unique(),
  deviceId: text("device_id").notNull(),
  userId: integer("user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

export const appleIdentityChallengesTable = pgTable("apple_identity_challenges", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  fullName: text("full_name").notNull(),
  deviceId: text("device_id").notNull(),
  requestHash: text("request_hash").notNull(),
  codeHash: text("code_hash").notNull(),
  attempts: integer("attempts").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, t => [index("apple_identity_email_created_idx").on(t.email, t.createdAt)]);

export const insertApplePurchaseSchema = createInsertSchema(applePurchasesTable);
export type ApplePurchase = typeof applePurchasesTable.$inferSelect;
