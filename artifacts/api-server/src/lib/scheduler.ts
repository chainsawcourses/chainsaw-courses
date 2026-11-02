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
import { sendEmail } from "./email";
import { reconcileBillingSupportNotifications } from "./billingSupportNotifications";
import { runRetailerReviewReminders } from "./retailerReviewReminders";
import { runScheduledBackupIfDue } from "./backupJobs";

const ADMIN_EMAIL = "info@chainsawcourses.com";
const BASE_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "https://chainsawcourses.com";

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

// ─── Admin reminder: quarterly restoration test ───────────────────────────────

async function sendQuarterlyRestoreReminder(): Promise<void> {
  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const adminUrl = `${BASE_URL}/admin`;

  const text = [
    `Quarterly Backup Restoration Test Due — ${today}`,
    "",
    "Your BCDR Plan (QMS-006) requires a backup restoration test every quarter. This test is now due.",
    "",
    "Steps:",
    "1. Locate your most recent database backup (Replit dashboard → Database → Backups).",
    "2. Restore it to a test environment, or verify the data integrity of a recent CSV export.",
    "3. Confirm learner records, progress, and waiver data are intact.",
    "4. Note the time taken and any issues found.",
    "5. Log the result in the admin dashboard: " + adminUrl + " (Data & Backup → Log Restore Test).",
    "",
    "Target RTO: ≤ 4 hours · Target RPO: ≤ 24 hours",
    "",
    "— Chainsaw Courses automated reminder",
  ].join("\n");

  const html = `
    <div style="font-family:monospace;max-width:560px;margin:0 auto;color:#1C1C1C;">
      <div style="background:#e27226;padding:16px 24px;">
        <span style="color:#fff;font-size:14px;font-weight:bold;letter-spacing:2px;">QUARTERLY RESTORATION TEST DUE</span>
      </div>
      <div style="padding:24px;background:#f9f9f9;border:1px solid #e5e7eb;">
        <p style="margin:0 0 12px;font-size:13px;color:#555;">${today}</p>
        <p style="margin:0 0 16px;font-size:14px;">Your BCDR Plan (QMS-006) requires a backup restoration test every quarter. <strong>This test is now due.</strong></p>
        <ol style="padding-left:20px;margin:0 0 16px;font-size:13px;line-height:1.8;">
          <li>Locate your most recent database backup (Replit dashboard → Database → Backups)</li>
          <li>Restore it to a test environment, or verify data integrity of a recent CSV export</li>
          <li>Confirm learner records, progress, and waiver data are intact</li>
          <li>Note the time taken and any issues found</li>
          <li>Log the result in the <a href="${adminUrl}" style="color:#e27226;">admin dashboard</a> → Data &amp; Backup → Log Restore Test</li>
        </ol>
        <div style="background:#fff3e0;border-left:3px solid #e27226;padding:10px 14px;margin-bottom:16px;font-size:12px;">
          <strong>Target RTO:</strong> ≤ 4 hours &nbsp;·&nbsp; <strong>Target RPO:</strong> ≤ 24 hours
        </div>
        <p style="margin:0;font-size:12px;color:#888;">BCDR Plan QMS-006 · Overleaf Publishers Ltd · Co. No. 15735226</p>
      </div>
    </div>`;

  const sent = await sendEmail({ to: ADMIN_EMAIL, subject: `Quarterly Backup Restoration Test Due — ${today}`, text, html });
  if (sent) logger.info("Quarterly restore reminder sent to admin");
}

// ─── Main scheduler ───────────────────────────────────────────────────────────

export function startScheduler(): void {
  // With an external scheduler configured, only its held-open HTTP request may
  // start the backup. Startup/cron fire-and-forget work can be paused by Autoscale.
  const externalBackupTriggerConfigured = Boolean(process.env.BACKUP_TRIGGER_SECRET);
  void reconcileBillingSupportNotifications().catch((err) =>
    logger.error({ err }, "Initial billing support notification reconciliation failed"));
  void runRetailerReviewReminders().catch((err) =>
    logger.error({ err }, "Initial retailer review reminder run failed"));
  if (!externalBackupTriggerConfigured) void runScheduledBackupIfDue();

  cron.schedule("*/5 * * * *", async () => {
    await reconcileBillingSupportNotifications().catch((err) =>
      logger.error({ err }, "Scheduled billing support notification reconciliation failed"));
  });

  // Retailer verification reminders — daily at 08:30
  cron.schedule("30 8 * * *", async () => {
    await runRetailerReviewReminders().catch((err) =>
      logger.error({ err }, "Scheduled retailer review reminder run failed"));
  });
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

  // Quarterly restoration test reminder — 1st of Jan, Apr, Jul, Oct at 09:00
  cron.schedule("0 9 1 1,4,7,10 *", async () => {
    logger.info("Quarterly restore reminder: sending");
    await sendQuarterlyRestoreReminder().catch((err) => logger.error({ err }, "Quarterly restore reminder error"));
  });

  // Encrypted backup at 06:00 UK time; startup catches up after downtime.
  cron.schedule("0 6 * * *", async () => {
    if (!externalBackupTriggerConfigured) await runScheduledBackupIfDue();
  }, { timezone: "Europe/London" });

  logger.info(`Schedulers registered (billing alerts: every 5 minutes, RSS: 07:00, Gateway: 08:00, Retailer reviews: 08:30, readable backup: daily 06:00 UK${externalBackupTriggerConfigured ? " via external trigger" : ""}, Restore reminder: quarterly)`);
}
