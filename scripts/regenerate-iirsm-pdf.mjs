/**
 * Regenerates IIRSM_Submission_Brief.pdf with corrected GLH/TQT figures.
 * Uses pdf-lib to create a clean, professional replacement document.
 */
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { writeFileSync } from "fs";

const OUT = "artifacts/chainsaw-training/public/pdfs/IIRSM_Submission_Brief.pdf";

const BLACK  = rgb(0.05, 0.05, 0.05);
const ORANGE = rgb(0.886, 0.447, 0.149);   // #e27226
const GREY   = rgb(0.35, 0.35, 0.35);
const LGREY  = rgb(0.55, 0.55, 0.55);
const WHITE  = rgb(1, 1, 1);

async function build() {
  const doc  = await PDFDocument.create();
  const bold  = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg   = await doc.embedFont(StandardFonts.Helvetica);
  const obl   = await doc.embedFont(StandardFonts.HelveticaOblique);

  const W = 595.28, H = 841.89; // A4

  /* ── helpers ─────────────────────────────────────────────────────────── */
  function addPage() {
    const p = doc.addPage([W, H]);
    // header bar
    p.drawRectangle({ x: 0, y: H - 48, width: W, height: 48, color: ORANGE });
    p.drawText("IIRSM COURSE APPROVAL SUBMISSION — CHAINSAW MAINTENANCE & CROSS CUTTING v1.5", {
      x: 28, y: H - 30, size: 7.5, font: bold, color: WHITE,
    });
    p.drawText("eLearning (No Trainer) Application  |  Overleaf Publishers Ltd  |  chainsawcourses.com", {
      x: 28, y: H - 42, size: 7, font: reg, color: rgb(1,1,0.8),
    });
    // footer bar
    p.drawRectangle({ x: 0, y: 0, width: W, height: 28, color: rgb(0.15,0.15,0.15) });
    p.drawText("IIRSM Course Approval Submission  |  Overleaf Publishers Ltd  |  chainsawcourses.com  |  Version 1.5  |  July 2026  |  Confidential", {
      x: 28, y: 9, size: 6.5, font: reg, color: rgb(0.7,0.7,0.7),
    });
    return p;
  }

  function sectionHeader(page, text, y) {
    page.drawRectangle({ x: 28, y: y - 4, width: W - 56, height: 18, color: rgb(0.92,0.92,0.92) });
    page.drawText(text, { x: 32, y: y, size: 9, font: bold, color: ORANGE });
    return y - 26;
  }

  function row(page, label, value, y, labelW = 170) {
    const lineH = countLines(value, W - 56 - labelW, reg, 8.5) * 13;
    const rowH  = Math.max(18, lineH + 6);
    page.drawRectangle({ x: 28, y: y - rowH + 14, width: labelW, height: rowH, color: rgb(0.97,0.97,0.97) });
    page.drawText(label, { x: 32, y: y, size: 8, font: bold, color: GREY });
    wrapText(page, value, 28 + labelW + 6, y, W - 56 - labelW - 6, reg, 8.5, BLACK);
    return y - rowH - 3;
  }

  function wrapText(page, text, x, y, maxW, font, size, color) {
    const words = text.split(" ");
    let line = "";
    let cy = y;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > maxW && line) {
        page.drawText(line, { x, y: cy, size, font, color });
        cy -= 13;
        line = w;
      } else {
        line = test;
      }
    }
    if (line) page.drawText(line, { x, y: cy, size, font, color });
  }

  function countLines(text, maxW, font, size) {
    const words = text.split(" ");
    let line = "", count = 1;
    for (const w of words) {
      const test = line ? line + " " + w : w;
      if (font.widthOfTextAtSize(test, size) > maxW && line) { count++; line = w; }
      else line = test;
    }
    return count;
  }

  function bullet(page, text, y) {
    page.drawText("•", { x: 32, y, size: 8, font: bold, color: ORANGE });
    wrapText(page, text, 44, y, W - 80, reg, 8.5, BLACK);
    const lines = countLines(text, W - 80, reg, 8.5);
    return y - (lines * 13) - 4;
  }

  /* ══════════════════════════════════════════════════════════════════════
     PAGE 1 — COVER + SECTION 1
  ══════════════════════════════════════════════════════════════════════ */
  const p1 = addPage();

  // Cover block
  p1.drawRectangle({ x: 28, y: H - 140, width: W - 56, height: 80, color: rgb(0.97,0.97,0.97) });
  p1.drawText("IIRSM Course Approval — Full Submission Brief", {
    x: 36, y: H - 80, size: 15, font: bold, color: BLACK,
  });
  p1.drawText("eLearning Application (No Trainer)  |  Chainsaw Maintenance & Cross Cutting  |  Ground Level  |  Version 1.5", {
    x: 36, y: H - 100, size: 8.5, font: reg, color: GREY,
  });
  p1.drawText("Submitted by Overleaf Publishers Ltd  |  chainsawcourses.com  |  July 2026", {
    x: 36, y: H - 116, size: 8, font: obl, color: LGREY,
  });

  let y = H - 158;
  y = sectionHeader(p1, "SECTION 1  |  Course Identity & Operational Specification", y);

  const s1rows = [
    ["Official Course Title",        "Chainsaw Maintenance & Cross Cutting (Ground Level Framework)"],
    ["Course Format",                "eLearning — Progressive Web Application (PWA) combined with an integrated printed manual; no trainer required"],
    ["Publisher",                    "Overleaf Publishers Ltd"],
    ["Course Author / Developer",    "David J Daniel"],
    ["Copyright",                    "Copyright © 2026 Overleaf Publishers Ltd. All rights reserved. First Edition: July 2026"],
    ["Platform URL",                 "chainsawcourses.com"],
    ["Contact Email",                "info@chainsawcourses.com"],
    ["Postal Address",               "69 Newstead Avenue, Orpington, BR6 9RW"],
    ["NOS Alignment",                "Independently mapped to UK National Occupational Standards (NOS) for Chainsaw Operations"],
    ["NPTC Alignment",               "Assessment criteria independently mapped to City & Guilds NPTC 0039-20 unit parameters for theoretical reference and CPD purposes only"],
    ["CPD Points Awarded",           "5 Verifiable CPD Points"],
    ["Guided Learning Hours (GLH)",  "4 Hours — PWA online modules, video content & gated knowledge checks"],
    ["Directed Online Assessment",   "2 Hours — formative module quizzes + 45-question randomised multiple-choice final examination"],
    ["Independent Self-Study",       "4 Hours — reading The Chainsaw Manual & risk assessment exercises"],
    ["Total Qualification Time (TQT)", "10 Hours total"],
    ["Minimum Pass Threshold",       "80% or higher on the summative examination — unlimited resit attempts permitted"],
    ["Target Learner Profile",       "Commercial chainsaw operators, forestry workers, arborists, estate and grounds teams, and landscape professionals"],
    ["Course Version",               "Version 1.5 — submitted for initial IIRSM eLearning Course Approval (1 course)"],
    ["Approval Category",            "New to IIRSM Course Approval — eLearning (no trainer)"],
  ];

  for (const [label, value] of s1rows) {
    y = row(p1, label, value, y);
    if (y < 50) break; // safety — shouldn't happen on page 1
  }

  /* ══════════════════════════════════════════════════════════════════════
     PAGE 2 — SECTION 2 (Developer & Author Credentials)
  ══════════════════════════════════════════════════════════════════════ */
  const p2 = addPage();
  y = H - 68;

  p2.drawText("IIRSM requires full details of who developed the course and their level of knowledge and skills to do so.", {
    x: 28, y, size: 8, font: obl, color: GREY,
  });
  y -= 18;
  y = sectionHeader(p2, "SECTION 2  |  Developer & Author Credentials", y);

  const s2rows = [
    ["Author Name",                  "David J Daniel"],
    ["Role",                         "Course Author, Content Developer & Platform Publisher"],
    ["Organisation",                 "Overleaf Publishers Ltd"],
    ["Chainsaw Qualification",       "City & Guilds NPTC 0039-20 — Chainsaw Maintenance and Cross Cutting (certificated)"],
    ["First Aid Certification",      "Current First Aid at Work certificate held"],
    ["Industry Experience",          "Over 27 years in the arboricultural and forestry industry. Worked as an arboricultural contract climber for numerous large and small companies throughout this period, gaining extensive hands-on operational experience across a wide range of site conditions and chainsaw applications."],
    ["Assessor & Instructor Quals",  "City & Guilds NPTC Assessor and LANTRA Instructor and Assessor for 8 years — covering practical chainsaw assessment and vocational training delivery to industry standard."],
    ["Published Author",             "Author of 'The Chainsaw Manual' — currently sold as a standalone physical learning aid to various colleges and training providers across the UK. The manual underpins the theoretical content of this eLearning course."],
    ["Subject Research",             "Course content developed with reference to current UK HSE guidance, NPTC 0039-20 unit standards, and the Overleaf Chainsaw Manual (published reference text)"],
    ["Platform Development",         "Full-stack eLearning platform designed, developed and operated by author — Progressive Web Application with device-locked access, video streaming, and automated assessment"],
  ];

  for (const [label, value] of s2rows) {
    y = row(p2, label, value, y);
  }

  /* ══════════════════════════════════════════════════════════════════════
     PAGE 3 — SECTION 3 (Course Structure) + SECTION 4 (Technical Spec)
  ══════════════════════════════════════════════════════════════════════ */
  const p3 = addPage();
  y = H - 68;
  y = sectionHeader(p3, "SECTION 3  |  Course Structure & Learning Hours Breakdown", y);

  // TQT summary box
  p3.drawRectangle({ x: 28, y: y - 68, width: W - 56, height: 72, color: rgb(0.97, 0.97, 0.97) });
  p3.drawText("Total Qualification Time (TQT): 10 Hours", { x: 36, y: y - 10, size: 11, font: bold, color: ORANGE });
  p3.drawText("Guided Learning (GLH): 4 Hours", { x: 36, y: y - 26, size: 9, font: bold, color: BLACK });
  p3.drawText("PWA online modules, embedded video content, and gated knowledge checks", { x: 200, y: y - 26, size: 8.5, font: reg, color: GREY });
  p3.drawText("Directed Assessment: 2 Hours", { x: 36, y: y - 40, size: 9, font: bold, color: BLACK });
  p3.drawText("Formative module quizzes + 45-question randomised multiple-choice final examination", { x: 200, y: y - 40, size: 8.5, font: reg, color: GREY });
  p3.drawText("Independent Self-Study: 4 Hours", { x: 36, y: y - 54, size: 9, font: bold, color: BLACK });
  p3.drawText("Reading The Chainsaw Manual & risk assessment exercises", { x: 200, y: y - 54, size: 8.5, font: reg, color: GREY });
  p3.drawText("CPD Points Awarded: 5 Verifiable CPD Points", { x: 36, y: y - 68, size: 9, font: bold, color: ORANGE });
  y -= 84;

  p3.drawText("Course Modules & Content Areas", { x: 28, y, size: 9, font: bold, color: BLACK });
  y -= 16;

  const modules = [
    "Course Requirements — Introduction, digital waiver, PPE requirements, companion manual overview",
    "Assessment Modules (Standards & Regulations) — Health and Safety at Work Act 1974, PUWER 1998, MHOR 1992, risk assessment methodology (5 steps)",
    "Chainsaw Maintenance — Safety features, pre-use checks, air filter, spark plug, cooling system, exhaust, fuel & oil systems, recoil starter, sprocket, chain brake, guidebar, chain identification, sharpening techniques, depth gauges",
    "Cross Cutting — Timber tension & compression, safe working zones, bore cuts, biosecurity, environmental considerations, ergonomics, timber stacking, manual handling",
    "Final Assessment — 45-question randomised examination drawn from full question bank; 80% pass threshold; unlimited resit attempts",
    "Practical Gateway — Post-pass progression document signposting learners to NPTC/Lantra approved assessment centres for practical qualification",
  ];

  for (const m of modules) {
    y = bullet(p3, m, y);
  }

  y -= 10;
  y = sectionHeader(p3, "SECTION 4  |  Platform Technical Specification", y);

  const s4rows = [
    ["Platform Type",   "Progressive Web Application (PWA) — installable on iOS and Android; no app store required"],
    ["Access Control",  "Device-locked activation code system — each learner receives a unique code; prevents credential sharing"],
    ["Video Hosting",   "Vimeo Pro — encrypted streaming; watermark overlays display learner name and email dynamically"],
    ["Assessment",      "Server-side randomised question bank; results stored in PostgreSQL database with full audit trail"],
    ["Digital Waiver",  "Touch/mouse signature capture on first login — legally binding acknowledgement of course terms"],
    ["Certificates",    "Automated PDF certificate issued on passing the final examination — emailed to learner; also saved to secure cloud storage"],
    ["Data Security",   "All data encrypted in transit (TLS 1.3); hosted on Replit deployment infrastructure (EU region)"],
    ["Accessibility",   "WCAG 2.1 AA compliant colour contrast; keyboard navigable; screen-reader compatible markup"],
    ["Browser Support", "Chrome 120+, Safari 16+, Firefox 120+, Edge 120+"],
    ["Companion Manual","Overleaf Chainsaw Manual (printed) — supplied separately; referenced throughout the digital course"],
  ];

  for (const [label, value] of s4rows) {
    y = row(p3, label, value, y);
  }

  /* ══════════════════════════════════════════════════════════════════════
     PAGE 4 — SECTION 5 (Quality Assurance)
  ══════════════════════════════════════════════════════════════════════ */
  const p4 = addPage();
  y = H - 68;
  y = sectionHeader(p4, "SECTION 5  |  Quality Assurance & Review Process", y);

  p4.drawText("Content accuracy is assured through the following quality control measures:", {
    x: 28, y, size: 8.5, font: obl, color: GREY,
  });
  y -= 18;

  const qaBullets = [
    "All module content cross-referenced against current HSE Chainsaw guidance (HSE AFAG series) and City & Guilds NPTC 0039-20 unit specifications.",
    "Quiz questions reviewed by the author against published assessment criteria and common examiner focus areas.",
    "Platform functionality tested across all supported browsers and device types prior to launch.",
    "Annual content review scheduled — first review due July 2027.",
    "Learner feedback captured post-examination and monitored for accuracy and relevance signals.",
    "Any changes to UK legislation or HSE guidance will trigger an unscheduled content review within 30 days of publication.",
    "GLH and TQT figures are conservative and verifiable: 4 hours GLH reflects the actual platform module time; 4 hours independent self-study reflects engagement with the printed Chainsaw Manual; 2 hours directed assessment reflects formative quizzes plus the 45-question final examination.",
  ];

  for (const b of qaBullets) {
    y = bullet(p4, b, y);
  }

  /* save */
  const bytes = await doc.save();
  writeFileSync(OUT, bytes);
  console.log("Written:", OUT, `(${bytes.length} bytes)`);
}

build().catch(e => { console.error(e); process.exit(1); });
