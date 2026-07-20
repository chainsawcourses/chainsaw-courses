import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, modulesTable, userProgressTable, examAttemptsTable } from "@workspace/db";
import { eq, asc, and, desc } from "drizzle-orm";
import { resolveUser } from "./auth";
import { logger } from "../lib/logger";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

const router = Router();

// Resolve the logo once at startup (path relative to project root)
const LOGO_PATH = path.resolve("artifacts/chainsaw-training/public/logo.png");

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

    // Fetch the most recent passed exam attempt
    const passedAttempts = await db
      .select()
      .from(examAttemptsTable)
      .where(and(eq(examAttemptsTable.userId, user.id), eq(examAttemptsTable.passed, true)))
      .orderBy(desc(examAttemptsTable.attemptedAt))
      .limit(1);

    const passedAt = passedAttempts.length > 0
      ? passedAttempts[0].attemptedAt
      : new Date();

    const passedScore = passedAttempts.length > 0
      ? passedAttempts[0].score
      : null;

    // Fetch all active video modules in order
    const modules = await db
      .select()
      .from(modulesTable)
      .where(and(eq(modulesTable.isActive, true), eq(modulesTable.contentType, "video")))
      .orderBy(asc(modulesTable.order));

    // -----------------------------------------------------------------------
    // Build PDF
    // -----------------------------------------------------------------------
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595, 842]); // A4 portrait
    const { width, height } = page.getSize();

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // Colours
    const orange = rgb(0.82, 0.38, 0.05);   // primary brand orange
    const dark   = rgb(0.1,  0.1,  0.1);
    const mid    = rgb(0.35, 0.35, 0.35);
    const light  = rgb(0.6,  0.6,  0.6);

    // ---- Logo ---------------------------------------------------------------
    try {
      const logoBytes = fs.readFileSync(LOGO_PATH);
      const logoImg   = await pdfDoc.embedPng(logoBytes);
      const logoDim   = logoImg.scaleToFit(100, 100);
      page.drawImage(logoImg, {
        x: (width - logoDim.width) / 2,
        y: height - 40 - logoDim.height,
        width: logoDim.width,
        height: logoDim.height,
      });
    } catch {
      // Logo not available — skip silently
    }

    let y = height - 160;

    // ---- Top rule -----------------------------------------------------------
    page.drawRectangle({ x: 40, y, width: width - 80, height: 2, color: orange });
    y -= 24;

    // ---- Main heading -------------------------------------------------------
    const heading = "CERTIFICATE OF";
    const heading2 = "THEORETICAL COMPETENCY";
    const h1Size = 22;
    const h2Size = 18;

    page.drawText(heading, {
      x: (width - fontBold.widthOfTextAtSize(heading, h1Size)) / 2,
      y,
      size: h1Size,
      font: fontBold,
      color: dark,
    });
    y -= 28;
    page.drawText(heading2, {
      x: (width - fontBold.widthOfTextAtSize(heading2, h2Size)) / 2,
      y,
      size: h2Size,
      font: fontBold,
      color: orange,
    });
    y -= 14;

    // ---- Bottom rule --------------------------------------------------------
    page.drawRectangle({ x: 40, y, width: width - 80, height: 2, color: orange });
    y -= 28;

    // ---- Issued to ----------------------------------------------------------
    const issueLabel = "This certificate is awarded to";
    page.drawText(issueLabel, {
      x: (width - fontItalic.widthOfTextAtSize(issueLabel, 11)) / 2,
      y,
      size: 11,
      font: fontItalic,
      color: mid,
    });
    y -= 30;

    page.drawText(user.fullName, {
      x: (width - fontBold.widthOfTextAtSize(user.fullName, 24)) / 2,
      y,
      size: 24,
      font: fontBold,
      color: dark,
    });
    y -= 20;

    page.drawText(user.email, {
      x: (width - fontRegular.widthOfTextAtSize(user.email, 10)) / 2,
      y,
      size: 10,
      font: fontRegular,
      color: light,
    });
    y -= 30;

    // ---- Course description -------------------------------------------------
    const courseTitle = "Chainsaw Safety & Operations — Professional Training Course";
    page.drawText(courseTitle, {
      x: (width - fontBold.widthOfTextAtSize(courseTitle, 11)) / 2,
      y,
      size: 11,
      font: fontBold,
      color: dark,
    });
    y -= 14;

    const courseSubtitle = "Vocational Chainsaw Safety Certification Programme";
    page.drawText(courseSubtitle, {
      x: (width - fontRegular.widthOfTextAtSize(courseSubtitle, 9)) / 2,
      y,
      size: 9,
      font: fontRegular,
      color: light,
    });
    y -= 28;

    // ---- Divider ------------------------------------------------------------
    page.drawRectangle({ x: 120, y: y + 4, width: width - 240, height: 1, color: rgb(0.85, 0.85, 0.85) });
    y -= 20;

    // ---- Modules heading ----------------------------------------------------
    page.drawText("MODULES COMPLETED", {
      x: (width - fontBold.widthOfTextAtSize("MODULES COMPLETED", 9)) / 2,
      y,
      size: 9,
      font: fontBold,
      color: orange,
    });
    y -= 16;

    // ---- Module list --------------------------------------------------------
    const colLeft  = 80;
    const colRight = width / 2 + 10;
    const mid2 = Math.ceil(modules.length / 2);

    for (let i = 0; i < mid2; i++) {
      const left  = modules[i];
      const right = modules[i + mid2];

      const drawModule = (mod: typeof left, x: number) => {
        if (!mod) return;
        const label = `${mod.order}. ${mod.title}`;
        // bullet
        page.drawText(">", { x, y, size: 8, font: fontBold, color: orange });
        page.drawText(label, { x: x + 14, y, size: 8, font: fontRegular, color: dark });
      };

      drawModule(left, colLeft);
      if (right) drawModule(right, colRight);
      y -= 14;
    }

    y -= 10;

    // ---- Final exam score ---------------------------------------------------
    if (passedScore !== null) {
      const scoreText = `Final Summative Exam — Score: ${passedScore}%`;
      page.drawText(scoreText, {
        x: (width - fontBold.widthOfTextAtSize(scoreText, 9)) / 2,
        y,
        size: 9,
        font: fontBold,
        color: mid,
      });
      y -= 14;
    }

    // ---- Divider ------------------------------------------------------------
    page.drawRectangle({ x: 120, y: y + 4, width: width - 240, height: 1, color: rgb(0.85, 0.85, 0.85) });
    y -= 20;

    // ---- Date + signature block --------------------------------------------
    const dateStr = passedAt.toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });

    const dateLabel = `Date of Completion:  ${dateStr}`;
    page.drawText(dateLabel, {
      x: (width - fontRegular.widthOfTextAtSize(dateLabel, 10)) / 2,
      y,
      size: 10,
      font: fontRegular,
      color: dark,
    });
    y -= 40;

    // Signature lines
    const lineY = y;
    const lineLen = 160;
    const leftX  = 80;
    const rightX = width - 80 - lineLen;

    page.drawRectangle({ x: leftX,  y: lineY, width: lineLen, height: 1, color: dark });
    page.drawRectangle({ x: rightX, y: lineY, width: lineLen, height: 1, color: dark });
    page.drawText("Authorised Signatory", { x: leftX,  y: lineY - 12, size: 8, font: fontRegular, color: light });
    page.drawText("Course Director",      { x: rightX, y: lineY - 12, size: 8, font: fontRegular, color: light });

    y = lineY - 30;

    // ---- Bottom orange band --------------------------------------------------
    page.drawRectangle({ x: 0, y: 0, width: width, height: 28, color: orange });
    page.drawText("Chainsaw Courses — chainsawcourses.co.uk", {
      x: (width - fontRegular.widthOfTextAtSize("Chainsaw Courses — chainsawcourses.co.uk", 9)) / 2,
      y: 9,
      size: 9,
      font: fontRegular,
      color: rgb(1, 1, 1),
    });

    // ---- Corner decorations (simple rectangles) -----------------------------
    const corner = 6;
    [
      [40, height - 40], [width - 40 - corner, height - 40],
      [40, 40], [width - 40 - corner, 40],
    ].forEach(([cx, cy]) => {
      page.drawRectangle({ x: cx, y: cy, width: corner, height: corner, color: orange });
    });

    // -----------------------------------------------------------------------
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
