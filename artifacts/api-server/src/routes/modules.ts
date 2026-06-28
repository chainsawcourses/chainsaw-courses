import { Router } from "express";
import { db } from "@workspace/db";
import { modulesTable, userProgressTable } from "@workspace/db";
import { eq, asc, and } from "drizzle-orm";
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

  const user = await resolveUser(activationCode, deviceId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const modules = await db
      .select()
      .from(modulesTable)
      .where(eq(modulesTable.isActive, true))
      .orderBy(asc(modulesTable.order));

    const progressRecords = await db
      .select()
      .from(userProgressTable)
      .where(eq(userProgressTable.userId, user.id));

    const progressMap = new Map(progressRecords.map((p) => [p.moduleId, p]));

    const result = modules.map((mod, idx) => {
      const progress = progressMap.get(mod.id);
      const prevMod = idx > 0 ? modules[idx - 1] : null;
      const prevProgress = prevMod ? progressMap.get(prevMod.id) : null;

      // Sequential lock: previous module must be fully complete to access a new module.
      // Exception: if the student has already watched this module before, always allow re-access.
      const prevComplete = idx === 0 || !!(prevProgress?.videoCompleted && prevProgress?.quizPassed);
      const alreadyStarted = !!progress?.videoCompleted;
      const isLocked = !prevComplete && !alreadyStarted;

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

  const user = await resolveUser(activationCode, deviceId);
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
      const [prevProgress] = await db
        .select()
        .from(userProgressTable)
        .where(
          and(
            eq(userProgressTable.userId, user.id),
            eq(userProgressTable.moduleId, prevMod.id)
          )
        );
      const prevComplete = !!(prevProgress?.videoCompleted && prevProgress?.quizPassed);
      if (!prevComplete) {
        // Only lock if the student hasn't already watched this module before
        const [ownProgress] = await db
          .select()
          .from(userProgressTable)
          .where(and(eq(userProgressTable.userId, user.id), eq(userProgressTable.moduleId, moduleId)));
        isLocked = !ownProgress?.videoCompleted;
      }
    }

    if (isLocked) {
      res.status(403).json({ error: "Module is locked. Complete the previous module first." });
      return;
    }

    // Auto-complete PDF modules when accessed
    if (mod.contentType === "pdf") {
      const [existing] = await db
        .select()
        .from(userProgressTable)
        .where(and(eq(userProgressTable.userId, user.id), eq(userProgressTable.moduleId, moduleId)));

      if (existing) {
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

    const [myProgress] = await db
      .select()
      .from(userProgressTable)
      .where(
        and(
          eq(userProgressTable.userId, user.id),
          eq(userProgressTable.moduleId, moduleId)
        )
      );

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
