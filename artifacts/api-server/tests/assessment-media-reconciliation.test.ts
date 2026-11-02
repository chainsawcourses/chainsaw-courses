import assert from "node:assert/strict";
import test from "node:test";
import {
  ASSESSMENT_MEDIA_FAILURE_WARNING_THRESHOLD,
  assessmentMediaCleanupHealth,
  recordAssessmentMediaReconciliation,
} from "../src/lib/assessmentMediaReconciliationState.ts";

test("repeated reconciliation failures raise a warning and recovery clears it", async () => {
  const state = {
    lastSuccessAt: null as Date | null,
    lastFailureAt: null as Date | null,
    lastRemovedCount: 0,
    consecutiveFailures: 0,
  };
  const recorder = {
    async success(removedCount: number, at: Date) {
      state.lastSuccessAt = at;
      state.lastRemovedCount = removedCount;
      state.consecutiveFailures = 0;
    },
    async failure(at: Date) {
      state.lastFailureAt = at;
      state.consecutiveFailures += 1;
    },
  };
  const times = [
    new Date("2026-09-15T08:00:00.000Z"),
    new Date("2026-09-15T14:00:00.000Z"),
    new Date("2026-09-15T20:00:00.000Z"),
  ];
  const now = () => times.shift()!;

  await recordAssessmentMediaReconciliation(async () => { throw new Error("storage unavailable"); }, recorder, now);
  assert.equal(state.consecutiveFailures, 1);
  assert.equal(state.consecutiveFailures >= ASSESSMENT_MEDIA_FAILURE_WARNING_THRESHOLD, false);

  await recordAssessmentMediaReconciliation(async () => { throw new Error("database unavailable"); }, recorder, now);
  assert.equal(state.consecutiveFailures, 2);
  const warning = assessmentMediaCleanupHealth({
    ...state,
    lastAttemptAt: state.lastFailureAt,
  });
  assert.equal(warning.warning, true);
  assert.equal(warning.consecutiveFailures, ASSESSMENT_MEDIA_FAILURE_WARNING_THRESHOLD);
  assert.equal(warning.lastFailureAt, "2026-09-15T14:00:00.000Z");
  assert.equal("error" in warning, false);
  assert.equal("objectUrl" in warning, false);
  assert.equal(state.lastFailureAt?.toISOString(), "2026-09-15T14:00:00.000Z");

  await recordAssessmentMediaReconciliation(async () => 3, recorder, now);
  assert.equal(state.consecutiveFailures, 0);
  assert.equal(state.lastRemovedCount, 3);
  assert.equal(state.lastSuccessAt?.toISOString(), "2026-09-15T20:00:00.000Z");
  assert.equal(assessmentMediaCleanupHealth({
    ...state,
    lastAttemptAt: state.lastSuccessAt,
  }).warning, false);
});

test("a failed success-status write is not misreported as a cleanup failure", async () => {
  let failureWrites = 0;
  let statusFailures = 0;
  let runFailures = 0;

  await recordAssessmentMediaReconciliation(
    async () => 4,
    {
      async success() {
        throw new Error("health store unavailable");
      },
      async failure() {
        failureWrites += 1;
      },
    },
    () => new Date("2026-09-15T20:00:00.000Z"),
    () => { runFailures += 1; },
    () => { statusFailures += 1; },
  );

  assert.equal(failureWrites, 0);
  assert.equal(runFailures, 0);
  assert.equal(statusFailures, 1);
});