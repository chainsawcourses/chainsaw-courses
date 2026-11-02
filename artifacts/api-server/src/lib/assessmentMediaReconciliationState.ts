export const ASSESSMENT_MEDIA_FAILURE_WARNING_THRESHOLD = 2;

export type AssessmentMediaReconciliationStatus = {
  lastAttemptAt: Date | null;
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastRemovedCount: number;
  consecutiveFailures: number;
};

export function assessmentMediaCleanupHealth(status: AssessmentMediaReconciliationStatus) {
  return {
    warning: status.consecutiveFailures >= ASSESSMENT_MEDIA_FAILURE_WARNING_THRESHOLD,
    consecutiveFailures: status.consecutiveFailures,
    lastAttemptAt: status.lastAttemptAt?.toISOString() ?? null,
    lastSuccessAt: status.lastSuccessAt?.toISOString() ?? null,
    lastFailureAt: status.lastFailureAt?.toISOString() ?? null,
    lastRemovedCount: status.lastRemovedCount,
  };
}

export type AssessmentMediaStatusRecorder = {
  success: (removedCount: number, at: Date) => Promise<void>;
  failure: (at: Date) => Promise<void>;
};

export async function recordAssessmentMediaReconciliation(
  run: () => Promise<number>,
  recorder: AssessmentMediaStatusRecorder,
  now: () => Date = () => new Date(),
  onRunFailure: (error: unknown) => void = () => undefined,
  onStatusFailure: (error: unknown) => void = () => undefined,
): Promise<void> {
  let removedCount: number;
  try {
    removedCount = await run();
  } catch (err) {
    const failedAt = now();
    try {
      await recorder.failure(failedAt);
    } catch (statusError) {
      onStatusFailure(statusError);
    }
    onRunFailure(err);
    return;
  }

  try {
    await recorder.success(removedCount, now());
  } catch (statusError) {
    onStatusFailure(statusError);
  }
}