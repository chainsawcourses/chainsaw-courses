import { Router } from "express";
import { db } from "@workspace/db";
import { riskAssessmentsTable, usersTable } from "@workspace/db";
import { SubmitRiskAssessmentBody } from "@workspace/api-zod";
import { eq, desc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";

const router = Router();

type HazardEntry = {
  id: string;
  label: string;
  likelihood: number;
  severity: number;
  riskRating: number;
  controlMeasures?: string;
  isCustom?: boolean;
};

function serializeRecord(row: {
  id: number;
  siteDescription: string | null;
  taskDescription: string;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  gridReference: string | null;
  hazards: string;
  createdAt: Date;
  studentName?: string | null;
}) {
  return {
    id: row.id,
    siteDescription: row.siteDescription ?? null,
    taskDescription: row.taskDescription,
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    address: row.address ?? null,
    gridReference: row.gridReference ?? null,
    hazards: JSON.parse(row.hazards) as HazardEntry[],
    studentName: row.studentName ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

router.post("/risk-assessments", async (req, res) => {
  const parse = SubmitRiskAssessmentBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { deviceId, activationCode, siteDescription, taskDescription, latitude, longitude, address, gridReference, hazards } = parse.data;
  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [inserted] = await db
      .insert(riskAssessmentsTable)
      .values({
        userId: user.id,
        siteDescription: siteDescription ?? null,
        taskDescription,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        address: address ?? null,
        gridReference: gridReference ?? null,
        hazards: JSON.stringify(hazards),
      })
      .returning();

    res.json(serializeRecord(inserted));
  } catch (err) {
    logger.error({ err }, "Error saving risk assessment");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/risk-assessments", async (req, res) => {
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
      .from(riskAssessmentsTable)
      .where(eq(riskAssessmentsTable.userId, user.id))
      .orderBy(desc(riskAssessmentsTable.createdAt))
      .limit(20);

    res.json(rows.map((row) => serializeRecord(row)));
  } catch (err) {
    logger.error({ err }, "Error fetching risk assessment history");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/admin/risk-assessments", async (req, res) => {
  if (!verifyAdmin(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const rows = await db
      .select({
        id: riskAssessmentsTable.id,
        siteDescription: riskAssessmentsTable.siteDescription,
        taskDescription: riskAssessmentsTable.taskDescription,
        latitude: riskAssessmentsTable.latitude,
        longitude: riskAssessmentsTable.longitude,
        address: riskAssessmentsTable.address,
        gridReference: riskAssessmentsTable.gridReference,
        hazards: riskAssessmentsTable.hazards,
        createdAt: riskAssessmentsTable.createdAt,
        studentName: usersTable.fullName,
      })
      .from(riskAssessmentsTable)
      .leftJoin(usersTable, eq(riskAssessmentsTable.userId, usersTable.id))
      .orderBy(desc(riskAssessmentsTable.createdAt));

    res.json(rows.map((row) => serializeRecord(row)));
  } catch (err) {
    logger.error({ err }, "Error fetching all risk assessments");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
