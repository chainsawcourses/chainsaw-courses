import { createHash, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { CheckDailyBackupTriggerResponse, TriggerDailyBackupResponse } from "@workspace/api-zod";
import { londonBackupDateKey, shouldRunScheduledBackup } from "../lib/backupSchedulePolicy";
import { logger } from "../lib/logger";

interface BackupTriggerDependencies {
  secret: () => string | undefined;
  isProduction: () => boolean;
  now: () => Date;
  run: () => Promise<void>;
  findRun: (dateKey: string) => Promise<{ state: "running" | "succeeded" | "failed" } | null>;
}

/** Separate maintenance credential grants no admin, download or learner-data access. */
export function createBackupAutomationRouter(deps: BackupTriggerDependencies): IRouter {
  const router: IRouter = Router();
  router.use("/automation/backups/daily", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const secret = deps.secret();
    if (!secret || !/^\S{32,256}$/.test(secret)) {
      res.status(503).json({ error: "The backup trigger is not configured." });
      return;
    }
    const token = /^Bearer (\S{32,256})$/.exec(req.get("authorization") ?? "")?.[1];
    const digest = (value: string) => createHash("sha256").update(value).digest();
    if (!token || !timingSafeEqual(digest(token), digest(secret))) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!deps.isProduction()) {
      res.status(503).json({ error: "External backups are enabled only in production." });
      return;
    }
    next();
  });

  router.get("/automation/backups/daily", (_req, res): void => {
    res.json(CheckDailyBackupTriggerResponse.parse({
      state: "ready",
      dateKey: londonBackupDateKey(deps.now()),
    }));
  });

  router.post("/automation/backups/daily", async (_req, res): Promise<void> => {
    const now = deps.now();
    const dateKey = londonBackupDateKey(now);
    if (!shouldRunScheduledBackup(now, null)) {
      res.json(TriggerDailyBackupResponse.parse({ state: "not_due", dateKey }));
      return;
    }
    try {
      // Keep the HTTP request open until completion; never detach a job on Autoscale.
      await deps.run();
      const run = await deps.findRun(dateKey);
      const state = run?.state ?? "busy";
      res.status(state === "running" || state === "busy" ? 202 : 200)
        .json(TriggerDailyBackupResponse.parse({ state, dateKey }));
    } catch {
      // Do not log request headers or return database/Drive details to this caller.
      logger.error("External daily backup trigger could not finish");
      res.status(503).json({ error: "Backup service temporarily unavailable. Check admin status." });
    }
  });
  return router;
}
