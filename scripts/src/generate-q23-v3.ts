/**
 * Q23 Course Materials Pack v3
 * Light branded design, tight layout, natural pdfkit flow
 * No explicit y coordinates on flowing text — prevents double-spacing
 */
import PDFDocument from "pdfkit";
import * as fs from "fs";
import { fileURLToPath } from "url";
import * as path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Brand ────────────────────────────────────────────────────────────────────
const OG   = "#E27226";
const OGD  = "#B85A18";
const OGL  = "#FEF3E8";
const BLK  = "#1a1a1a";
const DGY  = "#333333";
const MGY  = "#777777";
const LGY  = "#f5f5f5";
const RUL  = "#dddddd";
const WHT  = "#ffffff";

const LOGO  = "/home/runner/workspace/artifacts/chainsaw-training/public/logo.png";
const IIRSM = "/home/runner/workspace/artifacts/chainsaw-training/public/iirsm-rosette-logo.png";
const OUT   = "/home/runner/workspace/artifacts/chainsaw-training/public/pdfs/Q23_Course_Materials_Pack.pdf";
const OPTS  = ["A","B","C","D"];

// ─── Data ─────────────────────────────────────────────────────────────────────
const examQs: Array<{
  id: number; question: string; options: string;
  correct_option: number; learning_outcome: string; assessment_criteria: string;
}> = JSON.parse(fs.readFileSync("/tmp/prod_exam_qs.json","utf8"));

const mockQs: Array<{
  id: number; question: string; keyPoints: string[];
}> = JSON.parse(fs.readFileSync("/tmp/prod_mock_simple.json","utf8"));

// ─── Document ─────────────────────────────────────────────────────────────────
const ML = 52, MR = 52, MT = 50, MB = 50;
const doc = new PDFDocument({
  size: "A4",
  margins: { top: MT, bottom: MB, left: ML, right: MR },
  info: { Title: "Course Materials Pack", Author: "Chainsaw Courses Ltd" },
});
const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

const PW = doc.page.width;   // 595.28
const PH = doc.page.height;  // 841.89
const CW = PW - ML - MR;     // 491.28

let pageNum = 0;
doc.on("pageAdded", () => { pageNum++; });

// ─── Utilities ────────────────────────────────────────────────────────────────

function rule(col = RUL, thick = 0.5) {
  doc.save()
    .moveTo(ML, doc.y).lineTo(ML + CW, doc.y)
    .strokeColor(col).lineWidth(thick).stroke()
    .restore();
}

function gap(n: number) { doc.y += n; }

/** Estimate text height in pts for a given string at given chars-per-line */
function textH(str: string, cpl: number, lh: number) {
  return Math.ceil(str.length / cpl + 1) * lh;
}

/** Ensure `pts` of space remain; new page if not */
function need(pts: number) {
  if (doc.y + pts > PH - MB - 4) {
    renderFooter();
    doc.addPage();
  }
}

function renderFooter() {
  const fy = PH - MB + 4;
  doc.save()
    .moveTo(ML, fy - 3).lineTo(ML + CW, fy - 3)
    .strokeColor(OG).lineWidth(0.8).stroke()
    .font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text("Chainsaw Maintenance & Cross Cutting  ·  Course Materials Pack", ML, fy,
      { width: CW - 30, align: "left", lineBreak: false })
    .text(String(pageNum), ML, fy, { width: CW, align: "right", lineBreak: false })
    .restore();
}

/** Inline section heading — orange left stripe + pale orange bg */
function sectionHead(n: string, title: string, sub = "") {
  const h = sub ? 46 : 36;
  need(h + 30);
  const y = doc.y;
  doc.rect(ML, y, 5, h).fill(OG);
  doc.rect(ML + 5, y, CW - 5, h).fill(OGL);
  doc.save()
    .font("Helvetica-Bold").fontSize(6.5).fillColor(OGD)
    .text(`SECTION ${n}`, ML + 12, y + 5, { lineBreak: false })
    .restore();
  doc.save()
    .font("Helvetica-Bold").fontSize(13).fillColor(BLK)
    .text(title, ML + 12, y + 14, { width: PW - ML - MR - 80, lineBreak: false })
    .restore();
  if (sub) {
    doc.save()
      .font("Helvetica").fontSize(8).fillColor(MGY)
      .text(sub, ML + 12, y + 32, { lineBreak: false })
      .restore();
  }
  doc.y = y + h + 10;
}

/** Pale orange info/notice box. Height auto-calculated. */
function infoBox(heading: string, body: string) {
  const bodyH = textH(body, 88, 12.5);
  const h = 26 + bodyH;
  need(h + 8);
  const y = doc.y;
  doc.rect(ML, y, 5, h).fill(OG);
  doc.rect(ML + 5, y, CW - 5, h).fill(OGL);
  doc.save()
    .font("Helvetica-Bold").fontSize(9.5).fillColor(OGD)
    .text(heading, ML + 12, y + 7, { width: CW - 20, lineBreak: false })
    .restore();
  doc.save()
    .font("Helvetica").fontSize(9).fillColor(DGY)
    .text(body, ML + 12, y + 21, { width: CW - 20 })
    .restore();
  doc.y = y + h + 8;
}

/** Numbered step row */
function stepRow(n: number, text: string, bgCol = OG) {
  // Estimate height
  const h = textH(text, 88, 13) + 4;
  need(h + 4);
  const y = doc.y;
  doc.rect(ML, y, 22, Math.max(h, 16)).fill(bgCol);
  doc.save()
    .font("Helvetica-Bold").fontSize(8).fillColor(WHT)
    .text(String(n), ML, y + 4, { width: 22, align: "center", lineBreak: false })
    .restore();
  // Text to the right — let it flow naturally
  doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
    .text(text, ML + 28, y + 3, { width: CW - 30 });
  // doc.y is now below the text (set by the text() call above)
  doc.y += 4;
}

// ════════════════════════════════════════════════════════════════════════════════
// COVER PAGE
// ════════════════════════════════════════════════════════════════════════════════
pageNum = 1;

// Orange top band
doc.rect(0, 0, PW, 100).fill(OG);
// Logo on orange
doc.image(LOGO, ML, 10, { height: 72 });
// Wordmark
doc.save()
  .font("Helvetica-Bold").fontSize(22).fillColor(WHT)
  .text("CHAINSAW COURSES", ML + 80, 20, { lineBreak: false })
  .restore();
doc.save()
  .font("Helvetica").fontSize(8.5).fillColor("#FFE0C0")
  .text("chainsawcourses.com  ·  app.chainsawcourses.com", ML + 80, 48, { lineBreak: false })
  .restore();
// IIRSM mark top-right
doc.image(IIRSM, PW - MR - 56, 12, { height: 60 });
doc.save()
  .font("Helvetica").fontSize(6.5).fillColor("#FFE0C0")
  .text("IIRSM Course Approval", PW - MR - 62, 77, { width: 68, align: "center", lineBreak: false })
  .restore();

// Title block
doc.save()
  .font("Helvetica-Bold").fontSize(22).fillColor(BLK)
  .text("Course Materials Pack", ML, 118, { lineBreak: false })
  .restore();
doc.save()
  .font("Helvetica").fontSize(12).fillColor(DGY)
  .text("Chainsaw Maintenance & Cross Cutting", ML, 146, { lineBreak: false })
  .restore();
doc.save()
  .font("Helvetica").fontSize(9).fillColor(MGY)
  .text("Submitted in support of IIRSM Course Approval — Question 23", ML, 163, { lineBreak: false })
  .restore();

doc.y = 183;
doc.moveTo(ML, 183).lineTo(ML + CW, 183).strokeColor(OG).lineWidth(1.2).stroke();
doc.y = 193;

// Summary table
[
  ["Course",    "Chainsaw Maintenance & Cross Cutting (NPTC CS30/CS31 Aligned)"],
  ["Provider",  "Chainsaw Courses Ltd  ·  chainsawcourses.com"],
  ["Delivery",  "Fully Online — E-Learning (self-paced)"],
  ["Hours",     "4 hrs GLH  ·  2 hrs Assessment  ·  4 hrs Self-Study  ·  10 hrs TQT"],
  ["CPD",       "5 CPD Points (IIRSM)"],
  ["Threshold", "80% pass — randomised 45-question summative examination"],
  ["Purpose",   "Training presentation & delegate materials (Q23)"],
].forEach(([label, value], i) => {
  const y = doc.y;
  if (i % 2 === 0) doc.rect(ML, y, CW, 16).fill(LGY);
  doc.save()
    .font("Helvetica-Bold").fontSize(8.5).fillColor(OGD)
    .text(label, ML + 6, y + 4, { width: 68, lineBreak: false })
    .restore();
  doc.save()
    .font("Helvetica").fontSize(8.5).fillColor(DGY)
    .text(value, ML + 80, y + 4, { width: CW - 84, lineBreak: false })
    .restore();
  doc.y = y + 16;
});

gap(12);
rule();
gap(10);

// Contents
doc.save()
  .font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
  .text("Contents", ML, doc.y, { lineBreak: false })
  .restore();
gap(10);

[
  ["1", `How to Access the Live App & Admin Panel`],
  ["2", `A Note on the Training Manual`],
  ["3", `Assessment Bank — ${examQs.length} Multiple-Choice Questions`],
  ["4", `Supplementary Oral & Practical Mock Questions (${mockQs.length})`],
].forEach(([n, title]) => {
  const y = doc.y;
  doc.rect(ML, y, 20, 16).fill(OG);
  doc.save()
    .font("Helvetica-Bold").fontSize(8).fillColor(WHT)
    .text(n, ML, y + 4, { width: 20, align: "center", lineBreak: false })
    .restore();
  doc.save()
    .font("Helvetica").fontSize(9.5).fillColor(DGY)
    .text(title, ML + 26, y + 4, { lineBreak: false })
    .restore();
  doc.y = y + 20;
});

renderFooter();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 1 — APP ACCESS
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("1","How to Access the Live App & Admin Panel",
  "All content unlocked for IIRSM assessors");

doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
  .text("The course is delivered through a custom-built e-learning platform. All video modules, quizzes, AI-assisted mock practice, examination, and certificate generation are accessible via the two routes below.", ML, doc.y, { width: CW });
gap(12);

doc.save().font("Helvetica-Bold").fontSize(10).fillColor(BLK)
  .text("Admin / Assessor Access — All Content Unlocked", ML, doc.y).restore();
gap(8);
[
  "Go to  app.chainsawcourses.com",
  "Scroll to the bottom of the screen and click the 'Admin Panel' button.",
  "Enter the admin credentials when prompted — the full admin dashboard will appear.",
  "Explore the dashboard tabs: Feedback, Backup, Storage, Policy Documents and more.",
  "All Export buttons send data directly to protected Google Drive storage.",
  "Click 'APP PREVIEW' in the top-right corner of the dashboard to enter the fully unlocked app.",
  "All videos, certificates, and IIRSM-referenced content are available for review.",
].forEach((s, i) => stepRow(i + 1, s));

gap(12);
rule();
gap(12);

doc.save().font("Helvetica-Bold").fontSize(10).fillColor(BLK)
  .text("New Learner Journey — Standard Access Route", ML, doc.y).restore();
gap(6);
doc.font("Helvetica").fontSize(9).fillColor(MGY)
  .text("To experience the app exactly as a learner — waiver, sequential locking, quiz flow. The app is under internal testing and has not been publicly released.", ML, doc.y, { width: CW });
gap(10);
[
  "Log out of the admin panel (or open an incognito browser window).",
  "Go to  app.chainsawcourses.com  and enter login code:  CHAIN",
  "Enter a name and email address of your choice.",
  "You will be directed to the Liability Waiver — accept to enter the course.",
  "Each module is locked until the previous video is fully watched and the quiz completed.",
  "On completion, the 45-question exam unlocks. An 80% pass auto-generates the IIRSM certificate.",
].forEach((s, i) => stepRow(i + 1, s, BLK));

renderFooter();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 2 — MANUAL
// ════════════════════════════════════════════════════════════════════════════════
need(160);
gap(14); rule(); gap(12);
sectionHead("2","A Note on the Training Manual","File size & access options");

doc.font("Helvetica").fontSize(9.5).fillColor(DGY)
  .text("The training manual — Chainsaw Maintenance & Cross Cutting: A Comprehensive Technical Manual (v1.1) — is the primary delegate learning resource. It is a richly illustrated 138-page document covering all Learning Outcomes and Assessment Criteria, including Advanced Workshop Extension modules.", ML, doc.y, { width: CW });
gap(12);

infoBox("File Size Notice",
  "The manual PDF is approximately 71 MB due to high-resolution diagrams and photographs. This exceeds most standard upload limits and cannot be attached directly to this IIRSM submission.");

doc.save().font("Helvetica-Bold").fontSize(10).fillColor(BLK)
  .text("How to obtain the manual:", ML, doc.y).restore();
gap(10);

[
  { label: "Option A — View within the App (Recommended)",
    body: "The full manual is embedded within the course platform. After logging in via the Admin Access route in Section 1, click APP PREVIEW. The manual is available as a downloadable reference throughout the course. All supporting policy documents are also accessible via the Admin Dashboard." },
  { label: "Option B — WeTransfer / Secure File Share",
    body: "A copy can be provided on request via WeTransfer or similar. Contact David Daniel at chainsawcourses.com — the file will be sent within one working day." },
].forEach(({ label, body }) => {
  const bodyH = textH(body, 88, 12.5);
  const h = 26 + bodyH;
  need(h + 8);
  const y = doc.y;
  doc.rect(ML, y, 5, h).fill(OG);
  doc.rect(ML + 5, y, CW - 5, h).fill(LGY);
  doc.save()
    .font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
    .text(label, ML + 12, y + 7, { width: CW - 20, lineBreak: false })
    .restore();
  doc.font("Helvetica").fontSize(9).fillColor(DGY)
    .text(body, ML + 12, y + 21, { width: CW - 20 });
  doc.y = y + h + 8;
});

renderFooter();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 3 — ASSESSMENT BANK
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("3","Assessment Bank",
  `${examQs.length} Multiple-Choice Questions  ·  Summative Examination Pool`);

infoBox("How the exam works",
  `The summative examination draws a randomised 45 questions from this ${examQs.length}-question bank. All questions are mapped to their Learning Outcome (LO) and Assessment Criterion (AC). Learners must score 80% or above to pass and generate their IIRSM certificate. Correct answers are marked in orange with ✓.`);

examQs.forEach((q, i) => {
  const options: string[] = JSON.parse(q.options);

  // Estimate block height (conservative so we never overflow)
  const qH   = textH(q.question, 75, 13);
  const optsH = options.reduce((s, o, oi) => {
    return s + textH(`${OPTS[oi]}.  ${o}  ✓`, 75, 12);
  }, 0);
  const blkH = 22 + qH + optsH + 14;
  need(blkH);

  const y0 = doc.y;

  // Alternating row background
  if (i % 2 === 0) doc.rect(ML, y0, CW, blkH).fill(LGY);

  // Number badge
  doc.rect(ML, y0, 30, 16).fill(OG);
  doc.save()
    .font("Helvetica-Bold").fontSize(8).fillColor(WHT)
    .text(`Q${i+1}`, ML, y0 + 4, { width: 30, align: "center", lineBreak: false })
    .restore();

  // LO / AC (top-right, no y advance)
  doc.save()
    .font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text(`${q.learning_outcome}  ·  ${q.assessment_criteria}`, ML + 32, y0 + 5,
      { width: CW - 34, align: "right", lineBreak: false })
    .restore();

  // Question — flowing text, starts below badge
  doc.y = y0 + 20;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
    .text(q.question, ML + 6, doc.y, { width: CW - 12 });
  // doc.y is now below question text (set by pdfkit)
  gap(2);

  // Options
  options.forEach((opt, oi) => {
    const correct = oi === q.correct_option;
    const label = `${OPTS[oi]}.  ${opt}${correct ? "  ✓" : ""}`;
    const optH  = textH(label, 75, 12);
    if (correct) doc.rect(ML + 6, doc.y - 1, CW - 8, optH + 2).fill(OGL);
    doc.font(correct ? "Helvetica-Bold" : "Helvetica")
      .fontSize(9).fillColor(correct ? OG : MGY)
      .text(label, ML + 14, doc.y, { width: CW - 20 });
    // doc.y advances automatically after each .text() call
  });

  gap(6);
  rule(RUL, 0.4);
  gap(4);
});

renderFooter();

// ════════════════════════════════════════════════════════════════════════════════
// SECTION 4 — MOCK QUESTIONS
// ════════════════════════════════════════════════════════════════════════════════
doc.addPage();
sectionHead("4","Supplementary Oral & Practical Mock Questions",
  `${mockQs.length} Questions  ·  Formative Practice Only — Not Formally Assessed`);

infoBox("Important — these questions do not contribute to the pass/fail outcome",
  `These ${mockQs.length} questions are oral and practical preparation aids. They do NOT form part of the summative examination, do NOT appear on the certificate, and are NOT formally assessed. Within the app, learners practise them via an AI-assisted voice or text response feature that provides formative feedback.`);

mockQs.forEach((q, i) => {
  const hasKP  = q.keyPoints.length > 0;
  const qH     = textH(q.question, 75, 13);
  const kpH    = hasKP
    ? q.keyPoints.reduce((s, kp) => s + textH(`•  ${kp}`, 78, 11), 0) + 16
    : 0;
  const blkH   = 22 + qH + kpH + 12;
  need(blkH);

  const y0 = doc.y;
  if (i % 2 === 0) doc.rect(ML, y0, CW, blkH).fill(LGY);

  // Number badge
  doc.rect(ML, y0, 30, 16).fill(BLK);
  doc.save()
    .font("Helvetica-Bold").fontSize(8).fillColor(OG)
    .text(`M${i+1}`, ML, y0 + 4, { width: 30, align: "center", lineBreak: false })
    .restore();
  doc.save()
    .font("Helvetica").fontSize(7.5).fillColor(MGY)
    .text("Oral / Practical  ·  Formative Only", ML + 32, y0 + 5,
      { width: CW - 34, align: "right", lineBreak: false })
    .restore();

  doc.y = y0 + 20;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(BLK)
    .text(q.question, ML + 6, doc.y, { width: CW - 12 });
  gap(2);

  if (hasKP) {
    doc.save()
      .font("Helvetica-Oblique").fontSize(8).fillColor(OG)
      .text("Key points:", ML + 14, doc.y, { lineBreak: false })
      .restore();
    gap(11);
    q.keyPoints.forEach(kp => {
      doc.font("Helvetica").fontSize(8.5).fillColor(DGY)
        .text(`•  ${kp}`, ML + 18, doc.y, { width: CW - 26 });
    });
  }

  gap(5);
  rule(RUL, 0.4);
  gap(4);
});

// End bar
need(36);
gap(10);
doc.rect(ML, doc.y, CW, 28).fill(OG);
doc.save()
  .font("Helvetica-Bold").fontSize(9).fillColor(WHT)
  .text("End of Course Materials Pack  ·  chainsawcourses.com  ·  © 2026 Chainsaw Courses Ltd",
    ML, doc.y + 10, { width: CW, align: "center", lineBreak: false })
  .restore();
doc.y += 38;

renderFooter();

// ─── Output ───────────────────────────────────────────────────────────────────
doc.end();
stream.on("finish", () => {
  const info = fs.statSync(OUT);
  console.log(`✅  ${Math.round(info.size/1024)} KB`);
});
