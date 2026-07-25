import { Router } from "express";
import { db } from "@workspace/db";
import {
  usersTable,
  examAttemptsTable,
  examQuestionsTable,
  userProgressTable,
  modulesTable,
  quizQuestionsTable,
  iqaRecordsTable,
  reasonableAdjustmentsTable,
} from "@workspace/db";
import { eq, isNull, not, desc, asc, count, sql, and } from "drizzle-orm";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";

const router = Router();

function adminGuard(req: Parameters<typeof verifyAdmin>[0], res: { status: (n: number) => { json: (o: unknown) => void } }): boolean {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}

// ─── Stats ───────────────────────────────────────────────────────────────────

router.get("/admin/stats-quality", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const now = new Date();

    const [users, examAttempts, progress, modules, quizQuestions] = await Promise.all([
      db.select().from(usersTable).where(isNull(usersTable.deletedAt)),
      db.select().from(examAttemptsTable),
      db.select().from(userProgressTable),
      db.select().from(modulesTable).where(eq(modulesTable.isActive, true)),
      db.select({ moduleId: quizQuestionsTable.moduleId, cnt: count() }).from(quizQuestionsTable).groupBy(quizQuestionsTable.moduleId),
    ]);

    const activeUsers = users.filter(u =>
      u.accessExpiresAt === null || u.accessExpiresAt > now ||
      (u.subscriptionExpiresAt !== null && u.subscriptionExpiresAt > now)
    );
    const completedUsers = users.filter(u => u.courseCompletedAt !== null);
    const passedAttempts = examAttempts.filter(a => a.passed);
    const passRate = examAttempts.length > 0
      ? Math.round((passedAttempts.length / examAttempts.length) * 100)
      : 0;
    const avgScore = passedAttempts.length > 0
      ? Math.round(passedAttempts.reduce((s, a) => s + a.score, 0) / passedAttempts.length)
      : 0;

    const quizModuleIds = new Set(quizQuestions.map(q => q.moduleId));
    const videoModules = modules.filter(m => m.contentType === "video");
    const progressMap = new Map(
      progress.map(p => [`${p.userId}:${p.moduleId}`, p])
    );

    const moduleStats = videoModules.map(mod => {
      const videoCompleted = [...new Set(
        progress.filter(p => p.moduleId === mod.id && p.videoCompleted).map(p => p.userId)
      )].length;
      const quizPassed = quizModuleIds.has(mod.id)
        ? [...new Set(progress.filter(p => p.moduleId === mod.id && p.quizPassed).map(p => p.userId))].length
        : null;
      return { moduleId: mod.id, title: mod.title, order: mod.order, videoCompleted, quizPassed };
    }).sort((a, b) => a.order - b.order);

    const recentActivity = examAttempts
      .sort((a, b) => b.attemptedAt.getTime() - a.attemptedAt.getTime())
      .slice(0, 10)
      .map(a => {
        const user = users.find(u => u.id === a.userId);
        return {
          type: "exam",
          userId: a.userId,
          fullName: user?.fullName ?? "Unknown",
          passed: a.passed,
          score: a.score,
          at: a.attemptedAt.toISOString(),
        };
      });

    res.json({
      totalLearners: users.length,
      activeLearners: activeUsers.length,
      completedLearners: completedUsers.length,
      certificatesIssued: completedUsers.length,
      totalExamAttempts: examAttempts.length,
      passRate,
      averagePassScore: avgScore,
      moduleStats,
      recentActivity,
    });
  } catch (err) {
    logger.error({ err }, "Error fetching admin stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Certificate Register ────────────────────────────────────────────────────

router.get("/admin/certificates", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const users = await db.select().from(usersTable)
      .where(and(isNull(usersTable.deletedAt), not(isNull(usersTable.courseCompletedAt))))
      .orderBy(desc(usersTable.courseCompletedAt));

    const userIds = users.map(u => u.id);
    const allAttempts = userIds.length > 0
      ? await db.select().from(examAttemptsTable).where(eq(examAttemptsTable.passed, true))
      : [];

    const bestScoreMap = new Map<number, number>();
    for (const a of allAttempts) {
      const prev = bestScoreMap.get(a.userId) ?? 0;
      if (a.score > prev) bestScoreMap.set(a.userId, a.score);
    }

    res.json(users.map(u => ({
      id: u.id,
      fullName: u.fullName,
      email: u.email,
      activationCode: u.activationCode,
      courseCompletedAt: u.courseCompletedAt!.toISOString(),
      certificateIssuedAt: u.certificateIssuedAt?.toISOString() ?? null,
      examScore: bestScoreMap.get(u.id) ?? null,
      accessExpiresAt: u.accessExpiresAt?.toISOString() ?? null,
    })));
  } catch (err) {
    logger.error({ err }, "Error fetching certificates");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Exam Attempt Log ────────────────────────────────────────────────────────

router.get("/admin/exam-log", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const [attempts, users] = await Promise.all([
      db.select().from(examAttemptsTable).orderBy(desc(examAttemptsTable.attemptedAt)),
      db.select({ id: usersTable.id, fullName: usersTable.fullName, email: usersTable.email }).from(usersTable),
    ]);
    const userMap = new Map(users.map(u => [u.id, u]));

    const attemptsByUser = new Map<number, number>();
    const sorted = [...attempts].sort((a, b) => a.attemptedAt.getTime() - b.attemptedAt.getTime());
    for (const a of sorted) {
      attemptsByUser.set(a.userId, (attemptsByUser.get(a.userId) ?? 0) + 1);
    }
    const runningCount = new Map<number, number>();

    res.json(attempts.map(a => {
      const n = (runningCount.get(a.userId) ?? 0) + 1;
      runningCount.set(a.userId, n);
      const user = userMap.get(a.userId);
      return {
        id: a.id,
        userId: a.userId,
        fullName: user?.fullName ?? "Deleted",
        email: user?.email ?? "",
        score: a.score,
        passed: a.passed,
        totalQuestions: a.totalQuestions,
        attemptedAt: a.attemptedAt.toISOString(),
        attemptNumber: attemptsByUser.get(a.userId) ?? 1,
      };
    }));
  } catch (err) {
    logger.error({ err }, "Error fetching exam log");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Assessment Bank ─────────────────────────────────────────────────────────

router.get("/admin/assessment-bank", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const questions = await db.select().from(examQuestionsTable);
    const active = questions.filter(q => q.isActive);

    const byLO = new Map<string, { total: number; active: number }>();
    for (const q of questions) {
      const lo = q.learningOutcome ?? "Unassigned";
      const entry = byLO.get(lo) ?? { total: 0, active: 0 };
      entry.total++;
      if (q.isActive) entry.active++;
      byLO.set(lo, entry);
    }

    const byAC = new Map<string, { total: number; active: number }>();
    for (const q of questions) {
      const ac = q.assessmentCriteria ?? "Unassigned";
      const entry = byAC.get(ac) ?? { total: 0, active: 0 };
      entry.total++;
      if (q.isActive) entry.active++;
      byAC.set(ac, entry);
    }

    res.json({
      totalQuestions: questions.length,
      activeQuestions: active.length,
      inactiveQuestions: questions.length - active.length,
      byLearningOutcome: [...byLO.entries()].map(([lo, v]) => ({ learningOutcome: lo, ...v })).sort((a, b) => a.learningOutcome.localeCompare(b.learningOutcome)),
      byAssessmentCriteria: [...byAC.entries()].map(([ac, v]) => ({ assessmentCriteria: ac, ...v })).sort((a, b) => a.assessmentCriteria.localeCompare(b.assessmentCriteria)),
    });
  } catch (err) {
    logger.error({ err }, "Error fetching assessment bank");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── IQA Records ─────────────────────────────────────────────────────────────

router.get("/admin/iqa-records", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const records = await db.select().from(iqaRecordsTable).orderBy(desc(iqaRecordsTable.sampleDate));
    res.json(records.map(r => ({
      ...r,
      studentIds: JSON.parse(r.studentIds) as number[],
      sampleDate: r.sampleDate.toISOString(),
      signedOffAt: r.signedOffAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    logger.error({ err }, "Error fetching IQA records");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/iqa-records", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const { reviewerName, sampleDate, studentIds, findingsSummary, actionRequired, actionTaken } = req.body as {
      reviewerName: string; sampleDate: string; studentIds: number[];
      findingsSummary: string; actionRequired?: string; actionTaken?: string;
    };
    if (!reviewerName || !findingsSummary) {
      res.status(400).json({ error: "reviewerName and findingsSummary are required" });
      return;
    }
    const [record] = await db.insert(iqaRecordsTable).values({
      reviewerName,
      sampleDate: sampleDate ? new Date(sampleDate) : new Date(),
      studentIds: JSON.stringify(studentIds ?? []),
      findingsSummary,
      actionRequired: actionRequired ?? null,
      actionTaken: actionTaken ?? null,
    }).returning();
    res.json({ ...record, studentIds: JSON.parse(record.studentIds) as number[] });
  } catch (err) {
    logger.error({ err }, "Error creating IQA record");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/admin/iqa-records/:id", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const id = parseInt(req.params.id);
    const { actionTaken, signedOffAt } = req.body as { actionTaken?: string; signedOffAt?: string };
    const [record] = await db.update(iqaRecordsTable)
      .set({
        ...(actionTaken !== undefined ? { actionTaken } : {}),
        ...(signedOffAt !== undefined ? { signedOffAt: signedOffAt ? new Date(signedOffAt) : null } : {}),
      })
      .where(eq(iqaRecordsTable.id, id))
      .returning();
    res.json(record);
  } catch (err) {
    logger.error({ err }, "Error updating IQA record");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Reasonable Adjustments ───────────────────────────────────────────────────

router.get("/admin/reasonable-adjustments", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const [adjustments, users] = await Promise.all([
      db.select().from(reasonableAdjustmentsTable).orderBy(desc(reasonableAdjustmentsTable.approvedAt)),
      db.select({ id: usersTable.id, fullName: usersTable.fullName, email: usersTable.email }).from(usersTable),
    ]);
    const userMap = new Map(users.map(u => [u.id, u]));
    res.json(adjustments.map(a => ({
      ...a,
      fullName: userMap.get(a.userId)?.fullName ?? "Unknown",
      email: userMap.get(a.userId)?.email ?? "",
      approvedAt: a.approvedAt.toISOString(),
      expiresAt: a.expiresAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    })));
  } catch (err) {
    logger.error({ err }, "Error fetching reasonable adjustments");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/reasonable-adjustments", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const { userId, adjustmentType, details, evidenceProvided, approvedBy, expiresAt } = req.body as {
      userId: number; adjustmentType: string; details: string;
      evidenceProvided?: string; approvedBy: string; expiresAt?: string;
    };
    if (!userId || !adjustmentType || !details || !approvedBy) {
      res.status(400).json({ error: "userId, adjustmentType, details, and approvedBy are required" });
      return;
    }
    const [record] = await db.insert(reasonableAdjustmentsTable).values({
      userId,
      adjustmentType,
      details,
      evidenceProvided: evidenceProvided ?? null,
      approvedBy,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    }).returning();
    res.json(record);
  } catch (err) {
    logger.error({ err }, "Error creating reasonable adjustment");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Malpractice / Integrity Flags ───────────────────────────────────────────

router.get("/admin/malpractice", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const [users, examAttempts] = await Promise.all([
      db.select().from(usersTable),
      db.select().from(examAttemptsTable).orderBy(asc(examAttemptsTable.attemptedAt)),
    ]);

    const flags: Array<{
      type: string; severity: "high" | "medium" | "low";
      userId?: number; fullName?: string; email?: string;
      detail: string; detectedAt: string;
    }> = [];

    // Device bond resets
    const resetUsers = users.filter(u => u.deviceId.startsWith("RESET_"));
    for (const u of resetUsers) {
      flags.push({ type: "Device Bond Reset", severity: "medium", userId: u.id, fullName: u.fullName, email: u.email, detail: "Device bond was reset by admin — learner re-bonded to a new device.", detectedAt: u.activatedAt.toISOString() });
    }

    // High exam attempt counts (≥3)
    const attemptsByUser = new Map<number, typeof examAttempts>();
    for (const a of examAttempts) {
      const arr = attemptsByUser.get(a.userId) ?? [];
      arr.push(a);
      attemptsByUser.set(a.userId, arr);
    }
    for (const [userId, attempts] of attemptsByUser.entries()) {
      if (attempts.length >= 3) {
        const user = users.find(u => u.id === userId);
        flags.push({
          type: "High Exam Attempt Count", severity: attempts.length >= 5 ? "high" : "medium",
          userId, fullName: user?.fullName ?? "Unknown", email: user?.email ?? "",
          detail: `${attempts.length} exam attempts recorded. Pass: ${attempts.some(a => a.passed) ? "Yes" : "No"}.`,
          detectedAt: attempts[attempts.length - 1].attemptedAt.toISOString(),
        });
      }
    }

    // Deleted accounts
    const deletedUsers = users.filter(u => u.deletedAt !== null);
    for (const u of deletedUsers) {
      flags.push({ type: "Account Deleted", severity: "low", userId: u.id, fullName: u.fullName, email: u.email, detail: `Account deleted at ${u.deletedAt!.toISOString()}.`, detectedAt: u.deletedAt!.toISOString() });
    }

    // Multiple active learners on same non-unlimited code
    const codeMap = new Map<string, typeof users>();
    for (const u of users.filter(u => u.deletedAt === null)) {
      const arr = codeMap.get(u.activationCode) ?? [];
      arr.push(u);
      codeMap.set(u.activationCode, arr);
    }
    for (const [code, codeUsers] of codeMap.entries()) {
      if (codeUsers.length > 1) {
        flags.push({
          type: "Multiple Learners on Code", severity: "high",
          detail: `Code ${code} has ${codeUsers.length} active learner records: ${codeUsers.map(u => u.fullName).join(", ")}.`,
          detectedAt: new Date().toISOString(),
        });
      }
    }

    flags.sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });

    res.json({ flags, total: flags.length, highCount: flags.filter(f => f.severity === "high").length });
  } catch (err) {
    logger.error({ err }, "Error fetching malpractice flags");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
