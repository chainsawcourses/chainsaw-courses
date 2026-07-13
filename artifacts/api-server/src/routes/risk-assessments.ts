import { Router } from "express";
import { db } from "@workspace/db";
import { riskAssessmentsTable, usersTable } from "@workspace/db";
import { SubmitRiskAssessmentBody } from "@workspace/api-zod";
import { eq, desc, and } from "drizzle-orm";
import { resolveUser } from "./auth";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

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
  what3Words: string | null;
  nearestHospital: string | null;
  hospitalPhone: string | null;
  siteAccess: string | null;
  meetingPoint: string | null;
  firstAidKit: string | null;
  nearestAed: string | null;
  nearestSignal: string | null;
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
    what3Words: row.what3Words ?? null,
    nearestHospital: row.nearestHospital ?? null,
    hospitalPhone: row.hospitalPhone ?? null,
    siteAccess: row.siteAccess ?? null,
    meetingPoint: row.meetingPoint ?? null,
    firstAidKit: row.firstAidKit ?? null,
    nearestAed: row.nearestAed ?? null,
    nearestSignal: row.nearestSignal ?? null,
    hazards: JSON.parse(row.hazards) as HazardEntry[],
    studentName: row.studentName ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function riskBand(rating: number): { label: string; r: number; g: number; b: number } {
  if (rating >= 15) return { label: "HIGH", r: 220, g: 38, b: 38 };
  if (rating >= 8)  return { label: "MED",  r: 217, g: 119, b: 6 };
  return               { label: "LOW",  r: 22,  g: 163, b: 74 };
}

router.post("/risk-assessments", async (req, res) => {
  const parse = SubmitRiskAssessmentBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { deviceId, activationCode, siteDescription, taskDescription, latitude, longitude, address, gridReference, what3Words, nearestHospital, hospitalPhone, siteAccess, meetingPoint, firstAidKit, nearestAed, nearestSignal, hazards } = parse.data;
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
        what3Words: what3Words ?? null,
        nearestHospital: nearestHospital ?? null,
        hospitalPhone: hospitalPhone ?? null,
        siteAccess: siteAccess ?? null,
        meetingPoint: meetingPoint ?? null,
        firstAidKit: firstAidKit ?? null,
        nearestAed: nearestAed ?? null,
        nearestSignal: nearestSignal ?? null,
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

router.get("/risk-assessments/:id/pdf", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;
  const id = Number(req.params.id);

  if (!deviceId || !activationCode || isNaN(id)) {
    res.status(400).json({ error: "Missing auth headers or invalid id" });
    return;
  }

  const user = await resolveUser(activationCode, deviceId, req.headers["userid"] ? Number(req.headers["userid"]) : undefined);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [row] = await db
      .select()
      .from(riskAssessmentsTable)
      .where(and(eq(riskAssessmentsTable.id, id), eq(riskAssessmentsTable.userId, user.id)))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const hazards = JSON.parse(row.hazards) as HazardEntry[];
    const dateStr = new Date(row.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const timeStr = new Date(row.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const safeName = (user.fullName ?? "record").replace(/[^a-z0-9]/gi, "-");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="risk-assessment-${safeName}-${id}.pdf"`);

    const doc = new PDFDocument({ margin: 0, size: "A4" });
    doc.pipe(res);

    const orange = "#D97706";
    const dark = "#1C1C1C";
    const mid = "#555555";
    const L = 50;
    const R = 545;
    const W = R - L;

    const logoPath = path.resolve(process.cwd(), "../chainsaw-training/public/logo.png");
    const logoSize = 52;
    const headerY = 40;
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, L, headerY, { width: logoSize, height: logoSize });
    }
    const textX = fs.existsSync(logoPath) ? L + logoSize + 12 : L;
    doc.fontSize(20).fillColor(orange).font("Helvetica-Bold").text("Chainsaw Courses", textX, headerY + 4, { lineBreak: false });
    doc.fontSize(9).fillColor(mid).font("Helvetica").text("CHAINSAW MAINTENANCE & CROSS CUTTING", textX, headerY + 30, { lineBreak: false });
    doc.text("", L, headerY + logoSize + 10);
    doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor(orange).lineWidth(1.5).stroke();
    doc.moveDown(0.8);

    doc.fontSize(14).fillColor(dark).font("Helvetica-Bold").text("DYNAMIC SITE RISK ASSESSMENT", L, doc.y, { align: "left" });
    doc.moveDown(0.6);

    // Student / date bar
    const barY = doc.y;
    doc.rect(L, barY, W, 28).fill("#F3F4F6");
    doc.fontSize(9).fillColor(dark).font("Helvetica-Bold").text(user.fullName ?? "—", L + 8, barY + 5, { lineBreak: false });
    doc.fontSize(9).fillColor(mid).font("Helvetica").text(`${dateStr}  ${timeStr}`, L + 8, barY + 16, { lineBreak: false });
    doc.text("", L, barY + 35);

    // Task & site section
    doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text("TASK DESCRIPTION", L);
    doc.moveDown(0.2);
    doc.fontSize(10).fillColor(dark).font("Helvetica").text(row.taskDescription, L, doc.y, { width: W });
    doc.moveDown(0.6);

    if (row.siteDescription) {
      doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text("SITE DESCRIPTION");
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor(dark).font("Helvetica").text(row.siteDescription, L, doc.y, { width: W });
      doc.moveDown(0.6);
    }

    if (row.address || row.gridReference || row.latitude) {
      doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text("SITE LOCATION");
      doc.moveDown(0.2);
      if (row.address) {
        doc.fontSize(10).fillColor(dark).font("Helvetica").text(row.address, L, doc.y, { width: W });
      }
      if (row.gridReference) {
        doc.fontSize(9).fillColor(mid).font("Helvetica").text(`OS National Grid Reference: ${row.gridReference}`);
      }
      if (row.latitude && row.longitude) {
        doc.fontSize(9).fillColor(mid).font("Helvetica").text(`Coordinates: ${row.latitude}, ${row.longitude}`);
      }
      doc.moveDown(0.6);
    }

    // Hazards table
    doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text("HAZARD ASSESSMENT");
    doc.moveDown(0.3);

    const colW = { hazard: 140, like: 38, sev: 38, risk: 58, controls: W - 140 - 38 - 38 - 58 };
    const rowH = 16;
    const tableX = L;
    let ty = doc.y;

    // Table header
    doc.rect(tableX, ty, W, rowH).fill(dark);
    let cx = tableX;
    doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold");
    doc.text("HAZARD", cx + 4, ty + 4, { width: colW.hazard - 8, lineBreak: false }); cx += colW.hazard;
    doc.text("LIKE.", cx + 3, ty + 4, { width: colW.like - 6, lineBreak: false, align: "center" }); cx += colW.like;
    doc.text("SEV.", cx + 3, ty + 4, { width: colW.sev - 6, lineBreak: false, align: "center" }); cx += colW.sev;
    doc.text("RISK", cx + 3, ty + 4, { width: colW.risk - 6, lineBreak: false, align: "center" }); cx += colW.risk;
    doc.text("CONTROL MEASURES", cx + 4, ty + 4, { width: colW.controls - 8, lineBreak: false });
    ty += rowH;

    for (let i = 0; i < hazards.length; i++) {
      const h = hazards[i];
      const band = riskBand(h.riskRating);
      const isEven = i % 2 === 0;

      // Measure how tall this row needs to be
      const ctrlText = h.controlMeasures || "None recorded";
      const ctrlLines = Math.ceil(doc.heightOfString(ctrlText, { width: colW.controls - 8 }) / doc.currentLineHeight());
      const hazLines = Math.ceil(doc.heightOfString(h.label, { width: colW.hazard - 8 }) / doc.currentLineHeight());
      const dynH = Math.max(rowH, (Math.max(ctrlLines, hazLines)) * doc.currentLineHeight() + 6);

      // Page break if needed
      if (ty + dynH > 780) {
        doc.addPage();
        ty = 50;
      }

      if (isEven) doc.rect(tableX, ty, W, dynH).fill("#F9FAFB");
      doc.rect(tableX, ty, W, dynH).strokeColor("#E5E7EB").lineWidth(0.4).stroke();

      cx = tableX;
      doc.fillColor(dark).fontSize(9).font("Helvetica");
      doc.text(h.label, cx + 4, ty + 4, { width: colW.hazard - 8, lineBreak: false }); cx += colW.hazard;
      doc.text(String(h.likelihood), cx + 3, ty + 4, { width: colW.like - 6, lineBreak: false, align: "center" }); cx += colW.like;
      doc.text(String(h.severity), cx + 3, ty + 4, { width: colW.sev - 6, lineBreak: false, align: "center" }); cx += colW.sev;

      // Risk badge
      const badgeW = colW.risk - 10;
      const badgeX = cx + 5;
      doc.rect(badgeX, ty + 3, badgeW, 11).fill(`rgb(${band.r},${band.g},${band.b})`);
      doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold")
         .text(`${band.label} (${h.riskRating})`, badgeX + 2, ty + 5, { width: badgeW - 4, lineBreak: false, align: "center" });
      cx += colW.risk;

      doc.fillColor(dark).fontSize(9).font("Helvetica");
      doc.text(ctrlText, cx + 4, ty + 4, { width: colW.controls - 8 });

      ty += dynH;
    }

    doc.text("", L, ty + 8);
    doc.moveDown(1.5);

    // Footer
    doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor("#CCCCCC").lineWidth(0.5).stroke();
    doc.moveDown(0.4);
    doc.fontSize(7).fillColor(mid).font("Helvetica")
       .text("Personal working record only — does not replace a formal risk assessment, method statement, or employer RAMS process.", L, doc.y, { align: "center", width: W });
    doc.fontSize(7).fillColor(mid).text("Always follow current HSE guidance and your employer's procedures. © Chainsaw Courses.", { align: "center", width: W });

    doc.end();
  } catch (err) {
    logger.error({ err }, "Error generating risk assessment PDF");
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
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
        what3Words: riskAssessmentsTable.what3Words,
        nearestHospital: riskAssessmentsTable.nearestHospital,
        hospitalPhone: riskAssessmentsTable.hospitalPhone,
        siteAccess: riskAssessmentsTable.siteAccess,
        meetingPoint: riskAssessmentsTable.meetingPoint,
        firstAidKit: riskAssessmentsTable.firstAidKit,
        nearestAed: riskAssessmentsTable.nearestAed,
        nearestSignal: riskAssessmentsTable.nearestSignal,
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
