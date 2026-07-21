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

    const orange = rgb(0.82, 0.38, 0.05);
    const black  = rgb(0.08, 0.08, 0.08);
    const dark   = rgb(0.15, 0.15, 0.15);
    const mid    = rgb(0.35, 0.35, 0.35);
    const lgrey  = rgb(0.60, 0.60, 0.60);
    const white  = rgb(1.00, 1.00, 1.00);

    // ── Background ────────────────────────────────────────────────────────────
    try {
      const bgBytes = fs.readFileSync(BG_PATH);
      const bgImg   = await pdfDoc.embedJpg(bgBytes);
      const scale   = Math.max(W / BG_W, H / BG_H);
      const drawW   = BG_W * scale;
      const drawH   = BG_H * scale;
      page.drawImage(bgImg, {
        x: (W - drawW) / 2, y: (H - drawH) / 2,
        width: drawW, height: drawH,
      });
    } catch { /* plain white */ }

    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: white, opacity: 0.90 });

    // ── Footer strip — charcoal, drawn before border so border sits on top ───
    page.drawRectangle({ x: 0, y: 0, width: W, height: 40, color: dark });
    const footer = "chainsawcourses.co.uk  |  IIRSM Approved Training Provider";
    page.drawText(footer, {
      x: cx(footer, 8.5, fReg, W), y: 15,
      size: 8.5, font: fReg, color: white,
    });

    // ── Margin / helpers ──────────────────────────────────────────────────────
    const ML = 52;   // left/right margin for content and rules

    function rule(y: number, opacity = 0.40) {
      page.drawRectangle({ x: ML, y, width: W - ML * 2, height: 0.6,
        color: lgrey, opacity });
    }

    // ── Logos — pinned near top ───────────────────────────────────────────────
    const LOGO_H = 70;
    const GAP    = 52;
    const logoY  = H - 58 - LOGO_H;   // top of logo zone

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

    // ── Flowing content — starts just below logos ─────────────────────────────
    let y = logoY - 18;

    // Rule under logos
    page.drawRectangle({ x: ML, y, width: W - ML * 2, height: 0.9,
      color: dark, opacity: 0.55 });
    y -= 16;

    // Provider strap
    const strap = "CHAINSAW COURSES  |  IIRSM Approved Training Provider";
    page.drawText(strap, {
      x: cx(strap, 7.5, fBold, W), y,
      size: 7.5, font: fBold, color: mid,
    });
    y -= 36;

    rule(y); y -= 36;

    // ── Certificate title ─────────────────────────────────────────────────────
    const title = "CERTIFICATE OF COMPLETION";
    page.drawText(title, {
      x: cx(title, 20, fBold, W), y,
      size: 20, font: fBold, color: black,
    });
    y -= 16;

    rule(y); y -= 44;

    // ── "This is to certify that" ─────────────────────────────────────────────
    const certLine = "This is to certify that";
    page.drawText(certLine, {
      x: cx(certLine, 10, fItalic, W), y,
      size: 10, font: fItalic, color: mid,
    });
    y -= 56;

    // ── Student name ──────────────────────────────────────────────────────────
    page.drawText(user.fullName, {
      x: cx(user.fullName, 32, fBold, W), y,
      size: 32, font: fBold, color: black,
    });
    y -= 26;

    page.drawText(user.email, {
      x: cx(user.email, 9, fReg, W), y,
      size: 9, font: fReg, color: lgrey,
    });
    y -= 48;

    // ── Course ────────────────────────────────────────────────────────────────
    rule(y); y -= 36;

    const compLine = "has successfully completed the following IIRSM approved course:";
    page.drawText(compLine, {
      x: cx(compLine, 9.5, fItalic, W), y,
      size: 9.5, font: fItalic, color: mid,
    });
    y -= 46;

    const courseName = "Chainsaw Maintenance & Cross Cutting";
    page.drawText(courseName, {
      x: cx(courseName, 21, fBold, W), y,
      size: 21, font: fBold, color: black,
    });
    y -= 20;

    const courseSub = "Professional Training Course  \u00B7  Theory & Knowledge Assessment";
    page.drawText(courseSub, {
      x: cx(courseSub, 9, fReg, W), y,
      size: 9, font: fReg, color: lgrey,
    });
    y -= 52;

    // ── CPD — centred, all black ──────────────────────────────────────────────
    rule(y); y -= 32;

    const cpdLine = "CPD: 5 Verifiable Hours  |  IIRSM Approved Learning";
    page.drawText(cpdLine, {
      x: cx(cpdLine, 9.5, fBold, W), y,
      size: 9.5, font: fBold, color: black,
    });
    y -= 18;

    if (passedScore !== null) {
      const scoreLine = `Assessment Score: ${passedScore}%`;
      page.drawText(scoreLine, {
        x: cx(scoreLine, 9, fReg, W), y,
        size: 9, font: fReg, color: mid,
      });
      y -= 18;
    }

    const iirsmLine = "International Institute of Risk and Safety Management";
    page.drawText(iirsmLine, {
      x: cx(iirsmLine, 8, fItalic, W), y,
      size: 8, font: fItalic, color: lgrey,
    });
    y -= 52;

    // ── Date ──────────────────────────────────────────────────────────────────
    rule(y); y -= 32;

    const dateStr  = passedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const dateLine = `Date of Award:  ${dateStr}`;
    page.drawText(dateLine, {
      x: cx(dateLine, 10, fReg, W), y,
      size: 10, font: fReg, color: mid,
    });

    // ── Signatures — PINNED near bottom, above footer ─────────────────────────
    // Fixed positions: sig line at y=128, labels at y=115, image above line
    const sigZoneW = 175;
    const sigL = ML;
    const sigR = W - ML - sigZoneW;
    const lineY = 128;

    // Director sig image above right line
    try {
      const sigBytes = fs.readFileSync(SIG_PATH);
      const sigImg   = await pdfDoc.embedPng(sigBytes);
      const d        = sigImg.scaleToFit(sigZoneW - 16, 52);
      page.drawImage(sigImg, {
        x: sigR + (sigZoneW - d.width) / 2,
        y: lineY + 8,
        width: d.width, height: d.height,
      });
    } catch { /* no sig */ }

    // Sig lines
    page.drawRectangle({ x: sigL, y: lineY, width: sigZoneW, height: 0.7, color: lgrey });
    page.drawRectangle({ x: sigR, y: lineY, width: sigZoneW, height: 0.7, color: lgrey });

    // Labels
    const lblStyle = { size: 7.5 as const, font: fReg, color: lgrey };
    const lbl1 = "Authorised Signatory";
    const lbl2 = "Course Director";
    page.drawText(lbl1, {
      x: sigL + (sigZoneW - fReg.widthOfTextAtSize(lbl1, 7.5)) / 2,
      y: lineY - 14, ...lblStyle,
    });
    page.drawText(lbl2, {
      x: sigR + (sigZoneW - fReg.widthOfTextAtSize(lbl2, 7.5)) / 2,
      y: lineY - 14, ...lblStyle,
    });

    // Cert ref — between sigs and footer
    const ref = certRef(user.id, passedAt);
    page.drawText(`Certificate Ref: ${ref}`, {
      x: cx(`Certificate Ref: ${ref}`, 7, fReg, W),
      y: 55,
      size: 7, font: fReg, color: lgrey,
    });

    // ── Orange border — drawn LAST so it appears over footer and everything ───
    page.drawRectangle({ x: 16, y: 16, width: W - 32, height: H - 32,
      borderColor: orange, borderWidth: 2.0 });
    page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48,
      borderColor: rgb(0.90, 0.60, 0.30), borderWidth: 0.6, opacity: 0.55 });

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
