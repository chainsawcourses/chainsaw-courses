import { Router } from "express";
import { db } from "@workspace/db";
import { modulesTable, userProgressTable, usersTable } from "@workspace/db";
import { SaveHeartbeatBody, CompleteVideoBody } from "@workspace/api-zod";
import { eq, and, asc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";

const router = Router();

router.post("/progress/heartbeat", async (req, res) => {
  const parse = SaveHeartbeatBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { moduleId, timestamp, deviceId, activationCode } = parse.data;
  const user = await resolveUser(activationCode, deviceId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(userProgressTable)
      .where(and(eq(userProgressTable.userId, user.id), eq(userProgressTable.moduleId, moduleId)));

    if (existing.length > 0) {
      await db
        .update(userProgressTable)
        .set({ lastTimestamp: timestamp, updatedAt: new Date() })
        .where(and(eq(userProgressTable.userId, user.id), eq(userProgressTable.moduleId, moduleId)));
    } else {
      await db.insert(userProgressTable).values({
        userId: user.id,
        moduleId,
        lastTimestamp: timestamp,
      });
    }

    await db
      .update(usersTable)
      .set({ lastActivityAt: new Date() })
      .where(eq(usersTable.id, user.id));

    res.json({ success: true, message: "Heartbeat saved" });
  } catch (err) {
    logger.error({ err }, "Error saving heartbeat");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/progress/complete-video", async (req, res) => {
  const parse = CompleteVideoBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { moduleId, deviceId, activationCode } = parse.data;
  const user = await resolveUser(activationCode, deviceId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const existing = await db
      .select()
      .from(userProgressTable)
      .where(and(eq(userProgressTable.userId, user.id), eq(userProgressTable.moduleId, moduleId)));

    if (existing.length > 0) {
      await db
        .update(userProgressTable)
        .set({ videoCompleted: true, updatedAt: new Date() })
        .where(and(eq(userProgressTable.userId, user.id), eq(userProgressTable.moduleId, moduleId)));
    } else {
      await db.insert(userProgressTable).values({
        userId: user.id,
        moduleId,
        videoCompleted: true,
      });
    }

    res.json({ success: true, message: "Video marked complete" });
  } catch (err) {
    logger.error({ err }, "Error completing video" );
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/progress/summary", async (req, res) => {
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
    const totalModules = modules.length;
    let completedModules = 0;
    let quizzesPassed = 0;
    let currentModuleId: number | null = null;

    for (const mod of modules) {
      const p = progressMap.get(mod.id);
      if (p?.videoCompleted && p?.quizPassed) {
        completedModules++;
        quizzesPassed++;
      } else if (!currentModuleId) {
        currentModuleId = mod.id;
      }
    }

    const percentComplete = totalModules > 0 ? Math.round((completedModules / totalModules) * 100) : 0;
    const certificateEarned = completedModules === totalModules && totalModules > 0;

    res.json({
      totalModules,
      completedModules,
      quizzesPassed,
      percentComplete,
      currentModuleId,
      certificateEarned,
    });
  } catch (err) {
    logger.error({ err }, "Error getting progress summary");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
