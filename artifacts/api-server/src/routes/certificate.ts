import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, examAttemptsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

const router = Router();

const LOGO_PATH = path.resolve("artifacts/chainsaw-training/public/logo.png");

// Centre a string horizontally on the page
function centreX(text: string, size: number, font: Awaited<ReturnType<PDFDocument["embedFont"]>>, pageWidth: number) {
  return (pageWidth - font.widthOfTextAtSize(text, size)) / 2;
}

router.get("/certificate", async (req, res) => {
  const deviceId = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing credentials" });
    return;
  }

  try {
    const user = await resolveUser(activationCode, deviceId);
    if (!user) {
      res.status(401).json({ error: "Unauthorised" });
      return;
    }

    const passedAttempts = await db
      .select()
      .from(examAttemptsTable)
      .where(and(eq(examAttemptsTable.userId, user.id), eq(examAttemptsTable.passed, true)))
      .orderBy(desc(examAttemptsTable.attemptedAt))
      .limit(1);

    const passedAt = passedAttempts.length > 0 ? passedAttempts[0].attemptedAt : new Date();

    // -------------------------------------------------------------------------
    // Page setup — A4 landscape for a more certificate-like feel
    // -------------------------------------------------------------------------
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([842, 595]); // A4 landscape
    const { width, height } = page.getSize();

    const fontBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontItalic  = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    const orange = rgb(0.82, 0.38, 0.05);
    const dark   = rgb(0.08, 0.08, 0.08);
    const mid    = rgb(0.4,  0.4,  0.4);
    const light  = rgb(0.65, 0.65, 0.65);
    const white  = rgb(1,    1,    1);

    // ---- Outer border -------------------------------------------------------
    page.drawRectangle({ x: 24, y: 24, width: width - 48, height: height - 48,
      borderColor: orange, borderWidth: 1.5, color: white });

    // ---- Thin inner border --------------------------------------------------
    page.drawRectangle({ x: 32, y: 32, width: width - 64, height: height - 64,
      borderColor: rgb(0.9, 0.9, 0.9), borderWidth: 0.5, color: white });

    // ---- Logo ---------------------------------------------------------------
    let logoHeight = 0;
    try {
      const logoBytes = fs.readFileSync(LOGO_PATH);
      const logoImg   = await pdfDoc.embedPng(logoBytes);
      const logoDim   = logoImg.scaleToFit(90, 90);
      logoHeight = logoDim.height;
      page.drawImage(logoImg, {
        x: (width - logoDim.width) / 2,
        y: height - 50 - logoDim.height,
        width:  logoDim.width,
        height: logoDim.height,
      });
    } catch { /* skip */ }

    let y = height - 50 - logoHeight - 16;

    // ---- Brand name ---------------------------------------------------------
    const brand = "Chainsaw Courses";
    const brandSize = 13;
    page.drawText(brand, {
      x: centreX(brand, brandSize, fontBold, width),
      y,
      size: brandSize,
      font: fontBold,
      color: orange,
    });
    y -= 22;

    // ---- Thin rule ----------------------------------------------------------
    page.drawRectangle({ x: width / 2 - 120, y, width: 240, height: 0.75, color: rgb(0.82, 0.38, 0.05) });
    y -= 28;

    // ---- "This is to certify that" ------------------------------------------
    const certify = "This is to certify that";
    page.drawText(certify, {
      x: centreX(certify, 10, fontItalic, width),
      y,
      size: 10,
      font: fontItalic,
      color: mid,
    });
    y -= 38;

    // ---- Student name -------------------------------------------------------
    const nameSize = 32;
    page.drawText(user.fullName, {
      x: centreX(user.fullName, nameSize, fontBold, width),
      y,
      size: nameSize,
      font: fontBold,
      color: dark,
    });
    y -= 22;

    // ---- Email --------------------------------------------------------------
    page.drawText(user.email, {
      x: centreX(user.email, 9, fontRegular, width),
      y,
      size: 9,
      font: fontRegular,
      color: light,
    });
    y -= 32;

    // ---- "has successfully completed" ---------------------------------------
    const completed = "has successfully completed";
    page.drawText(completed, {
      x: centreX(completed, 10, fontItalic, width),
      y,
      size: 10,
      font: fontItalic,
      color: mid,
    });
    y -= 30;

    // ---- Course title -------------------------------------------------------
    const courseTitle = "Chainsaw Maintenance & Cross Cutting";
    const courseTitleSize = 18;
    page.drawText(courseTitle, {
      x: centreX(courseTitle, courseTitleSize, fontBold, width),
      y,
      size: courseTitleSize,
      font: fontBold,
      color: dark,
    });
    y -= 18;

    // ---- Course subtitle ----------------------------------------------------
    const courseSub = "Professional Training Course";
    page.drawText(courseSub, {
      x: centreX(courseSub, 10, fontRegular, width),
      y,
      size: 10,
      font: fontRegular,
      color: mid,
    });
    y -= 40;

    // ---- Thin rule ----------------------------------------------------------
    page.drawRectangle({ x: width / 2 - 100, y, width: 200, height: 0.75, color: rgb(0.85, 0.85, 0.85) });
    y -= 22;

    // ---- Date ---------------------------------------------------------------
    const dateStr = passedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const dateText = dateStr;
    page.drawText(dateText, {
      x: centreX(dateText, 10, fontRegular, width),
      y,
      size: 10,
      font: fontRegular,
      color: mid,
    });
    y -= 48;

    // ---- Signature lines ----------------------------------------------------
    const lineLen = 150;
    const gap     = 100;
    const totalSig = lineLen * 2 + gap;
    const sigLeft  = (width - totalSig) / 2;
    const sigRight = sigLeft + lineLen + gap;
    const lineY    = y;

    page.drawRectangle({ x: sigLeft,  y: lineY, width: lineLen, height: 0.75, color: rgb(0.5, 0.5, 0.5) });
    page.drawRectangle({ x: sigRight, y: lineY, width: lineLen, height: 0.75, color: rgb(0.5, 0.5, 0.5) });

    page.drawText("Authorised Signatory", {
      x: sigLeft  + (lineLen - fontRegular.widthOfTextAtSize("Authorised Signatory", 8)) / 2,
      y: lineY - 13, size: 8, font: fontRegular, color: light,
    });
    page.drawText("Course Director", {
      x: sigRight + (lineLen - fontRegular.widthOfTextAtSize("Course Director", 8)) / 2,
      y: lineY - 13, size: 8, font: fontRegular, color: light,
    });

    // ---- Bottom orange band -------------------------------------------------
    page.drawRectangle({ x: 0, y: 0, width: width, height: 32, color: orange });
    const footerText = "chainsawcourses.co.uk";
    page.drawText(footerText, {
      x: centreX(footerText, 9, fontRegular, width),
      y: 11,
      size: 9,
      font: fontRegular,
      color: white,
    });

    // -------------------------------------------------------------------------
    const pdfBytes = await pdfDoc.save();
    const safeName = user.fullName.replace(/[^a-z0-9]/gi, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Certificate_${safeName}.pdf"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    logger.error({ err }, "Error generating certificate");
    res.status(500).json({ error: "Could not generate certificate" });
  }
});

export default router;
