import cron from "node-cron";
import { logger } from "./logger";
import { fetchAllFeeds } from "./rssFetcher";
import { db, assessmentEnquiriesTable, assessmentVenuesTable, assessmentPassportsTable, usersTable } from "@workspace/db";
import { eq, and, ne, isNull, lte } from "drizzle-orm";
import {
  sendBatchEmailToVenue,
  sendNudge7,
  sendFollowUpToVenue,
  sendNudge12,
} from "./gatewayEmails";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCandidateInfo(userId: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  const [passport] = await db.select().from(assessmentPassportsTable).where(eq(assessmentPassportsTable.userId, userId));
  if (!user || !passport) return null;
  return { fullName: user.fullName, email: user.email, postcode: passport.postcode, phone: passport.phone };
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

// ─── Gateway batch send (1st and 15th of month) ───────────────────────────────

async function runBatchSend() {
  logger.info("Gateway scheduler: running fortnightly batch send");
  const activeVenues = await db.select().from(assessmentVenuesTable).where(eq(assessmentVenuesTable.active, true));

  for (const venue of activeVenues) {
    const enquiries = await db.select().from(assessmentEnquiriesTable).where(
      and(
        eq(assessmentEnquiriesTable.venueId, venue.id),
        ne(assessmentEnquiriesTable.status, "resolved"),
        ne(assessmentEnquiriesTable.status, "expired"),
        isNull(assessmentEnquiriesTable.batchSentAt),
      )
    );
    if (enquiries.length === 0) continue;

    const candidates = (await Promise.all(enquiries.map(e => getCandidateInfo(e.userId)))).filter((c): c is NonNullable<typeof c> => c !== null);
    if (candidates.length === 0) continue;

    await sendBatchEmailToVenue(venue, candidates.slice(0, 4), candidates.length >= 4).catch(() => {});

    await db.update(assessmentEnquiriesTable)
      .set({ batchSentAt: new Date() })
      .where(and(
        eq(assessmentEnquiriesTable.venueId, venue.id),
        ne(assessmentEnquiriesTable.status, "resolved"),
        ne(assessmentEnquiriesTable.status, "expired"),
        isNull(assessmentEnquiriesTable.batchSentAt),
      ));
    logger.info({ venueId: venue.id, count: candidates.length }, "Batch email sent to venue");
  }
}

// ─── Nudge 7 (7 days after batch sent, no response) ──────────────────────────

async function runNudge7() {
  const cutoff = daysAgo(7);
  const due = await db.select().from(assessmentEnquiriesTable).where(
    and(
      ne(assessmentEnquiriesTable.status, "resolved"),
      ne(assessmentEnquiriesTable.status, "expired"),
      isNull(assessmentEnquiriesTable.nudge7SentAt),
      lte(assessmentEnquiriesTable.batchSentAt, cutoff),
    )
  );
  for (const enquiry of due) {
    const candidate = await getCandidateInfo(enquiry.userId);
    if (!candidate) continue;
    const [venue] = await db.select().from(assessmentVenuesTable).where(eq(assessmentVenuesTable.id, enquiry.venueId));
    if (!venue) continue;
    const batchSentDate = enquiry.batchSentAt!.toLocaleDateString("en-GB", { day: "numeric", month: "long" });
    await sendNudge7(candidate, venue, enquiry, batchSentDate).catch(() => {});
    await db.update(assessmentEnquiriesTable)
      .set({ status: "nudge7_sent", nudge7SentAt: new Date() })
      .where(eq(assessmentEnquiriesTable.id, enquiry.id));
    logger.info({ enquiryId: enquiry.id }, "7-day nudge sent to candidate");
  }
}

// ─── Follow-up to venue (when candidate clicks "Yes") ────────────────────────

async function runFollowUps() {
  const due = await db.select().from(assessmentEnquiriesTable).where(
    eq(assessmentEnquiriesTable.status, "followup_requested"),
  );
  for (const enquiry of due) {
    const candidate = await getCandidateInfo(enquiry.userId);
    if (!candidate) continue;
    const [venue] = await db.select().from(assessmentVenuesTable).where(eq(assessmentVenuesTable.id, enquiry.venueId));
    if (!venue) continue;
    await sendFollowUpToVenue(venue, candidate).catch(() => {});
    // Advance status so nudge12 timer can start from followupRequestedAt
    await db.update(assessmentEnquiriesTable)
      .set({ status: "nudge7_sent" })
      .where(eq(assessmentEnquiriesTable.id, enquiry.id));
    logger.info({ enquiryId: enquiry.id }, "Follow-up email sent to venue on candidate's behalf");
  }
}

// ─── Nudge 12 (5 days after candidate requested follow-up, still no response) ─

async function runNudge12() {
  const cutoff = daysAgo(5);
  const due = await db.select().from(assessmentEnquiriesTable).where(
    and(
      ne(assessmentEnquiriesTable.status, "resolved"),
      ne(assessmentEnquiriesTable.status, "expired"),
      isNull(assessmentEnquiriesTable.nudge12SentAt),
      lte(assessmentEnquiriesTable.followupRequestedAt, cutoff),
    )
  );
  for (const enquiry of due) {
    const candidate = await getCandidateInfo(enquiry.userId);
    if (!candidate) continue;
    const [venue] = await db.select().from(assessmentVenuesTable).where(eq(assessmentVenuesTable.id, enquiry.venueId));
    if (!venue) continue;
    const altVenues = await db.select().from(assessmentVenuesTable).where(
      and(eq(assessmentVenuesTable.county, venue.county), ne(assessmentVenuesTable.id, venue.id), eq(assessmentVenuesTable.active, true))
    );
    await sendNudge12(candidate, venue, enquiry, altVenues).catch(() => {});
    await db.update(assessmentEnquiriesTable)
      .set({ status: "nudge12_sent", nudge12SentAt: new Date() })
      .where(eq(assessmentEnquiriesTable.id, enquiry.id));
    logger.info({ enquiryId: enquiry.id }, "12-day nudge sent to candidate");
  }
}

// ─── Main gateway tick ────────────────────────────────────────────────────────

async function runGatewayTick() {
  const day = new Date().getDate();
  if (day === 1 || day === 15) {
    await runBatchSend().catch((err) => logger.error({ err }, "Gateway batch send error"));
  }
  await runFollowUps().catch((err) => logger.error({ err }, "Gateway follow-up error"));
  await runNudge7().catch((err) => logger.error({ err }, "Gateway nudge7 error"));
  await runNudge12().catch((err) => logger.error({ err }, "Gateway nudge12 error"));
}

// ─── Main scheduler ───────────────────────────────────────────────────────────

export function startScheduler(): void {
  // RSS fetch at 07:00 daily
  cron.schedule("0 7 * * *", async () => {
    logger.info("Scheduled RSS fetch starting");
    try {
      const result = await fetchAllFeeds();
      logger.info(result, "Scheduled RSS fetch finished");
    } catch (err) {
      logger.error({ err }, "Scheduled RSS fetch threw unexpectedly");
    }
  });

  // Gateway nudge + batch check at 08:00 daily
  cron.schedule("0 8 * * *", async () => {
    logger.info("Gateway scheduler tick starting");
    await runGatewayTick();
    logger.info("Gateway scheduler tick complete");
  });

  logger.info("Schedulers registered (RSS: 07:00, Gateway: 08:00 daily)");
}
