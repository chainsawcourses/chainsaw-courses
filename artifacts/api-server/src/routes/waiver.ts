import { Router } from "express";
import { db } from "@workspace/db";
import { waiversTable, usersTable } from "@workspace/db";
import { SignWaiverBody } from "@workspace/api-zod";
import { eq } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

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

    // Header: logo + title side by side
    const logoPath = path.resolve(process.cwd(), "../chainsaw-training/public/logo.png");
    const logoSize = 56;
    const headerY = doc.y;
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 60, headerY, { width: logoSize, height: logoSize });
    }
    const textX = fs.existsSync(logoPath) ? 60 + logoSize + 12 : 60;
    doc.fontSize(22).fillColor(orange).font("Helvetica-Bold").text("Chainsaw Courses", textX, headerY + 6, { lineBreak: false });
    doc.fontSize(10).fillColor(mid).font("Helvetica").text("PROFESSIONAL TRAINING PORTAL", textX, headerY + 34, { lineBreak: false });
    // Advance past the logo block
    doc.text("", 60, headerY + logoSize + 8);
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

    doc.fontSize(10).fillColor(mid).font("Helvetica-Bold").text("IMPORTANT NOTICE & COMPREHENSIVE LIABILITY WAIVER");
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor(dark).font("Helvetica").text(
      "This online course, along with its accompanying physical manual, provides technical information and educational guidance on chainsaw maintenance, cross-cutting techniques, safety protocols, and general machinery operation.\n\n" +
      "CRITICAL SAFETY WARNING: Chainsaw operation and maintenance are inherently hazardous activities. Improper handling, maintenance, or operation can result in severe, life-altering injury or death.\n\n" +
      "By purchasing, accessing, or utilizing this online course, the companion manual, and any associated resources, you explicitly acknowledge, understand, and agree to the following conditions:",
      { lineGap: 3 }
    );
    doc.moveDown(1);

    // Use stored snapshot if available, otherwise fall back to current hardcoded clauses
    type ClauseSnapshot = { number: string; title: string; text: string };
    let clauses: [string, string][];
    if (waiver.clausesSnapshot) {
      try {
        const stored: ClauseSnapshot[] = JSON.parse(waiver.clausesSnapshot);
        clauses = stored.map((c) => [`${c.number}. ${c.title}`, c.text]);
      } catch {
        clauses = [];
      }
    } else {
      clauses = [
        ["1. Educational Intent Only",
          "The materials provided within this course and manual serve strictly as theoretical references and study guides designed to support continuing professional development (CPD). They provide general guidance on best practices but do not, under any circumstances, qualify the user as a trained, competent, or certified chainsaw operator."],
        ["2. No Certification Conferred",
          "Completion of this online course and/or reading the companion manual does not grant any formal industry certification, practical license, or qualification. Safe and lawful chainsaw operation mandates formal practical training, in-person field supervision by qualified instructors, and verified assessment against official industry standards."],
        ["3. Regulatory Compliance",
          "It is the sole responsibility of the operator to maintain full compliance with all relevant local and national regulations. This includes, but is not limited to:\n" +
          "• The Health and Safety at Work etc. Act (HSWA) or your regional equivalent.\n" +
          "• The Provision and Use of Work Equipment Regulations (PUWER) or regional equipment operation laws.\n" +
          "• Approved arboricultural and forestry codes of practice relevant to your specific jurisdiction."],
        ["4. Personal Protection & Absolute Sobriety",
          "You are solely responsible for ensuring your own physical safety. This requires the mandatory use of correct, fully certified Personal Protective Equipment (PPE) at all times. You must review all training materials in full prior to handling any machinery. Furthermore, you must never undertake any chainsaw maintenance, starting, or operational activities while fatigued or under the influence of alcohol, drugs, or impairing medications."],
        ["5. Exclusion of Liability",
          "To the maximum extent permitted by law, you agree that Overleaf Publishers Ltd, its owners, authors, affiliates, and distributors entirely disclaim all liability for:\n" +
          "• Any direct, indirect, or consequential injuries, property damages, or financial losses resulting from the use or application of the techniques demonstrated in this course and manual.\n" +
          "• Any failure on your part to adhere to established safety procedures, manufacturers' guidelines, legal requirements, or regional best practices.\n" +
          "• Any subjective misinterpretation or misapplication of the technical information contained within these training materials."],
        ["6. Disclaimer of Warranties",
          "All educational materials are provided on an \"as is\" basis, without warranties of any kind regarding their absolute accuracy, completeness, or practical effectiveness in the field. We do not guarantee that adherence to this course or manual will prevent workplace accidents or injuries."],
        ["7. Prohibition of Lone Working and Mandatory Emergency Supervision",
          "The Candidate explicitly acknowledges, warrants, and agrees that:\n" +
          "• No Lone Operation: The Candidate shall never, under any circumstances, start, operate, or practice with a chainsaw alone, whether performing commercial operations, private cutting, or basic practical field exercises.\n" +
          "• Mandatory Second Competent Person: Whenever a chainsaw is in use, a second competent person must be physically present on-site within a direct line of sight and clear audible range. This individual must remain un-engaged from distracting tasks to ensure uninterrupted safety monitoring.\n" +
          "• First Aid Competency Requirement: The required on-site second person must possess active competency in emergency first aid, explicitly capable of identifying and managing catastrophic trauma injuries and severe haemorrhages associated with chainsaw lacerations.\n" +
          "• Emergency Resource Provision: The supervising competent person must have immediate, unobstructed access to an appropriate trauma first aid kit containing wound dressings and a tourniquet, alongside an active communication device to contact regional emergency services.\n" +
          "• Assumption of Liability for Breaches: Any operation of a chainsaw by the Candidate while working alone constitutes a direct and hazardous breach of this Agreement. The Candidate assumes total, exclusive legal liability for all accidents, injuries, or fatalities arising from lone working and completely indemnifies the Company against any ensuing claims."],
      ];
    }

    for (const [title, body] of clauses) {
      const clauseY = doc.y;
      const cbSize = 7;
      const cbX = 60;
      const cbY = clauseY + 1;
      // Draw ticked checkbox
      doc.save();
      doc.rect(cbX, cbY, cbSize, cbSize).strokeColor("#16a34a").lineWidth(0.8).stroke();
      doc.moveTo(cbX + 1.2, cbY + cbSize * 0.55)
         .lineTo(cbX + cbSize * 0.4, cbY + cbSize - 1.5)
         .lineTo(cbX + cbSize - 1, cbY + 1.5)
         .strokeColor("#16a34a").lineWidth(0.8).stroke();
      doc.restore();
      // Clause title indented past checkbox
      doc.fontSize(9).fillColor(dark).font("Helvetica-Bold")
         .text(title, 72, clauseY, { width: 463, lineGap: 2 });
      // Body indented to align with title
      doc.fontSize(9).fillColor(dark).font("Helvetica")
         .text(body, { indent: 12, lineGap: 3 });
      doc.moveDown(0.7);
    }

    doc.fontSize(9).fillColor(mid).font("Helvetica").text(
      "By proceeding with this course and its materials, you confirm that you have read this waiver in its entirety, that you assume full and absolute responsibility for your own actions and safety, and that you fully release Overleaf Publishers Ltd from any and all liability, claims, or legal consequences.",
      { lineGap: 3 }
    );
    doc.moveDown(1.5);

    doc.fontSize(10).fillColor(mid).font("Helvetica-Bold").text("SIGNATURE");
    doc.moveDown(0.4);

    const sigData = waiver.signatureData;
    const sigBoxY = doc.y;
    doc.rect(60, sigBoxY, 300, 100).strokeColor("#CCCCCC").lineWidth(1).stroke();
    const sigMatch = sigData?.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,(.+)/s);
    if (sigMatch) {
      const imgBuffer = Buffer.from(sigMatch[2], "base64");
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

  const { signatureData, agreedToTerms, clausesSnapshot } = parse.data;

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
      clausesSnapshot: clausesSnapshot ?? null,
    });

    res.json({ success: true, message: "Waiver signed successfully" });
  } catch (err) {
    logger.error({ err }, "Error signing waiver");
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
