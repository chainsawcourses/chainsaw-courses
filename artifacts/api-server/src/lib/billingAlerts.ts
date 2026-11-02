import { db } from "@workspace/db";
import {
  learnerSubscriptionsTable,
  subscriptionBillingEventsTable,
  subscriptionDeliveryAttemptsTable,
} from "@workspace/db";
import { gte } from "drizzle-orm";

export type BillingAlert = {
  id: string;
  type: "delivery_failure" | "ambiguous_match" | "expiry_without_renewal";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  userId: number | null;
  providerEventId: string | null;
  createdAt: string;
};

type AlertInputs = {
  attempts: (typeof subscriptionDeliveryAttemptsTable.$inferSelect)[];
  subscriptions: (typeof learnerSubscriptionsTable.$inferSelect)[];
  events: (typeof subscriptionBillingEventsTable.$inferSelect)[];
};

export function buildBillingAlerts(
  { attempts, subscriptions, events }: AlertInputs,
  now = new Date(),
): BillingAlert[] {
  const expiryWindow = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const alerts: BillingAlert[] = [];
  const attemptsByEvent = new Map<string, typeof attempts>();
  for (const attempt of attempts) {
    const key = `${attempt.provider}:${attempt.providerEventId}`;
    const values = attemptsByEvent.get(key) ?? [];
    values.push(attempt);
    attemptsByEvent.set(key, values);
  }
  for (const [key, values] of attemptsByEvent) {
    const latest = values.reduce((a, b) => a.id > b.id ? a : b);
    const failureCount = values.filter((attempt) =>
      !["accepted", "duplicate", "stale"].includes(attempt.outcome),
    ).length;
    if (failureCount < 3 || ["accepted", "duplicate", "stale"].includes(latest.outcome)) continue;
    alerts.push({
      id: `delivery-failure:${key}`,
      type: "delivery_failure",
      severity: "high",
      title: "Repeated subscription delivery failure",
      description: `${failureCount} authenticated deliveries for ${latest.eventType} have failed in the last 7 days (${latest.outcome.replaceAll("_", " ")}).`,
      userId: latest.learnerId,
      providerEventId: latest.providerEventId,
      createdAt: latest.receivedAt.toISOString(),
    });
  }
  for (const [, values] of attemptsByEvent) {
    const latest = values.reduce((a, b) => a.id > b.id ? a : b);
    if (latest.outcome !== "ambiguous_learner") continue;
    alerts.push({
      id: `ambiguous-match:${latest.provider}:${latest.providerEventId}`,
      type: "ambiguous_match",
      severity: "high",
      title: "Ambiguous learner match",
      description: `A subscription delivery for ${latest.eventType} matched more than one learner and needs an explicit learner ID.`,
      userId: latest.learnerId,
      providerEventId: latest.providerEventId,
      createdAt: latest.receivedAt.toISOString(),
    });
  }
  for (const subscription of subscriptions) {
    if (!subscription.paidThroughAt || subscription.paidThroughAt < now || subscription.paidThroughAt > expiryWindow) continue;
    if (subscription.status !== "active" && subscription.status !== "past_due") continue;
    const relatedEvents = events.filter((event) =>
      event.provider === subscription.provider &&
      (subscription.providerSubscriptionId !== null
        ? event.providerSubscriptionId === subscription.providerSubscriptionId
        : subscription.providerCustomerId !== null
          ? event.providerCustomerId === subscription.providerCustomerId
          : event.userId === subscription.userId),
    );
    const latestStateAt = subscription.lastEventOccurredAt?.getTime() ?? 0;
    const stateEvent = relatedEvents
      .filter((event) =>
        (subscription.lastEventSequence !== null && event.eventSequence === subscription.lastEventSequence) ||
        (event.eventSequence === null && event.eventOccurredAt.getTime() === latestStateAt),
      )
      .sort((a, b) => b.id - a.id)[0];
    const laterRenewal = relatedEvents.some((event) => {
      const afterState = stateEvent
        ? (stateEvent.eventSequence !== null && event.eventSequence !== null
          ? event.eventSequence > stateEvent.eventSequence
          : event.eventOccurredAt.getTime() > stateEvent.eventOccurredAt.getTime())
        : event.eventOccurredAt.getTime() > latestStateAt;
      return afterState && /renew|paid/i.test(event.eventType);
    });
    if (laterRenewal) continue;
    alerts.push({
      id: `expiry:${subscription.id}`,
      type: "expiry_without_renewal",
      severity: "medium",
      title: "Subscription nearing paid-through expiry",
      description: "This active subscription has no renewal event after its latest provider state.",
      userId: subscription.userId,
      providerEventId: null,
      createdAt: subscription.paidThroughAt.toISOString(),
    });
  }
  return alerts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getBillingAlerts(): Promise<BillingAlert[]> {
  const now = new Date();
  const recent = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const [attempts, subscriptions, events] = await Promise.all([
    db.select().from(subscriptionDeliveryAttemptsTable).where(gte(subscriptionDeliveryAttemptsTable.receivedAt, recent)),
    db.select().from(learnerSubscriptionsTable),
    db.select().from(subscriptionBillingEventsTable),
  ]);
  return buildBillingAlerts({ attempts, subscriptions, events }, now);
}