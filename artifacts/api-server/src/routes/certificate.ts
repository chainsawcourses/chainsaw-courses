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

// CWD is artifacts/api-server when running; step up to workspace root
const PUBLIC = path.resolve("../../artifacts/chainsaw-training/public");
const LOGO_PATH       = path.join(PUBLIC, "logo.png");
const IIRSM_LOGO_PATH = path.join(PUBLIC, "iirsm-logo.png");
const BG_PATH         = path.join(PUBLIC, "bg.jpg");

/** Centre x for text at a given size */
function cx(
  text: string,
  size: number,
  font: { widthOfTextAtSize(t: string, s: number): number },
  pageWidth: number,
) {
  return (pageWidth - font.widthOfTextAtSize(text, size)) / 2;
}

function certRef(userId: number, date: Date): string {
  const hash = crypto
    .createHash("md5")
    .update(`${userId}-${date.getFullYear()}`)
    .digest("hex")
    .toUpperCase()
    .slice(0, 6);
  return `CC/${date.getFullYear()}/${String(userId).padStart(4, "0")}/${hash}`;
}

router.get("/certificate", async (req, res) => {
  const deviceId       = req.headers["deviceid"] as string;
  const activationCode = req.headers["activationcode"] as string;

  if (!deviceId || !activationCode) {
    res.status(401).json({ error: "Missing credentials" });
    return;
  }

  try {
    const user = await resolveUser(activationCode, deviceId);
    if (!user) { res.status(401).json({ error: "Unauthorised" }); return; }

    const passedAttempts = await db
      .select()
      .from(examAttemptsTable)
      .where(and(eq(examAttemptsTable.userId, user.id), eq(examAttemptsTable.passed, true)))
      .orderBy(desc(examAttemptsTable.attemptedAt))
      .limit(1);

    const passedAt    = passedAttempts.length > 0 ? passedAttempts[0].attemptedAt : new Date();
    const passedScore = passedAttempts.length > 0 ? passedAttempts[0].score : null;

    // ─── Document ────────────────────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create();
    // A4 Portrait
    const W = 595;
    const H = 842;
    const page = pdfDoc.addPage([W, H]);

    const fBold    = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fReg     = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fItalic  = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // Colour palette — light text on dark bg
    const orange  = rgb(0.95, 0.52, 0.08);
    const white   = rgb(1.00, 1.00, 1.00);
    const cream   = rgb(0.92, 0.90, 0.85);
    const lgrey   = rgb(0.68, 0.68, 0.68);
    const iirBlue = rgb(0.55, 0.73, 0.95);   // lighter so legible on dark bg

    // ─── Background image ────────────────────────────────────────────────────
    try {
      const bgBytes = fs.readFileSync(BG_PATH);
      const bgImg   = await pdfDoc.embedJpg(bgBytes);
      page.drawImage(bgImg, { x: 0, y: 0, width: W, height: H });
    } catch { /* fallback: solid dark */ }

    // Dark overlay to dim the photo (simulates the course screen wash)
    page.drawRectangle({ x: 0, y: 0, width: W, height: H,
      color: rgb(0.04, 0.06, 0.08), opacity: 0.72 });

    // ─── Border ──────────────────────────────────────────────────────────────
    page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36,
      borderColor: orange, borderWidth: 1.8, opacity: 1 });
    page.drawRectangle({ x: 26, y: 26, width: W - 52, height: H - 52,
      borderColor: rgb(1, 1, 1), borderWidth: 0.4, opacity: 0.25 });

    // ─── Helper: thin rule ───────────────────────────────────────────────────
    function rule(y: number, col = lgrey, op = 0.5) {
      page.drawRectangle({ x: 50, y, width: W - 100, height: 0.6,
        color: col, opacity: op });
    }

    // ─── Logos ───────────────────────────────────────────────────────────────
    const LOGO_H   = 72;
    const LOGO_GAP = 50;
    const logoTop  = H - 52;      // y of top edge of logo area
    const logoY    = logoTop - LOGO_H;   // pdf y = bottom of logo

    // We centre both logos together
    let leftLogoW  = LOGO_H;   // default square placeholder
    let rightLogoW = LOGO_H;

    // Measure actual widths so we can centre the pair
    let ccImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
    let iirImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;

    try {
      ccImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_PATH));
      leftLogoW = ccImg.scaleToFit(LOGO_H, LOGO_H).width;
    } catch { /* skip */ }

    try {
      iirImg = await pdfDoc.embedPng(fs.readFileSync(IIRSM_LOGO_PATH));
      rightLogoW = iirImg.scaleToFit(LOGO_H, LOGO_H).width;
    } catch { /* skip */ }

    const pairW  = leftLogoW + LOGO_GAP + rightLogoW;
    const pairX  = (W - pairW) / 2;

    if (ccImg) {
      const d = ccImg.scaleToFit(LOGO_H, LOGO_H);
      page.drawImage(ccImg, { x: pairX, y: logoY + (LOGO_H - d.height) / 2,
        width: d.width, height: d.height });
    }
    if (iirImg) {
      const d = iirImg.scaleToFit(LOGO_H, LOGO_H);
      page.drawImage(iirImg, { x: pairX + leftLogoW + LOGO_GAP, y: logoY + (LOGO_H - d.height) / 2,
        width: d.width, height: d.height });
    }

    // Orange divider under logos
    let y = logoY - 16;
    page.drawRectangle({ x: 50, y, width: W - 100, height: 1.2, color: orange, opacity: 0.85 });
    y -= 18;

    // Branding line
    const brand = "CHAINSAW COURSES  |  IIRSM Approved Training Provider";
    page.drawText(brand, {
      x: cx(brand, 7.5, fBold, W), y,
      size: 7.5, font: fBold, color: orange, opacity: 0.9,
    });
    y -= 22;

    // ─── Certificate title ───────────────────────────────────────────────────
    rule(y); y -= 20;

    const title = "CERTIFICATE OF COMPLETION";
    page.drawText(title, {
      x: cx(title, 18, fBold, W), y,
      size: 18, font: fBold, color: white,
    });
    y -= 13;

    rule(y); y -= 28;

    // ─── "This is to certify that" ───────────────────────────────────────────
    const certLine = "This is to certify that";
    page.drawText(certLine, {
      x: cx(certLine, 9.5, fItalic, W), y,
      size: 9.5, font: fItalic, color: cream, opacity: 0.85,
    });
    y -= 46;

    // ─── Student name ────────────────────────────────────────────────────────
    const nameSize = 30;
    page.drawText(user.fullName, {
      x: cx(user.fullName, nameSize, fBold, W), y,
      size: nameSize, font: fBold, color: white,
    });
    y -= 22;

    page.drawText(user.email, {
      x: cx(user.email, 8.5, fReg, W), y,
      size: 8.5, font: fReg, color: lgrey,
    });
    y -= 32;

    // ─── Course ──────────────────────────────────────────────────────────────
    rule(y); y -= 22;

    const compLine = "has successfully completed the following IIRSM approved course:";
    page.drawText(compLine, {
      x: cx(compLine, 9, fItalic, W), y,
      size: 9, font: fItalic, color: cream, opacity: 0.8,
    });
    y -= 36;

    const courseName = "Chainsaw Maintenance & Cross Cutting";
    page.drawText(courseName, {
      x: cx(courseName, 20, fBold, W), y,
      size: 20, font: fBold, color: white,
    });
    y -= 18;

    const courseSub = "Professional Training Course  \u00B7  Theory & Knowledge Assessment";
    page.drawText(courseSub, {
      x: cx(courseSub, 8.5, fReg, W), y,
      size: 8.5, font: fReg, color: lgrey,
    });
    y -= 30;

    // ─── CPD band ────────────────────────────────────────────────────────────
    const bandW = W - 100;
    const bandX = 50;
    const bandH = 26;
    page.drawRectangle({ x: bandX, y: y - 4, width: bandW, height: bandH,
      color: rgb(1, 1, 1), opacity: 0.06,
      borderColor: orange, borderWidth: 0.8 });

    const cpdText   = "CPD: 5 Verifiable Hours  |  IIRSM Approved Learning";
    const scoreText = passedScore !== null ? `Score: ${passedScore}%` : "";
    page.drawText(cpdText, { x: bandX + 12, y: y + 5, size: 8, font: fBold, color: orange });
    if (scoreText) {
      page.drawText(scoreText, {
        x: bandX + bandW - 12 - fBold.widthOfTextAtSize(scoreText, 8), y: y + 5,
        size: 8, font: fBold, color: iirBlue,
      });
    }
    y -= 44;

    // ─── Date ────────────────────────────────────────────────────────────────
    rule(y); y -= 20;

    const dateStr = passedAt.toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
    const dateLine = `Awarded: ${dateStr}`;
    page.drawText(dateLine, {
      x: cx(dateLine, 9.5, fReg, W), y,
      size: 9.5, font: fReg, color: cream,
    });
    y -= 44;

    // ─── Signatures ──────────────────────────────────────────────────────────
    const lineLen = 155;
    const sigGap  = 60;
    const sigPair = lineLen * 2 + sigGap;
    const sigL    = (W - sigPair) / 2;
    const sigR    = sigL + lineLen + sigGap;

    page.drawRectangle({ x: sigL,  y, width: lineLen, height: 0.7, color: lgrey, opacity: 0.6 });
    page.drawRectangle({ x: sigR,  y, width: lineLen, height: 0.7, color: lgrey, opacity: 0.6 });

    const lblOpts = (label: string, baseX: number) => ({
      x: baseX + (lineLen - fReg.widthOfTextAtSize(label, 7.5)) / 2,
      y: y - 13, size: 7.5 as const, font: fReg, color: lgrey,
    });
    page.drawText("Authorised Signatory", lblOpts("Authorised Signatory", sigL));
    page.drawText("Course Director",      lblOpts("Course Director",      sigR));

    // ─── Ref + IIRSM attribution ─────────────────────────────────────────────
    const ref     = certRef(user.id, passedAt);
    const refText = `Certificate Ref: ${ref}`;
    page.drawText(refText, { x: 50, y: 50, size: 7, font: fReg, color: lgrey, opacity: 0.7 });

    const iirAttr = "International Institute of Risk and Safety Management";
    page.drawText(iirAttr, {
      x: W - 50 - fReg.widthOfTextAtSize(iirAttr, 7),
      y: 50, size: 7, font: fReg, color: iirBlue, opacity: 0.8,
    });

    // ─── Footer strip ────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 0, width: W, height: 34, color: orange, opacity: 1 });
    const footer = "chainsawcourses.co.uk  |  IIRSM Approved Training Provider";
    page.drawText(footer, {
      x: cx(footer, 8.5, fReg, W), y: 11,
      size: 8.5, font: fReg, color: white,
    });

    // ─── Send ─────────────────────────────────────────────────────────────────
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
