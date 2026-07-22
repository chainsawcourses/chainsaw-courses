import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";

const PW = 595;
const PH = 842;
const ML = 52;
const MR = 52;
const MT = 72;
const MB = 52;
const CW = PW - ML - MR;

const ORANGE = rgb(0.851, 0.361, 0.024);
const BLACK  = rgb(0.1,  0.1,  0.1);
const GREY   = rgb(0.4,  0.4,  0.4);
const LGREY  = rgb(0.92, 0.92, 0.92);

function wrap(text: string, font: PDFFont, size: number, maxW: number): string[] {
  const lines: string[] = [];
  const paragraphs = text.split("\n");
  for (const para of paragraphs) {
    const words = para.split(" ").filter(Boolean);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    if (para === "") lines.push("");
  }
  return lines;
}

interface Ctx {
  doc: PDFDocument;
  bold: PDFFont;
  reg: PDFFont;
  pages: PDFPage[];
  page: PDFPage;
  y: number;
}

function newPage(ctx: Ctx): void {
  const p = ctx.doc.addPage([PW, PH]);
  ctx.pages.push(p);
  ctx.page = p;
  ctx.y = PH - MT;
  drawPageHeader(ctx);
}

function ensureSpace(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < MB + 20) newPage(ctx);
}

function drawPageHeader(ctx: Ctx): void {
  const p = ctx.page;
  p.drawLine({ start: { x: ML, y: PH - MT + 14 }, end: { x: PW - MR, y: PH - MT + 14 }, thickness: 0.5, color: LGREY });
  p.drawText("CHAINSAW COURSES — PRIVACY POLICY", {
    x: ML, y: PH - MT + 4, size: 7, font: ctx.reg, color: GREY,
  });
  p.drawText("chainsawcourses.com", {
    x: PW - MR - ctx.reg.widthOfTextAtSize("chainsawcourses.com", 7),
    y: PH - MT + 4, size: 7, font: ctx.reg, color: GREY,
  });
}

function drawFooters(ctx: Ctx): void {
  ctx.pages.forEach((p, i) => {
    p.drawLine({ start: { x: ML, y: MB - 4 }, end: { x: PW - MR, y: MB - 4 }, thickness: 0.5, color: LGREY });
    p.drawText("This document is for personal reference only and must not be altered.", {
      x: ML, y: MB - 16, size: 6.5, font: ctx.reg, color: GREY,
    });
    const pg = `Page ${i + 1} of ${ctx.pages.length}`;
    p.drawText(pg, {
      x: PW - MR - ctx.reg.widthOfTextAtSize(pg, 6.5),
      y: MB - 16, size: 6.5, font: ctx.reg, color: GREY,
    });
  });
}

function heading(ctx: Ctx, text: string): void {
  ensureSpace(ctx, 28);
  ctx.y -= 10;
  ctx.page.drawText(text.toUpperCase(), {
    x: ML, y: ctx.y, size: 7.5, font: ctx.bold, color: ORANGE,
  });
  ctx.y -= 4;
  ctx.page.drawLine({ start: { x: ML, y: ctx.y }, end: { x: PW - MR, y: ctx.y }, thickness: 0.4, color: ORANGE });
  ctx.y -= 10;
}

function body(ctx: Ctx, text: string, size = 8.5, indent = 0): void {
  const lines = wrap(text, ctx.reg, size, CW - indent);
  for (const line of lines) {
    ensureSpace(ctx, size + 3);
    ctx.page.drawText(line, { x: ML + indent, y: ctx.y, size, font: ctx.reg, color: BLACK });
    ctx.y -= size + 3.2;
  }
}

function boldLine(ctx: Ctx, text: string, size = 8.5): void {
  ensureSpace(ctx, size + 3);
  ctx.page.drawText(text, { x: ML, y: ctx.y, size, font: ctx.bold, color: BLACK });
  ctx.y -= size + 3.2;
}

function bullet(ctx: Ctx, text: string, size = 8.5): void {
  ensureSpace(ctx, size + 3);
  ctx.page.drawText("•", { x: ML + 4, y: ctx.y, size, font: ctx.bold, color: ORANGE });
  const lines = wrap(text, ctx.reg, size, CW - 16);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) { ensureSpace(ctx, size + 3); }
    ctx.page.drawText(lines[i], { x: ML + 16, y: ctx.y, size, font: ctx.reg, color: BLACK });
    ctx.y -= size + 3.2;
  }
}

function tableRow(ctx: Ctx, cols: string[], widths: number[], isHeader: boolean): void {
  const size = 7.5;
  const cellLines = cols.map((c, i) => wrap(c, isHeader ? ctx.bold : ctx.reg, size, widths[i] - 8));
  const rowH = Math.max(...cellLines.map(l => l.length)) * (size + 3) + 8;
  ensureSpace(ctx, rowH + 2);
  const rowTop = ctx.y + size;
  let x = ML;
  const rowBg = isHeader ? LGREY : undefined;
  if (rowBg) {
    ctx.page.drawRectangle({ x: ML, y: ctx.y - rowH + size + 2, width: CW, height: rowH, color: rowBg });
  }
  ctx.page.drawRectangle({ x: ML, y: ctx.y - rowH + size + 2, width: CW, height: rowH, borderColor: rgb(0.82, 0.82, 0.82), borderWidth: 0.5 });
  for (let ci = 0; ci < cols.length; ci++) {
    let cellY = rowTop - 3;
    for (const line of cellLines[ci]) {
      ctx.page.drawText(line, { x: x + 4, y: cellY - size, size, font: isHeader ? ctx.bold : ctx.reg, color: BLACK });
      cellY -= size + 3;
    }
    if (ci < cols.length - 1) {
      ctx.page.drawLine({ start: { x: x + widths[ci], y: rowTop + 1 }, end: { x: x + widths[ci], y: rowTop - rowH + 1 }, thickness: 0.4, color: rgb(0.82, 0.82, 0.82) });
    }
    x += widths[ci];
  }
  ctx.y -= rowH;
}

function gap(ctx: Ctx, n = 6): void { ctx.y -= n; }

export async function generatePrivacyPolicyPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg  = await doc.embedFont(StandardFonts.Helvetica);

  const firstPage = doc.addPage([PW, PH]);
  const ctx: Ctx = { doc, bold, reg, pages: [firstPage], page: firstPage, y: PH - MT };
  drawPageHeader(ctx);

  // ── Cover ──────────────────────────────────────────────────────────────────
  ctx.y -= 10;
  const title = "PRIVACY POLICY";
  const titleW = bold.widthOfTextAtSize(title, 20);
  ctx.page.drawText(title, { x: (PW - titleW) / 2, y: ctx.y, size: 20, font: bold, color: ORANGE });
  ctx.y -= 26;
  const sub = "Chainsaw Courses — Vocational Safety Training Platform";
  ctx.page.drawText(sub, { x: (PW - reg.widthOfTextAtSize(sub, 9)) / 2, y: ctx.y, size: 9, font: reg, color: GREY });
  ctx.y -= 14;
  const ver = "Last updated: July 2025  |  Version 1.0";
  ctx.page.drawText(ver, { x: (PW - reg.widthOfTextAtSize(ver, 8)) / 2, y: ctx.y, size: 8, font: reg, color: GREY });
  ctx.y -= 16;
  ctx.page.drawLine({ start: { x: ML, y: ctx.y }, end: { x: PW - MR, y: ctx.y }, thickness: 1, color: ORANGE });
  ctx.y -= 20;

  // ── 1. Who We Are ──────────────────────────────────────────────────────────
  heading(ctx, "1. Who We Are (Data Controller)");
  body(ctx, "The data controller for this platform is Chainsaw Courses, the operator of the vocational chainsaw safety training service available at chainsawcourses.com.");
  gap(ctx, 5);
  body(ctx, "Contact: info@chainsawcourses.com");
  body(ctx, "Postal address: [YOUR BUSINESS ADDRESS — update before publishing]");
  gap(ctx, 5);
  body(ctx, "If you have questions about how your data is handled, or wish to exercise any of your rights under UK GDPR, please contact us using the details above.", 8, 0);

  // ── 2. What Data We Collect ────────────────────────────────────────────────
  gap(ctx, 4);
  heading(ctx, "2. What Data We Collect and Why");
  const tw2 = [CW * 0.30, CW * 0.42, CW * 0.28];
  tableRow(ctx, ["Data", "Purpose", "Lawful Basis"], tw2, true);
  tableRow(ctx, ["Full name & email address", "Identify the licensed learner; personalise the training experience; embed dynamic watermark on course videos", "Contract performance (Art. 6(1)(b) UK GDPR)"], tw2, false);
  tableRow(ctx, ["Activation code", "Verify a valid purchase has been made; prevent unauthorised sharing of access credentials", "Contract performance"], tw2, false);
  tableRow(ctx, ["Device identifier", "Bond access to a single device (platform security; prevention of credential sharing)", "Legitimate interests (Art. 6(1)(f)) — protecting the integrity of a paid vocational qualification"], tw2, false);
  tableRow(ctx, ["Video watch progress & timestamps", "Enable resume-on-return; enforce sequential module unlocking; verify completion", "Contract performance"], tw2, false);
  tableRow(ctx, ["Quiz & exam scores", "Assess competency; gate module progression at the required 80% pass threshold", "Contract performance"], tw2, false);
  tableRow(ctx, ["Digital waiver signature", "Record informed consent to safety terms prior to accessing chainsaw operating instruction", "Legal obligation / legitimate interests"], tw2, false);
  tableRow(ctx, ["Inspection checklist records", "Provide a personal chainsaw pre-use safety log; support duty-of-care records for employers", "Legitimate interests; legal obligation (PUWER, LOLER)"], tw2, false);
  tableRow(ctx, ["Risk assessment records", "Provide a personal dynamic risk assessment log for chainsaw operations; support statutory compliance", "Legitimate interests; legal obligation (Management of Health & Safety at Work Regulations 1999)"], tw2, false);
  tableRow(ctx, ["AI chat / mock-test messages", "Facilitate AI-assisted exam preparation; improve AI response quality", "Contract performance / legitimate interests"], tw2, false);
  tableRow(ctx, ["Module feedback ratings", "Improve course content quality", "Legitimate interests"], tw2, false);

  // ── 3. Professional Standards ──────────────────────────────────────────────
  gap(ctx, 4);
  heading(ctx, "3. Professional Standards Context");
  body(ctx, "This platform delivers vocational chainsaw safety training aligned with the standards and assessment frameworks recognised by the International Institute of Risk and Safety Management (IIRSM), the Forestry Commission, and the Arboricultural Association. Chainsaw operation is a notifiable hazardous activity under UK health and safety law; maintaining accurate training records is a statutory requirement for both the individual operator and their employer.");
  gap(ctx, 5);
  body(ctx, "Accordingly, your training record may form part of your personal evidence of competence and/or your employer's statutory duty-of-care records under:");
  gap(ctx, 3);
  bullet(ctx, "Health and Safety at Work etc. Act 1974");
  bullet(ctx, "Management of Health and Safety at Work Regulations 1999");
  bullet(ctx, "Provision and Use of Work Equipment Regulations 1998 (PUWER)");
  bullet(ctx, "Lifting Operations and Lifting Equipment Regulations 1998 (LOLER)");
  bullet(ctx, "Forestry Commission & HSE chainsaw competency guidance");

  // ── 4. Data Retention ─────────────────────────────────────────────────────
  gap(ctx, 4);
  heading(ctx, "4. Data Retention");
  body(ctx, "We retain your personal training record for 3 years from the date of your last platform activity, or such longer period as may be required by applicable health and safety legislation. This retention period reflects the vocational nature of the training and supports ongoing employer and regulatory audit requirements.");
  gap(ctx, 5);
  body(ctx, "After the retention period, all personal data is securely deleted or anonymised.");

  // ── 5. Your Rights ────────────────────────────────────────────────────────
  gap(ctx, 4);
  heading(ctx, "5. Your Rights Under UK GDPR");
  body(ctx, "You have the following rights in relation to your personal data:");
  gap(ctx, 4);
  bullet(ctx, "Right of access — request a copy of the personal data we hold about you");
  bullet(ctx, "Right to rectification — ask us to correct inaccurate data");
  bullet(ctx, "Right to erasure — ask us to delete your personal data (subject to the retention obligations in section 4)");
  bullet(ctx, "Right to restriction — ask us to restrict processing in certain circumstances");
  bullet(ctx, "Right to data portability — receive your data in a structured, machine-readable format");
  bullet(ctx, "Right to object — object to processing based on legitimate interests");
  gap(ctx, 5);
  body(ctx, "You may exercise the Right to Erasure directly within this app using the \"Delete Account\" option in the main menu. This will permanently erase all personal data held about you (name, email, device identifier, progress, quiz results, waiver, inspection records, and risk assessments). Your activation code will be marked as used and cannot be reactivated after deletion.");
  gap(ctx, 5);
  body(ctx, "For all other rights requests, contact us at info@chainsawcourses.com. We will respond within 30 days.");
  gap(ctx, 5);
  body(ctx, "You also have the right to lodge a complaint with the Information Commissioner's Office (ICO) at ico.org.uk or by calling 0303 123 1113.", 8);

  // ── 6. Data Security ──────────────────────────────────────────────────────
  gap(ctx, 4);
  heading(ctx, "6. Data Security");
  body(ctx, "All data is transmitted over HTTPS. Your personal data is stored in a securely hosted PostgreSQL database. Access is restricted to authorised personnel only. Passwords and tokens are never stored in plain text. Video streams are delivered via Vimeo's secure CDN with domain-level access restrictions; we do not store video content.");
  gap(ctx, 5);
  body(ctx, "The device-lock mechanism means your training account is bound to your device, reducing the risk of unauthorised third-party access to your personal training record.");

  // ── 7. Third-Party Services ───────────────────────────────────────────────
  gap(ctx, 4);
  heading(ctx, "7. Third-Party Services");
  const tw7 = [CW * 0.22, CW * 0.38, CW * 0.40];
  tableRow(ctx, ["Service", "Purpose", "Data Shared"], tw7, true);
  tableRow(ctx, ["Vimeo", "Video hosting & streaming", "IP address (standard CDN delivery); no personal data sent by us"], tw7, false);
  tableRow(ctx, ["OpenAI (via Replit AI proxy)", "AI mock-test & tutor responses", "Chat message content only (no name, email, or identifiers sent)"], tw7, false);
  tableRow(ctx, ["Replit", "Platform hosting & infrastructure", "All platform traffic passes through Replit infrastructure; governed by Replit's DPA"], tw7, false);
  gap(ctx, 6);
  body(ctx, "We do not sell, rent, or share your personal data with any third parties for marketing purposes.", 8);

  // ── 8. Cookies ────────────────────────────────────────────────────────────
  gap(ctx, 4);
  heading(ctx, "8. Cookies & Local Storage");
  body(ctx, "This application uses browser localStorage and cookies solely to persist your session credentials (activation code, device identifier, user ID) between visits. No advertising, analytics, or tracking cookies are set. No third-party tracking scripts are loaded.");

  // ── 9. Children ───────────────────────────────────────────────────────────
  gap(ctx, 4);
  heading(ctx, "9. Children");
  body(ctx, "This platform is intended for adult professionals engaged in or training for chainsaw operation. We do not knowingly collect data from individuals under the age of 18. If you believe a minor has activated an account, please contact us immediately.");

  // ── 10. Changes ───────────────────────────────────────────────────────────
  gap(ctx, 4);
  heading(ctx, "10. Changes to This Policy");
  body(ctx, "We may update this policy from time to time. The version date at the top of this page indicates when it was last revised. Continued use of the platform after a policy update constitutes acceptance of the revised policy.");

  // ── Footer strip ──────────────────────────────────────────────────────────
  gap(ctx, 14);
  ctx.page.drawLine({ start: { x: ML, y: ctx.y }, end: { x: PW - MR, y: ctx.y }, thickness: 0.6, color: ORANGE });
  ctx.y -= 12;
  const foot = "Chainsaw Courses  •  info@chainsawcourses.com  •  chainsawcourses.com";
  ctx.page.drawText(foot, { x: (PW - reg.widthOfTextAtSize(foot, 8)) / 2, y: ctx.y, size: 8, font: reg, color: GREY });
  ctx.y -= 10;
  const foot2 = "This policy was prepared in accordance with UK GDPR (UK Data Protection Act 2018) and reflects IIRSM vocational training data standards.";
  const foot2Lines = wrap(foot2, reg, 7, CW);
  for (const l of foot2Lines) {
    ctx.page.drawText(l, { x: (PW - reg.widthOfTextAtSize(l, 7)) / 2, y: ctx.y, size: 7, font: reg, color: GREY });
    ctx.y -= 10;
  }

  drawFooters(ctx);
  return doc.save();
}
