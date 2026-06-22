import { Router } from "express";
import { db } from "@workspace/db";
import { quizQuestionsTable, quizAttemptsTable, userProgressTable } from "@workspace/db";
import { SubmitQuizBody } from "@workspace/api-zod";
import { eq, and, asc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/quizzes/:moduleId", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;
  const moduleId = parseInt(req.params.moduleId);

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth headers" });
    return;
  }

  const user = await resolveUser(activationCode, deviceId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const questions = await db
      .select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.moduleId, moduleId))
      .orderBy(asc(quizQuestionsTable.order));

    if (questions.length === 0) {
      res.status(404).json({ error: "No quiz found for this module" });
      return;
    }

    const { modulesTable } = await import("@workspace/db");
    const [mod] = await db.select().from(modulesTable).where(eq(modulesTable.id, moduleId));

    res.json({
      moduleId,
      moduleTitle: mod?.title ?? "Module",
      passingScore: 100,
      questions: questions.map((q) => ({
        id: q.id,
        question: q.question,
        options: JSON.parse(q.options) as string[],
      })),
    });
  } catch (err) {
    logger.error({ err }, "Error fetching quiz");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/quizzes/:moduleId/submit", async (req, res) => {
  const moduleId = parseInt(req.params.moduleId);
  const parse = SubmitQuizBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { deviceId, activationCode, answers } = parse.data;
  const user = await resolveUser(activationCode, deviceId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const questions = await db
      .select()
      .from(quizQuestionsTable)
      .where(eq(quizQuestionsTable.moduleId, moduleId));

    if (questions.length === 0) {
      res.status(404).json({ error: "No quiz found for this module" });
      return;
    }

    let correct = 0;
    const feedback = questions.map((q) => {
      const answer = answers.find((a) => a.questionId === q.id);
      const isCorrect = answer?.selectedOption === q.correctOption;
      if (isCorrect) correct++;
      return {
        questionId: q.id,
        correct: isCorrect,
        correctOption: q.correctOption,
      };
    });

    const score = Math.round((correct / questions.length) * 100);
    const passed = score === 100;

    await db.insert(quizAttemptsTable).values({
      userId: user.id,
      moduleId,
      score,
      passed,
    });

    if (passed) {
      const existing = await db
        .select()
        .from(userProgressTable)
        .where(and(eq(userProgressTable.userId, user.id), eq(userProgressTable.moduleId, moduleId)));

      if (existing.length > 0) {
        await db
          .update(userProgressTable)
          .set({ quizPassed: true, quizScore: score, completedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(userProgressTable.userId, user.id), eq(userProgressTable.moduleId, moduleId)));
      } else {
        await db.insert(userProgressTable).values({
          userId: user.id,
          moduleId,
          quizPassed: true,
          quizScore: score,
          completedAt: new Date(),
        });
      }
    }

    res.json({
      passed,
      score,
      passingScore: 100,
      correct,
      total: questions.length,
      feedback,
    });
  } catch (err) {
    logger.error({ err }, "Error submitting quiz");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
