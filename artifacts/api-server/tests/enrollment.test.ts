import assert from "node:assert/strict";
import test from "node:test";
import {
  certificateIdentity,
  compatibleLearnerName,
  deviceBondDecision,
  enrollmentIsActive,
  normalizeLearnerEmail,
  shouldCreateEnrollment,
  mergeLegacyProgress,
} from "../src/lib/enrollmentDecisions.ts";
import { issueCertificateToken, verifyCertificateToken } from "../src/lib/certificateToken.ts";

test("a repeated paid code reuses its enrolment while a later code creates one", () => {
  assert.equal(shouldCreateEnrollment(false, false, false), true);
  assert.equal(shouldCreateEnrollment(true, false, true), false);
  assert.equal(shouldCreateEnrollment(false, false, true), true);
});

test("unlimited shared codes remain person-scoped and do not create on login", () => {
  assert.equal(shouldCreateEnrollment(false, true, false), true);
  assert.equal(shouldCreateEnrollment(false, true, true), false);
});

test("paid identity matching normalizes email but requires a compatible full name", () => {
  assert.equal(normalizeLearnerEmail("  Learner@Example.COM "), "learner@example.com");
  assert.equal(compatibleLearnerName("Ada Lovelace", "Ada  Lovelace"), true);
  assert.equal(compatibleLearnerName("Ada Lovelace", "Grace Hopper"), false);
  assert.equal(compatibleLearnerName("A", "A"), true);
  assert.equal(compatibleLearnerName("A B", "C D"), false);
});

test("device bonds reject silent replacement and allow only an admin reset", () => {
  assert.equal(deviceBondDecision("phone-a", "phone-a"), "same_device");
  assert.equal(deviceBondDecision("phone-a", "phone-b"), "admin_reset_required");
  assert.equal(deviceBondDecision("RESET_123", "phone-b"), "rebind_after_reset");
});

test("expired enrolments retain evidence but no active delivery entitlement", () => {
  const expired = {
    accessExpiresAt: new Date("2024-01-01T00:00:00Z"),
    status: "active",
    isDeleted: false,
  } as const;
  assert.equal(enrollmentIsActive(expired, new Date("2025-01-01T00:00:00Z")), false);
  assert.equal(enrollmentIsActive({ ...expired, accessExpiresAt: null }, new Date()), true);
});

test("separate completed enrolments receive distinct certificate identities", () => {
  const passedAt = new Date("2025-04-01T00:00:00Z");
  assert.notEqual(certificateIdentity(42, passedAt, 10), certificateIdentity(42, passedAt, 11));
});

test("certificate links are signed, scoped, and expire", () => {
  const previous = process.env.SESSION_SECRET;
  process.env.SESSION_SECRET = "test-session-secret";
  try {
    const token = issueCertificateToken(12, 34, 60, 1_000);
    assert.deepEqual(verifyCertificateToken(token, 1_059), {
      userId: 12,
      enrollmentId: 34,
      expiresAt: 1_060,
    });
    assert.equal(verifyCertificateToken(token, 1_061), null);
    const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    assert.equal(verifyCertificateToken(tampered, 1_001), null);
  } finally {
    if (previous === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = previous;
  }
});

test("mixed legacy and already-scoped progress merges before unique assignment", () => {
  const merged = mergeLegacyProgress([
    {
      id: 4,
      videoCompleted: false,
      quizPassed: true,
      quizScore: 70,
      lastTimestamp: 12,
      completedAt: null,
      updatedAt: new Date("2025-01-01T00:00:00Z"),
    },
    {
      id: 9,
      videoCompleted: true,
      quizPassed: false,
      quizScore: 85,
      lastTimestamp: 99,
      completedAt: new Date("2025-02-01T00:00:00Z"),
      updatedAt: new Date("2025-02-01T00:00:00Z"),
    },
  ]);
  assert.equal(merged.canonicalId, 9);
  assert.deepEqual(merged.duplicateIds, [4]);
  assert.equal(merged.videoCompleted, true);
  assert.equal(merged.quizPassed, true);
  assert.equal(merged.quizScore, 85);
  assert.equal(merged.lastTimestamp, 99);
});