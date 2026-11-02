import assert from "node:assert/strict";
import test from "node:test";
import { addCalendarMonthsUtc, hasActiveCourseAccess } from "../src/lib/courseAccess.ts";
import {
  subscriptionEventIsNewer,
  subscriptionEventClearsPaidThrough,
  subscriptionStatusEndsAccess,
} from "../src/lib/subscriptionEvents.ts";
import { hasBillingSecret } from "../src/lib/billingAuth.ts";

test("billing authentication fails closed when the shared secret is missing", () => {
  const previous = process.env.WEBSITE_BILLING_EVENTS_SECRET;
  delete process.env.WEBSITE_BILLING_EVENTS_SECRET;
  try {
    assert.equal(hasBillingSecret("anything"), false);
  } finally {
    if (previous === undefined) delete process.env.WEBSITE_BILLING_EVENTS_SECRET;
    else process.env.WEBSITE_BILLING_EVENTS_SECRET = previous;
  }
});

test("provider sequence wins over delivery timestamp for delayed events", () => {
  const current = {
    lastEventSequence: 4,
    lastEventOccurredAt: new Date("2025-04-01T00:00:00Z"),
  };
  assert.equal(
    subscriptionEventIsNewer(current, 3, new Date("2025-05-01T00:00:00Z")),
    false,
  );
  assert.equal(
    subscriptionEventIsNewer(current, 5, new Date("2025-03-01T00:00:00Z")),
    true,
  );
  assert.equal(
    subscriptionEventIsNewer(current, 4, new Date("2025-04-01T00:00:00Z")),
    false,
  );
});

test("repeated events are not newer, while an unsequenced later event is", () => {
  const current = {
    lastEventSequence: null,
    lastEventOccurredAt: new Date("2025-01-01T00:00:00Z"),
  };
  assert.equal(subscriptionEventIsNewer(current, undefined, new Date("2025-01-01T00:00:00Z")), false);
  assert.equal(subscriptionEventIsNewer(current, null, new Date("2025-01-02T00:00:00Z")), true);
});

test("sixty monthly renewals cover five years without regressing paid-through", () => {
  const firstPaidThrough = new Date("2025-01-31T00:00:00Z");
  let current = {
    lastEventSequence: 0,
    lastEventOccurredAt: new Date("2025-01-01T00:00:00Z"),
  };
  for (let sequence = 1; sequence <= 60; sequence += 1) {
    const paidThrough = addCalendarMonthsUtc(firstPaidThrough, sequence);
    assert.equal(
      subscriptionEventIsNewer(current, sequence, paidThrough),
      true,
      `renewal ${sequence} should apply`,
    );
    current = {
      lastEventSequence: sequence,
      lastEventOccurredAt: paidThrough,
    };
  }
  assert.equal(current.lastEventSequence, 60);
  assert.equal(current.lastEventOccurredAt.toISOString(), "2030-01-31T00:00:00.000Z");
  assert.equal(subscriptionStatusEndsAccess("cancelled"), false);
  assert.equal(subscriptionStatusEndsAccess("past_due"), false);
  assert.equal(subscriptionStatusEndsAccess("expired"), true);
});

test("cancellation and payment failure retain access only through the paid-through instant", () => {
  const entitlement = {
    accessExpiresAt: new Date("2024-12-31T00:00:00Z"),
    subscriptionPaidThroughAt: new Date("2030-01-01T00:00:00Z"),
  };
  assert.equal(hasActiveCourseAccess(entitlement, new Date("2029-12-31T23:59:59Z")), true);
  assert.equal(hasActiveCourseAccess(entitlement, new Date("2030-01-01T00:00:00Z")), false);
});

test("a full refund or reversal clears subscription access but not enrolment access", () => {
  assert.equal(
    subscriptionEventClearsPaidThrough("fully_refunded", "subscription.full_refund", null),
    true,
  );
  assert.equal(
    subscriptionEventClearsPaidThrough("past_due", "payment.reversed", null),
    true,
  );
  assert.equal(
    subscriptionEventClearsPaidThrough("reversed", "payment.reversed", undefined),
    true,
  );
  assert.equal(
    subscriptionEventClearsPaidThrough("fully_refunded", "subscription.full_refund", new Date("2030-01-01T00:00:00Z")),
    false,
  );
  assert.equal(subscriptionEventClearsPaidThrough("refunded", "subscription.refunded", null), false);
  assert.equal(subscriptionEventClearsPaidThrough("partially_refunded", "subscription.partial_refund", null), false);
  assert.equal(subscriptionEventClearsPaidThrough("voided", "invoice.voided", null), false);
  assert.equal(
    subscriptionEventClearsPaidThrough("past_due", "payment.failed", null),
    false,
  );
  const enrolmentOnly = {
    accessExpiresAt: new Date("2030-01-01T00:00:00Z"),
    subscriptionPaidThroughAt: null,
    hasCanonicalSubscription: true,
  };
  assert.equal(hasActiveCourseAccess(enrolmentOnly, new Date("2029-12-31T00:00:00Z")), true);
});
