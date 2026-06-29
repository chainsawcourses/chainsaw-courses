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

    doc.fontSize(10).fillColor(mid).font("Helvetica-Bold").text("IMPORTANT NOTICE & LIABILITY WAIVER");
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor(dark).font("Helvetica").text(
      "This manual provides technical information on chainsaw maintenance techniques, safety procedures, and general machinery operation.\n\n" +
      "CRITICAL SAFETY MEMENTO: Chainsaw use is inherently dangerous, and improper handling can result in serious injury or death.\n\n" +
      "By purchasing, accessing, or utilizing this manual and its associated resources, the student explicitly acknowledges and agrees to the following conditions:",
      { lineGap: 3 }
    );
    doc.moveDown(1);

    const clauses: [string, string][] = [
      ["1. Educational Intent",
        "This manual is intended as a core theoretical reference and study guide to support accredited professional development (CPD) training programmes. It provides general guidance on chainsaw maintenance and cross-cutting techniques but does not qualify the reader as a trained or certified chainsaw operator."],
      ["2. No Certification Conferred",
        "Completing or reading this manual does not entitle the buyer to any formal industry certification or practical qualification. Safe chainsaw operation strictly requires practical training, physical field supervision, and verified compliance with legal and industry safety standards."],
      ["3. Regulatory Compliance",
        "Operators must maintain complete compliance with local regulations, including: The Health and Safety Law of your country or region (e.g. HSWA); various equipment regulations relating to Chainsaw Use and Operation (e.g. PUWER); and approved Tree Industry Codes of Practice for Chainsaws relevant to your region."],
      ["4. Personal Protection",
        "You are solely responsible for ensuring your own safety by wearing correct, certified Personal Protective Equipment (PPE) and following all relevant laws and workplace regulations. You must read the entire manual in full before operating any chainsaw machinery."],
      ["5. Absolute Sobriety Mandatory",
        "Do not undertake any chainsaw maintenance or operational activities under the influence of any drugs, alcohol, or impairing medications."],
      ["6. Exclusion of Liability",
        "To the fullest extent permitted under law, you agree that Overleaf Publishers Ltd, its owners, authors, affiliates, and distributors are not liable for: injuries, damages, or losses resulting from chainsaw use based on this manual; failure to follow established safety procedures, legal requirements, or regional best practices; or any subjective misinterpretation of the technical information contained in this guide."],
    ];

    for (const [title, body] of clauses) {
      doc.fontSize(9).fillColor(dark).font("Helvetica-Bold").text(title, { lineGap: 2 });
      doc.fontSize(9).fillColor(dark).font("Helvetica").text(body, { lineGap: 3 });
      doc.moveDown(0.7);
    }

    doc.fontSize(9).fillColor(mid).font("Helvetica").text(
      "This manual is provided on an \"as is\" basis, without warranties regarding its accuracy, completeness, or practical effectiveness. " +
      "We do not guarantee that following this manual will prevent field accidents or injuries. " +
      "By proceeding, the student confirms they have read this waiver, assume full responsibility for their own actions, and will not hold Overleaf Publishers Ltd liable for any accidents, injuries, undesired results, or legal consequences.",
      { lineGap: 3 }
    );
    doc.moveDown(1.5);

    doc.fontSize(10).fillColor(mid).font("Helvetica-Bold").text("SIGNATURE");
    doc.moveDown(0.4);

    const sigData = waiver.signatureData;
    const sigBoxY = doc.y;
    doc.rect(60, sigBoxY, 300, 100).strokeColor("#CCCCCC").lineWidth(1).stroke();
    if (sigData && sigData.startsWith("data:image/png;base64,")) {
      const base64 = sigData.replace("data:image/png;base64,", "");
      const imgBuffer = Buffer.from(base64, "base64");
      doc.image(imgBuffer, 65, sigBoxY + 5, { width: 290, height: 90 });
    } else {
      doc.fontSize(9).fillColor(mid).font("Helvetica").text("[Signature on file]", 70, sigBoxY + 40);
    }
    // Advance cursor past the box
    doc.text("", 60, sigBoxY + 110);
    doc.moveDown(0.5);

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
