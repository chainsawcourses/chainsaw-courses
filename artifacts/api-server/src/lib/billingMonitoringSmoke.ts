import { db } from "@workspace/db";
import {
  learnerSubscriptionsTable,
  subscriptionBillingEventsTable,
  subscriptionDeliveryAttemptsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { buildBillingAlerts } from "./billingAlerts";

const REQUIRED_COLUMNS = {
  learner_subscriptions: [
    "user_id",
    "provider",
    "provider_customer_id",
    "provider_subscription_id",
    "status",
    "paid_through_at",
    "cancel_at_period_end",
    "last_event_occurred_at",
    "last_event_sequence",
  ],
  subscription_billing_events: [
    "provider_event_id",
    "provider",
    "provider_customer_id",
    "provider_subscription_id",
    "user_id",
    "event_type",
    "event_occurred_at",
    "event_sequence",
    "status",
    "paid_through_at",
    "paid_through_at_provided",
    "cancel_at_period_end",
    "payload",
    "received_at",
  ],
  subscription_delivery_attempts: [
    "provider_event_id",
    "provider",
    "learner_id",
    "learner_email",
    "event_type",
    "event_occurred_at",
    "outcome",
    "http_status",
    "duplicate",
    "applied",
    "error_code",
    "received_at",
  ],
  billing_support_notifications: [
    "alert_id",
    "alert_type",
    "user_id",
    "provider_event_id",
    "title",
    "description",
    "status",
    "open_delivery_status",
    "open_delivery_error",
    "open_delivery_attempts",
    "resolution_delivery_status",
    "resolution_delivery_error",
    "resolution_delivery_attempts",
    "opened_at",
    "resolved_at",
    "updated_at",
  ],
} as const;

const REQUIRED_INDEXES = {
  subscription_billing_events_provider_event_id_unique: {
    table: "subscription_billing_events",
    columns: ["provider_event_id"],
    unique: true,
  },
  subscription_billing_events_user_idx: {
    table: "subscription_billing_events",
    columns: ["user_id"],
    unique: false,
  },
  subscription_billing_events_subscription_idx: {
    table: "subscription_billing_events",
    columns: ["provider_subscription_id"],
    unique: false,
  },
  subscription_delivery_attempts_event_idx: {
    table: "subscription_delivery_attempts",
    columns: ["provider_event_id"],
    unique: false,
  },
  subscription_delivery_attempts_received_idx: {
    table: "subscription_delivery_attempts",
    columns: ["received_at"],
    unique: false,
  },
  subscription_delivery_attempts_outcome_idx: {
    table: "subscription_delivery_attempts",
    columns: ["outcome"],
    unique: false,
  },
  subscription_delivery_attempts_learner_idx: {
    table: "subscription_delivery_attempts",
    columns: ["learner_id"],
    unique: false,
  },
  billing_support_notifications_alert_id_unique: {
    table: "billing_support_notifications",
    columns: ["alert_id"],
    unique: true,
  },
  billing_support_notifications_status_idx: {
    table: "billing_support_notifications",
    columns: ["status"],
    unique: false,
  },
  billing_support_notifications_delivery_idx: {
    table: "billing_support_notifications",
    columns: ["open_delivery_status"],
    unique: false,
  },
} as const;

class SmokeRollback extends Error {}

export type BillingMonitoringSmokeResult = {
  schema: "ok";
  alertOpened: true;
  alertCleared: true;
  retainedRows: 0;
};

export async function runBillingMonitoringSmokeCheck(): Promise<BillingMonitoringSmokeResult> {
  const schemaResult = await db.execute(sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name IN (
        'learner_subscriptions',
        'subscription_billing_events',
        'subscription_delivery_attempts',
        'billing_support_notifications'
      )
  `);
  const presentColumns = new Set(
    schemaResult.rows.map((row) => `${String(row.table_name)}.${String(row.column_name)}`),
  );
  const missingColumns = Object.entries(REQUIRED_COLUMNS).flatMap(([table, columns]) =>
    columns
      .filter((column) => !presentColumns.has(`${table}.${column}`))
      .map((column) => `${table}.${column}`),
  );

  const indexResult = await db.execute(sql`
    SELECT
      idx.relname AS index_name,
      tbl.relname AS table_name,
      am.amname AS access_method,
      i.indisunique AS is_unique,
      i.indisvalid AS is_valid,
      i.indisready AS is_ready,
      i.indpred IS NULL AND i.indexprs IS NULL AS is_plain,
      array_agg(att.attname ORDER BY key.ordinality) AS columns
    FROM pg_index i
    JOIN pg_class idx ON idx.oid = i.indexrelid
    JOIN pg_class tbl ON tbl.oid = i.indrelid
    JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
    JOIN pg_am am ON am.oid = idx.relam
    JOIN unnest(i.indkey) WITH ORDINALITY AS key(attnum, ordinality) ON true
    JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = key.attnum
    WHERE ns.nspname = current_schema()
      AND idx.relname IN (
        'subscription_billing_events_provider_event_id_unique',
        'subscription_billing_events_user_idx',
        'subscription_billing_events_subscription_idx',
        'subscription_delivery_attempts_event_idx',
        'subscription_delivery_attempts_received_idx',
        'subscription_delivery_attempts_outcome_idx',
        'subscription_delivery_attempts_learner_idx',
        'billing_support_notifications_alert_id_unique',
        'billing_support_notifications_status_idx',
        'billing_support_notifications_delivery_idx'
      )
    GROUP BY idx.relname, tbl.relname, am.amname, i.indisunique, i.indisvalid,
      i.indisready, i.indpred, i.indexprs
  `);
  const presentIndexes = new Map(indexResult.rows.map((row) => [String(row.index_name), row]));
  const invalidIndexes = Object.entries(REQUIRED_INDEXES).flatMap(([name, expected]) => {
    const actual = presentIndexes.get(name);
    const actualColumns = Array.isArray(actual?.columns)
      ? actual.columns.map(String)
      : typeof actual?.columns === "string"
        ? actual.columns.replace(/^\{|\}$/g, "").split(",").filter(Boolean)
        : [];
    const valid = actual &&
      actual.table_name === expected.table &&
      actual.access_method === "btree" &&
      actual.is_valid === true &&
      actual.is_ready === true &&
      actual.is_plain === true &&
      actual.is_unique === expected.unique &&
      actualColumns.length === expected.columns.length &&
      actualColumns.every((column, index) => column === expected.columns[index]);
    return valid ? [] : [name];
  });
  if (missingColumns.length || invalidIndexes.length) {
    throw new Error(
      `Billing monitoring schema is incomplete (missing columns: ${missingColumns.join(", ") || "none"}; missing or invalid indexes: ${invalidIndexes.join(", ") || "none"})`,
    );
  }

  const marker = `billing-monitoring-smoke-${crypto.randomUUID()}`;
  let verified = false;
  try {
    await db.transaction(async (tx) => {
      const now = new Date();
      await tx.insert(subscriptionDeliveryAttemptsTable).values({
        providerEventId: marker,
        provider: "release-smoke",
        eventType: "subscription.smoke",
        eventOccurredAt: now,
        outcome: "ambiguous_learner",
        httpStatus: 409,
        errorCode: "ambiguous_learner",
      });

      const [failedAttempts, subscriptions, events] = await Promise.all([
        tx.select().from(subscriptionDeliveryAttemptsTable)
          .where(eq(subscriptionDeliveryAttemptsTable.providerEventId, marker)),
        tx.select().from(learnerSubscriptionsTable),
        tx.select().from(subscriptionBillingEventsTable),
      ]);
      const alertId = `ambiguous-match:release-smoke:${marker}`;
      const opened = buildBillingAlerts({
        attempts: failedAttempts,
        subscriptions,
        events,
      }, now).some((alert) => alert.id === alertId);
      if (!opened) throw new Error("Synthetic billing alert did not appear");

      await tx.insert(subscriptionDeliveryAttemptsTable).values({
        providerEventId: marker,
        provider: "release-smoke",
        eventType: "subscription.smoke",
        eventOccurredAt: now,
        outcome: "accepted",
        httpStatus: 200,
        applied: false,
      });
      const recoveredAttempts = await tx.select().from(subscriptionDeliveryAttemptsTable)
        .where(eq(subscriptionDeliveryAttemptsTable.providerEventId, marker));
      const cleared = !buildBillingAlerts({
        attempts: recoveredAttempts,
        subscriptions,
        events,
      }, now).some((alert) => alert.id === alertId);
      if (!cleared) throw new Error("Synthetic billing alert did not clear");

      verified = true;
      throw new SmokeRollback("Rollback successful smoke check");
    });
  } catch (error) {
    if (!(error instanceof SmokeRollback) || !verified) throw error;
  }

  const retained = await db.select({ id: subscriptionDeliveryAttemptsTable.id })
    .from(subscriptionDeliveryAttemptsTable)
    .where(eq(subscriptionDeliveryAttemptsTable.providerEventId, marker));
  if (retained.length !== 0) throw new Error("Synthetic billing smoke data was retained");

  return {
    schema: "ok",
    alertOpened: true,
    alertCleared: true,
    retainedRows: 0,
  };
}