import { Router } from "express";
import { db, hazardReferenceTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { requireActiveCourseAccess } from "./auth";

const router = Router();

router.get("/hazards/:category", async (req, res) => {
  if (!await requireActiveCourseAccess(req, res)) return;

  const { category } = req.params;
  if (!["site", "chainsaw", "job"].includes(category)) {
    res.status(400).json({ error: "Invalid category. Must be 'site', 'chainsaw', or 'job'." });
    return;
  }

  const hazards = await db
    .select()
    .from(hazardReferenceTable)
    .where(eq(hazardReferenceTable.category, category))
    .orderBy(asc(hazardReferenceTable.orderIdx));

  res.json(hazards);
});

export default router;
