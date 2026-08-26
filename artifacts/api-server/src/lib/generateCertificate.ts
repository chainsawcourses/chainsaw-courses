import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { CERTIFICATE_LAYOUT } from "./certificateLayout";

// Resolve public asset dir from either the workspace root (production) or
// from artifacts/api-server/ (dev via pnpm).  Try both and use whichever exists.
const _candidates = [
  path.resolve("artifacts/chainsaw-training/public"),        // production: CWD = workspace root
  path.resolve("../../artifacts/chainsaw-training/public"),  // dev:        CWD = artifacts/api-server/
];
const PUBLIC = _candidates.find(p => { try { return fs.statSync(p).isDirectory(); } catch { return false; } }) ?? _candidates[0];

const LOGO_PATH  = path.join(PUBLIC, "logo-transparent.png");
const IIRSM_PATH = path.join(PUBLIC, "iirsm-horizontal-logo-transparent.png");
const IIRSM_ROSETTE_PATH = path.join(PUBLIC, "iirsm-rosette-logo-transparent.png");
const BG_PATH    = path.join(PUBLIC, "bg.jpg");
const SIG_PATH   = path.join(PUBLIC, "signature_director.png");

const BG_W = 5071;
const BG_H = 3021;

function cx(text: string, size: number, font: { widthOfTextAtSize(t: string, s: number): number }, W: number) {
  return (W - font.widthOfTextAtSize(text, size)) / 2;
}

export function certRef(userId: number, date: Date): string {
  const hash = crypto
    .createHash("md5")
    .update(`${userId}-${date.getFullYear()}`)
    .digest("hex")
    .toUpperCase()
    .slice(0, 6);
  return `CC/${date.getFullYear()}/${String(userId).padStart(4, "0")}/${hash}`;
}

export interface CertUser {
  id: number;
  fullName: string;
  email: string;
}

export async function generateCertificatePdf(
  user: CertUser,
  passedAt: Date,
  passedScore: number | null,
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const W = 595, H = 842;
  const page = pdfDoc.addPage([W, H]);

  const fBold   = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fReg    = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const orange = rgb(0.82, 0.38, 0.05);
  const black  = rgb(0.08, 0.08, 0.08);
  const mid    = rgb(0.35, 0.35, 0.35);
  const lgrey  = rgb(0.58, 0.58, 0.58);
  const silver = rgb(0.78, 0.78, 0.78);
  const dark   = rgb(0.20, 0.20, 0.20);
  const white  = rgb(1.00, 1.00, 1.00);

  const BI = 14;
  const BW = 2.2;
  const ML = 52;

  try {
    const bgBytes = fs.readFileSync(BG_PATH);
    const bgImg   = await pdfDoc.embedJpg(bgBytes);
    const scale   = Math.max(W / BG_W, H / BG_H);
    const dw = BG_W * scale, dh = BG_H * scale;
    page.drawImage(bgImg, { x: (W - dw) / 2, y: (H - dh) / 2, width: dw, height: dh });
  } catch { /* white page */ }
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: white, opacity: 0.92 });

  function rule(y: number, opacity = 0.38) {
    page.drawRectangle({ x: ML, y, width: W - ML * 2, height: 0.6, color: lgrey, opacity });
  }

  // ── BOTTOM ZONE ───────────────────────────────────────────────────────────
  page.drawRectangle({ x: ML, y: 44, width: W - ML * 2, height: 0.5, color: silver, opacity: 0.6 });
  const footerTxt = "chainsawcourses.com  |  IIRSM Approved Course";
  page.drawText(footerTxt, { x: cx(footerTxt, 7.5, fReg, W), y: 30, size: 7.5, font: fReg, color: lgrey });

  const ref    = certRef(user.id, passedAt);
  const refStr = `Certificate Ref: ${ref}`;
  page.drawText(refStr, { x: cx(refStr, 7, fReg, W), y: 58, size: 7, font: fReg, color: lgrey });

  const SIG_LINE_Y  = 140;
  const SIG_IMAGE_Y = SIG_LINE_Y + 4;
  const SIG_MAX_H   = 42;
  const SIG_LABEL_Y = SIG_LINE_Y - 16;
  const sigZoneW    = 190;
  const sigX        = (W - sigZoneW) / 2;

  try {
    const sigBytes = fs.readFileSync(SIG_PATH);
    const sigImg   = await pdfDoc.embedPng(sigBytes);
    const d        = sigImg.scaleToFit(sigZoneW - 20, SIG_MAX_H);
    page.drawImage(sigImg, { x: (W - d.width) / 2, y: SIG_IMAGE_Y, width: d.width, height: d.height });
  } catch { /* no sig */ }

  page.drawRectangle({ x: sigX, y: SIG_LINE_Y, width: sigZoneW, height: 0.8, color: lgrey });

  const lbl = "Course Director";
  page.drawText(lbl, { x: cx(lbl, 7.5, fReg, W), y: SIG_LABEL_Y, size: 7.5, font: fReg, color: lgrey });

  try {
    const iirBottomBytes = fs.readFileSync(IIRSM_PATH);
    const iirBottomImg   = await pdfDoc.embedPng(iirBottomBytes);
    const d               = iirBottomImg.scaleToFit(116, 48);
    page.drawImage(iirBottomImg, { x: (W - d.width) / 2, y: 72, width: d.width, height: d.height });
  } catch { /* no approval mark */ }

  // ── MAIN CONTENT ZONE ─────────────────────────────────────────────────────
  const dateStr  = passedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const dateLine = `Date of Award:  ${dateStr}`;
  page.drawText(dateLine, { x: cx(dateLine, 10, fReg, W), y: 230, size: 10, font: fReg, color: mid });

  const validityLine = "It is recommended to refresh your certificate every 3-5 years";
  page.drawText(validityLine, { x: cx(validityLine, 8, fItalic, W), y: 212, size: 8, font: fItalic, color: lgrey });

  rule(249, 0.28);

  const glhLine = "Guided Learning Hours: 4  \u00B7  CPD: 5 Verifiable CPD Points  \u00B7  IIRSM Approved Course";
  page.drawText(glhLine, { x: cx(glhLine, 9.5, fBold, W), y: 326, size: 9.5, font: fBold, color: black });

  const unitLine = "Unit Ref: 0039-20  \u00B7  Module Quizzes: 100%  \u00B7  Final Exam Pass Mark: 80%";
  page.drawText(unitLine, { x: cx(unitLine, 8.5, fReg, W), y: 307, size: 8.5, font: fReg, color: mid });

  const courseVersion = "Course Version 1.1 \u00B7 July 2026";
  if (passedScore !== null) {
    const scoreLine = `Assessment Score: ${passedScore}%  \u00B7  ${courseVersion}`;
    page.drawText(scoreLine, { x: cx(scoreLine, 9, fReg, W), y: 288, size: 9, font: fReg, color: mid });
  } else {
    page.drawText(courseVersion, { x: cx(courseVersion, 9, fReg, W), y: 288, size: 9, font: fReg, color: mid });
  }

  page.drawText("International Institute of Risk and Safety Management", {
    x: cx("International Institute of Risk and Safety Management", 8.5, fItalic, W),
    y: 269, size: 8.5, font: fItalic, color: lgrey,
  });

  let ccImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  try {
    ccImg = await pdfDoc.embedPng(fs.readFileSync(LOGO_PATH));
    const d = ccImg.scaleToFit(CERTIFICATE_LAYOUT.chainsawLogo.maxWidth, CERTIFICATE_LAYOUT.chainsawLogo.height);
    page.drawImage(ccImg, {
      x: (W - d.width) / 2,
      y: CERTIFICATE_LAYOUT.chainsawLogo.bottom,
      width: d.width,
      height: d.height,
    });
  } catch { /* no Chainsaw Courses mark */ }

  page.drawText("Chainsaw Maintenance & Cross Cutting", {
    x: cx("Chainsaw Maintenance & Cross Cutting", 22, fBold, W),
    y: CERTIFICATE_LAYOUT.courseTitle.bottom, size: 22, font: fBold, color: black,
  });
  page.drawText("Professional Training Course  \u00B7  Theory & Knowledge Assessment", {
    x: cx("Professional Training Course  \u00B7  Theory & Knowledge Assessment", 9, fReg, W),
    y: 364, size: 9, font: fReg, color: lgrey,
  });

  page.drawText("CERTIFICATE OF COMPLETION", {
    x: cx("CERTIFICATE OF COMPLETION", 20, fBold, W),
    y: 650, size: 20, font: fBold, color: black,
  });

  page.drawText("This is to certify that", { x: cx("This is to certify that", 10, fItalic, W), y: 615, size: 10, font: fItalic, color: mid });
  page.drawText(user.fullName, { x: cx(user.fullName, 34, fBold, W), y: 570, size: 34, font: fBold, color: black });
  page.drawText(user.email, { x: cx(user.email, 9.5, fReg, W), y: 540, size: 9.5, font: fReg, color: lgrey });
  page.drawText("has successfully completed the following IIRSM Approved Course:", {
    x: cx("has successfully completed the following IIRSM Approved Course:", 9.5, fItalic, W),
    y: CERTIFICATE_LAYOUT.completionSentence.bottom, size: 9.5, font: fItalic, color: mid,
  });

  // ── HEADER ─────────────────────────────────────────────────────────────────
  const header = "CHAINSAW COURSES  |  IIRSM Approved Course";
  page.drawText(header, { x: cx(header, 11, fBold, W), y: 804, size: 11, font: fBold, color: mid });
  page.drawRectangle({ x: ML, y: 786, width: W - ML * 2, height: 0.8, color: dark, opacity: 0.45 });

  try {
    const iirHeaderBytes = fs.readFileSync(IIRSM_ROSETTE_PATH);
    const iirHeaderImg   = await pdfDoc.embedPng(iirHeaderBytes);
    const d               = iirHeaderImg.scaleToFit(72, 72);
    page.drawImage(iirHeaderImg, { x: (W - d.width) / 2, y: 700, width: d.width, height: d.height });
  } catch { /* no approval mark */ }

  // ── BORDER ────────────────────────────────────────────────────────────────
  page.drawRectangle({ x: BI, y: BI, width: W - BI * 2, height: H - BI * 2, borderColor: orange, borderWidth: BW });
  page.drawRectangle({ x: BI + 7, y: BI + 7, width: W - (BI + 7) * 2, height: H - (BI + 7) * 2, borderColor: silver, borderWidth: 0.5 });

  return pdfDoc.save();
}
