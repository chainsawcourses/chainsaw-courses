import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  activationCodesTable,
  waiversTable,
  userProgressTable,
  modulesTable,
  quizAttemptsTable,
  appConfigTable,
} from "@workspace/db";
import { AdminLoginBody, CreateActivationCodeBody } from "@workspace/api-zod";
import { eq, isNull, gte, count } from "drizzle-orm";
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
    const [totalStudentsResult] = await db
      .select({ count: count() })
      .from(usersTable)
      .where(isNull(usersTable.deletedAt));

    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [activeThisWeekResult] = await db
      .select({ count: count() })
      .from(usersTable)
      .where(gte(usersTable.lastActivityAt, oneWeekAgo));

    const [waiversSignedResult] = await db
      .select({ count: count() })
      .from(waiversTable);

    const [codesUsedResult] = await db
      .select({ count: count() })
      .from(activationCodesTable)
      .where(eq(activationCodesTable.isUsed, true));

    const [codesTotalResult] = await db
      .select({ count: count() })
      .from(activationCodesTable);

    const [totalModulesResult] = await db
      .select({ count: count() })
      .from(modulesTable)
      .where(eq(modulesTable.isActive, true));

    const completedProgressRecords = await db
      .select()
      .from(userProgressTable)
      .where(eq(userProgressTable.quizPassed, true));

    const totalStudents = Number(totalStudentsResult.count);
    const totalModules = Number(totalModulesResult.count);

    let completionRate = 0;
    if (totalStudents > 0 && totalModules > 0) {
      const userCompletions = new Map<number, number>();
      for (const p of completedProgressRecords) {
        userCompletions.set(p.userId, (userCompletions.get(p.userId) ?? 0) + 1);
      }
      const fullyCompleted = Array.from(userCompletions.values()).filter(
        (c) => c >= totalModules
      ).length;
      completionRate = Math.round((fullyCompleted / totalStudents) * 100);
    }

    res.json({
      totalStudents,
      activeThisWeek: Number(activeThisWeekResult.count),
      completionRate,
      waiversSigned: Number(waiversSignedResult.count),
      codesUsed: Number(codesUsedResult.count),
      codesTotal: Number(codesTotalResult.count),
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
      .where(eq(modulesTable.isActive, true));

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
