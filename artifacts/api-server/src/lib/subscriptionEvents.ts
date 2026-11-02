import type { learnerSubscriptionsTable } from "@workspace/db";

export type SubscriptionOrderingState = Pick<
  typeof learnerSubscriptionsTable.$inferSelect,
  "lastEventOccurredAt" | "lastEventSequence"
>;

export function subscriptionEventIsNewer(
  existing: SubscriptionOrderingState,
  sequence: number | null | undefined,
  occurredAt: Date,
): boolean {
  if (!existing.lastEventOccurredAt) return true;
  if (existing.lastEventSequence !== null && sequence !== null && sequence !== undefined) {
    if (sequence !== existing.lastEventSequence) return sequence > existing.lastEventSequence;
  }
  return occurredAt.getTime() > existing.lastEventOccurredAt.getTime();
}

export function subscriptionStatusEndsAccess(status: string): boolean {
  return ["ended", "expired", "inactive"].includes(status.toLowerCase());
}

/**
 * A cancellation or payment failure does not revoke the period that has
 * already been paid for. Refunds and reversals are different: they remove
 * only the subscription entitlement, leaving the learner's course
 * enrolment entitlement untouched.
 *
 * Providers use a few different names for these events, so only explicit
 * refund/reversal event or status names are accepted here. A null
 * paid-through value must be absent as well; an event carrying a replacement
 * date must never accidentally clear access.
 */
export function subscriptionEventClearsPaidThrough(
  status: string,
  eventType: string,
  paidThroughAt: Date | null | undefined,
): boolean {
  if (paidThroughAt instanceof Date) return false;
  const normalizedStatus = status.trim().toLowerCase().replace(/[-\s]+/g, "_");
  const normalizedEventType = eventType.trim().toLowerCase().replace(/[-\s]+/g, "_");
  const refundStatuses = new Set([
    "fully_refunded",
    "full_refund",
    "refund_full",
    "reversed",
    "reversal",
  ]);
  if (refundStatuses.has(normalizedStatus)) return true;
  return /(^|[._])(?:full_refund(?:ed)?|fully_refunded|refund_full|reversal|reversed)(?:[._]|$)/.test(normalizedEventType);
}

export function nextSubscriptionPaidThroughAt(
  existingPaidThroughAt: Date | null,
  status: string,
  eventType: string,
  paidThroughAt: Date | null | undefined,
  paidThroughAtProvided: boolean,
): Date | null {
  if (paidThroughAt instanceof Date) return paidThroughAt;
  if (subscriptionEventClearsPaidThrough(status, eventType, paidThroughAt)) return null;
  if (paidThroughAtProvided && paidThroughAt === null && subscriptionStatusEndsAccess(status)) return null;
  return existingPaidThroughAt;
}
