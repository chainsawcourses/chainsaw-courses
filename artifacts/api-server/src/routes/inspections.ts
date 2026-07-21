import { Router } from "express";
import { db } from "@workspace/db";
import { inspectionRecordsTable, usersTable } from "@workspace/db";
import { SubmitInspectionBody } from "@workspace/api-zod";
import { eq, desc, and } from "drizzle-orm";
import { z } from "zod/v4";
import { resolveUser } from "./auth";
import { verifyAdmin } from "./admin";
import { logger } from "../lib/logger";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

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
  amendedAt: Date | null;
  studentName?: string | null;
}) {
  return {
    id: row.id,
    sawIdentifier: row.sawIdentifier ?? null,
    items: JSON.parse(row.items) as InspectionItem[],
    hasFailures: row.hasFailures,
    studentName: row.studentName ?? undefined,
    createdAt: row.createdAt.toISOString(),
    amendedAt: row.amendedAt?.toISOString() ?? null,
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

router.get("/inspections/:id/pdf", async (req, res) => {
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
      .from(inspectionRecordsTable)
      .where(and(eq(inspectionRecordsTable.id, id), eq(inspectionRecordsTable.userId, user.id)))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    const items: InspectionItem[] = JSON.parse(row.items);
    const sections = Array.from(new Set(items.map((i) => i.section)));
    const dateStr = new Date(row.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
    const timeStr = new Date(row.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const safeName = (user.fullName ?? "record").replace(/[^a-z0-9]/gi, "-");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="inspection-${safeName}-${id}.pdf"`);

    const doc = new PDFDocument({ margin: 0, size: "A4" });
    doc.pipe(res);

    const orange = "#D97706";
    const dark = "#1C1C1C";
    const mid = "#555555";
    const green = "#16A34A";
    const red = "#DC2626";
    const L = 50;
    const R = 545;
    const W = R - L;

    // Header
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

    doc.fontSize(14).fillColor(dark).font("Helvetica-Bold").text("PRE-START & PRE-USE INSPECTION CHECKLIST", L, doc.y);
    doc.moveDown(0.6);

    // Student / date bar
    const amendedDateStr = row.amendedAt ? new Date(row.amendedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : null;
    const amendedTimeStr = row.amendedAt ? new Date(row.amendedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) : null;
    const extraLines = (row.sawIdentifier ? 1 : 0) + (row.amendedAt ? 1 : 0);
    const barH = 28 + extraLines * 12;
    const barY = doc.y;
    doc.rect(L, barY, W, barH).fill("#F3F4F6");
    doc.fontSize(9).fillColor(dark).font("Helvetica-Bold").text(user.fullName ?? "—", L + 8, barY + 5, { lineBreak: false });
    doc.fontSize(9).fillColor(mid).font("Helvetica").text(`${dateStr}  ${timeStr}`, L + 8, barY + 16, { lineBreak: false });
    let infoLineY = barY + 28;
    if (row.sawIdentifier) {
      doc.fontSize(9).fillColor(mid).font("Helvetica").text(`Saw / Equipment: ${row.sawIdentifier}`, L + 8, infoLineY, { lineBreak: false });
      infoLineY += 12;
    }
    if (row.amendedAt) {
      doc.fontSize(9).fillColor(orange).font("Helvetica-Bold").text(`Amended: ${amendedDateStr}  ${amendedTimeStr}`, L + 8, infoLineY, { lineBreak: false });
    }
    doc.text("", L, barY + barH + 8);

    // Columns: Item | Status | Notes
    const colW = { item: 230, status: 65, notes: W - 230 - 65 };
    const rowH = 16;

    for (const section of sections) {
      const sectionItems = items.filter((i) => i.section === section);

      // Section header
      doc.moveDown(0.5);
      if (doc.y > 740) { doc.addPage(); doc.y = 50; }
      doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text(section.toUpperCase() + " CHECKS", L, doc.y);
      doc.moveDown(0.3);

      let ty = doc.y;

      // Table header
      doc.rect(L, ty, W, rowH).fill(orange);
      let cx = L;
      doc.fillColor("#FFFFFF").fontSize(7.5).font("Helvetica-Bold");
      doc.text("CHECK ITEM", cx + 4, ty + 4, { width: colW.item - 8, lineBreak: false, align: "center" }); cx += colW.item;
      doc.text("RESULT", cx + 3, ty + 4, { width: colW.status - 6, lineBreak: false, align: "center" }); cx += colW.status;
      doc.text("NOTES", cx + 4, ty + 4, { width: colW.notes - 8, lineBreak: false, align: "center" });
      ty += rowH;

      for (let i = 0; i < sectionItems.length; i++) {
        const item = sectionItems[i];
        const noteText = item.note ?? "";
        doc.fontSize(9).font("Helvetica");
        const labelH = doc.heightOfString(item.label, { width: colW.item - 8 });
        doc.fontSize(8.5).font("Helvetica-Oblique");
        const noteH = noteText ? doc.heightOfString(noteText, { width: colW.notes - 8 }) : 0;
        const dynH = Math.max(rowH, labelH + 12, noteH + 12);

        if (ty + dynH > 780) { doc.addPage(); ty = 50; }

        if (i % 2 === 0) doc.rect(L, ty, W, dynH).fill("#F9FAFB");
        doc.rect(L, ty, W, dynH).strokeColor("#E5E7EB").lineWidth(0.4).stroke();

        cx = L;
        doc.fillColor(dark).fontSize(9).font("Helvetica");
        doc.text(item.label, cx + 4, ty + 4, { width: colW.item - 8 }); cx += colW.item;

        // Status badge
        const isPass = item.status === "pass";
        const isFail = item.status === "fail";
        const badgeColor = isPass ? green : isFail ? red : "#6B7280";
        const badgeLabel = isPass ? "PASS" : isFail ? "FAIL" : "N/A";
        const badgeW = 36;
        const badgeX = cx + (colW.status - badgeW) / 2;
        doc.rect(badgeX, ty + 3, badgeW, 11).fill(badgeColor);
        doc.fillColor("#FFFFFF").fontSize(7).font("Helvetica-Bold")
           .text(badgeLabel, badgeX + 2, ty + 5, { width: badgeW - 4, lineBreak: false, align: "center" });
        cx += colW.status;

        if (noteText) {
          doc.fillColor(isFail ? red : mid).fontSize(8.5).font("Helvetica-Oblique")
             .text(noteText, cx + 4, ty + 4, { width: colW.notes - 8 });
        }

        ty += dynH;
      }

      doc.text("", L, ty);
    }

    // Overall result
    doc.moveDown(1);
    if (doc.y > 720) { doc.addPage(); doc.y = 50; }
    doc.fontSize(9).fillColor(mid).font("Helvetica-Bold").text("OVERALL RESULT", L);
    doc.moveDown(0.3);
    const resultY = doc.y;
    const resultColor = row.hasFailures ? red : green;
    const resultLabel = row.hasFailures ? "FAILURES NOTED — DO NOT USE SAW" : "ALL CHECKS CLEAR";
    doc.rect(L, resultY, W, 26).fill(resultColor);
    doc.fillColor("#FFFFFF").fontSize(11).font("Helvetica-Bold")
       .text(resultLabel, L, resultY + 7, { width: W, align: "center", lineBreak: false });
    doc.text("", L, resultY + 34);

    // Footer
    doc.moveDown(1.5);
    doc.moveTo(L, doc.y).lineTo(R, doc.y).strokeColor("#CCCCCC").lineWidth(0.5).stroke();
    doc.moveDown(0.4);
    doc.fontSize(7).fillColor(mid).font("Helvetica")
       .text("Personal working record only — always follow manufacturer guidance and employer procedures. © Chainsaw Courses.", L, doc.y, { align: "center", width: W });

    doc.end();
  } catch (err) {
    logger.error({ err }, "Error generating inspection PDF");
    if (!res.headersSent) res.status(500).json({ error: "Failed to generate PDF" });
  }
});

router.patch("/inspections/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) {
    res.status(400).json({ error: "Bad request" });
    return;
  }

  const PatchBody = z.object({
    deviceId: z.string(),
    activationCode: z.string(),
    sawIdentifier: z.string().optional(),
    items: z.array(z.object({
      id: z.string(),
      label: z.string(),
      section: z.string(),
      status: z.enum(["pass", "fail", "na"]),
      note: z.string().optional(),
    })),
  });

  const parse = PatchBody.safeParse(req.body);
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
    const [updated] = await db
      .update(inspectionRecordsTable)
      .set({
        sawIdentifier: sawIdentifier ?? null,
        items: JSON.stringify(items),
        hasFailures,
        amendedAt: new Date(),
      })
      .where(and(eq(inspectionRecordsTable.id, id), eq(inspectionRecordsTable.userId, user.id)))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.json(serializeRecord(updated));
  } catch (err) {
    logger.error({ err }, "Error updating inspection record");
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
        amendedAt: inspectionRecordsTable.amendedAt,
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
