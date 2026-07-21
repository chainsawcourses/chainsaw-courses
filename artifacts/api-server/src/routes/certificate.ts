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
    const silver = rgb(0.80, 0.80, 0.80);
    const white  = rgb(1.00, 1.00, 1.00);

    const ML = 52;   // left / right margin

    // ── Background ────────────────────────────────────────────────────────────
    try {
      const bgBytes = fs.readFileSync(BG_PATH);
      const bgImg   = await pdfDoc.embedJpg(bgBytes);
      const scale   = Math.max(W / BG_W, H / BG_H);
      const drawW   = BG_W * scale, drawH = BG_H * scale;
      page.drawImage(bgImg, {
        x: (W - drawW) / 2, y: (H - drawH) / 2,
        width: drawW, height: drawH,
      });
    } catch { /* white fallback */ }

    // White wash over background
    page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: white, opacity: 0.91 });

    // ── Helpers ───────────────────────────────────────────────────────────────
    function rule(y: number, opacity = 0.40) {
      page.drawRectangle({ x: ML, y, width: W - ML * 2, height: 0.6, color: lgrey, opacity });
    }

    // ──────────────────────────────────────────────────────────────────────────
    //  FIXED LAYOUT  (all y values are baseline positions, measured from page bottom)
    //  Page height = 842. y=0 = bottom, y=842 = top.
    // ──────────────────────────────────────────────────────────────────────────

    // ── LOGOS (top section) ───────────────────────────────────────────────────
    const LOGO_H = 70;
    const logoBottom = 742;           // logos sit near the top
    const logoGap    = 52;

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

    const pairW = ccW + logoGap + iirW;
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
        x: pairX + ccW + logoGap, y: logoBottom + (LOGO_H - d.height) / 2,
        width: d.width, height: d.height,
      });
    }

    // Rule under logos
    page.drawRectangle({ x: ML, y: 730, width: W - ML * 2, height: 0.9, color: dark, opacity: 0.5 });

    // Provider strap
    const strap = "CHAINSAW COURSES  |  IIRSM Approved Training Provider";
    page.drawText(strap, { x: cx(strap, 7.5, fBold, W), y: 716, size: 7.5, font: fBold, color: mid });

    // ── TITLE BAND ────────────────────────────────────────────────────────────
    rule(694);
    page.drawText("CERTIFICATE OF COMPLETION", {
      x: cx("CERTIFICATE OF COMPLETION", 20, fBold, W),
      y: 666, size: 20, font: fBold, color: black,
    });
    rule(648);

    // ── CERTIFY LINE ──────────────────────────────────────────────────────────
    page.drawText("This is to certify that", {
      x: cx("This is to certify that", 10, fItalic, W),
      y: 620, size: 10, font: fItalic, color: mid,
    });

    // ── STUDENT NAME ──────────────────────────────────────────────────────────
    page.drawText(user.fullName, {
      x: cx(user.fullName, 32, fBold, W),
      y: 574, size: 32, font: fBold, color: black,
    });
    page.drawText(user.email, {
      x: cx(user.email, 9, fReg, W),
      y: 546, size: 9, font: fReg, color: lgrey,
    });

    // ── COURSE ────────────────────────────────────────────────────────────────
    rule(516);
    page.drawText("has successfully completed the following IIRSM approved course:", {
      x: cx("has successfully completed the following IIRSM approved course:", 9.5, fItalic, W),
      y: 492, size: 9.5, font: fItalic, color: mid,
    });
    page.drawText("Chainsaw Maintenance & Cross Cutting", {
      x: cx("Chainsaw Maintenance & Cross Cutting", 21, fBold, W),
      y: 452, size: 21, font: fBold, color: black,
    });
    page.drawText("Professional Training Course  \u00B7  Theory & Knowledge Assessment", {
      x: cx("Professional Training Course  \u00B7  Theory & Knowledge Assessment", 9, fReg, W),
      y: 428, size: 9, font: fReg, color: lgrey,
    });

    // ── CPD BLOCK ─────────────────────────────────────────────────────────────
    rule(400);
    page.drawText("CPD: 5 Verifiable Hours  |  IIRSM Approved Learning", {
      x: cx("CPD: 5 Verifiable Hours  |  IIRSM Approved Learning", 9.5, fBold, W),
      y: 378, size: 9.5, font: fBold, color: black,
    });
    let cpdBaseY = 360;
    if (passedScore !== null) {
      const scoreLine = `Assessment Score: ${passedScore}%`;
      page.drawText(scoreLine, {
        x: cx(scoreLine, 9, fReg, W),
        y: cpdBaseY, size: 9, font: fReg, color: mid,
      });
      cpdBaseY -= 18;
    }
    page.drawText("International Institute of Risk and Safety Management", {
      x: cx("International Institute of Risk and Safety Management", 8, fItalic, W),
      y: cpdBaseY, size: 8, font: fItalic, color: lgrey,
    });

    // ── DATE ──────────────────────────────────────────────────────────────────
    rule(316);
    const dateStr  = passedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const dateLine = `Date of Award:  ${dateStr}`;
    page.drawText(dateLine, {
      x: cx(dateLine, 10, fReg, W),
      y: 294, size: 10, font: fReg, color: mid,
    });

    // ── SIGNATURES — fixed at bottom, completely separate from flowing content ─
    //  Sig line at y=200. Labels at y=186. Image immediately above line (y=208–248).
    const sigZoneW = 175;
    const sigL = ML;
    const sigR = W - ML - sigZoneW;
    const SIG_LINE_Y   = 200;   // the horizontal rule under each sig
    const SIG_IMAGE_Y  = SIG_LINE_Y + 10;   // image sits just above the line
    const SIG_LABEL_Y  = SIG_LINE_Y - 16;   // label sits just below the line

    // Director signature image above right sig line
    try {
      const sigBytes = fs.readFileSync(SIG_PATH);
      const sigImg   = await pdfDoc.embedPng(sigBytes);
      const d        = sigImg.scaleToFit(sigZoneW - 20, 44);
      page.drawImage(sigImg, {
        x: sigR + (sigZoneW - d.width) / 2,
        y: SIG_IMAGE_Y,
        width: d.width, height: d.height,
      });
    } catch { /* no sig */ }

    // Sig lines
    page.drawRectangle({ x: sigL, y: SIG_LINE_Y, width: sigZoneW, height: 0.8, color: lgrey });
    page.drawRectangle({ x: sigR, y: SIG_LINE_Y, width: sigZoneW, height: 0.8, color: lgrey });

    // Labels under sig lines
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

    // ── CERT REFERENCE ────────────────────────────────────────────────────────
    const ref = certRef(user.id, passedAt);
    const refStr = `Certificate Ref: ${ref}`;
    page.drawText(refStr, {
      x: cx(refStr, 7, fReg, W),
      y: 58, size: 7, font: fReg, color: lgrey,
    });

    // ── FOOTER — charcoal strip ───────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 0, width: W, height: 42, color: dark });
    const footer = "chainsawcourses.co.uk  |  IIRSM Approved Training Provider";
    page.drawText(footer, {
      x: cx(footer, 8.5, fReg, W), y: 16,
      size: 8.5, font: fReg, color: white,
    });

    // ── ORANGE BORDER — drawn last so it sits on top of footer strip ──────────
    page.drawRectangle({ x: 16, y: 16, width: W - 32, height: H - 32,
      borderColor: orange, borderWidth: 2.2 });
    page.drawRectangle({ x: 24, y: 24, width: W - 48, height: H - 48,
      borderColor: silver, borderWidth: 0.6, opacity: 0.45 });

    // ── SEND ──────────────────────────────────────────────────────────────────
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
