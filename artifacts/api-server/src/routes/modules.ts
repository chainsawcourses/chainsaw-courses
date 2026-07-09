import { Router } from "express";
import { db } from "@workspace/db";
import { modulesTable, userProgressTable, quizQuestionsTable } from "@workspace/db";
import { eq, asc, and, sql } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

router.get("/modules", async (req, res) => {
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
    const [modules, progressRecords, quizCounts] = await Promise.all([
      db.select().from(modulesTable).where(eq(modulesTable.isActive, true)).orderBy(asc(modulesTable.order)),
      db.select().from(userProgressTable).where(eq(userProgressTable.userId, user.id)),
      db.select({
        moduleId: quizQuestionsTable.moduleId,
        count: sql<number>`cast(count(*) as int)`,
      }).from(quizQuestionsTable).groupBy(quizQuestionsTable.moduleId),
    ]);

    // Deduplicate progress records — if there are duplicate rows for the same
    // module, keep the one with the most recent update (highest id as a tie-breaker).
    const progressMap = new Map<number, (typeof progressRecords)[number]>();
    for (const p of progressRecords) {
      const existing = progressMap.get(p.moduleId);
      if (!existing || (p.updatedAt ?? p.id) > (existing.updatedAt ?? existing.id)) {
        progressMap.set(p.moduleId, p);
      }
    }
    const quizCountMap = new Map(quizCounts.map((q) => [q.moduleId, q.count]));

    const result = modules.map((mod, idx) => {
      const progress = progressMap.get(mod.id);
      const prevMod = idx > 0 ? modules[idx - 1] : null;
      const prevProgress = prevMod ? progressMap.get(prevMod.id) : null;

      // Sequential lock: previous module must be fully complete to access a new module.
      // "Complete" means: video watched, AND quiz passed if the module has quiz questions.
      // Exception: if the student has already watched this module before, always allow re-access.
      const prevHasQuiz = prevMod ? (quizCountMap.get(prevMod.id) ?? 0) > 0 : false;
      const prevComplete =
        idx === 0 ||
        !!(prevProgress?.videoCompleted && (!prevHasQuiz || prevProgress?.quizPassed));
      const alreadyStarted = !!progress?.videoCompleted;
      // COURSE REQUIREMENTS modules are always accessible — they are prerequisites,
      // not gated behind each other.
      const isLocked = mod.category !== "COURSE REQUIREMENTS" && !prevComplete && !alreadyStarted;

      return {
        id: mod.id,
        title: mod.title,
        description: mod.description,
        order: mod.order,
        category: mod.category,
        subCategory: mod.subCategory ?? null,
        contentType: mod.contentType,
        isLocked,
        isCompleted: !!progress?.videoCompleted,
        quizPassed: !!progress?.quizPassed,
        duration: mod.duration,
        thumbnailUrl: mod.thumbnailUrl ?? null,
        isHighRisk: mod.isHighRisk,
      };
    });

    res.json(result);
  } catch (err) {
    logger.error({ err }, "Error fetching modules");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/modules/:moduleId", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;
  const moduleId = parseInt(req.params.moduleId);

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
    const [mod] = await db
      .select()
      .from(modulesTable)
      .where(eq(modulesTable.id, moduleId));

    if (!mod) {
      res.status(404).json({ error: "Module not found" });
      return;
    }

    const allModules = await db
      .select()
      .from(modulesTable)
      .where(eq(modulesTable.isActive, true))
      .orderBy(asc(modulesTable.order));

    const modIndex = allModules.findIndex((m) => m.id === moduleId);
    const prevMod = modIndex > 0 ? allModules[modIndex - 1] : null;

    let isLocked = false;
    if (prevMod) {
      const [prevProgressAll, prevQuizCounts] = await Promise.all([
        db.select().from(userProgressTable).where(
          and(eq(userProgressTable.userId, user.id), eq(userProgressTable.moduleId, prevMod.id))
        ).orderBy(asc(userProgressTable.id)),
        db.select({ count: sql<number>`cast(count(*) as int)` })
          .from(quizQuestionsTable)
          .where(eq(quizQuestionsTable.moduleId, prevMod.id)),
      ]);
      const prevHasQuiz = (prevQuizCounts[0]?.count ?? 0) > 0;
      // Pick the most recent progress row for the previous module
      const prevLatest = prevProgressAll.length > 0
        ? prevProgressAll.reduce((a, b) => (a.updatedAt ?? a.id) > (b.updatedAt ?? b.id) ? a : b)
        : null;
      const prevComplete = !!(prevLatest?.videoCompleted && (!prevHasQuiz || prevLatest?.quizPassed));
      // COURSE REQUIREMENTS modules are always accessible
      if (mod.category !== "COURSE REQUIREMENTS" && !prevComplete) {
        // Only lock if the student hasn't already watched this module before
        const ownProgressAll = await db
          .select()
          .from(userProgressTable)
          .where(and(eq(userProgressTable.userId, user.id), eq(userProgressTable.moduleId, moduleId)));
        const ownLatest = ownProgressAll.length > 0
          ? ownProgressAll.reduce((a, b) => (a.updatedAt ?? a.id) > (b.updatedAt ?? b.id) ? a : b)
          : null;
        isLocked = !ownLatest?.videoCompleted;
      }
    }

    if (isLocked) {
      res.status(403).json({ error: "Module is locked. Complete the previous module first." });
      return;
    }

    // Auto-complete PDF modules when accessed
    if (mod.contentType === "pdf") {
      const pdfProgressAll = await db
        .select()
        .from(userProgressTable)
        .where(and(eq(userProgressTable.userId, user.id), eq(userProgressTable.moduleId, moduleId)));
      const pdfLatest = pdfProgressAll.length > 0
        ? pdfProgressAll.reduce((a, b) => (a.updatedAt ?? a.id) > (b.updatedAt ?? b.id) ? a : b)
        : null;

      if (pdfLatest) {
        await db
          .update(userProgressTable)
          .set({ videoCompleted: true, quizPassed: true, completedAt: new Date(), updatedAt: new Date() })
          .where(and(eq(userProgressTable.userId, user.id), eq(userProgressTable.moduleId, moduleId)));
      } else {
        await db.insert(userProgressTable).values({
          userId: user.id,
          moduleId,
          videoCompleted: true,
          quizPassed: true,
          lastTimestamp: 0,
          completedAt: new Date(),
        });
      }
    }

    const myProgressAll = await db
      .select()
      .from(userProgressTable)
      .where(
        and(
          eq(userProgressTable.userId, user.id),
          eq(userProgressTable.moduleId, moduleId)
        )
      );
    const myProgress = myProgressAll.length > 0
      ? myProgressAll.reduce((a, b) => (a.updatedAt ?? a.id) > (b.updatedAt ?? b.id) ? a : b)
      : null;

    res.json({
      id: mod.id,
      title: mod.title,
      description: mod.description,
      order: mod.order,
      category: mod.category,
      subCategory: mod.subCategory ?? null,
      contentType: mod.contentType,
      isLocked: false,
      isCompleted: !!myProgress?.videoCompleted,
      quizPassed: !!myProgress?.quizPassed,
      duration: mod.duration,
      vimeoId: mod.vimeoId,
      pdfUrl: mod.pdfUrl ?? null,
      thumbnailUrl: mod.thumbnailUrl ?? null,
      isHighRisk: mod.isHighRisk,
      lastTimestamp: myProgress?.lastTimestamp ?? null,
      safetyText: mod.safetyText ?? null,
    });
  } catch (err) {
    logger.error({ err }, "Error fetching module");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
