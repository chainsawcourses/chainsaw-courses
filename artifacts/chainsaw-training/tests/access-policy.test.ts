import assert from "node:assert/strict";
import test from "node:test";
import {
  learnerIdentity,
  accountSwitchDecision,
  courseRouteGateDecision,
  MAX_ACCESS_RECHECK_DELAY_MS,
  millisecondsUntilAccessExpiry,
  mayAccessRoute,
  persistVerifiedAccess,
  readVerifiedAccess,
  resolveAccessStatus,
} from "../src/lib/accessPolicy.ts";

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test("protected course routes are denied while certificate and history routes remain available", () => {
  const access = { accessStatus: "expired" as const, accessExpiresAt: "2026-07-01T10:00:00.000Z" };
  assert.equal(mayAccessRoute("/training/1", access), false);
  assert.equal(mayAccessRoute("/quiz/1", access), false);
  assert.equal(mayAccessRoute("/exam", access), false);
  assert.equal(mayAccessRoute("/mock-test", access), false);
  assert.equal(mayAccessRoute("/certificate", access), true);
  assert.equal(mayAccessRoute("/signed-waiver", access), true);
  assert.equal(mayAccessRoute("/inspection", access), true);
});

test("access expires at the exact verified timestamp", () => {
  const expiry = "2026-07-01T10:00:00.000Z";
  const oneMillisecondBeforeExpiry = Date.parse(expiry) - 1;
  const access = { accessStatus: "active" as const, accessExpiresAt: expiry };
  assert.equal(resolveAccessStatus("active", expiry, oneMillisecondBeforeExpiry), "active");
  assert.equal(resolveAccessStatus("active", expiry, Date.parse(expiry)), "expired");
  // This is the deterministic timer plan used by ProtectedCourseGate: when the
  // scheduled callback fires, the same protected page is denied immediately.
  const timerDelay = millisecondsUntilAccessExpiry(access, oneMillisecondBeforeExpiry);
  assert.equal(timerDelay, 1);
  assert.equal(mayAccessRoute("/training", access, oneMillisecondBeforeExpiry + timerDelay!), false);
  assert.equal(millisecondsUntilAccessExpiry(access, Date.parse(expiry)), 0);
});

test("six-month access schedules safe capped checks which reschedule to the boundary", () => {
  const start = Date.parse("2026-01-01T00:00:00.000Z");
  const expiry = Date.parse("2026-07-01T00:00:00.000Z");
  const access = { accessStatus: "active" as const, accessExpiresAt: new Date(expiry).toISOString() };
  assert.equal(millisecondsUntilAccessExpiry(access, start), MAX_ACCESS_RECHECK_DELAY_MS);
  assert.equal(millisecondsUntilAccessExpiry(access, expiry - 1), 1);
  assert.equal(mayAccessRoute("/training", access, expiry), false);
});

test("verified access is scoped to the learner identity on account switch", () => {
  const storage = new MemoryStorage();
  const firstLearner = learnerIdentity("COURSE-A", 101);
  const secondLearner = learnerIdentity("COURSE-B", 202);
  persistVerifiedAccess(storage, firstLearner, {
    accessStatus: "expired",
    accessExpiresAt: "2026-07-01T10:00:00.000Z",
  });

  assert.deepEqual(readVerifiedAccess(storage, firstLearner), {
    accessStatus: "expired",
    accessExpiresAt: "2026-07-01T10:00:00.000Z",
  });
  assert.equal(readVerifiedAccess(storage, secondLearner), null);
});

test("account switch clears query data and fail-closes until the new learner is verified", () => {
  const storage = new MemoryStorage();
  const previous = learnerIdentity("COURSE-A", 101);
  const next = learnerIdentity("COURSE-B", 202);
  persistVerifiedAccess(storage, previous, { accessStatus: "active", accessExpiresAt: null });
  const decision = accountSwitchDecision(storage, previous, next);
  assert.equal(decision.clearQueryCache, true);
  assert.deepEqual(decision.access, { accessStatus: "unknown", accessExpiresAt: null });
  assert.equal(mayAccessRoute("/manual", decision.access), false);
  assert.equal(mayAccessRoute("/certificate", decision.access), true);
});

test("unknown access holds while expired access selects the in-place denial state", () => {
  const unknown = { accessStatus: "unknown" as const, accessExpiresAt: null };
  const expired = { accessStatus: "expired" as const, accessExpiresAt: "2026-01-01T00:00:00.000Z" };
  assert.equal(courseRouteGateDecision("/training/4", unknown), "hold");
  assert.equal(courseRouteGateDecision("/training/4", expired), "expired");
  assert.equal(courseRouteGateDecision("/certificate", unknown), "allow");
  assert.equal(courseRouteGateDecision("/training/4", { ...unknown, accessStatus: "active" }), "allow");
});

test("persisted expiry can revalidate active without losing the requested route", () => {
  const requestedPath = "/training/4";
  assert.equal(courseRouteGateDecision(requestedPath, {
    accessStatus: "expired",
    accessExpiresAt: "2026-01-01T00:00:00.000Z",
  }), "expired");
  assert.equal(courseRouteGateDecision(requestedPath, {
    accessStatus: "active",
    accessExpiresAt: "2027-01-01T00:00:00.000Z",
  }, Date.parse("2026-06-01T00:00:00.000Z")), "allow");
  assert.equal(requestedPath, "/training/4");
});

test("a delayed entitlement schedules from the current scheduling moment", () => {
  const staleRenderTime = 1_000;
  const schedulingTime = 5_000;
  const access = {
    accessStatus: "active" as const,
    accessExpiresAt: new Date(schedulingTime + 250).toISOString(),
  };
  assert.equal(millisecondsUntilAccessExpiry(access, staleRenderTime), 4_250);
  assert.equal(millisecondsUntilAccessExpiry(access, schedulingTime), 250);
});