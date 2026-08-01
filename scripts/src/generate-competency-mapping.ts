/**
 * Generates IIRSM_Competency_Framework_Mapping.pdf and writes it to
 * artifacts/chainsaw-training/public/pdfs/
 *
 * Run: pnpm --filter @workspace/scripts exec tsx src/generate-competency-mapping.ts
 *
 * Styled to match the rest of the policy PDFs (pdfkit, logo header, orange
 * rule, clean section headings — same as Refund & Cancellation Policy etc.)
 */
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const OUT_DIR   = path.resolve(__dirname, "../../artifacts/chainsaw-training/public/pdfs");
const LOGO_PATH = path.resolve(__dirname, "../../artifacts/chainsaw-training/public/logo.png");
const OUT       = path.join(OUT_DIR, "IIRSM_Competency_Framework_Mapping.pdf");

const ORANGE = "#e27226";
const DARK   = "#1C1C1C";
const MID    = "#555555";
const LIGHT  = "#888888";
const RULE   = "#CCCCCC";
const SHADE  = "#F3F4F6";

// ─── Shared helpers (mirrors generate-pdfs.ts style) ────────────────────────

function newDoc(title: string): PDFKit.PDFDocument {
  return new PDFDocument({
    margin: 60,
    size: "A4",
    info: { Title: title, Author: "Overleaf Publishers Ltd", Creator: "Chainsaw Courses" },
  });
}

function drawPageHeader(doc: PDFKit.PDFDocument): void {
  const logoSize = 52;
  const hY = 60;
  if (fs.existsSync(LOGO_PATH)) {
    doc.image(LOGO_PATH, 60, hY, { width: logoSize, height: logoSize });
  }
  const tX = fs.existsSync(LOGO_PATH) ? 60 + logoSize + 12 : 60;
  doc
    .fontSize(13).fillColor(ORANGE).font("Helvetica-Bold")
    .text("Chainsaw Courses", tX, hY + 4, { lineBreak: false });
  doc
    .fontSize(9).fillColor(MID).font("Helvetica")
    .text("CHAINSAW MAINTENANCE & CROSS CUTTING  ·  OVERLEAF PUBLISHERS LTD", tX, hY + 30, { lineBreak: false });
  doc.text("", 60, hY + logoSize + 8);
  doc
    .moveTo(60, doc.y).lineTo(535, doc.y)
    .strokeColor(ORANGE).lineWidth(1.5).stroke();
  doc.moveDown(0.8);
}

function drawFooter(doc: PDFKit.PDFDocument, docTitle: string, version = "Version 1.0"): void {
  const bot = doc.page.height - 52;
  doc
    .moveTo(60, bot).lineTo(535, bot)
    .strokeColor(RULE).lineWidth(0.5).stroke();
  doc
    .fontSize(7).fillColor(LIGHT).font("Helvetica")
    .text(
      `${docTitle}  ·  Overleaf Publishers Ltd  ·  Co. No. 15735226  ·  VAT 479581629  ·  chainsawcourses.com  ·  ${version}  ·  July 2026  ·  Confidential`,
      60, bot + 8, { lineBreak: false }
    );
}

function sectionHeading(doc: PDFKit.PDFDocument, text: string): void {
  doc.moveDown(0.6);
  doc
    .fontSize(8.5).fillColor(ORANGE).font("Helvetica-Bold")
    .text(text.toUpperCase(), { characterSpacing: 0.5 });
  doc.moveDown(0.25);
  doc
    .moveTo(60, doc.y).lineTo(535, doc.y)
    .strokeColor(ORANGE).lineWidth(0.5).stroke();
  doc.moveDown(0.4);
}

function subHeading(doc: PDFKit.PDFDocument, text: string): void {
  doc.moveDown(0.4);
  doc
    .fontSize(8.5).fillColor(DARK).font("Helvetica-Bold")
    .text(text.toUpperCase(), { characterSpacing: 0.3 });
  doc.moveDown(0.2);
  doc
    .moveTo(60, doc.y).lineTo(535, doc.y)
    .strokeColor(RULE).lineWidth(0.5).stroke();
  doc.moveDown(0.35);
}

function docTitle(doc: PDFKit.PDFDocument, text: string): void {
  doc
    .fontSize(16).fillColor(DARK).font("Helvetica-Bold")
    .text(text, { align: "left" });
  doc.moveDown(0.2);
  doc
    .fontSize(8).fillColor(MID).font("Helvetica")
    .text("Overleaf Publishers Ltd  ·  Co. No. 15735226  ·  VAT No. 479581629  ·  Version 1.0  ·  July 2026  ·  chainsawcourses.com");
  doc.moveDown(1);
}

function infoRow(doc: PDFKit.PDFDocument, label: string, value: string): void {
  const y = doc.y;
  doc
    .fontSize(8.5).fillColor(MID).font("Helvetica-Bold")
    .text(label, 60, y, { width: 155, lineBreak: false });
  doc
    .fontSize(9).fillColor(DARK).font("Helvetica")
    .text(value, 220, y, { width: 315 });
  doc.moveDown(0.25);
}

function body(doc: PDFKit.PDFDocument, text: string, gap = 4): void {
  doc
    .fontSize(9.5).fillColor(DARK).font("Helvetica")
    .text(text, { lineGap: gap, paragraphGap: 3 });
}

function bullet(doc: PDFKit.PDFDocument, items: string[]): void {
  items.forEach((item) => {
    doc
      .fontSize(9.5).fillColor(DARK).font("Helvetica")
      .text(`•   ${item}`, { indent: 8, lineGap: 3 });
  });
}

function twoColTable(
  doc: PDFKit.PDFDocument,
  headers: [string, string],
  rows: [string, string][],
  col1W = 175
): void {
  if (doc.y > doc.page.height - 160) {
    doc.addPage();
    drawPageHeader(doc);
  }
  let y = doc.y;

  // Header row
  doc.rect(60, y, 475, 26).fill(ORANGE);
  doc
    .fontSize(8.5).fillColor("#FFFFFF").font("Helvetica-Bold")
    .text(headers[0].toUpperCase(), 68, y + 8, { width: col1W - 16, lineBreak: false });
  doc
    .fontSize(8.5).fillColor("#FFFFFF").font("Helvetica-Bold")
    .text(headers[1].toUpperCase(), 60 + col1W + 8, y + 8, { width: 475 - col1W - 16, lineBreak: false });
  y += 26;

  rows.forEach(([c1, c2], i) => {
    if (y > doc.page.height - 100) {
      doc.addPage();
      drawPageHeader(doc);
      y = doc.y;
    }
    const dynH = Math.max(26, Math.ceil(c2.length / 52) * 13 + 10);
    if (i % 2 === 0) doc.rect(60, y, 475, dynH).fill(SHADE);
    doc.rect(60, y, 475, dynH).strokeColor(RULE).lineWidth(0.4).stroke();
    doc
      .fontSize(8.5).fillColor(DARK).font("Helvetica-Bold")
      .text(c1, 68, y + 7, { width: col1W - 16, lineBreak: true });
    doc
      .fontSize(8.5).fillColor(DARK).font("Helvetica")
      .text(c2, 60 + col1W + 8, y + 7, { width: 475 - col1W - 16, lineBreak: c2.length > 60 });
    y += dynH;
  });

  doc.text("", 60, y + 4);
  doc.moveDown(0.5);
}

function save(doc: PDFKit.PDFDocument, outPath: string, footerTitle: string, version = "Version 1.0"): Promise<void> {
  return new Promise((resolve, reject) => {
    const stream = fs.createWriteStream(outPath);
    doc.on("pageAdded", () => drawFooter(doc, footerTitle, version));
    doc.pipe(stream);
    drawFooter(doc, footerTitle, version);
    doc.end();
    stream.on("finish", () => { console.log(`✓ Written → ${outPath}`); resolve(); });
    stream.on("error", reject);
  });
}

// ─── Document ────────────────────────────────────────────────────────────────

async function generate(): Promise<void> {
  const doc = newDoc("IIRSM Competency Framework Mapping");
  drawPageHeader(doc);
  docTitle(doc, "IIRSM Competency Framework Mapping");

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  infoRow(doc, "Document Date",    today);
  infoRow(doc, "Version",          "1.0");
  infoRow(doc, "Course Format",    "eLearning (no trainer)");
  infoRow(doc, "Application Type", "New to IIRSM Course Approval");
  infoRow(doc, "Approval Sought",  "Initial 18-month approval (1–5 courses)");
  infoRow(doc, "Framework Source", "IIRSM Risk Management and Leadership Competence Framework (official)");
  doc.moveDown(0.5);

  // ── 1. Purpose ─────────────────────────────────────────────────────────────
  sectionHeading(doc, "1.  Purpose of This Document");
  body(doc,
    "This document maps the content of the Chainsaw Cross-Cutting eLearning course against the " +
    "IIRSM Risk Management and Leadership Competence Framework. It identifies, for each applicable " +
    "competency area, the specific framework statement at Operational (Associate) level that the " +
    "course addresses, together with the modules through which that competence is developed. " +
    "It is prepared to support the IIRSM Course Approval application submitted via SurveyMonkey."
  );

  // ── 2. Course Scope ─────────────────────────────────────────────────────────
  sectionHeading(doc, "2.  Course Scope and Positioning");
  body(doc,
    "This eLearning course provides the theoretical knowledge and understanding required to support " +
    "candidates preparing for the NPTC Unit CS30 / CS31 practical chainsaw certification. It does " +
    "not constitute legal authorisation to operate a chainsaw and does not replace the mandatory " +
    "practical assessment conducted by a LANTRA or NPTC-approved assessor."
  );
  doc.moveDown(0.3);
  body(doc,
    "The course operates at the Operational level of the IIRSM framework — developing knowledge " +
    "and understanding with some application — consistent with the Associate membership grade. " +
    "No Managerial or Strategic competences are claimed."
  );

  // ── 3. Modules Overview ─────────────────────────────────────────────────────
  sectionHeading(doc, "3.  Course Modules Overview");
  twoColTable(
    doc,
    ["Module Group", "Modules Included"],
    [
      ["Course Requirements",
       "Equipment List (M8)"],
      ["Standards & Regulations",
       "PPE & First Aid (M9) · 5 Steps To Risk Assessment (M10) · Hazards & Risks (M11) · " +
       "Emergency Planning Information (M12) · Law & Regulations (M13) · Chainsaw Safety Features (M14)"],
      ["Chainsaw Maintenance",
       "Battery Chainsaws (M40) · Air Filter (M15) · Spark Plug (M16) · Cooling System (M17) · " +
       "Exhaust (M18) · Fuel & Oil Filters (M19) · Oiling System (M41) · Recoil Starter (M20) · " +
       "Clutch Assembly (M21) · Sprocket (M22) · Chain Brake (M23) · Guidebar (M24) · " +
       "Chain Basics–Sharpening (M25–M29)"],
      ["Cross-Cutting Techniques",
       "Kickback (M42) · Work Positioning (M31) · Pre-Start Checks (M32) · Starting The Chainsaw (M33) · " +
       "Pre-Use Checks (M34) · Cutting Basics (M35) · Tension & Compression (M36) · " +
       "Releasing A Trapped Chainsaw (M37) · Bore Cutting (M38) · Oversized & Tensioned Timber (M39) · " +
       "Stacking (M30) · Additional Cuts (M43)"],
    ],
    175
  );

  // ── 4. Competency Framework Mapping ─────────────────────────────────────────
  sectionHeading(doc, "4.  Competency Framework Mapping  (Operational / Associate Level)");
  body(doc,
    "Only competency areas genuinely addressed by this course are included. The three domains of the " +
    "IIRSM framework are: Technical Competences, Leadership Behaviours, and Business Competences. " +
    "Framework statements are quoted or paraphrased directly from the IIRSM Risk Management and " +
    "Leadership Competence Framework at the Operational (Associate) level."
  );
  doc.moveDown(0.4);

  // Technical Competences
  subHeading(doc, "Domain A — Technical Competences");
  twoColTable(
    doc,
    ["Competency Area", "Framework Statement (Operational Level) & Course Modules"],
    [
      ["The Role of Risk Management",
       "Identifies, assesses and controls risks in day-to-day activities and within projects.\n" +
       "Modules: 5 Steps To Risk Assessment (M10) · Hazards & Risks (M11) · PPE & First Aid (M9) · " +
       "Chainsaw Safety Features (M14) · Kickback (M42) · Pre-Start Checks (M32) · Pre-Use Checks (M34) · " +
       "Tension & Compression (M36) · Bore Cutting (M38) · Oversized & Tensioned Timber (M39)"],
      ["Strategy, Objectives, Policy & Procedures",
       "Supports others to work using established risk policies and procedures in day-to-day activities. " +
       "Identifies and escalates opportunities to improve risk policies and procedures.\n" +
       "Modules: Law & Regulations (M13) · PPE & First Aid (M9) · Pre-Start Checks (M32) · " +
       "Pre-Use Checks (M34) · Work Positioning (M31) · Chain Brake (M23)"],
      ["Stakeholder Engagement",
       "Provides technical advice to support collaborative working across different functions. " +
       "Encourages stakeholders to adopt risk principles.\n" +
       "Modules: Emergency Planning Information (M12) · PPE & First Aid (M9) · Hazards & Risks (M11)"],
      ["Data Management",
       "Collects and sorts data in accordance with company standards and legislation. " +
       "Carries out preliminary analysis assessing the reliability of data.\n" +
       "Modules: Pre-Start Checks (M32) · Pre-Use Checks (M34) · 5 Steps To Risk Assessment (M10) — " +
       "learners collect and record inspection and risk data as part of structured checklists."],
    ],
    175
  );

  // Leadership Behaviours
  subHeading(doc, "Domain B — Leadership Behaviours");
  twoColTable(
    doc,
    ["Competency Area", "Framework Statement (Operational Level) & Course Modules"],
    [
      ["Communicative",
       "Listens to instructions and asks questions if in doubt. Captures and presents information " +
       "on operational performance in a way which is understood by others.\n" +
       "Modules: Emergency Planning Information (M12) · Hazards & Risks (M11) · " +
       "Work Positioning (M31) · Stacking (M30)"],
      ["Systematic",
       "Plans work, selecting appropriate methods to meet objectives and KPIs. Undertakes work in " +
       "accordance with agreed work methods and procedures. Reviews activities regularly.\n" +
       "Modules: 5 Steps To Risk Assessment (M10) · Pre-Start Checks (M32) · Pre-Use Checks (M34) · " +
       "Starting The Chainsaw (M33) · Work Positioning (M31) · Chain Tension (M26) · " +
       "Chain Sharpening (M29) · Bore Cutting (M38) · Additional Cuts (M43)"],
      ["Determined",
       "Delivers consistently and professionally and overcomes challenges, applying alternative methods " +
       "when needed. Focuses on the delivery of work objectives without compromising values or behaviours.\n" +
       "Modules: Releasing A Trapped Chainsaw (M37) · Oversized & Tensioned Timber (M39) · " +
       "Cutting Basics (M35) · Tension & Compression (M36) · Kickback (M42)"],
      ["Ethical",
       "Demonstrates positive behaviours. Recognises inappropriate behaviours and raises concerns " +
       "appropriately.\n" +
       "Modules: Law & Regulations (M13) · PPE & First Aid (M9) · Chain Brake (M23) · " +
       "Work Positioning (M31) — course emphasises legal and safe conduct as non-negotiable."],
      ["Innovative",
       "Contributes to discussions on new ways of working to resolve challenges and suggests " +
       "opportunities. Open to learning from others.\n" +
       "Modules: Battery Chainsaws (M40) · Additional Cuts (M43) · Bore Cutting (M38) · " +
       "Releasing A Trapped Chainsaw (M37)"],
    ],
    175
  );

  // Business Competences
  subHeading(doc, "Domain C — Business Competences");
  twoColTable(
    doc,
    ["Competency Area", "Framework Statement (Operational Level) & Course Modules"],
    [
      ["Compliance and Legal Responsibility",
       "Demonstrates an awareness of the key aspects of internal and external rules, regulations, " +
       "and obligations that the organisation must comply with. Understands sources of change to " +
       "legal, regulatory and contractual obligations.\n" +
       "Modules: Law & Regulations (M13) · Chainsaw Safety Features (M14) · PPE & First Aid (M9) · " +
       "Chain Brake (M23) — covering HSWA 1974, PUWER 1998, MHOR 1992, COSHH 2002, PPE Regulations, " +
       "BS EN 381 series."],
      ["Governance and Culture",
       "Understands their role and responsibilities in supporting effective governance. Acts as a " +
       "role model for others and behaves ethically and with integrity.\n" +
       "Modules: Law & Regulations (M13) · Pre-Start Checks (M32) · Pre-Use Checks (M34) · " +
       "PPE & First Aid (M9) · Equipment List (M8)"],
    ],
    175
  );

  // ── 5. Quality Assurance ─────────────────────────────────────────────────────
  sectionHeading(doc, "5.  Quality Assurance — Evidence for IIRSM");
  twoColTable(
    doc,
    ["Evidence Area", "Detail"],
    [
      ["Delegate Feedback",
       "Module-level star ratings and written comments collected after each module. Course-level feedback " +
       "collected on completion. All records are timestamped and stored in a tamper-evident database. " +
       "Minimum 12-month retention. Exportable on request."],
      ["Feedback into Course Development",
       "Feedback is reviewed quarterly by the course developer. A dedicated admin dashboard provides " +
       "exportable feedback reports. Course content is updated following patterns of negative feedback " +
       "or any change to relevant legislation or HSE/FISA guidance."],
      ["Assessment Records",
       "All quiz attempts, scores, and pass/fail outcomes are stored per learner with full timestamps. " +
       "Mock and final exam results are retained separately. All data is exportable via the Google Sheets " +
       "backup system for external audit."],
      ["Learner Progress & Completion",
       "Platform tracks video watched status, quiz pass status, and timestamps for each of the 35 modules " +
       "per learner. A completion certificate bearing the course title is issued only upon full course " +
       "and final exam completion."],
      ["Platform Access for IIRSM Assessors",
       "IIRSM assessors will be granted: (a) a full learner account to experience the course as a delegate, " +
       "and (b) a read-only admin account to review all learner data, feedback, quiz scores, and " +
       "assessment records."],
    ],
    175
  );

  // ── 6. Declaration ───────────────────────────────────────────────────────────
  sectionHeading(doc, "6.  Declaration");
  body(doc,
    "I confirm that the information provided in this document and the accompanying IIRSM Course " +
    "Approval application is accurate and complete to the best of my knowledge. The course content " +
    "aligns to the IIRSM Risk Management and Leadership Competence Framework at the Operational " +
    "(Associate) level as mapped above. I undertake to notify IIRSM of any material changes to " +
    "course content or organisational policies during the period of approval."
  );

  doc.moveDown(1.5);
  doc.moveTo(60, doc.y).lineTo(220, doc.y).strokeColor(DARK).lineWidth(0.75).stroke();
  doc.moveDown(0.3);
  doc.fontSize(8).fillColor(MID).font("Helvetica").text("Signature");
  doc.moveDown(1.2);
  doc.moveTo(60, doc.y).lineTo(220, doc.y).strokeColor(DARK).lineWidth(0.75).stroke();
  doc.moveDown(0.3);
  doc.fontSize(8).fillColor(MID).font("Helvetica").text(`Date: ${today}`);

  doc.moveDown(1);
  body(doc, "For queries: info@chainsawcourses.com  ·  Overleaf Publishers Ltd");

  fs.mkdirSync(OUT_DIR, { recursive: true });
  await save(doc, OUT, "IIRSM Competency Framework Mapping");
}

generate().catch((e) => { console.error(e); process.exit(1); });
