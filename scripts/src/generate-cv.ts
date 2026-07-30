/**
 * Generates David_Daniel_CV.pdf and writes it to
 * artifacts/chainsaw-training/public/pdfs/
 *
 * Run: pnpm --filter @workspace/scripts exec tsx src/generate-cv.ts
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const OUT = path.resolve(
  __dirname,
  "../../artifacts/chainsaw-training/public/pdfs/David_Daniel_CV.pdf"
);

const PUBLIC = path.resolve(__dirname, "../../artifacts/chainsaw-training/public");

// ── Colours ───────────────────────────────────────────────────────────────────
const BRAND    = rgb(0.918, 0.361, 0.047); // #ea5c0c
const BRAND_DK = rgb(0.60,  0.22,  0.02);  // darker orange for overlays
const DARK     = rgb(0.13,  0.13,  0.13);
const MID      = rgb(0.38,  0.38,  0.38);
const LIGHT    = rgb(0.82,  0.82,  0.82);
const WHITE    = rgb(1,     1,     1);
const OFFWHITE = rgb(0.97,  0.97,  0.97);
const OVERLAY  = rgb(0.08,  0.05,  0.02);  // near-black warm overlay on bg photo

// ── Page geometry ─────────────────────────────────────────────────────────────
const PAGE_W   = 595;
const PAGE_H   = 842;
const M        = 42;           // left/right margin
const COL_W    = PAGE_W - M * 2;
const HEADER_H = 210;          // height of the photo header band

async function generate() {
  const doc = await PDFDocument.create();

  // Fonts
  const fBold  = await doc.embedFont(StandardFonts.HelveticaBold);
  const fReg   = await doc.embedFont(StandardFonts.Helvetica);
  const fItal  = await doc.embedFont(StandardFonts.HelveticaOblique);

  // Embed bg photo
  const bgBytes  = fs.readFileSync(path.join(PUBLIC, "bg.jpg"));
  const bgImage  = await doc.embedJpg(bgBytes);

  // Embed logo (icon-192 is the app icon with transparent-friendly background)
  const iconBytes = fs.readFileSync(path.join(PUBLIC, "icon-192.png"));
  const iconImage = await doc.embedPng(iconBytes);

  // ── State helpers ───────────────────────────────────────────────────────────
  type State = { page: ReturnType<typeof doc.addPage>; y: number };

  function newPage(): State {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    return { page, y: PAGE_H };
  }

  function checkPageBreak(s: State, needed: number): State {
    if (s.y < needed + 36) {
      const ns = newPage();
      drawContinuationHeader(ns);
      drawFooter(ns);
      ns.y = PAGE_H - 60;
      return ns;
    }
    return s;
  }

  // ── Draw helpers ────────────────────────────────────────────────────────────

  /** Wrap text into lines no wider than maxWidth at fontSize. */
  function wrapText(text: string, fontSize: number, maxWidth: number, font = fReg): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, fontSize) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /** Draw wrapped paragraph, return updated state. */
  function para(
    s: State,
    text: string,
    opts: { size?: number; color?: ReturnType<typeof rgb>; font?: typeof fReg; x?: number; maxWidth?: number; leading?: number }
  ): State {
    const size    = opts.size    ?? 8.5;
    const color   = opts.color   ?? DARK;
    const font    = opts.font    ?? fReg;
    const x       = opts.x      ?? M;
    const maxW    = opts.maxWidth ?? COL_W;
    const leading = opts.leading ?? size * 1.5;
    const lines   = wrapText(text, size, maxW, font);
    for (const line of lines) {
      s = checkPageBreak(s, leading + 4);
      s.page.drawText(line, { x, y: s.y, size, font, color });
      s.y -= leading;
    }
    return s;
  }

  /** Draw a bullet point. */
  function bullet(s: State, text: string, indent = 0): State {
    const x    = M + 14 + indent;
    const maxW = COL_W - 14 - indent;
    s = checkPageBreak(s, 16);
    s.page.drawText("•", { x: M + 4 + indent, y: s.y, size: 8, font: fBold, color: BRAND });
    s = para(s, text, { x, maxWidth: maxW, size: 8.5, leading: 13 });
    return s;
  }

  /** Section heading bar */
  function section(s: State, title: string): State {
    s = checkPageBreak(s, 30);
    s.y -= 6;
    s.page.drawRectangle({ x: M, y: s.y - 2, width: COL_W, height: 16, color: BRAND });
    s.page.drawText(title, { x: M + 6, y: s.y + 2, size: 8, font: fBold, color: WHITE });
    s.y -= 22;
    return s;
  }

  /** Thin rule */
  function rule(s: State): void {
    s.page.drawRectangle({ x: M, y: s.y, width: COL_W, height: 0.5, color: LIGHT });
    s.y -= 8;
  }

  /** Orange footer bar */
  function drawFooter(s: State): void {
    s.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 24, color: BRAND });
    const footerText = "Overleaf Publishers Ltd  |  chainsawcourses.com  |  info@chainsawcourses.com  |  07763 103 308";
    s.page.drawText(footerText, { x: M, y: 8, size: 6.5, font: fReg, color: WHITE });
  }

  /** Slim header bar for continuation pages */
  function drawContinuationHeader(s: State): void {
    s.page.drawRectangle({ x: 0, y: PAGE_H - 36, width: PAGE_W, height: 36, color: BRAND });
    s.page.drawText("DAVID J DANIEL", { x: M, y: PAGE_H - 22, size: 11, font: fBold, color: WHITE });
    s.page.drawText("Curriculum Vitae — continued", {
      x: M, y: PAGE_H - 34, size: 7, font: fItal, color: rgb(1, 0.88, 0.75),
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Photo Header
  // ════════════════════════════════════════════════════════════════════════════
  let s = newPage();

  // ── Full-bleed photo behind the header ─────────────────────────────────────
  s.page.drawImage(bgImage, {
    x: 0,
    y: PAGE_H - HEADER_H,
    width: PAGE_W,
    height: HEADER_H,
  });

  // Dark warm overlay so text is legible over the action photo
  s.page.drawRectangle({
    x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H,
    color: OVERLAY, opacity: 0.72,
  });

  // Orange accent strip along the top
  s.page.drawRectangle({ x: 0, y: PAGE_H - 6, width: PAGE_W, height: 6, color: BRAND });

  // Orange vertical accent bar on left
  s.page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: 5, height: HEADER_H, color: BRAND });

  // App icon — white background square, then icon
  const ICON_SIZE = 52;
  const iconX = PAGE_W - M - ICON_SIZE;
  const iconY = PAGE_H - HEADER_H + (HEADER_H - ICON_SIZE) / 2;
  s.page.drawRectangle({ x: iconX - 4, y: iconY - 4, width: ICON_SIZE + 8, height: ICON_SIZE + 8, color: WHITE, borderRadius: 8 });
  s.page.drawImage(iconImage, { x: iconX, y: iconY, width: ICON_SIZE, height: ICON_SIZE });

  // Name
  s.page.drawText("DAVID J DANIEL", {
    x: M + 10, y: PAGE_H - 52, size: 26, font: fBold, color: WHITE,
  });

  // Title line
  s.page.drawText("Forestry & Arboricultural Specialist", {
    x: M + 10, y: PAGE_H - 76, size: 10, font: fBold, color: BRAND,
  });
  s.page.drawText("LANTRA Instructor & Assessor  |  City & Guilds NPTC Assessor  |  Author & Technical Consultant", {
    x: M + 10, y: PAGE_H - 92, size: 8, font: fReg, color: rgb(0.95, 0.95, 0.95),
  });

  // Divider
  s.page.drawRectangle({ x: M + 10, y: PAGE_H - 102, width: 280, height: 1, color: BRAND });

  // Contact details
  const contactItems = [
    "Based in Orpington, United Kingdom",
    "info@chainsawcourses.com",
    "07763 103 308",
    "www.chainsawmanual.com",
  ];
  let cx = M + 10;
  const cY = PAGE_H - 116;
  for (let i = 0; i < contactItems.length; i++) {
    const item = contactItems[i];
    s.page.drawText(item, { x: cx, y: cY, size: 7.5, font: fReg, color: rgb(0.92, 0.92, 0.92) });
    cx += fReg.widthOfTextAtSize(item, 7.5) + 16;
    if (i < contactItems.length - 1) {
      s.page.drawText("·", { x: cx - 10, y: cY, size: 7.5, font: fBold, color: BRAND });
    }
  }

  // Brand line at bottom of header
  s.page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: 20, color: BRAND, opacity: 0.9 });
  s.page.drawText("CHAINSAW COURSES  ·  chainsawcourses.com  ·  Overleaf Publishers Ltd", {
    x: M, y: PAGE_H - HEADER_H + 6, size: 7, font: fBold, color: WHITE,
  });

  s.y = PAGE_H - HEADER_H - 20;

  drawFooter(s);

  // ── Professional Profile ────────────────────────────────────────────────────
  s = section(s, "PROFESSIONAL PROFILE");

  s = para(s, "Forestry and Arboricultural specialist with over 27 years of practical, instructional, and assessment experience across high-risk land-based operations. Author and producer of The Chainsaw Manual — recognised and adopted by land-based colleges and training providers across the United Kingdom. The manual maps all operational guides directly to HSE research reports, manufacturer safety guidelines, PUWER requirements, and NPTC assessment standards, now extended with digital LMS modules, practical locator gateways, and interactive learning tools built upon the textbook's core architecture. Published by Overleaf Publishers Ltd.", {
    size: 8.5, color: DARK, leading: 13,
  });
  s.y -= 4;

  s = para(s, "Dual-accredited LANTRA Instructor/Assessor and City & Guilds NPTC Assessor holding an extensive portfolio of technical assessment units spanning ground operations, felling, aerial tree work, and machinery operation. Fully certified LOLER Examiner specialising in complex lifting equipment compliance and risk management. Involved with UK Power Networks (UKPN) providing specialist standard-setting days and demonstrations.", {
    size: 8.5, color: DARK, leading: 13,
  });
  s.y -= 6;

  // ── Professional Experience ─────────────────────────────────────────────────
  s = section(s, "PROFESSIONAL EXPERIENCE");

  // Role header
  s = checkPageBreak(s, 40);
  s.page.drawText("Independent Senior Consultant, Instructor & Assessor", {
    x: M, y: s.y, size: 10, font: fBold, color: DARK,
  });
  s.y -= 14;
  s.page.drawText("Self-Employed  |  1999 – Present  (27 Years)", {
    x: M, y: s.y, size: 8, font: fItal, color: MID,
  });
  s.y -= 6;
  rule(s);

  s = para(s, "Client Base: Commercial Tree Surgery Enterprises, Land-Based Colleges, Regional Training Providers, City & Guilds NPTC Assessment Centres, and Public Utilities.", {
    size: 8.5, color: MID, font: fItal, leading: 13,
  });
  s.y -= 4;

  const experienceBullets = [
    "Technical Assessment & Moderation (8 years): Registered City & Guilds NPTC and LANTRA Assessor, evaluating candidate competence across ground chainsaw operations, tree felling, aerial arboriculture, and specialised machinery.",
    "High-Risk Operations & Subcontracting: Specialist arboricultural services to UK tree care firms, managing complex removals, heavy rigging, and hazardous tree management.",
    "LOLER Compliance Examination: Certified competent person performing independent thorough examinations of climbing, rigging, and mechanical lifting apparatus to ensure statutory compliance and mitigate operational risk.",
    "Industry Outreach & Advocacy: Active in the digital space driving safety discussions, technique updates, and technical guidance across industry platforms.",
    "Author & Publisher: Authored The Chainsaw Manual — a comprehensive industry reference text sold to colleges and training providers across the UK, now underpinning a fully developed eLearning platform at chainsawcourses.com.",
    "Platform Development: Designed, built, and operate a full-stack Progressive Web Application (PWA) delivering accredited eLearning with device-locked access, video streaming, AI examination tools, and automated certificate issuance.",
    "UK Power Networks (UKPN): Provide specialist standard-setting days and demonstrations for the utility sector.",
  ];
  for (const b of experienceBullets) {
    s = bullet(s, b);
    s.y -= 2;
  }
  s.y -= 4;

  // ── Instructional & Assessment Credentials ──────────────────────────────────
  s = section(s, "INSTRUCTIONAL & ASSESSMENT CREDENTIALS");

  const credBullets = [
    "LANTRA Accredited Instructor & Assessor (Forestry & Arboriculture)",
    "City & Guilds NPTC Registered Assessor",
    "LOLER Examiner — certified competent person for thorough examination of lifting equipment",
    "Current First Aid at Work (+F) Certificate",
  ];
  for (const b of credBullets) {
    s = bullet(s, b);
    s.y -= 2;
  }
  s.y -= 4;

  // ── NPTC Assessor Scope ─────────────────────────────────────────────────────
  s = section(s, "CITY & GUILDS NPTC ASSESSOR SCOPE — REGISTERED UNIT PORTFOLIO");

  // Ground Chainsaw & Felling Suite
  s = checkPageBreak(s, 20);
  s.page.drawText("Ground Chainsaw & Felling Suite", {
    x: M, y: s.y, size: 9, font: fBold, color: BRAND,
  });
  s.y -= 14;

  s = para(s, "0039-20  |  0039-21  |  0039-22  |  0039-23  |  0039-24  |  0039-31  |  0039-32  |  0039-38", {
    size: 8.5, font: fBold, color: DARK, leading: 13,
  });
  s = para(s, "Covering: Maintenance, Cross-Cutting, Small / Medium / Large Tree Felling, Severe Windblown Timber, Severed Uprooted Trees, Tree Climbing, Aerial Rescue, Chainsaw from Rope & Harness, Aerial Cutting Techniques, and Complex Sectional Dismantling / Rigging.", {
    size: 8, color: MID, font: fItal, leading: 12,
  });
  s.y -= 6;

  // CPD Suite
  s = checkPageBreak(s, 20);
  s.page.drawText("CPD Suite", {
    x: M, y: s.y, size: 9, font: fBold, color: BRAND,
  });
  s.y -= 14;

  s = para(s, "0041-01  |  0041-02  |  0041-03  |  0041-04  |  0041-05", {
    size: 8.5, font: fBold, color: DARK, leading: 13,
  });
  s = para(s, "Covering: Maintenance, Cross-Cutting, Small / Medium / Large Tree Felling, Severe Windblown Timber, Severed Uprooted Trees, Tree Climbing, Aerial Rescue, Chainsaw from Rope & Harness, Aerial Cutting Techniques, and Complex Sectional Dismantling / Rigging.", {
    size: 8, color: MID, font: fItal, leading: 12,
  });
  s.y -= 8;

  // ── Publications & Digital Work ─────────────────────────────────────────────
  s = section(s, "PUBLICATIONS & DIGITAL WORK");

  s = checkPageBreak(s, 16);
  s.page.drawText("The Chainsaw Manual — Overleaf Publishers Ltd", {
    x: M, y: s.y, size: 9, font: fBold, color: DARK,
  });
  s.y -= 14;
  s = para(s, "Comprehensive industry reference text covering all aspects of chainsaw maintenance and operation, mapped to HSE guidance, NPTC standards, and manufacturer specifications. Adopted by land-based colleges and training providers across the United Kingdom.", {
    size: 8.5, color: DARK, leading: 13,
  });
  s.y -= 8;

  s = checkPageBreak(s, 16);
  s.page.drawText("Chainsaw Courses eLearning Platform — chainsawcourses.com", {
    x: M, y: s.y, size: 9, font: fBold, color: DARK,
  });
  s.y -= 14;
  s = para(s, "Fully self-developed Progressive Web Application providing IIRSM-approved eLearning in chainsaw maintenance and cross cutting. Features video streaming, device-locked access, AI mock examination, automated certification, and integrated risk assessment tooling.", {
    size: 8.5, color: DARK, leading: 13,
  });
  s.y -= 8;

  // ── Affiliations & Standards ────────────────────────────────────────────────
  s = section(s, "AFFILIATIONS & STANDARDS INVOLVEMENT");
  s = bullet(s, "UK Power Networks (UKPN) — Specialist standard-setting days and demonstrations for the utility sector.");
  s.y -= 2;
  s = bullet(s, "City & Guilds / NPTC — Registered assessor contributing to practical competence evaluation across land-based qualifications.");
  s.y -= 2;
  s = bullet(s, "LANTRA — Accredited instructor and assessor for forestry and arboricultural vocational training.");

  const pdfBytes = await doc.save();
  fs.writeFileSync(OUT, pdfBytes);
  console.log(`✓ Written ${Math.round(pdfBytes.length / 1024)} KB  →  ${OUT}`);
}

generate().catch((e) => { console.error(e); process.exit(1); });
