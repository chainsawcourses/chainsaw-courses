import { Router } from "express";
import { db } from "@workspace/db";
import { inspectionRecordsTable, usersTable } from "@workspace/db";
import { SubmitInspectionBody } from "@workspace/api-zod";
import { eq, desc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";

const router = Router();

type InspectionItem = {
  id: string;
  label: string;
  section: string;
  status: "pass" | "fail" | "na";
  note?: string;
};

function serializeRecord(row: {
  id: number;
  sawIdentifier: string | null;
  items: string;
  hasFailures: boolean;
  createdAt: Date;
  studentName?: string | null;
}) {
  return {
    id: row.id,
    sawIdentifier: row.sawIdentifier ?? null,
    items: JSON.parse(row.items) as InspectionItem[],
    hasFailures: row.hasFailures,
    studentName: row.studentName ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

router.post("/inspections", async (req, res) => {
  const parse = SubmitInspectionBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { deviceId, activationCode, sawIdentifier, items } = parse.data;
  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const hasFailures = items.some((item) => item.status === "fail");

  try {
    const [inserted] = await db
      .insert(inspectionRecordsTable)
      .values({
        userId: user.id,
        sawIdentifier: sawIdentifier ?? null,
        items: JSON.stringify(items),
        hasFailures,
      })
      .returning();

    res.json(serializeRecord(inserted));
  } catch (err) {
    logger.error({ err }, "Error saving inspection record");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/inspections", async (req, res) => {
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
    const rows = await db
      .select()
      .from(inspectionRecordsTable)
      .where(eq(inspectionRecordsTable.userId, user.id))
      .orderBy(desc(inspectionRecordsTable.createdAt))
      .limit(20);

    res.json(rows.map((row) => serializeRecord(row)));
  } catch (err) {
    logger.error({ err }, "Error fetching inspection history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/inspections", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const rows = await db
      .select({
        id: inspectionRecordsTable.id,
        sawIdentifier: inspectionRecordsTable.sawIdentifier,
        items: inspectionRecordsTable.items,
        hasFailures: inspectionRecordsTable.hasFailures,
        createdAt: inspectionRecordsTable.createdAt,
        studentName: usersTable.fullName,
      })
      .from(inspectionRecordsTable)
      .leftJoin(usersTable, eq(inspectionRecordsTable.userId, usersTable.id))
      .orderBy(desc(inspectionRecordsTable.createdAt));

    res.json(rows.map((row) => serializeRecord(row)));
  } catch (err) {
    logger.error({ err }, "Error fetching all inspections");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
