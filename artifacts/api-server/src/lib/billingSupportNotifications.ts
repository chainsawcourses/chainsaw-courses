import {
  db,
  billingSupportNotificationsTable,
  learnerSubscriptionsTable,
  subscriptionBillingEventsTable,
  subscriptionDeliveryAttemptsTable,
} from "@workspace/db";
import { and, eq, gte, lte, or, sql } from "drizzle-orm";
import { buildBillingAlerts, type BillingAlert } from "./billingAlerts";
import { sendEmail } from "./email";
import { logger } from "./logger";
import crypto from "node:crypto";

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL?.trim() || "info@chainsawcourses.com";
const TEST_ALERT_SCOPE = process.env.NODE_ENV === "test"
  ? process.env.BILLING_NOTIFICATION_TEST_SCOPE?.trim() || null
  : null;

export function warnIfBillingNotificationTestScopeIsConfigured(): void {
  if (
    process.env.NODE_ENV !== "test"
    && Object.hasOwn(process.env, "BILLING_NOTIFICATION_TEST_SCOPE")
  ) {
    logger.warn(
      { setting: "BILLING_NOTIFICATION_TEST_SCOPE" },
      "Test-only billing notification scope is configured outside the test environment; reconciliation will remain unfiltered",
    );
  }
}

function notificationScopeCondition() {
  return TEST_ALERT_SCOPE
    ? sql`position(${TEST_ALERT_SCOPE} in ${billingSupportNotificationsTable.alertId}) > 0`
    : undefined;
}

function safeReference(alert: BillingAlert): string {
  if (alert.userId !== null) return `Learner ID ${alert.userId}`;
  return `Support reference ${crypto.createHash("sha256").update(alert.id).digest("hex").slice(0, 12)}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function deliver(alert: BillingAlert, recovered: boolean): Promise<boolean> {
  const state = recovered ? "Resolved" : "Urgent";
  const subject = `[Billing alert ${state}] ${alert.title}`;
  const text = [
    `${state} billing support alert`,
    "",
    alert.title,
    alert.description,
    safeReference(alert),
    "",
    recovered
      ? "The condition is no longer present. The existing support alert can be closed."
      : "Open the admin billing dashboard to investigate.",
  ].join("\n");
  const html = `<h2>${escapeHtml(state)} billing support alert</h2><p><strong>${escapeHtml(alert.title)}</strong></p><p>${escapeHtml(alert.description)}</p><p>${escapeHtml(safeReference(alert))}</p><p>${recovered ? "The condition is no longer present. The existing support alert can be closed." : "Open the admin billing dashboard to investigate."}</p>`;
  return sendEmail({ to: SUPPORT_EMAIL, subject, text, html });
}

async function runBillingSupportNotificationReconciliation(): Promise<void> {
  try {
    const alerts = await db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT pg_advisory_xact_lock(hashtext('billing-support-notifications'))
      `);

      const now = new Date();
      const recent = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const attempts = await tx.select().from(subscriptionDeliveryAttemptsTable)
        .where(gte(subscriptionDeliveryAttemptsTable.receivedAt, recent));
      const subscriptions = await tx.select().from(learnerSubscriptionsTable);
      const events = await tx.select().from(subscriptionBillingEventsTable);
      const currentAlerts = buildBillingAlerts({ attempts, subscriptions, events }, now)
        .filter((alert) =>
          alert.severity === "high"
          && (!TEST_ALERT_SCOPE || alert.id.includes(TEST_ALERT_SCOPE))
        );
      const active = new Map(currentAlerts.map((alert) => [alert.id, alert]));
      const existing = await tx.select().from(billingSupportNotificationsTable)
        .where(notificationScopeCondition());

      for (const alert of currentAlerts) {
        const previous = existing.find((row) => row.alertId === alert.id);
        if (previous?.status === "open") continue;
        if (previous?.status === "resolved") {
          await tx.update(billingSupportNotificationsTable).set({
            alertType: alert.type,
            userId: alert.userId,
            providerEventId: alert.providerEventId,
            title: alert.title,
            description: alert.description,
            status: "open",
            openDeliveryStatus: "pending",
            openDeliveryError: null,
            openDeliveryAttempts: 0,
            resolutionDeliveryStatus: null,
            resolutionDeliveryError: null,
            resolutionDeliveryAttempts: 0,
            openedAt: new Date(),
            resolvedAt: null,
            updatedAt: new Date(),
          }).where(eq(billingSupportNotificationsTable.id, previous.id));
          continue;
        }
        await tx.insert(billingSupportNotificationsTable).values({
          alertId: alert.id,
          alertType: alert.type,
          userId: alert.userId,
          providerEventId: alert.providerEventId,
          title: alert.title,
          description: alert.description,
          status: "open",
          openDeliveryStatus: "pending",
        });
      }

      for (const row of existing) {
        if (row.status !== "open" || active.has(row.alertId)) continue;
        await tx.update(billingSupportNotificationsTable).set({
          status: "resolved",
          resolvedAt: new Date(),
          resolutionDeliveryStatus: row.openDeliveryStatus === "sent" ? "pending" : "not_required",
          updatedAt: new Date(),
        }).where(eq(billingSupportNotificationsTable.id, row.id));
      }
      return currentAlerts;
    });
    const active = new Map(alerts.map((alert) => [alert.id, alert]));

    const retryCutoff = new Date(Date.now() - 5 * 60 * 1000);
    const staleSendingCutoff = new Date(Date.now() - 10 * 60 * 1000);
    await db.update(billingSupportNotificationsTable).set({
      openDeliveryStatus: "pending",
      updatedAt: new Date(),
    }).where(and(
      notificationScopeCondition(),
      eq(billingSupportNotificationsTable.status, "open"),
      or(
        and(
          eq(billingSupportNotificationsTable.openDeliveryStatus, "failed"),
          lte(billingSupportNotificationsTable.updatedAt, retryCutoff),
        ),
        and(
          eq(billingSupportNotificationsTable.openDeliveryStatus, "sending"),
          lte(billingSupportNotificationsTable.updatedAt, staleSendingCutoff),
        ),
      ),
      sql`${billingSupportNotificationsTable.openDeliveryAttempts} < 8`,
    ));
    await db.update(billingSupportNotificationsTable).set({
      resolutionDeliveryStatus: "pending",
      updatedAt: new Date(),
    }).where(and(
      notificationScopeCondition(),
      eq(billingSupportNotificationsTable.status, "resolved"),
      or(
        and(
          eq(billingSupportNotificationsTable.resolutionDeliveryStatus, "failed"),
          lte(billingSupportNotificationsTable.updatedAt, retryCutoff),
        ),
        and(
          eq(billingSupportNotificationsTable.resolutionDeliveryStatus, "sending"),
          lte(billingSupportNotificationsTable.updatedAt, staleSendingCutoff),
        ),
      ),
      sql`${billingSupportNotificationsTable.resolutionDeliveryAttempts} < 8`,
    ));

    const pending = await db.select().from(billingSupportNotificationsTable)
      .where(notificationScopeCondition());
    for (const row of pending) {
      const isResolution = row.status === "resolved" && row.resolutionDeliveryStatus === "pending";
      const isOpening = row.status === "open" && row.openDeliveryStatus === "pending";
      if (!isOpening && !isResolution) continue;
      const [claimed] = await db.update(billingSupportNotificationsTable).set({
        ...(isResolution
          ? {
              resolutionDeliveryStatus: "sending",
              resolutionDeliveryAttempts: sql`${billingSupportNotificationsTable.resolutionDeliveryAttempts} + 1`,
            }
          : {
              openDeliveryStatus: "sending",
              openDeliveryAttempts: sql`${billingSupportNotificationsTable.openDeliveryAttempts} + 1`,
            }),
        updatedAt: new Date(),
      }).where(and(
        eq(billingSupportNotificationsTable.id, row.id),
        eq(billingSupportNotificationsTable.status, isResolution ? "resolved" : "open"),
        isResolution
          ? eq(billingSupportNotificationsTable.resolutionDeliveryStatus, "pending")
          : eq(billingSupportNotificationsTable.openDeliveryStatus, "pending"),
      )).returning({ id: billingSupportNotificationsTable.id });
      if (!claimed) continue;
      const alert = active.get(row.alertId) ?? {
        id: row.alertId,
        type: row.alertType as BillingAlert["type"],
        severity: "high" as const,
        title: row.title,
        description: row.description,
        userId: row.userId,
        providerEventId: row.providerEventId,
        createdAt: row.openedAt.toISOString(),
      };
      const sent = await deliver(alert, isResolution);
      if (isResolution) {
        await db.update(billingSupportNotificationsTable).set({
          resolutionDeliveryStatus: sent ? "sent" : "failed",
          resolutionDeliveryError: sent ? null : "email_delivery_failed",
          updatedAt: new Date(),
        }).where(and(
          eq(billingSupportNotificationsTable.id, row.id),
          eq(billingSupportNotificationsTable.status, "resolved"),
          eq(billingSupportNotificationsTable.resolutionDeliveryStatus, "sending"),
        ));
      } else {
        await db.update(billingSupportNotificationsTable).set({
          openDeliveryStatus: sent ? "sent" : "failed",
          openDeliveryError: sent ? null : "email_delivery_failed",
          resolutionDeliveryStatus: sent
            ? sql`CASE WHEN ${billingSupportNotificationsTable.status} = 'resolved' THEN 'pending' ELSE ${billingSupportNotificationsTable.resolutionDeliveryStatus} END`
            : billingSupportNotificationsTable.resolutionDeliveryStatus,
          updatedAt: new Date(),
        }).where(and(
          eq(billingSupportNotificationsTable.id, row.id),
          eq(billingSupportNotificationsTable.openDeliveryStatus, "sending"),
        ));
      }
      if (!sent) logger.error({ alertId: row.alertId, phase: isResolution ? "resolution" : "opening" }, "Billing support notification delivery failed");
    }
  } catch (error) {
    logger.error({ err: error }, "Could not reconcile billing support notifications");
  }
}

let reconciliationInFlight: Promise<void> | null = null;
let reconciliationRerunRequested = false;

export function reconcileBillingSupportNotifications(): Promise<void> {
  reconciliationRerunRequested = true;
  if (reconciliationInFlight) return reconciliationInFlight;

  reconciliationInFlight = (async () => {
    while (true) {
      reconciliationRerunRequested = false;
      await runBillingSupportNotificationReconciliation();
      if (!reconciliationRerunRequested) {
        reconciliationInFlight = null;
        return;
      }
    }
  })();
  return reconciliationInFlight;
}