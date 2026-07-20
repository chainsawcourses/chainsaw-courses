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
const PUBLIC       = path.resolve("../../artifacts/chainsaw-training/public");
const LOGO_PATH    = path.join(PUBLIC, "logo.png");
const IIRSM_PATH   = path.join(PUBLIC, "iirsm-logo.png");
const BG_PATH      = path.join(PUBLIC, "bg.jpg");

// bg.jpg native dimensions (5071 × 3021) — used for cover-crop maths
const BG_W = 5071;
const BG_H = 3021;

function cx(
  text: string,
  size: number,
  font: { widthOfTextAtSize(t: string, s: number): number },
  W: number,
) {
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

    // ─── Page ────────────────────────────────────────────────────────────────
    const pdfDoc = await PDFDocument.create();
    const W = 595, H = 842;          // A4 portrait
    const page = pdfDoc.addPage([W, H]);

    const fBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fReg    = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

    // Colours — dark text on white-washed background
    const orange  = rgb(0.82, 0.38, 0.05);
    const dark    = rgb(0.08, 0.08, 0.08);
    const mid     = rgb(0.35, 0.35, 0.35);
    const lgrey   = rgb(0.58, 0.58, 0.58);
    const white   = rgb(1.00, 1.00, 1.00);
    const navy    = rgb(0.09, 0.22, 0.50);   // IIRSM brand navy

    // ─── Background — cover-crop to fill page without squishing ──────────────
    try {
      const bgBytes = fs.readFileSync(BG_PATH);
      const bgImg   = await pdfDoc.embedJpg(bgBytes);

      // Scale to "cover": fill both dimensions, cropping the longer axis
      const scaleByW = W / BG_W;
      const scaleByH = H / BG_H;
      const scale    = Math.max(scaleByW, scaleByH);
      const drawW    = BG_W * scale;
      const drawH    = BG_H * scale;
      const drawX    = (W - drawW) / 2;   // centre horizontally
      const drawY    = (H - drawH) / 2;   // centre vertically

      page.drawImage(bgImg, { x: drawX, y: drawY, width: drawW, height: drawH });
    } catch { /* fallback: plain white */ }

    // White wash overlay — matches the app's rgba(255,255,255,0.88)
    page.drawRectangle({ x: 0, y: 0, width: W, height: H,
      color: white, opacity: 0.88 });

    // ─── Border ──────────────────────────────────────────────────────────────
    page.drawRectangle({ x: 20, y: 20, width: W - 40, height: H - 40,
      borderColor: orange, borderWidth: 1.6 });
    page.drawRectangle({ x: 28, y: 28, width: W - 56, height: H - 56,
      borderColor: rgb(0.75, 0.75, 0.75), borderWidth: 0.4 });

    // ─── Helper: thin rule ───────────────────────────────────────────────────
    function rule(y: number, col = lgrey, op = 0.5) {
      page.drawRectangle({ x: 52, y, width: W - 104, height: 0.6,
        color: col, opacity: op });
    }

    // ─── Logos ───────────────────────────────────────────────────────────────
    const LOGO_H = 72;
    const GAP    = 48;
    const logoY  = H - 52 - LOGO_H;       // bottom of logo row

    let ccImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null  = null;
    let iirImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
    let ccW = LOGO_H, iirW = LOGO_H;

    try {
      ccImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_PATH));
      ccW   = ccImg.scaleToFit(LOGO_H * 2.5, LOGO_H).width; // allow wider
    } catch { /* skip */ }

    try {
      iirImg = await pdfDoc.embedPng(fs.readFileSync(IIRSM_PATH));
      iirW   = iirImg.scaleToFit(LOGO_H, LOGO_H).width;
    } catch { /* skip */ }

    const pairW = ccW + GAP + iirW;
    const pairX = (W - pairW) / 2;

    if (ccImg) {
      const d = ccImg.scaleToFit(LOGO_H * 2.5, LOGO_H);
      page.drawImage(ccImg, { x: pairX, y: logoY + (LOGO_H - d.height) / 2,
        width: d.width, height: d.height });
    }
    if (iirImg) {
      const d = iirImg.scaleToFit(LOGO_H, LOGO_H);
      page.drawImage(iirImg, { x: pairX + ccW + GAP, y: logoY + (LOGO_H - d.height) / 2,
        width: d.width, height: d.height });
    }

    // Orange rule under logos
    let y = logoY - 14;
    page.drawRectangle({ x: 52, y, width: W - 104, height: 1.2, color: orange });
    y -= 16;

    // Provider strap
    const strap = "CHAINSAW COURSES  |  IIRSM Approved Training Provider";
    page.drawText(strap, {
      x: cx(strap, 7.5, fBold, W), y,
      size: 7.5, font: fBold, color: orange,
    });
    y -= 18;

    // ─── Title ───────────────────────────────────────────────────────────────
    rule(y); y -= 20;

    const title = "CERTIFICATE OF COMPLETION";
    page.drawText(title, {
      x: cx(title, 18, fBold, W), y,
      size: 18, font: fBold, color: dark,
    });
    y -= 12;

    rule(y); y -= 26;

    // ─── "This is to certify that" ───────────────────────────────────────────
    const certLine = "This is to certify that";
    page.drawText(certLine, {
      x: cx(certLine, 9.5, fItalic, W), y,
      size: 9.5, font: fItalic, color: mid,
    });
    y -= 44;

    // ─── Student name ────────────────────────────────────────────────────────
    page.drawText(user.fullName, {
      x: cx(user.fullName, 28, fBold, W), y,
      size: 28, font: fBold, color: dark,
    });
    y -= 20;

    page.drawText(user.email, {
      x: cx(user.email, 8.5, fReg, W), y,
      size: 8.5, font: fReg, color: lgrey,
    });
    y -= 30;

    // ─── Course ──────────────────────────────────────────────────────────────
    rule(y); y -= 20;

    const compLine = "has successfully completed the following IIRSM approved course:";
    page.drawText(compLine, {
      x: cx(compLine, 9, fItalic, W), y,
      size: 9, font: fItalic, color: mid,
    });
    y -= 34;

    const courseName = "Chainsaw Maintenance & Cross Cutting";
    page.drawText(courseName, {
      x: cx(courseName, 20, fBold, W), y,
      size: 20, font: fBold, color: dark,
    });
    y -= 17;

    const courseSub = "Professional Training Course  \u00B7  Theory & Knowledge Assessment";
    page.drawText(courseSub, {
      x: cx(courseSub, 8.5, fReg, W), y,
      size: 8.5, font: fReg, color: lgrey,
    });
    y -= 28;

    // ─── CPD band ────────────────────────────────────────────────────────────
    const bx = 52, bw = W - 104, bh = 26;
    page.drawRectangle({ x: bx, y: y - 4, width: bw, height: bh,
      color: rgb(0.98, 0.96, 0.94),
      borderColor: orange, borderWidth: 0.8 });

    const cpdText   = "CPD: 5 Verifiable Hours  |  IIRSM Approved Learning";
    const scoreText = passedScore !== null ? `Score: ${passedScore}%` : "";
    page.drawText(cpdText,
      { x: bx + 12, y: y + 5, size: 8, font: fBold, color: orange });
    if (scoreText) {
      page.drawText(scoreText, {
        x: bx + bw - 12 - fBold.widthOfTextAtSize(scoreText, 8), y: y + 5,
        size: 8, font: fBold, color: navy,
      });
    }
    y -= 42;

    // ─── Date ────────────────────────────────────────────────────────────────
    rule(y); y -= 18;

    const dateStr  = passedAt.toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
    const dateLine = `Awarded: ${dateStr}`;
    page.drawText(dateLine, {
      x: cx(dateLine, 9.5, fReg, W), y,
      size: 9.5, font: fReg, color: mid,
    });
    y -= 42;

    // ─── Signature lines ─────────────────────────────────────────────────────
    const lineLen = 155;
    const sigGap  = 60;
    const sigPair = lineLen * 2 + sigGap;
    const sigL    = (W - sigPair) / 2;
    const sigR    = sigL + lineLen + sigGap;

    page.drawRectangle({ x: sigL, y, width: lineLen, height: 0.7, color: lgrey });
    page.drawRectangle({ x: sigR, y, width: lineLen, height: 0.7, color: lgrey });

    const lbl = (label: string, baseX: number) => ({
      x: baseX + (lineLen - fReg.widthOfTextAtSize(label, 7.5)) / 2,
      y: y - 13, size: 7.5 as const, font: fReg, color: lgrey,
    });
    page.drawText("Authorised Signatory", lbl("Authorised Signatory", sigL));
    page.drawText("Course Director",      lbl("Course Director",      sigR));

    // ─── Reference line ──────────────────────────────────────────────────────
    const ref = certRef(user.id, passedAt);
    page.drawText(`Certificate Ref: ${ref}`,
      { x: 52, y: 50, size: 7, font: fReg, color: lgrey });

    const iirAttr = "International Institute of Risk and Safety Management";
    page.drawText(iirAttr, {
      x: W - 52 - fReg.widthOfTextAtSize(iirAttr, 7),
      y: 50, size: 7, font: fReg, color: navy,
    });

    // ─── Footer strip ────────────────────────────────────────────────────────
    page.drawRectangle({ x: 0, y: 0, width: W, height: 33, color: orange });
    const footer = "chainsawcourses.co.uk  |  IIRSM Approved Training Provider";
    page.drawText(footer, {
      x: cx(footer, 8.5, fReg, W), y: 11,
      size: 8.5, font: fReg, color: white,
    });

    // ─── Send ────────────────────────────────────────────────────────────────
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
