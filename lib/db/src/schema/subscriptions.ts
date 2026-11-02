import { pgTable, text, serial, timestamp, integer, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * The subscription is deliberately learner-scoped rather than enrolment-scoped.
 * It grants access to course materials only; progress, waivers and certificates
 * remain attached to the learner's selected course enrolment.
 */
export const learnerSubscriptionsTable = pgTable("learner_subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  provider: text("provider").notNull(),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  status: text("status").notNull().default("inactive"),
  paidThroughAt: timestamp("paid_through_at", { withTimezone: true }),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
  lastEventOccurredAt: timestamp("last_event_occurred_at", { withTimezone: true }),
  lastEventSequence: integer("last_event_sequence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex("learner_subscriptions_provider_customer_idx")
    .on(t.provider, t.providerCustomerId)
    .where(sql`${t.providerCustomerId} IS NOT NULL`),
  uniqueIndex("learner_subscriptions_provider_subscription_idx")
    .on(t.provider, t.providerSubscriptionId)
    .where(sql`${t.providerSubscriptionId} IS NOT NULL`),
  index("learner_subscriptions_status_idx").on(t.status),
]);

/**
 * Immutable provider event receipt ledger. Provider event IDs are the
 * idempotency key; event ordering fields allow late delivery to be recorded
 * without regressing subscription state.
 */
export const subscriptionBillingEventsTable = pgTable("subscription_billing_events", {
  id: serial("id").primaryKey(),
  providerEventId: text("provider_event_id").notNull().unique(),
  provider: text("provider").notNull(),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  userId: integer("user_id"),
  eventType: text("event_type").notNull(),
  eventOccurredAt: timestamp("event_occurred_at", { withTimezone: true }).notNull(),
  eventSequence: integer("event_sequence"),
  status: text("status").notNull(),
  paidThroughAt: timestamp("paid_through_at", { withTimezone: true }),
  paidThroughAtProvided: boolean("paid_through_at_provided").notNull().default(false),
  cancelAtPeriodEnd: boolean("cancel_at_period_end"),
  payload: text("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("subscription_billing_events_user_idx").on(t.userId),
  index("subscription_billing_events_subscription_idx").on(t.providerSubscriptionId),
]);

/**
 * Delivery attempts are deliberately separate from the immutable billing
 * event history. Providers retry the same event, and an authenticated
 * request can fail before an event is eligible for the history table (for
 * example when an email matches more than one learner). This ledger contains
 * only routing and outcome metadata; it never stores the authentication
 * secret or the request payload.
 */
export const subscriptionDeliveryAttemptsTable = pgTable("subscription_delivery_attempts", {
  id: serial("id").primaryKey(),
  providerEventId: text("provider_event_id").notNull(),
  provider: text("provider").notNull(),
  providerCustomerId: text("provider_customer_id"),
  providerSubscriptionId: text("provider_subscription_id"),
  learnerId: integer("learner_id"),
  learnerEmail: text("learner_email"),
  eventType: text("event_type").notNull(),
  eventOccurredAt: timestamp("event_occurred_at", { withTimezone: true }),
  outcome: text("outcome").notNull(),
  httpStatus: integer("http_status").notNull(),
  duplicate: boolean("duplicate").notNull().default(false),
  applied: boolean("applied").notNull().default(false),
  errorCode: text("error_code"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("subscription_delivery_attempts_event_idx").on(t.providerEventId),
  index("subscription_delivery_attempts_received_idx").on(t.receivedAt),
  index("subscription_delivery_attempts_outcome_idx").on(t.outcome),
  index("subscription_delivery_attempts_learner_idx").on(t.learnerId),
]);

export const billingSupportNotificationsTable = pgTable("billing_support_notifications", {
  id: serial("id").primaryKey(),
  alertId: text("alert_id").notNull().unique(),
  alertType: text("alert_type").notNull(),
  userId: integer("user_id"),
  providerEventId: text("provider_event_id"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"),
  openDeliveryStatus: text("open_delivery_status").notNull().default("pending"),
  openDeliveryError: text("open_delivery_error"),
  openDeliveryAttempts: integer("open_delivery_attempts").notNull().default(0),
  resolutionDeliveryStatus: text("resolution_delivery_status"),
  resolutionDeliveryError: text("resolution_delivery_error"),
  resolutionDeliveryAttempts: integer("resolution_delivery_attempts").notNull().default(0),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("billing_support_notifications_status_idx").on(t.status),
  index("billing_support_notifications_delivery_idx").on(t.openDeliveryStatus),
]);

export const insertLearnerSubscriptionSchema = createInsertSchema(learnerSubscriptionsTable)
  .omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionBillingEventSchema = createInsertSchema(subscriptionBillingEventsTable)
  .omit({ id: true, receivedAt: true });
export const insertSubscriptionDeliveryAttemptSchema = createInsertSchema(subscriptionDeliveryAttemptsTable)
  .omit({ id: true, receivedAt: true });

export type LearnerSubscription = typeof learnerSubscriptionsTable.$inferSelect;
export type SubscriptionBillingEvent = typeof subscriptionBillingEventsTable.$inferSelect;
export type SubscriptionDeliveryAttempt = typeof subscriptionDeliveryAttemptsTable.$inferSelect;
export type InsertLearnerSubscription = z.infer<typeof insertLearnerSubscriptionSchema>;
export type InsertSubscriptionBillingEvent = z.infer<typeof insertSubscriptionBillingEventSchema>;
export type InsertSubscriptionDeliveryAttempt = z.infer<typeof insertSubscriptionDeliveryAttemptSchema>;