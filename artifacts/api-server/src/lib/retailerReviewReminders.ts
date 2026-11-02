import { and, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import { chainsawRetailerReminderAttemptTable, chainsawRetailersTable, db } from "@workspace/db";
import {
  retailerReviewCutoffDate,
  type RetailerReviewThreshold,
} from "@workspace/retailer-review-policy";
import { sendEmail } from "./email";
import { logger } from "./logger";

const ADMIN_EMAIL = "info@chainsawcourses.com";
const CLAIM_LEASE_MS = 30 * 60 * 1_000;

export type { RetailerReviewThreshold } from "@workspace/retailer-review-policy";

type ReminderCandidate = {
  id: number;
  name: string;
  county: string;
  lastCheckedAt: Date | null;
};

type ReminderDelivery = (candidate: ReminderCandidate, threshold: RetailerReviewThreshold) => Promise<boolean>;
type AfterClaim = (
  candidates: Array<ReminderCandidate & { claimedAt: Date }>,
  threshold: RetailerReviewThreshold,
) => Promise<void>;

function reminderContent(candidate: ReminderCandidate, threshold: RetailerReviewThreshold) {
  const overdue = threshold === "overdue";
  const status = overdue ? "overdue" : "due";
  const checked = candidate.lastCheckedAt
    ? candidate.lastCheckedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : "No previous check recorded";
  const subject = `Retailer verification ${status}: ${candidate.name}`;
  const text = [
    `${candidate.name} (${candidate.county}) is ${status} for a retailer verification check.`,
    `Last checked: ${checked}.`,
    "",
    "Open Retailer Management in the admin dashboard to review and re-verify this record.",
  ].join("\n");
  const html = [
    '<div style="font-family:Arial,sans-serif;max-width:560px;color:#1c1c1c">',
    `<h2 style="font-size:18px">Retailer verification ${status}</h2>`,
    `<p><strong>${candidate.name}</strong> (${candidate.county}) is ${status} for a verification check.</p>`,
    `<p>Last checked: ${checked}.</p>`,
    "<p>Open Retailer Management in the admin dashboard to review and re-verify this record.</p>",
    "</div>",
  ].join("");
  return { subject, text, html };
}

async function deliverReminder(candidate: ReminderCandidate, threshold: RetailerReviewThreshold): Promise<boolean> {
  const content = reminderContent(candidate, threshold);
  return sendEmail({ to: ADMIN_EMAIL, ...content });
}

async function claimCandidates(
  now: Date,
  threshold: RetailerReviewThreshold,
  candidateIds?: number[],
): Promise<Array<ReminderCandidate & { claimedAt: Date }>> {
  const claimMarker = threshold === "due"
    ? chainsawRetailersTable.reviewDueReminderClaimedAt
    : chainsawRetailersTable.reviewOverdueReminderClaimedAt;
  const sentMarker = threshold === "due"
    ? chainsawRetailersTable.reviewDueReminderSentAt
    : chainsawRetailersTable.reviewOverdueReminderSentAt;
  const lastCheckedCondition = threshold === "overdue"
    ? or(isNull(chainsawRetailersTable.lastCheckedAt), lte(chainsawRetailersTable.lastCheckedAt, retailerReviewCutoffDate(now, threshold)))
    : and(
      lte(chainsawRetailersTable.lastCheckedAt, retailerReviewCutoffDate(now, threshold)),
      gt(chainsawRetailersTable.lastCheckedAt, retailerReviewCutoffDate(now, "overdue")),
    );

  const eligibility = and(
    eq(chainsawRetailersTable.active, true),
    eq(chainsawRetailersTable.verificationStatus, "verified"),
    isNull(sentMarker),
    or(isNull(claimMarker), lte(claimMarker, new Date(now.getTime() - CLAIM_LEASE_MS))),
    lastCheckedCondition,
    candidateIds ? inArray(chainsawRetailersTable.id, candidateIds) : undefined,
  );
  const selection = {
    id: chainsawRetailersTable.id,
    name: chainsawRetailersTable.name,
    county: chainsawRetailersTable.county,
    lastCheckedAt: chainsawRetailersTable.lastCheckedAt,
    claimedAt: claimMarker,
  };
  const claimed = threshold === "due"
    ? await db
      .update(chainsawRetailersTable)
      .set({ reviewDueReminderClaimedAt: now })
      .where(eligibility)
      .returning(selection)
    : await db
      .update(chainsawRetailersTable)
      .set({ reviewOverdueReminderClaimedAt: now })
      .where(eligibility)
      .returning(selection);
  return claimed.flatMap((candidate) =>
    candidate.claimedAt ? [{ ...candidate, claimedAt: candidate.claimedAt }] : []);
}

async function recordFailedClaim(
  candidate: ReminderCandidate & { claimedAt: Date },
  threshold: RetailerReviewThreshold,
  failedAt: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const checkedAtCondition = candidate.lastCheckedAt
      ? eq(chainsawRetailersTable.lastCheckedAt, candidate.lastCheckedAt)
      : isNull(chainsawRetailersTable.lastCheckedAt);
    const updated = threshold === "due"
      ? await tx
        .update(chainsawRetailersTable)
        .set({
          reviewDueReminderClaimedAt: null,
          reviewDueReminderFailedAt: failedAt,
        })
        .where(and(
          eq(chainsawRetailersTable.id, candidate.id),
          eq(chainsawRetailersTable.active, true),
          eq(chainsawRetailersTable.verificationStatus, "verified"),
          eq(chainsawRetailersTable.reviewDueReminderClaimedAt, candidate.claimedAt),
          checkedAtCondition,
        ))
        .returning({ id: chainsawRetailersTable.id })
      : await tx
        .update(chainsawRetailersTable)
        .set({
          reviewOverdueReminderClaimedAt: null,
          reviewOverdueReminderFailedAt: failedAt,
        })
        .where(and(
          eq(chainsawRetailersTable.id, candidate.id),
          eq(chainsawRetailersTable.active, true),
          eq(chainsawRetailersTable.verificationStatus, "verified"),
          eq(chainsawRetailersTable.reviewOverdueReminderClaimedAt, candidate.claimedAt),
          checkedAtCondition,
        ))
        .returning({ id: chainsawRetailersTable.id });
    if (!updated.length) {
      const claimMarker = threshold === "due"
        ? chainsawRetailersTable.reviewDueReminderClaimedAt
        : chainsawRetailersTable.reviewOverdueReminderClaimedAt;
      await tx
        .update(chainsawRetailersTable)
        .set(threshold === "due"
          ? { reviewDueReminderClaimedAt: null }
          : { reviewOverdueReminderClaimedAt: null })
        .where(and(
          eq(chainsawRetailersTable.id, candidate.id),
          eq(claimMarker, candidate.claimedAt),
        ));
    }
    await tx.insert(chainsawRetailerReminderAttemptTable).values({
      retailerId: candidate.id,
      threshold,
      outcome: "failed",
      attemptedAt: failedAt,
    });
  });
}

async function claimIsCurrent(
  candidate: ReminderCandidate & { claimedAt: Date },
  threshold: RetailerReviewThreshold,
): Promise<boolean> {
  const claimMarker = threshold === "due"
    ? chainsawRetailersTable.reviewDueReminderClaimedAt
    : chainsawRetailersTable.reviewOverdueReminderClaimedAt;
  const checkedAtCondition = candidate.lastCheckedAt
    ? eq(chainsawRetailersTable.lastCheckedAt, candidate.lastCheckedAt)
    : isNull(chainsawRetailersTable.lastCheckedAt);
  const [current] = await db
    .select({ id: chainsawRetailersTable.id })
    .from(chainsawRetailersTable)
    .where(and(
      eq(chainsawRetailersTable.id, candidate.id),
      eq(chainsawRetailersTable.active, true),
      eq(chainsawRetailersTable.verificationStatus, "verified"),
      eq(claimMarker, candidate.claimedAt),
      checkedAtCondition,
    ))
    .limit(1);
  return Boolean(current);
}

async function releaseSupersededClaim(
  candidate: ReminderCandidate & { claimedAt: Date },
  threshold: RetailerReviewThreshold,
): Promise<void> {
  const claimMarker = threshold === "due"
    ? chainsawRetailersTable.reviewDueReminderClaimedAt
    : chainsawRetailersTable.reviewOverdueReminderClaimedAt;
  await db
    .update(chainsawRetailersTable)
    .set(threshold === "due"
      ? { reviewDueReminderClaimedAt: null }
      : { reviewOverdueReminderClaimedAt: null })
    .where(and(
      eq(chainsawRetailersTable.id, candidate.id),
      eq(claimMarker, candidate.claimedAt),
    ));
}

async function completeClaim(
  candidate: ReminderCandidate & { claimedAt: Date },
  threshold: RetailerReviewThreshold,
  sentAt: Date,
): Promise<void> {
  await db.transaction(async (tx) => {
    const checkedAtCondition = candidate.lastCheckedAt
      ? eq(chainsawRetailersTable.lastCheckedAt, candidate.lastCheckedAt)
      : isNull(chainsawRetailersTable.lastCheckedAt);
    const updated = threshold === "due"
      ? await tx
        .update(chainsawRetailersTable)
        .set({
          reviewDueReminderClaimedAt: null,
          reviewDueReminderSentAt: sentAt,
          reviewDueReminderFailedAt: null,
        })
        .where(and(
          eq(chainsawRetailersTable.id, candidate.id),
          eq(chainsawRetailersTable.active, true),
          eq(chainsawRetailersTable.verificationStatus, "verified"),
          eq(chainsawRetailersTable.reviewDueReminderClaimedAt, candidate.claimedAt),
          checkedAtCondition,
        ))
        .returning({ id: chainsawRetailersTable.id })
      : await tx
        .update(chainsawRetailersTable)
        .set({
          reviewOverdueReminderClaimedAt: null,
          reviewOverdueReminderSentAt: sentAt,
          reviewOverdueReminderFailedAt: null,
        })
        .where(and(
          eq(chainsawRetailersTable.id, candidate.id),
          eq(chainsawRetailersTable.active, true),
          eq(chainsawRetailersTable.verificationStatus, "verified"),
          eq(chainsawRetailersTable.reviewOverdueReminderClaimedAt, candidate.claimedAt),
          checkedAtCondition,
        ))
        .returning({ id: chainsawRetailersTable.id });
    if (!updated.length) {
      const claimMarker = threshold === "due"
        ? chainsawRetailersTable.reviewDueReminderClaimedAt
        : chainsawRetailersTable.reviewOverdueReminderClaimedAt;
      await tx
        .update(chainsawRetailersTable)
        .set(threshold === "due"
          ? { reviewDueReminderClaimedAt: null }
          : { reviewOverdueReminderClaimedAt: null })
        .where(and(
          eq(chainsawRetailersTable.id, candidate.id),
          eq(claimMarker, candidate.claimedAt),
        ));
    }
    await tx.insert(chainsawRetailerReminderAttemptTable).values({
      retailerId: candidate.id,
      threshold,
      outcome: "sent",
      attemptedAt: sentAt,
    });
  });
}

export async function runRetailerReviewReminders(
  now = new Date(),
  deliver: ReminderDelivery = deliverReminder,
  candidateIds?: number[],
  afterClaim?: AfterClaim,
): Promise<void> {
  for (const threshold of ["due", "overdue"] as const) {
    const candidates = await claimCandidates(now, threshold, candidateIds);
    await afterClaim?.(candidates, threshold);
    for (const candidate of candidates) {
      if (!await claimIsCurrent(candidate, threshold)) {
        await releaseSupersededClaim(candidate, threshold);
        continue;
      }
      let sent = false;
      try {
        sent = await deliver(candidate, threshold);
        if (!sent) throw new Error("Email delivery returned false");
      } catch (err) {
        logger.error(
          { err, retailerId: candidate.id, threshold },
          "Retailer review reminder delivery failed",
        );
        await recordFailedClaim(candidate, threshold, new Date()).catch((releaseErr) => {
          logger.error(
            { err: releaseErr, retailerId: candidate.id, threshold },
            "Failed to record retailer review reminder delivery failure",
          );
        });
        continue;
      }
      await completeClaim(candidate, threshold, new Date());
      logger.info({ retailerId: candidate.id, threshold }, "Retailer review reminder sent");
    }
  }
}