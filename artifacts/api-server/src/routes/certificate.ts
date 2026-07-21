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

    // ── Page ─────────────────────────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create();
    const W = 595, H = 842;   // A4 portrait
    const page = pdfDoc.addPage([W, H]);

    const fBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fReg    = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // Palette — monochrome, no orange
    const black  = rgb(0.08, 0.08, 0.08);
    const dark   = rgb(0.15, 0.15, 0.15);
    const mid    = rgb(0.35, 0.35, 0.35);
    const lgrey  = rgb(0.60, 0.60, 0.60);
    const silver = rgb(0.80, 0.80, 0.80);
    const white  = rgb(1.00, 1.00, 1.00);
    const navy   = rgb(0.09, 0.22, 0.50);

    // ── Background ────────────────────────────────────────────────────────────
    try {
      const bgBytes = fs.readFileSync(BG_PATH);
      const bgImg   = await pdfDoc.embedJpg(bgBytes);
      const scaleByW = W / BG_W;
      const scaleByH = H / BG_H;
      const scale    = Math.max(scaleByW, scaleByH);
      const drawW    = BG_W * scale;
      const drawH    = BG_H * scale;
      page.drawImage(bgImg, {
        x: (W - drawW) / 2, y: (H - drawH) / 2,
        width: drawW, height: drawH,
      });
    } catch { /* plain white fallback */ }

    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: white, opacity: 0.90 });

    // ── Border — charcoal double rule ─────────────────────────────────────────
    page.drawRectangle({ x: 18, y: 18, width: W - 36, height: H - 36,
      borderColor: dark, borderWidth: 1.8 });
    page.drawRectangle({ x: 26, y: 26, width: W - 52, height: H - 52,
      borderColor: silver, borderWidth: 0.5 });

    // ── Helper: full-width rule ───────────────────────────────────────────────
    const ML = 52;
    function rule(y: number, opacity = 0.45) {
      page.drawRectangle({ x: ML, y, width: W - ML * 2, height: 0.6,
        color: lgrey, opacity });
    }

    // ── Logos ─────────────────────────────────────────────────────────────────
    const LOGO_H = 68;
    const GAP    = 52;
    const logoY  = H - 54 - LOGO_H;

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

    const pairW = ccW + GAP + iirW;
    const pairX = (W - pairW) / 2;

    if (ccImg) {
      const d = ccImg.scaleToFit(LOGO_H * 2.8, LOGO_H);
      page.drawImage(ccImg, { x: pairX, y: logoY + (LOGO_H - d.height) / 2,
        width: d.width, height: d.height });
    }
    if (iirImg) {
      const d = iirImg.scaleToFit(LOGO_H, LOGO_H);
      page.drawImage(iirImg, { x: pairX + ccW + GAP, y: logoY + (LOGO_H - d.height) / 2,
        width: d.width, height: d.height });
    }

    // Thin rule under logos
    let y = logoY - 16;
    page.drawRectangle({ x: ML, y, width: W - ML * 2, height: 0.8, color: dark, opacity: 0.6 });
    y -= 14;

    // Provider strap — dark text, no orange
    const strap = "CHAINSAW COURSES  |  IIRSM Approved Training Provider";
    page.drawText(strap, {
      x: cx(strap, 7.5, fBold, W), y,
      size: 7.5, font: fBold, color: mid,
    });
    y -= 24;

    // ── Title ─────────────────────────────────────────────────────────────────
    rule(y); y -= 28;

    const title = "CERTIFICATE OF COMPLETION";
    page.drawText(title, {
      x: cx(title, 19, fBold, W), y,
      size: 19, font: fBold, color: black,
    });
    y -= 14;

    rule(y); y -= 34;

    // ── "This is to certify that" ─────────────────────────────────────────────
    const certLine = "This is to certify that";
    page.drawText(certLine, {
      x: cx(certLine, 9.5, fItalic, W), y,
      size: 9.5, font: fItalic, color: mid,
    });
    y -= 50;

    // ── Student name ──────────────────────────────────────────────────────────
    page.drawText(user.fullName, {
      x: cx(user.fullName, 30, fBold, W), y,
      size: 30, font: fBold, color: black,
    });
    y -= 22;

    page.drawText(user.email, {
      x: cx(user.email, 8.5, fReg, W), y,
      size: 8.5, font: fReg, color: lgrey,
    });
    y -= 38;

    // ── Course ────────────────────────────────────────────────────────────────
    rule(y); y -= 28;

    const compLine = "has successfully completed the following IIRSM approved course:";
    page.drawText(compLine, {
      x: cx(compLine, 9, fItalic, W), y,
      size: 9, font: fItalic, color: mid,
    });
    y -= 40;

    const courseName = "Chainsaw Maintenance & Cross Cutting";
    page.drawText(courseName, {
      x: cx(courseName, 20, fBold, W), y,
      size: 20, font: fBold, color: black,
    });
    y -= 18;

    const courseSub = "Professional Training Course  \u00B7  Theory & Knowledge Assessment";
    page.drawText(courseSub, {
      x: cx(courseSub, 8.5, fReg, W), y,
      size: 8.5, font: fReg, color: lgrey,
    });
    y -= 42;

    // ── CPD block — centred, black text, no orange ────────────────────────────
    rule(y); y -= 24;

    const cpdLine1 = "CPD: 5 Verifiable Hours  |  IIRSM Approved Learning";
    page.drawText(cpdLine1, {
      x: cx(cpdLine1, 9, fBold, W), y,
      size: 9, font: fBold, color: black,
    });
    y -= 14;

    if (passedScore !== null) {
      const scoreLine = `Assessment Score: ${passedScore}%`;
      page.drawText(scoreLine, {
        x: cx(scoreLine, 8.5, fReg, W), y,
        size: 8.5, font: fReg, color: mid,
      });
      y -= 14;
    }

    const iirsmLine = "International Institute of Risk and Safety Management";
    page.drawText(iirsmLine, {
      x: cx(iirsmLine, 7.5, fItalic, W), y,
      size: 7.5, font: fItalic, color: lgrey,
    });
    y -= 36;

    // ── Date ──────────────────────────────────────────────────────────────────
    rule(y); y -= 22;

    const dateStr  = passedAt.toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
    const dateLine = `Date of Award:  ${dateStr}`;
    page.drawText(dateLine, {
      x: cx(dateLine, 9.5, fReg, W), y,
      size: 9.5, font: fReg, color: mid,
    });
    y -= 48;

    // ── Signature section ─────────────────────────────────────────────────────
    // Two zones: left (authorised signatory) and right (course director)
    const sigZoneW = 170;
    const sigZoneGap = W - ML * 2 - sigZoneW * 2;
    const sigL = ML;
    const sigR = ML + sigZoneW + sigZoneGap;
    const lineY = y;                // baseline for sig lines

    // Director signature image — above right line
    let sigImgH = 0;
    try {
      const sigBytes = fs.readFileSync(SIG_PATH);
      const sigImg   = await pdfDoc.embedPng(sigBytes);
      const maxW = sigZoneW - 10;
      const maxH = 46;
      const d    = sigImg.scaleToFit(maxW, maxH);
      sigImgH    = d.height;
      const imgX = sigR + (sigZoneW - d.width) / 2;
      const imgY = lineY + 6;
      page.drawImage(sigImg, { x: imgX, y: imgY, width: d.width, height: d.height });
    } catch { /* no sig image */ }

    // Sig lines
    page.drawRectangle({ x: sigL, y: lineY, width: sigZoneW, height: 0.7, color: lgrey });
    page.drawRectangle({ x: sigR, y: lineY, width: sigZoneW, height: 0.7, color: lgrey });

    // Labels below lines
    const lblStyle = { size: 7.5 as const, font: fReg, color: lgrey };
    const lbl1 = "Authorised Signatory";
    const lbl2 = "Course Director";
    page.drawText(lbl1, {
      x: sigL + (sigZoneW - fReg.widthOfTextAtSize(lbl1, 7.5)) / 2,
      y: lineY - 13, ...lblStyle,
    });
    page.drawText(lbl2, {
      x: sigR + (sigZoneW - fReg.widthOfTextAtSize(lbl2, 7.5)) / 2,
      y: lineY - 13, ...lblStyle,
    });

    // ── Cert reference ────────────────────────────────────────────────────────
    const ref = certRef(user.id, passedAt);
    page.drawText(`Certificate Ref: ${ref}`, {
      x: ML, y: 54,
      size: 7, font: fReg, color: lgrey,
    });

    // ── Footer — charcoal strip, no orange ───────────────────────────────────
    page.drawRectangle({ x: 0, y: 0, width: W, height: 38, color: dark });
    const footer = "chainsawcourses.co.uk  |  IIRSM Approved Training Provider";
    page.drawText(footer, {
      x: cx(footer, 8.5, fReg, W), y: 14,
      size: 8.5, font: fReg, color: white,
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
