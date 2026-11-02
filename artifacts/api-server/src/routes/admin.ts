import { Router } from "express";
import { AppConnectors as ReplitConnectors } from "../lib/appConnectors";
import { db } from "@workspace/db";
import {
  usersTable,
  activationCodesTable,
  waiversTable,
  userProgressTable,
  modulesTable,
  quizAttemptsTable,
  examAttemptsTable,
  appConfigTable,
  chatMessagesTable,
  inspectionRecordsTable,
  riskAssessmentsTable,
  videoEngagementTable,
  moduleFeedbackTable,
  pushSubscriptionsTable,
  appFeedbackTable,
  backupTestLogsTable,
  backupExportsTable,
  assessmentPassportsTable,
  courseEnrolmentsTable,
  learnerSubscriptionsTable,
  subscriptionBillingEventsTable,
  subscriptionDeliveryAttemptsTable,
  billingSupportNotificationsTable,
  websitePurchaseSeatsTable,
} from "@workspace/db";
import { AdminLoginBody, CreateActivationCodeBody, ResolveWebsitePurchaseSeatBody } from "@workspace/api-zod";
import { eq, isNull, gte, count, and, ne, desc, or, sql, type SQL } from "drizzle-orm";
import { logger } from "../lib/logger";
import crypto from "crypto";
import { fetchPublicPdf } from "../lib/remotePdf";
import { ensureCurrentEnrollment } from "../lib/enrollment";
import { certRef } from "../lib/generateCertificate";
import {
  nextSubscriptionPaidThroughAt,
  subscriptionEventClearsPaidThrough,
  subscriptionEventIsNewer,
  subscriptionStatusEndsAccess,
} from "../lib/subscriptionEvents";
import { getBillingAlerts } from "../lib/billingAlerts";
import { runBillingMonitoringSmokeCheck } from "../lib/billingMonitoringSmoke";
import { getLatestBackupRun, getLatestReadableBackupRun, startManualBackup } from "../lib/backupJobs";

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const BILLING_MONITORING_SMOKE_SECRET = process.env.BILLING_MONITORING_SMOKE_SECRET;
const ADMIN_TOKEN_TTL_SECONDS = 24 * 60 * 60;
const BILLING_MONITORING_SMOKE_LIMIT = 3;
const BILLING_MONITORING_SMOKE_WINDOW_MS = 15 * 60 * 1000;
const SHARED_ADMIN_IDENTITY = "Shared administrator";
const PURCHASE_SENDING_REVIEW_MS = 10 * 60 * 1000;
const purchaseReviewable = (seat: { emailStatus: string; updatedAt: Date }) =>
  seat.emailStatus === "needs_review" ||
  (seat.emailStatus === "sending" && seat.updatedAt.getTime() <= Date.now() - PURCHASE_SENDING_REVIEW_MS);
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
let billingMonitoringSmokeAttempts = { count: 0, resetAt: 0 };

function secretMatches(candidate: string | undefined, expectedSecret: string | undefined): boolean {
  if (!candidate || !expectedSecret) return false;
  const supplied = Buffer.from(candidate);
  const expected = Buffer.from(expectedSecret);
  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function passwordMatches(candidate: string): boolean {
  return secretMatches(candidate, ADMIN_PASSWORD);
}

function verifyBillingMonitoringSmoke(req: {
  headers: Record<string, string | string[] | undefined>;
}): boolean {
  const value = req.headers["billingmonitoringtoken"];
  const token = Array.isArray(value) ? value[0] : value;
  return secretMatches(token, BILLING_MONITORING_SMOKE_SECRET);
}

function consumeBillingMonitoringSmokeAttempt(now: number): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  if (billingMonitoringSmokeAttempts.resetAt <= now) {
    billingMonitoringSmokeAttempts = {
      count: 0,
      resetAt: now + BILLING_MONITORING_SMOKE_WINDOW_MS,
    };
  }
  if (billingMonitoringSmokeAttempts.count >= BILLING_MONITORING_SMOKE_LIMIT) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((billingMonitoringSmokeAttempts.resetAt - now) / 1000)),
    };
  }
  billingMonitoringSmokeAttempts.count += 1;
  return { allowed: true };
}

type AdminTokenPayload = {
  exp?: number;
  actorIdentity?: string;
};

export function getAuthenticatedAdminIdentity(
  req: { headers: Record<string, string | string[] | undefined> },
): string | null {
  if (!SESSION_SECRET) return null;
  const value = req.headers["admintoken"];
  const token = Array.isArray(value) ? value[0] : value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !/^[a-f0-9]{64}$/i.test(parts[2])) return null;
  let payload: AdminTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const expiresAt = payload.exp;
  if (typeof expiresAt !== "number" || !Number.isInteger(expiresAt) ||
      expiresAt <= Math.floor(Date.now() / 1000)) return null;
  const expected = crypto.createHmac("sha256", SESSION_SECRET).update(`${parts[0]}.${parts[1]}`).digest("hex");
  const supplied = Buffer.from(parts[2], "hex");
  const calculated = Buffer.from(expected, "hex");
  if (supplied.length !== calculated.length || !crypto.timingSafeEqual(supplied, calculated)) return null;
  const actorIdentity = payload.actorIdentity?.trim();
  return actorIdentity || SHARED_ADMIN_IDENTITY;
}

export function verifyAdmin(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  return getAuthenticatedAdminIdentity(req) !== null;
}

router.post("/admin/login", async (req, res) => {
  const parse = AdminLoginBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { password } = parse.data;
  const now = Date.now();
  const address = req.ip || req.socket.remoteAddress || "unknown";
  const attempt = loginAttempts.get(address);
  if (attempt && attempt.resetAt <= now) loginAttempts.delete(address);
  const current = loginAttempts.get(address);
  if (current && current.count >= 5) {
    res.status(429).json({ error: "Too many login attempts" });
    return;
  }
  if (current) current.count += 1;
  else loginAttempts.set(address, { count: 1, resetAt: now + 15 * 60 * 1000 });
  if (!SESSION_SECRET || !passwordMatches(password)) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  loginAttempts.delete(address);
  const payload = Buffer.from(JSON.stringify({
    iat: Math.floor(now / 1000),
    exp: Math.floor(now / 1000) + ADMIN_TOKEN_TTL_SECONDS,
    actorIdentity: SHARED_ADMIN_IDENTITY,
  })).toString("base64url");
  const nonce = crypto.randomBytes(16).toString("base64url");
  const signature = crypto.createHmac("sha256", SESSION_SECRET).update(`${nonce}.${payload}`).digest("hex");
  const token = `${nonce}.${payload}.${signature}`;

  res.json({ success: true, token });
});

router.get("/admin/billing-alerts", async (req, res): Promise<void> => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const [alerts, notificationRows] = await Promise.all([
      getBillingAlerts(),
      db.select().from(billingSupportNotificationsTable),
    ]);
    const notifications = new Map(notificationRows.map((row) => [row.alertId, row]));
    res.json(alerts.map((alert) => {
      const notification = notifications.get(alert.id);
      return {
        ...alert,
        supportNotification: notification ? {
          status: notification.status,
          deliveryStatus: notification.openDeliveryStatus,
          deliveryError: notification.openDeliveryError,
        } : null,
      };
    }));
  } catch (err) {
    logger.error({ err }, "Error getting billing alerts");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/billing-monitoring-smoke", async (req, res): Promise<void> => {
  if (!verifyBillingMonitoringSmoke(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const rateLimit = consumeBillingMonitoringSmokeAttempt(Date.now());
  if (!rateLimit.allowed) {
    logger.warn("Billing monitoring smoke check rate limit exceeded");
    res.setHeader("Retry-After", String(rateLimit.retryAfterSeconds));
    res.status(429).json({ error: "Too many billing monitoring smoke checks" });
    return;
  }
  try {
    res.json(await runBillingMonitoringSmokeCheck());
  } catch (err) {
    logger.error({ err }, "Billing monitoring smoke check failed");
    res.status(503).json({ error: "Billing monitoring smoke check failed" });
  }
});

router.get("/admin/billing-support-notifications", async (req, res): Promise<void> => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const deliveryOutcome = typeof req.query.deliveryOutcome === "string" ? req.query.deliveryOutcome : undefined;
    const incidentStatus = typeof req.query.incidentStatus === "string" ? req.query.incidentStatus : undefined;
    const validDeliveryOutcomes = ["delivered", "failed_or_exhausted", "pending"];
    const validIncidentStatuses = ["open", "resolved"];
    if (
      (deliveryOutcome !== undefined && !validDeliveryOutcomes.includes(deliveryOutcome)) ||
      (incidentStatus !== undefined && !validIncidentStatuses.includes(incidentStatus))
    ) {
      res.status(400).json({ error: "Invalid billing history filter" });
      return;
    }

    const failedDelivery = sql<boolean>`coalesce((
      ${billingSupportNotificationsTable.openDeliveryStatus} = 'failed'
      OR lower(coalesce(${billingSupportNotificationsTable.openDeliveryError}, '')) LIKE '%exhaust%'
      OR ${billingSupportNotificationsTable.resolutionDeliveryStatus} = 'failed'
      OR lower(coalesce(${billingSupportNotificationsTable.resolutionDeliveryError}, '')) LIKE '%exhaust%'
    ), false)`;
    const filters: SQL[] = [];
    if (incidentStatus) filters.push(eq(billingSupportNotificationsTable.status, incidentStatus));
    if (deliveryOutcome === "failed_or_exhausted") filters.push(failedDelivery);
    if (deliveryOutcome === "pending") {
      filters.push(sql<boolean>`NOT ${failedDelivery} AND (
        ${billingSupportNotificationsTable.openDeliveryStatus} <> 'sent'
        OR (
          ${billingSupportNotificationsTable.resolutionDeliveryStatus} IS NOT NULL
          AND ${billingSupportNotificationsTable.resolutionDeliveryStatus} <> 'sent'
        )
      )`);
    }
    if (deliveryOutcome === "delivered") {
      filters.push(sql<boolean>`NOT ${failedDelivery}
        AND ${billingSupportNotificationsTable.openDeliveryStatus} = 'sent'
        AND (
          ${billingSupportNotificationsTable.resolutionDeliveryStatus} IS NULL
          OR ${billingSupportNotificationsTable.resolutionDeliveryStatus} = 'sent'
        )`);
    }

    const rows = await db
      .select()
      .from(billingSupportNotificationsTable)
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(billingSupportNotificationsTable.updatedAt));
    res.json(rows.map((row) => ({
      notificationId: row.id,
      alertType: row.alertType,
      learnerId: row.userId,
      title: row.title,
      status: row.status,
      openDeliveryStatus: row.openDeliveryStatus,
      openDeliveryError: row.openDeliveryError,
      resolutionDeliveryStatus: row.resolutionDeliveryStatus,
      resolutionDeliveryError: row.resolutionDeliveryError,
      openedAt: row.openedAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
      updatedAt: row.updatedAt.toISOString(),
    })));
  } catch (err) {
    logger.error({ err }, "Error getting billing support notifications");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/website-purchase-seats", async (req, res): Promise<void> => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const rows = await db.select({
      seat: websitePurchaseSeatsTable,
      codePaused: activationCodesTable.isPaused,
    }).from(websitePurchaseSeatsTable)
      .leftJoin(activationCodesTable, eq(websitePurchaseSeatsTable.activationCodeId, activationCodesTable.id))
      .where(or(
        eq(websitePurchaseSeatsTable.emailStatus, "sending"),
        eq(websitePurchaseSeatsTable.emailStatus, "needs_review"),
      ))
      .orderBy(desc(websitePurchaseSeatsTable.updatedAt))
      .limit(200);
    res.setHeader("Cache-Control", "no-store");
    res.json(rows.map(({ seat, codePaused }) => ({
      id: seat.id, orderId: seat.orderId, lineItemId: seat.lineItemId, seatId: seat.seatId,
      email: seat.email, status: seat.status, emailStatus: seat.emailStatus,
      isPaused: codePaused ?? null, updatedAt: seat.updatedAt.toISOString(),
      reviewable: purchaseReviewable(seat) && seat.status === "active" && !seat.resolution,
      resolution: seat.resolution, resolutionNote: seat.resolutionNote,
      resolvedBy: seat.resolvedBy, resolvedAt: seat.resolvedAt?.toISOString() ?? null,
    })));
  } catch (err) {
    req.log.error({ err }, "Error listing purchase seats requiring review");
    res.status(500).json({ error: "Could not load purchase seats" });
  }
});

router.get("/admin/website-purchase-seats/:id/code", async (req, res): Promise<void> => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid seat ID" }); return; }
  try {
    const [row] = await db.select({
      seat: websitePurchaseSeatsTable, code: activationCodesTable.code,
      isPaused: activationCodesTable.isPaused,
    }).from(websitePurchaseSeatsTable)
      .innerJoin(activationCodesTable, eq(websitePurchaseSeatsTable.activationCodeId, activationCodesTable.id))
      .where(eq(websitePurchaseSeatsTable.id, id));
    if (!row) { res.status(404).json({ error: "Seat or code not found" }); return; }
    if (row.seat.status !== "active" || row.seat.resolution || !purchaseReviewable(row.seat) || row.isPaused) {
      res.status(409).json({ error: "Seat is not ready for manual handoff; refresh the review queue" }); return;
    }
    res.setHeader("Cache-Control", "no-store");
    req.log.info({ seatId: id }, "Purchase code revealed for support review");
    res.json({ code: row.code });
  } catch (err) {
    req.log.error({ err, seatId: id }, "Error revealing purchase code");
    res.status(500).json({ error: "Could not reveal code" });
  }
});

router.post("/admin/website-purchase-seats/:id/resolve", async (req, res): Promise<void> => {
  const actor = getAuthenticatedAdminIdentity(req);
  if (!actor) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid seat ID" }); return; }
  const parsed = ResolveWebsitePurchaseSeatBody.strict().safeParse(req.body);
  if (!parsed.success || !parsed.data.note.trim()) {
    res.status(400).json({ error: "Choose a resolution and provide a note (1–1000 characters)" }); return;
  }
  const { resolution, note } = parsed.data;
  try {
    const result = await db.transaction(async (tx) => {
      const [seat] = await tx.select().from(websitePurchaseSeatsTable)
        .where(eq(websitePurchaseSeatsTable.id, id)).for("update");
      if (!seat) return "missing" as const;
      if (seat.status !== "active" || seat.resolution || !purchaseReviewable(seat) || !seat.activationCodeId) {
        return "conflict" as const;
      }
      const [code] = await tx.select({ isPaused: activationCodesTable.isPaused })
        .from(activationCodesTable).where(eq(activationCodesTable.id, seat.activationCodeId));
      if (!code || (resolution === "manual_handoff" && code.isPaused)) return "conflict" as const;
      const [updated] = await tx.update(websitePurchaseSeatsTable).set({
        resolution, resolutionNote: note.trim(), resolvedBy: actor, resolvedAt: new Date(), updatedAt: new Date(),
      }).where(and(eq(websitePurchaseSeatsTable.id, id), isNull(websitePurchaseSeatsTable.resolution))).returning({ id: websitePurchaseSeatsTable.id });
      return updated ? "resolved" as const : "conflict" as const;
    });
    if (result === "missing") { res.status(404).json({ error: "Seat not found" }); return; }
    if (result === "conflict") { res.status(409).json({ error: "Seat changed or cannot be resolved; refresh the review queue" }); return; }
    req.log.info({ seatId: id, resolution, actor }, "Purchase email reviewed manually");
    res.json({ resolved: true });
  } catch (err) {
    req.log.error({ err, seatId: id }, "Error resolving purchase email");
    res.status(500).json({ error: "Could not resolve purchase email" });
  }
});

router.get("/admin/stats", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      allUsers,
      activeUsers,
      allProgress,
      allExamAttempts,
      allModules,
      allWaivers,
      billingAlerts,
    ] = await Promise.all([
      db.select().from(usersTable).where(isNull(usersTable.deletedAt)),
      db.select({ count: count() }).from(usersTable).where(gte(usersTable.lastActivityAt, oneWeekAgo)),
      db.select().from(userProgressTable),
      db.select({
        id: examAttemptsTable.id,
        userId: examAttemptsTable.userId,
        passed: examAttemptsTable.passed,
        score: examAttemptsTable.score,
        attemptedAt: examAttemptsTable.attemptedAt,
      }).from(examAttemptsTable).orderBy(desc(examAttemptsTable.attemptedAt)),
      db.select().from(modulesTable).where(and(eq(modulesTable.isActive, true), ne(modulesTable.contentType, "pdf"))),
      db.select({ count: count() }).from(waiversTable),
      getBillingAlerts(),
    ]);

    const totalLearners = allUsers.length;
    const activeLearners = Number(activeUsers[0].count);

    // Completed = passed every quiz module
    const quizModuleIds = allModules.filter(m => m.contentType !== "pdf").map(m => m.id);
    const passedByUser = new Map<number, Set<number>>();
    for (const p of allProgress) {
      if (p.quizPassed) {
        if (!passedByUser.has(p.userId)) passedByUser.set(p.userId, new Set());
        passedByUser.get(p.userId)!.add(p.moduleId);
      }
    }
    const completedLearners = allUsers.filter(u =>
      quizModuleIds.length > 0 && (passedByUser.get(u.id)?.size ?? 0) >= quizModuleIds.length
    ).length;

    // Certificates = users who passed the final exam
    const certificatesIssued = allExamAttempts.filter(a => a.passed)
      .reduce((acc, a) => { acc.add(a.userId); return acc; }, new Set<number>()).size;

    // Exam stats
    const totalExamAttempts = allExamAttempts.length;
    const passedAttempts = allExamAttempts.filter(a => a.passed);
    const passRate = totalExamAttempts > 0 ? Math.round((passedAttempts.length / totalExamAttempts) * 100) : 0;
    const averagePassScore = passedAttempts.length > 0
      ? Math.round(passedAttempts.reduce((s, a) => s + (a.score ?? 0), 0) / passedAttempts.length)
      : 0;

    // Module funnel
    const videoCompletedByModule = new Map<number, number>();
    const quizPassedByModule = new Map<number, number>();
    for (const p of allProgress) {
      if (p.videoCompleted) videoCompletedByModule.set(p.moduleId, (videoCompletedByModule.get(p.moduleId) ?? 0) + 1);
      if (p.quizPassed) quizPassedByModule.set(p.moduleId, (quizPassedByModule.get(p.moduleId) ?? 0) + 1);
    }
    const moduleStats = allModules
      .sort((a, b) => a.order - b.order)
      .map(m => ({
        moduleId: m.id,
        title: m.title,
        order: m.order,
        videoCompleted: videoCompletedByModule.get(m.id) ?? 0,
        quizPassed: m.contentType !== "pdf" ? (quizPassedByModule.get(m.id) ?? 0) : null,
      }));

    // Recent exam activity (last 10)
    const userMap = new Map(allUsers.map(u => [u.id, u.fullName]));
    const recentActivity = allExamAttempts.slice(0, 10).map(a => ({
      type: "exam",
      userId: a.userId,
      fullName: userMap.get(a.userId) ?? "Unknown",
      passed: a.passed ?? false,
      score: a.score ?? 0,
      at: a.attemptedAt.toISOString(),
    }));

    const waiversSigned = Number(allWaivers[0].count);

    res.json({
      totalLearners,
      activeLearners,
      completedLearners,
      certificatesIssued,
      waiversSigned,
      totalExamAttempts,
      passRate,
      averagePassScore,
      moduleStats,
      recentActivity,
      billingAlerts,
      billingAlertCount: billingAlerts.length,
    });
  } catch (err) {
    logger.error({ err }, "Error getting admin stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/students", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const users = await db
      .select()
      .from(usersTable)
      .where(isNull(usersTable.deletedAt));
    const subscriptions = await db.select().from(learnerSubscriptionsTable);
    const subscriptionMap = new Map(subscriptions.map((subscription) => [subscription.userId, subscription]));
    const currentEnrollmentByUser = new Map<number, number>();
    for (const user of users) {
      const current = await db.transaction((tx) => ensureCurrentEnrollment(tx, user));
      if (current) currentEnrollmentByUser.set(user.id, current.id);
    }

    const [totalModulesResult] = await db
      .select({ count: count() })
      .from(modulesTable)
      .where(and(eq(modulesTable.isActive, true), ne(modulesTable.contentType, "pdf")));

    const totalModules = Number(totalModulesResult.count);

    const waivers = await db.select().from(waiversTable);
    const waiverMap = new Map(
      waivers
        .filter((w) => w.enrollmentId !== null && currentEnrollmentByUser.get(w.userId) === w.enrollmentId)
        .map((w) => [w.userId, w]),
    );

    const progressRecords = await db
      .select()
      .from(userProgressTable)
      .where(eq(userProgressTable.quizPassed, true));

    const progressMap = new Map<number, number>();
    for (const p of progressRecords) {
      if (p.enrollmentId !== null && currentEnrollmentByUser.get(p.userId) === p.enrollmentId) {
        progressMap.set(p.userId, (progressMap.get(p.userId) ?? 0) + 1);
      }
    }

    const [allModuleFeedback, courseFeedbackRows, allQuizAttempts] = await Promise.all([
      db.select().from(moduleFeedbackTable),
      db.select({ userId: appFeedbackTable.userId, cnt: count() })
        .from(appFeedbackTable)
        .groupBy(appFeedbackTable.userId),
      db.select().from(quizAttemptsTable),
    ]);

    const moduleFeedbackCountMap = new Map<number, number>();
    for (const row of allModuleFeedback) {
      if (row.enrollmentId !== null && currentEnrollmentByUser.get(row.userId) === row.enrollmentId) {
        moduleFeedbackCountMap.set(row.userId, (moduleFeedbackCountMap.get(row.userId) ?? 0) + 1);
      }
    }
    const courseFeedbackCountMap = new Map(courseFeedbackRows.map((r) => [r.userId, Number(r.cnt)]));
    const quizAttemptCountMap = new Map<number, number>();
    for (const row of allQuizAttempts) {
      if (row.enrollmentId !== null && currentEnrollmentByUser.get(row.userId) === row.enrollmentId) {
        quizAttemptCountMap.set(row.userId, (quizAttemptCountMap.get(row.userId) ?? 0) + 1);
      }
    }

    const result = users.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      activatedAt: u.activatedAt.toISOString(),
      activationCode: u.activationCode,
      deviceBonded: true,
      completedModules: progressMap.get(u.id) ?? 0,
      totalModules,
      quizzesPassed: progressMap.get(u.id) ?? 0,
      waiverSigned: !!waiverMap.get(u.id),
      lastActivity: u.lastActivityAt?.toISOString() ?? null,
      moduleFeedbackCount: moduleFeedbackCountMap.get(u.id) ?? 0,
      courseFeedbackCount: courseFeedbackCountMap.get(u.id) ?? 0,
      feedbackCount: (moduleFeedbackCountMap.get(u.id) ?? 0) + (courseFeedbackCountMap.get(u.id) ?? 0),
      totalQuizAttempts: quizAttemptCountMap.get(u.id) ?? 0,
      subscriptionStatus: subscriptionMap.get(u.id)?.status ?? "inactive",
      subscriptionPaidThroughAt: subscriptionMap.get(u.id)?.paidThroughAt?.toISOString() ?? null,
    }));

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error listing students");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/students/:studentId", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const studentId = parseInt(req.params.studentId);

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, studentId));
    if (!user) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    const ensuredEnrollment = await db.transaction((tx) => ensureCurrentEnrollment(tx, user));
    const currentEnrollmentId = ensuredEnrollment?.id ?? user.currentEnrollmentId ?? null;
    const enrollmentRows = await db
      .select()
      .from(courseEnrolmentsTable)
      .where(and(eq(courseEnrolmentsTable.userId, studentId), eq(courseEnrolmentsTable.isDeleted, false)))
      .orderBy(courseEnrolmentsTable.createdAt);
    const currentEnrollment = enrollmentRows.find((row) => row.id === currentEnrollmentId) ?? enrollmentRows[enrollmentRows.length - 1];
    const [subscription] = await db
      .select()
      .from(learnerSubscriptionsTable)
      .where(eq(learnerSubscriptionsTable.userId, studentId))
      .limit(1);

    const [allWaivers, allQuizAttempts, allExamAttempts, allProgressRecords, allModuleFeedback, courseFeedback, allVideoEngagement] = await Promise.all([
      db.select().from(waiversTable).where(eq(waiversTable.userId, studentId)),
      db.select().from(quizAttemptsTable).where(eq(quizAttemptsTable.userId, studentId)),
      db.select().from(examAttemptsTable).where(eq(examAttemptsTable.userId, studentId)).orderBy(examAttemptsTable.attemptedAt),
      db.select().from(userProgressTable).where(eq(userProgressTable.userId, studentId)),
      db.select().from(moduleFeedbackTable).where(eq(moduleFeedbackTable.userId, studentId)).orderBy(desc(moduleFeedbackTable.createdAt)),
      db.select().from(appFeedbackTable).where(eq(appFeedbackTable.userId, studentId)).orderBy(desc(appFeedbackTable.createdAt)),
      db.select().from(videoEngagementTable).where(eq(videoEngagementTable.userId, studentId)),
    ]);
    const belongsToCurrent = (row: { enrollmentId: number | null }) =>
      currentEnrollmentId === null || row.enrollmentId === currentEnrollmentId;
    const waiver = allWaivers.find((row) => belongsToCurrent(row));
    const quizAttempts = allQuizAttempts.filter(belongsToCurrent);
    const examAttempts = allExamAttempts.filter(belongsToCurrent);
    const progressRecords = allProgressRecords.filter(belongsToCurrent);
    const moduleFeedback = allModuleFeedback.filter(belongsToCurrent);

    const modules = await db.select().from(modulesTable).where(eq(modulesTable.isActive, true));
    const moduleMap = new Map(modules.map((m) => [m.id, m]));

    const passedAttempts = new Map<number, (typeof quizAttempts)[0]>();
    for (const attempt of quizAttempts) {
      if (attempt.passed && !passedAttempts.has(attempt.moduleId)) {
        passedAttempts.set(attempt.moduleId, attempt);
      }
    }

    const completedCount = progressRecords.filter((p) => p.videoCompleted && p.quizPassed).length;
    const enrollments = enrollmentRows.map((enrollment) => {
      const scopedQuizAttempts = allQuizAttempts.filter((attempt) => attempt.enrollmentId === enrollment.id);
      const scopedExamAttempts = allExamAttempts.filter((attempt) => attempt.enrollmentId === enrollment.id);
      const scopedProgress = allProgressRecords.filter((record) => record.enrollmentId === enrollment.id);
      const passedExam = scopedExamAttempts.find((attempt) => attempt.passed);
      return {
        enrollmentId: enrollment.id,
        purchaseCode: enrollment.purchaseCode,
        activatedAt: enrollment.activatedAt.toISOString(),
        accessExpiresAt: enrollment.accessExpiresAt?.toISOString() ?? null,
        status: enrollment.accessExpiresAt && enrollment.accessExpiresAt <= new Date() ? "expired" : enrollment.status,
        courseCompletedAt: enrollment.courseCompletedAt?.toISOString() ?? null,
        certificateIssuedAt: enrollment.certificateIssuedAt?.toISOString() ?? null,
        isCurrent: enrollment.id === currentEnrollmentId,
        progress: {
          completedModules: scopedProgress.filter((record) => record.videoCompleted && record.quizPassed).length,
          totalProgressRecords: scopedProgress.length,
          quizAttempts: scopedQuizAttempts.length,
          examAttempts: scopedExamAttempts.length,
          examPassed: !!passedExam,
        },
        certificate: passedExam ? {
          reference: certRef(user.id, passedExam.attemptedAt, enrollment.id),
          completedAt: passedExam.attemptedAt.toISOString(),
        } : null,
        quizResults: scopedQuizAttempts,
        examAttempts: scopedExamAttempts,
        waiverSigned: allWaivers.some((row) => row.enrollmentId === enrollment.id),
        moduleFeedback: allModuleFeedback.filter((row) => row.enrollmentId === enrollment.id),
        videoEngagement: allVideoEngagement.filter((row) => row.enrollmentId === enrollment.id),
      };
    });

    res.json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      activatedAt: user.activatedAt.toISOString(),
      activationCode: user.activationCode,
      deviceId: user.deviceId,
      deviceBonded: true,
      waiverSigned: !!waiver,
      accessExpiresAt: currentEnrollment?.accessExpiresAt?.toISOString() ?? null,
      courseCompletedAt: currentEnrollment?.courseCompletedAt?.toISOString() ?? null,
      certificateIssuedAt: currentEnrollment?.certificateIssuedAt?.toISOString() ?? null,
      enrollments,
      subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
      subscription: subscription
        ? {
          status: subscription.status,
          paidThroughAt: subscription.paidThroughAt?.toISOString() ?? null,
          provider: subscription.provider,
          providerCustomerId: subscription.providerCustomerId,
          providerSubscriptionId: subscription.providerSubscriptionId,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        }
        : {
          status: "inactive",
          paidThroughAt: null,
          provider: null,
          providerCustomerId: null,
          providerSubscriptionId: null,
          cancelAtPeriodEnd: false,
        },
      subscriptionHistory: (await db
        .select()
        .from(subscriptionBillingEventsTable)
        .where(eq(subscriptionBillingEventsTable.userId, studentId))
        .orderBy(desc(subscriptionBillingEventsTable.eventOccurredAt)))
        .map((event) => ({
          providerEventId: event.providerEventId,
          provider: event.provider,
          providerCustomerId: event.providerCustomerId,
          providerSubscriptionId: event.providerSubscriptionId,
          eventType: event.eventType,
          eventOccurredAt: event.eventOccurredAt.toISOString(),
          sequence: event.eventSequence,
          status: event.status,
          paidThroughAt: event.paidThroughAt?.toISOString() ?? null,
          cancelAtPeriodEnd: event.cancelAtPeriodEnd,
          receivedAt: event.receivedAt.toISOString(),
        })),
      deliveryAttempts: (await db
        .select()
        .from(subscriptionDeliveryAttemptsTable)
        .where(or(
          eq(subscriptionDeliveryAttemptsTable.learnerId, studentId),
          sql`lower(${subscriptionDeliveryAttemptsTable.learnerEmail}) = ${user.email.trim().toLowerCase()}`,
        ))
        .orderBy(desc(subscriptionDeliveryAttemptsTable.receivedAt)))
        .map((attempt) => ({
          id: attempt.id,
          providerEventId: attempt.providerEventId,
          provider: attempt.provider,
          eventType: attempt.eventType,
          eventOccurredAt: attempt.eventOccurredAt?.toISOString() ?? null,
          outcome: attempt.outcome,
          httpStatus: attempt.httpStatus,
          duplicate: attempt.duplicate,
          applied: attempt.applied,
          errorCode: attempt.errorCode,
          receivedAt: attempt.receivedAt.toISOString(),
        })),
      waiverSignedAt: waiver?.signedAt?.toISOString() ?? null,
      waiverPdfUrl: waiver && currentEnrollment ? `/api/waiver/pdf/${studentId}?enrollmentId=${currentEnrollment.id}` : null,
      completedModules: completedCount,
      quizResults: Array.from(passedAttempts.values()).map((a) => {
        const totalAttempts = quizAttempts.filter((q) => q.moduleId === a.moduleId).length;
        return {
          moduleId: a.moduleId,
          moduleTitle: moduleMap.get(a.moduleId)?.title ?? "Module",
          passed: a.passed,
          score: a.score,
          attemptedAt: a.attemptedAt.toISOString(),
          totalAttempts,
        };
      }),
      examAttempts: examAttempts.map((a) => ({
        id: a.id,
        score: a.score,
        passed: a.passed,
        totalQuestions: a.totalQuestions,
        attemptedAt: a.attemptedAt.toISOString(),
      })),
      videoProgress: progressRecords
        .map((p) => ({
          moduleId: p.moduleId,
          moduleTitle: moduleMap.get(p.moduleId)?.title ?? "Module",
          videoCompleted: p.videoCompleted,
          quizPassed: p.quizPassed,
          lastTimestamp: p.lastTimestamp,
          updatedAt: p.updatedAt.toISOString(),
        }))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
      moduleFeedback: moduleFeedback.map((feedback) => ({
        id: feedback.id,
        moduleId: feedback.moduleId,
        moduleTitle: moduleMap.get(feedback.moduleId)?.title ?? "Module",
        rating: feedback.rating,
        comment: feedback.comment,
        createdAt: feedback.createdAt.toISOString(),
      })),
      courseFeedback: courseFeedback.map((feedback) => ({
        id: feedback.id,
        rating: feedback.rating,
        clarityRating: feedback.clarityRating,
        usabilityRating: feedback.usabilityRating,
        comment: feedback.comment,
        createdAt: feedback.createdAt.toISOString(),
      })),
      lastActivity: user.lastActivityAt?.toISOString() ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Error getting student detail");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/students/:studentId/subscription-repair", async (req, res): Promise<void> => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const studentId = Number.parseInt(req.params.studentId, 10);
  if (!Number.isInteger(studentId)) {
    res.status(400).json({ error: "Invalid student ID" });
    return;
  }
  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"billing-user:" + studentId}))`);
      const [user] = await tx.select({ id: usersTable.id }).from(usersTable).where(and(eq(usersTable.id, studentId), isNull(usersTable.deletedAt)));
      if (!user) return { missing: true as const };
      const events = await tx.select().from(subscriptionBillingEventsTable)
        .where(eq(subscriptionBillingEventsTable.userId, studentId));
      if (events.length === 0) return { noEvents: true as const };
      const [existing] = await tx.select({ id: learnerSubscriptionsTable.id })
        .from(learnerSubscriptionsTable)
        .where(eq(learnerSubscriptionsTable.userId, studentId))
        .limit(1);
      const orderedEvents = events
        .slice()
        .sort((a, b) => {
          const receivedDifference = a.receivedAt.getTime() - b.receivedAt.getTime();
          return receivedDifference !== 0 ? receivedDifference : a.id - b.id;
        });
      let replay: {
        provider: string;
        providerCustomerId: string | null;
        providerSubscriptionId: string | null;
        status: string;
        paidThroughAt: Date | null;
        cancelAtPeriodEnd: boolean;
        lastEventOccurredAt: Date | null;
        lastEventSequence: number | null;
      } = {
        provider: orderedEvents[0]!.provider,
        providerCustomerId: null,
        providerSubscriptionId: null,
        status: "inactive",
        paidThroughAt: null,
        cancelAtPeriodEnd: false,
        lastEventOccurredAt: null,
        lastEventSequence: null,
      };
      const seenProviderSubscriptionIds = new Set<string>();
      for (const event of orderedEvents) {
        const occurredAt = event.eventOccurredAt;
        if (!occurredAt) continue;

        // Keep replay semantics aligned with live ingestion. A provider may
        // issue a fresh subscription ID for a later paid lifecycle, in which
        // case its sequence can restart. IDs already encountered belong to a
        // retired lifecycle once another ID becomes canonical, so delayed
        // events from them must never move the repaired row backwards.
        const hasDifferentProviderSubscription =
          Boolean(replay.lastEventOccurredAt) &&
          event.providerSubscriptionId !== null &&
          event.providerSubscriptionId !== replay.providerSubscriptionId;
        const isGrantingLifecycleEvent =
          event.paidThroughAt instanceof Date &&
          !subscriptionStatusEndsAccess(event.status) &&
          !subscriptionEventClearsPaidThrough(
            event.status,
            event.eventType,
            event.paidThroughAt,
          );
        const isNewLifecycle =
          hasDifferentProviderSubscription &&
          !seenProviderSubscriptionIds.has(event.providerSubscriptionId!) &&
          isGrantingLifecycleEvent &&
          (!replay.lastEventOccurredAt ||
            occurredAt.getTime() > replay.lastEventOccurredAt.getTime());
        if (event.providerSubscriptionId) {
          seenProviderSubscriptionIds.add(event.providerSubscriptionId);
        }
        if (hasDifferentProviderSubscription && !isNewLifecycle) continue;
        if (!isNewLifecycle && !subscriptionEventIsNewer(replay, event.eventSequence, occurredAt)) continue;
        const clearsPaidThrough = subscriptionEventClearsPaidThrough(
          event.status,
          event.eventType,
          event.paidThroughAt,
        );
        replay = {
          provider: event.provider,
          providerCustomerId: event.providerCustomerId ?? replay.providerCustomerId,
          providerSubscriptionId: event.providerSubscriptionId ?? replay.providerSubscriptionId,
          status: event.status,
          paidThroughAt: nextSubscriptionPaidThroughAt(
            replay.paidThroughAt,
            event.status,
            event.eventType,
            event.paidThroughAt,
            event.paidThroughAtProvided,
          ),
          cancelAtPeriodEnd: event.cancelAtPeriodEnd ??
            (isNewLifecycle || clearsPaidThrough ? false : replay.cancelAtPeriodEnd),
          lastEventOccurredAt: occurredAt,
          lastEventSequence: event.eventSequence ?? replay.lastEventSequence,
        };
      }
      const values = {
        provider: replay.provider,
        providerCustomerId: replay.providerCustomerId,
        providerSubscriptionId: replay.providerSubscriptionId,
        status: replay.status,
        paidThroughAt: replay.paidThroughAt,
        cancelAtPeriodEnd: replay.cancelAtPeriodEnd,
        lastEventOccurredAt: replay.lastEventOccurredAt,
        lastEventSequence: replay.lastEventSequence,
        updatedAt: new Date(),
      };
      const [subscription] = existing
        ? await tx.update(learnerSubscriptionsTable).set(values).where(eq(learnerSubscriptionsTable.id, existing.id)).returning()
        : await tx.insert(learnerSubscriptionsTable).values({ userId: studentId, ...values }).returning();
      return {
        repaired: true as const,
        subscription: {
          status: subscription.status,
          paidThroughAt: subscription.paidThroughAt?.toISOString() ?? null,
          provider: subscription.provider,
          providerCustomerId: subscription.providerCustomerId,
          providerSubscriptionId: subscription.providerSubscriptionId,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        },
      };
    });
    if ("missing" in result) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    if ("noEvents" in result) {
      res.status(404).json({ error: "No subscription history to repair" });
      return;
    }
    res.json(result);
  } catch (err) {
    logger.error({ err, studentId }, "Error repairing student subscription");
    res.status(500).json({ error: "Subscription could not be repaired" });
  }
});

router.post("/admin/students/:studentId/reset-device", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const studentId = parseInt(req.params.studentId);

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, studentId));
    if (!user) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    await db
      .update(usersTable)
      .set({ deviceId: "RESET_" + Date.now() })
      .where(eq(usersTable.id, studentId));

    logger.info({ studentId }, "Device bond reset by admin");
    res.json({ success: true, message: "Device bond reset. Student can now activate from a new device." });
  } catch (err) {
    logger.error({ err }, "Error resetting device bond");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/codes", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const parse = CreateActivationCodeBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { code, notes, assignedTo } = parse.data;

  try {
    const [existing] = await db
      .select()
      .from(activationCodesTable)
      .where(eq(activationCodesTable.code, code));

    if (existing) {
      res.status(409).json({ error: "Code already exists" });
      return;
    }

    const [newCode] = await db
      .insert(activationCodesTable)
      .values({ code, notes: notes ?? null, assignedTo: assignedTo ?? null })
      .returning();

    res.status(201).json({
      id: newCode.id,
      code: newCode.code,
      isUsed: newCode.isUsed,
      createdAt: newCode.createdAt.toISOString(),
      notes: newCode.notes ?? null,
      assignedTo: newCode.assignedTo ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Error creating activation code");
    res.status(500).json({ error: "Internal server error" });
  }
});

// List all access codes (unlimited + standard)
router.get("/admin/codes", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const codes = await db.select().from(activationCodesTable).orderBy(desc(activationCodesTable.createdAt));
    // Attach user count per code
    const userCounts = await db
      .select({ code: usersTable.activationCode, cnt: count(usersTable.id) })
      .from(usersTable)
      .where(isNull(usersTable.deletedAt))
      .groupBy(usersTable.activationCode);
    const countMap = new Map(userCounts.map((r) => [r.code, Number(r.cnt)]));
    res.json(codes.map((c) => ({
      id: c.id,
      code: c.code,
      isUsed: c.isUsed,
      isUnlimited: c.isUnlimited,
      allModulesUnlocked: c.allModulesUnlocked,
      isPaused: c.isPaused,
      notes: c.notes ?? null,
      assignedTo: c.assignedTo ?? null,
      createdAt: c.createdAt.toISOString(),
      userCount: countMap.get(c.code) ?? 0,
    })));
  } catch (err) {
    logger.error({ err }, "Error listing codes");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update assignedTo on a code
router.patch("/admin/codes/:code/assign", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const code = req.params.code.toUpperCase();
  const { assignedTo } = req.body as { assignedTo: string | null };
  try {
    const [updated] = await db
      .update(activationCodesTable)
      .set({ assignedTo: assignedTo ?? null })
      .where(eq(activationCodesTable.code, code))
      .returning();
    if (!updated) { res.status(404).json({ error: "Code not found" }); return; }
    res.json({ code: updated.code, assignedTo: updated.assignedTo ?? null });
  } catch (err) {
    logger.error({ err }, "Error updating code assignedTo");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Toggle pause on any code
router.delete("/admin/codes/:code", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const { code } = req.params;
  try {
    const deleted = await db.delete(activationCodesTable)
      .where(eq(activationCodesTable.code, code))
      .returning();
    if (deleted.length === 0) {
      res.status(404).json({ error: "Code not found" });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Failed to delete activation code");
    res.status(500).json({ error: "Failed to delete code" });
  }
});

router.patch("/admin/codes/:code/pause", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const code = req.params.code.toUpperCase();
  const { paused } = req.body as { paused: boolean };
  if (typeof paused !== "boolean") { res.status(400).json({ error: "paused must be boolean" }); return; }
  try {
    const [updated] = await db
      .update(activationCodesTable)
      .set({ isPaused: paused })
      .where(eq(activationCodesTable.code, code))
      .returning();
    if (!updated) { res.status(404).json({ error: "Code not found" }); return; }
    logger.info({ code, paused }, "Admin toggled code pause state");
    res.json({ code: updated.code, isPaused: updated.isPaused });
  } catch (err) {
    logger.error({ err }, "Error toggling code pause");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/modules", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const modules = await db
      .select({ id: modulesTable.id, title: modulesTable.title, vimeoId: modulesTable.vimeoId, pdfUrl: modulesTable.pdfUrl, order: modulesTable.order, contentType: modulesTable.contentType })
      .from(modulesTable)
      .orderBy(modulesTable.order);
    res.json(modules);
  } catch (err) {
    logger.error({ err }, "Error fetching modules");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/modules/:moduleId/pdf", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const moduleId = Number.parseInt(req.params.moduleId, 10);
  if (!Number.isInteger(moduleId)) {
    res.status(400).json({ error: "Invalid module ID" });
    return;
  }

  try {
    const [module] = await db
      .select({ title: modulesTable.title, pdfUrl: modulesTable.pdfUrl })
      .from(modulesTable)
      .where(eq(modulesTable.id, moduleId))
      .limit(1);
    if (!module?.pdfUrl) {
      res.status(404).json({ error: "PDF not found" });
      return;
    }
    if (module.pdfUrl.startsWith("/") || new URL(module.pdfUrl).origin === `${req.protocol}://${req.get("host")}`) {
      res.status(400).json({ error: "Local PDFs should be downloaded directly" });
      return;
    }

    const { bytes, contentType } = await fetchPublicPdf(module.pdfUrl);
    const safeName = module.title.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || `module-${moduleId}`;
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${safeName}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.send(bytes);
  } catch (err) {
    logger.warn({ err, moduleId }, "Could not fetch external module PDF");
    res.status(502).json({ error: "Could not fetch external PDF" });
  }
});

router.patch("/admin/modules/:moduleId", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const moduleId = parseInt(req.params.moduleId);
  const { vimeoId, pdfUrl } = req.body as { vimeoId?: string; pdfUrl?: string };

  if (pdfUrl !== undefined) {
    // PDF URL update
    try {
      await db.update(modulesTable).set({ pdfUrl: pdfUrl.trim() || null }).where(eq(modulesTable.id, moduleId));
      logger.info({ moduleId, pdfUrl }, "Module pdfUrl updated by admin");
      res.json({ success: true });
    } catch (err) {
      logger.error({ err }, "Error updating module pdfUrl");
      res.status(500).json({ error: "Internal server error" });
    }
    return;
  }

  if (!vimeoId || typeof vimeoId !== "string" || !vimeoId.trim()) {
    res.status(400).json({ error: "vimeoId or pdfUrl is required" });
    return;
  }
  try {
    await db.update(modulesTable).set({ vimeoId: vimeoId.trim() }).where(eq(modulesTable.id, moduleId));
    logger.info({ moduleId, vimeoId }, "Module vimeoId updated by admin");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error updating module vimeoId");
    res.status(500).json({ error: "Internal server error" });
  }
});

const LEGACY_WELCOME_MODULE_QUIZ_STEP =
  "Work through the 7 training modules in order — each one unlocks after you watch the video and pass the quiz (80% to pass).";
const CURRENT_WELCOME_MODULE_QUIZ_STEP =
  "Work through the 7 training modules in order — watch each video in full and score 100% on its quiz to unlock the next module.";
const CURRENT_WELCOME_FINAL_EXAM_STEP =
  "After every video module is complete, the final exam requires 80% to pass.";

function normalizeLegacyWelcomeNote(value: string): string {
  try {
    const config = JSON.parse(value) as { steps?: unknown };
    if (!Array.isArray(config.steps)) return value;

    let changed = false;
    const steps = config.steps.flatMap((step) => {
      if (step === LEGACY_WELCOME_MODULE_QUIZ_STEP) {
        changed = true;
        return [CURRENT_WELCOME_MODULE_QUIZ_STEP, CURRENT_WELCOME_FINAL_EXAM_STEP];
      }
      return [step];
    });

    return changed ? JSON.stringify({ ...config, steps }) : value;
  } catch {
    return value;
  }
}

// Public: GET /config/:key
router.get("/config/:key", async (req, res) => {
  const { key } = req.params;
  try {
    const [row] = await db.select().from(appConfigTable).where(eq(appConfigTable.key, key));
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const value = key === "welcome-note" ? normalizeLegacyWelcomeNote(row.value) : row.value;
    res.json({ key: row.key, value });
  } catch (err) {
    logger.error({ err }, "Error fetching app config");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: PUT /admin/config/:key
router.put("/admin/config/:key", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { key } = req.params;
  const { value } = req.body as { value?: unknown };
  if (typeof value !== "string") {
    res.status(400).json({ error: "value must be a string" });
    return;
  }
  try {
    await db
      .insert(appConfigTable)
      .values({ key, value })
      .onConflictDoUpdate({ target: appConfigTable.key, set: { value, updatedAt: new Date() } });
    logger.info({ key }, "App config updated by admin");
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error updating app config");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/students/:studentId/delete", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const uid = parseInt(req.params.studentId, 10);
  if (isNaN(uid)) {
    res.status(400).json({ error: "Invalid student ID" });
    return;
  }

  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.id, uid));
    if (users.length === 0) {
      // Deletion is intentionally idempotent. The dashboard can briefly retain
      // a cached student detail after a successful delete; a repeated request
      // must not turn that successful outcome into a misleading failure.
      res.json({ success: true, message: "Student account already deleted" });
      return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(waiversTable).where(eq(waiversTable.userId, uid));
      await tx.delete(userProgressTable).where(eq(userProgressTable.userId, uid));
      await tx.delete(quizAttemptsTable).where(eq(quizAttemptsTable.userId, uid));
      await tx.delete(examAttemptsTable).where(eq(examAttemptsTable.userId, uid));
      await tx.delete(chatMessagesTable).where(eq(chatMessagesTable.userId, uid));
      await tx.delete(inspectionRecordsTable).where(eq(inspectionRecordsTable.userId, uid));
      await tx.delete(riskAssessmentsTable).where(eq(riskAssessmentsTable.userId, uid));
      await tx.delete(videoEngagementTable).where(eq(videoEngagementTable.userId, uid));
      await tx.delete(moduleFeedbackTable).where(eq(moduleFeedbackTable.userId, uid));
      await tx.delete(subscriptionBillingEventsTable).where(eq(subscriptionBillingEventsTable.userId, uid));
      await tx.delete(subscriptionDeliveryAttemptsTable).where(or(
        eq(subscriptionDeliveryAttemptsTable.learnerId, uid),
        sql`lower(${subscriptionDeliveryAttemptsTable.learnerEmail}) = ${users[0]!.email.trim().toLowerCase()}`,
      ));
      await tx.delete(learnerSubscriptionsTable).where(eq(learnerSubscriptionsTable.userId, uid));
      await tx.delete(courseEnrolmentsTable).where(eq(courseEnrolmentsTable.userId, uid));
      await tx.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, uid));
      await tx.delete(appFeedbackTable).where(eq(appFeedbackTable.userId, uid));
      await tx.delete(usersTable).where(eq(usersTable.id, uid));
    });

    logger.info({ userId: uid }, "Student account permanently deleted by admin");
    res.json({ success: true, message: "Student account permanently deleted" });
  } catch (err) {
    logger.error({ err }, "Error deleting student account");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Delete orphaned waivers (no matching user) ──────────────────────────────

router.delete("/admin/waivers/orphaned", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const allWaivers = await db.select().from(waiversTable);
    const allUsers = await db.select({ id: usersTable.id }).from(usersTable);
    const userIds = new Set(allUsers.map(u => u.id));
    const orphaned = allWaivers.filter(w => !userIds.has(w.userId));
    for (const w of orphaned) {
      await db.delete(waiversTable).where(eq(waiversTable.id, w.id));
    }
    res.json({ success: true, deleted: orphaned.length, ids: orphaned.map(w => w.id) });
  } catch (err) {
    logger.error({ err }, "Error deleting orphaned waivers");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Stamp certificate fields from exam attempt ───────────────────────────────

router.post("/admin/users/:userId/issue-certificate", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const uid = parseInt(req.params.userId, 10);
    const enrollmentId = Number(req.body?.enrollmentId);
    if (!enrollmentId) { res.status(400).json({ error: "enrollmentId is required" }); return; }
    const [attempt] = await db
      .select()
      .from(examAttemptsTable)
      .where(and(
        eq(examAttemptsTable.userId, uid),
        eq(examAttemptsTable.enrollmentId, enrollmentId),
        eq(examAttemptsTable.passed, true),
      ))
      .orderBy(examAttemptsTable.attemptedAt)
      .limit(1);
    if (!attempt) { res.status(404).json({ error: "No passing exam attempt found" }); return; }
    const completedAt = attempt.attemptedAt;
    const [existingEnrollment] = await db.select().from(courseEnrolmentsTable).where(and(
      eq(courseEnrolmentsTable.id, enrollmentId),
      eq(courseEnrolmentsTable.userId, uid),
      eq(courseEnrolmentsTable.isDeleted, false),
    ));
    if (!existingEnrollment) { res.status(404).json({ error: "Enrolment not found" }); return; }
    const [enrollment] = await db.update(courseEnrolmentsTable).set({
      courseCompletedAt: existingEnrollment.courseCompletedAt ?? completedAt,
      certificateIssuedAt: completedAt,
    }).where(and(
      eq(courseEnrolmentsTable.id, enrollmentId),
      eq(courseEnrolmentsTable.userId, uid),
      eq(courseEnrolmentsTable.isDeleted, false),
      isNull(courseEnrolmentsTable.certificateIssuedAt),
    )).returning();
    if (!enrollment) {
      res.status(409).json({ error: "Certificate already issued for this enrolment" });
      return;
    }
    res.json({ success: true, userId: uid, enrollmentId, certificateIssuedAt: completedAt });
  } catch (err) {
    logger.error({ err }, "Error issuing certificate");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Backup: request-bound readable Sheets and document exports ────────────

router.post("/admin/backup/export", async (req, res): Promise<void> => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const started = await startManualBackup();
    if (!started.started) {
      res.status(409).json({
        error: started.error,
        ...(started.run ? { run: {
          state: started.run.state,
          startedAt: started.run.startedAt,
          source: started.run.source,
          error: started.run.error,
          result: started.run.result,
        } } : {}),
      });
      return;
    }
    res.status(started.run.state === "running" ? 202 : 200).json({
      state: started.run.state,
      startedAt: started.run.startedAt,
      source: started.run.source,
      error: started.run.error,
      result: started.run.result,
    });
  } catch (error) {
    logger.error({ err: error }, "Could not start manual readable backup");
    res.status(500).json({ error: "The backup could not start. Check the API logs and try again." });
  }
});

router.get("/admin/backup/status", async (req, res): Promise<void> => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const [run, latestReadableRun] = await Promise.all([
    getLatestBackupRun(),
    getLatestReadableBackupRun(),
  ]);
  const latestReadableResult = latestReadableRun?.result
    ? { ...latestReadableRun.result, driveFileIds: undefined }
    : null;
  res.json(run ? {
    state: run.state,
    startedAt: run.startedAt,
    source: run.source,
    error: run.error,
    result: run.result,
    latestReadable: latestReadableResult ? {
      ...latestReadableResult,
      at: latestReadableRun!.finishedAt ?? latestReadableRun!.startedAt,
    } : null,
  } : {
    latestReadable: latestReadableResult ? {
      ...latestReadableResult,
      at: latestReadableRun!.finishedAt ?? latestReadableRun!.startedAt,
    } : null,
  });
});

// Old Sheet export is no longer a backup. Keep the route but explicitly refuse it.

router.get("/admin/backup/export", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.status(410).json({ error: "Use the Backup all data action to create readable Sheets and PDFs." });
  return;
  try {
    const [
      users, progress, waivers, codes,
      inspections, risks, passports,
      moduleFeedback, appFeedback, modules,
      videoEngagement,
    ] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(userProgressTable),
      db.select().from(waiversTable),
      db.select().from(activationCodesTable),
      db.select().from(inspectionRecordsTable),
      db.select().from(riskAssessmentsTable),
      db.select().from(assessmentPassportsTable),
      db.select().from(moduleFeedbackTable),
      db.select().from(appFeedbackTable),
      db.select().from(modulesTable),
      db.select().from(videoEngagementTable),
    ]);

    // ── Lookup maps ────────────────────────────────────────────────────────────
    const userById: Record<number, typeof users[0]> = {};
    users.forEach((u) => { userById[u.id] = u; });

    const moduleById: Record<number, typeof modules[0]> = {};
    modules.forEach((m) => { moduleById[m.id] = m; });

    const progressByUser: Record<number, { completed: number; total: number }> = {};
    progress.forEach((p) => {
      if (!progressByUser[p.userId]) progressByUser[p.userId] = { completed: 0, total: 0 };
      progressByUser[p.userId].total++;
      if (p.quizPassed) progressByUser[p.userId].completed++;
    });

    const waiverByUser: Record<number, string> = {};
    waivers.forEach((w) => { waiverByUser[w.userId] = w.signedAt.toISOString(); });

    const inspCountByUser: Record<number, number> = {};
    inspections.forEach((i) => { inspCountByUser[i.userId] = (inspCountByUser[i.userId] ?? 0) + 1; });

    const riskCountByUser: Record<number, number> = {};
    risks.forEach((r) => { riskCountByUser[r.userId] = (riskCountByUser[r.userId] ?? 0) + 1; });

    const phoneByUser: Record<number, string> = {};
    passports.forEach((p) => { phoneByUser[p.userId] = p.phone; });

    const unusedCodes = codes.filter((c) => !c.isUsed);

    // ── Build Sheets API cell structures ─────────────────────────────────────
    type CellValue = string | number | null | undefined;
    const toCell = (v: CellValue) => ({
      userEnteredValue: typeof v === "number"
        ? { numberValue: v }
        : { stringValue: String(v ?? "") },
    });
    // Phone numbers must be forced to TEXT format so Google Sheets / Excel
    // never strips the leading zero (e.g. 07700… → 7700…).
    const toPhoneCell = (v: string) => ({
      userEnteredValue: { stringValue: v },
      userEnteredFormat: { numberFormat: { type: "TEXT" } },
    });
    const toRow = (vals: CellValue[]) => ({ values: vals.map(toCell) });

    // ── Sheet 0: Learners summary ─────────────────────────────────────────────
    const LEARNER_HEADERS = [
      "ID", "Full Name", "Email", "Activation Code", "Device ID",
      "Activated At", "Last Activity", "Waiver Signed At",
      "Modules Completed", "Modules Total",
      "Inspection Records", "Risk Assessments",
      "Phone (Gateway Passport)",
    ];

    const learnerRows = users.map((u) => {
      const prog = progressByUser[u.id] ?? { completed: 0, total: 0 };
      const phone = phoneByUser[u.id] ?? "";
      const baseCells = [
        u.id, u.fullName, u.email, u.activationCode, u.deviceId,
        u.activatedAt.toISOString(), u.lastActivityAt?.toISOString() ?? "",
        waiverByUser[u.id] ?? "", prog.completed, prog.total,
        inspCountByUser[u.id] ?? 0, riskCountByUser[u.id] ?? 0,
      ].map(toCell);
      return { values: [...baseCells, toPhoneCell(phone)] };
    });

    // ── Sheet 1: Unused Codes ─────────────────────────────────────────────────
    const CODE_HEADERS = ["Code", "Notes", "Created At"];
    const codeRows = unusedCodes.map((c) =>
      toRow([c.code, c.notes ?? "", c.createdAt.toISOString()])
    );

    // ── Sheet 2: Video Progress ───────────────────────────────────────────────
    const VIDEO_HEADERS = [
      "Student Name", "Email", "Module", "Video Watched",
      "Quiz Passed", "Quiz Score", "Video Launched At", "Video Completed At",
      "Seek Attempts", "Last Updated",
    ];

    // Build a map from (userId, moduleId) to engagement record
    const engagementKey = (uid: number, mid: number) => `${uid}:${mid}`;
    const engagementMap: Record<string, typeof videoEngagement[0]> = {};
    videoEngagement.forEach((e) => { engagementMap[engagementKey(e.userId, e.moduleId)] = e; });

    const videoRows = progress.map((p) => {
      const u = userById[p.userId];
      const m = moduleById[p.moduleId];
      const eng = engagementMap[engagementKey(p.userId, p.moduleId)];
      return toRow([
        u?.fullName ?? "", u?.email ?? "",
        m?.title ?? `Module ${p.moduleId}`,
        p.videoCompleted ? "Yes" : "No",
        p.quizPassed ? "Yes" : "No",
        p.quizScore ?? "",
        eng?.launchedAt?.toISOString() ?? "",
        eng?.completedAt?.toISOString() ?? "",
        eng?.seekAttemptCount ?? 0,
        p.updatedAt?.toISOString() ?? "",
      ]);
    });

    // ── Sheet 3: Module Feedback ──────────────────────────────────────────────
    const MODULE_FEEDBACK_HEADERS = [
      "Student Name", "Email", "Module", "Rating", "Comment", "Submitted At",
    ];
    const moduleFeedbackRows = moduleFeedback.map((f) => {
      const u = userById[f.userId];
      const m = moduleById[f.moduleId];
      return toRow([
        u?.fullName ?? "", u?.email ?? "",
        m?.title ?? `Module ${f.moduleId}`,
        f.rating, f.comment ?? "",
        f.createdAt?.toISOString() ?? "",
      ]);
    });

    // ── Sheet 4: App Feedback ─────────────────────────────────────────────────
    const APP_FEEDBACK_HEADERS = [
      "Student Name", "Email", "Rating", "Comment", "Submitted At",
    ];
    const appFeedbackRows = appFeedback.map((f) => {
      const u = userById[f.userId];
      return toRow([
        u?.fullName ?? "", u?.email ?? "",
        f.rating, f.comment ?? "",
        f.createdAt?.toISOString() ?? "",
      ]);
    });

    // ── Sheet 5: Inspections (detailed) ──────────────────────────────────────
    const INSPECTION_HEADERS = [
      "Student Name", "Email", "Saw / Equipment ID",
      "Overall Result", "Item", "Section", "Status", "Note", "Submitted At",
    ];
    const inspectionRows: ReturnType<typeof toRow>[] = [];
    for (const insp of inspections) {
      const u = userById[insp.userId];
      let items: Array<{ id?: number; label?: string; section?: string; status?: string; note?: string }> = [];
      try { items = JSON.parse(insp.items as unknown as string); } catch { /* ignore */ }
      if (items.length === 0) {
        inspectionRows.push(toRow([
          u?.fullName ?? "", u?.email ?? "",
          insp.sawIdentifier ?? "",
          insp.hasFailures ? "FAILED" : "PASS",
          "", "", "", "",
          insp.createdAt?.toISOString() ?? "",
        ]));
      } else {
        items.forEach((item) => {
          inspectionRows.push(toRow([
            u?.fullName ?? "", u?.email ?? "",
            insp.sawIdentifier ?? "",
            insp.hasFailures ? "FAILED" : "PASS",
            item.label ?? "", item.section ?? "",
            item.status ?? "", item.note ?? "",
            insp.createdAt?.toISOString() ?? "",
          ]));
        });
      }
    }

    // ── Sheet 6: Risk Assessments (detailed) ─────────────────────────────────
    const RISK_HEADERS = [
      "Student Name", "Email", "Task Description", "Site Description",
      "Address", "Grid Ref", "What3Words",
      "Nearest Hospital", "Hospital Phone",
      "Hazard", "Likelihood", "Severity", "Risk Rating", "Control Measures",
      "Submitted At",
    ];
    const riskRows: ReturnType<typeof toRow>[] = [];
    for (const ra of risks) {
      const u = userById[ra.userId];
      let hazards: Array<{ label?: string; likelihood?: number; severity?: number; riskRating?: number; controlMeasures?: string }> = [];
      try { hazards = JSON.parse(ra.hazards as unknown as string); } catch { /* ignore */ }
      if (hazards.length === 0) {
        riskRows.push(toRow([
          u?.fullName ?? "", u?.email ?? "",
          ra.taskDescription ?? "", ra.siteDescription ?? "",
          ra.address ?? "", ra.gridReference ?? "", ra.what3Words ?? "",
          ra.nearestHospital ?? "", ra.hospitalPhone ?? "",
          "", "", "", "", "",
          ra.createdAt?.toISOString() ?? "",
        ]));
      } else {
        hazards.forEach((h) => {
          riskRows.push(toRow([
            u?.fullName ?? "", u?.email ?? "",
            ra.taskDescription ?? "", ra.siteDescription ?? "",
            ra.address ?? "", ra.gridReference ?? "", ra.what3Words ?? "",
            ra.nearestHospital ?? "", ra.hospitalPhone ?? "",
            h.label ?? "", h.likelihood ?? "", h.severity ?? "",
            h.riskRating ?? "", h.controlMeasures ?? "",
            ra.createdAt?.toISOString() ?? "",
          ]));
        });
      }
    }

    // Orange header format matching brand colour #e27226
    const headerFmt = {
      userEnteredFormat: {
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
        backgroundColor: { red: 0.886, green: 0.447, blue: 0.149 },
      },
    };

    const now = new Date();
    const dateLabel = now.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const title = `Chainsaw Courses Export — ${dateLabel}`;

    const allSheets = [
      { id: 0, title: "Learners",           headers: LEARNER_HEADERS,         rows: learnerRows },
      { id: 1, title: "Unused Codes",        headers: CODE_HEADERS,            rows: codeRows },
      { id: 2, title: "Video Progress",      headers: VIDEO_HEADERS,           rows: videoRows },
      { id: 3, title: "Module Feedback",     headers: MODULE_FEEDBACK_HEADERS, rows: moduleFeedbackRows },
      { id: 4, title: "App Feedback",        headers: APP_FEEDBACK_HEADERS,    rows: appFeedbackRows },
      { id: 5, title: "Inspections",         headers: INSPECTION_HEADERS,      rows: inspectionRows },
      { id: 6, title: "Risk Assessments",    headers: RISK_HEADERS,            rows: riskRows },
    ];

    // ── Find or create the "Chainsaw Courses User Backup" folder ─────────────
    const connectors = new ReplitConnectors();
    const BACKUP_FOLDER_NAME = "Chainsaw Courses User Backup";

    const folderSearchRes = await connectors.proxy(
      "google-drive",
      `/drive/v3/files?q=${encodeURIComponent(`name='${BACKUP_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)`,
      { method: "GET" },
    );
    const folderSearchData = await folderSearchRes.json() as { files: Array<{ id: string }> };

    let folderId: string;
    if (folderSearchData.files.length > 0) {
      folderId = folderSearchData.files[0].id;
    } else {
      const createFolderRes = await connectors.proxy(
        "google-drive",
        "/drive/v3/files",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: BACKUP_FOLDER_NAME,
            mimeType: "application/vnd.google-apps.folder",
          }),
        },
      );
      const folderData = await createFolderRes.json() as { id: string };
      folderId = folderData.id;
      logger.info({ folderId }, "Created Google Drive backup folder");
    }

    // ── Create blank spreadsheet inside the folder ────────────────────────────
    const createFileRes = await connectors.proxy(
      "google-drive",
      "/drive/v3/files",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: title,
          mimeType: "application/vnd.google-apps.spreadsheet",
          parents: [folderId],
        }),
      },
    );
    const fileData = await createFileRes.json() as { id: string };
    const spreadsheetId = fileData.id;

    // ── Discover the default sheet's actual ID ────────────────────────────────
    const metaRes = await connectors.proxy(
      "google-sheet",
      `/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.sheetId`,
      { method: "GET" },
    );
    const metaData = await metaRes.json() as { sheets: Array<{ properties: { sheetId: number } }> };
    const defaultSheetId = metaData.sheets[0].properties.sheetId;

    // Map logical sheet IDs (0–6) to real IDs:
    // sheet 0 → defaultSheetId, sheets 1–6 → 1001–1006
    const sheetIdMap = allSheets.map((s, i) => ({
      ...s,
      actualId: i === 0 ? defaultSheetId : 1000 + i,
    }));

    // ── Rename default sheet + add remaining sheets ───────────────────────────
    const setupRequests = [
      {
        updateSheetProperties: {
          properties: { sheetId: defaultSheetId, title: sheetIdMap[0].title },
          fields: "title",
        },
      },
      ...sheetIdMap.slice(1).map((s) => ({
        addSheet: { properties: { sheetId: s.actualId, title: s.title } },
      })),
    ];

    await connectors.proxy(
      "google-sheet",
      `/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests: setupRequests }),
      },
    );

    // ── Populate data + format headers + auto-resize ──────────────────────────
    const populateRequests = sheetIdMap.flatMap((s) => [
      {
        updateCells: {
          start: { sheetId: s.actualId, rowIndex: 0, columnIndex: 0 },
          rows: [toRow(s.headers), ...s.rows],
          fields: "userEnteredValue,userEnteredFormat",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId: s.actualId,
            startRowIndex: 0, endRowIndex: 1,
            startColumnIndex: 0, endColumnIndex: s.headers.length,
          },
          cell: headerFmt,
          fields: "userEnteredFormat(textFormat,backgroundColor)",
        },
      },
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: s.actualId,
            dimension: "COLUMNS",
            startIndex: 0,
            endIndex: s.headers.length,
          },
        },
      },
    ]);

    await connectors.proxy(
      "google-sheet",
      `/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requests: populateRequests }),
      },
    );

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    // ── Save export record to DB ──────────────────────────────────────────────
    try {
      await db.insert(backupExportsTable).values({
        title,
        sheetUrl,
        folderId,
        rowCount: users.length,
      });
    } catch (dbErr) {
      logger.warn({ dbErr }, "Could not save backup export record");
    }

    res.json({ url: sheetUrl, title, folderId });
    logger.info({ rows: users.length, spreadsheetId, folderId }, "Admin exported data to Google Sheet in Drive folder");
  } catch (err) {
    logger.error({ err }, "Error generating Google Sheet export");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Backup: list past exports ────────────────────────────────────────────────
router.get("/admin/backup/exports", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const exports = await db
      .select()
      .from(backupExportsTable)
      .orderBy(desc(backupExportsTable.exportedAt));
    res.json(exports);
  } catch (err) {
    logger.error({ err }, "Error fetching backup exports");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Backup: restoration test log ────────────────────────────────────────────

router.get("/admin/backup/logs", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const logs = await db.select().from(backupTestLogsTable).orderBy(desc(backupTestLogsTable.testedAt));
    res.json(logs);
  } catch (err) {
    logger.error({ err }, "Error fetching backup test logs");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/backup/logs", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { testedAt, testedBy, outcome, notes } = req.body as {
    testedAt: string; testedBy: string; outcome: string; notes?: string;
  };
  if (!testedAt || !testedBy || !outcome) {
    res.status(400).json({ error: "testedAt, testedBy and outcome are required" });
    return;
  }
  if (outcome !== "pass" && outcome !== "fail") {
    res.status(400).json({ error: "outcome must be 'pass' or 'fail'" });
    return;
  }
  try {
    const [row] = await db.insert(backupTestLogsTable).values({
      testedAt: new Date(testedAt),
      testedBy: testedBy.trim(),
      outcome,
      notes: notes?.trim() || null,
    }).returning();
    logger.info({ id: row.id, outcome }, "Backup restoration test logged");
    res.status(201).json(row);
  } catch (err) {
    logger.error({ err }, "Error creating backup test log");
    res.status(500).json({ error: "Internal server error" });
  }
});

// Rebind the ADMIN-PREVIEW account to the requesting device so the admin
// can open the training app fully unlocked on their own device.
router.post("/admin/bind-preview", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  const { deviceId } = req.body as { deviceId?: string };
  if (!deviceId) {
    res.status(400).json({ error: "deviceId required" });
    return;
  }
  try {
    const users = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.activationCode, "ADMIN-PREVIEW"));

    if (users.length === 0) {
      res.status(404).json({ error: "Preview account not found" });
      return;
    }
    const user = users[0];

    // Update device_id to admin's current device
    await db
      .update(usersTable)
      .set({ deviceId })
      .where(eq(usersTable.id, user.id));

    // Auto-sign waiver so the preview never gets blocked by the waiver gate
    const [existingWaiver] = await db.select().from(waiversTable).where(eq(waiversTable.userId, user.id));
    if (!existingWaiver) {
      await db.insert(waiversTable).values({
        userId: user.id,
        signatureData: "ADMIN-AUTO-SIGNED",
        agreedToTerms: true,
      });
    }

    res.json({
      userId: user.id,
      activationCode: "ADMIN-PREVIEW",
      fullName: user.fullName,
      email: user.email,
      deviceId,
    });
  } catch (err) {
    logger.error({ err }, "Error binding preview account");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Delete inspection records ───────────────────────────────────────────────
// NOTE: /all must be declared BEFORE /:id so Express doesn't swallow "all" as an id param.

router.delete("/admin/inspections/all", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    await db.delete(inspectionRecordsTable);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error deleting all inspection records");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/inspections/:id", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    const rows = await db.delete(inspectionRecordsTable).where(eq(inspectionRecordsTable.id, id)).returning();
    if (rows.length === 0) { res.status(404).json({ error: "Record not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error deleting inspection record");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Delete risk assessment records ──────────────────────────────────────────
// NOTE: /all must be declared BEFORE /:id for the same reason.

router.delete("/admin/risk-assessments/all", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    await db.delete(riskAssessmentsTable);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error deleting all risk assessment records");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/risk-assessments/:id", async (req, res) => {
  if (!verifyAdmin(req)) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid ID" }); return; }
  try {
    const rows = await db.delete(riskAssessmentsTable).where(eq(riskAssessmentsTable.id, id)).returning();
    if (rows.length === 0) { res.status(404).json({ error: "Record not found" }); return; }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error deleting risk assessment record");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
