import { Router } from "express";
import { db } from "@workspace/db";
import { moduleFeedbackTable, modulesTable, usersTable } from "@workspace/db";
import { SubmitModuleFeedbackBody } from "@workspace/api-zod";
import { eq, desc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";

const router = Router();

router.post("/feedback/:moduleId", async (req, res) => {
  const moduleId = parseInt(req.params.moduleId);
  const parse = SubmitModuleFeedbackBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { deviceId, activationCode, rating, comment } = parse.data;
  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    await db.insert(moduleFeedbackTable).values({
      userId: user.id,
      moduleId,
      rating,
      comment: comment ?? null,
    });

    res.json({ success: true, message: "Feedback recorded" });
  } catch (err) {
    logger.error({ err }, "Error saving module feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/feedback", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const rows = await db
      .select({
        id: moduleFeedbackTable.id,
        moduleId: moduleFeedbackTable.moduleId,
        rating: moduleFeedbackTable.rating,
        comment: moduleFeedbackTable.comment,
        createdAt: moduleFeedbackTable.createdAt,
        moduleTitle: modulesTable.title,
        studentName: usersTable.fullName,
      })
      .from(moduleFeedbackTable)
      .leftJoin(modulesTable, eq(moduleFeedbackTable.moduleId, modulesTable.id))
      .leftJoin(usersTable, eq(moduleFeedbackTable.userId, usersTable.id))
      .orderBy(desc(moduleFeedbackTable.createdAt));

    res.json(
      rows.map((r) => ({
        id: r.id,
        moduleId: r.moduleId,
        moduleTitle: r.moduleTitle ?? "Unknown module",
        rating: r.rating,
        comment: r.comment ?? null,
        studentName: r.studentName ?? "Unknown",
        createdAt: r.createdAt?.toISOString?.() ?? String(r.createdAt),
      }))
    );
  } catch (err) {
    logger.error({ err }, "Error fetching feedback");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
