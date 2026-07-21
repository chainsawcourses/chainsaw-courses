/**
 * Generates IIRSM_Submission_Brief.pdf and writes it to
 * artifacts/chainsaw-training/public/pdfs/
 *
 * Run: pnpm --filter @workspace/scripts exec tsx src/generate-iirsm-brief.ts
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const OUT = path.resolve(
  __dirname,
  "../../artifacts/chainsaw-training/public/pdfs/IIRSM_Submission_Brief.pdf"
);

const BRAND   = rgb(0.918, 0.361, 0.047); // #ea5c0c
const BLACK   = rgb(0, 0, 0);
const DARK    = rgb(0.15, 0.15, 0.15);
const MID     = rgb(0.35, 0.35, 0.35);
const LIGHT   = rgb(0.85, 0.85, 0.85);
const WHITE   = rgb(1, 1, 1);
const PAGEBG  = rgb(0.97, 0.97, 0.97);

const PAGE_W = 595;
const PAGE_H = 842;
const M      = 42;          // left/right margin
const COL_W  = PAGE_W - M * 2;

async function generate() {
  const doc   = await PDFDocument.create();
  const fReg  = await doc.embedFont(StandardFonts.Helvetica);
  const fBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fItal = await doc.embedFont(StandardFonts.HelveticaOblique);

  type State = {
    page: ReturnType<typeof doc.addPage>;
    y: number;
  };

  const pages: State[] = [];

  function newPage(): State {
    const page = doc.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAGEBG });
    const state: State = { page, y: PAGE_H - M };
    pages.push(state);
    return state;
  }

  function drawText(
    s: State,
    text: string,
    opts: {
      font?: typeof fReg;
      size?: number;
      color?: ReturnType<typeof rgb>;
      x?: number;
      maxWidth?: number;
      lineHeight?: number;
    } = {}
  ): number {
    const font       = opts.font ?? fReg;
    const size       = opts.size ?? 9;
    const color      = opts.color ?? DARK;
    const x          = opts.x ?? M;
    const maxWidth   = opts.maxWidth ?? COL_W;
    const lineHeight = opts.lineHeight ?? size * 1.45;

    const words = text.split(" ");
    let line = "";
    let linesDrawn = 0;

    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(test, size) > maxWidth && line) {
        s.page.drawText(line, { x, y: s.y, size, font, color });
        s.y -= lineHeight;
        linesDrawn++;
        line = word;
      } else {
        line = test;
      }
    }
    if (line) {
      s.page.drawText(line, { x, y: s.y, size, font, color });
      s.y -= lineHeight;
      linesDrawn++;
    }
    return linesDrawn;
  }

  function gap(s: State, h: number) {
    s.y -= h;
  }

  function hRule(s: State, color = LIGHT) {
    s.page.drawRectangle({ x: M, y: s.y, width: COL_W, height: 0.75, color });
    s.y -= 6;
  }

  function sectionHeading(s: State, title: string) {
    s.page.drawRectangle({ x: M, y: s.y - 2, width: COL_W, height: 16, color: BRAND });
    s.page.drawText(title, { x: M + 6, y: s.y + 2, size: 8, font: fBold, color: WHITE });
    s.y -= 20;
  }

  function tableRow(
    s: State,
    label: string,
    value: string,
    shade: boolean,
    labelW = 155
  ) {
    const valueX   = M + labelW;
    const valueW   = COL_W - labelW;
    const valueFontSize = 8;
    const labelFontSize = 8;
    const lh = valueFontSize * 1.4;

    // Measure how many lines the value needs
    const valueWords = value.split(" ");
    let line = "";
    const valueLines: string[] = [];
    for (const word of valueWords) {
      const test = line ? `${line} ${word}` : word;
      if (fReg.widthOfTextAtSize(test, valueFontSize) > valueW - 8 && line) {
        valueLines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) valueLines.push(line);

    const labelWords = label.split(" ");
    let lline = "";
    const labelLines: string[] = [];
    for (const word of labelWords) {
      const test = lline ? `${lline} ${word}` : word;
      if (fBold.widthOfTextAtSize(test, labelFontSize) > labelW - 8 && lline) {
        labelLines.push(lline);
        lline = word;
      } else {
        lline = test;
      }
    }
    if (lline) labelLines.push(lline);

    const rowLines = Math.max(valueLines.length, labelLines.length);
    const rowH     = rowLines * lh + 8;

    if (shade) {
      s.page.drawRectangle({ x: M, y: s.y - rowH + 4, width: COL_W, height: rowH, color: rgb(0.93, 0.93, 0.93) });
    } else {
      s.page.drawRectangle({ x: M, y: s.y - rowH + 4, width: COL_W, height: rowH, color: WHITE });
    }

    // draw label lines
    let ty = s.y;
    for (const ll of labelLines) {
      s.page.drawText(ll, { x: M + 6, y: ty, size: labelFontSize, font: fBold, color: DARK });
      ty -= lh;
    }

    // draw value lines
    ty = s.y;
    for (const vl of valueLines) {
      s.page.drawText(vl, { x: valueX + 4, y: ty, size: valueFontSize, font: fReg, color: DARK });
      ty -= lh;
    }

    // divider between columns
    s.page.drawRectangle({ x: M + labelW, y: s.y - rowH + 4, width: 0.5, height: rowH, color: LIGHT });

    s.y -= rowH;
    s.page.drawRectangle({ x: M, y: s.y + 4, width: COL_W, height: 0.5, color: LIGHT });
  }

  function checkPageBreak(s: State, needed = 80): State {
    if (s.y < needed + M) {
      const ns = newPage();
      drawFooter(ns);
      return ns;
    }
    return s;
  }

  function drawFooter(s: State) {
    const footerY = 28;
    s.page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: footerY + 4, color: BRAND });
    const footer = "IIRSM Course Approval Submission  |  Overleaf Publishers Ltd  |  chainsawcourses.com  |  Version 1.4  |  July 2026  |  Confidential";
    s.page.drawText(footer, { x: M, y: footerY - 6, size: 6.5, font: fReg, color: WHITE });
  }

  // ── PAGE 1 ────────────────────────────────────────────────────────────────
  let s = newPage();

  // Orange header bar
  s.page.drawRectangle({ x: 0, y: PAGE_H - 80, width: PAGE_W, height: 80, color: BRAND });
  s.page.drawText("IIRSM COURSE APPROVAL SUBMISSION — CHAINSAW MAINTENANCE & CROSS CUTTING v1.4", {
    x: M, y: PAGE_H - 30, size: 10, font: fBold, color: WHITE,
  });
  s.page.drawText("eLearning (No Trainer) Application  |  Overleaf Publishers Ltd  |  chainsawcourses.com", {
    x: M, y: PAGE_H - 46, size: 8, font: fItal, color: rgb(1, 0.9, 0.85),
  });

  s.y = PAGE_H - 100;

  // Subtitle card
  s.page.drawRectangle({ x: M, y: s.y - 28, width: COL_W, height: 34, color: WHITE });
  s.page.drawText("IIRSM Course Approval — Full Submission Brief", {
    x: M + 10, y: s.y - 8, size: 11, font: fBold, color: BRAND,
  });
  s.page.drawText("eLearning Application (No Trainer)  |  Chainsaw Maintenance & Cross Cutting  |  Ground Level  |  Version 1.4", {
    x: M + 10, y: s.y - 22, size: 7.5, font: fItal, color: MID,
  });
  s.y -= 42;

  // SECTION 1
  sectionHeading(s, "SECTION 1  |  Course Identity & Operational Specification");
  const sec1rows: [string, string][] = [
    ["Official Course Title",          "Chainsaw Maintenance & Cross Cutting (Ground Level Framework)"],
    ["Course Format",                  "eLearning — Progressive Web Application (PWA) combined with an integrated printed manual; no trainer required"],
    ["Publisher",                      "Overleaf Publishers Ltd"],
    ["Course Author / Content Developer", "David J Daniel"],
    ["Copyright",                      "Copyright © 2026 Overleaf Publishers Ltd. All rights reserved. First Edition: July 2026"],
    ["Platform URL",                   "chainsawcourses.com"],
    ["Contact Email",                  "info@chainsawcourses.com"],
    ["Postal Address",                 "69 Newstead Avenue, Orpington, BR6 9RW"],
    ["NOS Alignment",                  "Independently mapped to UK National Occupational Standards (NOS) for Chainsaw Operations"],
    ["NPTC Alignment",                 "Assessment criteria independently mapped to City & Guilds NPTC 0039-20 unit parameters for theoretical reference and CPD purposes only"],
    ["CPD Points Awarded",             "5 Verifiable CPD Points"],
    ["Guided Learning Hours (GLH)",    "16 Hours — technical text, annotated diagrams, and seven sequential video modules"],
    ["Directed Online Assessment",     "1.5 Hours — 45-question randomised multiple-choice examination"],
    ["Independent Self-Study",         "1.5 Hours — risk evaluation practice, glossary review, and field tool exercises"],
    ["Total Qualification Time (TQT)", "19 Hours total"],
    ["Minimum Pass Threshold",         "80% or higher on the summative examination — unlimited resit attempts permitted"],
    ["Target Learner Profile",         "Commercial chainsaw operators, forestry workers, arborists, estate and grounds teams, and landscape professionals"],
    ["Course Version",                 "Version 1.4 — submitted for initial IIRSM eLearning Course Approval (1 course)"],
    ["Approval Category",              "New to IIRSM Course Approval — eLearning (no trainer)"],
  ];
  for (let i = 0; i < sec1rows.length; i++) {
    s = checkPageBreak(s, 50);
    tableRow(s, sec1rows[i][0], sec1rows[i][1], i % 2 === 1);
  }

  drawFooter(s);

  // ── PAGE 2 ────────────────────────────────────────────────────────────────
  s = newPage();
  s.y = PAGE_H - M;

  sectionHeading(s, "SECTION 2  |  Developer & Author Credentials");
  gap(s, 2);
  drawText(s, "IIRSM requires full details of who developed the course and their level of knowledge and skills to do so. The following provides a complete account of the author's qualifications, experience, and subject-matter expertise relevant to this submission.", {
    size: 7.5, color: MID, font: fItal,
  });
  gap(s, 6);

  const sec2rows: [string, string][] = [
    ["Author Name",                   "David J Daniel"],
    ["Role",                          "Course Author, Content Developer & Platform Publisher"],
    ["Organisation",                  "Overleaf Publishers Ltd"],
    ["Chainsaw Qualification",        "City & Guilds NPTC 0039-20 — Chainsaw Maintenance and Cross Cutting (certificated)"],
    ["First Aid Certification",       "Current First Aid at Work certificate held"],
    ["Industry Experience",           "Over 27 years in the arboricultural and forestry industry. Worked as an arboricultural contract climber for numerous large and small companies throughout this period, gaining extensive hands-on operational experience across a wide range of site conditions and chainsaw applications."],
    ["Assessor & Instructor Qualifications", "City & Guilds NPTC Assessor and LANTRA Instructor and Assessor for 8 years — covering practical chainsaw assessment and vocational training delivery to industry standard."],
    ["Published Author",              "Author of 'The Chainsaw Manual' — currently sold as a standalone physical learning aid to various colleges and training providers across the UK. The manual underpins the theoretical content of this eLearning course."],
    ["Subject Research",              "Course content developed with reference to current UK HSE guidance, NPTC 0039-20 unit standards, and the Overleaf Chainsaw Manual (published reference text)"],
    ["Platform Development",          "Full-stack eLearning platform designed, developed and operated by author — Progressive Web Application with device-locked access, video streaming, and automated assessment"],
    ["CPD Status",                    "Author holds current CPD membership and engages in ongoing professional development in chainsaw safety and vocational eLearning design"],
  ];
  for (let i = 0; i < sec2rows.length; i++) {
    s = checkPageBreak(s, 50);
    tableRow(s, sec2rows[i][0], sec2rows[i][1], i % 2 === 1);
  }

  gap(s, 12);
  s = checkPageBreak(s, 120);
  sectionHeading(s, "SECTION 3  |  Learning Outcomes & Assessment Criteria");
  gap(s, 2);
  drawText(s, "The course is structured across seven sequential video modules, each mapped to a discrete learning outcome. Learners must complete each module video in full and achieve 80% or higher on the associated module quiz before the next module unlocks. A final summative examination of 45 randomised questions is required for certification.", {
    size: 7.5, color: MID, font: fItal,
  });
  gap(s, 6);

  // Table header for Section 3
  s.page.drawRectangle({ x: M, y: s.y - 16, width: COL_W, height: 20, color: rgb(0.25, 0.25, 0.25) });
  s.page.drawText("Module", { x: M + 6, y: s.y - 10, size: 8, font: fBold, color: WHITE });
  s.page.drawText("Learning Outcome", { x: M + 155 + 4, y: s.y - 10, size: 8, font: fBold, color: WHITE });
  s.y -= 20;

  const sec3rows: [string, string][] = [
    ["Equipment List",              "Identify and describe the personal protective equipment (PPE) and tools required for safe chainsaw operation"],
    ["PPE & First Aid",             "Demonstrate knowledge of appropriate PPE standards and first-aid procedures relevant to chainsaw injury"],
    ["5 Steps to Risk Assessment",  "Apply the HSE five-step risk assessment framework to chainsaw operations"],
    ["Hazards & Risks",             "Identify site-specific hazards and evaluate risk levels using likelihood and severity matrices"],
    ["Emergency Planning Information", "Develop and communicate an emergency action plan for chainsaw operations on site"],
    ["Law & Legislation",           "Describe the legal framework governing chainsaw use including PUWER and HSE guidance"],
    ["Chainsaw Safety Features",    "Identify and explain the function of all primary chainsaw safety features and their activation mechanisms"],
  ];
  for (let i = 0; i < sec3rows.length; i++) {
    s = checkPageBreak(s, 40);
    tableRow(s, sec3rows[i][0], sec3rows[i][1], i % 2 === 1);
  }

  drawFooter(s);

  // ── PAGE 3 ────────────────────────────────────────────────────────────────
  s = newPage();
  s.y = PAGE_H - M;

  sectionHeading(s, "SECTION 4  |  Course Delivery & Technical Specification");
  const sec4rows: [string, string][] = [
    ["Delivery Platform",  "Progressive Web Application (PWA) — accessible via modern web browsers on desktop, tablet, and mobile"],
    ["Access Control",     "Single-use device-locked activation code; code bonds to first device on activation — prevents sharing"],
    ["Video Hosting",      "Vimeo Pro — encrypted streaming; watermark overlays display learner name and email dynamically"],
    ["Assessment Engine",  "Server-side randomised question bank; results stored in PostgreSQL database with full audit trail"],
    ["Digital Waiver",     "Touch/mouse signature capture on first login — legally binding acknowledgement of course terms"],
    ["Certificate Issuance", "Automated PDF certificate issued on passing the final examination — emailed to learner"],
    ["Data Security",      "All data encrypted in transit (TLS 1.3); hosted on Replit deployment infrastructure (EU region)"],
    ["Accessibility",      "WCAG 2.1 AA compliant colour contrast; keyboard navigable; screen-reader compatible markup"],
    ["Browser Support",    "Chrome 120+, Safari 16+, Firefox 120+, Edge 120+"],
    ["Companion Manual",   "Overleaf Chainsaw Manual (printed) — supplied separately; referenced throughout the digital course"],
  ];
  for (let i = 0; i < sec4rows.length; i++) {
    s = checkPageBreak(s, 40);
    tableRow(s, sec4rows[i][0], sec4rows[i][1], i % 2 === 1);
  }

  gap(s, 14);
  sectionHeading(s, "SECTION 5  |  Quality Assurance & Review Process");
  gap(s, 4);
  drawText(s, "Content accuracy is assured through the following quality control measures:", { size: 8, color: DARK });
  gap(s, 4);

  const bullets = [
    "All module content cross-referenced against current HSE Chainsaw guidance (HSE AFAG series) and City & Guilds NPTC 0039-20 unit specifications.",
    "Quiz questions reviewed by the author against published assessment criteria and common examiner focus areas.",
    "Platform functionality tested across all supported browsers and device types prior to launch.",
    "Annual content review scheduled — first review due July 2027.",
    "Learner feedback captured post-examination and monitored for accuracy and relevance signals.",
    "Any changes to UK legislation or HSE guidance will trigger an unscheduled content review within 30 days of publication.",
  ];
  for (const b of bullets) {
    s = checkPageBreak(s, 30);
    s.page.drawText("•", { x: M + 6, y: s.y, size: 9, font: fBold, color: BRAND });
    const saved = s.y;
    s.y = saved;
    drawText(s, b, { x: M + 18, y: s.y, size: 8, color: DARK, maxWidth: COL_W - 18 } as Parameters<typeof drawText>[2]);
    gap(s, 3);
  }

  drawFooter(s);

  const pdfBytes = await doc.save();
  fs.writeFileSync(OUT, pdfBytes);
  console.log(`Written: ${OUT}`);
}

generate().catch((e) => { console.error(e); process.exit(1); });
