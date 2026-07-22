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

const PUBLIC     = path.resolve("../../artifacts/chainsaw-training/public");
const LOGO_PATH  = path.join(PUBLIC, "logo.png");
const IIRSM_PATH = path.join(PUBLIC, "iirsm-logo.png");
const BG_PATH    = path.join(PUBLIC, "bg.jpg");
const SIG_PATH   = path.join(PUBLIC, "signature_director.png");

const BG_W = 5071;
const BG_H = 3021;

function cx(text: string, size: number, font: { widthOfTextAtSize(t: string, s: number): number }, W: number) {
  return (W - font.widthOfTextAtSize(text, size)) / 2;
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

    // ── Page ──────────────────────────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create();
    const W = 595, H = 842;
    const page = pdfDoc.addPage([W, H]);

    const fBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fReg    = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // ── Palette ───────────────────────────────────────────────────────────────
    const orange = rgb(0.82, 0.38, 0.05);
    const black  = rgb(0.08, 0.08, 0.08);
    const mid    = rgb(0.35, 0.35, 0.35);
    const lgrey  = rgb(0.58, 0.58, 0.58);
    const silver = rgb(0.78, 0.78, 0.78);
    const dark   = rgb(0.20, 0.20, 0.20);
    const white  = rgb(1.00, 1.00, 1.00);

    // ── Border constants ──────────────────────────────────────────────────────
    const BI = 14;   // inset from page edge
    const BW = 2.2;  // stroke width

    const ML = 52;   // left / right text margin

    // ── Background ────────────────────────────────────────────────────────────
    try {
      const bgBytes = fs.readFileSync(BG_PATH);
      const bgImg   = await pdfDoc.embedJpg(bgBytes);
      const scale   = Math.max(W / BG_W, H / BG_H);
      const dw = BG_W * scale, dh = BG_H * scale;
      page.drawImage(bgImg, { x: (W - dw) / 2, y: (H - dh) / 2, width: dw, height: dh });
    } catch { /* white page */ }
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: white, opacity: 0.92 });

    // ── Helper ────────────────────────────────────────────────────────────────
    function rule(y: number, opacity = 0.38) {
      page.drawRectangle({ x: ML, y, width: W - ML * 2, height: 0.6, color: lgrey, opacity });
    }

    // ════════════════════════════════════════════════════════════════════════
    //  FIXED GRID  (y = distance in points from PAGE BOTTOM)
    //  Orange border: bottom at y=14, top at y=828.
    //  All content must be between y=30 (above border bottom) and y=812 (below border top).
    //  Nothing is drawn below y=30.
    // ════════════════════════════════════════════════════════════════════════

    // ──────────────────────────────────────────────────────────────────────────
    //  BOTTOM ZONE  (y = 30 … 180)
    //  footer text → cert ref → sig labels → sig lines → sig image
    // ──────────────────────────────────────────────────────────────────────────

    // Footer: NO fill — just a thin rule + text on plain background
    page.drawRectangle({ x: ML, y: 44, width: W - ML * 2, height: 0.5, color: silver, opacity: 0.6 });
    const footerTxt = "chainsawcourses.co.uk  |  IIRSM Approved Training Provider";
    page.drawText(footerTxt, {
      x: cx(footerTxt, 7.5, fReg, W), y: 30,
      size: 7.5, font: fReg, color: lgrey,
    });

    // Certificate reference
    const ref    = certRef(user.id, passedAt);
    const refStr = `Certificate Ref: ${ref}`;
    page.drawText(refStr, {
      x: cx(refStr, 7, fReg, W), y: 58,
      size: 7, font: fReg, color: lgrey,
    });

    // Signature zone — sig lines at y=104, image sits just above the line
    const SIG_LINE_Y  = 104;
    const SIG_IMAGE_Y = SIG_LINE_Y + 2;    // 106 — bottom of image 2pt above line
    const SIG_MAX_H   = 36;                 // image never taller than 36 pt
    const SIG_LABEL_Y = SIG_LINE_Y - 16;   // 88

    const sigZoneW = 175;
    const sigL = ML;
    const sigR = W - ML - sigZoneW;

    // Director signature image above right sig line
    try {
      const sigBytes = fs.readFileSync(SIG_PATH);
      const sigImg   = await pdfDoc.embedPng(sigBytes);
      const d        = sigImg.scaleToFit(sigZoneW - 20, SIG_MAX_H);
      page.drawImage(sigImg, {
        x: sigR + (sigZoneW - d.width) / 2,
        y: SIG_IMAGE_Y,
        width: d.width, height: d.height,
      });
    } catch { /* no sig */ }

    page.drawRectangle({ x: sigL, y: SIG_LINE_Y, width: sigZoneW, height: 0.8, color: lgrey });
    page.drawRectangle({ x: sigR, y: SIG_LINE_Y, width: sigZoneW, height: 0.8, color: lgrey });

    const lbl1 = "Authorised Signatory";
    const lbl2 = "Course Director";
    page.drawText(lbl1, {
      x: sigL + (sigZoneW - fReg.widthOfTextAtSize(lbl1, 7.5)) / 2,
      y: SIG_LABEL_Y, size: 7.5, font: fReg, color: lgrey,
    });
    page.drawText(lbl2, {
      x: sigR + (sigZoneW - fReg.widthOfTextAtSize(lbl2, 7.5)) / 2,
      y: SIG_LABEL_Y, size: 7.5, font: fReg, color: lgrey,
    });

    // ──────────────────────────────────────────────────────────────────────────
    //  MAIN CONTENT ZONE  (y = 170 … 790)
    //  sig image top = SIG_IMAGE_Y + SIG_MAX_H = 114 + 36 = 150
    //  Date must start above 150 + comfortable gap → y = 186 for date text
    //  Everything else stacks upward from there with generous gaps.
    // ──────────────────────────────────────────────────────────────────────────

    //  DATE  (pushed up to make room for validity line below)
    const dateStr  = passedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const dateLine = `Date of Award:  ${dateStr}`;
    page.drawText(dateLine, {
      x: cx(dateLine, 10, fReg, W),
      y: 224, size: 10, font: fReg, color: mid,
    });

    //  VALIDITY
    const validityLine = "This certificate is valid for 3 years from the date of issue";
    page.drawText(validityLine, {
      x: cx(validityLine, 8, fItalic, W),
      y: 206, size: 8, font: fItalic, color: lgrey,
    });

    rule(243, 0.28);

    //  CREDENTIALS BLOCK ─────────────────────────────────────────────────────
    //  Row 1: GLH + CPD + IIRSM Approved  (bold headline)
    const glhLine = "Guided Learning Hours: 5  \u00B7  CPD: 5 Verifiable CPD Hours  \u00B7  IIRSM Approved Learning";
    page.drawText(glhLine, {
      x: cx(glhLine, 9.5, fBold, W),
      y: 318, size: 9.5, font: fBold, color: black,
    });

    //  Row 2: Unit reference + assessment method + pass mark
    const unitLine = "Unit Ref: 0039-20  \u00B7  Assessment: Online Theory & Knowledge  \u00B7  Pass Mark: 80%";
    page.drawText(unitLine, {
      x: cx(unitLine, 8.5, fReg, W),
      y: 300, size: 8.5, font: fReg, color: mid,
    });

    //  Row 3: Score (if available) + course version
    const courseVersion = "Course Version 1.1 \u00B7 July 2026";
    let credRow3Y = 282;
    if (passedScore !== null) {
      const scoreLine = `Assessment Score: ${passedScore}%  \u00B7  ${courseVersion}`;
      page.drawText(scoreLine, {
        x: cx(scoreLine, 9, fReg, W),
        y: credRow3Y, size: 9, font: fReg, color: mid,
      });
    } else {
      page.drawText(courseVersion, {
        x: cx(courseVersion, 9, fReg, W),
        y: credRow3Y, size: 9, font: fReg, color: mid,
      });
    }

    //  Row 4: IIRSM full name italic
    page.drawText("International Institute of Risk and Safety Management", {
      x: cx("International Institute of Risk and Safety Management", 8.5, fItalic, W),
      y: 264, size: 8.5, font: fItalic, color: lgrey,
    });

    //  COURSE BLOCK — equidistant between "has successfully" (y=476) and subtitle (y=377)
    page.drawText("Chainsaw Maintenance & Cross Cutting", {
      x: cx("Chainsaw Maintenance & Cross Cutting", 22, fBold, W),
      y: 416, size: 22, font: fBold, color: black,
    });
    page.drawText("Professional Training Course  \u00B7  Theory & Knowledge Assessment", {
      x: cx("Professional Training Course  \u00B7  Theory & Knowledge Assessment", 9, fReg, W),
      y: 368, size: 9, font: fReg, color: lgrey,
    });

    //  TITLE BAND
    page.drawText("CERTIFICATE OF COMPLETION", {
      x: cx("CERTIFICATE OF COMPLETION", 20, fBold, W),
      y: 610, size: 20, font: fBold, color: black,
    });

    //  CERTIFY BLOCK — immediately below title
    page.drawText("This is to certify that", {
      x: cx("This is to certify that", 10, fItalic, W),
      y: 576, size: 10, font: fItalic, color: mid,
    });
    page.drawText(user.fullName, {
      x: cx(user.fullName, 34, fBold, W),
      y: 530, size: 34, font: fBold, color: black,
    });
    page.drawText(user.email, {
      x: cx(user.email, 9.5, fReg, W),
      y: 500, size: 9.5, font: fReg, color: lgrey,
    });
    page.drawText("has successfully completed the following IIRSM approved course:", {
      x: cx("has successfully completed the following IIRSM approved course:", 9.5, fItalic, W),
      y: 476, size: 9.5, font: fItalic, color: mid,
    });

    //  LOGOS + PROVIDER STRAP
    const LOGO_H    = 68;
    const logoBottom = 688;     // bottom of logo image zone

    let ccImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null  = null;
    let iirImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
    let ccW = LOGO_H, iirW = LOGO_H;

    try {
      ccImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_PATH));
      ccW   = ccImg.scaleToFit(LOGO_H * 2.8, LOGO_H).width;
    } catch { /* skip */ }

    try {
      iirImg = await pdfDoc.embedPng(fs.readFileSync(IIRSM_PATH));
      iirW   = iirImg.scaleToFit(LOGO_H, LOGO_H).width;
    } catch { /* skip */ }

    const pairW = ccW + 52 + iirW;
    const pairX = (W - pairW) / 2;

    if (ccImg) {
      const d = ccImg.scaleToFit(LOGO_H * 2.8, LOGO_H);
      page.drawImage(ccImg, {
        x: pairX, y: logoBottom + (LOGO_H - d.height) / 2,
        width: d.width, height: d.height,
      });
    }
    if (iirImg) {
      const d = iirImg.scaleToFit(LOGO_H, LOGO_H);
      page.drawImage(iirImg, {
        x: pairX + ccW + 52, y: logoBottom + (LOGO_H - d.height) / 2,
        width: d.width, height: d.height,
      });
    }

    // Rule and strap just below logos
    page.drawRectangle({ x: ML, y: 678, width: W - ML * 2, height: 0.8, color: dark, opacity: 0.45 });
    const strap = "CHAINSAW COURSES  |  IIRSM Approved Training Provider";
    page.drawText(strap, { x: cx(strap, 7.5, fBold, W), y: 662, size: 7.5, font: fBold, color: mid });
    page.drawRectangle({ x: ML, y: 652, width: W - ML * 2, height: 0.5, color: silver, opacity: 0.5 });

    // ── ORANGE BORDER — painted last so it covers any bleed ───────────────────
    page.drawRectangle({
      x: BI, y: BI,
      width: W - BI * 2, height: H - BI * 2,
      borderColor: orange, borderWidth: BW,
    });
    page.drawRectangle({
      x: BI + 7, y: BI + 7,
      width: W - (BI + 7) * 2, height: H - (BI + 7) * 2,
      borderColor: silver, borderWidth: 0.5,
    });

    // ── Send ──────────────────────────────────────────────────────────────────
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
