import { Router } from "express";
import { db } from "@workspace/db";
import { examQuestionsTable, examAttemptsTable, modulesTable, userProgressTable, quizQuestionsTable } from "@workspace/db";
import { SubmitExamBody } from "@workspace/api-zod";
import { eq, asc, sql, desc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";
import { sendCertificateEmail } from "../lib/sendCertificateEmail";

const router = Router();

const EXAM_QUESTION_COUNT = 45;
const EXAM_PASS_SCORE = 80;

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function isCourseComplete(userId: number): Promise<boolean> {
  const [modules, progressRecords, quizCounts] = await Promise.all([
    db.select().from(modulesTable).where(eq(modulesTable.isActive, true)),
    db.select().from(userProgressTable).where(eq(userProgressTable.userId, userId)),
    db.select({
      moduleId: quizQuestionsTable.moduleId,
      count: sql<number>`cast(count(*) as int)`,
    }).from(quizQuestionsTable).groupBy(quizQuestionsTable.moduleId),
  ]);

  const progressMap = new Map(progressRecords.map((p) => [p.moduleId, p]));
  const quizCountMap = new Map(quizCounts.map((q) => [q.moduleId, q.count]));

  const videoModules = modules.filter((mod) => mod.contentType === "video");

  return videoModules.every((mod) => {
    const p = progressMap.get(mod.id);
    const hasQuiz = (quizCountMap.get(mod.id) ?? 0) > 0;
    return !!(p?.videoCompleted && (!hasQuiz || p?.quizPassed));
  });
}

async function hasAlreadyPassed(userId: number): Promise<boolean> {
  const passed = await db
    .select()
    .from(examAttemptsTable)
    .where(eq(examAttemptsTable.userId, userId))
    .then((rows) => rows.some((r) => r.passed));
  return passed;
}

router.get("/exam", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth headers" });
    return;
  }

  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // Block access once already passed
    if (await hasAlreadyPassed(user.id)) {
      res.status(403).json({ error: "already_passed", message: "You have already passed the final exam." });
      return;
    }

    const complete = await isCourseComplete(user.id);
    if (!complete) {
      res.status(403).json({ error: "Complete all training modules before taking the final exam." });
      return;
    }

    const bank = await db.select().from(examQuestionsTable).where(eq(examQuestionsTable.isActive, true));
    const selected = shuffle(bank).slice(0, Math.min(EXAM_QUESTION_COUNT, bank.length));

    res.json({
      questions: selected.map((q) => ({
        id: q.id,
        question: q.question,
        options: JSON.parse(q.options) as string[],
        learningOutcome: q.learningOutcome ?? null,
        assessmentCriteria: q.assessmentCriteria ?? null,
      })),
      passingScore: EXAM_PASS_SCORE,
      totalQuestions: selected.length,
    });
  } catch (err) {
    logger.error({ err }, "Error fetching exam");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/exam/submit", async (req, res) => {
  const parse = SubmitExamBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { deviceId, activationCode, answers } = parse.data;
  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    // Block re-submission once already passed
    if (await hasAlreadyPassed(user.id)) {
      res.status(403).json({ error: "already_passed", message: "You have already passed the final exam." });
      return;
    }

    const complete = await isCourseComplete(user.id);
    if (!complete) {
      res.status(403).json({ error: "Complete all training modules before taking the final exam." });
      return;
    }

    const questionIds = answers.map((a) => a.questionId);
    if (questionIds.length === 0) {
      res.status(400).json({ error: "No answers submitted" });
      return;
    }

    const questions = await db.select().from(examQuestionsTable);
    const questionMap = new Map(questions.map((q) => [q.id, q]));

    let correct = 0;
    const feedback = answers.map((a) => {
      const q = questionMap.get(a.questionId);
      const isCorrect = !!q && a.selectedOption === q.correctOption;
      if (isCorrect) correct++;
      return {
        questionId: a.questionId,
        correct: isCorrect,
        correctOption: q?.correctOption ?? -1,
      };
    });

    const total = answers.length;
    const score = Math.round((correct / total) * 100);
    const passed = score >= EXAM_PASS_SCORE;
    const attemptedAt = new Date();

    await db.insert(examAttemptsTable).values({
      userId: user.id,
      score,
      passed,
      totalQuestions: total,
      answers: JSON.stringify(answers),
    });

    logger.info({ userId: user.id, score, passed }, "Summative exam attempt recorded");

    // Fire-and-forget certificate email on first pass
    if (passed) {
      sendCertificateEmail(user, attemptedAt, score).catch((err) => {
        logger.error({ err, userId: user.id }, "Certificate email fire-and-forget failed");
      });
    }

    res.json({ passed, score, passingScore: EXAM_PASS_SCORE, correct, total, feedback });
  } catch (err) {
    logger.error({ err }, "Error submitting exam");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/exam/status", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth headers" });
    return;
  }

  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const unlocked = await isCourseComplete(user.id);
    const attempts = await db
      .select()
      .from(examAttemptsTable)
      .where(eq(examAttemptsTable.userId, user.id))
      .orderBy(desc(examAttemptsTable.attemptedAt));

    const bestScore = attempts.length > 0 ? Math.max(...attempts.map((a) => a.score)) : null;
    const passed = attempts.some((a) => a.passed);

    res.json({
      unlocked,
      attempts: attempts.length,
      bestScore,
      passed,
      passingScore: EXAM_PASS_SCORE,
    });
  } catch (err) {
    logger.error({ err }, "Error fetching exam status");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
