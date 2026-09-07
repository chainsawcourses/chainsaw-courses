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

// ─── Question CRUD ───────────────────────────────────────────────────────────

router.get("/admin/questions/stats", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const attempts = await db.select({ answers: examAttemptsTable.answers }).from(examAttemptsTable);
    const correct = new Map<number, number>();
    const incorrect = new Map<number, number>();
    for (const { answers } of attempts) {
      let parsed: { questionId: number; correct: boolean }[] = [];
      try { parsed = JSON.parse(answers); } catch { continue; }
      for (const a of parsed) {
        if (typeof a.questionId !== "number") continue;
        if (a.correct) {
          correct.set(a.questionId, (correct.get(a.questionId) ?? 0) + 1);
        } else {
          incorrect.set(a.questionId, (incorrect.get(a.questionId) ?? 0) + 1);
        }
      }
    }
    const allIds = new Set([...correct.keys(), ...incorrect.keys()]);
    res.json([...allIds].map(id => ({
      questionId: id,
      correct: correct.get(id) ?? 0,
      incorrect: incorrect.get(id) ?? 0,
    })));
  } catch (err) {
    logger.error({ err }, "Error fetching question stats");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/questions", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const questions = await db.select().from(examQuestionsTable).orderBy(asc(examQuestionsTable.learningOutcome), asc(examQuestionsTable.order));
    res.json(questions.map(q => ({ ...q, options: JSON.parse(q.options) as string[] })));
  } catch (err) {
    logger.error({ err }, "Error fetching questions");
    res.status(500).json({ error: "Internal server error" });
  }
});

// ─── Module quiz question bank ─────────────────────────────────────────────

function parseQuizQuestion(row: typeof quizQuestionsTable.$inferSelect) {
  return {
    id: row.id,
    moduleId: row.moduleId,
    question: row.question,
    options: JSON.parse(row.options) as string[],
    correctOption: row.correctOption,
    order: row.order,
  };
}

async function validateQuizQuestionBody(body: unknown, existing?: typeof quizQuestionsTable.$inferSelect) {
  const input = (body ?? {}) as {
    moduleId?: unknown;
    question?: unknown;
    options?: unknown;
    correctOption?: unknown;
    order?: unknown;
  };
  const moduleId = input.moduleId == null ? existing?.moduleId : Number(input.moduleId);
  const question = typeof input.question === "string" ? input.question.trim() : "";
  const options = Array.isArray(input.options)
    ? input.options.map((option) => typeof option === "string" ? option.trim() : "")
    : [];
  const correctOption = Number(input.correctOption);
  const order = input.order == null || input.order === "" ? (existing?.order ?? 0) : Number(input.order);

  if (typeof moduleId !== "number" || !Number.isInteger(moduleId) || moduleId <= 0) {
    return { error: "A valid module is required." } as const;
  }
  if (!question || options.length < 2 || options.some((option) => !option)) {
    return { error: "Question text and at least two non-empty options are required." } as const;
  }
  if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption >= options.length) {
    return { error: "The correct answer must match one of the options." } as const;
  }
  if (!Number.isInteger(order) || order < 0) {
    return { error: "Order must be a whole number of 0 or higher." } as const;
  }

  const [module] = await db.select({ id: modulesTable.id })
    .from(modulesTable)
    .where(eq(modulesTable.id, moduleId));
  if (!module) return { error: "Module not found." } as const;

  return { value: { moduleId, question, options, correctOption, order } } as const;
}

router.get("/admin/module-quizzes", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const [modules, questions] = await Promise.all([
      db.select({
        id: modulesTable.id,
        title: modulesTable.title,
        order: modulesTable.order,
        isActive: modulesTable.isActive,
      }).from(modulesTable).orderBy(asc(modulesTable.order)),
      db.select().from(quizQuestionsTable).orderBy(asc(quizQuestionsTable.moduleId), asc(quizQuestionsTable.order), asc(quizQuestionsTable.id)),
    ]);

    const questionsByModule = new Map<number, ReturnType<typeof parseQuizQuestion>[]>();
    for (const question of questions) {
      const moduleQuestions = questionsByModule.get(question.moduleId) ?? [];
      moduleQuestions.push(parseQuizQuestion(question));
      questionsByModule.set(question.moduleId, moduleQuestions);
    }

    res.json({
      modules: modules.map((module) => ({
        ...module,
        questions: questionsByModule.get(module.id) ?? [],
      })),
    });
  } catch (err) {
    logger.error({ err }, "Error fetching module quiz questions");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/module-quizzes", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const parsed = await validateQuizQuestionBody(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const [created] = await db.insert(quizQuestionsTable).values({
      moduleId: parsed.value.moduleId,
      question: parsed.value.question,
      options: JSON.stringify(parsed.value.options),
      correctOption: parsed.value.correctOption,
      order: parsed.value.order,
    }).returning();
    res.json(parseQuizQuestion(created));
  } catch (err) {
    logger.error({ err }, "Error creating module quiz question");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/module-quizzes/:id", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid question ID." });
      return;
    }
    const [existing] = await db.select().from(quizQuestionsTable).where(eq(quizQuestionsTable.id, id));
    if (!existing) {
      res.status(404).json({ error: "Question not found." });
      return;
    }
    const parsed = await validateQuizQuestionBody(req.body, existing);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const [updated] = await db.update(quizQuestionsTable).set({
      moduleId: parsed.value.moduleId,
      question: parsed.value.question,
      options: JSON.stringify(parsed.value.options),
      correctOption: parsed.value.correctOption,
      order: parsed.value.order,
    }).where(eq(quizQuestionsTable.id, id)).returning();
    res.json(parseQuizQuestion(updated));
  } catch (err) {
    logger.error({ err }, "Error updating module quiz question");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/module-quizzes/:id", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: "Invalid question ID." });
      return;
    }
    const deleted = await db.delete(quizQuestionsTable).where(eq(quizQuestionsTable.id, id)).returning({ id: quizQuestionsTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Question not found." });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Error deleting module quiz question");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/admin/questions", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const { question, options, correctOption, learningOutcome, assessmentCriteria, order, isActive } = req.body as {
      question: string; options: string[]; correctOption: number;
      learningOutcome?: string; assessmentCriteria?: string;
      order?: number; isActive?: boolean;
    };
    if (!question || !options || options.length < 2 || correctOption == null) {
      res.status(400).json({ error: "question, options (≥2) and correctOption are required" }); return;
    }
    const [created] = await db.insert(examQuestionsTable).values({
      question,
      options: JSON.stringify(options),
      correctOption,
      learningOutcome: learningOutcome ?? null,
      assessmentCriteria: assessmentCriteria ?? null,
      order: order ?? 0,
      isActive: isActive ?? true,
    }).returning();
    res.json({ ...created, options: JSON.parse(created.options) as string[] });
  } catch (err) {
    logger.error({ err }, "Error creating question");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/admin/questions/:id", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const id = parseInt(req.params.id);
    const { question, options, correctOption, learningOutcome, assessmentCriteria, order, isActive } = req.body as {
      question: string; options: string[]; correctOption: number;
      learningOutcome?: string; assessmentCriteria?: string;
      order?: number; isActive?: boolean;
    };
    const [updated] = await db.update(examQuestionsTable).set({
      question,
      options: JSON.stringify(options),
      correctOption,
      learningOutcome: learningOutcome ?? null,
      assessmentCriteria: assessmentCriteria ?? null,
      order: order ?? 0,
      isActive: isActive ?? true,
    }).where(eq(examQuestionsTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ...updated, options: JSON.parse(updated.options) as string[] });
  } catch (err) {
    logger.error({ err }, "Error updating question");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/admin/questions/:id", async (req, res) => {
  if (!adminGuard(req, res)) return;
  try {
    const id = parseInt(req.params.id);
    await db.delete(examQuestionsTable).where(eq(examQuestionsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Error deleting question");
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
