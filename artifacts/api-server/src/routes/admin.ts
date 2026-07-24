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

    res.json({
      totalLearners,
      activeLearners,
      completedLearners,
      certificatesIssued,
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
      quizResults: Array.from(passedAttempts.values()).map((a) => ({
        moduleId: a.moduleId,
        moduleTitle: moduleMap.get(a.moduleId)?.title ?? "Module",
        passed: a.passed,
        score: a.score,
        attemptedAt: a.attemptedAt.toISOString(),
      })),
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

// ─── Backup: export learner data as a new Google Sheet ───────────────────────

router.get("/admin/backup/export", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const users = await db.select().from(usersTable);
    const progress = await db.select().from(userProgressTable);
    const waivers = await db.select().from(waiversTable);
    const codes = await db.select().from(activationCodesTable);
    const inspections = await db.select().from(inspectionRecordsTable);
    const risks = await db.select().from(riskAssessmentsTable);
    const passports = await db.select().from(assessmentPassportsTable);

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

    const LEARNER_HEADERS = [
      "ID", "Full Name", "Email", "Activation Code", "Device ID",
      "Activated At", "Last Activity", "Waiver Signed At",
      "Modules Completed", "Modules Total",
      "Inspection Records", "Risk Assessments",
      "Phone (Gateway Passport)",
    ];
    const CODE_HEADERS = ["Code", "Notes", "Created At"];

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

    const codeRows = unusedCodes.map((c) =>
      toRow([c.code, c.notes ?? "", c.createdAt.toISOString()])
    );

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

    // ── Create the spreadsheet with two sheets ────────────────────────────────
    const connectors = new ReplitConnectors();
    const createRes = await connectors.proxy("google-sheet", "/v4/spreadsheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        properties: { title },
        sheets: [
          {
            properties: { title: "Learners", sheetId: 0 },
            data: [{ rowData: [toRow(LEARNER_HEADERS), ...learnerRows] }],
          },
          {
            properties: { title: "Unused Codes", sheetId: 1 },
            data: [{ rowData: [toRow(CODE_HEADERS), ...codeRows] }],
          },
        ],
      }),
    });

    const sheet = await createRes.json() as { spreadsheetId: string };

    // ── Apply header formatting + auto-resize columns ─────────────────────────
    await connectors.proxy("google-sheet", `/v4/spreadsheets/${sheet.spreadsheetId}:batchUpdate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            repeatCell: {
              range: { sheetId: 0, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: LEARNER_HEADERS.length },
              cell: headerFmt,
              fields: "userEnteredFormat(textFormat,backgroundColor)",
            },
          },
          {
            repeatCell: {
              range: { sheetId: 1, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: CODE_HEADERS.length },
              cell: headerFmt,
              fields: "userEnteredFormat(textFormat,backgroundColor)",
            },
          },
          {
            autoResizeDimensions: {
              dimensions: { sheetId: 0, dimension: "COLUMNS", startIndex: 0, endIndex: LEARNER_HEADERS.length },
            },
          },
          {
            autoResizeDimensions: {
              dimensions: { sheetId: 1, dimension: "COLUMNS", startIndex: 0, endIndex: CODE_HEADERS.length },
            },
          },
        ],
      }),
    });

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}/edit`;
    res.json({ url: sheetUrl });
    logger.info({ rows: users.length, sheetId: sheet.spreadsheetId }, "Admin exported data to Google Sheet");
  } catch (err) {
    logger.error({ err }, "Error generating Google Sheet export");
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

export default router;
