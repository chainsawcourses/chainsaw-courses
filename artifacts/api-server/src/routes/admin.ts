import { Router } from "express";
import { ReplitConnectors } from "@replit/connectors-sdk";
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
} from "@workspace/db";
import { AdminLoginBody, CreateActivationCodeBody } from "@workspace/api-zod";
import { eq, isNull, gte, count, and, ne, desc } from "drizzle-orm";
import { logger } from "../lib/logger";
import crypto from "crypto";

const router = Router();

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "chainsaw-admin-2024";
const activeTokens = new Set<string>();

export function verifyAdmin(req: { headers: Record<string, string | string[] | undefined> }): boolean {
  const token = req.headers["admintoken"] as string;
  return !!token && activeTokens.has(token);
}

router.post("/admin/login", async (req, res) => {
  const parse = AdminLoginBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { password } = parse.data;
  if (password !== ADMIN_PASSWORD) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = crypto.randomBytes(32).toString("hex");
  activeTokens.add(token);

  setTimeout(() => activeTokens.delete(token), 24 * 60 * 60 * 1000);

  res.json({ success: true, token });
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

    const [totalModulesResult] = await db
      .select({ count: count() })
      .from(modulesTable)
      .where(and(eq(modulesTable.isActive, true), ne(modulesTable.contentType, "pdf")));

    const totalModules = Number(totalModulesResult.count);

    const waivers = await db.select().from(waiversTable);
    const waiverMap = new Map(waivers.map((w) => [w.userId, w]));

    const progressRecords = await db
      .select()
      .from(userProgressTable)
      .where(eq(userProgressTable.quizPassed, true));

    const progressMap = new Map<number, number>();
    for (const p of progressRecords) {
      progressMap.set(p.userId, (progressMap.get(p.userId) ?? 0) + 1);
    }

    const [feedbackCounts, quizAttemptCounts] = await Promise.all([
      db.select({ userId: moduleFeedbackTable.userId, cnt: count() })
        .from(moduleFeedbackTable)
        .groupBy(moduleFeedbackTable.userId),
      db.select({ userId: quizAttemptsTable.userId, cnt: count() })
        .from(quizAttemptsTable)
        .groupBy(quizAttemptsTable.userId),
    ]);

    const feedbackCountMap = new Map(feedbackCounts.map((r) => [r.userId, Number(r.cnt)]));
    const quizAttemptCountMap = new Map(quizAttemptCounts.map((r) => [r.userId, Number(r.cnt)]));

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
      feedbackCount: feedbackCountMap.get(u.id) ?? 0,
      totalQuizAttempts: quizAttemptCountMap.get(u.id) ?? 0,
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

    const [waiver] = await db.select().from(waiversTable).where(eq(waiversTable.userId, studentId));

    const quizAttempts = await db
      .select()
      .from(quizAttemptsTable)
      .where(eq(quizAttemptsTable.userId, studentId));

    const examAttempts = await db
      .select()
      .from(examAttemptsTable)
      .where(eq(examAttemptsTable.userId, studentId))
      .orderBy(examAttemptsTable.attemptedAt);

    const modules = await db.select().from(modulesTable).where(eq(modulesTable.isActive, true));
    const moduleMap = new Map(modules.map((m) => [m.id, m]));

    const passedAttempts = new Map<number, (typeof quizAttempts)[0]>();
    for (const attempt of quizAttempts) {
      if (attempt.passed && !passedAttempts.has(attempt.moduleId)) {
        passedAttempts.set(attempt.moduleId, attempt);
      }
    }

    const progressRecords = await db
      .select()
      .from(userProgressTable)
      .where(eq(userProgressTable.userId, studentId));

    const completedCount = progressRecords.filter((p) => p.videoCompleted && p.quizPassed).length;

    res.json({
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      activatedAt: user.activatedAt.toISOString(),
      activationCode: user.activationCode,
      deviceId: user.deviceId,
      deviceBonded: true,
      waiverSigned: !!waiver,
      accessExpiresAt: user.accessExpiresAt?.toISOString() ?? null,
      courseCompletedAt: user.courseCompletedAt?.toISOString() ?? null,
      certificateIssuedAt: user.certificateIssuedAt?.toISOString() ?? null,
      subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() ?? null,
      waiverSignedAt: waiver?.signedAt?.toISOString() ?? null,
      waiverPdfUrl: waiver ? `/api/waiver/pdf/${studentId}` : null,
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
      lastActivity: user.lastActivityAt?.toISOString() ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Error getting student detail");
    res.status(500).json({ error: "Internal server error" });
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

  const { code, notes } = parse.data;

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
      .values({ code, notes: notes ?? null })
      .returning();

    res.status(201).json({
      id: newCode.id,
      code: newCode.code,
      isUsed: newCode.isUsed,
      createdAt: newCode.createdAt.toISOString(),
      notes: newCode.notes ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Error creating activation code");
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

// Public: GET /config/:key
router.get("/config/:key", async (req, res) => {
  const { key } = req.params;
  try {
    const [row] = await db.select().from(appConfigTable).where(eq(appConfigTable.key, key));
    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ key: row.key, value: row.value });
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
      res.status(404).json({ error: "Student not found" });
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
    const [attempt] = await db
      .select()
      .from(examAttemptsTable)
      .where(and(eq(examAttemptsTable.userId, uid), eq(examAttemptsTable.passed, true)))
      .orderBy(examAttemptsTable.attemptedAt)
      .limit(1);
    if (!attempt) { res.status(404).json({ error: "No passing exam attempt found" }); return; }
    const completedAt = attempt.attemptedAt;
    const expiresAt = new Date(completedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
    await db.update(usersTable).set({
      courseCompletedAt: completedAt,
      certificateIssuedAt: completedAt,
      accessExpiresAt: expiresAt,
    }).where(eq(usersTable.id, uid));
    res.json({ success: true, userId: uid, certificateIssuedAt: completedAt, accessExpiresAt: expiresAt });
  } catch (err) {
    logger.error({ err }, "Error issuing certificate");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Backup: export learner data as a new Google Sheet ───────────────────────

router.get("/admin/backup/export", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
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
