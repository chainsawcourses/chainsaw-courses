import assert from "node:assert/strict";
import test from "node:test";
import { addCalendarMonthsUtc, getEffectiveCourseAccessExpiry, hasActiveCourseAccess } from "../src/lib/courseAccess.ts";

test("adds six calendar months using UTC month-end rules", () => {
  assert.equal(addCalendarMonthsUtc(new Date("2025-01-31T12:34:56.789Z"), 6).toISOString(), "2025-07-31T12:34:56.789Z");
  assert.equal(addCalendarMonthsUtc(new Date("2025-08-31T00:00:00.000Z"), 6).toISOString(), "2026-02-28T00:00:00.000Z");
});

test("handles leap-year month ends without elapsed-day arithmetic", () => {
  assert.equal(addCalendarMonthsUtc(new Date("2023-08-31T00:00:00.000Z"), 6).toISOString(), "2024-02-29T00:00:00.000Z");
});

test("course access accepts unlimited and active manual or subscription extensions", () => {
  const now = new Date("2025-01-01T00:00:00.000Z");
  assert.equal(hasActiveCourseAccess({ accessExpiresAt: null, subscriptionExpiresAt: null }, now), true);
  assert.equal(hasActiveCourseAccess({ accessExpiresAt: new Date("2024-12-31T23:59:59.999Z"), subscriptionExpiresAt: new Date("2025-02-01T00:00:00.000Z") }, now), true);
  assert.equal(hasActiveCourseAccess({ accessExpiresAt: new Date("2024-12-31T23:59:59.999Z"), subscriptionExpiresAt: null }, now), false);
});

test("course access ends exactly at its expiry instant", () => {
  const expiry = new Date("2025-01-01T00:00:00.000Z");
  assert.equal(hasActiveCourseAccess({ accessExpiresAt: expiry, subscriptionExpiresAt: null }, expiry), false);
  assert.equal(hasActiveCourseAccess(
    { accessExpiresAt: expiry, subscriptionExpiresAt: new Date("2025-01-01T00:00:00.001Z") },
    expiry,
  ), true);
});

test("revoked Apple enrolment cannot be revived by a legacy subscription extension", () => {
  assert.equal(hasActiveCourseAccess({ accessExpiresAt: null, status: "revoked" }), false);
  assert.equal(hasActiveCourseAccess({
    accessExpiresAt: new Date("2099-01-01"), subscriptionExpiresAt: new Date("2099-02-01"), status: "revoked",
  }), false);
});

test("effective expiry preserves unlimited access and chooses the later finite entitlement", () => {
  const base = new Date("2025-01-01T00:00:00.000Z");
  const extension = new Date("2025-02-01T00:00:00.000Z");
  assert.equal(getEffectiveCourseAccessExpiry({ accessExpiresAt: null, subscriptionExpiresAt: extension }), null);
  assert.equal(
    getEffectiveCourseAccessExpiry({ accessExpiresAt: base, subscriptionExpiresAt: extension })?.toISOString(),
    extension.toISOString(),
  );
  assert.equal(
    getEffectiveCourseAccessExpiry({ accessExpiresAt: extension, subscriptionExpiresAt: base })?.toISOString(),
    extension.toISOString(),
  );
  assert.equal(
    getEffectiveCourseAccessExpiry({ accessExpiresAt: base, subscriptionExpiresAt: null })?.toISOString(),
    base.toISOString(),
  );
  assert.equal(
    getEffectiveCourseAccessExpiry({
      accessExpiresAt: base,
      subscriptionExpiresAt: extension,
      subscriptionPaidThroughAt: null,
      hasCanonicalSubscription: true,
    })?.toISOString(),
    base.toISOString(),
  );
});