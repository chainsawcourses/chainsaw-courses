import { Router } from "express";
import { db } from "@workspace/db";
import { waiversTable, usersTable } from "@workspace/db";
import { SignWaiverBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";
import PDFDocument from "pdfkit";

const router = Router();

router.get("/waiver", async (req, res) => {
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
    const [waiver] = await db
      .select()
      .from(waiversTable)
      .where(eq(waiversTable.userId, user.id));

    if (!waiver) {
      res.json({ signed: false, signedAt: null, pdfUrl: null });
      return;
    }

    res.json({
      signed: true,
      signedAt: waiver.signedAt.toISOString(),
      pdfUrl: `/api/waiver/pdf?code=${encodeURIComponent(activationCode)}&device=${encodeURIComponent(deviceId)}`,
    });
  } catch (err) {
    logger.error({ err }, "Error getting waiver status");
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/waiver/pdf", async (req, res) => {
  const deviceId = (req.headers["deviceid"] as string) || (req.query["device"] as string);
  const activationCode = (req.headers["activationcode"] as string) || (req.query["code"] as string);

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth" });
    return;
  }

  const user = await resolveUser(activationCode, deviceId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [waiver] = await db
      .select()
      .from(waiversTable)
      .where(eq(waiversTable.userId, user.id));

    if (!waiver) {
      res.status(404).json({ error: "No waiver found" });
      return;
    }

    const [userRecord] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id));

    const doc = new PDFDocument({ margin: 60, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename="chainsaw-courses-waiver-${userRecord?.fullName?.replace(/\s+/g, "-") ?? "signed"}.pdf"`
    );
    doc.pipe(res);

    const orange = "#D97706";
    const dark = "#1C1C1C";
    const mid = "#555555";

    doc.fontSize(20).fillColor(orange).font("Helvetica-Bold").text("CHAINSAW COURSES", { align: "center" });
    doc.fontSize(10).fillColor(mid).font("Helvetica").text("PROFESSIONAL TRAINING PORTAL", { align: "center" });
    doc.moveDown(0.5);
    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor(orange).lineWidth(1.5).stroke();
    doc.moveDown(1);

    doc.fontSize(16).fillColor(dark).font("Helvetica-Bold").text("SIGNED LIABILITY WAIVER & AGREEMENT", { align: "center" });
    doc.moveDown(1.5);

    doc.fontSize(10).fillColor(mid).font("Helvetica-Bold").text("STUDENT DETAILS");
    doc.moveDown(0.3);
    doc.fontSize(10).fillColor(dark).font("Helvetica").text(`Full Name:   ${userRecord?.fullName ?? "—"}`);
    doc.text(`Email:         ${userRecord?.email ?? "—"}`);
    doc.text(`Date Signed: ${new Date(waiver.signedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" })}`);
    doc.moveDown(1.5);

    doc.fontSize(10).fillColor(mid).font("Helvetica-Bold").text("AGREEMENT");
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor(dark).font("Helvetica").text(
      "By signing this waiver, the student acknowledges that chainsaw operation is a high-risk activity and agrees to:\n\n" +
      "1. Follow all safety instructions provided throughout the training course.\n" +
      "2. Wear appropriate Personal Protective Equipment (PPE) at all times when operating a chainsaw.\n" +
      "3. Not operate a chainsaw under the influence of alcohol, drugs, or medication that may impair judgement.\n" +
      "4. Accept full personal responsibility for their actions during and after completion of this course.\n" +
      "5. Acknowledge that this course is educational in nature and does not substitute for formal in-person assessment.\n\n" +
      "The student confirms they have read, understood, and agreed to all terms and conditions of the Chainsaw Courses training programme.",
      { lineGap: 3 }
    );
    doc.moveDown(1.5);

    doc.fontSize(10).fillColor(mid).font("Helvetica-Bold").text("SIGNATURE");
    doc.moveDown(0.4);

    const sigData = waiver.signatureData;
    if (sigData && sigData.startsWith("data:image/png;base64,")) {
      const base64 = sigData.replace("data:image/png;base64,", "");
      const imgBuffer = Buffer.from(base64, "base64");
      doc.rect(60, doc.y, 300, 100).strokeColor("#CCCCCC").lineWidth(1).stroke();
      doc.image(imgBuffer, 65, doc.y - 96, { width: 290, height: 90 });
      doc.moveDown(5.5);
    } else {
      doc.rect(60, doc.y, 300, 80).strokeColor("#CCCCCC").lineWidth(1).stroke();
      doc.fontSize(9).fillColor(mid).text("[Signature on file]", 70, doc.y - 70);
      doc.moveDown(4);
    }

    doc.fontSize(9).fillColor(mid).font("Helvetica").text(
      `Signed electronically on ${new Date(waiver.signedAt).toUTCString()}`,
    );
    doc.moveDown(2);

    doc.moveTo(60, doc.y).lineTo(535, doc.y).strokeColor("#CCCCCC").lineWidth(0.5).stroke();
    doc.moveDown(0.5);
    doc.fontSize(7).fillColor(mid).text(
      "This document was generated automatically by Chainsaw Courses. © Chainsaw Courses. All rights reserved.",
      { align: "center" }
    );

    doc.end();
  } catch (err) {
    logger.error({ err }, "Error generating waiver PDF");
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to generate PDF" });
    }
  }
});

router.post("/waiver", async (req, res) => {
  const parse = SignWaiverBody.safeParse(req.body);
  if (!parse.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { signatureData, agreedToTerms } = parse.data;

  if (!agreedToTerms) {
    res.status(400).json({ error: "Must agree to terms" });
    return;
  }

  const deviceId = (req.headers["deviceid"] as string) || parse.data.deviceId;
  const activationCode = (req.headers["activationcode"] as string) || parse.data.activationCode;

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing auth" });
    return;
  }

  const user = await resolveUser(activationCode, deviceId);
  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const [existing] = await db
      .select()
      .from(waiversTable)
      .where(eq(waiversTable.userId, user.id));

    if (existing) {
      res.json({ success: true, message: "Waiver already signed" });
      return;
    }

    await db.insert(waiversTable).values({
      userId: user.id,
      signatureData,
      agreedToTerms: true,
    });

    res.json({ success: true, message: "Waiver signed successfully" });
  } catch (err) {
    logger.error({ err }, "Error signing waiver");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
