import crypto from "crypto";

export type LegacyProgressMergeRow = {
  id: number;
  videoCompleted: boolean;
  quizPassed: boolean;
  quizScore: number | null;
  lastTimestamp: number;
  completedAt: Date | null;
  updatedAt: Date;
};

export function mergeLegacyProgress(rows: LegacyProgressMergeRow[]) {
  const ordered = [...rows].sort((a, b) =>
    Number(b.videoCompleted) + Number(b.quizPassed) - Number(a.videoCompleted) - Number(a.quizPassed) ||
    b.lastTimestamp - a.lastTimestamp ||
    b.updatedAt.getTime() - a.updatedAt.getTime() ||
    b.id - a.id);
  const scores = rows.map((row) => row.quizScore).filter((score): score is number => score !== null);
  return {
    canonicalId: ordered[0].id,
    duplicateIds: ordered.slice(1).map((row) => row.id),
    videoCompleted: rows.some((row) => row.videoCompleted),
    quizPassed: rows.some((row) => row.quizPassed),
    quizScore: scores.length ? Math.max(...scores) : null,
    lastTimestamp: Math.max(...rows.map((row) => row.lastTimestamp)),
    completedAt: rows.reduce<Date | null>((latest, row) =>
      row.completedAt && (!latest || row.completedAt > latest) ? row.completedAt : latest, null),
    updatedAt: rows.reduce((latest, row) => row.updatedAt > latest ? row.updatedAt : latest, ordered[0].updatedAt),
  };
}

export function normalizeLearnerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeLearnerName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

export function compatibleLearnerName(left: string, right: string): boolean {
  const a = normalizeLearnerName(left);
  const b = normalizeLearnerName(right);
  if (!a || !b) return false;
  if (a === b) return true;
  const aParts = new Set(a.split(" "));
  const bParts = new Set(b.split(" "));
  return aParts.size >= 2 && bParts.size >= 2 &&
    [...aParts].filter((part) => part.length > 1 && bParts.has(part)).length >= 2;
}

export type DeviceBondDecision = "same_device" | "admin_reset_required" | "rebind_after_reset";

export function deviceBondDecision(existingDeviceId: string, requestedDeviceId: string): DeviceBondDecision {
  if (existingDeviceId === requestedDeviceId) return "same_device";
  return existingDeviceId.startsWith("RESET_") ? "rebind_after_reset" : "admin_reset_required";
}

export function shouldCreateEnrollment(
  codeAlreadyUsed: boolean,
  isUnlimited: boolean,
  existingLearner: boolean,
): boolean {
  if (isUnlimited) return !existingLearner;
  return !codeAlreadyUsed;
}

export function enrollmentIsActive(
  enrollment: { accessExpiresAt: Date | null; status: string; isDeleted: boolean },
  now = new Date(),
): boolean {
  if (enrollment.isDeleted || enrollment.status === "deleted") return false;
  return enrollment.accessExpiresAt === null || enrollment.accessExpiresAt > now;
}

export function certificateIdentity(userId: number, date: Date, enrollmentId: number): string {
  return crypto
    .createHash("sha256")
    .update(`${userId}-${enrollmentId}-${date.getTime()}`)
    .digest("hex")
    .toUpperCase()
    .slice(0, 6);
}