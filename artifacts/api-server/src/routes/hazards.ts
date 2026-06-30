import { Router } from "express";
import { db, hazardReferenceTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { resolveUser } from "./auth";

const router = Router();

router.get("/hazards/:category", async (req, res) => {
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
