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

const OUT    = path.resolve(__dirname, "../../artifacts/chainsaw-training/public/pdfs/David_Daniel_CV.pdf");
const PUBLIC = path.resolve(__dirname, "../../artifacts/chainsaw-training/public");

// ── Colours ───────────────────────────────────────────────────────────────────
const BRAND   = rgb(0.918, 0.361, 0.047); // #ea5c0c
const DARK    = rgb(0.13,  0.13,  0.13);
const MID     = rgb(0.42,  0.42,  0.42);
const LIGHT   = rgb(0.82,  0.82,  0.82);
const XLIGHT  = rgb(0.92,  0.92,  0.92);
const WHITE   = rgb(1,     1,     1);
const OVERLAY = rgb(0.08,  0.05,  0.02);  // near-black warm overlay

// ── Page geometry ─────────────────────────────────────────────────────────────
const PAGE_W   = 595;
const PAGE_H   = 842;
const M        = 44;
const COL_W    = PAGE_W - M * 2;
const HEADER_H = 220;

async function generate() {
  const doc = await PDFDocument.create();

  const fBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fReg  = await doc.embedFont(StandardFonts.Helvetica);
  const fItal = await doc.embedFont(StandardFonts.HelveticaOblique);

  const bgBytes   = fs.readFileSync(path.join(PUBLIC, "bg.jpg"));
  const bgImage   = await doc.embedJpg(bgBytes);
  const iconBytes = fs.readFileSync(path.join(PUBLIC, "icon-192.png"));
  const iconImage = await doc.embedPng(iconBytes);

  // ── State & helpers ──────────────────────────────────────────────────────────
  type State = { page: ReturnType<typeof doc.addPage>; y: number };

  function newPage(): State {
    return { page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H };
  }

  function forcePage(s: State): State {
    const ns = newPage();
    drawContinuationHeader(ns);
    drawFooter(ns);
    ns.y = PAGE_H - 70;
    return ns;
  }

  function checkPageBreak(s: State, needed: number): State {
    if (s.y < needed + 40) return forcePage(s);
    return s;
  }

  function wrapText(text: string, size: number, maxW: number, font = fReg): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let line = "";
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function para(
    s: State,
    text: string,
    opts: { size?: number; color?: ReturnType<typeof rgb>; font?: typeof fReg; x?: number; maxWidth?: number; leading?: number } = {}
  ): State {
    const size    = opts.size    ?? 8.5;
    const color   = opts.color   ?? DARK;
    const font    = opts.font    ?? fReg;
    const x       = opts.x      ?? M;
    const maxW    = opts.maxWidth ?? COL_W;
    const leading = opts.leading ?? size * 1.55;
    for (const line of wrapText(text, size, maxW, font)) {
      s = checkPageBreak(s, leading + 4);
      s.page.drawText(line, { x, y: s.y, size, font, color });
      s.y -= leading;
    }
    return s;
  }

  function bullet(s: State, text: string, indent = 0): State {
    s = checkPageBreak(s, 18);
    s.page.drawText("•", { x: M + 4 + indent, y: s.y, size: 8, font: fBold, color: BRAND });
    s = para(s, text, { x: M + 16 + indent, maxWidth: COL_W - 16 - indent, size: 8.5, leading: 13.5 });
    return s;
  }

  /** Section heading: orange bold text + thin orange rule below — no block fill */
  function section(s: State, title: string): State {
    s = checkPageBreak(s, 36);
    s.y -= 10;
    s.page.drawText(title, { x: M, y: s.y, size: 9.5, font: fBold, color: BRAND });
    s.y -= 5;
    s.page.drawRectangle({ x: M, y: s.y, width: COL_W, height: 1, color: BRAND });
    s.y -= 12;
    return s;
  }

  function thinRule(s: State): void {
    s.page.drawRectangle({ x: M, y: s.y, width: COL_W, height: 0.5, color: LIGHT });
    s.y -= 10;
  }

  function drawFooter(s: State): void {
    s.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: 26, color: BRAND });
    s.page.drawText(
      "Overleaf Publishers Ltd  |  chainsawcourses.com  |  info@chainsawcourses.com  |  07763 103 308",
      { x: M, y: 9, size: 6.5, font: fReg, color: WHITE }
    );
  }

  function drawContinuationHeader(s: State): void {
    s.page.drawRectangle({ x: 0, y: PAGE_H - 42, width: PAGE_W, height: 42, color: DARK });
    s.page.drawRectangle({ x: 0, y: PAGE_H - 42, width: 5, height: 42, color: BRAND });
    s.page.drawText("DAVID J DANIEL", { x: M, y: PAGE_H - 24, size: 12, font: fBold, color: WHITE });
    s.page.drawText("Curriculum Vitae — continued", {
      x: M, y: PAGE_H - 37, size: 7.5, font: fItal, color: rgb(1, 0.88, 0.75),
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // PAGE 1 — Photo Header
  // ════════════════════════════════════════════════════════════════════════════
  let s = newPage();

  // Full-bleed photo
  s.page.drawImage(bgImage, { x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H });

  // Dark overlay
  s.page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: HEADER_H, color: OVERLAY, opacity: 0.74 });

  // Orange top strip
  s.page.drawRectangle({ x: 0, y: PAGE_H - 5, width: PAGE_W, height: 5, color: BRAND });

  // Orange left accent
  s.page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: 5, height: HEADER_H, color: BRAND });

  // ── Circular logo ──────────────────────────────────────────────────────────
  const CIRCLE_R = 36;
  const circleCX = PAGE_W - M - CIRCLE_R;
  const circleCY = PAGE_H - HEADER_H / 2 + 30;

  // White circle (no outline)
  const CIRCLE_INNER = CIRCLE_R * 0.55;
  s.page.drawEllipse({
    x: circleCX, y: circleCY,
    xScale: CIRCLE_INNER, yScale: CIRCLE_INNER,
    color: WHITE,
  });
  // Icon centred in the circle
  const ICON_SIZE = CIRCLE_INNER * 1.4;
  s.page.drawImage(iconImage, {
    x: circleCX - ICON_SIZE / 2,
    y: circleCY - ICON_SIZE / 2,
    width: ICON_SIZE,
    height: ICON_SIZE,
  });

  // ── Name & titles ──────────────────────────────────────────────────────────
  s.page.drawText("DAVID J DANIEL", {
    x: M + 12, y: PAGE_H - 56, size: 28, font: fBold, color: WHITE,
  });
  s.page.drawText("Forestry & Arboricultural Specialist", {
    x: M + 12, y: PAGE_H - 80, size: 11, font: fBold, color: BRAND,
  });
  s.page.drawText("LANTRA Instructor & Assessor  |  City & Guilds NPTC Assessor  |  Author & Technical Consultant", {
    x: M + 12, y: PAGE_H - 97, size: 8, font: fReg, color: rgb(0.93, 0.93, 0.93),
  });

  // Divider
  s.page.drawRectangle({ x: M + 12, y: PAGE_H - 108, width: 290, height: 1, color: BRAND });

  // Contact row
  const contacts = [
    "Orpington, United Kingdom",
    "info@chainsawcourses.com",
    "07763 103 308",
    "www.chainsawmanual.com",
  ];
  let cx = M + 12;
  const cY = PAGE_H - 123;
  for (let i = 0; i < contacts.length; i++) {
    s.page.drawText(contacts[i], { x: cx, y: cY, size: 7.5, font: fReg, color: rgb(0.90, 0.90, 0.90) });
    cx += fReg.widthOfTextAtSize(contacts[i], 7.5) + 14;
    if (i < contacts.length - 1) {
      s.page.drawText("·", { x: cx - 9, y: cY, size: 7.5, font: fBold, color: BRAND });
    }
  }

  // Brand bar at bottom of header
  s.page.drawRectangle({ x: 0, y: PAGE_H - HEADER_H, width: PAGE_W, height: 22, color: BRAND, opacity: 0.92 });
  s.page.drawText("CHAINSAW COURSES  ·  chainsawcourses.com  ·  Overleaf Publishers Ltd", {
    x: M, y: PAGE_H - HEADER_H + 7, size: 7, font: fBold, color: WHITE,
  });

  s.y = PAGE_H - HEADER_H - 28;
  drawFooter(s);

  // ── Professional Profile ────────────────────────────────────────────────────
  s = section(s, "PROFESSIONAL PROFILE");

  s = para(s, "Forestry and Arboricultural specialist with over 27 years of practical, instructional, and assessment experience across high-risk land-based operations. Author and producer of The Chainsaw Manual — recognised and adopted by land-based colleges and training providers across the United Kingdom. The manual maps all operational guides directly to HSE research reports, manufacturer safety guidelines, PUWER requirements, and NPTC assessment standards, now extended with digital LMS modules, practical locator gateways, and interactive learning tools. Published by Overleaf Publishers Ltd.");
  s.y -= 5;
  s = para(s, "Dual-accredited LANTRA Instructor/Assessor and City & Guilds NPTC Assessor holding an extensive portfolio of technical assessment units spanning ground operations, felling, aerial tree work, and machinery operation. Fully certified LOLER Examiner specialising in complex lifting equipment compliance and risk management. Involved with UK Power Networks (UKPN) providing specialist standard-setting days and demonstrations.");
  s.y -= 14;

  // ── Professional Experience ─────────────────────────────────────────────────
  s = section(s, "PROFESSIONAL EXPERIENCE");

  s = checkPageBreak(s, 48);
  s.page.drawText("Independent Senior Consultant, Instructor & Assessor", {
    x: M, y: s.y, size: 10.5, font: fBold, color: DARK,
  });
  s.y -= 16;
  s.page.drawText("Self-Employed  |  1999 – Present  (27 Years)", {
    x: M, y: s.y, size: 8.5, font: fItal, color: MID,
  });
  s.y -= 8;
  thinRule(s);

  s = para(s, "Client Base: Commercial Tree Surgery Enterprises, Land-Based Colleges, Regional Training Providers, City & Guilds NPTC Assessment Centres, and Public Utilities.", {
    size: 8.5, color: MID, font: fItal,
  });
  s.y -= 6;

  const experienceBullets = [
    "Technical Assessment & Moderation (8 years): Registered City & Guilds NPTC and LANTRA Assessor, evaluating candidate competence across ground chainsaw operations, tree felling, aerial arboriculture, and specialised machinery.",
    "High-Risk Operations & Subcontracting: Specialist arboricultural services to UK tree care firms, managing complex removals, heavy rigging, and hazardous tree management.",
    "LOLER Compliance Examination: Certified competent person performing independent thorough examinations of climbing, rigging, and mechanical lifting apparatus to ensure statutory compliance and mitigate operational risk.",
    "Industry Outreach & Advocacy: Active in the digital space driving safety discussions, technique updates, and technical guidance across industry platforms.",
    "Author & Publisher: Authored The Chainsaw Manual — a comprehensive industry reference text sold to colleges and training providers across the UK, now underpinning a fully developed eLearning platform at chainsawcourses.com.",
    "Platform Development: Designed, built, and operate a full-stack Progressive Web Application (PWA) delivering accredited eLearning with device-locked access, video streaming, AI examination tools, and automated certificate issuance.",
    "UK Power Networks (UKPN): Specialist standard-setting days and demonstrations for the utility sector.",
  ];
  for (const b of experienceBullets) {
    s = bullet(s, b);
    s.y -= 2;
  }
  s.y -= 8;

  // ── Instructional & Assessment Credentials ──────────────────────────────────
  // Check enough room for the full section (heading + 4 bullets) before starting
  s = checkPageBreak(s, 120);
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
  s.y -= 8;

  // ── NPTC Assessor Scope ──────────────────────────────────────────────────────
  s = section(s, "CITY & GUILDS NPTC ASSESSOR SCOPE — REGISTERED UNIT PORTFOLIO");

  // Ground Chainsaw & Felling Suite
  s.page.drawText("Ground Chainsaw & Felling Suite", {
    x: M, y: s.y, size: 9.5, font: fBold, color: DARK,
  });
  s.y -= 16;
  s = para(s, "0039-20  |  0039-21  |  0039-22  |  0039-23  |  0039-24  |  0039-31  |  0039-32  |  0039-38", {
    size: 8.5, font: fBold, color: DARK,
  });
  s = para(s, "Covering: Maintenance, Cross-Cutting, Small / Medium / Large Tree Felling, Severe Windblown Timber, Severed Uprooted Trees, Tree Climbing, Aerial Rescue, Chainsaw from Rope & Harness, Aerial Cutting Techniques, and Complex Sectional Dismantling / Rigging.", {
    size: 8.5, color: MID, font: fItal,
  });
  s.y -= 14;

  // CPD Suite
  s.page.drawText("CPD Suite", {
    x: M, y: s.y, size: 9.5, font: fBold, color: DARK,
  });
  s.y -= 16;
  s = para(s, "0041-01  |  0041-02  |  0041-03  |  0041-04  |  0041-05", {
    size: 8.5, font: fBold, color: DARK,
  });
  s = para(s, "Covering: Maintenance, Cross-Cutting, Small / Medium / Large Tree Felling, Severe Windblown Timber, Severed Uprooted Trees, Tree Climbing, Aerial Rescue, Chainsaw from Rope & Harness, Aerial Cutting Techniques, and Complex Sectional Dismantling / Rigging.", {
    size: 8.5, color: MID, font: fItal,
  });
  s.y -= 20;

  // ── Publications & Digital Work ─────────────────────────────────────────────
  s = section(s, "PUBLICATIONS & DIGITAL WORK");

  s = checkPageBreak(s, 50);
  s.page.drawText("The Chainsaw Manual — Overleaf Publishers Ltd", {
    x: M, y: s.y, size: 9.5, font: fBold, color: DARK,
  });
  s.y -= 16;
  s = para(s, "Comprehensive industry reference text covering all aspects of chainsaw maintenance and operation, mapped to HSE guidance, NPTC standards, and manufacturer specifications. Adopted by land-based colleges and training providers across the United Kingdom.");
  s.y -= 14;

  s = checkPageBreak(s, 50);
  s.page.drawText("Chainsaw Courses eLearning Platform — chainsawcourses.com", {
    x: M, y: s.y, size: 9.5, font: fBold, color: DARK,
  });
  s.y -= 16;
  s = para(s, "Fully self-developed Progressive Web Application providing IIRSM-approved eLearning in chainsaw maintenance and cross cutting. Features video streaming, device-locked access, AI mock examination, automated certification, and integrated risk assessment tooling.");
  s.y -= 20;

  const pdfBytes = await doc.save();
  fs.writeFileSync(OUT, pdfBytes);
  console.log(`✓ Written ${Math.round(pdfBytes.length / 1024)} KB  →  ${OUT}`);
}

generate().catch((e) => { console.error(e); process.exit(1); });
