import { Router } from "express";
import { db } from "@workspace/db";
import { examAttemptsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const router = Router();

const LOGO_PATH      = path.resolve("artifacts/chainsaw-training/public/logo.png");
const IIRSM_LOGO_PATH = path.resolve("artifacts/chainsaw-training/public/iirsm-logo.png");

function cx(text: string, size: number, font: { widthOfTextAtSize(t: string, s: number): number }, pageWidth: number) {
  return (pageWidth - font.widthOfTextAtSize(text, size)) / 2;
}

function certRef(userId: number, date: Date): string {
  const hash = crypto.createHash("md5")
    .update(`${userId}-${date.getFullYear()}`)
    .digest("hex")
    .toUpperCase()
    .slice(0, 6);
  return `CC/${date.getFullYear()}/${String(userId).padStart(4, "0")}/${hash}`;
}

router.get("/certificate", async (req, res) => {
  const deviceId      = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;

  if (!deviceId || !activationCode) { res.status(401).json({ error: "Missing credentials" }); return; }

  try {
    const user = await resolveUser(activationCode, deviceId);
    if (!user) { res.status(401).json({ error: "Unauthorised" }); return; }

    const passedAttempts = await db
      .select()
      .from(examAttemptsTable)
      .where(and(eq(examAttemptsTable.userId, user.id), eq(examAttemptsTable.passed, true)))
      .orderBy(desc(examAttemptsTable.attemptedAt))
      .limit(1);

    const passedAt   = passedAttempts.length > 0 ? passedAttempts[0].attemptedAt : new Date();
    const passedScore = passedAttempts.length > 0 ? passedAttempts[0].score : null;

    // ── Page ──────────────────────────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create();
    const page   = pdfDoc.addPage([842, 595]); // A4 landscape
    const { width, height } = page.getSize();

    const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontItalic  = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const orange = rgb(0.82, 0.38, 0.05);
    const dark   = rgb(0.08, 0.08, 0.08);
    const mid    = rgb(0.38, 0.38, 0.38);
    const light  = rgb(0.60, 0.60, 0.60);
    const white  = rgb(1,    1,    1);
    const iirBlue = rgb(0.09, 0.22, 0.50);  // IIRSM brand navy

    // ── Border ────────────────────────────────────────────────────────────────
    page.drawRectangle({ x: 22, y: 22, width: width - 44, height: height - 44,
      borderColor: orange, borderWidth: 1.5, color: white });
    page.drawRectangle({ x: 30, y: 30, width: width - 60, height: height - 60,
      borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5, color: white });

    // ── Logos side by side ────────────────────────────────────────────────────
    const logoSize   = 80;
    const logoY      = height - 48 - logoSize;
    const logoPadX   = 80;
    const logoGap    = width - 2 * logoPadX - 2 * logoSize;   // space between them

    // Chainsaw Courses logo (left)
    try {
      const bytes = fs.readFileSync(LOGO_PATH);
      const img   = await pdfDoc.embedPng(bytes);
      const dim   = img.scaleToFit(logoSize, logoSize);
      page.drawImage(img, { x: logoPadX, y: logoY + (logoSize - dim.height) / 2,
        width: dim.width, height: dim.height });
    } catch { /* skip */ }

    // IIRSM logo (right)
    try {
      const bytes = fs.readFileSync(IIRSM_LOGO_PATH);
      const img   = await pdfDoc.embedPng(bytes);
      const dim   = img.scaleToFit(logoSize, logoSize);
      const iirX  = width - logoPadX - dim.width;
      page.drawImage(img, { x: iirX, y: logoY + (logoSize - dim.height) / 2,
        width: dim.width, height: dim.height });
    } catch { /* skip */ }

    // Thin divider under logos
    const divY = logoY - 14;
    page.drawRectangle({ x: 50, y: divY, width: width - 100, height: 0.75, color: orange });

    let y = divY - 24;

    // ── "Chainsaw Courses" brand ───────────────────────────────────────────────
    const brand = "Chainsaw Courses";
    page.drawText(brand, {
      x: cx(brand, 12, fontBold, width), y,
      size: 12, font: fontBold, color: orange,
    });
    y -= 28;

    // ── "This is to certify that" ─────────────────────────────────────────────
    const certifyLine = "This is to certify that";
    page.drawText(certifyLine, {
      x: cx(certifyLine, 10, fontItalic, width), y,
      size: 10, font: fontItalic, color: mid,
    });
    y -= 38;

    // ── Student name ──────────────────────────────────────────────────────────
    const nameSize = 30;
    page.drawText(user.fullName, {
      x: cx(user.fullName, nameSize, fontBold, width), y,
      size: nameSize, font: fontBold, color: dark,
    });
    y -= 20;

    page.drawText(user.email, {
      x: cx(user.email, 9, fontRegular, width), y,
      size: 9, font: fontRegular, color: light,
    });
    y -= 28;

    // ── "has successfully completed" ──────────────────────────────────────────
    const compLine = "has successfully completed the following IIRSM approved course:";
    page.drawText(compLine, {
      x: cx(compLine, 10, fontItalic, width), y,
      size: 10, font: fontItalic, color: mid,
    });
    y -= 30;

    // ── Course title ──────────────────────────────────────────────────────────
    const courseTitle = "Chainsaw Maintenance & Cross Cutting";
    page.drawText(courseTitle, {
      x: cx(courseTitle, 20, fontBold, width), y,
      size: 20, font: fontBold, color: dark,
    });
    y -= 18;

    const courseSub = "Professional Training Course  |  Theory & Knowledge Assessment";
    page.drawText(courseSub, {
      x: cx(courseSub, 9, fontRegular, width), y,
      size: 9, font: fontRegular, color: mid,
    });
    y -= 32;

    // ── CPD + Score band ──────────────────────────────────────────────────────
    const bandW   = 480;
    const bandX   = (width - bandW) / 2;
    const bandH   = 26;
    page.drawRectangle({ x: bandX, y: y - 4, width: bandW, height: bandH,
      color: rgb(0.97, 0.97, 0.97), borderColor: rgb(0.85, 0.85, 0.85), borderWidth: 0.5 });

    const cpdText  = "CPD: 5 Verifiable Hours  |  IIRSM Approved Learning";
    const scoreText = passedScore !== null ? `Exam Score: ${passedScore}%` : "";
    page.drawText(cpdText, { x: bandX + 14, y: y + 5, size: 8, font: fontBold, color: iirBlue });
    if (scoreText) {
      page.drawText(scoreText, {
        x: bandX + bandW - 14 - fontBold.widthOfTextAtSize(scoreText, 8), y: y + 5,
        size: 8, font: fontBold, color: orange,
      });
    }
    y -= 34;

    // ── Thin rule ─────────────────────────────────────────────────────────────
    page.drawRectangle({ x: width / 2 - 120, y, width: 240, height: 0.5, color: rgb(0.8, 0.8, 0.8) });
    y -= 20;

    // ── Date ─────────────────────────────────────────────────────────────────
    const dateStr  = passedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    page.drawText(dateStr, {
      x: cx(dateStr, 10, fontRegular, width), y,
      size: 10, font: fontRegular, color: mid,
    });
    y -= 38;

    // ── Signature lines ───────────────────────────────────────────────────────
    const lineLen  = 160;
    const sigGap   = 80;
    const totalSig = lineLen * 2 + sigGap;
    const sigLeft  = (width - totalSig) / 2;
    const sigRight = sigLeft + lineLen + sigGap;

    page.drawRectangle({ x: sigLeft,  y, width: lineLen, height: 0.75, color: rgb(0.5, 0.5, 0.5) });
    page.drawRectangle({ x: sigRight, y, width: lineLen, height: 0.75, color: rgb(0.5, 0.5, 0.5) });
    page.drawText("Authorised Signatory", {
      x: sigLeft  + (lineLen - fontRegular.widthOfTextAtSize("Authorised Signatory", 7.5)) / 2,
      y: y - 11, size: 7.5, font: fontRegular, color: light,
    });
    page.drawText("Course Director", {
      x: sigRight + (lineLen - fontRegular.widthOfTextAtSize("Course Director", 7.5)) / 2,
      y: y - 11, size: 7.5, font: fontRegular, color: light,
    });

    // ── Reference number (bottom left, above footer) ──────────────────────────
    const ref     = certRef(user.id, passedAt);
    const refText = `Certificate Ref: ${ref}  |  Course v${process.env.npm_package_version ?? "1.1.0"}`;
    page.drawText(refText, { x: 50, y: 38, size: 7, font: fontRegular, color: light });

    // IIRSM statement (bottom right)
    const iirStatement = "International Institute of Risk and Safety Management";
    page.drawText(iirStatement, {
      x: width - 50 - fontRegular.widthOfTextAtSize(iirStatement, 7),
      y: 38, size: 7, font: fontRegular, color: iirBlue,
    });

    // ── Footer band ───────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 0, width: width, height: 28, color: orange });
    const footerText = "chainsawcourses.co.uk  |  IIRSM Approved Training Provider";
    page.drawText(footerText, {
      x: cx(footerText, 9, fontRegular, width), y: 9,
      size: 9, font: fontRegular, color: white,
    });

    // ── Serve ─────────────────────────────────────────────────────────────────
    const pdfBytes = await pdfDoc.save();
    const safeName = user.fullName.replace(/[^a-z0-9]/gi, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="Certificate_${safeName}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    logger.error({ err }, "Error generating certificate");
    res.status(500).json({ error: "Could not generate certificate" });
  }
});

export default router;
